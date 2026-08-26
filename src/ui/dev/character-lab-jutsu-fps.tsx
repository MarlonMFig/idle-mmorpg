'use client';

import { labPoseHasContent, poseDurationMs } from '@/lib/dev/lab-pose-sheet';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';
import { ValueRow } from '@/ui/dev/character-lab-value-row';

export const JUTSU_FPS_PRESETS = [6, 8, 10, 12, 15, 18, 24, 30, 36, 48] as const;

export function CharacterLabJutsuFps({ disabled = false }: { disabled?: boolean }) {
  const poseSheet = useStore(characterLabStore, (s) => s.poseSheet);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const hasPose = labPoseHasContent(poseSheet);
  const frameRate = poseSheet?.frameRate ?? originals.poseSheet?.frameRate ?? 12;
  const originalFps = originals.poseSheet?.frameRate ?? 12;
  const frameCount = Math.max(1, poseSheet?.frames?.length || poseSheet?.frameCount || 1);
  const durationMs = poseDurationMs(poseSheet ?? originals.poseSheet);

  return (
    <>
      <h4>VELOCIDADE DO JUTSU (FPS)</h4>
      <ValueRow
        label="FPS"
        original={originalFps}
        value={frameRate}
        presets={[...JUTSU_FPS_PRESETS]}
        step={1}
        disabled={disabled || !hasPose}
        onChange={(value) =>
          characterLabStore.patchPoseSheet({ frameRate: Math.max(1, Math.round(value)) })
        }
      />
      {hasPose ? (
        <p className="character-lab__hint">
          FPS maior = animação mais rápida · {frameCount} frames · {(durationMs / 1000).toFixed(2)}s
        </p>
      ) : (
        <p className="character-lab__hint">
          Selecione ou importe uma pose na aba VFX para ajustar o FPS do jutsu.
        </p>
      )}
    </>
  );
}
