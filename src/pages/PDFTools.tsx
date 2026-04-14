import { useState } from 'react'
import { FileUploader } from '../components/FileUploader'
import {
  compressPDF,
  convertImagesToPDF,
  convertPDFToImages,
  mergePDFs,
  splitPDF,
  type CompressionLevel
} from '../utils/pdfProcessor'
import {
  ChevronRight,
  Download,
  FileDown,
  FileImage,
  FileText,
  GitMerge,
  Images,
  Info,
  Loader2,
  Minimize2,
  Scissors,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../utils/cn'

type PdfTool = 'PDF_MERGE' | 'PDF_SPLIT' | 'PDF_TO_IMAGE' | 'PDF_COMPRESS' | 'IMAGE_TO_PDF'

type DownloadItem = {
  name: string
  blob: Blob
}

const PDF_INPUT_ACCEPT = {
  'application/pdf': ['.pdf']
}

const IMAGE_INPUT_ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'image/gif': ['.gif']
}

const COMPRESSION_LEVEL_OPTIONS: { id: CompressionLevel; title: string; subtitle: string }[] = [
  {
    id: 'EXTREME',
    title: 'Extreme Compression',
    subtitle: 'Less quality, high compression'
  },
  {
    id: 'RECOMMENDED',
    title: 'Recommended Compression',
    subtitle: 'Good quality, good compression'
  },
  {
    id: 'LESS',
    title: 'Less compression',
    subtitle: 'High quality, less compression'
  }
]

const PDF_TOOL_CONFIG: Record<
  PdfTool,
  {
    label: string
    hoverText: string
    uploadTitle: string
    icon: LucideIcon
    iconClassName: string
  }
> = {
  PDF_MERGE: {
    label: 'Merge PDF',
    hoverText: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    uploadTitle: 'Upload Multiple PDFs',
    icon: GitMerge,
    iconClassName: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300'
  },
  PDF_SPLIT: {
    label: 'Split PDF',
    hoverText: 'Separate one PDF into multiple single-page files quickly.',
    uploadTitle: 'Upload PDF',
    icon: Scissors,
    iconClassName: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
  },
  PDF_TO_IMAGE: {
    label: 'PDF to Image',
    hoverText: 'Convert every PDF page into high-quality image files.',
    uploadTitle: 'Upload PDF',
    icon: FileDown,
    iconClassName: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
  },
  PDF_COMPRESS: {
    label: 'Compress PDF',
    hoverText: 'Reduce PDF file size for easier sharing and faster uploads.',
    uploadTitle: 'Upload PDF',
    icon: Minimize2,
    iconClassName: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
  },
  IMAGE_TO_PDF: {
    label: 'Images to PDF',
    hoverText: 'Convert one or more image files into a single PDF in selection order.',
    uploadTitle: 'Upload Images',
    icon: Images,
    iconClassName: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
  }
}

function getDownloadName(tag: string, forcedExt: string = 'pdf') {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const timestamp = `${dd}${mm}${yy}${hh}${min}${ss}`
  const ext = forcedExt.startsWith('.') ? forcedExt : `.${forcedExt}`
  return `E-com_${tag}_${timestamp}${ext.toLowerCase()}`
}

