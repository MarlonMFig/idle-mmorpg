/** Arte dos Modos Sennin (níveis 1–3). */

export const HERITAGE_SENNIN_STAGE_COUNT = 3;

export const HERITAGE_SENNIN_ICONS: Readonly<
  Record<string, Readonly<Partial<Record<1 | 2 | 3, string>>>>
> = {
  "sennin-sapo": {
    1: "/ui/heritage/sennin/sennin-sapo/1.png",
    2: "/ui/heritage/sennin/sennin-sapo/2.png",
    3: "/ui/heritage/sennin/sennin-sapo/3.png",
  },
  "sennin-lesma": {
    1: "/ui/heritage/sennin/sennin-lesma/1.png",
    2: "/ui/heritage/sennin/sennin-lesma/2.png",
    3: "/ui/heritage/sennin/sennin-lesma/3.png",
  },
};

/** Ícone do modo sennin no nível atual (1–3). */
export function getHeritageSenninIcon(
  senninId: string | null | undefined,
  level = 1,
): string | null {
  if (!senninId) return null;
  const row = HERITAGE_SENNIN_ICONS[senninId];
  if (!row) return null;
  const stage = Math.max(
    1,
    Math.min(HERITAGE_SENNIN_STAGE_COUNT, Math.floor(level)),
  ) as 1 | 2 | 3;
  return row[stage] ?? row[3] ?? row[2] ?? row[1] ?? null;
}
