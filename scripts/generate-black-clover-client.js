// Emit src/data/black-clover-packs.ts from public/sprites/player/{id}/wire.json
// npm run bc:client
const fs = require('fs');
const path = require('path');
const { BC_ROSTER } = require('./lib/bc-roster');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'data', 'black-clover-packs.ts');

/** Projétil / timing / âncora / range que o wire não expressa. */
const FX_OVERRIDES = {
  'skill-noelle-e99-3': {
    fxFlightFrameCount: 16,
    fxReleaseMs: 280,
    fxFlightRotate: false,
  },
  'skill-yuno-royal-knight-2': {
    fxFlightFrameCount: 6,
    fxReleaseMs: 160,
    fxFlightRotate: false,
  },
  'skill-yuno-royal-knight-4': {
    fxFlightFrameCount: 6,
    fxReleaseMs: 280,
    fxFlightRotate: false,
    fxFlightFlip: true,
  },
  'skill-mereoleona-1': {
    fxAttach: 'target',
    range: 160,
  },
  'skill-mereoleona-2': {
    fxAttach: 'target',
    range: 160,
  },
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

function main() {
  const wires = [];
  for (const row of BC_ROSTER) {
    const file = path.join(ROOT, 'public', 'sprites', 'player', row.id, 'wire.json');
    if (!fs.existsSync(file)) {
      console.warn('missing wire', row.id);
      continue;
    }
    wires.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  }

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

    const omitSkills = new Set(
      (BC_ROSTER.find((row) => row.id === w.id)?.omitSkillIndexes ?? []).map(Number),
    );
    const skillAnims = [];
    const hotbar = [];
    (w.skills || []).forEach((sk, i) => {
      const slot = typeof sk.index === 'number' ? sk.index : i;
      if (omitSkills.has(slot)) return;
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
      const releaseMs =
        override.fxReleaseMs ?? sk.entry.hitDelayMs ?? 400;
      const flightN = override.fxFlightFrameCount;
      const fxAttach = override.fxAttach === 'target' ? 'target' : 'caster';
      const fx = sk.fx
        ? `,
      fxReleaseMs: ${releaseMs},${
          flightN
            ? `
      fxFlightFrameCount: ${flightN},${
                override.fxFlightRotate === false
                  ? `
      fxFlightRotate: false as const,`
                  : ''
              }${
                override.fxFlightFlip
                  ? `
      fxFlightFlip: true as const,`
                  : ''
              }`
            : `
      fxAttach: '${fxAttach}' as const,`
        }
      fx: {
        key: '${w.id}-${sk.file}-fx',
        url: '${sk.fx.image}',
        frameWidth: ${sk.fx.frameWidth},
        frameHeight: ${sk.fx.frameHeight},
        frameCount: ${sk.fx.frameCount},
        contentHeight: ${sk.fx.contentHeight},
      }`
        : '';
      const hit = sk.hit
        ? `,
      fxSecondaryReleaseMs: ${sk.entry.hitDelayMs || 400},
      fxSecondaryAttach: 'target' as const,
      fxSecondaryFrameRate: ${sk.hit.frameRate || 12},
      fxSecondary: {
        key: '${w.id}-${sk.file}-hit',
        url: '${sk.hit.image}',
        frameWidth: ${sk.hit.frameWidth},
        frameHeight: ${sk.hit.frameHeight},
        frameCount: ${sk.hit.frameCount},
        contentHeight: ${sk.hit.contentHeight},
      }`
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
      hitDelayMs: ${sk.entry.hitDelayMs || 400}${fx}${hit},
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
  attack: ${sheetTs(`${w.id}-combo1`, c1)},
  attackChain: [
    ${sheetTs(`${w.id}-combo1`, c1)},
    ${sheetTs(`${w.id}-combo2`, c2)},
    ${sheetTs(`${w.id}-combo3`, c3)},
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
    huntLines.push(`    { id: 'curated-character-${w.id}', sourceId: 'curated-character-${w.id}', name: ${JSON.stringify(w.name)}, category: 'personagem', source: 'curated/${w.id}', lookType: ${w.lookType}, hasSprite: false, sourceMonster: null },`);
  }

  const skillTs = skills
    .map(
      (s, i) => `  {
    id: '${s.id}',
    name: ${JSON.stringify(s.name)},
    element: 'yang' as const,
    requiredLevel: CHARACTER_SKILL_LEVELS[${Math.min(3, skills.indexOf(s) % 4)}],
    cooldownMs: CHARACTER_SKILL_COOLDOWNS_MS[${Math.min(3, i % 4)}],
    damage: CHARACTER_SKILL_DAMAGE[${Math.min(3, i % 4)}],
    icon: '/sprites/skills/yang.svg',
    animation: { kind: 'character' as const, durationMs: ${s.durationMs}, scale: 1 },
    range: ${s.range},${s.area ? `\n    areaRadius: CHARACTER_SKILL_AREA_RADIUS,` : ''}
    description: ${JSON.stringify(`${s.name} — ${s.charName}.`)},
  }`,
    )
    .join(',\n');

  // Fix requiredLevel index per character (groups of up to 4)
  let skillIndex = 0;
  const skillTsFixed = skills
    .map((s) => {
      const slot = skillIndex % 4;
      // reset conceptually per char by detecting id prefix change — simpler: use requiredLevel already on s
      const slot2 = [1, 5, 15, 30].indexOf(s.requiredLevel);
      const idx = slot2 >= 0 ? slot2 : slot;
      skillIndex += 1;
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
 * Auto-generated Black Clover MUGEN packs. Do not edit by hand.
 * npm run bc:roster && npm run bc:client
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

export const BLACK_CLOVER_LOOK_TYPES = [
${wires.map((w) => `  ${w.lookType},`).join('\n')}
] as const;

${packChunks.join('\n\n')}

export const BLACK_CLOVER_BY_SLUG: Record<string, CharacterPack> = {
${slugLines.join('\n')}
};

export const BLACK_CLOVER_BY_LOOK_TYPE: Record<number, CharacterPack> = {
${lookLines.join('\n')}
};

export const BLACK_CLOVER_PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
${previewLines.join('\n')}
};

export const BLACK_CLOVER_HUNT_CHARACTERS = [
${huntLines.join('\n')}
];

export const BLACK_CLOVER_PREFERRED_NAMES = [
${wires.map((w) => `  ${JSON.stringify(w.name)},`).join('\n')}
];

export const BLACK_CLOVER_SKILLS: SkillDefinition[] = [
${skillTsFixed}
];
`;

  fs.writeFileSync(OUT, body);
  console.log('wrote', OUT, 'packs', wires.length, 'skills', skills.length);
}

main();
