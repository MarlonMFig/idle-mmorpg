'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  describeHeritageModifiers,
  getHeritageOptionMaxLevel,
  getHeritageOptionModifiersAtLevel,
  HERITAGE_GATES,
  HERITAGE_RANK_UNLOCK_LABELS,
  HERITAGE_SLOTS,
  type HeritageOptionDefinition,
  type HeritageSlotId,
} from '@/constants/heritage-system';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL, LINEAGE_LABELS } from '@/constants/lineage';
import { LINEAGE_CATALOG, getLineageCatalogEntry } from '@/data/lineages/catalog';
import {
  getHeritageClanIcon,
  getHeritageClanLevelIcon,
} from '@/data/heritage-clan-art';
import { getHeritageGateIcon } from '@/data/heritage-gate-art';
import { getHeritageSealIcon } from '@/data/heritage-seal-art';
import { useStore } from '@/hooks/use-store';
import { buildHeritageFinalStats } from '@/lib/heritage-stats';
import { getLoadoutOptionLevel } from '@/lib/heritage-modifiers';
import { computeInstanceTotals } from '@/lib/character-instance-stats';
import { accountStore } from '@/stores/account-store';
import { heritageStore } from '@/stores/heritage-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { MgrWindow } from '@/ui/mgr';
import type { HeritageLoadout } from '@/types/heritage';
import type { LineageId } from '@/types/character-meta';
import './heritage-mgr.css';

type HeritageTabId = 'gates' | HeritageSlotId;

const HERITAGE_TABS: readonly {
  id: HeritageTabId;
  label: string;
  slot?: HeritageSlotId;
}[] = [
  { id: 'gates', label: 'Portões do Chakra' },
  { id: 'cla', label: 'Clã', slot: 'cla' },
  { id: 'summon', label: 'Invocação', slot: 'summon' },
  { id: 'sennin', label: 'Modo Sennin', slot: 'sennin' },
  { id: 'cursedSeal', label: 'Selo Amaldiçoado', slot: 'cursedSeal' },
];

