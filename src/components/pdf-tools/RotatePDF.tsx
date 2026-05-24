import React, { useState, useEffect } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Download, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { PageThumbnail } from './shared/PageThumbnail';
import { cn } from '../../utils/cn';

interface RotatePDFProps {
  files: File[];
  onDownload: (blob: Blob, name: string) => void;
}

export function RotatePDF({ files, onDownload }: RotatePDFProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [rotations, setRotations] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      if (files.length === 0) return;
      setIsLoading(true);
      try {
        const arrayBuffer = await files[0].arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!isMounted) return;
        setPdfDoc(doc);
        setRotations(new Array(doc.numPages).fill(0));
        setSelectedPages(new Set());
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [files]);

  const handleRotateLeft = (index: number, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setRotations(prev => {
      const next = [...prev];
      next[index] = (next[index] - 90) % 360;
      return next;
    });
  };

  const handleRotateRight = (index: number, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setRotations(prev => {
      const next = [...prev];
      next[index] = (next[index] + 90) % 360;
      return next;
    });
  };

  const toggleSelection = (index: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const rotateAllLeft = () => setRotations(prev => prev.map(r => (r - 90) % 360));
  const rotateAllRight = () => setRotations(prev => prev.map(r => (r + 90) % 360));

  const toggleSelectAll = () => {
    if (!pdfDoc) return;
    if (selectedPages.size === pdfDoc.numPages) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(Array.from({ length: pdfDoc.numPages }, (_, i) => i)));
    }
  };

  const handleDownload = async () => {
    if (!files[0] || !pdfDoc) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await files[0].arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = pdf.getPages();
      
      pages.forEach((page, idx) => {
        const currentRotation = page.getRotation().angle;
        const additionalRotation = rotations[idx];
        if (additionalRotation !== 0) {
          page.setRotation(degrees(currentRotation + additionalRotation));
        }
      });

      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      onDownload(blob, `rotated_${files[0].name}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!pdfDoc) return null;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <button onClick={rotateAllLeft} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 transition">
            <RotateCcw className="w-4 h-4" /> Left
          </button>
          <button onClick={rotateAllRight} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 transition">
            <RotateCw className="w-4 h-4" /> Right
          </button>
        </div>
        <button onClick={toggleSelectAll} className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline">
          {selectedPages.size === pdfDoc.numPages ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: pdfDoc.numPages }).map((_, i) => {
          const rotation = rotations[i] || 0;
          const isSelected = selectedPages.has(i);
          return (
            <div 
              key={i} 
              onClick={() => toggleSelection(i)}
              className={cn(
                "group relative cursor-pointer rounded-xl border-2 overflow-hidden bg-white dark:bg-slate-900 transition-all duration-200",
                isSelected ? "border-sky-500 shadow-md" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              )}
            >
              <div className="p-4 flex items-center justify-center min-h-[200px]">
                <div style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.3s ease' }}>
                  <PageThumbnail pdf={pdfDoc} pageNumber={i + 1} width={120} className="shadow-sm border border-slate-100 dark:border-slate-800" />
                </div>
              </div>
              
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => handleRotateLeft(i, e)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={(e) => handleRotateRight(i, e)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition">
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center font-medium backdrop-blur-sm">
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-8">
        <button
          onClick={handleDownload}
          disabled={isProcessing}
          className="inline-flex h-16 w-72 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-xl font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          {isProcessing ? (
            <><Loader2 className="h-6 w-6 animate-spin" /> Processing...</>
          ) : (
            <><Download className="h-6 w-6" /> Download Rotated PDF</>
          )}
        </button>
      </div>
    </div>
  );
}
