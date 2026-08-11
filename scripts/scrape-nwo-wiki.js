/**
 * Scrapes https://ninjaworldonline.com.br/wiki into structured JSON under public/data/nwo/.
 *
 * Usage: node scripts/scrape-nwo-wiki.js
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const BASE = "https://ninjaworldonline.com.br";
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "data", "nwo");
const RAW_DIR = path.join(ROOT, "tmp", "nwo-raw");
const SPELL_IMAGE_DIR = path.join(ROOT, "public", "images", "nwo", "spells");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent": "idle-mmorpg-nwo-scraper/1.0",
          Accept: "text/html,application/javascript,application/json,*/*",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          fetchText(next).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent": "idle-mmorpg-nwo-scraper/1.0",
          Accept: "image/avif,image/webp,image/png,image/*,*/*",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          fetchBuffer(next).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
  });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  );
}

function matchAll(html, regex) {
  const out = [];
  let m;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(html)) !== null) out.push(m);
  return out;
}

function attr(block, name) {
  const m = block.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function parseStatGrid(html) {
  const stats = {};
  for (const m of matchAll(html, /<div class="wiki-stat-cell"><span>([^<]*)<\/span><strong>([^<]*)<\/strong><\/div>/g)) {
    stats[decodeEntities(m[1])] = decodeEntities(m[2]);
  }
  return stats;
}

function parsePills(html) {
  return matchAll(html, /<span class="wiki-pill[^"]*">([^<]*)<\/span>/g).map((m) => decodeEntities(m[1]));
}

function parseDetailRows(html) {
  const rows = {};
  for (const m of matchAll(
    html,
    /<div class="wiki-detail-row"><strong>([^<]*)<\/strong><span>([^<]*)<\/span><\/div>/g
  )) {
    rows[decodeEntities(m[1])] = decodeEntities(m[2]);
  }
  return rows;
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const cleaned = String(value).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseAttackMs(value) {
  const m = String(value || "").match(/(\d+)\s*ms/i);
  return m ? Number(m[1]) : parseNumber(value);
}

function parseCharacterProfile(slug, html) {
  const title = decodeEntities((html.match(/<h1 class="wiki-title wiki-profile-title">([^<]*)<\/h1>/) || [])[1] || slug);
  const tone = decodeEntities((html.match(/<span class="wiki-tone">([^<]*)<\/span>/) || [])[1] || "");
  const status = decodeEntities((html.match(/<span class="wiki-status">([^<]*)<\/span>/) || [])[1] || "");
  const lead = decodeEntities((html.match(/<p class="wiki-lead">([^<]*)<\/p>/) || [])[1] || "");
  const image = (html.match(/wiki-profile-media"><img src="([^"]+)"/) || [])[1] || "";
  const stats = parseStatGrid(html);
  const pills = parsePills(html.match(/wiki-profile-pill-row[\s\S]*?<\/div>/) || [""])[0]
    ? parsePills((html.match(/<div class="wiki-pill-row wiki-profile-pill-row">([\s\S]*?)<\/div>/) || ["", ""])[1])
    : parsePills(html);

  const skills = matchAll(html, /<div class="wiki-spell-tile">([\s\S]*?)<\/div><\/div>/g).map((m) => {
    const block = m[1];
    const icon = (block.match(/<img src="([^"]+)"/) || [])[1] || "";
    const slot = decodeEntities((block.match(/wiki-slot-badge">([^<]*)</) || [])[1] || "");
    const meta = decodeEntities((block.match(/wiki-spell-meta">([^<]*)</) || [])[1] || "");
    const name = decodeEntities((block.match(/<h4>([^<]*)<\/h4>/) || [])[1] || slot);
    const description = decodeEntities((block.match(/<p>([^<]*)<\/p>/) || [])[1] || "");
    const level = parseNumber((meta.match(/Nivel\s+(\d+)/i) || [])[1]);
    const chakra = parseNumber((meta.match(/Chakra\s+(\d+)/i) || [])[1]);
    const range = parseNumber((meta.match(/Alcance\s+(\d+)/i) || [])[1]);
    let targeting = null;
    if (/Self/i.test(meta)) targeting = "Self";
    else if (/Area/i.test(meta)) targeting = "Area";
    else if (/Alvo/i.test(meta)) targeting = "Alvo";
    return { slot, name, meta, description, level, chakra, range, targeting, icon };
  });

  const skins = matchAll(html, /<div class="wiki-skin-tile">([\s\S]*?)<\/div>\s*<\/div>/g).map((m) => {
    const block = m[1];
    const imageSrc = (block.match(/<img src="([^"]+)"/) || [])[1] || "";
    const name = decodeEntities((block.match(/<strong>([^<]*)<\/strong>/) || [])[1] || "");
    const variant = decodeEntities((block.match(/<span>([^<]*)<\/span>/) || [])[1] || "");
    const idMatch = imageSrc.match(/\/(\d+)\.(?:png|jpg|webp)/i);
    return {
      id: idMatch ? Number(idMatch[1]) : null,
      name,
      variant,
      image: imageSrc,
    };
  });

  const [role, combatStyle] = tone.split("/").map((s) => s.trim());

  return {
    slug,
    name: title,
    role: role || null,
    combatStyle: combatStyle || null,
    unlock: status || null,
    lead,
    image,
    url: `${BASE}/wiki-personagem-${slug}.html`,
    stats: {
      penetration: parseNumber(stats["Penetracao"]),
      armor: parseNumber(stats["Armadura"]),
      hpPerLevel: parseNumber(stats["Vida / lvl"]),
      chakraPerLevel: parseNumber(stats["Chakra / lvl"]),
      speed: parseNumber(stats["Velocidade"]),
      attackIntervalMs: parseAttackMs(stats["Ataque"]),
      raw: stats,
    },
    pills,
    skills,
    skins,
    skillCount: skills.length,
    skinCount: skins.length,
  };
}

function parseDungeonProfile(slug, html) {
  const title = decodeEntities((html.match(/<h1 class="wiki-title wiki-profile-title">([^<]*)<\/h1>/) || [])[1] || slug);
  const tone = decodeEntities((html.match(/<span class="wiki-tone">([^<]*)<\/span>/) || [])[1] || "");
  const status = decodeEntities((html.match(/<span class="wiki-status">([^<]*)<\/span>/) || [])[1] || "");
  const lead = decodeEntities((html.match(/<p class="wiki-lead">([^<]*)<\/p>/) || [])[1] || "");
  const image = (html.match(/wiki-profile-media[\s\S]*?<img src="([^"]+)"/) || [])[1] || "";
  const stats = parseStatGrid(html);
  const pills = parsePills((html.match(/<div class="wiki-pill-row wiki-profile-pill-row">([\s\S]*?)<\/div>/) || ["", ""])[1]);
  const details = parseDetailRows(html);

  const encounters = matchAll(html, /<div class="wiki-encounter-tile">([\s\S]*?)<\/div>\s*<\/div>/g).map((m) => {
    const block = m[1];
    const imageSrc = (block.match(/<img src="([^"]+)"/) || [])[1] || "";
    const name = decodeEntities((block.match(/<strong>([^<]*)<\/strong>/) || [])[1] || "");
    const note = decodeEntities((block.match(/<span>([^<]*)<\/span>/) || [])[1] || "");
    const count = parseNumber((note.match(/(\d+)\s+na dungeon/i) || [])[1]);
    const kind = /boss/i.test(note) ? "boss" : "mob";
    const idMatch = imageSrc.match(/\/(\d+)\.(?:png|jpg|webp)/i);
    return { name, kind, note, count, looktype: idMatch ? Number(idMatch[1]) : null, image: imageSrc };
  });

  const drops = matchAll(html, /<div class="wiki-reward-tile">([\s\S]*?)<\/div>\s*<\/div>/g).map((m) => {
    const block = m[1];
    const imageSrc = (block.match(/<img src="([^"]+)"/) || [])[1] || "";
    const name = decodeEntities((block.match(/<strong>([^<]*)<\/strong>/) || [])[1] || "");
    const amountText = decodeEntities((block.match(/wiki-reward-amount">([^<]*)</) || [])[1] || "");
    const rarity = decodeEntities((block.match(/wiki-rarity-badge[^"]*">([^<]*)</) || [])[1] || "");
    const idMatch = imageSrc.match(/\/(\d+)\.(?:png|jpg|webp)/i);
    return {
      id: idMatch ? Number(idMatch[1]) : null,
      name,
      amount: parseNumber(amountText),
      amountText,
      rarity,
      image: imageSrc,
    };
  });

  return {
    slug,
    name: title,
    tone,
    levelRequirement: status,
    lead,
    image,
    url: `${BASE}/wiki-dungeon-${slug}.html`,
    stats: {
      energy: stats["Energia"] || null,
      duration: stats["Duracao"] || null,
      party: stats["Grupo"] || null,
      boss: stats["Boss"] || null,
      mobCount: parseNumber(stats["Mobs"]),
      dropCount: parseNumber(stats["Drops"]),
      raw: stats,
    },
    pills,
    flow: details,
    encounters,
    drops,
  };
}

function parseItemCards(wikiHtml) {
  const cards = matchAll(wikiHtml, /<article class="wiki-card wiki-item-card"([\s\S]*?)<\/article>/g);
  return cards.map((m) => {
    const block = m[0];
    const search = attr(block, "data-search");
    const image = (block.match(/<img src="([^"]+)"/) || [])[1] || "";
    const name = decodeEntities((block.match(/<h3 class="wiki-card-title">([^<]*)<\/h3>/) || [])[1] || "");
    const tone = decodeEntities((block.match(/<span class="wiki-tone">([^<]*)<\/span>/) || [])[1] || "");
    const status = decodeEntities((block.match(/<span class="wiki-status">([^<]*)<\/span>/) || [])[1] || "");
    const stats = parseStatGrid(block);
    const pills = parsePills(block);
    const details = parseDetailRows(block);
    const idMatch = image.match(/\/(\d+)\.(?:png|jpg|webp)/i);
    return {
      id: idMatch ? Number(idMatch[1]) : null,
      name,
      slot: tone || null,
      status: status || null,
      search,
      image,
      stats,
      pills,
      details,
    };
  });
}

function parseCraftRecipes(wikiHtml) {
  const sets = [];
  for (const m of matchAll(wikiHtml, /<article class="wiki-card wiki-craft-set-card"([\s\S]*?)<\/article>/g)) {
    const block = m[0];
    const route = decodeEntities((block.match(/<span class="wiki-status">([^<]*)<\/span>/) || [])[1] || "");
    const title = decodeEntities((block.match(/<h3 class="wiki-card-title">([^<]*)<\/h3>/) || [])[1] || "");
    const sources = matchAll(
      (block.match(/<div class="wiki-craft-set-footer">([\s\S]*?)<\/div>/) || ["", ""])[1],
      /<span class="wiki-pill[^"]*">([^<]*)<\/span>/g
    ).map((x) => decodeEntities(x[1]));

    const recipes = matchAll(block, /<button class="wiki-craft-slot-card"[^>]*title="([^"]*)"[\s\S]*?<\/button>/g).map(
      (btn) => {
        const titleAttr = decodeEntities(btn[1]);
        const parts = titleAttr.split("|").map((p) => p.trim()).filter(Boolean);
        const resultName = parts[0] || "";
        const materials = [];
        let hyo = null;
        let durationSec = null;
        for (const part of parts.slice(1)) {
          const hyoMatch = part.match(/^([\d.]+)\s*Hyo$/i);
          const timeMatch = part.match(/^([\d.]+)\s*s$/i);
          const matMatch = part.match(/^(.+?)\s+x(\d+)$/i);
          if (hyoMatch) hyo = Number(hyoMatch[1]);
          else if (timeMatch) durationSec = Number(timeMatch[1]);
          else if (matMatch) materials.push({ name: matMatch[1].trim(), amount: Number(matMatch[2]) });
        }
        const slotType = decodeEntities((btn[0].match(/wiki-craft-slot-type">([^<]*)</) || [])[1] || "");
        const image = (btn[0].match(/wiki-craft-slot-item" src="([^"]+)"/) || [])[1] || "";
        const idMatch = image.match(/\/(\d+)\.(?:png|jpg|webp)/i);
        return {
          result: resultName,
          resultId: idMatch ? Number(idMatch[1]) : null,
          slotType,
          materials,
          hyo,
          durationSec,
          image,
          rawTitle: titleAttr,
        };
      }
    );

    sets.push({ route, title, sources, recipes });
  }
  return sets;
}

function parseFusion(wikiHtml) {
  const section = (wikiHtml.match(/id="wiki-fusion"[\s\S]*?(?=<section class="wiki-section-block" id="wiki-craft")/) || [
    "",
  ])[0];
  const tiers = matchAll(
    section,
    /<div class="wiki-fusion-tier-chip"><span>([^<]*)<\/span><strong>([^<]*)<\/strong><em>([^<]*)<\/em><\/div>/g
  ).map((m) => ({
    step: decodeEntities(m[1]),
    successRate: decodeEntities(m[2]),
    cost: decodeEntities(m[3]),
  }));

  const notes = matchAll(section, /<div><strong>([^<]*)<\/strong>\s*([^<]*)<\/div>/g).map((m) => ({
    label: decodeEntities(m[1]).replace(/:$/, ""),
    text: decodeEntities(m[2]),
  }));

  const boosts = matchAll(
    section,
    /<div class="wiki-fusion-boost-card">\s*<span>([^<]*)<\/span>\s*<strong>([^<]*)<\/strong>/g
  ).map((m) => ({ name: decodeEntities(m[1]), effect: decodeEntities(m[2]) }));

  return {
    rules: [
      "Fusiona 2 itens iguais no mesmo tier.",
      "A copia usada na tentativa some no processo.",
      "Residuo cai de mobs influenciados e converte em Fragmentos de chakra / Esfera.",
    ],
    tiers,
    boosts,
    conversionNotes: notes,
    exampleMetrics: {
      success: "25%",
      fail: "75%",
      residue: "100",
      hyoBase: "250k",
    },
  };
}

function summarizeMap(mapData) {
  const monsters = new Map();
  const npcs = new Map();
  const markers = [];

  for (const [floorId, floor] of Object.entries(mapData.floors || {})) {
    for (const marker of floor.markers || []) {
      markers.push({
        ...marker,
        floor: Number(floorId),
      });
      const bucket = marker.kind === "npc" ? npcs : monsters;
      const key = marker.name;
      const prev = bucket.get(key) || {
        name: marker.name,
        kind: marker.kind,
        looktype: marker.looktype ?? null,
        image: marker.image || null,
        levelMin: marker.levelMin ?? null,
        aliases: marker.aliases || [],
        spawnCount: 0,
        markerCount: 0,
        floors: new Set(),
      };
      prev.spawnCount += marker.spawnCount || 0;
      prev.markerCount += 1;
      prev.floors.add(Number(floorId));
      if (marker.levelMin != null) {
        prev.levelMin =
          prev.levelMin == null ? marker.levelMin : Math.min(prev.levelMin, marker.levelMin);
      }
      bucket.set(key, prev);
    }
  }

  const toList = (map) =>
    [...map.values()]
      .map((entry) => ({
        ...entry,
        floors: [...entry.floors].sort((a, b) => a - b),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: mapData.generatedAt,
    map: mapData.map,
    floors: Object.keys(mapData.floors || {}).map(Number).sort((a, b) => a - b),
    markerCount: markers.length,
    monsters: toList(monsters),
    npcs: toList(npcs),
    markers,
  };
}

async function download(relPath, destName) {
  const url = relPath.startsWith("http") ? relPath : `${BASE}/${relPath.replace(/^\//, "")}`;
  const text = await fetchText(url);
  const dest = path.join(RAW_DIR, destName);
  fs.writeFileSync(dest, text, "utf8");
  return text;
}

async function downloadSkillImages(characters) {
  ensureDir(SPELL_IMAGE_DIR);
  const downloaded = new Set();
  const missing = [];

  for (const character of characters) {
    for (const skill of character.skills) {
      if (!skill.icon) continue;

      const sourceIcon = new URL(skill.icon, `${BASE}/`).toString();
      const sourceName = path.posix.basename(new URL(sourceIcon).pathname);
      const fileName = sourceName || `${character.slug}-${skill.slot.toLowerCase()}.png`;
      const localIcon = `/images/nwo/spells/${fileName}`;

      if (!downloaded.has(fileName)) {
        try {
          const image = await fetchBuffer(sourceIcon);
          fs.writeFileSync(path.join(SPELL_IMAGE_DIR, fileName), image);
          downloaded.add(fileName);
        } catch (error) {
          missing.push({
            character: character.slug,
            skill: skill.slot,
            sourceIcon,
            error: error.message,
          });
          skill.sourceIcon = sourceIcon;
          skill.icon = null;
          continue;
        }
      }

      skill.sourceIcon = sourceIcon;
      skill.icon = localIcon;
    }
  }

  return { downloaded: downloaded.size, missing };
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(RAW_DIR);

  console.log("Downloading wiki index...");
  const wikiHtml = await download("wiki", "wiki.html");
  const mapJs = await download("data/wiki-world-map-data.js", "wiki-world-map-data.js");
  await download("wiki.js", "wiki.js");
  await download("wiki-map.js", "wiki-map.js");

  const characterSlugs = [
    ...new Set(
      matchAll(wikiHtml, /wiki-personagem-([a-z0-9-]+)\.html/g).map((m) => m[1])
    ),
  ];
  const dungeonSlugs = [
    ...new Set(matchAll(wikiHtml, /wiki-dungeon-([a-z0-9-]+)\.html/g).map((m) => m[1])),
  ];

  console.log(`Characters: ${characterSlugs.length}`);
  console.log(`Dungeons: ${dungeonSlugs.length}`);

  const characters = [];
  for (const slug of characterSlugs) {
    process.stdout.write(`  character ${slug}...\n`);
    const html = await download(`wiki-personagem-${slug}.html`, `personagem-${slug}.html`);
    characters.push(parseCharacterProfile(slug, html));
  }
  console.log("Downloading skill images...");
  const skillImages = await downloadSkillImages(characters);
  if (skillImages.missing.length) {
    console.warn(`Missing skill images on source site: ${skillImages.missing.length}`);
  }

  const dungeons = [];
  for (const slug of dungeonSlugs) {
    process.stdout.write(`  dungeon ${slug}...\n`);
    const html = await download(`wiki-dungeon-${slug}.html`, `dungeon-${slug}.html`);
    dungeons.push(parseDungeonProfile(slug, html));
  }

  const builderJsonMatch = wikiHtml.match(
    /<script id="wiki-item-builder-data" type="application\/json">([\s\S]*?)<\/script>/
  );
  let itemBuilder = null;
  if (builderJsonMatch) {
    itemBuilder = JSON.parse(builderJsonMatch[1]);
    writeJson(path.join(OUT_DIR, "item-builder.json"), itemBuilder);
  }

  const itemCards = parseItemCards(wikiHtml);
  const craft = parseCraftRecipes(wikiHtml);
  const fusion = parseFusion(wikiHtml);

  const mapData = JSON.parse(
    mapJs.replace(/^window\.__NWO_WIKI_WORLD_MAP_DATA__\s*=\s*/, "").replace(/;\s*$/, "")
  );
  writeJson(path.join(OUT_DIR, "world-map-raw.json"), mapData);
  const mapSummary = summarizeMap(mapData);
  writeJson(path.join(OUT_DIR, "world-map.json"), {
    generatedAt: mapSummary.generatedAt,
    map: mapSummary.map,
    floors: mapSummary.floors,
    markerCount: mapSummary.markerCount,
    monsters: mapSummary.monsters,
    npcs: mapSummary.npcs,
  });
  writeJson(path.join(OUT_DIR, "world-map-markers.json"), mapSummary.markers);

  writeJson(path.join(OUT_DIR, "characters.json"), characters);
  writeJson(path.join(OUT_DIR, "dungeons.json"), dungeons);
  writeJson(path.join(OUT_DIR, "items-catalog.json"), itemCards);
  writeJson(path.join(OUT_DIR, "craft.json"), craft);
  writeJson(path.join(OUT_DIR, "fusion.json"), fusion);

  const index = {
    source: BASE + "/wiki",
    scrapedAt: new Date().toISOString(),
    counts: {
      characters: characters.length,
      skillImages: skillImages.downloaded,
      missingSkillImages: skillImages.missing.length,
      dungeons: dungeons.length,
      itemCards: itemCards.length,
      builderItems: itemBuilder?.items?.length || 0,
      builderPresets: itemBuilder?.presets?.length || 0,
      craftRoutes: craft.length,
      craftRecipes: craft.reduce((n, s) => n + s.recipes.length, 0),
      mapMonsters: mapSummary.monsters.length,
      mapNpcs: mapSummary.npcs.length,
      mapMarkers: mapSummary.markerCount,
      fusionTiers: fusion.tiers.length,
    },
    files: [
      "characters.json",
      "dungeons.json",
      "items-catalog.json",
      "item-builder.json",
      "craft.json",
      "fusion.json",
      "world-map.json",
      "world-map-markers.json",
      "world-map-raw.json",
      "index.json",
    ],
    missingSkillImages: skillImages.missing,
    characters: characters.map((c) => ({
      slug: c.slug,
      name: c.name,
      role: c.role,
      combatStyle: c.combatStyle,
      unlock: c.unlock,
      skillCount: c.skillCount,
      skinCount: c.skinCount,
    })),
    dungeons: dungeons.map((d) => ({
      slug: d.slug,
      name: d.name,
      levelRequirement: d.levelRequirement,
      boss: d.stats.boss,
    })),
  };

  writeJson(path.join(OUT_DIR, "index.json"), index);

  console.log("\nDone.");
  console.log(JSON.stringify(index.counts, null, 2));
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
