import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfJsLoader: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfJsLoader) {
    pdfJsLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-barakah-pdfjs="true"]');
      const script = existing || document.createElement("script");
      const fail = () => {
        pdfJsLoader = null;
        reject(new Error("PDF preview library could not be loaded."));
      };
      script.addEventListener("load", () => {
        if (!window.pdfjsLib) return fail();
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      }, { once: true });
      script.addEventListener("error", fail, { once: true });
      if (!existing) {
        script.src = PDFJS_SCRIPT;
        script.async = true;
        script.dataset.barakahPdfjs = "true";
        document.head.appendChild(script);
      }
    });
  }
  return pdfJsLoader;
}

type Props = { dataUrl: string; title: string; initialZoom: number };

export function LedgerPdfViewer({ dataUrl, title, initialZoom }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [pdf, setPdf] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(initialZoom);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => setZoom(initialZoom), [initialZoom, dataUrl]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any;
    setLoading(true);
    setError("");
    setPdf(null);
    const load = async () => {
      try {
        const pdfjs = await loadPdfJs();
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        loadingTask = pdfjs.getDocument({ data: bytes });
        const documentPdf = await loadingTask.promise;
        if (cancelled) { await documentPdf.destroy(); return; }
        setPdf(documentPdf);
        setPageCount(documentPdf.numPages);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError("Preview লোড করা যায়নি। Download করে PDF খুলুন।");
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
      if (loadingTask) loadingTask.destroy().catch(() => {});
    };
  }, [dataUrl]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setContainerWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdf || !containerWidth || !pageCount) return;
    let cancelled = false;
    const renderPages = async () => {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        if (cancelled) return;
        const canvas = canvasRefs.current[pageNumber - 1];
        if (!canvas) continue;
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(0.1, (containerWidth - 20) / baseViewport.width);
        const scale = fitScale * zoom;
        const viewport = page.getViewport({ scale });
        const ratio = Math.max(1, window.devicePixelRatio || 1);
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        await page.render({ canvasContext: context, viewport }).promise;
      }
    };
    renderPages().catch((e) => {
      if (!cancelled) console.error("PDF page rendering failed:", e);
    });
    return () => { cancelled = true; };
  }, [pdf, containerWidth, pageCount, zoom]);

  const changeZoom = (delta: number) => setZoom(value => Math.min(2.5, Math.max(0.35, Math.round((value + delta) * 100) / 100)));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#e7e7e7]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/10 bg-[#f8f8f8] px-3 py-2 text-black">
        <span className="text-[11px] font-semibold tabular-nums">{Math.round(zoom * 100)}% · {pageCount || "—"} page(s)</span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => changeZoom(-0.1)} disabled={zoom <= 0.35} className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/15 bg-white disabled:opacity-40" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
          <button type="button" onClick={() => setZoom(initialZoom)} className="flex h-8 items-center gap-1 rounded-lg border border-black/15 bg-white px-2 text-[10px] font-semibold"><Maximize2 className="h-3.5 w-3.5" /> Fit</button>
          <button type="button" onClick={() => changeZoom(0.1)} disabled={zoom >= 2.5} className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/15 bg-white disabled:opacity-40" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto px-2 py-3">
        {loading && <div className="py-10 text-center text-sm text-slate-600">Document loading…</div>}
        {error && <div className="py-10 text-center text-sm text-rose-700">{error}</div>}
        {pdf && <div className="flex flex-col items-center gap-3">
          {Array.from({ length: pageCount }, (_, index) => (
            <canvas key={index} ref={node => { canvasRefs.current[index] = node; }} aria-label={`${title} page ${index + 1}`} className="max-w-none bg-white shadow-md" />
          ))}
        </div>}
      </div>
    </div>
  );
}
