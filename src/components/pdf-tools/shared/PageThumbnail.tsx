import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

interface PageThumbnailProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  width?: number;
  className?: string;
  onRenderSuccess?: () => void;
}

export function PageThumbnail({ pdf, pageNumber, width = 160, className = '', onRenderSuccess }: PageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        setLoading(true);
        const page = await pdf.getPage(pageNumber);
        
        if (!isMounted) return;

        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport,
          canvas: canvas
        });

        await renderTask.promise;
        
        if (isMounted) {
          setLoading(false);
          onRenderSuccess?.();
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'RenderingCancelledException') {
          // Ignore cancellation errors
        } else {
          console.error(`Error rendering page ${pageNumber}:`, error);
          if (isMounted) setLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNumber, width, onRenderSuccess]);

  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 animate-pulse">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas ref={canvasRef} className="block w-full h-auto" />
    </div>
  );
}
