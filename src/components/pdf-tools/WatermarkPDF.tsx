import React, { useState, useEffect, useRef } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, Stamp, Type, Image as ImageIcon, Grid3X3, Bold, Italic } from 'lucide-react';
import { cn } from '../../utils/cn';

interface WatermarkPDFProps {
  files: File[];
  onDownload: (blob: Blob, name: string) => void;
}

type Position = 'TL' | 'TC' | 'TR' | 'ML' | 'MC' | 'MR' | 'BL' | 'BC' | 'BR';

export function WatermarkPDF({ files, onDownload }: WatermarkPDFProps) {
  const [activeTab, setActiveTab] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Text Watermark State
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(72);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [color, setColor] = useState('#000000');
  
  // Image Watermark State
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Removed imagePreviewUrl as it is not used in UI currently
  const [imageScale, setImageScale] = useState(50); // 10% to 100% of page width
  
  // Shared State
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(-45);
  const [position, setPosition] = useState<Position>('MC');
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const fileRef = useRef(files);

  useEffect(() => {
    fileRef.current = files;
    let isMounted = true;
    const loadPdf = async () => {
      if (files.length === 0) return;
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (isMounted) setPdfDoc(doc);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [files]);

  // Read Image
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      // imagePreviewUrl is unused, so we just clean up if needed
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  // Generate Preview
  useEffect(() => {
    let isMounted = true;
    let timeout: NodeJS.Timeout;

    const generatePreview = async () => {
      if (!files[0] || !pdfDoc) return;
      setIsPreviewLoading(true);
      
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = pdf.getPages();
        const page = pages[0]; // Preview only first page
        
        await applyWatermarkToPage(pdf, page);

        const bytes = await pdf.save();
        
        const previewDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (!isMounted) return;
        const previewPage = await previewDoc.getPage(1);
        const viewport = previewPage.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        
        await previewPage.render({ canvasContext: context, viewport, canvas }).promise;
        
        canvas.toBlob((blob) => {
          if (!blob || !isMounted) return;
          const url = URL.createObjectURL(blob);
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          setIsPreviewLoading(false);
        }, 'image/png');
        
      } catch (e) {
        console.error('Preview generation failed', e);
        if (isMounted) setIsPreviewLoading(false);
      }
    };

    timeout = setTimeout(generatePreview, 500); // debounce
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, pdfDoc, text, fontSize, isBold, isItalic, color, opacity, rotation, position, activeTab, imageFile, imageScale]);

  const applyWatermarkToPage = async (pdf: PDFDocument, page: any) => {
    const { width, height } = page.getSize();
    const op = opacity / 100;
    
    // Calculate Position Coordinates
    // T/M/B (Top, Middle, Bottom), L/C/R (Left, Center, Right)
    const getPos = () => {
      let x = 0;
      let y = 0;
      
      if (position.endsWith('L')) x = width * 0.1;
      else if (position.endsWith('C')) x = width / 2;
      else if (position.endsWith('R')) x = width * 0.9;
      
      if (position.startsWith('B')) y = height * 0.1;
      else if (position.startsWith('M')) y = height / 2;
      else if (position.startsWith('T')) y = height * 0.9;
      
      return { x, y };
    };

    if (activeTab === 'TEXT' && text) {
      // Determine font
      let fontType = StandardFonts.Helvetica;
      if (isBold && isItalic) fontType = StandardFonts.HelveticaBoldOblique;
      else if (isBold) fontType = StandardFonts.HelveticaBold;
      else if (isItalic) fontType = StandardFonts.HelveticaOblique;
      
      const font = await pdf.embedFont(fontType);
      
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);
      
      const { x, y } = getPos();
      
      // Parse Hex Color
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      page.drawText(text, {
        x: x - (textWidth / 2),
        y: y - (textHeight / 2),
        size: fontSize,
        font: font,
        color: rgb(r, g, b),
        opacity: op,
        rotate: degrees(rotation),
      });
    } else if (activeTab === 'IMAGE' && imageFile) {
      const imageBytes = await imageFile.arrayBuffer();
      let image;
      if (imageFile.type === 'image/png') {
        image = await pdf.embedPng(imageBytes);
      } else if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
        image = await pdf.embedJpg(imageBytes);
      } else {
        return; // Unsupported
      }
      
      const imgDims = image.scale(1);
      const targetWidth = width * (imageScale / 100);
      const scaledImgDims = image.scale(targetWidth / imgDims.width);
      
      const { x, y } = getPos();

      page.drawImage(image, {
        x: x - (scaledImgDims.width / 2),
        y: y - (scaledImgDims.height / 2),
        width: scaledImgDims.width,
        height: scaledImgDims.height,
        opacity: op,
        rotate: degrees(rotation),
      });
    }
  };

  const handleDownload = async () => {
    if (!files[0]) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await files[0].arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();
      
      for (const page of pages) {
        await applyWatermarkToPage(pdf, page);
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      onDownload(blob, `watermarked_${files[0].name}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Configuration Panel */}
      <div className="space-y-6">
        
        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button 
            onClick={() => setActiveTab('TEXT')}
            className={cn("flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2", activeTab === 'TEXT' ? "bg-white dark:bg-slate-700 shadow text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200")}
          >
            <Type className="w-4 h-4" /> Text
          </button>
          <button 
            onClick={() => setActiveTab('IMAGE')}
            className={cn("flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2", activeTab === 'IMAGE' ? "bg-white dark:bg-slate-700 shadow text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200")}
          >
            <ImageIcon className="w-4 h-4" /> Image
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-5 space-y-5">
          {activeTab === 'TEXT' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Watermark Text</label>
                <input 
                  type="text" 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="CONFIDENTIAL"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Color</label>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 p-1 rounded border border-slate-300 dark:border-slate-600 cursor-pointer" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsBold(!isBold)} className={cn("p-2 rounded border transition-colors", isBold ? "bg-slate-200 dark:bg-slate-700 border-slate-400" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600")}>
                    <Bold className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsItalic(!isItalic)} className={cn("p-2 rounded border transition-colors", isItalic ? "bg-slate-200 dark:bg-slate-700 border-slate-400" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600")}>
                    <Italic className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Font Size</label>
                  <span className="text-xs text-slate-500">{fontSize}px</span>
                </div>
                <input type="range" min="20" max="150" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Upload Image (PNG/JPG)</label>
                <input 
                  type="file" 
                  accept=".png,.jpg,.jpeg"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Image Scale</label>
                  <span className="text-xs text-slate-500">{imageScale}%</span>
                </div>
                <input type="range" min="10" max="100" value={imageScale} onChange={(e) => setImageScale(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>
            </>
          )}

          <hr className="border-slate-200 dark:border-slate-700" />

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Opacity</label>
              <span className="text-xs text-slate-500">{opacity}%</span>
            </div>
            <input type="range" min="0" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rotation</label>
              <span className="text-xs text-slate-500">{rotation}°</span>
            </div>
            <input type="range" min="-180" max="180" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2"><Grid3X3 className="w-4 h-4" /> Position</label>
            <div className="grid grid-cols-3 gap-2 w-48 mx-auto">
              {['TL', 'TC', 'TR', 'ML', 'MC', 'MR', 'BL', 'BC', 'BR'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosition(pos as Position)}
                  className={cn("h-10 rounded border transition-all", position === pos ? "bg-amber-500 border-amber-600 shadow-inner" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-amber-400")}
                />
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Preview Panel */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-4 min-h-[500px] flex flex-col items-center justify-center relative">
          <div className="absolute top-4 left-4 bg-white/80 dark:bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm z-10">
             Preview (Page 1)
          </div>
          
          {isPreviewLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          )}

          {previewUrl ? (
            <img src={previewUrl} alt="Watermark Preview" className="max-h-[600px] w-auto shadow-lg border border-slate-200 dark:border-slate-700 rounded" />
          ) : (
            <div className="text-slate-400 flex flex-col items-center gap-2">
               <Stamp className="w-12 h-12 opacity-50" />
               <p>Generating preview...</p>
            </div>
          )}
        </div>

        <div className="flex justify-center mt-6">
          <button
            onClick={handleDownload}
            disabled={isProcessing || (activeTab === 'IMAGE' && !imageFile)}
            className="inline-flex h-16 w-72 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-xl font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
          >
            {isProcessing ? (
              <><Loader2 className="h-6 w-6 animate-spin" /> Processing...</>
            ) : (
              <><Stamp className="h-6 w-6" /> Add Watermark</>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
