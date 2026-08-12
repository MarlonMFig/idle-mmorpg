'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export interface PanelPosition {
  x: number;
  y: number;
}

const STORAGE_KEY = 'idle-mmorpg:ui-panel-pos:v1';

type StoredMap = Record<string, PanelPosition>;

function readAll(): StoredMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as StoredMap;
  } catch {
    return {};
  }
}

function writeAll(map: StoredMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota / private mode
  }
}

function loadPosition(panelId: string): PanelPosition | null {
  const entry = readAll()[panelId];
  if (!entry || typeof entry.x !== 'number' || typeof entry.y !== 'number') return null;
  if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return null;
  return { x: entry.x, y: entry.y };
}

function savePosition(panelId: string, pos: PanelPosition): void {
  const map = readAll();
  map[panelId] = pos;
  writeAll(map);
}

function clampPosition(
  pos: PanelPosition,
  width: number,
  height: number,
): PanelPosition {
  const maxX = Math.max(0, window.innerWidth - Math.max(width, 40));
  const maxY = Math.max(0, window.innerHeight - Math.max(height, 40));
  return {
    x: Math.min(maxX, Math.max(0, pos.x)),
    y: Math.min(maxY, Math.max(0, pos.y)),
  };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, select, textarea, label, [data-no-drag]'));
}

export interface UseDraggablePanelOptions {
  /** z-index enquanto arrasta (default 90). */
  dragZIndex?: number;
  /** z-index com posição customizada (default 40). */
  zIndex?: number;
}

export interface UseDraggablePanelResult {
  panelRef: RefObject<HTMLElement | null>;
  style: CSSProperties;
  isDragging: boolean;
  hasCustomPosition: boolean;
  handleProps: {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
    style: CSSProperties;
  };
  resetPosition: () => void;
}

/**
 * Torna um painel flutuante arrastável (handle no cabeçalho).
 * Persistência por id em localStorage; se nunca arrastou, usa CSS de layout.
 */
export function useDraggablePanel(
  panelId: string,
  options: UseDraggablePanelOptions = {},
): UseDraggablePanelResult {
  const { dragZIndex = 90, zIndex = 40 } = options;
  const panelRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<PanelPosition | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    setPos(loadPosition(panelId));
    setHydrated(true);
  }, [panelId]);

  const clampToViewport = useCallback((next: PanelPosition): PanelPosition => {
    const el = panelRef.current;
    const width = el?.offsetWidth ?? 280;
    const height = el?.offsetHeight ?? 200;
    return clampPosition(next, width, height);
  }, []);

  // Reencaixa no viewport ao redimensionar.
  useEffect(() => {
    if (!hydrated || !pos) return;
    const onResize = () => {
      setPos((current) => {
        if (!current) return current;
        const next = clampToViewport(current);
        if (next.x === current.x && next.y === current.y) return current;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, [hydrated, pos != null, clampToViewport]);

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
      setPos((current) => {
        if (!current) return current;
        const clamped = clampToViewport(current);
        savePosition(panelId, clamped);
        return clamped;
      });
    },
    [clampToViewport, panelId],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (isInteractiveTarget(event.target)) return;
      const el = panelRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const current = pos ?? { x: rect.left, y: rect.top };
      // Ancora em coordenadas de viewport no primeiro arraste.
      if (!pos) setPos(current);

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origX: current.x,
        origY: current.y,
      };
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const next = clampToViewport({
        x: drag.origX + (event.clientX - drag.startX),
        y: drag.origY + (event.clientY - drag.startY),
      });
      setPos(next);
    },
    [clampToViewport],
  );

  const resetPosition = useCallback(() => {
    const map = readAll();
    delete map[panelId];
    writeAll(map);
    setPos(null);
    setIsDragging(false);
    dragRef.current = null;
  }, [panelId]);

  const style: CSSProperties =
    hydrated && pos
      ? {
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          right: 'auto',
          bottom: 'auto',
          margin: 0,
          zIndex: isDragging ? dragZIndex : zIndex,
        }
      : {};

  return {
    panelRef,
    style,
    isDragging,
    hasCustomPosition: pos != null,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      style: {
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: isDragging ? 'none' : undefined,
      },
    },
    resetPosition,
  };
}
