import { useState } from 'react'
import { FileUploader } from '../components/FileUploader'
import {
  convertPDFToImages,
  mergePDFs,
  splitPDF
} from '../utils/pdfProcessor'
import { Download, FileText, Loader2, Trash2 } from 'lucide-react'
import { cn } from '../utils/cn'

type PdfTool = 'PDF_MERGE' | 'PDF_SPLIT' | 'PDF_TO_IMAGE'

type DownloadItem = {
  name: string
  blob: Blob
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
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const allowMultipleFiles = pdfTool === 'PDF_MERGE'

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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-slate-900">PDF Essential Tools</h2>
        <p className="mt-1 text-sm text-slate-600">Quick actions to merge, split, or convert your PDF documents.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Select Tool</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['PDF_MERGE', 'PDF_SPLIT', 'PDF_TO_IMAGE'] as PdfTool[]).map(tool => (
            <button
              key={tool}
              onClick={() => handlePdfToolChange(tool)}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                pdfTool === tool
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-300 text-slate-700 hover:border-sky-300'
              )}
            >
              {tool === 'PDF_MERGE' ? 'Merge PDF' : tool === 'PDF_SPLIT' ? 'Split PDF' : 'PDF to Image'}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upload Files</h3>
            <p className="text-xs text-slate-500">{allowMultipleFiles ? 'Multiple files allowed' : 'Single file only'}</p>
          </div>
          {files.length > 0 && (
            <button
              onClick={clearFiles}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <FileUploader
          onFileSelect={handleFileSelect}
          multiple={allowMultipleFiles}
          title={pdfTool === 'PDF_MERGE' ? 'Upload Multiple PDFs' : 'Upload PDF'}
          activeTitle={allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here'}
          description="Drag and drop PDF file(s), or click to browse."
          hint="All processing happens locally for your security"
        />

        <div className="mt-5 flex justify-center">
          <button
            onClick={handleProcess}
            disabled={isProcessing || files.length === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="h-4 w-10" />
                Run Process
              </>
            )}
          </button>
        </div>

        {files.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Queue ({files.length})</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    disabled={isProcessing}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
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
