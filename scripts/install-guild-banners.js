/**
 * Instala emblemas de guilda a partir do pack pixel-art.
 *
 * Uso:
 *   node scripts/install-guild-banners.js [caminho-do-zip-ou-pasta]
 *
 * Destino: public/ui/guild-banners/<slug>.png
 * Atualiza apenas o bloco de emblemas em src/constants/guild.ts
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DEST = path.join(ROOT, "public", "ui", "guild-banners");
const ASSETS_DIR = path.join(ROOT, "assets", "guild-banners");
const CONSTANTS = path.join(ROOT, "src", "constants", "guild.ts");
const DEFAULT_ZIP = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "naruto-world-idle-banners-guild-pixel-art.zip"
);

function findIndividuais(dir) {
  const direct = path.join(dir, "individuais-256x256");
  if (fs.existsSync(direct)) return { root: dir, individuais: direct };
  for (const name of fs.readdirSync(dir)) {
    const nested = path.join(dir, name);
    if (!fs.statSync(nested).isDirectory()) continue;
    const hit = path.join(nested, "individuais-256x256");
    if (fs.existsSync(hit)) return { root: nested, individuais: hit };
  }
  return null;
}

function extractZip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit" }
    );
  } else {
    execFileSync("unzip", ["-o", zipPath, "-d", outDir], { stdio: "inherit" });
  }
}

function loadManifest(packRoot) {
  const manifestPath = path.join(packRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function buildEmblemsBlock(emblems) {
  const firstIcon = emblems[0]?.icon ?? "/ui/guild-banners/folha-rubra.png";
  const lines = emblems.map(
    (e) =>
      `  { id: ${JSON.stringify(e.id)}, label: ${JSON.stringify(e.label)}, icon: ${JSON.stringify(e.icon)} },`
  );
  return `/** Emblemas em \`public/ui/guild-banners/\` (pack pixel-art). */
export const GUILD_EMBLEMS = [
${lines.join("\n")}
] as const;

export type GuildEmblemId = (typeof GUILD_EMBLEMS)[number]["id"];

/** Estandarte padrão quando o salvo não existe mais. */
export const GUILD_DEFAULT_EMBLEM = GUILD_EMBLEMS[0]?.icon ?? ${JSON.stringify(firstIcon)};

export function isGuildEmblemIcon(value: string | null | undefined): boolean {
  if (!value) return false;
  return GUILD_EMBLEMS.some((entry) => entry.icon === value);
}`;
}

function patchConstants(emblems) {
  const existing = fs.readFileSync(CONSTANTS, "utf8");
  const block = buildEmblemsBlock(emblems);

  // Replace from legacy banner IDs block or current GUILD_EMBLEMS through isGuildEmblemIcon
  const startRe =
    /(?:\/\*\* IDs reais em `public\/ui\/guild-banners\/`[\s\S]*?|\/\*\* Emblemas em `public\/ui\/guild-banners\/`[\s\S]*?)export function isGuildEmblemIcon\([\s\S]*?\n\}/;
  let next;
  if (startRe.test(existing)) {
    next = existing.replace(startRe, block);
  } else {
    // Fallback: insert before GUILD_COLORS
    const colorsIdx = existing.indexOf("export const GUILD_COLORS");
    if (colorsIdx < 0) throw new Error("Could not locate GUILD_COLORS in guild.ts");
    next = `${existing.slice(0, colorsIdx).trimEnd()}\n\n${block}\n\n${existing.slice(colorsIdx)}`;
  }

  fs.writeFileSync(CONSTANTS, next, "utf8");
}

function installFromPack(packRoot, individuaisDir) {
  fs.mkdirSync(DEST, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  for (const f of fs.readdirSync(DEST)) {
    if (/\.(png|webp|jpe?g)$/i.test(f)) {
      fs.unlinkSync(path.join(DEST, f));
    }
  }

  const manifest = loadManifest(packRoot);
  const byFile = new Map();
  const list = manifest?.ordem || manifest?.banners || [];
  for (const b of list) {
    const base = path.basename(b.arquivo || "");
    if (base) byFile.set(base, b);
  }

  const files = fs
    .readdirSync(individuaisDir)
    .filter((f) => f.toLowerCase().endsWith(".png"));

  // Prefer manifest order when available
  const ordered =
    list.length > 0
      ? list
          .map((b) => path.basename(b.arquivo || ""))
          .filter((f) => files.includes(f))
      : files.sort((a, b) => a.localeCompare(b, "pt"));

  const emblems = [];
  for (const file of ordered) {
    const slug = file.replace(/\.png$/i, "");
    const src = path.join(individuaisDir, file);
    fs.copyFileSync(src, path.join(DEST, file));
    fs.copyFileSync(src, path.join(ASSETS_DIR, file));

    const meta = byFile.get(file);
    const label =
      meta?.nome ||
      slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    emblems.push({
      id: slug,
      label,
      icon: `/ui/guild-banners/${file}`,
    });
  }

  patchConstants(emblems);

  const packDest = path.join(ASSETS_DIR, "pack");
  fs.mkdirSync(packDest, { recursive: true });
  for (const name of ["manifest.json", "LEIA-ME.md"]) {
    const from = path.join(packRoot, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(packDest, name));
  }
  for (const name of fs.readdirSync(packRoot)) {
    if (name.startsWith("atlas-banners-guild") && name.endsWith(".png")) {
      fs.copyFileSync(path.join(packRoot, name), path.join(packDest, name));
    }
  }

  console.log(`Installed ${emblems.length} guild banners → ${path.relative(ROOT, DEST)}`);
  console.log(`Updated ${path.relative(ROOT, CONSTANTS)}`);
  return emblems.length;
}

function main() {
  const arg = process.argv[2] || DEFAULT_ZIP;
  const abs = path.resolve(arg);
  if (!fs.existsSync(abs)) {
    console.error(`Not found: ${abs}`);
    process.exit(1);
  }

  let packRoot;
  let individuais;
  const tmp = path.join(ROOT, ".tmp-guild-banners-install");

  if (fs.statSync(abs).isDirectory()) {
    const found = findIndividuais(abs);
    if (!found) {
      console.error("Pasta individuais-256x256 não encontrada.");
      process.exit(1);
    }
    packRoot = found.root;
    individuais = found.individuais;
  } else {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
    extractZip(abs, tmp);
    const found = findIndividuais(tmp);
    if (!found) {
      console.error("Zip sem individuais-256x256.");
      process.exit(1);
    }
    packRoot = found.root;
    individuais = found.individuais;
  }

  const n = installFromPack(packRoot, individuais);
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  // Clean earlier extract leftover
  const oldTmp = path.join(ROOT, ".tmp-guild-banners");
  if (fs.existsSync(oldTmp)) fs.rmSync(oldTmp, { recursive: true, force: true });
  console.log(`Done (${n}).`);
}

main();
