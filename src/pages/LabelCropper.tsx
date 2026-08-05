import { useState, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import { FileUploader } from '../components/FileUploader'
import {
  cropLabels,
  buildAmazonOrderDetailsCsvFromPdf,
  detectPlatformFromPdf,
  LABEL_CONFIGS,
  loadPDF,
  mergePDFs,
  type AmazonDescriptionMode,
  type FlipkartDescriptionMode
} from '../utils/pdfProcessor'
import {
  FileText, 
  Loader2, 
  Scissors, 
  Trash2, 
  ShoppingBag, 
  Package, 
  Box, 
  Info, 
  Settings,
  ChevronRight,
  GitMerge,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../utils/cn'

type PlatformKey = keyof typeof LABEL_CONFIGS

type LabelMode = 'CROP' | 'MERGE_AND_CROP'

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
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  hoverText: string;
}> = {
  CROP: {
    icon: Scissors,
    iconClassName: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
    label: 'Single Lable Output',
    hoverText: 'Single-Single Lable file as output'
  },
  MERGE_AND_CROP: {
    icon: GitMerge,
    iconClassName: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Merge & Lable Process',
    hoverText: 'All File Merge Then Lable Process as single file'
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
    onSettingsClick?: (e: React.MouseEvent) => void;
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
    logo,
    onSettingsClick
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
                <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden', iconClassName)}>
                    {logo ? (
              <img src={logo} alt="logo" className="h-full w-full object-contain" />
                    ) : (
                        <Icon className="h-5 w-5" />
                    )}
                </span>
                
                <div className="flex items-center gap-2">
                    {showInfo && (
                        <span 
                            className="group/info relative inline-flex shrink-0 items-center text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSettingsClick?.(e);
                            }}
                        >
                            <Settings className="h-4 w-4" />
                            <span
                                className={cn(
                                    'pointer-events-none absolute right-0 top-6 z-20 w-60 rounded-lg border px-3 py-2 text-left text-xs font-medium shadow-xl opacity-0 transition',
                                    isActive
                                        ? 'border-sky-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300',
                                    'group-hover/info:opacity-100'
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

interface SummaryOptionProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    threshold: number;
    onThresholdChange: (value: number) => void;
}

function SummaryOption({ checked, onChange, threshold, onThresholdChange }: SummaryOptionProps) {
    return (
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:border-sky-300">
            <label className="flex cursor-pointer items-center gap-2">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="whitespace-nowrap">Add Summary (Pick List) After</span>
            </label>
            <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => onThresholdChange(parseInt(e.target.value) || 1)}
                className="w-12 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-1 py-0.5 text-center focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                disabled={!checked}
            />
            <span className="whitespace-nowrap">Order</span>
        </div>
    );
}

// --- Main Component ---

function getPlatformDefaults(platform: PlatformKey | null) {
  if (!platform) return { variantId: null, options: [] }
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
  const STORAGE_KEY = 'label_cropper_settings_v1'

  // Load initial settings from localStorage
  const getInitialSettings = () => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    try {
      return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to parse saved settings', e)
      return null
    }
  }

  const savedSettings = getInitialSettings()

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey | null>(null)
  const initialDefaults = getPlatformDefaults(null)
  
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    savedSettings?.selectedVariantId !== undefined ? savedSettings.selectedVariantId : initialDefaults.variantId
  )
  const [labelMode, setLabelMode] = useState<LabelMode>(
    savedSettings?.labelMode || 'CROP'
  )
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    savedSettings?.selectedOptions || initialDefaults.options
  )
  const [amazonDescriptionMode, setAmazonDescriptionMode] = useState<AmazonDescriptionMode>(
    savedSettings?.amazonDescriptionMode || 'WITH_SKU'
  )
  const [flipkartDescriptionMode, setFlipkartDescriptionMode] = useState<FlipkartDescriptionMode>(
    savedSettings?.flipkartDescriptionMode || 'WITH_SKU'
  )
  const [includeAmazonOrderSummary, setIncludeAmazonOrderSummary] = useState(
    !!savedSettings?.includeAmazonOrderSummary
  )
  const [includeAmazonOrderDetailsExcel, setIncludeAmazonOrderDetailsExcel] = useState(
    !!savedSettings?.includeAmazonOrderDetailsExcel
  )
  const [includeMeeshoOrderSummary, setIncludeMeeshoOrderSummary] = useState(
    !!savedSettings?.includeMeeshoOrderSummary
  )
  const [includeMeeshoCourierSummary, setIncludeMeeshoCourierSummary] = useState(
    !!savedSettings?.includeMeeshoCourierSummary
  )
  const [orderMeeshoBySku, setOrderMeeshoBySku] = useState(
    !!savedSettings?.orderMeeshoBySku
  )
  const [includeFlipkartOrderSummary, setIncludeFlipkartOrderSummary] = useState(
    !!savedSettings?.includeFlipkartOrderSummary
  )
  const [includePageNumbers, setIncludePageNumbers] = useState(
    !!savedSettings?.includePageNumbers
  )
  const [includeDateTimeOnLabel, setIncludeDateTimeOnLabel] = useState(
    savedSettings?.includeDateTimeOnLabel ?? true
  )
  const [summaryThreshold, setSummaryThreshold] = useState<number>(
    savedSettings?.summaryThreshold ?? 1
  )
  const [summaryOrientation] = useState<'portrait' | 'landscape'>(
    savedSettings?.summaryOrientation || 'portrait'
  )
  const [showMultiQtyOnBottom] = useState(
    !!savedSettings?.showMultiQtyOnBottom
  )
  const [includeMultiQtySummary, setIncludeMultiQtySummary] = useState(
    !!savedSettings?.includeMultiQtySummary
  )
  const [orderMeeshoByDeliveryPartner, setOrderMeeshoByDeliveryPartner] = useState(
    !!savedSettings?.orderMeeshoByDeliveryPartner
  )
  const [treatValmoPlusAsValmo, setTreatValmoPlusAsValmo] = useState(
    !!savedSettings?.treatValmoPlusAsValmo
  )

  const [files, setFiles] = useState<File[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<DownloadItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreparingZip, setIsPreparingZip] = useState(false)
  const [isDetectingPlatform, setIsDetectingPlatform] = useState(false)
  const [platformDetectionStatus, setPlatformDetectionStatus] = useState<string | null>(null)
  const detectionRunRef = useRef(0)

  // Persist settings whenever they change
  useEffect(() => {
    const settings = {
      selectedVariantId,
      selectedOptions,
      amazonDescriptionMode,
      flipkartDescriptionMode,
      includeAmazonOrderSummary,
      includeAmazonOrderDetailsExcel,
      includeMeeshoOrderSummary,
      includeFlipkartOrderSummary,
      includePageNumbers,
      includeDateTimeOnLabel,
      summaryThreshold,
      summaryOrientation,
      showMultiQtyOnBottom,
      includeMultiQtySummary,
      orderMeeshoByDeliveryPartner,
      includeMeeshoCourierSummary,
      orderMeeshoBySku,
      treatValmoPlusAsValmo,
      labelMode
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [
    selectedVariantId,
    selectedOptions,
    amazonDescriptionMode,
    flipkartDescriptionMode,
    includeAmazonOrderSummary,
    includeAmazonOrderDetailsExcel,
    includeMeeshoOrderSummary,
    includeFlipkartOrderSummary,
    includePageNumbers,
    includeDateTimeOnLabel,
    summaryThreshold,
    summaryOrientation,
    showMultiQtyOnBottom,
    includeMultiQtySummary,
    orderMeeshoByDeliveryPartner,
    includeMeeshoCourierSummary,
    orderMeeshoBySku,
    treatValmoPlusAsValmo,
    labelMode
  ])
  
  const optionsRef = useRef<HTMLDivElement>(null)
  const processButtonRef = useRef<HTMLDivElement>(null)

  const scrollToOptions = () => {
    optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const allowMultipleFiles = true

  const applyPlatformDefaults = (platform: PlatformKey | null, resetFileState: boolean) => {
    setSelectedPlatform(platform)
    const defaults = getPlatformDefaults(platform)
    setSelectedVariantId(defaults.variantId)
    setSelectedOptions(defaults.options)
    
    if (resetFileState) {
      setFiles([])
      setGeneratedFiles([])
    }
  }

  const handleLabelModeChange = (mode: LabelMode) => {
    setLabelMode(mode)
  }

  const handlePlatformChange = (platform: PlatformKey) => {
    applyPlatformDefaults(platform, true)
    setPlatformDetectionStatus(null)
  }

  const handleFilesSelect = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return

    setFiles(prev => [...prev, ...selectedFiles])
    const runId = ++detectionRunRef.current

    setIsDetectingPlatform(true)
    try {
      let detectedPlatform: PlatformKey | null = null
      let detectedFileName = ''

      // Try each newly uploaded file until one platform is confidently detected.
      for (const file of selectedFiles) {
        const platform = await detectPlatformFromPdf(file)
        if (platform) {
          detectedPlatform = platform as PlatformKey
          detectedFileName = file.name
          break
        }
      }

      // Ignore stale async runs if user uploads again quickly.
      if (runId !== detectionRunRef.current) return

      if (!detectedPlatform) {
        setPlatformDetectionStatus('Platform not detected automatically. Please select manually.')
        return
      }

      applyPlatformDefaults(detectedPlatform, false)

      const platformLabel = LABEL_CONFIGS[detectedPlatform].label
      setPlatformDetectionStatus(`Auto-selected ${platformLabel} from "${detectedFileName}".`)
    } finally {
      if (runId === detectionRunRef.current) {
        setIsDetectingPlatform(false)
      }
      setTimeout(() => {
        processButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setPlatformDetectionStatus(null)
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
      const platformLabel = selectedPlatform ? LABEL_CONFIGS[selectedPlatform].label : 'Labels'
      downloadFile({
        name: `E-com_${platformLabel}_Batch_${buildTimestamp()}.zip`,
        blob: zipBlob
      })
    } catch (error) {
      console.error('Failed to prepare ZIP:', error)
      alert('Failed to prepare ZIP download. Please try again.')
    } finally {
      setIsPreparingZip(false)
    }
  }

  const handleProcess = async (mergeAllFiles: boolean) => {
    if (files.length === 0 || !selectedPlatform) return

    if (files.length > 1 && !mergeAllFiles) {
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
      const inputFiles = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))

      if (mergeAllFiles) {
        const sourcePdf =
          inputFiles.length > 1
            ? await mergePDFs(inputFiles)
            : await loadPDF(inputFiles[0])
        const processedPdf = await cropLabels(
          sourcePdf,
          config,
          false,
          selectedVariantId,
          selectedOptions,
          amazonDescriptionMode,
          flipkartDescriptionMode,
          includeAmazonOrderSummary,
          includeMeeshoOrderSummary,
          includeFlipkartOrderSummary,
          includePageNumbers,
          includeDateTimeOnLabel,
          summaryThreshold,
          summaryOrientation,
          showMultiQtyOnBottom,
          includeMultiQtySummary,
          orderMeeshoByDeliveryPartner,
          includeMeeshoCourierSummary,
          orderMeeshoBySku,
          treatValmoPlusAsValmo
        )
        const bytes = await processedPdf.save({ useObjectStreams: false })
        results.push({
          name: getDownloadName(`${config.label}_Merged`, 'pdf', undefined, batchTimestamp),
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
        })
        if (selectedPlatform === 'AMAZON' && includeAmazonOrderDetailsExcel) {
          const csv = await buildAmazonOrderDetailsCsvFromPdf(sourcePdf)
          results.push({
            name: getDownloadName(`${config.label}_Order_Details`, 'csv', undefined, batchTimestamp),
            blob: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
          })
        }
      } else {
        for (const file of inputFiles) {
        const sourcePdf = await loadPDF(file)
        const croppedPdf = await cropLabels(
          sourcePdf,
          config,
          false,
          selectedVariantId,
          selectedOptions,
          amazonDescriptionMode,
          flipkartDescriptionMode,
          includeAmazonOrderSummary,
          includeMeeshoOrderSummary,
          includeFlipkartOrderSummary,
          includePageNumbers,
          includeDateTimeOnLabel,
          summaryThreshold,
          summaryOrientation,
          showMultiQtyOnBottom,
          includeMultiQtySummary,
          orderMeeshoByDeliveryPartner,
          includeMeeshoCourierSummary,
          orderMeeshoBySku,
          treatValmoPlusAsValmo
        )
          const bytes = await croppedPdf.save({ useObjectStreams: false })
          results.push({
            name: getDownloadName(config.label, 'pdf', file.name, batchTimestamp),
            blob: new Blob([bytes as BlobPart], { type: 'application/pdf' })
          })
          if (selectedPlatform === 'AMAZON' && includeAmazonOrderDetailsExcel) {
            const csv = await buildAmazonOrderDetailsCsvFromPdf(sourcePdf)
            results.push({
              name: getDownloadName(`${config.label}_Order_Details`, 'csv', file.name, batchTimestamp),
              blob: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
            })
          }
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
      {/* <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">E-commerce Label Cropper</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Crop and optimize shipping labels for Flipkart, Meesho, and Amazon.</p>
      </section> */}
      

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
                onSettingsClick={scrollToOptions}
              />
            )
          })}
        </div>
      </section>



      {/* Mode Selection */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Mode</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['CROP', 'MERGE_AND_CROP'] as LabelMode[]).map(mode => {
            const config = MODE_UI_CONFIG[mode]
            const Icon = config.icon
            return (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition',
                  labelMode === mode
                    ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-600'
                    : 'border-slate-300 dark:border-slate-700 hover:border-sky-300 bg-slate-50/60 dark:bg-slate-800/60'
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  config.iconClassName
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    'block text-sm font-semibold',
                    labelMode === mode ? 'text-sky-700 dark:text-sky-300' : 'text-slate-900 dark:text-slate-100'
                  )}>
                    {config.label}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {config.hoverText}
                  </span>
                </div>
                <div className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                  labelMode === mode ? 'border-sky-600 bg-sky-600' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                )}>
                  {labelMode === mode && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <input
                  type="radio"
                  name="labelMode"
                  value={mode}
                  checked={labelMode === mode}
                  onChange={() => handleLabelModeChange(mode)}
                  className="hidden"
                />
              </label>
            )
          })}
        </div>
      </section>

    

      {/* File Uploader Section */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Upload Labels</h3>
              {selectedPlatform && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                  Auto-selected Platform: {LABEL_CONFIGS[selectedPlatform].label}
                </span>
              )}
            </div>
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
          onFilesSelect={handleFilesSelect}
          multiple={allowMultipleFiles}
          title="Upload Label PDF"
          activeTitle={allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here'}
          description="Drag and drop PDF file(s), or click to browse."
          hint={selectedPlatform ? `Supports ${selectedPlatform.charAt(0) + selectedPlatform.slice(1).toLowerCase()} labels` : 'Upload a label to auto-detect platform'}
        />

        {(isDetectingPlatform || platformDetectionStatus) && (
          <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            {isDetectingPlatform ? 'Detecting platform from PDF...' : platformDetectionStatus}
          </p>
        )}

        <div ref={processButtonRef} className="mt-6 flex justify-center">
          <button
            onClick={() => handleProcess(labelMode === 'MERGE_AND_CROP')}
            disabled={isProcessing || files.length === 0 || !selectedPlatform}
            className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-sky-600 px-8 text-base font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-sky-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none disabled:hover:scale-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4" />
                Process & Crop Lable / Files 
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

      {/* Platform-Specific Options */}
       <div ref={optionsRef} className="grid grid-cols-1 gap-5">
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
            <div className="mt-4 flex flex-wrap gap-4">
              <SummaryOption 
                checked={includeAmazonOrderSummary} 
                onChange={setIncludeAmazonOrderSummary} 
                threshold={summaryThreshold}
                onThresholdChange={setSummaryThreshold}
              />
              <ToggleOption label="Add Page Numbers" checked={includePageNumbers} onChange={setIncludePageNumbers} />
              <ToggleOption label="Add Process Time" checked={includeDateTimeOnLabel} onChange={setIncludeDateTimeOnLabel} />
              <ToggleOption label="Sort by Quantity (1, 2, 3+)" checked={includeMultiQtySummary} onChange={setIncludeMultiQtySummary} />
              <ToggleOption label="Order Details Excel" checked={includeAmazonOrderDetailsExcel} onChange={setIncludeAmazonOrderDetailsExcel} />
            </div>
          </section>
        )}

        {selectedPlatform === 'MEESHO' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Meesho Options</p>
            
            {/* Invoice Selection merged here */}
            {LABEL_CONFIGS.MEESHO.variants && (
              <div className="mb-4 flex flex-wrap gap-4">
                {LABEL_CONFIGS.MEESHO.variants.map((variant) => (
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
            )}

            <div className="flex flex-wrap gap-4">
              <SummaryOption 
                checked={includeMeeshoOrderSummary} 
                onChange={setIncludeMeeshoOrderSummary} 
                threshold={summaryThreshold}
                onThresholdChange={setSummaryThreshold}
              />
              <ToggleOption label="Add Delivery Partner Summary" checked={includeMeeshoCourierSummary} onChange={setIncludeMeeshoCourierSummary} />
              
              <ToggleOption label="Add Page Numbers" checked={includePageNumbers} onChange={setIncludePageNumbers} />
              <ToggleOption label="Add Process Time" checked={includeDateTimeOnLabel} onChange={setIncludeDateTimeOnLabel} />
              <ToggleOption label="Sort by Quantity (1, 2, 3+)" checked={includeMultiQtySummary} onChange={setIncludeMultiQtySummary} />
              <ToggleOption label="Order by SKU" checked={orderMeeshoBySku} onChange={setOrderMeeshoBySku} />
              <ToggleOption label="Order by Delivery Partner" checked={orderMeeshoByDeliveryPartner} onChange={setOrderMeeshoByDeliveryPartner} />
              <ToggleOption label="Treat ValmoPlus as Valmo" checked={treatValmoPlusAsValmo} onChange={setTreatValmoPlusAsValmo} />
            </div>
          </section>
        )}

        {selectedPlatform === 'FLIPKART' && (
             <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flipkart Options</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: 'WITH_SKU', label: 'With SKU' },
                    { id: 'WITH_DESCRIPTION', label: 'With Description' }
                  ].map(option => (
                    <label
                      key={option.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
                        flipkartDescriptionMode === option.id
                          ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                          : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-sky-300'
                      )}
                    >
                      <div className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        flipkartDescriptionMode === option.id ? 'border-sky-600 bg-sky-600' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      )}>
                        {flipkartDescriptionMode === option.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <input
                        type="radio"
                        name="flipkartDescriptionMode"
                        value={option.id}
                        checked={flipkartDescriptionMode === option.id}
                        onChange={() => setFlipkartDescriptionMode(option.id as FlipkartDescriptionMode)}
                        className="hidden"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  <SummaryOption 
                    checked={includeFlipkartOrderSummary} 
                    onChange={setIncludeFlipkartOrderSummary} 
                    threshold={summaryThreshold}
                    onThresholdChange={setSummaryThreshold}
                  />
                  <ToggleOption label="Add Page Numbers" checked={includePageNumbers} onChange={setIncludePageNumbers} />
                  <ToggleOption label="Sort by Quantity (1, 2, 3+)" checked={includeMultiQtySummary} onChange={setIncludeMultiQtySummary} />
                </div>
            </section>
        )}

      </div> 

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
