/** GIFs dos Portões do Chakra (1–8). */

export const HERITAGE_GATE_ICONS: Readonly<Record<number, string>> = {
  1: "/ui/heritage/gates/1.gif",
  2: "/ui/heritage/gates/2.gif",
  3: "/ui/heritage/gates/3.gif",
  4: "/ui/heritage/gates/4.gif",
  5: "/ui/heritage/gates/5.gif",
  6: "/ui/heritage/gates/6.gif",
  7: "/ui/heritage/gates/7.gif",
  8: "/ui/heritage/gates/8.gif",
};

export function getHeritageGateIcon(level: number): string | null {
  const n = Math.max(1, Math.min(8, Math.floor(level)));
  return HERITAGE_GATE_ICONS[n] ?? null;
}
