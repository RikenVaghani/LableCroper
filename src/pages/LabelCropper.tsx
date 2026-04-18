import { useState } from 'react'
import type { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { FileUploader } from '../components/FileUploader'
import {
  cropLabels,
  LABEL_CONFIGS,
  loadPDF,
  mergePDFDocuments,
  mergePDFs,
  type AmazonDescriptionMode
} from '../utils/pdfProcessor'
import { 
  FileText, 
  Loader2, 
  Scissors, 
  Trash2, 
  ShoppingBag, 
  Package, 
  Box, 
  GitMerge, 
  Info, 
  ChevronRight,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../utils/cn'

type LabelMode = 'CROP' | 'MERGE_AND_CROP'
type PlatformKey = keyof typeof LABEL_CONFIGS

type DownloadItem = {
  name: string
  blob: Blob
}

// UI Configuration Objects
const PLATFORM_UI_CONFIG: Record<PlatformKey, {
  icon: LucideIcon;
  iconClassName: string;
  description: string;
}> = {
  FLIPKART: {
    icon: ShoppingBag,
    iconClassName: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
    description: 'Optimize labels for Flipkart smart and standard fulfillment.'
  },
  MEESHO: {
    icon: Package,
    iconClassName: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-300',
    description: 'Process Meesho labels with or without tax invoices automatically.'
  },
  AMAZON: {
    icon: Box,
    iconClassName: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    description: 'Extract descriptions and order summaries from Amazon label PDFs.'
  }
};

const MODE_UI_CONFIG: Record<LabelMode, {
  label: string;
  hoverText: string;
  icon: LucideIcon;
  iconClassName: string;
}> = {
  CROP: {
    label: 'Single Crop',
    hoverText: 'Process one PDF file at a time for quick cropping.',
    icon: Scissors,
    iconClassName: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
  },
  MERGE_AND_CROP: {
    label: 'Merge & Crop',
    hoverText: 'Combine multiple label PDFs into one optimized file.',
    icon: GitMerge,
    iconClassName: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300'
  }
};

// --- Sub-Components ---

interface SelectionCardProps {
    isActive: boolean;
    onClick: () => void;
    icon: LucideIcon;
    iconClassName: string;
    label: string;
    description: string;
    hoverText: string;
    showInfo?: boolean;
    logo?: string;
}

function SelectionCard({ 
    isActive, 
    onClick, 
    icon: Icon, 
    iconClassName, 
    label, 
    description, 
    hoverText,
    showInfo = true,
    logo
}: SelectionCardProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'group/card relative cursor-pointer rounded-2xl border p-4 text-left transition',
                isActive
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-2 ring-sky-100 dark:ring-sky-900/50'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 hover:border-sky-300 hover:shadow-sm'
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconClassName)}>
                    <Icon className="h-5 w-5" />
                </span>
                
                <div className="flex items-center gap-2">
                    {logo && (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-slate-800 p-1 shadow-sm border border-slate-100 dark:border-slate-700">
                            <img src={logo} alt="logo" className="h-full w-full object-contain" />
                        </span>
                    )}
                    {showInfo && (
                        <span className="relative inline-flex shrink-0 items-center text-slate-400 dark:text-slate-500">
                            <Info className="h-4 w-4" />
                            <span
                                className={cn(
                                    'pointer-events-none absolute right-0 top-full z-20 mt-2 w-60 rounded-lg border px-3 py-2 text-left text-xs font-medium shadow-xl opacity-0 transition',
                                    isActive
                                        ? 'border-sky-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300',
                                    'group-hover/card:opacity-100'
                                )}
                            >
                                {hoverText}
                            </span>
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
                <span className="block min-w-0">
                    <span className={cn(
                        'block text-lg font-semibold',
                        isActive ? 'text-sky-700 dark:text-sky-300' : 'text-slate-900 dark:text-slate-100'
                    )}>
                        {label}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400 truncate">
                        {description}
                    </span>
                </span>
                <ChevronRight className={cn(
                    'mt-1 h-5 w-5 shrink-0',
                    isActive ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400 dark:text-slate-500'
                )} />
            </div>
        </button>
    );
}

interface ToggleOptionProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function ToggleOption({ label, checked, onChange }: ToggleOptionProps) {
    return (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:border-sky-300">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            {label}
        </label>
    );
}

// --- Main Component ---

function getPlatformDefaults(platform: PlatformKey) {
  const config = LABEL_CONFIGS[platform]
  return {
    variantId: config.variants?.[0]?.id ?? null,
    options: platform === 'AMAZON' ? ['order_page'] : []
  }
}

function buildTimestamp() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${dd}${mm}${yy}${hh}${min}${ss}`
}

function getFileBaseName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '').trim().replace(/\s+/g, '_')
}

function getDownloadName(tag: string, forcedExt: string = 'pdf', sourceFileName?: string, timestamp?: string) {
  const ts = timestamp ?? buildTimestamp()
  const ext = forcedExt.startsWith('.') ? forcedExt : `.${forcedExt}`
  const originalPart = sourceFileName ? `_${getFileBaseName(sourceFileName)}` : ''
  return `E-com_${tag}${originalPart}_${ts}${ext.toLowerCase()}`
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
  const [includeAmazonOrderSummary, setIncludeAmazonOrderSummary] = useState(false)
  const [includeMeeshoOrderSummary, setIncludeMeeshoOrderSummary] = useState(false)
  const [includeFlipkartOrderSummary, setIncludeFlipkartOrderSummary] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<DownloadItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreparingZip, setIsPreparingZip] = useState(false)

  const allowMultipleFiles = true

  const handleLabelModeChange = (nextMode: LabelMode) => {
    setLabelMode(nextMode)
    setFiles([])
    setGeneratedFiles([])
  }

  const handlePlatformChange = (platform: PlatformKey) => {
    setSelectedPlatform(platform)
    const defaults = getPlatformDefaults(platform)
    setSelectedVariantId(defaults.variantId)
    setSelectedOptions(defaults.options)
    setAmazonDescriptionMode('WITH_SKU')
    setIncludeAmazonOrderSummary(false)
    setIncludeMeeshoOrderSummary(false)
    setIncludeFlipkartOrderSummary(false)
    setFiles([])
    setGeneratedFiles([])
  }

  const handleFileSelect = (selectedFile: File) => {
    setFiles(prev => [...prev, selectedFile])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
  }

  const clearGeneratedFiles = () => {
    setGeneratedFiles([])
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

  const handleDownloadAllZip = async () => {
    if (generatedFiles.length === 0 || isPreparingZip) return

    setIsPreparingZip(true)
    try {
      const zip = new JSZip()
      for (const item of generatedFiles) {
        zip.file(item.name, item.blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      downloadFile({
        name: `E-com_${LABEL_CONFIGS[selectedPlatform].label}_Batch_${buildTimestamp()}.zip`,
        blob: zipBlob
      })
    } catch (error) {
      console.error('Failed to prepare ZIP:', error)
      alert('Failed to prepare ZIP download. Please try again.')
    } finally {
      setIsPreparingZip(false)
    }
  }

  const handleProcess = async () => {
    if (files.length === 0) return

    if (labelMode === 'CROP' && files.length > 1) {
      const shouldContinue = window.confirm(
        `You selected ${files.length} files. This will download ${files.length} PDFs one by one.\n\n` +
        'If Chrome asks for "Allow multiple downloads", please click "Allow".\n\n' +
        'Continue processing?'
      )
      if (!shouldContinue) return
    }

    setIsProcessing(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const results: DownloadItem[] = []
      const config = LABEL_CONFIGS[selectedPlatform]
      const batchTimestamp = buildTimestamp()

      if (labelMode === 'MERGE_AND_CROP') {
        const croppedPdf =
          selectedPlatform === 'AMAZON'
            ? await (async () => {
                const processedDocs: PDFDocument[] = []
                for (const file of files) {
                  const sourcePdf = await loadPDF(file)
                  const processed = await cropLabels(
                    sourcePdf,
                    config,
                    false,
                    selectedVariantId,
                    selectedOptions,
                    amazonDescriptionMode,
                    includeAmazonOrderSummary,
                    includeMeeshoOrderSummary,
                    includeFlipkartOrderSummary
                  )
                  processedDocs.push(processed)
                }
                return await mergePDFDocuments(processedDocs)
              })()
            : await (async () => {
                const mergedPdf = await mergePDFs(files)
                return await cropLabels(
                  mergedPdf,
                  config,
                  false,
                  selectedVariantId,
                  selectedOptions,
                  amazonDescriptionMode,
                  includeAmazonOrderSummary,
                  includeMeeshoOrderSummary,
                  includeFlipkartOrderSummary
                )
              })()

        const bytes = await croppedPdf.save({ useObjectStreams: false })
        results.push({
          name: getDownloadName(`M_${config.label}`, 'pdf', undefined, batchTimestamp),
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
        })
      } else {
        for (const file of files) {
          const sourcePdf = await loadPDF(file)
          const croppedPdf = await cropLabels(
            sourcePdf,
            config,
            false,
            selectedVariantId,
            selectedOptions,
            amazonDescriptionMode,
            includeAmazonOrderSummary,
            includeMeeshoOrderSummary,
            includeFlipkartOrderSummary
          )

          const bytes = await croppedPdf.save({ useObjectStreams: false })
          results.push({
            name: getDownloadName(config.label, 'pdf', file.name, batchTimestamp),
            blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
          })
        }
      }

      for (const item of results) {
        downloadFile(item)
      }
      setGeneratedFiles(results)
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">E-commerce Label Cropper</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Crop and optimize shipping labels for Flipkart, Meesho, and Amazon.</p>
      </section>

      {/* Mode Selection */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Mode</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['CROP', 'MERGE_AND_CROP'] as LabelMode[]).map(mode => {
            const config = MODE_UI_CONFIG[mode]
            return (
              <SelectionCard
                key={mode}
                isActive={labelMode === mode}
                onClick={() => handleLabelModeChange(mode)}
                icon={config.icon}
                iconClassName={config.iconClassName}
                label={config.label}
                description={config.hoverText}
                hoverText={config.hoverText}
              />
            )
          })}
        </div>
      </section>

      {/* Platform Selection */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Platform</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(LABEL_CONFIGS) as PlatformKey[]).map(platform => {
            const config = PLATFORM_UI_CONFIG[platform]
            const baseConfig = LABEL_CONFIGS[platform]
            return (
              <SelectionCard
                key={platform}
                isActive={selectedPlatform === platform}
                onClick={() => handlePlatformChange(platform)}
                icon={config.icon}
                iconClassName={config.iconClassName}
                label={baseConfig.label}
                description={config.description}
                hoverText={config.description}
                logo={getAssetPath(baseConfig.logo)}
              />
            )
          })}
        </div>
      </section>

      {/* Platform-Specific Options */}
      <div className="grid grid-cols-1 gap-5">
        {selectedPlatform === 'AMAZON' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Amazon Options</p>
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
                      ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-300'
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    amazonDescriptionMode === option.id ? 'border-sky-600 bg-sky-600' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                  )}>
                    {amazonDescriptionMode === option.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
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
            <div className="mt-4">
              <ToggleOption label="Add order summary on last page" checked={includeAmazonOrderSummary} onChange={setIncludeAmazonOrderSummary} />
            </div>
          </section>
        )}

        {selectedPlatform === 'MEESHO' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Meesho Options</p>
            <ToggleOption label="Add order summary on last page" checked={includeMeeshoOrderSummary} onChange={setIncludeMeeshoOrderSummary} />
          </section>
        )}

        {selectedPlatform === 'FLIPKART' && (
             <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flipkart Options</p>
                <ToggleOption label="Add order summary on last page" checked={includeFlipkartOrderSummary} onChange={setIncludeFlipkartOrderSummary} />
            </section>
        )}

        {LABEL_CONFIGS[selectedPlatform].variants && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoice Selection</p>
            <div className="flex flex-wrap gap-4">
              {LABEL_CONFIGS[selectedPlatform].variants?.map((variant) => (
                <label
                  key={variant.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
                    selectedVariantId === variant.id ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-300'
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selectedVariantId === variant.id ? 'border-sky-600 bg-sky-600' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                  )}>
                    {selectedVariantId === variant.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <input
                    type="radio"
                    name="platformVariant"
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
      </div>

      {/* File Uploader Section */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Upload Labels</h3>
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
          title="Upload Label PDF"
          activeTitle={allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here'}
          description="Drag and drop PDF file(s), or click to browse."
          hint={`Supports ${selectedPlatform.charAt(0) + selectedPlatform.slice(1).toLowerCase()} labels`}
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
                <Scissors className="h-4 w-4" />
                Run Cropper
              </>
            )}
          </button>
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Queue ({files.length})</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
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

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-sky-600 dark:text-sky-400 text-center px-4">
          <Info className="h-3 w-3 shrink-0" />
          <span>Best Result in "Fit to Page" Position in Thermal Printer</span>
        </div>
      </section>

      {generatedFiles.length > 0 && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Download Results</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If browser auto-download was blocked, use buttons below.
              </p>
            </div>
            <button
              onClick={clearGeneratedFiles}
              disabled={isPreparingZip}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:border-red-300 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          <div className="mb-3">
            <button
              onClick={handleDownloadAllZip}
              disabled={isPreparingZip}
              className="inline-flex items-center gap-2 rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-900/30"
            >
              {isPreparingZip ? 'Preparing ZIP...' : 'Download All (ZIP)'}
            </button>
          </div>

          <ul className="space-y-2">
            {generatedFiles.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                </div>
                <button
                  onClick={() => downloadFile(item)}
                  disabled={isPreparingZip}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-900/30"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Download
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
