import { useState } from 'react'
import { FileUploader } from './components/FileUploader'
import { loadPDF, cropLabels, LABEL_CONFIGS } from './utils/pdfProcessor'
import { FileText, Loader2, Download, Scissors } from 'lucide-react'
import { cn } from './utils/cn'

function App() {
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const [activeView, setActiveView] = useState<'LABELS' | 'PDF_TOOLS'>('LABELS')
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [mode, setMode] = useState<'CROP' | 'MERGE'>('CROP')
  const [tool, setTool] = useState<'LABEL_CROP' | 'PDF_MERGE' | 'PDF_SPLIT' | 'PDF_TO_IMAGE'>('LABEL_CROP')
  const [extractSku, setExtractSku] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const allowMultipleFiles = tool === 'PDF_MERGE' || (tool === 'LABEL_CROP' && mode === 'MERGE')

  const handleFileSelect = async (selectedFile: File) => {
    if (!allowMultipleFiles) {
      setFiles([selectedFile])
    } else {
      setFiles(prev => [...prev, selectedFile])
    }
  }

  const handlePlatformSelect = (platform: string) => {
    setSelectedPlatform(platform)
    // Default to first variant if available
    const config: any = LABEL_CONFIGS[platform];
    if (config?.variants && config.variants.length > 0) {
      setSelectedVariantId(config.variants[0].id);
    } else {
      setSelectedVariantId(null);
    }
    setSelectedOptions(platform === 'AMAZON' ? ['order_page'] : []);
    setFiles([])

  }

  const resetSelection = () => {
    setSelectedPlatform(null)
    setTool('LABEL_CROP')
    setMode('CROP')
    setFiles([])
    setSelectedOptions([])
  }

  const handleProcess = async () => {
    if (files.length === 0) return
    setIsProcessing(true)
    try {
      // Small delay to show loading state for better UX
      await new Promise(resolve => setTimeout(resolve, 500))

      const getDownloadName = (tag: string, forcedExt: string = 'pdf') => {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const timestamp = `${dd}${mm}${yy}${hh}${min}${ss}`;
        const ext = forcedExt.startsWith('.') ? forcedExt : `.${forcedExt}`;
        return `E-com_${tag}_${timestamp}${ext.toLowerCase()}`;
      };

      let finalPdfs: { name: string, blob: Blob }[] = [];

      // Step 1: Process based on tool
      if (tool === 'PDF_MERGE' || (tool === 'LABEL_CROP' && mode === 'MERGE')) {
        const { mergePDFs } = await import('./utils/pdfProcessor')
        const mergedPdf = await mergePDFs(files)

        // Apply Crop if needed
        let processedPdf = mergedPdf;
        if (tool === 'LABEL_CROP' && selectedPlatform) {
          processedPdf = await cropLabels(processedPdf, LABEL_CONFIGS[selectedPlatform], extractSku, selectedVariantId, selectedOptions)
        }

        const bytes = await processedPdf.save({ useObjectStreams: false });
        const tag = tool === 'PDF_MERGE' ? 'MergePdf' : `M_${LABEL_CONFIGS[selectedPlatform!].label}`;
        finalPdfs.push({
          name: getDownloadName(tag, 'pdf'),
          blob: new Blob([bytes as any], { type: 'application/pdf' })
        });

      } else if (tool === 'PDF_SPLIT') {
        const { splitPDF } = await import('./utils/pdfProcessor')
        const splitResults = await splitPDF(files[0])
        finalPdfs = splitResults.map(r => ({
          name: r.name,
          blob: new Blob([r.bytes as any], { type: 'application/pdf' })
        }));

      } else if (tool === 'PDF_TO_IMAGE') {
        const { convertPDFToImages } = await import('./utils/pdfProcessor')
        const imageResults = await convertPDFToImages(files[0])
        finalPdfs = imageResults.map(item => ({
          name: item.name,
          blob: item.blob
        }));

      } else {
        // Single file load/crop logic for LABEL_CROP
        let processedPdf = await loadPDF(files[0])
        if (tool === 'LABEL_CROP' && selectedPlatform) {
          processedPdf = await cropLabels(processedPdf, LABEL_CONFIGS[selectedPlatform], extractSku, selectedVariantId, selectedOptions)
        }
        const bytes = await processedPdf.save({ useObjectStreams: false });
        finalPdfs.push({
          name: getDownloadName(LABEL_CONFIGS[selectedPlatform!].label, 'pdf'),
          blob: new Blob([bytes as any], { type: 'application/pdf' })
        });
      }

      // Step 2: Download Results (Single File or ZIP Bundle)
      if (finalPdfs.length > 0) {
        if (tool === 'PDF_SPLIT' || tool === 'PDF_TO_IMAGE') {
          // Bundle into ZIP
          const JSZipModule = await import('jszip')
          const JSZip = JSZipModule.default || JSZipModule
          const zip = new JSZip()

          finalPdfs.forEach(item => {
            zip.file(item.name, item.blob)
          })

          const zipContent = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          })

          const zipTag = tool === 'PDF_SPLIT' ? 'SplitPdf' : 'PdftoImg';
          const zipName = getDownloadName(zipTag, 'zip');

          const url = URL.createObjectURL(zipContent);
          const link = document.createElement('a');
          link.href = url;
          link.download = zipName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 15000); // 15 seconds for safety
        } else {
          // Individual Download (e.g. Merge or Label Crop)
          for (let i = 0; i < finalPdfs.length; i++) {
            const item = finalPdfs[i];
            const url = URL.createObjectURL(item.blob);
            const link = document.createElement('a');
            link.href = url;

            link.download = item.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 15000); // 15 seconds for safety

            if (finalPdfs.length > 1 && i < finalPdfs.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }

      // Clean up and Reset
      // setProcessedPdfUrl(url) - Removed unused state set

      // Short delay before reset to allow download to start
      setTimeout(() => {
        setFiles([]);
        // setProcessedPdfUrl(null); - Removed unused state set
      }, 1000);

    } catch (error) {
      console.error("Error processing PDF:", error)
      alert("Failed to process PDF. Please check the file.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => { setActiveView('LABELS'); resetSelection(); }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
            <span className="text-xl font-bold text-slate-900 tracking-tight">E-commerce Tool</span>
          </button>
          <nav className="flex gap-4 sm:gap-8 text-sm font-semibold">
            <button
              onClick={() => { setActiveView('LABELS'); resetSelection(); }}
              className={cn(
                "transition-colors pb-5 mt-5 border-b-2",
                activeView === 'LABELS' ? "text-indigo-600 border-indigo-600" : "text-slate-500 border-transparent hover:text-slate-700"
              )}
            >
              Label Cropper
            </button>
            <button
              onClick={() => { setActiveView('PDF_TOOLS'); resetSelection(); }}
              className={cn(
                "transition-colors pb-5 mt-5 border-b-2",
                activeView === 'PDF_TOOLS' ? "text-indigo-600 border-indigo-600" : "text-slate-500 border-transparent hover:text-slate-700"
              )}
            >
              PDF Tools
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-sm font-medium mb-4">
            ✨ Free E-commerce Tool
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-6">
            {activeView === 'LABELS' ? <>Crop Shipping Labels <span className="text-indigo-600">Instantly</span></> : <>Modern PDF <span className="text-indigo-600">Utilities</span></>}
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            {activeView === 'LABELS'
              ? "Automatically crop and format FlipKart, Meesho, and Amazon shipping labels for best print result in fit size on thermal printers."
              : "Professional-grade PDF tools for your daily e-commerce operations. Merge, split, and optimize with ease."
            }
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl ring-1 ring-slate-900/5 overflow-hidden">
          <div className="p-8 sm:p-10">
            {/* Active Process/Upload View */}
            {selectedPlatform && (
              <div className="mb-12 border-b border-slate-100 pb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="max-w-3xl mx-auto">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      {(tool === 'PDF_MERGE' || tool === 'PDF_SPLIT' || tool === 'PDF_TO_IMAGE') ? <FileText className="w-5 h-5 text-indigo-600" /> : (mode === 'CROP' ? <Scissors className="w-5 h-5 text-indigo-600" /> : <FileText className="w-5 h-5 text-indigo-600" />)}
                      {tool === 'PDF_MERGE' ? 'Merging PDFs' : tool === 'PDF_SPLIT' ? 'Splitting PDF' : tool === 'PDF_TO_IMAGE' ? 'Converting PDF to Images' : (mode === 'CROP' ? 'Cropping' : 'Merging & Cropping')}
                      {tool === 'LABEL_CROP' && selectedPlatform && <> for <span className="text-indigo-600">{LABEL_CONFIGS[selectedPlatform].label}</span></>}
                    </h3>
                    <button
                      onClick={resetSelection}
                      className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      Close
                    </button>
                  </div>

                  {files.length === 0 ? (
                    <FileUploader
                      onFileSelect={handleFileSelect}
                      multiple={allowMultipleFiles}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100">
                        {files.map((f, index) => (
                          <div key={index} className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-4">
                              <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-100">
                                <FileText className="w-6 h-6 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-slate-900 text-sm">{f.name}</h3>
                                <p className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const newFiles = files.filter((_, i) => i !== index);
                                setFiles(newFiles);

                              }}
                              className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col items-center gap-4 pt-4">
                        {/* Info about selected platform */}
                        {tool === 'LABEL_CROP' && selectedPlatform && (
                          <div className="w-full max-w-xs space-y-4">
                            {/* Variants Selection */}
                            {(LABEL_CONFIGS[selectedPlatform] as any).variants && (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <label className="block text-xs font-semibold text-slate-700 mb-2 text-center">
                                  Select Layout
                                </label>
                                <div className="flex flex-col sm:flex-row justify-center gap-2">
                                  {(LABEL_CONFIGS[selectedPlatform] as any).variants?.map((variant: any) => (
                                    <label
                                      key={variant.id}
                                      className={cn(
                                        "flex items-center px-2 py-1.5 rounded-md border transition-all cursor-pointer flex-1",
                                        selectedVariantId === variant.id
                                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                                      )}
                                    >
                                      <input
                                        type="radio"
                                        name="variant"
                                        value={variant.id}
                                        checked={selectedVariantId === variant.id}
                                        onChange={() => setSelectedVariantId(variant.id)}
                                        className="sr-only"
                                      />
                                      <div className="flex items-center justify-center w-full gap-1.5">
                                        <div className={cn(
                                          "w-3 h-3 rounded-full border flex items-center justify-center",
                                          selectedVariantId === variant.id ? "border-white" : "border-slate-300"
                                        )}>
                                          {selectedVariantId === variant.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        <span className="text-xs font-medium">{variant.label}</span>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Options Selection */}
                            {(LABEL_CONFIGS[selectedPlatform] as any).options && (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <label className="block text-sm font-semibold text-slate-700 mb-3 text-center">
                                  Options
                                </label>
                                <div className="space-y-2">
                                  {(LABEL_CONFIGS[selectedPlatform] as any).options?.map((option: any) => (
                                    <div key={option.id} className="flex items-center justify-center">
                                      <div className="flex items-center">
                                        <input
                                          id={`opt-${option.id}`}
                                          type="checkbox"
                                          checked={selectedOptions.includes(option.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedOptions([...selectedOptions, option.id]);
                                            } else {
                                              setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                                            }
                                          }}
                                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                                        />
                                        <label htmlFor={`opt-${option.id}`} className="ml-2 block text-sm text-slate-700 cursor-pointer select-none">
                                          {option.label}
                                        </label>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-center">
                              <input
                                id="sku"
                                type="checkbox"
                                checked={extractSku}
                                onChange={(e) => setExtractSku(e.target.checked)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                              />
                              <label htmlFor="sku" className="ml-2 block text-sm text-slate-700">
                                Auto-embed SKU
                                <span className="text-xs text-slate-400 ml-1">(BETA)</span>
                              </label>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={handleProcess}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                {tool === 'PDF_MERGE' ? 'Merge & Download' : tool === 'PDF_SPLIT' ? 'Split & Download' : tool === 'PDF_TO_IMAGE' ? 'Convert & Download' : 'Prepare Shipping Labels'}
                              </>
                            )}
                          </button>

                          {/* Small Download Icon Button (Only visible if processed, but we are auto-downloading so maybe keep it disabled until processed? Or just as a secondary manual trigger if auto fails? User said 'be side of'). Let's add it but it might process again if clicked? No, it should probably just re-download the last result if available, or do nothing.
                            
                            Actually, if the flow resets, there is no "last result" to download manually. 
                            If the user wants a button BESIDE "Prepare Shipping Labels", maybe it implies the "Process" action creates the label, and THEN the small button becomes active? 
                            
                            But user said "whenever click... auto download... and ready for next file". This implies complete reset.
                            
                            So the small download button might be for the CURRENT file if they want to download WITHOUT preparing? Or maybe re-download? 
                            
                            Let's implement the auto-download logic inside handleProcess, and for now, add a static or disabled small button if no URL, or just make it trigger the same process?
                            
                            "add small dowunload icon bnutton be side of 'Prepare Shipping Labels'"
                            
                            I'll add it as a secondary button.
                            */}
                          <button
                            disabled={isProcessing}
                            className="p-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50"
                            title="Download"
                            onClick={handleProcess} // Same action for now as it's the only way to get the file
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Selection */}
            {activeView === 'LABELS' ? (
              <div className="space-y-10">
                {/* Crop Section */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <Scissors className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Crop Label</h3>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                    {Object.entries(LABEL_CONFIGS).map(([key, config]) => (
                      <button
                        key={`crop-${key}`}
                        onClick={() => { setTool('LABEL_CROP'); setMode('CROP'); handlePlatformSelect(key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 border rounded-xl transition-all group shadow-sm",
                          tool === 'LABEL_CROP' && selectedPlatform === key && mode === 'CROP'
                            ? "bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600"
                            : "bg-white border-slate-200 hover:border-indigo-600 hover:ring-1 hover:ring-indigo-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="w-15 h-15 bg-white rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden shadow-sm border border-slate-100">
                          <img
                            src={config.logo}
                            alt={config.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${config.label}&background=random`;
                            }}
                          />
                        </div>
                        <span className="font-semibold text-slate-900">{config.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-sm font-medium text-slate-500">OR</span>
                  </div>
                </div>

                {/* Merge Section */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Merge & Crop</h3>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                    {Object.entries(LABEL_CONFIGS).map(([key, config]) => (
                      <button
                        key={`merge-${key}`}
                        onClick={() => { setTool('LABEL_CROP'); setMode('MERGE'); handlePlatformSelect(key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 border rounded-xl transition-all group shadow-sm",
                          tool === 'LABEL_CROP' && selectedPlatform === key && mode === 'MERGE'
                            ? "bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600"
                            : "bg-white border-slate-200 hover:border-indigo-600 hover:ring-1 hover:ring-indigo-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="w-15 h-15 bg-white rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden shadow-sm border border-slate-100">
                          <img
                            src={config.logo}
                            alt={config.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${config.label}&background=random`;
                            }}
                          />
                        </div>
                        <span className="font-semibold text-slate-900">{config.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {/* PDF Tools Section */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">PDF Tools</h3>
                  </div>

                  <div className="max-w-5xl mx-auto space-y-6">
                    {/* First Row: Merge Tool */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => { setTool('PDF_MERGE'); setMode('CROP'); setSelectedPlatform('MERGE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-8 border rounded-2xl transition-all group shadow-sm w-full max-w-md",
                          tool === 'PDF_MERGE'
                            ? "bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600"
                            : "bg-white border-slate-200 hover:border-indigo-600 hover:ring-1 hover:ring-indigo-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden shadow-sm border border-slate-100 p-3">
                          <div className="bg-indigo-600 p-2 rounded-lg">
                            <FileText className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <span className="font-bold text-lg text-slate-900">Merge PDF</span>
                        <p className="text-sm text-slate-500 mt-1">Combine multiple PDFs into one</p>
                      </button>
                    </div>

                    {/* Second Row: Split and Image Tools */}
                    <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
                      {/* Split Card */}
                      <button
                        onClick={() => { setTool('PDF_SPLIT'); setMode('CROP'); setSelectedPlatform('SPLIT'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-8 border rounded-2xl transition-all group shadow-sm",
                          tool === 'PDF_SPLIT'
                            ? "bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600"
                            : "bg-white border-slate-200 hover:border-indigo-600 hover:ring-1 hover:ring-indigo-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden shadow-sm border border-slate-100 p-3">
                          <div className="bg-indigo-600 p-2 rounded-lg">
                            <Scissors className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <span className="font-bold text-lg text-slate-900">Split PDF</span>
                        <p className="text-sm text-slate-500 mt-1">Extract each page into separate PDFs</p>
                      </button>

                      {/* PDF to Image Card */}
                      <button
                        onClick={() => { setTool('PDF_TO_IMAGE'); setMode('CROP'); setSelectedPlatform('IMAGE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-8 border rounded-2xl transition-all group shadow-sm",
                          tool === 'PDF_TO_IMAGE'
                            ? "bg-indigo-50 border-indigo-600 ring-1 ring-indigo-600"
                            : "bg-white border-slate-200 hover:border-indigo-600 hover:ring-1 hover:ring-indigo-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform overflow-hidden shadow-sm border border-slate-100 p-3">
                          <div className="bg-indigo-600 p-2 rounded-lg">
                            <Download className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <span className="font-bold text-lg text-slate-900">PDF to Image</span>
                        <p className="text-sm text-slate-500 mt-1">Convert PDF pages into PNG images</p>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center">
                  <h4 className="font-bold text-slate-900 mb-2">More Tools Coming Soon</h4>
                  <p className="text-slate-500 text-sm">We are working on PDF to Word, PDF to Excel, and Compression tools.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <section className="bg-slate-50 border-t border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">How to Use E-commerce Tool</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 text-indigo-600 font-bold text-xl">1</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Upload your PDF</h3>
              <p className="text-slate-600">Drag and drop your shipping label PDF file. We support FlipKart, Meesho, and Amazon formats.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 text-indigo-600 font-bold text-xl">2</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Select Options</h3>
              <p className="text-slate-600">Choose your platform and optional features like SKU auto-embedding for easier packing.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 text-indigo-600 font-bold text-xl">3</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Download & Print</h3>
              <p className="text-slate-600">Get your instantly cropped 4x6 labels ready for your thermal printer.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} E-commerce Tools. Built by Riken Vaghani.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
