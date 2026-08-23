'use client';

import { useEffect, useState } from 'react';
import { onGameToast, type GameToastPayload } from '@/lib/game-toast';

/**
 * Fila única Achievement + Mission — não pausa Hunt.
 */
export function AchievementToastHost() {
  const [current, setCurrent] = useState<GameToastPayload | null>(null);

  useEffect(() => {
    return onGameToast((payload) => {
      setCurrent(payload);
      window.setTimeout(() => {
        setCurrent((prev) => (prev?.id === payload.id ? null : prev));
      }, 2000);
    });
  }, []);

  if (!current) return null;

  return (
    <div className="achv-toast" role="status" aria-live="polite">
      <p className="achv-toast__label">
        {current.kind === 'mission' ? 'Missão Concluída' : 'Conquista Desbloqueada'}
      </p>
      <p className="achv-toast__name">{current.name}</p>
    </div>
  );
}
