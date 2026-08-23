import type * as Phaser from 'phaser';
import { listPackSheets, type CharacterPack } from '@/data/character-packs';
import { CharacterRegistry } from '@/data/characters/registry';
import { getSkill } from '@/data/skills';
import { getVfxDefinition, isSequenceVfx, sharedVfxTextureKey } from '@/data/vfx';
import type { CharacterDefinition } from '@/types/character-definition';

const PREFIX = '[CharacterValidation]';

function sheetIssues(label: string, sheet: { url?: string; frameWidth: number; frameHeight: number; frameCount: number }): string[] {
  const issues: string[] = [];
  if (!sheet.url) issues.push(`${label} missing asset url.`);
  if (!(sheet.frameWidth > 0) || !(sheet.frameHeight > 0)) {
    issues.push(`${label} invalid frame size ${sheet.frameWidth}×${sheet.frameHeight}.`);
  }
  if (!(sheet.frameCount > 0)) issues.push(`${label} frameCount must be > 0.`);
  return issues;
}

export function validateCharacterDefinition(def: CharacterDefinition): string[] {
  const issues: string[] = [];
  const { pack, id } = def;

  issues.push(...sheetIssues('walk', pack.walk));
  issues.push(...sheetIssues('attack', pack.attack));
  if (pack.idle) issues.push(...sheetIssues('idle', pack.idle));

  pack.hotbarSkillIds.forEach((skillId, index) => {
    if (!skillId) return;
    if (!getSkill(skillId) && def.active) {
      issues.push(`special${index + 1} (${skillId}) is not in the skill catalog.`);
    }
    if (!pack.skillAnims[skillId]) {
      issues.push(`special${index + 1} references missing animation.`);
    }
  });

  for (const [skillId, anim] of Object.entries(pack.skillAnims)) {
    issues.push(...sheetIssues(`skill ${skillId}`, anim));
    if (anim.hitDelayMs == null || anim.hitDelayMs < 0) {
      issues.push(`skill ${skillId} missing hitDelay.`);
    }
    if (anim.fx) {
      issues.push(...sheetIssues(`VFX ${skillId}`, anim.fx));
    }
    if (anim.fxSecondary) {
      issues.push(...sheetIssues(`VFX secondary ${skillId}`, anim.fxSecondary));
    }
  }

  return issues.map((issue) => `${PREFIX} ${id}: ${issue}`);
}

export function validateAllCharacterDefinitions(options?: { includeInactive?: boolean }): string[] {
  const messages: string[] = [];
  const seen = new Set<string>();
  for (const def of CharacterRegistry.list({ includeInactive: options?.includeInactive !== false })) {
    if (seen.has(def.id)) {
      messages.push(`${PREFIX} duplicate pack id: ${def.id}`);
      continue;
    }
    seen.add(def.id);
    messages.push(...validateCharacterDefinition(def));
  }
  return messages;
}

/** Depois do preload Phaser: textura ausente (personagem não some em silêncio). */
export function validateLoadedCharacterAssets(
  scene: Phaser.Scene,
  pack: CharacterPack,
): string[] {
  const messages: string[] = [];
  for (const sheet of listPackSheets(pack)) {
    if (!scene.textures.exists(sheet.key)) {
      messages.push(`${PREFIX} ${pack.id}: asset not found (${sheet.key} → ${sheet.url}).`);
    }
  }
  for (const anim of Object.values(pack.skillAnims)) {
    if (!anim.vfxId) continue;
    const def = getVfxDefinition(anim.vfxId);
    if (!def || !isSequenceVfx(def)) continue;
    const key = sharedVfxTextureKey(def.id);
    if (!scene.textures.exists(key)) {
      messages.push(`${PREFIX} ${pack.id}: sequence VFX not found (${key}).`);
    }
  }
  return messages;
}

export function logCharacterValidation(messages: readonly string[]): void {
  for (const message of messages) console.warn(message);
}

export function runDevCharacterValidation(scene?: Phaser.Scene, pack?: CharacterPack): void {
  const dataIssues = validateAllCharacterDefinitions({ includeInactive: true });
  logCharacterValidation(dataIssues);
  if (scene && pack) {
    logCharacterValidation(validateLoadedCharacterAssets(scene, pack));
  }
}
