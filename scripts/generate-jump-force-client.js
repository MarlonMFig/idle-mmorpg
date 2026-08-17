// Emit src/data/jump-force-packs.ts from public/sprites/player/{id}/wire.json
// npm run jf:client
const fs = require('fs');
const path = require('path');
const { JUMP_FORCE_ROSTER } = require('./lib/jump-force-roster');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'data', 'jump-force-packs.ts');
// Rotação atual: apenas Naruto e Dragon Ball. Ichigo fica preservado no roster/assets.
const ACTIVE_ROSTER = JUMP_FORCE_ROSTER.filter((row) => row.id !== 'ichigo');

/** Âncora / timing / range que o wire.json não expressa. */
const FX_OVERRIDES = {
  // Getsuga Tenshou e Crescend Getsuga são cortes de reiatsu à distância.
  'skill-ichigo-1': { fxAttach: 'target', range: 170 },
  'skill-ichigo-2': { fxAttach: 'target', range: 170 },
  // Giratory Sword gira em volta do próprio Ichigo.
  'skill-ichigo-3': { fxAttach: 'caster', fxGround: false, range: 100 },
  // Reiatsu Explosion estoura em área ao redor dele.
  'skill-ichigo-4': { fxAttach: 'caster', fxGround: false, range: 120 },
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
  for (const row of ACTIVE_ROSTER) {
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
      (ACTIVE_ROSTER.find((row) => row.id === w.id)?.omitSkillIndexes ?? []).map(Number),
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
      const releaseMs = override.fxReleaseMs ?? sk.entry.hitDelayMs ?? 400;
      const fxAttach = override.fxAttach === 'target' ? 'target' : 'caster';
      const fxGround = override.fxGround ?? fxAttach === 'caster';
      const fx = sk.fx
        ? `,
      fxReleaseMs: ${releaseMs},
      fxAttach: '${fxAttach}' as const,
      fxGround: ${fxGround} as const,
      fx: {
        key: '${w.id}-${sk.file}-fx',
        url: '${sk.fx.image}',
        frameWidth: ${sk.fx.frameWidth},
        frameHeight: ${sk.fx.frameHeight},
        frameCount: ${sk.fx.frameCount},
        contentHeight: ${sk.fx.contentHeight},
        originX: ${num(sk.fx.originX)},
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
      hitDelayMs: ${sk.entry.hitDelayMs || 400}${fx},
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
 * Auto-generated Jump Force MUGEN packs. Do not edit by hand.
 * npm run jf:roster && npm run jf:client
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

export const JUMP_FORCE_LOOK_TYPES = [
${wires.map((w) => `  ${w.lookType},`).join('\n')}
] as const;

${packChunks.join('\n\n')}

export const JUMP_FORCE_BY_SLUG: Record<string, CharacterPack> = {
${slugLines.join('\n')}
};

export const JUMP_FORCE_BY_LOOK_TYPE: Record<number, CharacterPack> = {
${lookLines.join('\n')}
};

export const JUMP_FORCE_PREVIEW_BY_LOOK_TYPE: Record<number, string> = {
${previewLines.join('\n')}
};

export const JUMP_FORCE_HUNT_CHARACTERS = [
${huntLines.join('\n')}
];

export const JUMP_FORCE_PREFERRED_NAMES = [
${wires.map((w) => `  ${JSON.stringify(w.name)},`).join('\n')}
];

export const JUMP_FORCE_SKILLS: SkillDefinition[] = [
${skillTs}
];
`;

  fs.writeFileSync(OUT, body);
  console.log('wrote', OUT, 'packs', wires.length, 'skills', skills.length);
}

main();
