import { useState } from 'react'
import { FileUploader } from '../components/FileUploader'
import {
  cropLabels,
  LABEL_CONFIGS,
  loadPDF,
  mergePDFs,
  type AmazonDescriptionMode
} from '../utils/pdfProcessor'
import { FileText, Loader2, Scissors, Trash2 } from 'lucide-react'
import { cn } from '../utils/cn'

type LabelMode = 'CROP' | 'MERGE_AND_CROP'
type PlatformKey = keyof typeof LABEL_CONFIGS

type DownloadItem = {
  name: string
  blob: Blob
}

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

export function LabelCropper() {
  const [labelMode, setLabelMode] = useState<LabelMode>('CROP')
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>('FLIPKART')
  const initialDefaults = getPlatformDefaults('FLIPKART')
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(initialDefaults.variantId)
  const [selectedOptions, setSelectedOptions] = useState<string[]>(initialDefaults.options)
  const [amazonDescriptionMode, setAmazonDescriptionMode] = useState<AmazonDescriptionMode>('WITH_SKU')
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const allowMultipleFiles = labelMode === 'MERGE_AND_CROP'

  const handleLabelModeChange = (nextMode: LabelMode) => {
    setLabelMode(nextMode)
    setFiles([])
  }

  const handlePlatformChange = (platform: PlatformKey) => {
    setSelectedPlatform(platform)
    const defaults = getPlatformDefaults(platform)
    setSelectedVariantId(defaults.variantId)
    setSelectedOptions(defaults.options)
    setAmazonDescriptionMode('WITH_SKU')
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

  const handleProcess = async () => {
    if (files.length === 0) return
    setIsProcessing(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const results: DownloadItem[] = []
      const config = LABEL_CONFIGS[selectedPlatform]

      if (labelMode === 'MERGE_AND_CROP') {
        const mergedPdf = await mergePDFs(files)
        const croppedPdf = await cropLabels(
          mergedPdf,
          config,
          false,
          selectedVariantId,
          selectedOptions,
          amazonDescriptionMode
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
          false,
          selectedVariantId,
          selectedOptions,
          amazonDescriptionMode
        )

        const bytes = await croppedPdf.save({ useObjectStreams: false })
        results.push({
          name: getDownloadName(config.label, 'pdf'),
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
        })
      }

      for (const item of results) {
        downloadFile(item)
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
        <h2 className="text-xl font-bold text-slate-900">E-commerce Label Cropper</h2>
        <p className="mt-1 text-sm text-slate-600">Crop and optimize shipping labels for Flipkart, Meesho, and Amazon.</p>
      </section>

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
              Crop Single Label
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

      {selectedPlatform === 'AMAZON' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Amazon Process</p>
          <div className="flex flex-wrap gap-4">
            {[
              { id: 'WITH_SKU', label: 'With SKU' },
              { id: 'WITH_DESCRIPTION', label: 'With Description' }
            ].map(option => (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
                  amazonDescriptionMode === option.id
                    ? 'border-sky-600 bg-sky-50 text-sky-700'
                    : 'border-slate-300 text-slate-700 hover:border-sky-300'
                )}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    amazonDescriptionMode === option.id
                      ? 'border-sky-600 bg-sky-600'
                      : 'border-slate-300 bg-white'
                  )}
                >
                  {amazonDescriptionMode === option.id && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <input
                  type="radio"
                  name="amazonDescriptionMode"
                  value={option.id}
                  checked={amazonDescriptionMode === option.id}
                  onChange={() => setAmazonDescriptionMode(option.id as AmazonDescriptionMode)}
                  className="hidden"
                />
                {option.label}
              </label>
            ))}
          </div>
        </section>
      )}

      {LABEL_CONFIGS[selectedPlatform].variants && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Invoice Options</p>
          <div className="flex flex-wrap gap-4">
            {LABEL_CONFIGS[selectedPlatform].variants?.map((variant) => (
              <label
                key={variant.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
                  selectedVariantId === variant.id
                    ? 'border-sky-600 bg-sky-50 text-sky-700'
                    : 'border-slate-300 text-slate-700 hover:border-sky-300'
                )}
              >
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selectedVariantId === variant.id
                      ? 'border-sky-600 bg-sky-600'
                      : 'border-slate-300 bg-white'
                  )}
                >
                  {selectedVariantId === variant.id && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <input
                  type="radio"
                  name="meeshoVariant"
                  value={variant.id}
                  checked={selectedVariantId === variant.id}
                  onChange={() => setSelectedVariantId(variant.id)}
                  className="hidden"
                />
                {variant.label}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upload Labels</h3>
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
          title="Upload Label PDF"
          activeTitle={allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here'}
          description="Drag and drop PDF file(s), or click to browse."
          hint="Supports Flipkart, Meesho, and Amazon labels"
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
                <Scissors className="h-4 w-10" />
                Run Cropper
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
