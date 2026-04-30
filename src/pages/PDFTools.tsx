import { useEffect, useRef, useState } from 'react'
import { FileUploader } from '../components/FileUploader'
import {
  compressPDF,
  convertImagesToPDF,
  convertPDFToImages,
  cropPDFByBox,
  mergePDFs,
  splitPDF,
  addPageNumbersToPDF,
  type PageNumberPosition,
  type CropBoxNormalized,
  type CompressionLevel
} from '../utils/pdfProcessor'
import * as pdfjsLib from 'pdfjs-dist'
import {
  ChevronRight,
  Download,
  FileDigit,
  FileDown,
  FileImage,
  FileText,
  FileType2,
  FormInput,
  GitMerge,
  Hand,
  Images,
  Info,
  Loader2,
  Minimize2,
  PencilLine,
  Scissors,
  Search,
  Shield,
  SquarePen,
  Trash2,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../utils/cn'

type PdfTool =
  | 'PDF_MERGE'
  | 'PDF_SPLIT'
  | 'PDF_TO_IMAGE'
  | 'PDF_COMPRESS'
  | 'IMAGE_TO_PDF'
  | 'PDF_CROP'
  | 'PDF_CONVERT'
  | 'PDF_PROTECT_REDACT'
  | 'PDF_OCR'
  | 'PDF_EDIT'
  | 'PDF_ESIGN'
  | 'PDF_FORMS'
  | 'PDF_ANNOTATE'
  | 'PDF_NUMBER'

const PDF_TOOLS: PdfTool[] = [
  'PDF_MERGE',
  'PDF_SPLIT',
  'PDF_TO_IMAGE',
  'PDF_COMPRESS',
  'IMAGE_TO_PDF',
  'PDF_CROP',
  'PDF_CONVERT',
  'PDF_PROTECT_REDACT',
  'PDF_OCR',
  'PDF_EDIT',
  'PDF_ESIGN',
  'PDF_FORMS',
  'PDF_ANNOTATE',
  'PDF_NUMBER'
];

type DownloadItem = {
  name: string
  blob: Blob
}


type CropPageMode = 'ALL_PAGES' | 'CURRENT_PAGE'
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'

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
    implemented: boolean
  }
