import { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Download, Loader2, GripVertical, RotateCcw } from 'lucide-react';
import { PageThumbnail } from './shared/PageThumbnail';
import { cn } from '../../utils/cn';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortablePageProps {
  id: string;
  originalIndex: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
}

function SortablePage({ id, originalIndex, pdfDoc }: SortablePageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-white dark:bg-slate-900 rounded-xl border-2 overflow-hidden transition-colors",
        isDragging ? "border-purple-500 shadow-xl opacity-80" : "border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700"
      )}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded cursor-grab active:cursor-grabbing backdrop-blur-sm transition"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="p-4 pt-10 flex items-center justify-center min-h-[200px]">
        <PageThumbnail pdf={pdfDoc} pageNumber={originalIndex + 1} width={120} className="shadow-sm border border-slate-100 dark:border-slate-800 pointer-events-none" />
      </div>
      
      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center justify-center font-bold">
        {originalIndex + 1}
      </div>
    </div>
  );
}

interface ReorderPagesProps {
  files: File[];
  onDownload: (blob: Blob, name: string) => void;
}

export function ReorderPages({ files, onDownload }: ReorderPagesProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
        setItems(Array.from({ length: doc.numPages }).map((_, i) => i.toString()));
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [files]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id.toString());
        const newIndex = items.indexOf(over.id.toString());
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const resetOrder = () => {
    if (pdfDoc) setItems(Array.from({ length: pdfDoc.numPages }).map((_, i) => i.toString()));
  };

  const reverseOrder = () => {
    setItems((prev) => [...prev].reverse());
  };

  const handleDownload = async () => {
    if (!files[0] || !pdfDoc) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await files[0].arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      
      const newOrderIndices = items.map(id => parseInt(id, 10));
      const copiedPages = await newPdf.copyPages(pdf, newOrderIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const bytes = await newPdf.save();
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      onDownload(blob, `reordered_${files[0].name}`);
    } catch (error) {
      console.error('Error processing PDF:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!pdfDoc) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Drag and drop pages to reorder.
        </p>
        <div className="flex items-center gap-2">
          <button onClick={reverseOrder} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 transition">
             Reverse All
          </button>
          <button onClick={resetOrder} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 transition">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((id, index) => (
              <div key={id} className="relative">
                <SortablePage id={id} originalIndex={parseInt(id, 10)} pdfDoc={pdfDoc} />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full z-20 shadow">
                  Pos {index + 1}
                </div>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex justify-center mt-8">
        <button
          onClick={handleDownload}
          disabled={isProcessing}
          className="inline-flex h-16 w-72 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 text-xl font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          {isProcessing ? (
            <><Loader2 className="h-6 w-6 animate-spin" /> Processing...</>
          ) : (
            <><Download className="h-6 w-6" /> Save New Order</>
          )}
        </button>
      </div>
    </div>
  );
}
