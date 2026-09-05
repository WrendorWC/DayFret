import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument, PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PdfPageCanvasProps = {
  file: string;
  page: number;
};

export function PdfPageCanvas({ file, page }: PdfPageCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tracks the live PDF.js document object for cleanup — not used for render decisions.
  const currentDocRef = useRef<PDFDocumentProxy | null>(null);

  // pdfDoc + pdfDocFile live in React state so the render effect has clean,
  // race-free dependencies.  We only render when pdfDocFile === file (the prop),
  // which prevents stale renders when file and page change simultaneously.
  const [pdfDoc, setPdfDoc]         = useState<PDFDocumentProxy | null>(null);
  const [pdfDocFile, setPdfDocFile] = useState<string>("");

  const [width, setWidth]       = useState<number>(860);
  const [maxHeight, setMaxHeight] = useState<number>(1100);
  const [isLoading, setIsLoading]     = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── resize observer ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = (): void => {
      setWidth(Math.max(320, container.clientWidth));
      const rect = container.getBoundingClientRect();
      const freeHeight = Math.max(340, window.innerHeight - rect.top - 20);
      setMaxHeight(freeHeight);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // ── document loader ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      // Tear down old document before loading a new one.
      currentDocRef.current?.destroy();
      currentDocRef.current = null;
      setPdfDoc(null);
      setPdfDocFile("");   // no doc is current yet
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const doc = await getDocument(file).promise;
        if (cancelled) { void doc.destroy(); return; }
        currentDocRef.current = doc;
        setPdfDoc(doc);
        setPdfDocFile(file);  // doc is now valid for this file
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Unable to load PDF");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [file]);

  // ── page renderer ────────────────────────────────────────────────────────
  useEffect(() => {
    // Guard: only render when pdfDoc is loaded for the CURRENT file prop.
    // Without this, a page-number change fires the effect before the new
    // document finishes loading, causing an "Invalid page request" error
    // when the old (shorter) document is asked for a page beyond its range.
    if (!pdfDoc || pdfDocFile !== file) return;

    let cancelled = false;

    const render = async (): Promise<void> => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pageRef = await pdfDoc.getPage(page);
      if (cancelled) return;

      const rotation = pageRef.rotate; // honour PDF /Rotate (0/90/180/270)
      const baseViewport = pageRef.getViewport({ scale: 1, rotation });
      const scale = Math.min(width / baseViewport.width, maxHeight / baseViewport.height);
      const viewport = pageRef.getViewport({ scale, rotation });
      const dpr = window.devicePixelRatio || 1;

      canvas.width  = Math.floor(viewport.width  * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width  = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const context = canvas.getContext("2d");
      if (!context) return;

      // Do NOT call context.setTransform() here — PDF.js manages the canvas
      // transform internally.  Pass the DPR scale via the render `transform`
      // option so PDF.js can compose it correctly with the viewport transform.
      // Setting it on the context first can cause a double-flip on PDFs whose
      // content stream contains its own coordinate-space cm operator.
      context.clearRect(0, 0, canvas.width, canvas.height);

      await pageRef.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise;
    };

    void render().catch((err) => {
      if (!cancelled) {
        setErrorMessage(err instanceof Error ? err.message : "Unable to render page");
      }
    });

    return () => { cancelled = true; };
  }, [file, pdfDoc, pdfDocFile, maxHeight, page, width]);

  return (
    <section className="card pdf-card">
      <div ref={containerRef} className="pdf-canvas-wrap">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>
      {isLoading ? <div className="pdf-status">Loading page...</div> : null}
      {errorMessage ? <div className="pdf-status error">{errorMessage}</div> : null}
    </section>
  );
}