export function PDFTools() {
  const [pdfTool, setPdfTool] = useState<PdfTool>('PDF_MERGE')
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('RECOMMENDED')
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const isImagesToPdf = pdfTool === 'IMAGE_TO_PDF'
  const allowMultipleFiles = pdfTool === 'PDF_MERGE' || isImagesToPdf
  const activeTitle = isImagesToPdf
    ? (allowMultipleFiles ? 'Drop your image files here' : 'Drop your image file here')
    : (allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here')
  const uploaderDescription = isImagesToPdf
    ? 'Drag and drop image file(s), or click to browse.'
    : 'Drag and drop PDF file(s), or click to browse.'
  const uploaderHint = isImagesToPdf
    ? 'Accepted: JPG, PNG, WEBP, BMP, GIF'
    : 'All processing happens locally for your security'
  const uploaderRejectionMessage = isImagesToPdf
    ? 'Please upload valid image files'
    : 'Please upload a valid PDF file'
  const uploaderAccept = isImagesToPdf ? IMAGE_INPUT_ACCEPT : PDF_INPUT_ACCEPT

  const handlePdfToolChange = (nextTool: PdfTool) => {
    setPdfTool(nextTool)
    setFiles([])
  }

  const handleFileSelect = (selectedFile: File) => {
    if (!allowMultipleFiles) {
      setFiles([selectedFile])
      return
    }
    setFiles(prev => [...prev, selectedFile])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
  }

  const downloadFile = (item: DownloadItem) => {
    const url = URL.createObjectURL(item.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 15000)
  }

  const downloadZip = async (items: DownloadItem[], zipTag: string) => {
    const JSZipModule = await import('jszip')
    const JSZip = JSZipModule.default || JSZipModule
    const zip = new JSZip()

    items.forEach(item => {
      zip.file(item.name, item.blob)
    })

    const zipContent = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    downloadFile({
      name: getDownloadName(zipTag, 'zip'),
      blob: zipContent
    })
  }

  const handleProcess = async () => {
    if (files.length === 0) return
    setIsProcessing(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const results: DownloadItem[] = []

      if (pdfTool === 'PDF_MERGE') {
        const mergedPdf = await mergePDFs(files)
        const bytes = await mergedPdf.save({ useObjectStreams: false })
        results.push({
          name: getDownloadName('MergePdf', 'pdf'),
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
        })
      } else if (pdfTool === 'PDF_SPLIT') {
        const splitResults = await splitPDF(files[0])
        splitResults.forEach(item => {
          results.push({
            name: item.name,
            blob: new Blob([item.bytes as BlobPart], { type: 'application/pdf' })
          })
        })
      } else if (pdfTool === 'PDF_TO_IMAGE') {
        const imageResults = await convertPDFToImages(files[0])
        imageResults.forEach(item => {
          results.push({
            name: item.name,
            blob: item.blob
          })
        })
      } else if (pdfTool === 'PDF_COMPRESS') {
        const bytes = await compressPDF(files[0], compressionLevel)
        results.push({
          name: getDownloadName('CompressPdf', 'pdf'),
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
        })
      } else if (pdfTool === 'IMAGE_TO_PDF') {
        const bytes = await convertImagesToPDF(files)
        results.push({
          name: getDownloadName('ImgToPdf', 'pdf'),
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
        })
      }

      if (results.length > 0) {
        const shouldZip = pdfTool === 'PDF_SPLIT' || pdfTool === 'PDF_TO_IMAGE'
        if (shouldZip) {
          const zipTag = pdfTool === 'PDF_SPLIT' ? 'SplitPdf' : 'PdftoImg'
          await downloadZip(results, zipTag)
        } else {
          for (const item of results) {
            downloadFile(item)
          }
        }
      }
      setFiles([])
    } catch (error) {
      console.error('Error processing PDF:', error)
      alert('Failed to process PDF. Please check the file and try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">PDF Essential Tools</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Quick actions to merge, split, compress, and convert between PDFs and images.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Tool</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(['PDF_MERGE', 'PDF_SPLIT', 'PDF_TO_IMAGE', 'PDF_COMPRESS', 'IMAGE_TO_PDF'] as PdfTool[]).map(tool => {
            const config = PDF_TOOL_CONFIG[tool]
            const Icon = config.icon

            return (
              <button
                key={tool}
                onClick={() => handlePdfToolChange(tool)}
                className={cn(
                  'group/tool relative cursor-pointer rounded-2xl border p-4 text-left transition',
                  pdfTool === tool
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-2 ring-sky-100 dark:ring-sky-900/50'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 hover:border-sky-300 hover:shadow-sm'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', config.iconClassName)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="relative inline-flex shrink-0 items-center text-slate-400 dark:text-slate-500">
                    <Info className="h-4 w-4" />
                    <span
                      className={cn(
                        'pointer-events-none absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border px-3 py-2 text-left text-xs font-medium shadow-xl opacity-0 transition',
                        pdfTool === tool
                          ? 'border-sky-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300',
                        'group-hover/tool:opacity-100'
                      )}
                    >
                      {config.hoverText}
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-3">
                  <span className="block min-w-0">
                    <span className={cn(
                      'block text-lg font-semibold',
                      pdfTool === tool
                        ? 'text-sky-700 dark:text-sky-300'
                        : 'text-slate-900 dark:text-slate-100'
                    )}>
                      {config.label}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                      {config.hoverText}
                    </span>
                  </span>
                  <ChevronRight className={cn(
                    'mt-1 h-5 w-5 shrink-0',
                    pdfTool === tool
                      ? 'text-sky-600 dark:text-sky-300'
                      : 'text-slate-400 dark:text-slate-500'
                  )} />
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {pdfTool === 'PDF_COMPRESS' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Compression level</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {COMPRESSION_LEVEL_OPTIONS.map(level => (
              <button
                key={level.id}
                onClick={() => setCompressionLevel(level.id)}
                className={cn(
                  'cursor-pointer rounded-xl border px-3 py-3 text-left text-sm font-semibold transition',
                  compressionLevel === level.id
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-sky-300'
                )}
              >
                <p>{level.title}</p>
                <p className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400">{level.subtitle}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Upload Files</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{allowMultipleFiles ? 'Multiple files allowed' : 'Single file only'}</p>
          </div>
          {files.length > 0 && (
            <button
              onClick={clearFiles}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <FileUploader
          onFileSelect={handleFileSelect}
          multiple={allowMultipleFiles}
          title={PDF_TOOL_CONFIG[pdfTool].uploadTitle}
          activeTitle={activeTitle}
          description={uploaderDescription}
          hint={uploaderHint}
          accept={uploaderAccept}
          rejectionMessage={uploaderRejectionMessage}
        />

        <div className="mt-5 flex justify-center">
          <button
            onClick={handleProcess}
            disabled={isProcessing || files.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Run Process
              </>
            )}
          </button>
        </div>

        {files.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Queue ({files.length})</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {file.type.startsWith('image/') ? (
                      <FileImage className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={isProcessing}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
