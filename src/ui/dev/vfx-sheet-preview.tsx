'use client';

import { useEffect, useRef, useState } from 'react';

export type VfxPreviewBg = 'checker' | 'dark' | 'light' | 'green';

const BG: Record<VfxPreviewBg, string> = {
  checker: '',
  dark: '#141414',
  light: '#ececec',
  green: '#2fbf4a',
};

export interface VfxSheetPreviewProps {
  url: string | null;
  urls?: string[] | null;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameRate: number;
  loop: boolean;
  showGrid: boolean;
  speed: number;
  playing: boolean;
  background: VfxPreviewBg;
  restartToken: number;
  onEnded?: () => void;
  onPauseRequest?: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

export function VfxSheetPreview({
  url,
  urls,
  frameWidth,
  frameHeight,
  frameCount,
  frameRate,
  loop,
  showGrid,
  speed,
  playing,
  background,
  restartToken,
  onEnded,
  onPauseRequest,
}: VfxSheetPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetRef = useRef<HTMLImageElement | null>(null);
  const sequenceRef = useRef<HTMLImageElement[]>([]);
  const onEndedRef = useRef(onEnded);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const sequence = Boolean(urls && urls.length > 0);
  const total = Math.max(1, sequence ? urls!.length : frameCount);
  const urlsKey = urls?.join('|') ?? '';
  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;
    sheetRef.current = null;
    sequenceRef.current = [];
    if (sequence && urls) {
      void Promise.all(urls.map((src) => loadImage(src)))
        .then((images) => {
          if (cancelled) return;
          sequenceRef.current = images;
          const first = images[0];
          setNatural({ width: first?.naturalWidth ?? 0, height: first?.naturalHeight ?? 0 });
        })
        .catch(() => {
          if (!cancelled) setNatural({ width: 0, height: 0 });
        });
      return () => {
        cancelled = true;
      };
    }
    if (!url) {
      setNatural({ width: 0, height: 0 });
      return;
    }
    void loadImage(url)
      .then((img) => {
        if (cancelled) return;
        sheetRef.current = img;
        setNatural({ width: img.naturalWidth, height: img.naturalHeight });
      })
      .catch(() => {
        if (!cancelled) {
          sheetRef.current = null;
          setNatural({ width: 0, height: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, sequence, urls, urlsKey]);

  useEffect(() => {
    setFrame(0);
    frameRef.current = 0;
  }, [restartToken, url, urlsKey, total]);

  useEffect(() => {
    if (!playing) return;
    const fps = Math.max(0.1, frameRate * speed);
    const step = 1000 / fps;
    let last = performance.now();
    let raf = 0;
    let ended = false;
    const tick = (now: number) => {
      if (now - last >= step) {
        last = now;
        const next = frameRef.current + 1;
        if (next >= total) {
          if (loop) {
            frameRef.current = 0;
            setFrame(0);
          } else if (!ended) {
            ended = true;
            frameRef.current = total - 1;
            setFrame(total - 1);
            onEndedRef.current?.();
            return;
          }
        } else {
          frameRef.current = next;
          setFrame(next);
        }
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [playing, frameRate, speed, total, loop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = Math.max(64, frameWidth || 64);
    const h = Math.max(64, frameHeight || 64);
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    if (background === 'checker') {
      const cell = 8;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          ctx.fillStyle = ((x / cell + y / cell) | 0) % 2 === 0 ? '#3a3a3a' : '#2a2a2a';
          ctx.fillRect(x, y, cell, cell);
        }
      }
    } else {
      ctx.fillStyle = BG[background];
      ctx.fillRect(0, 0, w, h);
    }
    if (!frameWidth || !frameHeight) return;
    if (sequence) {
      const img = sequenceRef.current[frame];
      if (img) ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h);
    } else {
      const img = sheetRef.current;
      if (!img) return;
      const cols = Math.max(1, Math.floor(img.naturalWidth / frameWidth));
      const sx = (frame % cols) * frameWidth;
      const sy = Math.floor(frame / cols) * frameHeight;
      ctx.drawImage(img, sx, sy, frameWidth, frameHeight, 0, 0, w, h);
    }
    if (showGrid) {
      ctx.strokeStyle = 'rgba(240, 210, 120, 0.85)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }
  }, [natural, frame, frameWidth, frameHeight, showGrid, background, sequence]);

  const cols = !sequence && natural.width && frameWidth ? Math.floor(natural.width / frameWidth) : 0;
  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    frameRef.current = clamped;
    setFrame(clamped);
    onPauseRequest?.();
  };

  return (
    <div className="vfx-preview">
      <canvas ref={canvasRef} className="vfx-preview__frame" />
      <div className="vfx-preview__nav">
        <button type="button" onClick={() => goTo(frame - 1)} disabled={frame <= 0}>
          ‹ Frame
        </button>
        <span>
          Frame {frame + 1} / {total}
        </span>
        <button type="button" onClick={() => goTo(frame + 1)} disabled={frame >= total - 1}>
          Frame ›
        </button>
      </div>
      <p className="vfx-preview__meta">
        {natural.width ? `Resolution ${natural.width}×${natural.height}` : ''}
        {cols ? ` · ${cols} colunas` : ''}
        {sequence ? ` · sequência (${total} imagens)` : ''}
      </p>
    </div>
  );
}