function formatMs(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function senninPhaseLabel(phase: string): string {
  if (phase === 'charging') return 'Acumulando chakra';
  if (phase === 'active') return 'Ativo';
  if (phase === 'cooldown') return 'Recarga';
  return 'Pronto';
}

function optionKey(slot: HeritageSlotId): keyof HeritageLoadout {
  if (slot === 'cla') return 'claId';
  if (slot === 'summon') return 'summonId';
  if (slot === 'sennin') return 'senninId';
  return 'cursedSealId';
}

function tabEquippedSummary(
  tabId: HeritageTabId,
  loadout: HeritageLoadout,
): string | null {
  if (tabId === 'gates') {
    if (loadout.openGateLevel <= 0) return null;
    const gate = HERITAGE_GATES.find((row) => row.level === loadout.openGateLevel);
    return gate ? gate.name : null;
  }
  const id = loadout[optionKey(tabId)];
  if (!id) return null;
  const option = HERITAGE_SLOTS[tabId].options.find((row) => row.id === id);
  if (!option) return null;
  const level = getLoadoutOptionLevel(loadout, option.id);
  if (option.tecnica) return `${option.name} · ${option.tecnica} Nv${level}`;
  return `${option.name} Nv${level}`;
}

/**
 * Menu Herança — abas por sistema; uma escolha por aba.
 * Arquétipo da conta (necessário à Graduação) fica no topo se ainda não escolhido.
 */
export function LineagePanel() {
  const isOpen = useStore(accountStore, (s) => s.isOpen);
  const progress = useStore(accountStore, (s) => s.lineageProgress);
  const level = useStore(vitalsStore, (s) => s.level);
  const loadout = useStore(heritageStore, (s) => s.loadout);
  useStore(heritageStore, (s) => s.sennin);
  const active = useStore(teamStore, (s) => s.collection.find((c) => c.id === s.activeId) ?? null);

  const playerLineageId = progress.lineageId;
  const activeRank = accountStore.getActiveRank();
  const unlockedLineage = level >= LINEAGE_SYSTEM_UNLOCK_LEVEL;

  const [selectedLineageId, setSelectedLineageId] = useState<LineageId>(
    playerLineageId ?? LINEAGE_CATALOG[0].id,
  );
  const [activeTab, setActiveTab] = useState<HeritageTabId>('gates');
  const [previewLoadout, setPreviewLoadout] = useState<HeritageLoadout | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    if (playerLineageId) setSelectedLineageId(playerLineageId);
  }, [isOpen, playerLineageId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        accountStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      heritageStore.tickSennin(t, false);
      setNow(t);
    }, 250);
    return () => window.clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    setPreviewLoadout(null);
  }, [activeTab]);

  const baseline = useMemo(() => {
    if (!active) return null;
    return computeInstanceTotals(active);
  }, [active]);

  const effectiveLoadout = previewLoadout ?? loadout;

  const stats = useMemo(() => {
    if (!baseline) return null;
    return buildHeritageFinalStats({
      loadout: effectiveLoadout,
      baselineTotals: baseline,
      senninActive: !previewLoadout && heritageStore.isSenninActive(now),
    });
  }, [baseline, effectiveLoadout, now, previewLoadout]);

  const senninStatus = heritageStore.getSenninStatus(now);

  if (!isOpen) return null;

  const withPreview = (next: HeritageLoadout) => setPreviewLoadout(next);
  const clearPreview = () => setPreviewLoadout(null);

  const selectedLineage = getLineageCatalogEntry(selectedLineageId);
  const canChooseLineage = unlockedLineage && playerLineageId == null;
  const activeSlotMeta =
    activeTab === 'gates' ? null : HERITAGE_SLOTS[activeTab];
  const slotUnlocked =
    activeTab === 'gates' || activeRank >= HERITAGE_SLOTS[activeTab].requiredRank;

  return (
    <MgrWindow
      title="Herança"
      lede="Escolha um caminho por aba"
      pill={`Rank ${activeRank || '—'}`}
      icon="◈"
      size="xl"
      ariaLabel="Herança"
      onClose={() => accountStore.setOpen(false)}
      className="heritage-mgr-window"
      bodyClassName="heritage-mgr__body"
      footer={
        stats ? (
          <div className="heritage-mgr__footer-stats" aria-live="polite">
            <span className="heritage-mgr__footer-label">
              {previewLoadout ? 'Prévia' : 'Status final'}
            </span>
            <span>{stats.previewLines.join(' · ')}</span>
          </div>
        ) : null
      }
    >
      <div className="heritage-mgr">
        {!playerLineageId ? (
          <section className="heritage-mgr__archetype" aria-label="Arquétipo da conta">
            <header className="heritage-mgr__section-head">
              <h3>Arquétipo</h3>
              <p>Necessário para Graduação. Escolha única por enquanto.</p>
            </header>
            {!unlockedLineage ? (
              <p className="heritage-mgr__locked">
                Libera no nível {LINEAGE_SYSTEM_UNLOCK_LEVEL} (atual: {level}).
              </p>
            ) : (
              <div className="heritage-mgr__archetype-row">
                {LINEAGE_CATALOG.map((lineage) => (
                  <button
                    key={lineage.id}
                    type="button"
                    className={`heritage-mgr__chip${selectedLineageId === lineage.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedLineageId(lineage.id)}
                  >
                    <Image src={lineage.iconSrc} alt="" width={28} height={28} unoptimized />
                    {lineage.name}
                  </button>
                ))}
                {canChooseLineage ? (
                  <button
                    type="button"
                    className="heritage-mgr__primary"
                    onClick={() => accountStore.chooseLineage(selectedLineage.id)}
                  >
                    Confirmar {selectedLineage.name}
                  </button>
                ) : null}
              </div>
            )}
          </section>
        ) : (
          <p className="heritage-mgr__archetype-note">
            Arquétipo: {LINEAGE_LABELS[playerLineageId]} · Graduação no menu Graduação
          </p>
        )}

        <nav className="heritage-mgr__tabs" role="tablist" aria-label="Sistemas de Herança">
          {HERITAGE_TABS.map((tab) => {
            const locked =
              tab.slot != null && activeRank < HERITAGE_SLOTS[tab.slot].requiredRank;
            const summary = tabEquippedSummary(tab.id, loadout);
            const isOn = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isOn}
                className={`heritage-mgr__tab${isOn ? ' is-on' : ''}${locked ? ' is-locked' : ''}${summary ? ' has-pick' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="heritage-mgr__tab-label">{tab.label}</span>
                {locked ? (
                  <span className="heritage-mgr__tab-meta">
                    {HERITAGE_RANK_UNLOCK_LABELS[HERITAGE_SLOTS[tab.slot!].requiredRank]}
                  </span>
                ) : summary ? (
                  <span className="heritage-mgr__tab-meta">{summary}</span>
                ) : (
                  <span className="heritage-mgr__tab-meta">Escolher</span>
                )}
              </button>
            );
          })}
        </nav>

        <section
          className="heritage-mgr__panel"
          role="tabpanel"
          aria-label={HERITAGE_TABS.find((tab) => tab.id === activeTab)?.label}
        >
          {activeTab === 'gates' ? (
            <>
              <header className="heritage-mgr__section-head">
                <h3>Portões do Chakra</h3>
                <p>
                  Escolha um portão ativo. Valores não somam. Desbloqueie em ordem; depois
                  troque livremente.
                </p>
              </header>
              <ul className="heritage-mgr__choice-grid heritage-mgr__choice-grid--gates">
                {HERITAGE_GATES.map((gate) => {
                  const isActive = loadout.openGateLevel === gate.level;
                  const unlocked = gate.level <= loadout.unlockedGateLevel;
                  const canUnlockNext = gate.level === loadout.unlockedGateLevel + 1;
                  const canToggle = unlocked || canUnlockNext;
                  const previewLevel = isActive ? 0 : gate.level;
                  const gateIcon = getHeritageGateIcon(gate.level);
                  const stateLabel = isActive
                    ? 'Ativo'
                    : unlocked
                      ? 'Disponível'
                      : canUnlockNext
                        ? 'Próximo'
                        : 'Bloqueado';
                  return (
                    <li key={gate.id}>
                      <button
                        type="button"
                        className={`heritage-mgr__choice heritage-mgr__choice--art${isActive ? ' is-selected' : ''}${!canToggle ? ' is-blocked' : ''}`}
                        disabled={!canToggle}
                        onMouseEnter={() =>
                          withPreview({ ...loadout, openGateLevel: previewLevel })
                        }
                        onMouseLeave={clearPreview}
                        onFocus={() => withPreview({ ...loadout, openGateLevel: previewLevel })}
                        onBlur={clearPreview}
                        onClick={() => heritageStore.toggleGate(gate.level)}
                      >
                        {gateIcon ? (
                          // eslint-disable-next-line @next/next/no-img-element -- GIF animado
                          <img
                            className="heritage-mgr__choice-art heritage-mgr__choice-art--gate"
                            src={gateIcon}
                            alt=""
                            width={64}
                            height={64}
                            draggable={false}
                          />
                        ) : null}
                        <span className="heritage-mgr__choice-kicker">
                          {gate.level}º · {stateLabel}
                        </span>
                        <span className="heritage-mgr__choice-title">{gate.name}</span>
                        <span className="heritage-mgr__choice-mods">
                          {describeHeritageModifiers(gate.modifiers).join(' · ')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : activeSlotMeta ? (
            <>
              <header className="heritage-mgr__section-head">
                <h3>{activeSlotMeta.name}</h3>
                {!slotUnlocked ? (
                  <p className="heritage-mgr__locked">
                    Libera no rank {HERITAGE_RANK_UNLOCK_LABELS[activeSlotMeta.requiredRank]}
                  </p>
                ) : activeTab === 'cla' ? (
                  loadout.claId ? (
                    <p>
                      Clã escolhido. Selecione o nível da técnica. Para trocar de clã, remova a
                      seleção.
                    </p>
                  ) : (
                    <p>Escolha um clã. A técnica de assinatura vem junto — a escolha é definitiva até remover.</p>
                  )
                ) : (
                  <p>Escolha apenas uma opção. Troca livre — o nível de cada opção é preservado.</p>
                )}
              </header>

              {activeTab === 'sennin' && slotUnlocked ? (
                <div className="heritage-mgr__sennin-bar" aria-live="polite">
                  <span className={`heritage-mgr__sennin-phase is-${senninStatus.phase}`}>
                    {senninPhaseLabel(senninStatus.phase)}
                  </span>
                  {senninStatus.phase !== 'idle' ? (
                    <span>{formatMs(senninStatus.remainingMs)}</span>
                  ) : null}
                  {senninStatus.equipped && senninStatus.phase === 'idle' ? (
                    <button
                      type="button"
                      className="heritage-mgr__primary"
                      onClick={() => heritageStore.startSenninCharge()}
                    >
                      Acumular chakra (30s sem atacar)
                    </button>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'cla' && slotUnlocked && loadout.claId ? (
                <ClanTechniqueLevels
                  loadout={loadout}
                  onPreview={withPreview}
                  onClearPreview={clearPreview}
                />
              ) : (
                <ul
                  className={`heritage-mgr__choice-grid${slotUnlocked ? '' : ' is-locked'}`}
                >
                  {activeSlotMeta.options.map((option) => (
                    <OptionCard
                      key={option.id}
                      slot={activeTab}
                      option={option}
                      equipped={loadout[optionKey(activeTab)] === option.id}
                      unlocked={slotUnlocked}
                      loadout={loadout}
                      onPreview={withPreview}
                      onClearPreview={clearPreview}
                      hideUpgrade={activeTab === 'cla'}
                    />
                  ))}
                </ul>
              )}

              {slotUnlocked && loadout[optionKey(activeTab)] ? (
                <button
                  type="button"
                  className="heritage-mgr__clear"
                  onClick={() => heritageStore.clearSlot(activeTab)}
                >
                  {activeTab === 'cla' ? 'Trocar de clã' : 'Remover seleção desta aba'}
                </button>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </MgrWindow>
  );
}

function ClanTechniqueLevels({
  loadout,
  onPreview,
  onClearPreview,
}: {
  loadout: HeritageLoadout;
  onPreview: (next: HeritageLoadout) => void;
  onClearPreview: () => void;
}) {
  const option = HERITAGE_SLOTS.cla.options.find((row) => row.id === loadout.claId);
  if (!option) return null;
  const currentLevel = getLoadoutOptionLevel(loadout, option.id);
  const tecnica = option.tecnica ?? option.name;
  const clanIcon = getHeritageClanIcon(option.id);

  return (
    <div className="heritage-mgr__clan-tech">
      <header className="heritage-mgr__clan-tech-head">
        {clanIcon ? (
          <Image
            className="heritage-mgr__clan-tech-icon"
            src={clanIcon}
            alt=""
            width={48}
            height={48}
            unoptimized
          />
        ) : null}
        <div className="heritage-mgr__clan-tech-copy">
          <strong>{option.name}</strong>
          <span>{tecnica}</span>
        </div>
      </header>
      <ul className="heritage-mgr__choice-grid heritage-mgr__choice-grid--levels">
        {option.levels.map((mods, index) => {
          const level = index + 1;
          const isActive = currentLevel === level;
          const levelIcon = getHeritageClanLevelIcon(option.id, level);
          const preview = {
            ...loadout,
            optionLevels: { ...loadout.optionLevels, [option.id]: level },
          } as HeritageLoadout;
          return (
            <li key={`${option.id}-lv${level}`}>
              <button
                type="button"
                className={`heritage-mgr__choice heritage-mgr__choice--art${isActive ? ' is-selected' : ''}`}
                onMouseEnter={() => onPreview(preview)}
                onMouseLeave={onClearPreview}
                onFocus={() => onPreview(preview)}
                onBlur={onClearPreview}
                onClick={() => {
                  heritageStore.setOptionLevel(option.id, level);
                  onClearPreview();
                }}
              >
                {levelIcon ? (
                  <Image
                    className="heritage-mgr__choice-art"
                    src={levelIcon}
                    alt=""
                    width={256}
                    height={256}
                    unoptimized
                  />
                ) : null}
                <span className="heritage-mgr__choice-kicker">
                  Nv{level}
                  {isActive ? ' · Ativo' : ''}
                </span>
                <span className="heritage-mgr__choice-title">
                  {tecnica} · Nível {level}
                </span>
                <span className="heritage-mgr__choice-mods">
                  {describeHeritageModifiers(mods).join(' · ')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OptionCard({
  slot,
  option,
  equipped,
  unlocked,
  loadout,
  onPreview,
  onClearPreview,
  hideUpgrade = false,
}: {
  slot: HeritageSlotId;
  option: HeritageOptionDefinition;
  equipped: boolean;
  unlocked: boolean;
  loadout: HeritageLoadout;
  onPreview: (next: HeritageLoadout) => void;
  onClearPreview: () => void;
  hideUpgrade?: boolean;
}) {
  const key = optionKey(slot);
  const level = getLoadoutOptionLevel(loadout, option.id);
  const maxLevel = getHeritageOptionMaxLevel(option);
  const currentMods = getHeritageOptionModifiersAtLevel(option, level);
  const nextMods =
    level < maxLevel ? getHeritageOptionModifiersAtLevel(option, level + 1) : null;
  const clanIcon = slot === 'cla' ? getHeritageClanIcon(option.id) : null;
  const sealIcon =
    slot === 'cursedSeal' ? getHeritageSealIcon(option.id, level) : null;
  const artIcon = clanIcon ?? sealIcon;
  const preview = {
    ...loadout,
    [key]: option.id,
    optionLevels: {
      ...loadout.optionLevels,
      [option.id]: loadout.optionLevels[option.id] ?? 1,
    },
  } as HeritageLoadout;

  return (
    <li>
      <div className={`heritage-mgr__choice-card${equipped ? ' is-selected' : ''}`}>
        <button
          type="button"
          className={`heritage-mgr__choice${artIcon ? ' heritage-mgr__choice--art' : ''}`}
          disabled={!unlocked}
          onMouseEnter={() => onPreview(preview)}
          onMouseLeave={onClearPreview}
          onFocus={() => onPreview(preview)}
          onBlur={onClearPreview}
          onClick={() => {
            if (!unlocked) return;
            heritageStore.equipSlot(slot, option.id);
            onClearPreview();
          }}
        >
          {clanIcon ? (
            <Image
              className="heritage-mgr__choice-art"
              src={clanIcon}
              alt=""
              width={256}
              height={256}
              unoptimized
            />
          ) : sealIcon ? (
            // eslint-disable-next-line @next/next/no-img-element -- GIF animado
            <img
              className="heritage-mgr__choice-art heritage-mgr__choice-art--seal"
              src={sealIcon}
              alt=""
              width={64}
              height={64}
              draggable={false}
            />
          ) : null}
          <span className="heritage-mgr__choice-kicker">
            {slot === 'cla'
              ? option.tecnica
                ? `Técnica · ${option.tecnica}`
                : 'Clã'
              : `Nv${level}/${maxLevel}${equipped ? ' · Equipado' : ''}`}
          </span>
          <span className="heritage-mgr__choice-title">{option.name}</span>
          {slot !== 'cla' && option.tecnica ? (
            <span className="heritage-mgr__choice-tecnica">{option.tecnica}</span>
          ) : null}
          <span className="heritage-mgr__choice-mods">
            {describeHeritageModifiers(
              slot === 'cla' ? getHeritageOptionModifiersAtLevel(option, 1) : currentMods,
            ).join(' · ')}
          </span>
          {slot === 'cla' ? (
            <span className="heritage-mgr__choice-next">Após escolher: níveis 1–5 da técnica</span>
          ) : nextMods ? (
            <span className="heritage-mgr__choice-next">
              Próx.: {describeHeritageModifiers(nextMods).join(' · ')}
            </span>
          ) : (
            <span className="heritage-mgr__choice-next">Nível máximo</span>
          )}
          {option.description ? (
            <span className="heritage-mgr__choice-desc">{option.description}</span>
          ) : null}
        </button>
        {unlocked && !hideUpgrade && level < maxLevel ? (
          <button
            type="button"
            className="heritage-mgr__upgrade"
            onClick={() => heritageStore.upgradeOption(option.id)}
          >
            Evoluir
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** @deprecated use LineagePanel */
export const ClanPanel = LineagePanel;
