// Emit src/data/jujutsu-kaisen-packs.ts from public/sprites/player/{id}/wire.json
// npm run jjk:client
const fs = require('fs');
const path = require('path');
const { JJK_ROSTER } = require('./lib/jjk-roster');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'data', 'jujutsu-kaisen-packs.ts');

const FX_OVERRIDES = {
  'skill-itadori-3': {
    fxFlightFrameCount: 11,
    fxReleaseMs: 200,
    fxFlightRotate: false,
  },
  'skill-itadori-4': {
    fxFlightFrameCount: 7,
    fxReleaseMs: 200,
    fxFlightRotate: false,
  },
  'skill-mahito-2': {
    fxFlightFrameCount: 21,
    fxReleaseMs: 160,
    fxFlightRotate: false,
  },
  'skill-maki-1': {
    fxFlightFrameCount: 16,
    fxReleaseMs: 120,
    fxFlightRotate: false,
  },
  'skill-sukuna-2': {
    fxFlightFrameCount: 10,
    fxReleaseMs: 160,
    fxFlightRotate: false,
  },
  'skill-sukuna-3': {
    fxFlightFrameCount: 5,
    fxReleaseMs: 140,
    fxFlightRotate: false,
  },
  'skill-toji-1': {
    fxFlightFrameCount: 3,
    fxReleaseMs: 80,
    fxFlightRotate: false,
  },
  // FX do 1400 é corpo+corrente (não VFX). Usa como anim do personagem.
  'skill-toji-3': {
    omitFx: true,
    useFxAsBody: true,
  },
  'skill-toji-4': {
    fxFlightFrameCount: 8,
    fxReleaseMs: 120,
    fxFlightRotate: false,
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
  for (const row of JJK_ROSTER) {
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
      (JJK_ROSTER.find((row) => row.id === w.id)?.omitSkillIndexes ?? []).map(Number),
    );
    const skillAnims = [];
    const hotbar = [];
    (w.skills || []).forEach((sk, i) => {
      const slot = typeof sk.index === 'number' ? sk.index : i;
      if (omitSkills.has(slot)) return;
      const skillId = sk.skillId;
      hotbar.push(skillId);
      const levels = [1, 5, 15, 30];
      skills.push({
        id: skillId,
        name: sk.skillName || `${w.name} · Especial ${slot + 1}`,
        requiredLevel: levels[slot] || 30,
        durationMs: sk.entry.durationMs || 800,
        hitDelayMs: sk.entry.hitDelayMs || 400,
        range: slot >= 2 ? 110 : 80,
        area: slot === 3,
        charName: w.name,
      });
      const override = FX_OVERRIDES[skillId] || {};
      const releaseMs = override.fxReleaseMs ?? sk.entry.hitDelayMs ?? 400;
      const flightN = override.fxFlightFrameCount;
      const useFxAsBody = Boolean(override.useFxAsBody && sk.fx);
      const omitFx = Boolean(override.omitFx) || useFxAsBody;
      const body = useFxAsBody ? sk.fx : sk.entry;
      const bodyKey = useFxAsBody ? `${w.id}-${sk.file}-fx` : `${w.id}-${sk.file}`;
      const bodyDuration =
        body.durationMs ||
        Math.ceil(((body.frameCount || 1) / Math.max(1, body.frameRate || 12)) * 1000);
      const bodyHit =
        useFxAsBody
          ? Math.max(120, Math.floor(bodyDuration * 0.45))
          : sk.entry.hitDelayMs || 400;
      if (useFxAsBody) {
        const skillRow = skills[skills.length - 1];
        skillRow.durationMs = bodyDuration;
        skillRow.hitDelayMs = bodyHit;
      }
      const fx =
        sk.fx && !omitFx
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
      fxAttach: 'caster' as const,`
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
      key: '${bodyKey}',
      url: '${body.image}',
      frameWidth: ${body.frameWidth},
      frameHeight: ${body.frameHeight},
      frameCount: ${body.frameCount},
      contentHeight: ${w.contentHeight},
      originX: ${num(body.originX)},
      frameRate: ${body.frameRate || 12},
      durationMs: ${bodyDuration},
      hitDelayMs: ${bodyHit}${fx}${hit},
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

  let skillIndex = 0;
  const skillTsFixed = skills
    .map((s) => {
      const slot = skillIndex % 4;
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
 * Auto-generated Jujutsu Kaisen MUGEN packs. Do not edit by hand.
 * npm run jjk:roster && npm run jjk:client
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

export const JUJUTSU_KAISEN_LOOK_TYPES = [
${wires.map((w) => `  ${w.lookType},`).join('\n')}
] as const;

${packChunks.join('\n\n')}

export const JUJUTSU_KAISEN_BY_SLUG: Record<string, CharacterPack> = {
${slugLines.join('\n')}
};

export const JUJUTSU_KAISEN_BY_LOOK_TYPE: Record<number, CharacterPack> = {
${lookLines.join('\n')}
};

export const JUJUTSU_KAISEN_PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
${previewLines.join('\n')}
};

export const JUJUTSU_KAISEN_HUNT_CHARACTERS = [
${huntLines.join('\n')}
];

export const JUJUTSU_KAISEN_PREFERRED_NAMES = [
${wires.map((w) => `  ${JSON.stringify(w.name)},`).join('\n')}
];

export const JUJUTSU_KAISEN_SKILLS: SkillDefinition[] = [
${skillTsFixed}
];
`;

  fs.writeFileSync(OUT, body);
  console.log('wrote', OUT, 'packs', wires.length, 'skills', skills.length);
}

main();
