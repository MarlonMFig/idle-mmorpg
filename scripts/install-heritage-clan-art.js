/**
 * Instala ícones de clã e níveis 1–5 da Herança.
 *
 * Uso:
 *   node scripts/install-heritage-clan-art.js
 *   node scripts/install-heritage-clan-art.js --clans "..." --levels "..."
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CLANS = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "SPRITES JOGO",
  "Clãs"
);
const DEFAULT_LEVELS = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "SPRITES JOGO",
  "Nivel 1 a 5 Imagens"
);

const OUT_CLANS = path.join(ROOT, "public", "ui", "heritage", "clans");
const OUT_LEVELS = path.join(ROOT, "public", "ui", "heritage", "clan-levels");
const ASSETS_CLANS = path.join(ROOT, "assets", "heritage-clans");
const ASSETS_LEVELS = path.join(ROOT, "assets", "heritage-clan-levels");

/** Arquivo em Clãs → id do clã */
const CLAN_FILE_TO_ID = {
  "S3F_Aburame.webp": "cla-aburame",
  "S3F_Akimichi.webp": "cla-akimichi",
  "S3F_Hyuga.webp": "cla-hyuga",
  "S3F_Inuzuka.webp": "cla-inuzuka",
  "S3F_Kaguya.webp": "cla-kaguya",
  "S3F_Nara.webp": "cla-nara",
  "S3F_Senju.webp": "cla-senju",
  "S3F_Uzumaki.webp": "cla-uzumaki",
  "S3F_Yamanaka.webp": "cla-yamanaka",
  "S3F_Yuki.webp": "cla-yuki",
  "S3F_Uchiha.webp": "cla-uchiha",
  "cla-namikaze-sem-fundo-256.png": "cla-namikaze",
  "cla-namikaze.png": "cla-namikaze",
  "S3F_Namikaze.webp": "cla-namikaze",
};

/** Pasta de níveis → id do clã */
const LEVEL_FOLDER_TO_ID = {
  Aburame: "cla-aburame",
  Akimichi: "cla-akimichi",
  Hyuga: "cla-hyuga",
  Inuzuka: "cla-inuzuka",
  Kaguya: "cla-kaguya",
  Namizake: "cla-namikaze",
  Namikaze: "cla-namikaze",
  Nara: "cla-nara",
  Senju: "cla-senju",
  Uchiha: "cla-uchiha",
  Sharingan: "cla-uchiha",
  Uzumaki: "cla-uzumaki",
  Yamanaka: "cla-yamanaka",
  Yuki: "cla-yuki",
};

function parseArgs(argv) {
  const out = { clans: DEFAULT_CLANS, levels: DEFAULT_LEVELS };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--clans" && argv[i + 1]) out.clans = path.resolve(argv[++i]);
    else if (argv[i] === "--levels" && argv[i + 1]) out.levels = path.resolve(argv[++i]);
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clearPngWebp(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (/\.(png|webp|jpe?g)$/i.test(f)) fs.unlinkSync(path.join(dir, f));
  }
}

