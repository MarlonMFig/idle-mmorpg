/**
 * Emit src/data/nun5-batch-packs.ts from public/sprites/player/{id}/wire.json
 * node scripts/generate-nun5-batch-client.js
 */
const fs = require('fs');
const path = require('path');
const { NUN5_BATCH_ROSTER } = require('./lib/nun5-batch-roster');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'data', 'nun5-batch-packs.ts');

const FX_OVERRIDES = {
  'skill-kakashi-g6-1': { fxAttach: 'target', range: 160 },
  'skill-kakashi-g6-2': { fxAttach: 'target', range: 150 },
  'skill-kakashi-g6-3': { fxAttach: 'target', range: 180 },
  'skill-sasuke-g6-1': { fxAttach: 'target', range: 150 },
  'skill-sasuke-g6-2': { fxAttach: 'target', range: 160 },
  'skill-temari-g6-1': { fxAttach: 'target', range: 170 },
  'skill-temari-g6-2': { fxAttach: 'target', range: 180 },
  'skill-gaara-shukaku-1': { vfxId: 'wonsr-fx-762', fxAttach: 'target', range: 140 },
  'skill-gaara-shukaku-2': { vfxId: 'wonsr-fx-765', fxAttach: 'target', range: 160 },
  'skill-gaara-shukaku-3': { vfxId: 'wonsr-fx-766', fxAttach: 'target', range: 170 },
  'skill-gaara-shukaku-4': {
    vfxId: 'wonsr-fx-767',
    fxAttach: 'caster',
    fxGround: false,
    range: 180,
  },
  'skill-kidomaru-1': { fxAttach: 'target', range: 150 },
  // Shino G6: trocar FX MUGEN fraco pela nuvem de insetos (kikaichu) do Shino adulto.
  'skill-shino-g6-1': {
    fxAttach: 'target',
    range: 150,
    preferExternal: true,
    externalFx: {
      url: '/sprites/player/shino/kikaichu-fx.png',
      frameWidth: 198,
      frameHeight: 176,
      frameCount: 18,
      contentHeight: 172,
      originX: 0.5,
    },
  },
  'skill-shino-g6-2': {
    fxAttach: 'caster',
    range: 140,
    preferExternal: true,
    externalFx: {
      url: '/sprites/player/shino/kikaichu-fx.png',
      frameWidth: 198,
      frameHeight: 176,
      frameCount: 18,
      contentHeight: 172,
      originX: 0.5,
    },
  },
  'skill-shino-g6-3': { fxAttach: 'target', range: 160 },
  'skill-orochimaru-g6-3': { vfxId: 'anko-1', fxAttach: 'target', range: 160 },
};

function num(n, digits = 3) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0.5';
  return String(Number(n.toFixed(digits)));
}

function sheetTs(key, entry, extra = '') {
  return `{
    key: '${key}',
    url: '${entry.image}',
    frameWidth: ${entry.frameWidth},
    frameHeight: ${entry.frameHeight},
    frameCount: ${entry.frameCount},
    contentHeight: ${entry.contentHeight},
    originX: ${num(entry.originX)},${extra}
  }`;
}

function comboSheetTs(id, index, entry) {
  const key = `${id}-combo${index + 1}`;
  const fx = entry.fx
    ? `,
    fxAttach: 'caster' as const,
    fxGround: true as const,
    fxReleaseMs: ${Math.max(80, Math.floor(((entry.frameCount || 8) / (entry.frameRate || 12)) * 1000 * 0.45))},
    fx: {
      key: '${id}-combo${index + 1}-fx',
      url: '${entry.fx.image}',
      frameWidth: ${entry.fx.frameWidth},
      frameHeight: ${entry.fx.frameHeight},
      frameCount: ${entry.fx.frameCount},
      contentHeight: ${entry.fx.contentHeight},
      originX: ${num(entry.fx.originX)},
    }`
    : '';
  return `{
    key: '${key}',
    url: '${entry.image}',
    frameWidth: ${entry.frameWidth},
    frameHeight: ${entry.frameHeight},
    frameCount: ${entry.frameCount},
    contentHeight: ${entry.contentHeight},
    originX: ${num(entry.originX)},
    frameRate: ${entry.frameRate || 12}${fx},
  }`;
}

