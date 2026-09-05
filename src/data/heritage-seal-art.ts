/** GIFs dos Selos Amaldiçoados (estágios 1–3; Sol ainda sem arte). */

export const HERITAGE_SEAL_STAGE_COUNT = 3;

export const HERITAGE_SEAL_ICONS: Readonly<
  Record<string, Readonly<Partial<Record<1 | 2 | 3, string>>>>
> = {
  "seal-ceu": {
    1: "/ui/heritage/seals/seal-ceu/1.gif",
    2: "/ui/heritage/seals/seal-ceu/2.gif",
    3: "/ui/heritage/seals/seal-ceu/3.gif",
  },
  "seal-terra": {
    1: "/ui/heritage/seals/seal-terra/1.gif",
    2: "/ui/heritage/seals/seal-terra/2.gif",
    3: "/ui/heritage/seals/seal-terra/3.gif",
  },
  "seal-lua": {
    1: "/ui/heritage/seals/seal-lua/1.gif",
    2: "/ui/heritage/seals/seal-lua/2.gif",
    3: "/ui/heritage/seals/seal-lua/3.gif",
  },
};

/** Ícone do selo no nível atual (1–3). */
export function getHeritageSealIcon(
  sealId: string | null | undefined,
  level = 1,
): string | null {
  if (!sealId) return null;
  const row = HERITAGE_SEAL_ICONS[sealId];
  if (!row) return null;
  const stage = Math.max(
    1,
    Math.min(HERITAGE_SEAL_STAGE_COUNT, Math.floor(level)),
  ) as 1 | 2 | 3;
  return row[stage] ?? row[3] ?? row[2] ?? row[1] ?? null;
}
