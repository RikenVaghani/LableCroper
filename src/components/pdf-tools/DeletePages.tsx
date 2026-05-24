import { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Download, Loader2, Trash2, Check } from 'lucide-react';
import { PageThumbnail } from './shared/PageThumbnail';
import { cn } from '../../utils/cn';

interface DeletePagesProps {
  files: File[];
  onDownload: (blob: Blob, name: string) => void;
}

export function DeletePages({ files, onDownload }: DeletePagesProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
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

  const toggleSelection = (index: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!pdfDoc) return;
    if (selectedPages.size === pdfDoc.numPages) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(Array.from({ length: pdfDoc.numPages }, (_, i) => i)));
    }
  };

  const handleDownload = async () => {
    if (!files[0] || !pdfDoc || selectedPages.size === pdfDoc.numPages) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await files[0].arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      
      const pagesToKeep = Array.from({ length: pdfDoc.numPages })
        .map((_, i) => i)
        .filter(i => !selectedPages.has(i));

      const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      onDownload(blob, `deleted_${files[0].name}`);
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

  const willRemain = pdfDoc.numPages - selectedPages.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          <span className="font-bold text-red-500">{selectedPages.size}</span> pages selected for deletion. <span className="font-bold text-emerald-500">{willRemain}</span> pages will remain.
        </p>
        <button onClick={toggleSelectAll} className="text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline">
          {selectedPages.size === pdfDoc.numPages ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: pdfDoc.numPages }).map((_, i) => {
          const isSelected = selectedPages.has(i);
          return (
            <div 
              key={i} 
              onClick={() => toggleSelection(i)}
              className={cn(
                "group relative cursor-pointer rounded-xl border-2 overflow-hidden bg-white dark:bg-slate-900 transition-all duration-200",
                isSelected ? "border-red-500 shadow-md" : "border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700"
              )}
            >
              <div className="p-4 flex items-center justify-center min-h-[200px]">
                <PageThumbnail pdf={pdfDoc} pageNumber={i + 1} width={120} className="shadow-sm border border-slate-100 dark:border-slate-800" />
              </div>
              
              {isSelected && (
                <div className="absolute inset-0 bg-red-500/20 backdrop-blur-[1px] flex flex-col items-center justify-center">
                  <div className="bg-red-500 text-white rounded-full p-2 mb-2">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <span className="text-red-700 dark:text-red-200 font-bold text-sm bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded">Will Delete</span>
                </div>
              )}

              {!isSelected && (
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-full text-slate-400">
                    <Trash2 className="w-5 h-5" />
                  </div>
                </div>
              )}

              <div className={cn("absolute top-2 left-2 w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold backdrop-blur-sm", isSelected ? "bg-red-500 text-white" : "bg-black/50 text-white")}>
                {i + 1}
              </div>
              
              <div className={cn("absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center", isSelected ? "bg-red-500 border-red-500 text-white" : "border-slate-300 dark:border-slate-600 bg-white/50")}>
                {isSelected && <Check className="w-3 h-3" />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-8">
        <button
          onClick={handleDownload}
          disabled={isProcessing || selectedPages.size === 0 || selectedPages.size === pdfDoc.numPages}
          className="inline-flex h-16 w-72 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-xl font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          {isProcessing ? (
            <><Loader2 className="h-6 w-6 animate-spin" /> Processing...</>
          ) : (
            <><Download className="h-6 w-6" /> Delete & Download</>
          )}
        </button>
      </div>
      
      {selectedPages.size === pdfDoc.numPages && (
         <p className="text-center text-sm text-red-500 mt-2 font-medium">You cannot delete all pages.</p>
      )}
    </div>
  );
}
