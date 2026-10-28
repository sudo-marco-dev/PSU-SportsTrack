import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

// Configure the worker source for pdfjs-dist
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface CanvasPdfViewerProps {
  storagePath: string;
  signedUrl?: string | null;
}

export const CanvasPdfViewer = ({ storagePath, signedUrl }: CanvasPdfViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const isImageFile = /\.(png|jpe?g|webp|gif|jfif)$/i.test(storagePath);

  // 1. Fetch document in memory via JavaScript (immune to browser download managers)
  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      setPdfDoc(null);
      setImageUrl(null);
      setCurrentPage(1);

      try {
        if (isImageFile) {
          let blobUrl: string | null = signedUrl || null;
          let imageError: string | null = null;
          if (!blobUrl) {
            const { data: signData, error: signErr } = await supabase.storage
              .from('verification_documents')
              .createSignedUrl(storagePath, 3600);
            if (signData?.signedUrl) {
              blobUrl = signData.signedUrl;
            } else if (signErr) {
              imageError = signErr.message;
            }
          }
          if (!blobUrl) {
            const { data, error: dlErr } = await supabase.storage
              .from('verification_documents')
              .download(storagePath);
            if (!dlErr && data) {
              blobUrl = URL.createObjectURL(data);
            } else if (dlErr) {
              imageError = dlErr.message;
            }
          }
          if (blobUrl && !isCancelled) {
            setImageUrl(blobUrl);
            setIsLoading(false);
            return;
          }
          if (!isCancelled) {
            setError(`Could not load image file: ${imageError || 'File not found in storage.'}`);
            setIsLoading(false);
            return;
          }
        }

        let arrayBuffer: ArrayBuffer | null = null;

        // Try downloading directly via Supabase storage client first
        try {
          const { data, error: downloadError } = await supabase.storage
            .from('verification_documents')
            .download(storagePath);

          if (!downloadError && data) {
            arrayBuffer = await data.arrayBuffer();
          }
        } catch {
          // Fall through to signed URL approach
        }

        // Fallback: fetch via signed URL in memory
        if (!arrayBuffer) {
          let urlToFetch = signedUrl;
          if (!urlToFetch) {
            const { data: signData, error: signError } = await supabase.storage
              .from('verification_documents')
              .createSignedUrl(storagePath, 3600);

            if (signError || !signData?.signedUrl) {
              throw new Error(signError?.message || 'Failed to generate signed document URL');
            }
            urlToFetch = signData.signedUrl;
          }

          const response = await fetch(urlToFetch);
          if (!response.ok) throw new Error(`HTTP error ${response.status} loading document`);
          arrayBuffer = await response.arrayBuffer();
        }

        if (isCancelled || !arrayBuffer) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Error loading PDF for canvas viewer:', err);
          setError(err.message || 'Could not load PDF document.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [storagePath, signedUrl]);

  // 2. Render active page onto HTML5 Canvas with high-DPI sharpness
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any ongoing rendering task before starting a new one
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // Ignore cancel errors
      }
      renderTaskRef.current = null;
    }

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        // Set dimensions for high-DPI display
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform || undefined,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Canvas render error:', err);
        }
      } finally {
        renderTaskRef.current = null;
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancel errors
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, scale]);

  // Reset vertical scroll to top when changing pages
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const handleZoomIn = () => {
    setScale((prev) => Number(Math.min(prev + 0.15, 2.5).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((prev) => Number(Math.max(prev - 0.15, 0.4).toFixed(2)));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const handleFitWidth = async () => {
    if (!viewportRef.current || !pdfDoc) {
      setScale(1.0);
      return;
    }
    try {
      const page = await pdfDoc.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const availableWidth = viewportRef.current.clientWidth - 48; // padding margin
      if (availableWidth > 100 && unscaledViewport.width > 0) {
        const computed = availableWidth / unscaledViewport.width;
        setScale(Number(Math.max(0.4, Math.min(2.5, computed)).toFixed(2)));
        return;
      }
    } catch {
      // Fallback
    }
    setScale(1.0);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-white/10 select-none">
      {/* Viewer Toolbar */}
      <div className="h-12 px-4 bg-slate-900 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-orange-500" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">
            Document Canvas View
          </span>
          <Badge className="bg-white/5 text-slate-400 border-white/10 text-[9px] font-bold uppercase">
            In-Screen
          </Badge>
        </div>

        {/* Zoom & Page Navigation Controls */}
        <div className="flex items-center gap-1.5">
          {numPages > 1 && (
            <div className="flex items-center gap-1 mr-3 border-r border-white/10 pr-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || isLoading}
                className="size-7 p-0 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-[11px] font-mono text-slate-400 px-1">
                {currentPage} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= numPages || isLoading}
                className="size-7 p-0 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.4 || isLoading}
            className="size-7 p-0 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            disabled={isLoading}
            className="h-7 px-2 text-[10px] font-mono text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
            title="Reset to 100%"
          >
            {Math.round(scale * 100)}%
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 2.5 || isLoading}
            className="size-7 p-0 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFitWidth}
            disabled={isLoading}
            className="size-7 p-0 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg ml-1"
            title="Fit Width"
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>

      {/* Canvas Viewport Area - Fixed scroll clipping by removing items-center on scroll container */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-auto bg-slate-900/80 relative scrollbar-thin"
      >
        <div className="w-fit min-w-full min-h-full flex flex-col p-4 sm:p-6">
          {isLoading ? (
            <div className="m-auto flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="size-8 text-orange-500 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Rendering High-Definition Canvas...
              </p>
            </div>
          ) : error ? (
            <div className="m-auto text-center p-6 space-y-2">
              <AlertTriangle className="size-8 text-red-500 mx-auto" />
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">{error}</p>
            </div>
          ) : isImageFile && imageUrl ? (
            <div className="m-auto shadow-2xl rounded-lg overflow-hidden bg-slate-950/40 p-2 shrink-0 max-w-full">
              <img
                src={imageUrl}
                alt="Clearance Document"
                style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                className="rounded-lg max-h-[70dvh] object-contain transition-transform"
              />
            </div>
          ) : (
            <div className="m-auto shadow-2xl rounded-lg overflow-hidden bg-white shrink-0">
              <canvas ref={canvasRef} className="block max-w-none" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
