import { useMemo, useState } from 'react'
import { FileUploader } from './components/FileUploader'
import { convertPDFToImages, cropLabels, LABEL_CONFIGS, loadPDF, mergePDFs, splitPDF } from './utils/pdfProcessor'
import { Download, FileText, Loader2, Scissors, Trash2 } from 'lucide-react'
import { cn } from './utils/cn'

type Page = 'LABEL_CROPPER' | 'PDF_TOOLS'
type LabelMode = 'CROP' | 'MERGE_AND_CROP'
type PdfTool = 'PDF_MERGE' | 'PDF_SPLIT' | 'PDF_TO_IMAGE'
type PlatformKey = keyof typeof LABEL_CONFIGS

type DownloadItem = {
  name: string
  blob: Blob
}

const DEFAULT_PAGE: Page = 'LABEL_CROPPER'
const DEFAULT_PLATFORM: PlatformKey = 'FLIPKART'

function getPlatformDefaults(platform: PlatformKey) {
  const config = LABEL_CONFIGS[platform]
  return {
    variantId: config.variants?.[0]?.id ?? null,
    options: platform === 'AMAZON' ? ['order_page'] : []
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

function getAssetPath(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, '')}`
}

function App() {
  const initialPlatformDefaults = getPlatformDefaults(DEFAULT_PLATFORM)

  const [activePage, setActivePage] = useState<Page>(DEFAULT_PAGE)
  const [labelMode, setLabelMode] = useState<LabelMode>('CROP')
  const [pdfTool, setPdfTool] = useState<PdfTool>('PDF_MERGE')
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>(DEFAULT_PLATFORM)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(initialPlatformDefaults.variantId)
  const [selectedOptions, setSelectedOptions] = useState<string[]>(initialPlatformDefaults.options)
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const allowMultipleFiles = useMemo(() => {
    if (activePage === 'LABEL_CROPPER') {
      return labelMode === 'MERGE_AND_CROP'
    }

    return pdfTool === 'PDF_MERGE'
  }, [activePage, labelMode, pdfTool])

  const pageTitle = activePage === 'LABEL_CROPPER' ? 'Label Cropper' : 'PDF Tools'
  const pageDescription =
    activePage === 'LABEL_CROPPER'
      ? 'Crop labels for Flipkart, Meesho, and Amazon with two simple modes.'
      : 'Use quick PDF actions: merge, split, or convert PDF pages to images.'

  const queueHint = allowMultipleFiles ? 'Multiple files allowed' : 'Single file only'

  const handlePageChange = (page: Page) => {
    setActivePage(page)
    setFiles([])

    if (page === 'LABEL_CROPPER') {
      setLabelMode('CROP')
      setSelectedPlatform(DEFAULT_PLATFORM)
      const defaults = getPlatformDefaults(DEFAULT_PLATFORM)
      setSelectedVariantId(defaults.variantId)
      setSelectedOptions(defaults.options)
      return
    }

    setPdfTool('PDF_MERGE')
  }

  const handleLabelModeChange = (nextMode: LabelMode) => {
    setLabelMode(nextMode)
    setFiles([])
  }

  const handlePdfToolChange = (nextTool: PdfTool) => {
    setPdfTool(nextTool)
    setFiles([])
  }

  const handlePlatformChange = (platform: PlatformKey) => {
    setSelectedPlatform(platform)
    const defaults = getPlatformDefaults(platform)
    setSelectedVariantId(defaults.variantId)
    setSelectedOptions(defaults.options)
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

      if (activePage === 'LABEL_CROPPER') {
        const config = LABEL_CONFIGS[selectedPlatform]
        const extractSku = false

        if (labelMode === 'MERGE_AND_CROP') {
          const mergedPdf = await mergePDFs(files)
          const croppedPdf = await cropLabels(
            mergedPdf,
            config,
            extractSku,
            selectedVariantId,
            selectedOptions
          )

          const bytes = await croppedPdf.save({ useObjectStreams: false })
          results.push({
            name: getDownloadName(`M_${config.label}`, 'pdf'),
            blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
          })
        } else {
          const sourcePdf = await loadPDF(files[0])
          const croppedPdf = await cropLabels(
            sourcePdf,
            config,
            extractSku,
            selectedVariantId,
            selectedOptions
          )

          const bytes = await croppedPdf.save({ useObjectStreams: false })
          results.push({
            name: getDownloadName(config.label, 'pdf'),
            blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
          })
        }
      } else {
        if (pdfTool === 'PDF_MERGE') {
          const mergedPdf = await mergePDFs(files)
          const bytes = await mergedPdf.save({ useObjectStreams: false })
          results.push({
            name: getDownloadName('MergePdf', 'pdf'),
            blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
          })
        }

        if (pdfTool === 'PDF_SPLIT') {
          const splitResults = await splitPDF(files[0])
          splitResults.forEach(item => {
            results.push({
              name: item.name,
              blob: new Blob([item.bytes as BlobPart], { type: 'application/pdf' })
            })
          })
        }

        if (pdfTool === 'PDF_TO_IMAGE') {
          const imageResults = await convertPDFToImages(files[0])
          imageResults.forEach(item => {
            results.push({
              name: item.name,
              blob: item.blob
            })
          })
        }
      }

      if (results.length > 0) {
        const shouldZip = activePage === 'PDF_TOOLS' && (pdfTool === 'PDF_SPLIT' || pdfTool === 'PDF_TO_IMAGE')

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
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#f0f9ff,_#f8fafc_45%,_#ffffff)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-600 p-2 shadow-sm">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Label Cropper" className="h-full w-full object-contain brightness-0 invert" />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">Label Cropper Toolkit</h1>
              <p className="text-xs text-slate-500">Simple tools for label and PDF processing</p>
            </div>
          </div>

          <nav className="flex w-full gap-2 sm:w-auto">
            <button
              onClick={() => handlePageChange('LABEL_CROPPER')}
              className={cn(
                'flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition sm:flex-none',
                activePage === 'LABEL_CROPPER'
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
              )}
            >
              Label Cropper
            </button>
            <button
              onClick={() => handlePageChange('PDF_TOOLS')}
              className={cn(
                'flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition sm:flex-none',
                activePage === 'PDF_TOOLS'
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300'
              )}
            >
              PDF Tools
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ">
          <h2 className="text-xl font-bold text-slate-900">{pageTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{pageDescription}</p>
        </section>

        {activePage === 'LABEL_CROPPER' ? (
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Mode</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  onClick={() => handleLabelModeChange('CROP')}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                    labelMode === 'CROP'
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300 text-slate-700 hover:border-sky-300'
                  )}
                >
                  Crop Label
                </button>
                <button
                  onClick={() => handleLabelModeChange('MERGE_AND_CROP')}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                    labelMode === 'MERGE_AND_CROP'
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300 text-slate-700 hover:border-sky-300'
                  )}
                >
                  Merge & Crop
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Platform</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(LABEL_CONFIGS) as PlatformKey[]).map(platform => {
                  const config = LABEL_CONFIGS[platform]

                  return (
                    <button
                      key={platform}
                      onClick={() => handlePlatformChange(platform)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
                        selectedPlatform === platform
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-300 text-slate-700 hover:border-sky-300'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full p-0.5',
                          selectedPlatform === platform ? 'bg-white/20' : 'bg-slate-100'
                        )}
                      >
                        <img
                          src={getAssetPath(config.logo)}
                          alt={`${config.label} logo`}
                          className="h-full w-full rounded-full object-contain"
                        />
                      </span>
                      <span>{config.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Select Tool</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={() => handlePdfToolChange('PDF_MERGE')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                  pdfTool === 'PDF_MERGE'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-sky-300'
                )}
              >
                Merge PDF
              </button>
              <button
                onClick={() => handlePdfToolChange('PDF_SPLIT')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                  pdfTool === 'PDF_SPLIT'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-sky-300'
                )}
              >
                Split PDF
              </button>
              <button
                onClick={() => handlePdfToolChange('PDF_TO_IMAGE')}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                  pdfTool === 'PDF_TO_IMAGE'
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-sky-300'
                )}
              >
                PDF to Image
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Upload Files</h3>
              <p className="text-xs text-slate-500">{queueHint}</p>
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
            title={activePage === 'LABEL_CROPPER' ? 'Upload Label PDF' : 'Upload PDF File'}
            activeTitle={allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here'}
            description="Drag and drop PDF file(s), or click to browse."
            hint={activePage === 'LABEL_CROPPER' ? 'Supports Flipkart, Meesho, and Amazon labels' : 'Use PDF documents only'}
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
                  {activePage === 'LABEL_CROPPER' ? (
                    <Scissors className="h-4 w-10" />
                  ) : (
                    <Download className="h-4 w-10" />
                  )}
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
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-center text-sm text-slate-600 sm:px-6">
          Best Result in Fit to Page Position in Thermal Printer.  |  Copyright © {new Date().getFullYear()} Riken Vaghani. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export default App