function parseLevelNumber(name) {
  const base = name.replace(/\.[^.]+$/, "");
  const m =
    base.match(/^Nivel\s*(\d+)$/i) ||
    base.match(/^N[ií]vel\s*(\d+)$/i) ||
    base.match(/nivel[-_\s]*(\d+)$/i) ||
    base.match(/^(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 5 ? n : null;
}

function installClans(srcDir) {
  ensureDir(OUT_CLANS);
  ensureDir(ASSETS_CLANS);
  clearPngWebp(OUT_CLANS);

  const installed = {};
  if (!fs.existsSync(srcDir)) {
    console.warn(`Clans folder missing: ${srcDir}`);
    return installed;
  }

  for (const file of fs.readdirSync(srcDir)) {
    const id = CLAN_FILE_TO_ID[file];
    if (!id) {
      console.warn(`  skip unknown clan file: ${file}`);
      continue;
    }
    const ext = path.extname(file).toLowerCase() || ".png";
    const destName = `${id}${ext}`;
    const from = path.join(srcDir, file);
    fs.copyFileSync(from, path.join(OUT_CLANS, destName));
    fs.copyFileSync(from, path.join(ASSETS_CLANS, destName));
    installed[id] = `/ui/heritage/clans/${destName}`;
    console.log(`  clan ${id} ← ${file}`);
  }
  return installed;
}

function installLevels(srcDir) {
  ensureDir(OUT_LEVELS);
  ensureDir(ASSETS_LEVELS);

  const installed = {};
  if (!fs.existsSync(srcDir)) {
    console.warn(`Levels folder missing: ${srcDir}`);
    return installed;
  }

  for (const folder of fs.readdirSync(srcDir)) {
    const folderPath = path.join(srcDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    const id = LEVEL_FOLDER_TO_ID[folder];
    if (!id) {
      console.warn(`  skip unknown level folder: ${folder}`);
      continue;
    }

    const outDir = path.join(OUT_LEVELS, id);
    const assetDir = path.join(ASSETS_LEVELS, id);
    ensureDir(outDir);
    ensureDir(assetDir);
    clearPngWebp(outDir);

    const levels = {};
    for (const file of fs.readdirSync(folderPath)) {
      const n = parseLevelNumber(file);
      if (!n) {
        console.warn(`  skip ${folder}/${file}`);
        continue;
      }
      const ext = path.extname(file).toLowerCase() || ".png";
      const destName = `${n}${ext}`;
      const from = path.join(folderPath, file);
      fs.copyFileSync(from, path.join(outDir, destName));
      fs.copyFileSync(from, path.join(assetDir, destName));
      levels[n] = `/ui/heritage/clan-levels/${id}/${destName}`;
      console.log(`  level ${id} Nv${n} ← ${folder}/${file}`);
    }
    installed[id] = levels;
  }
  return installed;
}

/** Se falta ícone de clã (ou o arquivo é minúsculo), usa arte do Nv1. */
function fillMissingClanIcons(clans, levels) {
  const MIN_BYTES = 2048;
  for (const [id, lv] of Object.entries(levels)) {
    if (!lv[1]) continue;
    const current = clans[id];
    let needsFallback = !current;
    if (current) {
      const abs = path.join(ROOT, "public", current.replace(/^\//, ""));
      if (fs.existsSync(abs) && fs.statSync(abs).size < MIN_BYTES) needsFallback = true;
    }
    if (!needsFallback) continue;
    const srcRel = lv[1].replace(/^\//, "");
    const from = path.join(ROOT, "public", srcRel);
    if (!fs.existsSync(from)) continue;
    const ext = path.extname(from).toLowerCase() || ".png";
    const destName = `${id}${ext}`;
    for (const dir of [OUT_CLANS, ASSETS_CLANS]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (f.startsWith(`${id}.`)) fs.unlinkSync(path.join(dir, f));
      }
    }
    fs.copyFileSync(from, path.join(OUT_CLANS, destName));
    fs.copyFileSync(from, path.join(ASSETS_CLANS, destName));
    clans[id] = `/ui/heritage/clans/${destName}`;
    console.log(`  clan ${id} ← fallback Nv1`);
  }
  return clans;
}

function writeRegistry(clans, levels) {
  const clanIds = Object.keys(clans).sort();
  const levelIds = Object.keys(levels).sort();
  const lines = [];
  lines.push("/** Gerado por scripts/install-heritage-clan-art.js — não editar à mão. */");
  lines.push("");
  lines.push("export const HERITAGE_CLAN_ICONS: Readonly<Record<string, string>> = {");
  for (const id of clanIds) {
    lines.push(`  ${JSON.stringify(id)}: ${JSON.stringify(clans[id])},`);
  }
  lines.push("};");
  lines.push("");
  lines.push(
    "export const HERITAGE_CLAN_LEVEL_ICONS: Readonly<Record<string, readonly [string, string, string, string, string]>> = {"
  );
  for (const id of levelIds) {
    const lv = levels[id];
    const tuple = [1, 2, 3, 4, 5].map((n) => lv[n]).filter(Boolean);
    if (tuple.length !== 5) {
      console.warn(`  incomplete levels for ${id}: ${tuple.length}/5`);
      continue;
    }
    lines.push(
      `  ${JSON.stringify(id)}: [${tuple.map((u) => JSON.stringify(u)).join(", ")}],`
    );
  }
  lines.push("};");
  lines.push("");
  lines.push("export function getHeritageClanIcon(clanId: string | null | undefined): string | null {");
  lines.push("  if (!clanId) return null;");
  lines.push("  return HERITAGE_CLAN_ICONS[clanId] ?? null;");
  lines.push("}");
  lines.push("");
  lines.push(
    "export function getHeritageClanLevelIcon(clanId: string | null | undefined, level: number): string | null {"
  );
  lines.push("  if (!clanId) return null;");
  lines.push("  const row = HERITAGE_CLAN_LEVEL_ICONS[clanId];");
  lines.push("  if (!row) return null;");
  lines.push("  const idx = Math.max(1, Math.min(5, Math.floor(level))) - 1;");
  lines.push("  return row[idx] ?? null;");
  lines.push("}");
  lines.push("");

  const out = path.join(ROOT, "src", "data", "heritage-clan-art.ts");
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`Updated ${path.relative(ROOT, out)}`);
}

function main() {
  const { clans: clansDir, levels: levelsDir } = parseArgs(process.argv);
  console.log("Installing heritage clan art…");
  console.log(`  clans:  ${clansDir}`);
  console.log(`  levels: ${levelsDir}`);
  let clans = installClans(clansDir);
  const levels = installLevels(levelsDir);
  clans = fillMissingClanIcons(clans, levels);
  writeRegistry(clans, levels);
  console.log("Done.");
}

main();
