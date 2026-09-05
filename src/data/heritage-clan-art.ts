/** Gerado por scripts/install-heritage-clan-art.js — não editar à mão. */

export const HERITAGE_CLAN_ICONS: Readonly<Record<string, string>> = {
  "cla-aburame": "/ui/heritage/clans/cla-aburame.png",
  "cla-akimichi": "/ui/heritage/clans/cla-akimichi.png",
  "cla-hyuga": "/ui/heritage/clans/cla-hyuga.png",
  "cla-inuzuka": "/ui/heritage/clans/cla-inuzuka.png",
  "cla-kaguya": "/ui/heritage/clans/cla-kaguya.png",
  "cla-namikaze": "/ui/heritage/clans/cla-namikaze.png",
  "cla-nara": "/ui/heritage/clans/cla-nara.png",
  "cla-senju": "/ui/heritage/clans/cla-senju.png",
  "cla-uchiha": "/ui/heritage/clans/cla-uchiha.png",
  "cla-uzumaki": "/ui/heritage/clans/cla-uzumaki.png",
  "cla-yamanaka": "/ui/heritage/clans/cla-yamanaka.png",
  "cla-yuki": "/ui/heritage/clans/cla-yuki.png",
};

export const HERITAGE_CLAN_LEVEL_ICONS: Readonly<Record<string, readonly [string, string, string, string, string]>> = {
  "cla-aburame": ["/ui/heritage/clan-levels/cla-aburame/1.png", "/ui/heritage/clan-levels/cla-aburame/2.png", "/ui/heritage/clan-levels/cla-aburame/3.png", "/ui/heritage/clan-levels/cla-aburame/4.png", "/ui/heritage/clan-levels/cla-aburame/5.png"],
  "cla-akimichi": ["/ui/heritage/clan-levels/cla-akimichi/1.png", "/ui/heritage/clan-levels/cla-akimichi/2.png", "/ui/heritage/clan-levels/cla-akimichi/3.png", "/ui/heritage/clan-levels/cla-akimichi/4.png", "/ui/heritage/clan-levels/cla-akimichi/5.png"],
  "cla-hyuga": ["/ui/heritage/clan-levels/cla-hyuga/1.png", "/ui/heritage/clan-levels/cla-hyuga/2.png", "/ui/heritage/clan-levels/cla-hyuga/3.png", "/ui/heritage/clan-levels/cla-hyuga/4.png", "/ui/heritage/clan-levels/cla-hyuga/5.png"],
  "cla-inuzuka": ["/ui/heritage/clan-levels/cla-inuzuka/1.png", "/ui/heritage/clan-levels/cla-inuzuka/2.png", "/ui/heritage/clan-levels/cla-inuzuka/3.png", "/ui/heritage/clan-levels/cla-inuzuka/4.png", "/ui/heritage/clan-levels/cla-inuzuka/5.png"],
  "cla-kaguya": ["/ui/heritage/clan-levels/cla-kaguya/1.png", "/ui/heritage/clan-levels/cla-kaguya/2.png", "/ui/heritage/clan-levels/cla-kaguya/3.png", "/ui/heritage/clan-levels/cla-kaguya/4.png", "/ui/heritage/clan-levels/cla-kaguya/5.png"],
  "cla-namikaze": ["/ui/heritage/clan-levels/cla-namikaze/1.png", "/ui/heritage/clan-levels/cla-namikaze/2.png", "/ui/heritage/clan-levels/cla-namikaze/3.png", "/ui/heritage/clan-levels/cla-namikaze/4.png", "/ui/heritage/clan-levels/cla-namikaze/5.png"],
  "cla-nara": ["/ui/heritage/clan-levels/cla-nara/1.png", "/ui/heritage/clan-levels/cla-nara/2.png", "/ui/heritage/clan-levels/cla-nara/3.png", "/ui/heritage/clan-levels/cla-nara/4.png", "/ui/heritage/clan-levels/cla-nara/5.png"],
  "cla-senju": ["/ui/heritage/clan-levels/cla-senju/1.png", "/ui/heritage/clan-levels/cla-senju/2.png", "/ui/heritage/clan-levels/cla-senju/3.png", "/ui/heritage/clan-levels/cla-senju/4.png", "/ui/heritage/clan-levels/cla-senju/5.png"],
  "cla-uchiha": ["/ui/heritage/clan-levels/cla-uchiha/1.png", "/ui/heritage/clan-levels/cla-uchiha/2.png", "/ui/heritage/clan-levels/cla-uchiha/3.png", "/ui/heritage/clan-levels/cla-uchiha/4.png", "/ui/heritage/clan-levels/cla-uchiha/5.png"],
  "cla-uzumaki": ["/ui/heritage/clan-levels/cla-uzumaki/1.png", "/ui/heritage/clan-levels/cla-uzumaki/2.png", "/ui/heritage/clan-levels/cla-uzumaki/3.png", "/ui/heritage/clan-levels/cla-uzumaki/4.png", "/ui/heritage/clan-levels/cla-uzumaki/5.png"],
  "cla-yamanaka": ["/ui/heritage/clan-levels/cla-yamanaka/1.png", "/ui/heritage/clan-levels/cla-yamanaka/2.png", "/ui/heritage/clan-levels/cla-yamanaka/3.png", "/ui/heritage/clan-levels/cla-yamanaka/4.png", "/ui/heritage/clan-levels/cla-yamanaka/5.png"],
  "cla-yuki": ["/ui/heritage/clan-levels/cla-yuki/1.png", "/ui/heritage/clan-levels/cla-yuki/2.png", "/ui/heritage/clan-levels/cla-yuki/3.png", "/ui/heritage/clan-levels/cla-yuki/4.png", "/ui/heritage/clan-levels/cla-yuki/5.png"],
};

export function getHeritageClanIcon(clanId: string | null | undefined): string | null {
  if (!clanId) return null;
  return HERITAGE_CLAN_ICONS[clanId] ?? null;
}

export function getHeritageClanLevelIcon(clanId: string | null | undefined, level: number): string | null {
  if (!clanId) return null;
  const row = HERITAGE_CLAN_LEVEL_ICONS[clanId];
  if (!row) return null;
  const idx = Math.max(1, Math.min(5, Math.floor(level))) - 1;
  return row[idx] ?? null;
}
