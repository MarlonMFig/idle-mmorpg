export type HubEffectKind = 'smoke' | 'birds';

export interface HubSmokeEffect {
  id: string;
  kind: 'smoke';
  label: string;
  enabled: boolean;
  x: number;
  y: number;
}

export interface HubBirdsEffect {
  id: string;
  kind: 'birds';
  label: string;
  enabled: boolean;
}

export type HubEffect = HubSmokeEffect | HubBirdsEffect;

/** Efeitos ambientais do hub Konoha (8192×4320). Editável no Dev Lab → MAPAS. */
export const HUB_EFFECTS: readonly HubEffect[] = [
  {
    id: 'forge-chimney-smoke',
    kind: 'smoke',
    label: 'Fumaça — Forja',
    enabled: true,
    x: 6660,
    y: 2500,
  },
  {
    id: 'sky-birds',
    kind: 'birds',
    label: 'Pássaros',
    enabled: true,
  },
] as const;

export function cloneHubEffects(effects: readonly HubEffect[]): HubEffect[] {
  return effects.map((entry) =>
    entry.kind === 'smoke'
      ? { ...entry, x: entry.x, y: entry.y }
      : { ...entry },
  );
}

export function isHubSmokeEffect(entry: HubEffect): entry is HubSmokeEffect {
  return entry.kind === 'smoke';
}

export function isHubBirdsEffect(entry: HubEffect): entry is HubBirdsEffect {
  return entry.kind === 'birds';
}
