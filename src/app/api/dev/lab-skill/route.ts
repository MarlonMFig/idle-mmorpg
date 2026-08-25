import { NextResponse } from 'next/server';
import { isSkillVfxTargetMode } from '@/lib/dev/lab-save-fields';
import { parseSkillExecution } from '@/data/skill-execution-def';
import { parseSkillAi } from '@/data/skill-ai-def';
import { parseSkillStatusEffects } from '@/data/status-effect-def';
import { isDevWriteAllowed } from '@/lib/dev/dev-write-guard';
import {
  buildLabVisualSkillAnim,
  buildVisualSkillDefinition,
  fallbackSkillAnimStub,
  type CharacterSkillAnimDef,
} from '@/lib/dev/lab-skill-ops';
import { labDraftHasVisual, labPoseHasContent, parseLabPoseSheet, poseDurationMs } from '@/lib/dev/lab-pose-sheet';
import { padOfficialHotbar, type LabSkillSlot, type OfficialHotbar } from '@/lib/dev/lab-skill-slots';
import { findCharacterSourceFile } from '@/lib/dev/find-character-source';
import { saveLog } from '@/lib/dev/save-log';
import { SaveClock } from '@/lib/dev/save-timing';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import {
  insertSkillAnimStub,
  parseLabSaveChanges,
  patchCharacterHotbar,
  patchCharacterSource,
  patchSkillPoseSheet,
  upsertSkillAnimSource,
} from '@/lib/dev/patch-character-source';
import { insertLabVisualSkill, patchLabVisualSkillElement } from '@/lib/dev/patch-lab-visual-skills';
import { upsertDevHotbar, upsertDevSkillAnim, upsertDevSkillDef } from '@/lib/dev/dev-runtime-registry';

function deny() {
  return NextResponse.json({ success: false, ok: false, error: 'forbidden' }, { status: 403 });
}

function asSlot(value: unknown): LabSkillSlot | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

function asHotbar(value: unknown): OfficialHotbar | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  return padOfficialHotbar(
    value.slice(0, 4).map((entry) => (typeof entry === 'string' && entry ? entry : null)),
  );
}

