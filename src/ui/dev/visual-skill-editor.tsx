'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isDevMode } from '@/config/devConfig';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { getCharacterPackById, listCharacterPacks } from '@/data/character-packs';
import type { SpriteSheetDef } from '@/data/character-packs';
import { getSkill } from '@/data/skills';
import { getVfxDefinition } from '@/data/vfx';
import { isSequenceVfx, vfxFrameUrls } from '@/data/vfx/types';
import { useStore } from '@/hooks/use-store';
import {
  characterDrawScale,
  deltaToStage,
  enemyFeetX,
  expandHitBox,
  pointInAabb,
  pointerToStage,
  snapGameValue,
  VSE_CHAR_FEET_X,
  VSE_DISTANCE_DEFAULT,
  VSE_DISTANCE_MAX,
  VSE_DISTANCE_MIN,
  VSE_DISTANCE_PRESETS,
  VSE_GROUND_Y,
  VSE_PREVIEW_ACTOR_SCALE,
  VSE_SNAP_PRESETS,
  VSE_STAGE_HEIGHT,
  VSE_STAGE_WIDTH,
  VSE_ZOOM_PRESETS,
  vseViewFit,
  vfxAabbGame,
  vfxOriginGame,
  vfxWorldScale,
  type VseSnap,
  type VseViewFit,
  type VseZoom,
} from '@/lib/dev/visual-skill-editor-space';
import { labPoseHasContent, type LabPoseSheet } from '@/lib/dev/lab-pose-sheet';
import {
  clampLoopRange,
  createFrameLoopState,
  FRAME_LOOP_MODES,
  legacyLoopFromMode,
  normalizeFrameLoop,
  resolvePersistentLoopDuration,
  stepFrameLoop,
  type FrameLoopMode,
  type FrameLoopPhase,
  type FrameLoopState,
} from '@/lib/frame-loop';
import { officialSkillDurationMs } from '@/data/skill-execution-def';
import { characterLabStore } from '@/stores/character-lab-store';

type EditorMode = 'edit' | 'play';

interface VisualSnapshot {
  vfxOffsetX: number;
  vfxOffsetY: number;
  vfxScale: number;
  vfxFlipX: boolean;
  vfxFlipY: boolean;
  vfxLoopMode: FrameLoopMode;
  vfxLoopStartFrame: number;
  vfxLoopEndFrame: number;
  poseFlipX: boolean;
  poseFlipY: boolean;
  poseLoopMode: FrameLoopMode;
  poseLoopStartFrame: number;
  poseLoopEndFrame: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function drawSheetFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  frame: number,
  frameWidth: number,
  frameHeight: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  if (!img || !frameWidth || !frameHeight) return;
  const cols = Math.max(1, Math.floor(img.naturalWidth / frameWidth));
  ctx.drawImage(
    img,
    (frame % cols) * frameWidth,
    Math.floor(frame / cols) * frameHeight,
    frameWidth,
    frameHeight,
    dx,
    dy,
    dw,
    dh,
  );
}

function sheetFrameCount(sheet: SpriteSheetDef | LabPoseSheet | null | undefined): number {
  if (!sheet) return 1;
  return Math.max(1, sheet.frames?.length || sheet.frameCount || 1);
}