function main() {
  const wires = [];
  for (const row of NUN5_BATCH_ROSTER) {
    const file = path.join(ROOT, 'public', 'sprites', 'player', row.id, 'wire.json');
    if (!fs.existsSync(file)) {
      console.warn('missing wire', row.id);
      continue;
    }
    wires.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  if (!wires.length) throw new Error('no wires');

  const skills = [];
  const packChunks = [];
  const slugLines = [];
  const lookLines = [];
  const previewLines = [];
  const huntLines = [];
  const lookConst = [];

  for (const w of wires) {
    const constName = w.id
      .replace(/(^|-)([a-z])/g, (_, _h, c) => c.toUpperCase())
      .replace(/-/g, '');
    const lookConstName = `${constName.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}_LOOK_TYPE`;
    lookConst.push(`export const ${lookConstName} = ${w.lookType};`);

    const skillAnims = [];
    const hotbar = [];
    (w.skills || []).forEach((sk, i) => {
      const slot = typeof sk.index === 'number' ? sk.index : i;
      const skillId = sk.skillId;
      hotbar.push(skillId);
      const levels = [1, 5, 15, 30];
      const override = FX_OVERRIDES[skillId] || {};
      skills.push({
        id: skillId,
        name: sk.skillName || `${w.name} · Especial ${slot + 1}`,
        requiredLevel: levels[slot] || 30,
        durationMs: sk.entry.durationMs || 800,
        hitDelayMs: sk.entry.hitDelayMs || 400,
        range: override.range ?? (slot >= 2 ? 110 : 80),
        area: slot === 3,
        charName: w.name,
      });
      const releaseMs = override.fxReleaseMs ?? sk.entry.hitDelayMs ?? 400;
      const fxAttach = override.fxAttach === 'target' ? 'target' : 'caster';
      const fxGround = override.fxGround ?? fxAttach === 'caster';
      const fxSource = override.preferExternal && override.externalFx
        ? override.externalFx
        : sk.fx || override.externalFx || null;
      const fx = fxSource
        ? `,
      fxReleaseMs: ${releaseMs},
      fxAttach: '${fxAttach}' as const,
      fxGround: ${fxGround} as const,
      fx: {
        key: '${w.id}-${sk.file}-fx',
        url: '${fxSource.image || fxSource.url}',
        frameWidth: ${fxSource.frameWidth},
        frameHeight: ${fxSource.frameHeight},
        frameCount: ${fxSource.frameCount},
        contentHeight: ${fxSource.contentHeight},
        originX: ${num(fxSource.originX ?? 0.5)},
      }`
        : '';
      const vfx =
        override.vfxId && !fxSource
          ? `,
      vfxId: '${override.vfxId}',
      fxReleaseMs: ${releaseMs},
      fxAttach: '${fxAttach}' as const,
      fxGround: ${fxGround} as const`
          : override.vfxId && !override.preferExternal
            ? `,
      vfxId: '${override.vfxId}'`
            : '';
      skillAnims.push(`    '${skillId}': {
      key: '${w.id}-${sk.file}',
      url: '${sk.entry.image}',
      frameWidth: ${sk.entry.frameWidth},
      frameHeight: ${sk.entry.frameHeight},
      frameCount: ${sk.entry.frameCount},
      contentHeight: ${w.contentHeight},
      originX: ${num(sk.entry.originX)},
      frameRate: ${sk.entry.frameRate || 12},
      durationMs: ${sk.entry.durationMs || 800},
      hitDelayMs: ${sk.entry.hitDelayMs || 400}${fx}${vfx},
    }`);
    });

    const c1 = w.combo[0];
    const c2 = w.combo[1] || c1;
    const c3 = w.combo[2] || c1;
    packChunks.push(`const ${constName.toUpperCase()}_PACK: CharacterPack = {
  id: '${w.id}',
  idle: ${sheetTs(`${w.id}-idle`, w.idle, `
    frameRate: 8,`)},
  walk: ${sheetTs(`${w.id}-walk`, w.walk, `
    frameRate: 12,`)},
  attack: ${comboSheetTs(w.id, 0, c1)},
  attackChain: [
    ${comboSheetTs(w.id, 0, c1)},
    ${comboSheetTs(w.id, 1, c2)},
    ${comboSheetTs(w.id, 2, c3)},
  ],
  hurt: ${sheetTs(`${w.id}-hurt`, w.hurt, `
    frameRate: 10,`)},
  death: ${sheetTs(`${w.id}-death`, w.death, `
    frameRate: 8,`)},
  skillAnims: {
${skillAnims.join(',\n')}
  },
  hotbarSkillIds: ${JSON.stringify(hotbar)},
};`);

    slugLines.push(`  '${w.id}': ${constName.toUpperCase()}_PACK,`);
    lookLines.push(`  [${lookConstName}]: ${constName.toUpperCase()}_PACK,`);
    previewLines.push(`  [${lookConstName}]: '/sprites/player/previews/${w.id}.png',`);
    huntLines.push(
      `    { id: 'curated-character-${w.id}', sourceId: 'curated-character-${w.id}', name: ${JSON.stringify(w.name)}, category: 'personagem', source: 'curated/${w.id}', lookType: ${w.lookType}, hasSprite: false, sourceMonster: null },`,
    );
  }

  const skillTs = skills
    .map((s) => {
      const idx = Math.max(0, [1, 5, 15, 30].indexOf(s.requiredLevel));
      return `  {
    id: '${s.id}',
    name: ${JSON.stringify(s.name)},
    element: 'yang' as const,
    requiredLevel: CHARACTER_SKILL_LEVELS[${idx}],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[${idx}],
    damage: CHARACTER_SKILL_DAMAGE[${idx}],
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character' as const, durationMs: ${s.durationMs}, scale: 1 },
    range: ${s.range},${s.area ? `\n    areaRadius: CHARACTER_SKILL_AREA_RADIUS,` : ''}
    description: ${JSON.stringify(`${s.name} — ${s.charName}.`)},
  }`;
    })
    .join(',\n');

  const body = `/**
 * Auto-generated NUN5 MUGEN batch packs. Do not edit by hand.
 * node scripts/process-nun5-batch.js && node scripts/generate-nun5-batch-client.js
 */
import type { CharacterPack } from '@/data/character-packs';
import {
  CHARACTER_SKILL_AREA_RADIUS,
  CHARACTER_SKILL_COOLDOWNS_MS,
  CHARACTER_SKILL_DAMAGE,
  CHARACTER_SKILL_LEVELS,
} from '@/constants/skill';
import type { SkillDefinition } from '@/types/skill';

${lookConst.join('\n')}

export const NUN5_BATCH_LOOK_TYPES = [
${wires.map((w) => `  ${w.lookType},`).join('\n')}
] as const;

${packChunks.join('\n\n')}

export const NUN5_BATCH_BY_SLUG: Record<string, CharacterPack> = {
${slugLines.join('\n')}
};

export const NUN5_BATCH_BY_LOOK_TYPE: Record<number, CharacterPack> = {
${lookLines.join('\n')}
};

export const NUN5_BATCH_PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
${previewLines.join('\n')}
};

export const NUN5_BATCH_HUNT_CHARACTERS = [
${huntLines.join('\n')}
];

export const NUN5_BATCH_PREFERRED_NAMES = [
${wires.map((w) => `  ${JSON.stringify(w.name)},`).join('\n')}
];

export const NUN5_BATCH_SKILLS: SkillDefinition[] = [
${skillTs}
];
`;

  fs.writeFileSync(OUT, body);
  console.log('wrote', OUT, 'packs', wires.length, 'skills', skills.length);
}

main();