export async function POST(request: Request) {
  if (!isDevWriteAllowed()) return deny();
  const clock = new SaveClock();
  saveLog('request received: 0ms', 'lab-skill');
  try {
    const raw = await request.text();
    clock.mark('request body');
    saveLog(`payload bytes ${raw.length}`);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const action = String(body.action ?? '');
    const characterId = String(body.characterId ?? '').trim();
    if (!characterId) {
      return NextResponse.json({ success: false, ok: false, error: 'characterId obrigatório' }, { status: 400 });
    }
    if (!findCharacterSourceFile(characterId)) {
      return NextResponse.json(
        { success: false, ok: false, error: `Personagem ${characterId} não encontrado` },
        { status: 404 },
      );
    }
    clock.mark('source resolved');

    const slotsFromBody = asHotbar(body.slots);

    if (action === 'reorder') {
      const slots = asHotbar(body.slots);
      if (!slots) {
        return NextResponse.json({ success: false, ok: false, error: 'slots inválidos' }, { status: 400 });
      }
      const result = patchCharacterHotbar(characterId, slots, { persist: false });
      clock.mark('transform');
      writeDevSourceAfterResponse(result.absPath, result.source);
      clock.mark('write');
      const elapsed = clock.done();
      return NextResponse.json(
        { success: true, ok: true, file: result.relativePath, slots, characterId },
        { headers: { 'x-dev-save-ms': String(elapsed) } },
      );
    }

    if (action === 'assign' || action === 'clear-slot') {
      const slot = asSlot(body.slot);
      if (!slot) {
        return NextResponse.json({ success: false, ok: false, error: 'slot inválido' }, { status: 400 });
      }
      const skillId =
        action === 'clear-slot' ? null : typeof body.skillId === 'string' ? body.skillId.trim() : '';
      if (action === 'assign' && !skillId) {
        return NextResponse.json({ success: false, ok: false, error: 'skillId obrigatório' }, { status: 400 });
      }
      const next = slotsFromBody ?? padOfficialHotbar([null, null, null, null]);
      next[slot - 1] = action === 'clear-slot' ? null : skillId;
      let source: string | undefined;
      let animFile: string | undefined;
      let skillAnim: CharacterSkillAnimDef | undefined;
      if (skillId) {
        const stub = fallbackSkillAnimStub();
        const inserted = insertSkillAnimStub(characterId, skillId, stub, { persist: false });
        source = inserted.source;
        animFile = inserted.relativePath;
        skillAnim = stub;
      }
      const hotbar = patchCharacterHotbar(characterId, next, { source, persist: false });
      writeDevSourceAfterResponse(hotbar.absPath, hotbar.source);
      saveLog('response sent', action);
      return NextResponse.json({
        success: true,
        ok: true,
        file: hotbar.relativePath,
        animFile,
        slots: next,
        skillId,
        skillAnim,
        characterId,
      });
    }

    if (action === 'create') {
      const slot = asSlot(body.slot);
      if (!slot) {
        return NextResponse.json({ success: false, ok: false, error: 'slot inválido' }, { status: 400 });
      }
      const skill = buildVisualSkillDefinition(String(body.id ?? ''), String(body.name ?? ''));
      const catalog = insertLabVisualSkill(skill, { persist: false });
      const stub = fallbackSkillAnimStub();
      const animFile = insertSkillAnimStub(characterId, skill.id, stub, { persist: false });
      const next = slotsFromBody ?? padOfficialHotbar([null, null, null, null]);
      next[slot - 1] = skill.id;
      const hotbar = patchCharacterHotbar(characterId, next, { source: animFile.source, persist: false });
      writeDevSourceAfterResponse(catalog.absPath, catalog.source);
      writeDevSourceAfterResponse(hotbar.absPath, hotbar.source);
      saveLog('response sent', 'create');
      return NextResponse.json({
        success: true,
        ok: true,
        file: catalog.relativePath,
        packFile: hotbar.relativePath,
        animFile: animFile.relativePath,
        skill,
        skillAnim: stub,
        slots: next,
        characterId,
        slot,
      });
    }

    if (action === 'save-visual') {
      const slot = asSlot(body.slot);
      if (!slot) {
        return NextResponse.json({ success: false, ok: false, error: 'slot inválido' }, { status: 400 });
      }
      const pose = parseLabPoseSheet(body.pose);
      const vfxId = typeof body.vfxId === 'string' && body.vfxId.trim() ? body.vfxId.trim() : null;
      const targetMode = isSkillVfxTargetMode(body.targetMode) ? body.targetMode : 'caster';
      const asNum = (value: unknown, fallback: number) =>
        typeof value === 'number' && Number.isFinite(value) ? value : fallback;
      const changes = parseLabSaveChanges({
        vfxId,
        targetMode,
        travelSpeed: asNum(body.travelSpeed, 600),
        vfxScale: asNum(body.vfxScale, 1),
        vfxOffsetX: asNum(body.vfxOffsetX, 0),
        vfxOffsetY: asNum(body.vfxOffsetY, 0),
        ...(typeof body.vfxLoopMode === 'string' ? { vfxLoopMode: body.vfxLoopMode } : {}),
        ...(body.vfxLoopStartFrame != null ? { vfxLoopStartFrame: asNum(body.vfxLoopStartFrame, 1) } : {}),
        ...(body.vfxLoopEndFrame != null ? { vfxLoopEndFrame: asNum(body.vfxLoopEndFrame, 1) } : {}),
        ...(body.vfxLoopDurationMs != null ? { vfxLoopDurationMs: asNum(body.vfxLoopDurationMs, 3000) } : {}),
        ...(body.vfxLoopUntilSkillEnd != null ? { vfxLoopUntilSkillEnd: Boolean(body.vfxLoopUntilSkillEnd) } : {}),
        ...(body.vfxFlipX != null ? { vfxFlipX: Boolean(body.vfxFlipX) } : {}),
        ...(body.vfxFlipY != null ? { vfxFlipY: Boolean(body.vfxFlipY) } : {}),
        spawnOffsetX: asNum(body.spawnOffsetX, 0),
        spawnOffsetY: asNum(body.spawnOffsetY, 0),
        targetOffsetX: asNum(body.targetOffsetX, 0),
        targetOffsetY: asNum(body.targetOffsetY, 0),
        castDelayMs: asNum(body.castDelayMs, 0),
        execution: body.execution !== undefined ? parseSkillExecution(body.execution) : undefined,
        statusEffects:
          body.statusEffects !== undefined ? parseSkillStatusEffects(body.statusEffects) : undefined,
        ...(typeof body.element === 'string' ? { element: body.element } : {}),
        ...(body.ai !== undefined ? { ai: parseSkillAi(body.ai) } : {}),
      });
      clock.mark('validation');
      const effectId = changes.vfxId ?? null;
      if (!labDraftHasVisual(pose, effectId) && !body.skillId) {
        return NextResponse.json(
          { success: false, ok: false, error: 'Configure Animação Pose ou VFX Efeito antes de salvar.' },
          { status: 400 },
        );
      }

      const existingId = typeof body.skillId === 'string' && body.skillId.trim() ? body.skillId.trim() : '';
      let skillId = existingId;
      let skill: ReturnType<typeof buildVisualSkillDefinition> | undefined;
      let catalogFile: string | undefined;

      if (!existingId) {
        skill = buildVisualSkillDefinition(String(body.id ?? ''), String(body.name ?? ''));
        skillId = skill.id;
        const catalog = insertLabVisualSkill(skill, { persist: false });
        catalogFile = catalog.relativePath;
        writeDevSourceAfterResponse(catalog.absPath, catalog.source);
      }

      if (changes.element && skill) {
        skill = { ...skill, element: changes.element };
        if (skill.developmentStatus === 'visual-test') {
          const catalog = patchLabVisualSkillElement(skill.id, changes.element, { persist: false });
          catalogFile = catalog.relativePath;
          writeDevSourceAfterResponse(catalog.absPath, catalog.source);
        }
      }

      const existingAnim =
        body.existingAnim && typeof body.existingAnim === 'object'
          ? (body.existingAnim as CharacterSkillAnimDef)
          : undefined;
      const skillAnim = buildLabVisualSkillAnim({
        existing: existingAnim,
        pose,
        changes: { ...changes, vfxId: effectId },
        vfxId: effectId,
        targetMode: changes.targetMode ?? 'caster',
        travelSpeed: changes.travelSpeed ?? 600,
        vfxScale: changes.vfxScale ?? 1,
        vfxOffsetX: changes.vfxOffsetX ?? 0,
        vfxOffsetY: changes.vfxOffsetY ?? 0,
        spawnOffsetX: changes.spawnOffsetX ?? 0,
        spawnOffsetY: changes.spawnOffsetY ?? 0,
        targetOffsetX: changes.targetOffsetX ?? 0,
        targetOffsetY: changes.targetOffsetY ?? 0,
        castDelayMs: changes.castDelayMs ?? 0,
      });

      let animFile: string;
      let source: string;
      if (!existingAnim) {
        const inserted = upsertSkillAnimSource(characterId, skillId, skillAnim, { persist: false });
        source = inserted.source;
        animFile = inserted.relativePath;
      } else {
        let nextSource: string | undefined;
        if (labPoseHasContent(pose) && pose) {
          const posed = patchSkillPoseSheet(
            characterId,
            skillId,
            {
              key: pose.key,
              url: pose.url || pose.frames?.[0] || existingAnim.url,
              frames: pose.frames,
              frameWidth: pose.frameWidth || existingAnim.frameWidth,
              frameHeight: pose.frameHeight || existingAnim.frameHeight,
              frameCount: pose.frames?.length || pose.frameCount || existingAnim.frameCount,
              frameRate: pose.frameRate,
              loop: pose.loop,
              loopMode: pose.loopMode,
              loopStartFrame: pose.loopStartFrame,
              loopEndFrame: pose.loopEndFrame,
              loopDurationMs: pose.loopDurationMs,
              loopUntilSkillEnd: pose.loopUntilSkillEnd,
              flipX: pose.flipX,
              flipY: pose.flipY,
              offsetX: pose.offsetX,
              offsetY: pose.offsetY,
              durationMs: poseDurationMs(pose),
              scaleX: pose.scaleX,
              scaleY: pose.scaleY,
            },
            { persist: false },
          );
          nextSource = posed.source;
          animFile = posed.relativePath;
        }
        const patched = patchCharacterSource(
          {
            characterId,
            skillId,
            changes: { ...changes, vfxId: effectId },
          },
          { source: nextSource, persist: false },
        );
        source = patched.source;
        animFile = patched.relativePath;
      }

      const next = slotsFromBody ?? padOfficialHotbar([null, null, null, null]);
      next[slot - 1] = skillId;
      const hotbar = patchCharacterHotbar(characterId, next, { source, persist: false });
      clock.mark('transform');
      upsertDevHotbar(characterId, next);
      upsertDevSkillAnim(characterId, skillId, skillAnim);
      if (skill) upsertDevSkillDef(skill);
      writeDevSourceAfterResponse(hotbar.absPath, hotbar.source);
      clock.mark('write');
      const elapsed = clock.done();
      return NextResponse.json(
        {
          success: true,
          ok: true,
          file: catalogFile ?? hotbar.relativePath,
          packFile: hotbar.relativePath,
          animFile,
          skill,
          skillAnim,
          slots: next,
          skillId,
          characterId,
          slot,
        },
        { headers: { 'x-dev-save-ms': String(elapsed) } },
      );
    }

    return NextResponse.json({ success: false, ok: false, error: 'action inválida' }, { status: 400 });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[DEV lab-skill]', detail);
    return NextResponse.json({ success: false, ok: false, error: detail }, { status: 400 });
  }
}