> = {
  PDF_MERGE: {
    label: 'Merge PDF',
    hoverText: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    uploadTitle: 'Upload Multiple PDFs',
    icon: GitMerge,
    iconClassName: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
    implemented: true
  },
  PDF_SPLIT: {
    label: 'Split PDF',
    hoverText: 'Separate one PDF into multiple single-page files quickly.',
    uploadTitle: 'Upload PDF',
    icon: Scissors,
    iconClassName: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
    implemented: true
  },
  PDF_TO_IMAGE: {
    label: 'PDF to Image',
    hoverText: 'Convert every PDF page into high-quality image files.',
    uploadTitle: 'Upload PDF',
    icon: FileDown,
    iconClassName: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    implemented: true
  },
  PDF_COMPRESS: {
    label: 'Compress PDF',
    hoverText: 'Reduce PDF file size for easier sharing and faster uploads.',
    uploadTitle: 'Upload PDF',
    icon: Minimize2,
    iconClassName: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
    implemented: true
  },
  IMAGE_TO_PDF: {
    label: 'Images to PDF',
    hoverText: 'Convert one or more image files into a single PDF in selection order.',
    uploadTitle: 'Upload Images',
    icon: Images,
    iconClassName: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
    implemented: true
  },
  PDF_CROP: {
    label: 'PDF Crop',
    hoverText: 'Crop pages and remove extra margins from PDF documents.',
    uploadTitle: 'Upload PDF',
    icon: SquarePen,
    iconClassName: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    implemented: true
  },
  PDF_CONVERT: {
    label: 'PDF Format Conversion',
    hoverText: 'Convert PDF to Word, Excel, PowerPoint, and image formats.',
    uploadTitle: 'Upload PDF',
    icon: FileType2,
    iconClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    implemented: false
  },
  PDF_PROTECT_REDACT: {
    label: 'Protect & Redact',
    hoverText: 'Encrypt PDF files or permanently remove sensitive information.',
    uploadTitle: 'Upload PDF',
    icon: Shield,
    iconClassName: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    implemented: false
  },
  PDF_OCR: {
    label: 'OCR',
    hoverText: 'Convert scanned PDF pages into searchable and selectable text.',
    uploadTitle: 'Upload PDF',
    icon: Search,
    iconClassName: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
    implemented: false
  },
  PDF_EDIT: {
    label: 'Text & Image Editing',
    hoverText: 'Edit existing text or images directly inside PDF documents.',
    uploadTitle: 'Upload PDF',
    icon: PencilLine,
    iconClassName: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
    implemented: false
  },
  PDF_ESIGN: {
    label: 'E-Signatures',
    hoverText: 'Sign PDFs or send documents for electronic signatures.',
    uploadTitle: 'Upload PDF',
    icon: Hand,
    iconClassName: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    implemented: false
  },
  PDF_FORMS: {
    label: 'Form Filling',
    hoverText: 'Fill interactive forms and create fillable PDF forms.',
    uploadTitle: 'Upload PDF',
    icon: FormInput,
    iconClassName: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    implemented: false
  },
  PDF_ANNOTATE: {
    label: 'Annotations & Markup',
    hoverText: 'Highlight, comment, draw, and add stamps to PDF documents.',
    uploadTitle: 'Upload PDF',
    icon: FileDigit,
    iconClassName: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    implemented: false
  },
  PDF_NUMBER: {
    label: 'Number PDF Pages',
    hoverText: 'Add page numbers into your PDF documents quickly.',
    uploadTitle: 'Upload PDF',
    icon: FileDigit,
    iconClassName: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
    implemented: true
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

function ensureDownloadFileName(name: string, blob: Blob): string {
  const trimmed = (name || '').trim()
  const hasExtension = /\.[a-z0-9]{2,8}$/i.test(trimmed)
  if (hasExtension) return trimmed

  const mime = (blob.type || '').toLowerCase()
  if (mime.includes('pdf')) return `${trimmed || 'download'}.pdf`
  if (mime.includes('zip')) return `${trimmed || 'download'}.zip`
  if (mime.includes('png')) return `${trimmed || 'download'}.png`
  if (mime.includes('jpeg') || mime.includes('jpg')) return `${trimmed || 'download'}.jpg`
  return `${trimmed || 'download'}.pdf`
}

function createPdfBlob(bytes: Uint8Array): Blob {
  const header = new TextDecoder().decode(bytes.slice(0, 4))
  if (header !== '%PDF') {
    throw new Error('Generated file is not a valid PDF stream.')
  }
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export function PDFTools() {
  const [pdfTool, setPdfTool] = useState<PdfTool | null>(null)
  const [openTooltipTool, setOpenTooltipTool] = useState<PdfTool | null>(null)
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('RECOMMENDED')
  const [pageNumberPosition, setPageNumberPosition] = useState<PageNumberPosition>('bottom-center')
  const [cropPageMode, setCropPageMode] = useState<CropPageMode>('ALL_PAGES')
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [cropPreviewPage, setCropPreviewPage] = useState(1)
  const [cropPreviewImageUrl, setCropPreviewImageUrl] = useState<string | null>(null)
  const [cropSelection, setCropSelection] = useState<CropBoxNormalized>({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
  const [isDrawingCropBox, setIsDrawingCropBox] = useState(false)
  const [isDraggingCropBox, setIsDraggingCropBox] = useState(false)
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandle | null>(null)
  const cropCanvasRef = useRef<HTMLDivElement | null>(null)
  const cropAreaSectionRef = useRef<HTMLElement | null>(null)
  const uploadSectionRef = useRef<HTMLElement | null>(null)
  const cropDragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const cropDrawStartRef = useRef<{ x: number; y: number } | null>(null)
  const cropResizeStartRef = useRef<{
    x: number
    y: number
    startSelection: CropBoxNormalized
    handle: ResizeHandle
  } | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const activeToolConfig = pdfTool ? PDF_TOOL_CONFIG[pdfTool] : null
  const isImplementedTool = activeToolConfig?.implemented || false
  const allowMultipleFiles = pdfTool === 'PDF_MERGE' || pdfTool === 'IMAGE_TO_PDF'
  const isImagesToPdf = pdfTool === 'IMAGE_TO_PDF'
  const uploaderDescription = isImagesToPdf
    ? 'Drag and drop image file(s), or click to browse.'
    : 'Drag and drop PDF file(s), or click to browse.'
  const uploaderHint = isImagesToPdf
    ? 'Accepted: JPG, PNG, WEBP, BMP, GIF'
    : 'All processing happens locally for your security'
  const visiblePdfTools = PDF_TOOLS.filter(tool => PDF_TOOL_CONFIG[tool].implemented)

  const activeTitle = isImagesToPdf
    ? (allowMultipleFiles ? 'Drop your image files here' : 'Drop your image file here')
    : (allowMultipleFiles ? 'Drop your PDF files here' : 'Drop your PDF file here')
  const uploaderRejectionMessage = isImagesToPdf
    ? 'Please upload valid image files'
    : 'Please upload a valid PDF file'
  const uploaderAccept = isImagesToPdf ? IMAGE_INPUT_ACCEPT : PDF_INPUT_ACCEPT

  const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

  useEffect(() => {
    if (pdfTool !== 'PDF_CROP' || files.length === 0) {
      setCropPreviewImageUrl(null)
      setPdfPageCount(0)
      setCropPreviewPage(1)
      return
    }

    const file = files[0]
    let cancelled = false
    let localUrlToRevoke: string | null = null

    const renderPreview = async () => {
      const data = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data }).promise
      if (cancelled) return
      setPdfPageCount(pdf.numPages)
      const safePage = Math.min(Math.max(1, cropPreviewPage), pdf.numPages)
      if (safePage !== cropPreviewPage) setCropPreviewPage(safePage)
      const page = await pdf.getPage(safePage)
      const viewport = page.getViewport({ scale: 1.25 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvasContext: context, viewport, canvas }).promise
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob || cancelled) return
      const nextUrl = URL.createObjectURL(blob)
      localUrlToRevoke = nextUrl
      setCropPreviewImageUrl(prev => {
        if (prev) URL.revokeObjectURL(prev)
        return nextUrl
      })
    }

    renderPreview().catch(error => {
      console.error('Failed to render crop preview:', error)
    })

    return () => {
      cancelled = true
      if (localUrlToRevoke) URL.revokeObjectURL(localUrlToRevoke)
    }
  }, [pdfTool, files, cropPreviewPage])

  useEffect(() => {
    if (pdfTool !== 'PDF_CROP') return
    setCropPageMode('ALL_PAGES')
    setCropPreviewPage(1)
  }, [pdfTool, files])


  const handlePdfToolChange = (nextTool: PdfTool) => {
    setPdfTool(nextTool)
    setOpenTooltipTool(null)
    setCropSelection({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
    
    setFiles(prev => {
      if (prev.length === 0) return prev;
      
      const isNextImages = nextTool === 'IMAGE_TO_PDF';
      const currentIsImages = prev[0].type.startsWith('image/');
      
      if (isNextImages !== currentIsImages) {
        return [];
      }
      
      const nextAllowsMultiple = nextTool === 'PDF_MERGE' || nextTool === 'IMAGE_TO_PDF';
      if (!nextAllowsMultiple && prev.length > 1) {
        return [prev[0]];
      }
      
      return prev;
    })
    requestAnimationFrame(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (!isImplementedTool || selectedFiles.length === 0) return

    if (!allowMultipleFiles) {
      setFiles([selectedFiles[0]])
    } else {
      setFiles(prev => [...prev, ...selectedFiles])
    }

    if (pdfTool === 'PDF_CROP') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          cropAreaSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      })
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
  }

  const getRelativePoint = (clientX: number, clientY: number) => {
    const bounds = cropCanvasRef.current?.getBoundingClientRect()
    if (!bounds) return null
    const x = clampUnit((clientX - bounds.left) / bounds.width)
    const y = clampUnit((clientY - bounds.top) / bounds.height)
    return { x, y }
  }

  const handleCropMouseDown = (event: any) => {
    const point = getRelativePoint(event.clientX, event.clientY)
    if (!point) return

    const insideSelection =
      point.x >= cropSelection.x &&
      point.x <= cropSelection.x + cropSelection.width &&
      point.y >= cropSelection.y &&
      point.y <= cropSelection.y + cropSelection.height

    if (insideSelection) {
      setIsDraggingCropBox(true)
      cropDragStartRef.current = {
        x: point.x,
        y: point.y,
        startX: cropSelection.x,
        startY: cropSelection.y
      }
      return
    }

    setIsDrawingCropBox(true)
    cropDrawStartRef.current = point
    setCropSelection({ x: point.x, y: point.y, width: 0.001, height: 0.001 })
  }

  const handleCropMouseMove = (event: any) => {
    const point = getRelativePoint(event.clientX, event.clientY)
    if (!point) return

    if (activeResizeHandle && cropResizeStartRef.current) {
      const { startSelection, x: sx, y: sy, handle } = cropResizeStartRef.current
      const dx = point.x - sx
      const dy = point.y - sy
      const minSize = 0.02

      let nextX = startSelection.x
      let nextY = startSelection.y
      let nextW = startSelection.width
      let nextH = startSelection.height

      if (handle === 'se') {
        nextW = Math.max(minSize, Math.min(1 - startSelection.x, startSelection.width + dx))
        nextH = Math.max(minSize, Math.min(1 - startSelection.y, startSelection.height + dy))
      } else if (handle === 'sw') {
        const left = Math.max(0, Math.min(startSelection.x + startSelection.width - minSize, startSelection.x + dx))
        nextX = left
        nextW = Math.max(minSize, startSelection.x + startSelection.width - left)
        nextH = Math.max(minSize, Math.min(1 - startSelection.y, startSelection.height + dy))
      } else if (handle === 'ne') {
        const top = Math.max(0, Math.min(startSelection.y + startSelection.height - minSize, startSelection.y + dy))
        nextY = top
        nextH = Math.max(minSize, startSelection.y + startSelection.height - top)
        nextW = Math.max(minSize, Math.min(1 - startSelection.x, startSelection.width + dx))
      } else if (handle === 'nw') {
        const left = Math.max(0, Math.min(startSelection.x + startSelection.width - minSize, startSelection.x + dx))
        const top = Math.max(0, Math.min(startSelection.y + startSelection.height - minSize, startSelection.y + dy))
        nextX = left
        nextY = top
        nextW = Math.max(minSize, startSelection.x + startSelection.width - left)
        nextH = Math.max(minSize, startSelection.y + startSelection.height - top)
      } else if (handle === 'n') {
        const top = Math.max(0, Math.min(startSelection.y + startSelection.height - minSize, startSelection.y + dy))
        nextY = top
        nextH = Math.max(minSize, startSelection.y + startSelection.height - top)
      } else if (handle === 's') {
        nextH = Math.max(minSize, Math.min(1 - startSelection.y, startSelection.height + dy))
      } else if (handle === 'w') {
        const left = Math.max(0, Math.min(startSelection.x + startSelection.width - minSize, startSelection.x + dx))
        nextX = left
        nextW = Math.max(minSize, startSelection.x + startSelection.width - left)
      } else if (handle === 'e') {
        nextW = Math.max(minSize, Math.min(1 - startSelection.x, startSelection.width + dx))
      }

      setCropSelection({
        x: clampUnit(nextX),
        y: clampUnit(nextY),
        width: clampUnit(nextW),
        height: clampUnit(nextH)
      })
      return
    }

    if (isDraggingCropBox && cropDragStartRef.current) {
      const dx = point.x - cropDragStartRef.current.x
      const dy = point.y - cropDragStartRef.current.y
      const nextX = clampUnit(cropDragStartRef.current.startX + dx)
      const nextY = clampUnit(cropDragStartRef.current.startY + dy)
      setCropSelection(prev => ({
        ...prev,
        x: Math.min(nextX, 1 - prev.width),
        y: Math.min(nextY, 1 - prev.height)
      }))
      return
    }

    if (isDrawingCropBox && cropDrawStartRef.current) {
      const sx = cropDrawStartRef.current.x
      const sy = cropDrawStartRef.current.y
      const x = Math.min(sx, point.x)
      const y = Math.min(sy, point.y)
      const width = Math.max(0.01, Math.abs(point.x - sx))
      const height = Math.max(0.01, Math.abs(point.y - sy))
      setCropSelection({
        x,
        y,
        width: Math.min(width, 1 - x),
        height: Math.min(height, 1 - y)
      })
    }
  }

  const handleCropMouseUp = () => {
    setIsDrawingCropBox(false)
    setIsDraggingCropBox(false)
    setActiveResizeHandle(null)
    cropDragStartRef.current = null
    cropDrawStartRef.current = null
    cropResizeStartRef.current = null
  }

  const handleCropPreviewWheel = (event: any) => {
    if (pdfTool !== 'PDF_CROP' || pdfPageCount <= 1) return
    event.preventDefault()
    const direction = event.deltaY > 0 ? 1 : -1
    setCropPreviewPage(prev => Math.max(1, Math.min(pdfPageCount, prev + direction)))
  }

  const startResize = (event: any, handle: ResizeHandle) => {
    event.preventDefault()
    event.stopPropagation()
    const point = getRelativePoint(event.clientX, event.clientY)
    if (!point) return
    setActiveResizeHandle(handle)
    cropResizeStartRef.current = {
      x: point.x,
      y: point.y,
      startSelection: cropSelection,
      handle
    }
  }

  const downloadFile = (item: DownloadItem) => {
    const fileName = ensureDownloadFileName(item.name, item.blob)
    const safeFile = new File([item.blob], fileName, {
      type: item.blob.type || 'application/octet-stream'
    })
    const url = URL.createObjectURL(safeFile)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    link.download = fileName
    link.rel = 'noopener'
    link.target = '_self'
    document.body.appendChild(link)
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 60000)
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


  const handleCropSingle = async () => handleProcess()
  const handleMergeAndCrop = async () => handleProcess()
  const handleProcess = async () => {
    if (!isImplementedTool || files.length === 0) return
    setIsProcessing(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const results: DownloadItem[] = []

      if (pdfTool === 'PDF_MERGE') {
        const mergedPdf = await mergePDFs(files)
        const bytes = await mergedPdf.save({ useObjectStreams: false })
        results.push({
          name: getDownloadName('MergePdf', 'pdf'),
          blob: createPdfBlob(bytes)
        })
      } else if (pdfTool === 'PDF_SPLIT') {
        const splitResults = await splitPDF(files[0])
        splitResults.forEach(item => {
          results.push({
            name: item.name,
            blob: createPdfBlob(item.bytes)
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
          blob: createPdfBlob(bytes)
        })
      } else if (pdfTool === 'IMAGE_TO_PDF') {
        const bytes = await convertImagesToPDF(files)
        results.push({
          name: getDownloadName('ImgToPdf', 'pdf'),
          blob: createPdfBlob(bytes)
        })
      } else if (pdfTool === 'PDF_CROP') {
        const bytes = await cropPDFByBox(
          files[0],
          cropSelection,
          cropPageMode === 'ALL_PAGES',
          cropPreviewPage
        )
        results.push({
          name: getDownloadName('CropPdf', 'pdf'),
          blob: createPdfBlob(bytes)
        })
      } else if (pdfTool === 'PDF_NUMBER') {
        const bytes = await addPageNumbersToPDF(files[0], pageNumberPosition)
        results.push({
          name: getDownloadName('NumberedPdf', 'pdf'),
          blob: createPdfBlob(bytes)
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

      {/* Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-center">
          <div className="sm:w-full">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">PDF Essential Tools</h2>
          </div>
          
        </div>
        {/* <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Quick actions to merge, split, compress, and convert between PDFs and images.</p> */}
      </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm  ">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Select Tool</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visiblePdfTools.map(tool => {
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
                  <span
                    className="relative inline-flex shrink-0 cursor-pointer items-center text-slate-400 dark:text-slate-500"
                    onClick={event => {
                      event.preventDefault()
                      event.stopPropagation()
                      setOpenTooltipTool(prev => (prev === tool ? null : tool))
                    }}
                  >
                    <Info className="h-4 w-4" />
                    <span
                      className={cn(
                        'pointer-events-none absolute right-0 top-6 z-20 w-60 rounded-lg border px-3 py-2 text-left text-xs font-medium shadow-xl transition',
                        pdfTool === tool
                          ? 'border-sky-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300',
                        openTooltipTool === tool ? 'opacity-100' : 'opacity-0'
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
      {pdfTool && activeToolConfig && (
      <section
        ref={uploadSectionRef}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between gap-3">


          <div className="sm:w-full sm:text-right flex gap-2 items-center justify-center">
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">Selected Tools: </p>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xl font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', activeToolConfig.iconClassName)}>
                <activeToolConfig.icon className="h-3.5 w-3.5" />
              </span>
              {activeToolConfig.label}
            </span>
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
          title={activeToolConfig.uploadTitle}
          activeTitle={activeTitle}
          description={uploaderDescription}
          hint={uploaderHint}
          accept={uploaderAccept}
          rejectionMessage={uploaderRejectionMessage}
        />

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

      {pdfTool === 'PDF_NUMBER' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Position</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { id: 'top-left', label: 'Top Left' },
              { id: 'top-center', label: 'Top Center' },
              { id: 'top-right', label: 'Top Right' },
              { id: 'bottom-left', label: 'Bottom Left' },
              { id: 'bottom-center', label: 'Bottom Center' },
              { id: 'bottom-right', label: 'Bottom Right' }
            ].map(pos => (
              <button
                key={pos.id}
                onClick={() => setPageNumberPosition(pos.id as PageNumberPosition)}
                className={cn(
                  'cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold transition',
                  pageNumberPosition === pos.id
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-sky-300'
                )}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {pdfTool === 'PDF_CROP' && (
            <section ref={cropAreaSectionRef} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm mt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Visual crop area</p>
            {files.length > 1 ? (
              <div className="flex gap-2">
                <button
                  onClick={handleCropSingle}
                  disabled={isProcessing || files.length === 0}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Single Crop
                </button>
                <button
                  onClick={handleMergeAndCrop}
                  disabled={isProcessing || files.length === 0}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                  Merge & Crop
                </button>
              </div>
            ) : (
              <button
                onClick={handleProcess}
                disabled={isProcessing || files.length === 0}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Run Process
                  </>
                )}
              </button>
            )}
          </div>
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            {cropPreviewImageUrl ? (
              <>
                <div
                  ref={cropCanvasRef}
                  className="relative mx-auto w-full max-w-xl cursor-crosshair overflow-hidden rounded-lg border border-slate-300 bg-slate-200 dark:border-slate-700"
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={handleCropMouseMove}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                  onWheel={handleCropPreviewWheel}
                >
                  <img src={cropPreviewImageUrl} alt="PDF crop preview" className="block h-auto w-full select-none" draggable={false} />
                  <div
                    className="absolute border-2 border-sky-500 bg-sky-400/15"
                    style={{
                      left: `${cropSelection.x * 100}%`,
                      top: `${cropSelection.y * 100}%`,
                      width: `${cropSelection.width * 100}%`,
                      height: `${cropSelection.height * 100}%`
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                      <div className="flex flex-col items-center gap-1 -rotate-12">
                        <span className="select-none text-4xl font-black uppercase tracking-[0.2em] text-white/10 dark:text-white/5">
                          Crop PDF Area
                        </span>
                        <span className="select-none text-sm font-bold text-white/20 dark:text-white/10">
                          {Math.round(cropSelection.width * 100)}% x {Math.round(cropSelection.height * 100)}%
                        </span>
                      </div>
                    </div>
                    <button
                      className="absolute -left-2 -top-2 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'nw')}
                    />
                    <button
                      className="absolute -right-2 -top-2 h-4 w-4 cursor-nesw-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'ne')}
                    />
                    <button
                      className="absolute -left-2 -bottom-2 h-4 w-4 cursor-nesw-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'sw')}
                    />
                    <button
                      className="absolute -right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'se')}
                    />
                    <button
                      className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'n')}
                    />
                    <button
                      className="absolute bottom-0 left-1/2 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 's')}
                    />
                    <button
                      className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'w')}
                    />
                    <button
                      className="absolute right-0 top-1/2 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-sky-600 shadow"
                      onMouseDown={event => startResize(event, 'e')}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <div className="inline-flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <button
                      onClick={() => setCropPreviewPage(prev => Math.max(1, prev - 1))}
                      disabled={cropPreviewPage <= 1}
                      className="rounded px-2 py-0.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      ‹
                    </button>
                    <span>Page {cropPreviewPage} / {Math.max(pdfPageCount, 1)}</span>
                    <button
                      onClick={() => setCropPreviewPage(prev => Math.min(Math.max(pdfPageCount, 1), prev + 1))}
                      disabled={cropPreviewPage >= Math.max(pdfPageCount, 1)}
                      className="rounded px-2 py-0.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      ›
                    </button>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={isProcessing || files.length === 0}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Run Process
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Upload a PDF to enable visual crop selection.</p>
            )}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pages</p>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCropPageMode('ALL_PAGES')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                cropPageMode === 'ALL_PAGES'
                  ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              )}
            >
              All pages
            </button>
            <button
              onClick={() => setCropPageMode('CURRENT_PAGE')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                cropPageMode === 'CURRENT_PAGE'
                  ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              )}
            >
              Current page
            </button>
          </div>

        </section>
      )}

     

        <div className="mt-5 flex justify-center">
          <button
            onClick={handleProcess}
            disabled={isProcessing || files.length === 0}
            className="inline-flex h-16 w-72 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-xl font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="h-6 w-6" />
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
      )}

    </div>
  )
}