export function VisualSkillEditor({
  saveBusy,
  canSave,
  onSave,
}: {
  saveBusy: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  if (!isDevMode()) return null;
  return <VisualSkillEditorInner saveBusy={saveBusy} canSave={canSave} onSave={onSave} />;
}

function VisualSkillEditorInner({
  saveBusy,
  canSave,
  onSave,
}: {
  saveBusy: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const poseSheet = useStore(characterLabStore, (s) => s.poseSheet);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const playerId = useStore(characterLabStore, (s) => s.playerId);
  const lastSkillId = useStore(characterLabStore, (s) => s.lastSkillId);
  const vfxId = useStore(characterLabStore, (s) => s.vfxId);
  const vfxScale = useStore(characterLabStore, (s) => s.vfxScale);
  const vfxOffsetX = useStore(characterLabStore, (s) => s.vfxOffsetX);
  const vfxOffsetY = useStore(characterLabStore, (s) => s.vfxOffsetY);
  const vfxLoopMode = useStore(characterLabStore, (s) => s.vfxLoopMode);
  const vfxLoopStartFrame = useStore(characterLabStore, (s) => s.vfxLoopStartFrame);
  const vfxLoopEndFrame = useStore(characterLabStore, (s) => s.vfxLoopEndFrame);
  const vfxLoopDurationMs = useStore(characterLabStore, (s) => s.vfxLoopDurationMs);
  const vfxLoopUntilSkillEnd = useStore(characterLabStore, (s) => s.vfxLoopUntilSkillEnd);
  const execution = useStore(characterLabStore, (s) => s.execution);
  const vfxFlipX = useStore(characterLabStore, (s) => s.vfxFlipX);
  const vfxFlipY = useStore(characterLabStore, (s) => s.vfxFlipY);

  const vfx = useMemo(() => getVfxDefinition(vfxId), [vfxId]);
  const packs = useMemo(() => listCharacterPacks({ includeInactive: false }), []);
  const playerPack = playerId ? getCharacterPackById(playerId) : undefined;
  const playerIdle = playerPack?.idle ?? playerPack?.walk ?? null;
  const skillName = lastSkillId ? (getSkill(lastSkillId)?.name ?? lastSkillId) : '—';

  const [workspace, setWorkspace] = useState(false);
  const [zoom, setZoom] = useState<VseZoom>(1);
  const [snap, setSnap] = useState<VseSnap>(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showHitDebug, setShowHitDebug] = useState(true);
  const [mode, setMode] = useState<EditorMode>('edit');
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [poseFrame, setPoseFrame] = useState(0);
  const [vfxFrame, setVfxFrame] = useState(0);
  const [posePhase, setPosePhase] = useState<FrameLoopPhase>('first-pass');
  const [vfxPhase, setVfxPhase] = useState<FrameLoopPhase>('first-pass');
  const [idleFrame, setIdleFrame] = useState(0);
  const [enemyIdleFrame, setEnemyIdleFrame] = useState(0);
  const [distance, setDistance] = useState(VSE_DISTANCE_DEFAULT);
  const [enemyId, setEnemyId] = useState('');
  const [debugLine, setDebugLine] = useState('');
  const [undoStack, setUndoStack] = useState<VisualSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<VisualSnapshot[]>([]);
  const [viewTick, setViewTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const poseImgRef = useRef<HTMLImageElement | null>(null);
  const poseSeqRef = useRef<HTMLImageElement[]>([]);
  const idleImgRef = useRef<HTMLImageElement | null>(null);
  const enemyImgRef = useRef<HTMLImageElement | null>(null);
  const vfxImgRef = useRef<HTMLImageElement | null>(null);
  const vfxSeqRef = useRef<HTMLImageElement[]>([]);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const selectedRef = useRef(false);
  const poseFrameRef = useRef(0);
  const vfxFrameRef = useRef(0);
  const poseLoopStateRef = useRef<FrameLoopState>(createFrameLoopState());
  const vfxLoopStateRef = useRef<FrameLoopState>(createFrameLoopState());
  const idleFrameRef = useRef(0);
  const enemyIdleFrameRef = useRef(0);
  const fitRef = useRef<VseViewFit>({ scale: 1, offsetX: 0, offsetY: 0, viewW: 1, viewH: 1 });

  const enemyPack = enemyId ? getCharacterPackById(enemyId) : undefined;
  const enemyIdle = enemyPack?.idle ?? enemyPack?.walk ?? null;
  const poseFrames = sheetFrameCount(poseSheet);
  const idleFrames = sheetFrameCount(playerIdle);
  const enemyFrames = sheetFrameCount(enemyIdle);
  const vfxFrames = vfx
    ? Math.max(1, isSequenceVfx(vfx) ? vfxFrameUrls(vfx).length : vfx.frameCount)
    : 1;
  const skillDurationMs = officialSkillDurationMs(execution);
  const poseResolved = resolvePersistentLoopDuration({
    durationMs: poseSheet?.loopDurationMs,
    untilSkillEnd: poseSheet?.loopUntilSkillEnd,
    skillDurationMs,
  });
  const vfxResolved = resolvePersistentLoopDuration({
    durationMs: vfxLoopDurationMs,
    untilSkillEnd: vfxLoopUntilSkillEnd,
    skillDurationMs,
  });
  const poseLoop = normalizeFrameLoop(poseFrames, {
    mode: poseSheet?.loopMode,
    loop: poseSheet?.loop,
    startFrame: poseSheet?.loopStartFrame,
    endFrame: poseSheet?.loopEndFrame,
    durationMs: poseResolved.durationMs,
    untilSkillEnd: poseResolved.untilSkillEnd,
  });
  const vfxLoop = normalizeFrameLoop(vfxFrames, {
    mode: vfxLoopMode,
    startFrame: vfxLoopStartFrame,
    endFrame: vfxLoopEndFrame,
    durationMs: vfxResolved.durationMs,
    untilSkillEnd: vfxResolved.untilSkillEnd,
  });

  const takeSnapshot = useCallback((): VisualSnapshot => {
    const sheet = characterLabStore.getSnapshot().poseSheet;
    return {
      vfxOffsetX: characterLabStore.getSnapshot().vfxOffsetX,
      vfxOffsetY: characterLabStore.getSnapshot().vfxOffsetY,
      vfxScale: characterLabStore.getSnapshot().vfxScale,
      vfxFlipX: characterLabStore.getSnapshot().vfxFlipX,
      vfxFlipY: characterLabStore.getSnapshot().vfxFlipY,
      vfxLoopMode: characterLabStore.getSnapshot().vfxLoopMode,
      vfxLoopStartFrame: characterLabStore.getSnapshot().vfxLoopStartFrame,
      vfxLoopEndFrame: characterLabStore.getSnapshot().vfxLoopEndFrame,
      poseFlipX: Boolean(sheet?.flipX),
      poseFlipY: Boolean(sheet?.flipY),
      poseLoopMode: sheet?.loopMode ?? (sheet?.loop ? 'full' : 'none'),
      poseLoopStartFrame: sheet?.loopStartFrame ?? 1,
      poseLoopEndFrame: sheet?.loopEndFrame ?? Math.max(1, sheet?.frameCount ?? 1),
    };
  }, []);

  const applySnapshot = (snap: VisualSnapshot) => {
    characterLabStore.setVisual('vfxOffsetX', snap.vfxOffsetX);
    characterLabStore.setVisual('vfxOffsetY', snap.vfxOffsetY);
    characterLabStore.setVisual('vfxScale', snap.vfxScale);
    characterLabStore.setFlag('vfxFlipX', snap.vfxFlipX);
    characterLabStore.setFlag('vfxFlipY', snap.vfxFlipY);
    characterLabStore.setFlag('vfxLoopMode', snap.vfxLoopMode);
    characterLabStore.setVisual('vfxLoopStartFrame', snap.vfxLoopStartFrame);
    characterLabStore.setVisual('vfxLoopEndFrame', snap.vfxLoopEndFrame);
    characterLabStore.patchPoseSheet({
      flipX: snap.poseFlipX,
      flipY: snap.poseFlipY,
      loopMode: snap.poseLoopMode,
      loop: legacyLoopFromMode(snap.poseLoopMode),
      loopStartFrame: snap.poseLoopStartFrame,
      loopEndFrame: snap.poseLoopEndFrame,
    });
  };

  const pushUndo = () => {
    setUndoStack((stack) => [...stack.slice(-40), takeSnapshot()]);
    setRedoStack([]);
  };

  const undo = () => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setRedoStack((redo) => [...redo, takeSnapshot()]);
      applySnapshot(prev);
      return stack.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((undoItems) => [...undoItems, takeSnapshot()]);
      applySnapshot(next);
      return stack.slice(0, -1);
    });
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewTick((n) => n + 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [workspace]);

  useEffect(() => {
    poseFrameRef.current = 0;
    setPoseFrame(0);
  }, [poseSheet?.url, poseSheet?.frames?.join('|')]);

  useEffect(() => {
    vfxFrameRef.current = 0;
    setVfxFrame(0);
  }, [vfxId]);

  useEffect(() => {
    let cancelled = false;
    poseImgRef.current = null;
    poseSeqRef.current = [];
    if (!poseSheet || !labPoseHasContent(poseSheet)) return;
    if (poseSheet.frames?.length) {
      void Promise.all(poseSheet.frames.map((src) => loadImage(src)))
        .then((imgs) => {
          if (!cancelled) poseSeqRef.current = imgs;
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    if (!poseSheet.url) return;
    void loadImage(poseSheet.url).then((img) => {
      if (!cancelled) poseImgRef.current = img;
    });
    return () => {
      cancelled = true;
    };
  }, [poseSheet]);

  useEffect(() => {
    let cancelled = false;
    idleImgRef.current = null;
    if (!playerIdle?.url) return;
    void loadImage(playerIdle.url).then((img) => {
      if (!cancelled) idleImgRef.current = img;
    });
    return () => {
      cancelled = true;
    };
  }, [playerIdle?.url]);

  useEffect(() => {
    let cancelled = false;
    enemyImgRef.current = null;
    if (!enemyIdle?.url) return;
    void loadImage(enemyIdle.url).then((img) => {
      if (!cancelled) enemyImgRef.current = img;
    });
    return () => {
      cancelled = true;
    };
  }, [enemyIdle?.url]);

  useEffect(() => {
    let cancelled = false;
    vfxImgRef.current = null;
    vfxSeqRef.current = [];
    if (!vfx) return;
    const urls = vfxFrameUrls(vfx);
    if (isSequenceVfx(vfx) && urls.length > 0) {
      void Promise.all(urls.map((src) => loadImage(src)))
        .then((imgs) => {
          if (!cancelled) vfxSeqRef.current = imgs;
        })
        .catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }
    if (!vfx.url) return;
    void loadImage(vfx.url).then((img) => {
      if (!cancelled) vfxImgRef.current = img;
    });
    return () => {
      cancelled = true;
    };
  }, [vfx]);

  useEffect(() => {
    if (!playing) return;
    const poseFps = Math.max(0.1, poseSheet?.frameRate ?? playerIdle?.frameRate ?? 8);
    const vfxFps = Math.max(0.1, vfx?.frameRate ?? 12);
    let lastPose = performance.now();
    let lastVfx = lastPose;
    let raf = 0;
    const tick = (now: number) => {
      if (now - lastPose >= 1000 / poseFps) {
        lastPose = now;
        if (poseSheet && labPoseHasContent(poseSheet)) {
          const next = stepFrameLoop(poseLoopStateRef.current, poseFrames, poseLoop, 1000 / poseFps);
          poseLoopStateRef.current = next;
          poseFrameRef.current = next.frameIndex;
          setPoseFrame(next.frameIndex);
          setPosePhase(next.phase);
        } else {
          idleFrameRef.current = (idleFrameRef.current + 1) % idleFrames;
          setIdleFrame(idleFrameRef.current);
        }
        enemyIdleFrameRef.current = (enemyIdleFrameRef.current + 1) % Math.max(1, enemyFrames);
        setEnemyIdleFrame(enemyIdleFrameRef.current);
      }
      if (vfx && now - lastVfx >= 1000 / vfxFps) {
        lastVfx = now;
        const next = stepFrameLoop(vfxLoopStateRef.current, vfxFrames, vfxLoop, 1000 / vfxFps);
        vfxLoopStateRef.current = next;
        vfxFrameRef.current = next.frameIndex;
        setVfxFrame(next.frameIndex);
        setVfxPhase(next.phase);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [
    playing,
    poseSheet,
    poseFrames,
    vfxFrames,
    idleFrames,
    enemyFrames,
    vfx,
    poseLoop,
    vfxLoop,
    playerIdle?.frameRate,
  ]);

  const dummyX = enemyFeetX(distance);

  const layout = useMemo(() => {
    const poseFh = poseSheet?.frameHeight ?? playerIdle?.frameHeight ?? CHARACTER_DISPLAY_HEIGHT;
    const poseFw = poseSheet?.frameWidth ?? playerIdle?.frameWidth ?? 32;
    const bodyWorldH = CHARACTER_DISPLAY_HEIGHT * VSE_PREVIEW_ACTOR_SCALE * (poseSheet?.scaleY ?? 1);
    const origin = vfxOriginGame({
      offsetX: vfxOffsetX,
      offsetY: vfxOffsetY,
      poseOffsetX: poseSheet?.offsetX ?? 0,
      poseOffsetY: poseSheet?.offsetY ?? 0,
      bodyWorldH,
    });
    const fw = vfx?.frameWidth ?? 32;
    const fh = vfx?.frameHeight ?? 32;
    const worldScale = vfx
      ? vfxWorldScale({
          poseFrameHeight: poseFh,
          poseFrameWidth: poseFw,
          vfxFrameWidth: fw,
          vfxFrameHeight: fh,
          vfxScale,
        }) * VSE_PREVIEW_ACTOR_SCALE
      : 1;
    const box = vfx
      ? vfxAabbGame({
          originX: origin.x,
          originY: origin.y,
          frameWidth: fw,
          frameHeight: fh,
          worldScale,
        })
      : null;
    const hit = box ? expandHitBox(box) : null;
    return { poseFw, poseFh, bodyWorldH, origin, fw, fh, worldScale, box, hit };
  }, [poseSheet, playerIdle, vfx, vfxOffsetX, vfxOffsetY, vfxScale]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const viewW = Math.max(1, wrap.clientWidth);
    const viewH = Math.max(1, wrap.clientHeight);
    const fit = vseViewFit(viewW, viewH, zoom);
    fitRef.current = fit;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#3a3e45';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.offsetX, dpr * fit.offsetY);
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#4a4f58';
    ctx.fillRect(0, 0, VSE_STAGE_WIDTH, VSE_STAGE_HEIGHT);
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1 / fit.scale;
      for (let x = 0; x <= VSE_STAGE_WIDTH; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, VSE_STAGE_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= VSE_STAGE_HEIGHT; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VSE_STAGE_WIDTH, y);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#d8c48a';
    ctx.lineWidth = 3 / fit.scale;
    ctx.beginPath();
    ctx.moveTo(24, VSE_GROUND_Y);
    ctx.lineTo(VSE_STAGE_WIDTH - 24, VSE_GROUND_Y);
    ctx.stroke();
    ctx.fillStyle = '#f0e6c8';
    ctx.font = `${14 / fit.scale}px sans-serif`;
    ctx.fillText('GROUND', 28, VSE_GROUND_Y - 8);

    const drawActor = (
      sheet: SpriteSheetDef | LabPoseSheet,
      img: HTMLImageElement | null,
      seq: HTMLImageElement[] | null,
      frame: number,
      feetX: number,
      label: string,
      flipX: boolean,
      flipY: boolean,
    ) => {
      const fw = sheet.frameWidth || layout.poseFw;
      const fh = sheet.frameHeight || layout.poseFh;
      const sx = characterDrawScale(fh) * VSE_PREVIEW_ACTOR_SCALE * (('scaleX' in sheet ? sheet.scaleX : 1) ?? 1);
      const sy = characterDrawScale(fh) * VSE_PREVIEW_ACTOR_SCALE * (('scaleY' in sheet ? sheet.scaleY : 1) ?? 1);
      const dw = fw * sx;
      const dh = fh * sy;
      const ox = 'offsetX' in sheet ? (sheet.offsetX ?? 0) : 0;
      const oy = 'offsetY' in sheet ? (sheet.offsetY ?? 0) : 0;
      const cx = feetX + ox;
      const cy = VSE_GROUND_Y + oy - dh / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      const dx = -dw / 2;
      const dy = -dh / 2;
      if (seq && seq.length && 'frames' in sheet && sheet.frames?.length) {
        const frameImg = seq[frame];
        if (frameImg) ctx.drawImage(frameImg, 0, 0, frameImg.naturalWidth, frameImg.naturalHeight, dx, dy, dw, dh);
      } else {
        drawSheetFrame(ctx, img, frame, fw, fh, dx, dy, dw, dh);
      }
      ctx.restore();
      ctx.fillStyle = '#e8f0ff';
      ctx.font = `${13 / fit.scale}px sans-serif`;
      ctx.fillText(label, cx - 24, VSE_GROUND_Y + oy - dh - 8);
    };

    const usePose = Boolean(poseSheet && labPoseHasContent(poseSheet));
    if (usePose && poseSheet) {
      drawActor(
        poseSheet,
        poseImgRef.current,
        poseSeqRef.current,
        poseFrame,
        VSE_CHAR_FEET_X,
        'PLAYER',
        Boolean(poseSheet.flipX),
        Boolean(poseSheet.flipY),
      );
    } else if (playerIdle) {
      drawActor(playerIdle, idleImgRef.current, null, idleFrame, VSE_CHAR_FEET_X, 'PLAYER', false, false);
    }
    if (enemyIdle) {
      drawActor(enemyIdle, enemyImgRef.current, null, enemyIdleFrame, dummyX, 'ENEMY', true, false);
    } else {
      const dummyH = CHARACTER_DISPLAY_HEIGHT * VSE_PREVIEW_ACTOR_SCALE;
      ctx.fillStyle = '#7a5555';
      ctx.fillRect(dummyX - 14, VSE_GROUND_Y - dummyH, 28, dummyH);
      ctx.fillStyle = '#f0e6c8';
      ctx.fillText('ENEMY', dummyX - 22, VSE_GROUND_Y - dummyH - 10);
    }

    if (vfx && layout.box) {
      const { box, origin } = layout;
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.scale(vfxFlipX ? -1 : 1, vfxFlipY ? -1 : 1);
      const dx = -box.w / 2;
      const dy = -box.h / 2;
      if (vfxSeqRef.current.length) {
        const img = vfxSeqRef.current[vfxFrame];
        if (img) ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, box.w, box.h);
      } else {
        drawSheetFrame(ctx, vfxImgRef.current, vfxFrame, layout.fw, layout.fh, dx, dy, box.w, box.h);
      }
      ctx.restore();
      const hit = layout.hit ?? box;
      if (showHitDebug) {
        ctx.strokeStyle = hovered || selected ? '#ff4d4d' : 'rgba(255,80,80,0.55)';
        ctx.lineWidth = (hovered || selected ? 3 : 2) / fit.scale;
        ctx.strokeRect(hit.x, hit.y, hit.w, hit.h);
      }
      if (selected) {
        ctx.strokeStyle = '#f0d878';
        ctx.lineWidth = 2 / fit.scale;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = '#f0d878';
        ctx.font = `${14 / fit.scale}px sans-serif`;
        ctx.fillText(`VFX — ${vfx.name}`, box.x, box.y - 6);
      }
      ctx.fillStyle = '#66d4ff';
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, 4 / fit.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [
    zoom,
    showGrid,
    showHitDebug,
    poseSheet,
    poseFrame,
    idleFrame,
    enemyIdleFrame,
    playerIdle,
    enemyIdle,
    dummyX,
    vfx,
    vfxFrame,
    selected,
    hovered,
    layout,
    vfxFlipX,
    vfxFlipY,
    viewTick,
    workspace,
  ]);

  useEffect(() => {
    paint();
  }, [paint]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'edit') return;
    wrapRef.current?.focus();
    const rect = event.currentTarget.getBoundingClientRect();
    const p = pointerToStage(event.clientX, event.clientY, rect, fitRef.current);
    const hit = layout.hit;
    if (vfx && hit && pointInAabb(p.x, p.y, hit)) {
      selectedRef.current = true;
      setSelected(true);
      pushUndo();
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: vfxOffsetX,
        originY: vfxOffsetY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      selectedRef.current = false;
      setSelected(false);
      dragRef.current = null;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const p = pointerToStage(event.clientX, event.clientY, rect, fitRef.current);
    const over = Boolean(layout.hit && pointInAabb(p.x, p.y, layout.hit));
    setHovered(over);
    if (mode !== 'edit' || !dragRef.current || !selectedRef.current) return;
    const delta = deltaToStage(
      event.clientX - dragRef.current.startX,
      event.clientY - dragRef.current.startY,
      fitRef.current,
    );
    const nextX = snapGameValue(dragRef.current.originX + delta.x, snap);
    const nextY = snapGameValue(dragRef.current.originY + delta.y, snap);
    characterLabStore.setVisual('vfxOffsetX', nextX);
    characterLabStore.setVisual('vfxOffsetY', nextY);
    setDebugLine(
      `screenΔ ${Math.round(event.clientX - dragRef.current.startX)},${Math.round(event.clientY - dragRef.current.startY)}  gameΔ ${delta.x.toFixed(1)},${delta.y.toFixed(1)}  offset ${nextX},${nextY}  fit ${fitRef.current.scale.toFixed(3)}`,
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const stepFrame = (which: 'pose' | 'vfx', dir: -1 | 1) => {
    setPlaying(false);
    if (which === 'pose') {
      const next = Math.max(0, Math.min(poseFrames - 1, poseFrameRef.current + dir));
      poseFrameRef.current = next;
      poseLoopStateRef.current = { ...poseLoopStateRef.current, frameIndex: next };
      setPoseFrame(next);
    } else {
      const next = Math.max(0, Math.min(vfxFrames - 1, vfxFrameRef.current + dir));
      vfxFrameRef.current = next;
      vfxLoopStateRef.current = { ...vfxLoopStateRef.current, frameIndex: next };
      setVfxFrame(next);
    }
  };

  const setVfxLoop = (modeValue: FrameLoopMode) => {
    pushUndo();
    characterLabStore.setFlag('vfxLoopMode', modeValue);
    const range = clampLoopRange(vfxFrames, vfxLoopStartFrame, vfxLoopEndFrame);
    characterLabStore.setVisual('vfxLoopStartFrame', range.startFrame);
    characterLabStore.setVisual('vfxLoopEndFrame', range.endFrame);
  };

  const setPoseLoop = (modeValue: FrameLoopMode) => {
    pushUndo();
    const range = clampLoopRange(poseFrames, poseSheet?.loopStartFrame ?? 1, poseSheet?.loopEndFrame ?? poseFrames);
    characterLabStore.patchPoseSheet({
      loopMode: modeValue,
      loop: legacyLoopFromMode(modeValue),
      loopStartFrame: range.startFrame,
      loopEndFrame: range.endFrame,
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!workspace) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const stage = (
    <div ref={wrapRef} className="vse__stage-wrap" tabIndex={0} aria-label="Hunt preview">
      <canvas
        ref={canvasRef}
        className="vse__canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );

  const assets = (
    <aside className="vse__col">
      <h3>ASSETS</h3>
      <p>Pose: {poseSheet?.key || 'idle'}</p>
      <p>VFX: {vfx?.name || 'nenhum'}</p>
      <label>
        Enemy preview
        <select value={enemyId} onChange={(event) => setEnemyId(event.target.value)}>
          <option value="">Dummy</option>
          {packs.map((pack) => (
            <option key={pack.id} value={pack.id}>
              {pack.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Target distance
        <input
          type="range"
          min={VSE_DISTANCE_MIN}
          max={VSE_DISTANCE_MAX}
          value={distance}
          onChange={(event) => setDistance(Number(event.target.value))}
        />
      </label>
      <div>
        <button type="button" onClick={() => setDistance(VSE_DISTANCE_PRESETS.near)}>
          Near
        </button>
        <button type="button" onClick={() => setDistance(VSE_DISTANCE_PRESETS.medium)}>
          Medium
        </button>
        <button type="button" onClick={() => setDistance(VSE_DISTANCE_PRESETS.far)}>
          Far
        </button>
      </div>
      <LoopPanel
        title="Pose loop"
        mode={poseLoop.mode}
        start={poseLoop.startFrame}
        end={poseLoop.endFrame}
        total={poseFrames}
        current={poseFrame}
        phase={posePhase}
        remainingMs={
          posePhase === 'persistent-loop' && poseLoop.mode === 'persistent-range'
            ? Math.max(0, (poseLoop.durationMs ?? 0) - poseLoopStateRef.current.loopElapsedMs)
            : null
        }
        durationMs={poseSheet?.loopDurationMs ?? 3000}
        untilSkillEnd={Boolean(poseSheet?.loopUntilSkillEnd)}
        onMode={setPoseLoop}
        onStart={(value) => {
          pushUndo();
          characterLabStore.patchPoseSheet({ loopStartFrame: value, loopMode: 'persistent-range', loop: true });
        }}
        onEnd={(value) => {
          pushUndo();
          characterLabStore.patchPoseSheet({ loopEndFrame: value, loopMode: 'persistent-range', loop: true });
        }}
        onDuration={(value) => {
          pushUndo();
          characterLabStore.patchPoseSheet({ loopDurationMs: value });
        }}
        onUntilSkillEnd={(value) => {
          pushUndo();
          characterLabStore.patchPoseSheet({ loopUntilSkillEnd: value });
        }}
        onSeek={(zero) => {
          setPlaying(false);
          poseFrameRef.current = zero;
          poseLoopStateRef.current = { ...poseLoopStateRef.current, frameIndex: zero };
          setPoseFrame(zero);
        }}
      />
      <LoopPanel
        title="VFX loop"
        mode={vfxLoop.mode}
        start={vfxLoop.startFrame}
        end={vfxLoop.endFrame}
        total={vfxFrames}
        current={vfxFrame}
        phase={vfxPhase}
        remainingMs={
          vfxPhase === 'persistent-loop' && vfxLoop.mode === 'persistent-range'
            ? Math.max(0, (vfxLoop.durationMs ?? 0) - vfxLoopStateRef.current.loopElapsedMs)
            : null
        }
        durationMs={vfxLoopDurationMs}
        untilSkillEnd={vfxLoopUntilSkillEnd}
        onMode={setVfxLoop}
        onStart={(value) => {
          pushUndo();
          characterLabStore.setVisual('vfxLoopStartFrame', value);
          characterLabStore.setFlag('vfxLoopMode', 'persistent-range');
        }}
        onEnd={(value) => {
          pushUndo();
          characterLabStore.setVisual('vfxLoopEndFrame', value);
          characterLabStore.setFlag('vfxLoopMode', 'persistent-range');
        }}
        onDuration={(value) => {
          pushUndo();
          characterLabStore.setVisual('vfxLoopDurationMs', value);
        }}
        onUntilSkillEnd={(value) => {
          pushUndo();
          characterLabStore.setFlag('vfxLoopUntilSkillEnd', value);
        }}
        onSeek={(zero) => {
          setPlaying(false);
          vfxFrameRef.current = zero;
          vfxLoopStateRef.current = { ...vfxLoopStateRef.current, frameIndex: zero };
          setVfxFrame(zero);
        }}
      />
    </aside>
  );

  const props = (
    <aside className="vse__col">
      <h3>PROPERTIES</h3>
      <p>
        <strong>SELECTED</strong>
        <br />
        {selected && vfx ? `VFX — ${vfx.name}` : '— clique no retângulo do VFX'}
      </p>
      <label>
        X
        <input
          type="number"
          value={vfxOffsetX}
          onChange={(event) => characterLabStore.setVisual('vfxOffsetX', Number(event.target.value) || 0)}
        />
      </label>
      <label>
        Y
        <input
          type="number"
          value={vfxOffsetY}
          onChange={(event) => characterLabStore.setVisual('vfxOffsetY', Number(event.target.value) || 0)}
        />
      </label>
      <label>
        Scale
        <input
          type="number"
          step={0.05}
          value={vfxScale}
          onChange={(event) => characterLabStore.setVisual('vfxScale', Number(event.target.value) || 1)}
        />
      </label>
      <div>
        Mirror VFX
        <button
          type="button"
          onClick={() => {
            pushUndo();
            characterLabStore.setFlag('vfxFlipX', !vfxFlipX);
          }}
        >
          Flip X {vfxFlipX ? 'ON' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => {
            pushUndo();
            characterLabStore.setFlag('vfxFlipY', !vfxFlipY);
          }}
        >
          Flip Y {vfxFlipY ? 'ON' : 'off'}
        </button>
      </div>
      <div>
        Mirror Pose
        <button
          type="button"
          onClick={() => {
            pushUndo();
            characterLabStore.patchPoseSheet({ flipX: !poseSheet?.flipX });
          }}
        >
          Pose Flip X {poseSheet?.flipX ? 'ON' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => {
            pushUndo();
            characterLabStore.patchPoseSheet({ flipY: !poseSheet?.flipY });
          }}
        >
          Pose Flip Y {poseSheet?.flipY ? 'ON' : 'off'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          pushUndo();
          characterLabStore.setVisual('vfxOffsetX', originals.vfxOffsetX);
          characterLabStore.setVisual('vfxOffsetY', originals.vfxOffsetY);
        }}
      >
        Reset Position
      </button>
      <button
        type="button"
        onClick={() => {
          pushUndo();
          characterLabStore.setVisual('vfxScale', originals.vfxScale);
        }}
      >
        Reset Scale
      </button>
      <button
        type="button"
        onClick={() => {
          pushUndo();
          characterLabStore.setFlag('vfxFlipX', originals.vfxFlipX);
          characterLabStore.setFlag('vfxFlipY', originals.vfxFlipY);
        }}
      >
        Reset Flip
      </button>
      <label>
        <input type="checkbox" checked={showHitDebug} onChange={(event) => setShowHitDebug(event.target.checked)} />
        Debug hit area
      </label>
      {debugLine ? <p className="vse__debug">{debugLine}</p> : null}
    </aside>
  );

  const bar = (
    <div className="vse__bar">
      <button type="button" onClick={() => setMode('edit')} disabled={mode === 'edit'}>
        EDIT
      </button>
      <button
        type="button"
        onClick={() => {
          poseLoopStateRef.current = createFrameLoopState();
          vfxLoopStateRef.current = createFrameLoopState();
          poseFrameRef.current = 0;
          vfxFrameRef.current = 0;
          setPoseFrame(0);
          setVfxFrame(0);
          setPosePhase('first-pass');
          setVfxPhase('first-pass');
          setPlaying(true);
        }}
      >
        PLAY
      </button>
      <button type="button" onClick={() => setPlaying(false)}>
        PAUSE
      </button>
      <button type="button" onClick={() => stepFrame('vfx', -1)}>
        FRAME PREV
      </button>
      <button type="button" onClick={() => stepFrame('vfx', 1)}>
        FRAME NEXT
      </button>
      <label>
        Zoom
        <select value={zoom} onChange={(event) => setZoom(Number(event.target.value) as VseZoom)}>
          {VSE_ZOOM_PRESETS.map((value) => (
            <option key={value} value={value}>
              {Math.round(value * 100)}%
            </option>
          ))}
        </select>
      </label>
      <label>
        Snap
        <select value={snap} onChange={(event) => setSnap(Number(event.target.value) as VseSnap)}>
          {VSE_SNAP_PRESETS.map((value) => (
            <option key={value} value={value}>
              {value === 0 ? 'Livre' : `${value}px`}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
        GRID
      </label>
      <button type="button" onClick={undo}>
        Undo
      </button>
      <button type="button" onClick={redo}>
        Redo
      </button>
      <button
        type="button"
        className="character-lab__run-btn"
        onClick={() => {
          setMode('play');
          poseLoopStateRef.current = createFrameLoopState();
          vfxLoopStateRef.current = createFrameLoopState();
          poseFrameRef.current = 0;
          vfxFrameRef.current = 0;
          setPoseFrame(0);
          setVfxFrame(0);
          setPosePhase('first-pass');
          setVfxPhase('first-pass');
          setPlaying(true);
          characterLabStore.playCompleteSkill();
          const poseFps = Math.max(0.1, poseSheet?.frameRate ?? 8);
          const vfxFps = Math.max(0.1, vfx?.frameRate ?? 12);
          const firstMs = Math.max(
            poseSheet && labPoseHasContent(poseSheet) ? (poseFrames / poseFps) * 1000 : 0,
            vfx ? (vfxFrames / vfxFps) * 1000 : 0,
          );
          const loopMs = Math.max(
            poseLoop.mode === 'persistent-range' ? poseResolved.durationMs : 0,
            vfxLoop.mode === 'persistent-range' ? vfxResolved.durationMs : 0,
          );
          window.setTimeout(() => setMode('edit'), Math.max(1800, Math.round(firstMs + loopMs + 400)));
        }}
      >
        TESTAR
      </button>
      <button type="button" className="character-lab__save-btn" disabled={!canSave || saveBusy} onClick={onSave}>
        {saveBusy ? 'Salvando…' : 'SALVAR'}
      </button>
      <span>
        Pose {poseFrame + 1}/{poseFrames} · VFX {vfxFrame + 1}/{vfxFrames}
      </span>
    </div>
  );

  const shell = (
    <div className={`vse${workspace ? ' vse--workspace' : ''}`}>
      <header className="vse__head">
        <strong>Visual Skill Editor — {skillName}</strong>
        <span className={`vse__mode${mode === 'play' ? ' is-play' : ''}`}>{mode.toUpperCase()}</span>
        {workspace ? (
          <button type="button" onClick={() => setWorkspace(false)}>
            FECHAR
          </button>
        ) : (
          <button type="button" className="character-lab__run-btn" onClick={() => setWorkspace(true)}>
            Abrir editor
          </button>
        )}
      </header>
      {workspace ? (
        <>
          <div className="vse__workspace-grid">
            {assets}
            <div className="vse__preview">{stage}</div>
            {props}
          </div>
          {bar}
        </>
      ) : (
        <p>Abre o workspace para a arena Hunt (65–75% da tela). Clique no retângulo vermelho do VFX para selecionar.</p>
      )}
    </div>
  );

  if (!workspace) return shell;
  return createPortal(<div className="vse-portal">{shell}</div>, document.body);
}

function LoopPanel({
  title,
  mode,
  start,
  end,
  total,
  current,
  phase,
  remainingMs,
  durationMs,
  untilSkillEnd,
  onMode,
  onStart,
  onEnd,
  onDuration,
  onUntilSkillEnd,
  onSeek,
}: {
  title: string;
  mode: FrameLoopMode;
  start: number;
  end: number;
  total: number;
  current: number;
  phase: FrameLoopPhase;
  remainingMs: number | null;
  durationMs: number;
  untilSkillEnd: boolean;
  onMode: (mode: FrameLoopMode) => void;
  onStart: (value: number) => void;
  onEnd: (value: number) => void;
  onDuration: (value: number) => void;
  onUntilSkillEnd: (value: boolean) => void;
  onSeek: (zeroBased: number) => void;
}) {
  const range = clampLoopRange(total, start, end);
  const persistent = mode === 'persistent-range';
  return (
    <fieldset className="vse__loop">
      <legend>{title}</legend>
      {FRAME_LOOP_MODES.map((value) => (
        <label key={value}>
          <input type="radio" checked={mode === value} onChange={() => onMode(value)} />
          {value === 'none' ? 'No Loop' : value === 'full' ? 'Full Loop' : 'Persistent Frame Loop'}
        </label>
      ))}
      <p>
        {phase === 'first-pass' ? 'FIRST PASS' : phase === 'persistent-loop' ? 'PERSISTENT LOOP' : 'DONE'}
        {remainingMs != null && persistent ? ` · restam ${(remainingMs / 1000).toFixed(1)}s` : ''}
      </p>
      {persistent ? (
        <>
          <label>
            Loop Start Frame
            <input
              type="number"
              min={1}
              max={total}
              value={range.startFrame}
              onChange={(event) =>
                onStart(clampLoopRange(total, Number(event.target.value) || 1, range.endFrame).startFrame)
              }
            />
          </label>
          <label>
            Loop End Frame
            <input
              type="number"
              min={1}
              max={total}
              value={range.endFrame}
              onChange={(event) =>
                onEnd(clampLoopRange(total, range.startFrame, Number(event.target.value) || total).endFrame)
              }
            />
          </label>
          <button type="button" onClick={() => onStart(current + 1)}>
            SET LOOP START
          </button>
          <button type="button" onClick={() => onEnd(current + 1)}>
            SET LOOP END
          </button>
          <label>
            Loop Duration (ms)
            <input
              type="number"
              min={0}
              step={100}
              value={durationMs}
              disabled={untilSkillEnd}
              onChange={(event) => onDuration(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={untilSkillEnd}
              onChange={(event) => onUntilSkillEnd(event.target.checked)}
            />
            Loop until skill ends
          </label>
        </>
      ) : null}
      <div className="vse__strip">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`${i === current ? 'is-current' : ''} ${
              persistent && i + 1 >= range.startFrame && i + 1 <= range.endFrame ? 'is-loop' : ''
            }`}
            onClick={() => onSeek(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
