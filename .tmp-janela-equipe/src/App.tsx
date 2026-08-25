import React, { useState, useEffect } from 'react';
import { Character, TeamPreset, Equipment, Rarity } from './types';
import { INITIAL_CHARACTERS, INITIAL_PRESETS } from './data/characters';
import { TeamFormation } from './components/TeamFormation';
import { CharacterInspector } from './components/CharacterInspector';
import { BoxInventory } from './components/BoxInventory';
import { PresetsPanel } from './components/PresetsPanel';
import { ForgeModal } from './components/ForgeModal';
import { SkillsModal } from './components/SkillsModal';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { sound } from './utils/audio';
import { 
  Swords, 
  Sparkles, 
  Coins, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  X, 
  Bookmark, 
  Layers, 
  Flame, 
  Award,
  CheckCircle,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';

export default function App() {
  // State for characters
  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('rpg_characters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CHARACTERS;
      }
    }
    return INITIAL_CHARACTERS;
  });

  // State for presets
  const [presets, setPresets] = useState<TeamPreset[]>(() => {
    const saved = localStorage.getItem('rpg_presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_PRESETS;
      }
    }
    return INITIAL_PRESETS;
  });

  // Active preset ID
  const [activePresetId, setActivePresetId] = useState<string>('preset-1');

  // Currently active team slot character IDs (3 slots)
  const [teamSlotIds, setTeamSlotIds] = useState<(string | null)[]>(() => {
    const p = INITIAL_PRESETS[0];
    return p ? [...p.slotIds] : ['char-sasuke', null, null];
  });

  // Index of the leader (0, 1, or 2)
  const [leaderSlotIndex, setLeaderSlotIndex] = useState<number>(0);

  // Selected character ID in inspector
  const [selectedCharId, setSelectedCharId] = useState<string>('char-sasuke');

  // User Currencies & Resources
  const [userCopper, setUserCopper] = useState<number>(15000);
  const [userAwakeningMaterials, setUserAwakeningMaterials] = useState<number>(4);

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'main' | 'presets' | 'awakening'>('main');

  // Modals
  const [isForgeOpen, setIsForgeOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('rpg_characters', JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    localStorage.setItem('rpg_presets', JSON.stringify(presets));
  }, [presets]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Helper to find selected character
  const selectedCharacter = characters.find((c) => c.id === selectedCharId) || characters[0];

  // Helper to resolve team slot objects
  const teamSlotCharacters = teamSlotIds.map((id) => {
    if (!id) return null;
    return characters.find((c) => c.id === id) || null;
  });

  // Sound toggle handler
  const handleToggleSound = () => {
    const nextState = !isSoundMuted;
    setIsSoundMuted(nextState);
    sound.enabled = !nextState;
    if (!nextState) sound.playSelect();
  };

  // Team Slot operations
  const handleRemoveFromSlot = (slotIndex: number) => {
    const next = [...teamSlotIds];
    const removedCharId = next[slotIndex];
    next[slotIndex] = null;
    setTeamSlotIds(next);

    if (removedCharId) {
      const char = characters.find((c) => c.id === removedCharId);
      showToast(`${char?.name || 'Herói'} removido da formação.`);
    }
  };

  const handleSetLeader = (slotIndexOrId: number | string) => {
    if (typeof slotIndexOrId === 'number') {
      setLeaderSlotIndex(slotIndexOrId);
      const char = teamSlotCharacters[slotIndexOrId];
      if (char) {
        showToast(`${char.name} agora é o LÍDER ATIVO da equipe!`);
      }
    } else {
      const idx = teamSlotIds.indexOf(slotIndexOrId);
      if (idx !== -1) {
        setLeaderSlotIndex(idx);
        const char = characters.find((c) => c.id === slotIndexOrId);
        showToast(`${char?.name || 'Herói'} definido como LÍDER!`);
      }
    }
  };

  const handleEmptySlotClick = (slotIndex: number) => {
    // If selected char is not in team, equip them to this slot
    if (selectedCharacter && !teamSlotIds.includes(selectedCharacter.id)) {
      const next = [...teamSlotIds];
      next[slotIndex] = selectedCharacter.id;
      setTeamSlotIds(next);
      showToast(`${selectedCharacter.name} equipado na posição ${slotIndex + 1}!`);
    }
  };

  const handleEquipToTeam = (charId: string) => {
    const existingIndex = teamSlotIds.indexOf(charId);
    if (existingIndex !== -1) return; // already in team

    // Find first empty slot
    const emptyIndex = teamSlotIds.findIndex((id) => id === null);
    if (emptyIndex !== -1) {
      const next = [...teamSlotIds];
      next[emptyIndex] = charId;
      setTeamSlotIds(next);
      const char = characters.find((c) => c.id === charId);
      showToast(`${char?.name || 'Herói'} adicionado à equipe!`);
    } else {
      // Replace slot 2 (or non-leader slot)
      const next = [...teamSlotIds];
      const replaceIndex = leaderSlotIndex === 0 ? 1 : 0;
      next[replaceIndex] = charId;
      setTeamSlotIds(next);
      const char = characters.find((c) => c.id === charId);
      showToast(`Equipe cheia. ${char?.name || 'Herói'} substituiu a posição ${replaceIndex + 1}.`);
    }
  };

  const handleRemoveFromTeam = (charId: string) => {
    const next = teamSlotIds.map((id) => (id === charId ? null : id));
    setTeamSlotIds(next);
    const char = characters.find((c) => c.id === charId);
    showToast(`${char?.name || 'Herói'} removido da equipe.`);
  };

  // Character status toggles
  const handleToggleFavorite = (id: string) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  };

  const handleToggleLock = (id: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextLock = !c.isLocked;
          showToast(nextLock ? `${c.name} bloqueado contra descarte.` : `${c.name} desbloqueado.`);
          return { ...c, isLocked: nextLock };
        }
        return c;
      })
    );
  };

  // Awakening logic
  const handleAwaken = (id: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStage = c.awakeningStage + 1;
          const costCopper = nextStage === 1 ? 1000 : nextStage === 2 ? 5000 : 15000;
          const costMaterial = nextStage === 1 ? 1 : nextStage === 2 ? 3 : 5;

          setUserCopper((curr) => Math.max(0, curr - costCopper));
          setUserAwakeningMaterials((curr) => Math.max(0, curr - costMaterial));

          showToast(`⚡ Parabéns! ${c.name} atingiu o DESPERTAR ${['I', 'II', 'III'][c.awakeningStage]}! (+20% em todos os atributos)`);

          return {
            ...c,
            awakeningStage: nextStage,
            hp: Math.round(c.hp * 1.2),
            maxHp: Math.round(c.maxHp * 1.2),
            atk: Math.round(c.atk * 1.2),
            def: Math.round(c.def * 1.2),
            chakra: Math.round(c.chakra * 1.15),
            maxChakra: Math.round(c.maxChakra * 1.15),
            critRate: Math.min(100, c.critRate + 5),
          };
        }
        return c;
      })
    );
  };

  // Mastery XP
  const handleAddMasteryXp = (id: string, amount: number) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          let newXp = c.masteryXp + amount;
          let newLevel = c.masteryLevel;
          while (newXp >= c.maxMasteryXp && newLevel < 100) {
            newXp -= c.maxMasteryXp;
            newLevel += 1;
          }
          if (newLevel > c.masteryLevel) {
            showToast(`🎖️ Maestria de ${c.name} subiu para o Nível ${newLevel}!`);
          }
          return {
            ...c,
            masteryLevel: newLevel,
            masteryXp: newXp,
          };
        }
        return c;
      })
    );
  };

  const handleResetMastery = (id: string) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, masteryLevel: 0, masteryXp: 0 } : c))
    );
    showToast(`Maestria resetada para o nível 0.`);
  };

  // Star upgrade
  const handleAddStars = (id: string) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === id && c.fragments >= c.maxFragments && c.stars < 5) {
          showToast(`⭐ ${c.name} ascendeu para ${c.stars + 1} Estrelas!`);
          return {
            ...c,
            stars: c.stars + 1,
            fragments: c.fragments - c.maxFragments,
            atk: Math.round(c.atk * 1.15),
            def: Math.round(c.def * 1.15),
            hp: Math.round(c.hp * 1.15),
          };
        }
        return c;
      })
    );
  };

  // Equipment Forge
  const handleEquipItem = (slot: keyof Character['equipment'], item: Equipment | undefined) => {
    if (!selectedCharacter) return;
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === selectedCharacter.id) {
          const nextEquipment = { ...c.equipment, [slot]: item };
          return { ...c, equipment: nextEquipment };
        }
        return c;
      })
    );
    showToast(item ? `${item.name} equipado com sucesso!` : `Equipamento removido.`);
  };

  // Presets operations
  const handleApplyPreset = (preset: TeamPreset) => {
    setActivePresetId(preset.id);
    setTeamSlotIds([...preset.slotIds]);
    setLeaderSlotIndex(preset.leaderSlotIndex);
    showToast(`Preset "${preset.name}" ativado com sucesso!`);
  };

  const handleSaveCurrentToPreset = (presetId: string) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id === presetId) {
          return {
            ...p,
            slotIds: [...teamSlotIds],
            leaderSlotIndex,
          };
        }
        return p;
      })
    );
    showToast(`Formação atual salva no preset selecionado!`);
  };

  const handleClearPreset = (presetId: string) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === presetId ? { ...p, slotIds: [null, null, null] } : p))
    );
    if (activePresetId === presetId) {
      setTeamSlotIds([null, null, null]);
    }
    showToast(`Preset limpo com sucesso.`);
  };

  const handleAddNewPreset = (name: string) => {
    const newPreset: TeamPreset = {
      id: `preset-${Date.now()}`,
      name,
      slotIds: [...teamSlotIds],
      leaderSlotIndex,
    };
    setPresets((prev) => [...prev, newPreset]);
    showToast(`Novo preset "${name}" criado e salvo!`);
  };

  // Dev Tools Operations
  const handleSetAwakeningDev = (charId: string, stage: number) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === charId ? { ...c, awakeningStage: stage } : c))
    );
    showToast(`DEV: Despertar de ${selectedCharacter.name} definido para Estágio ${stage}.`);
  };

  const handleLevelUpCharDev = (charId: string, levels: number) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === charId) {
          const nextLvl = Math.min(100, c.level + levels);
          return {
            ...c,
            level: nextLvl,
            hp: c.hp + levels * 30,
            maxHp: c.maxHp + levels * 30,
            atk: c.atk + levels * 8,
            def: c.def + levels * 5,
          };
        }
        return c;
      })
    );
    showToast(`DEV: Nível aumentado em +${levels}!`);
  };

  const handleAddStarFragmentsDev = (charId: string, amount: number) => {
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === charId) {
          return { ...c, fragments: Math.min(c.maxFragments, c.fragments + amount) };
        }
        return c;
      })
    );
    showToast(`DEV: +${amount} Fragmentos de estrela concedidos.`);
  };

  const handleResetCharDev = (charId: string) => {
    const initial = INITIAL_CHARACTERS.find((c) => c.id === charId);
    if (initial) {
      setCharacters((prev) => prev.map((c) => (c.id === charId ? { ...initial } : c)));
      showToast(`DEV: ${initial.name} restaurado para os atributos iniciais.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white flex flex-col p-3 sm:p-5 md:p-8 selection:bg-blue-500/30 selection:text-blue-200 relative overflow-hidden">
      {/* Background Graphic Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-25" />
      </div>

      {/* Main Game Modal / Window Container */}
      <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col gap-6 relative z-10">
        {/* Window Top Titlebar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Swords className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-white font-['Rajdhani']">
                  Formação de Equipe
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-mono font-bold">
                  {teamSlotIds.filter(Boolean).length}/3 ATIVOS
                </span>
              </div>
              <p className="text-xs text-white/50">
                Selecione e gerencie sua tríade de combate para missões e arenas
              </p>
            </div>
          </div>

          {/* Navigation View Switcher */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 backdrop-blur-xl">
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('main');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'main'
                  ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Equipe & BOX
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('presets');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Presets
            </button>
          </div>

          {/* Top Status & Currency Bar */}
          <div className="flex items-center gap-3">
            {/* Copper */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono">
              <Coins className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-white font-bold">{userCopper.toLocaleString('pt-BR')}</span>
              <span className="text-white/40 text-[10px] uppercase">Cobre</span>
            </div>

            {/* Awakening Materials */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/30 text-xs font-mono hidden sm:flex">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-300 font-bold">{userAwakeningMaterials}</span>
              <span className="text-purple-400/60 text-[10px] uppercase">Cristais</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition cursor-pointer"
              title={isSoundMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos'}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Help / Guide */}
            <button
              onClick={() => {
                sound.playClick();
                setIsHelpOpen(true);
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition cursor-pointer"
              title="Guia de Equipe e Maestria"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Toast notification */}
        {toastMessage && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-blue-500/40 text-blue-200 text-xs font-medium flex items-center justify-between shadow-[0_0_20px_rgba(59,130,246,0.2)] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/40 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-6">
          {/* Preset Management View */}
          {activeTab === 'presets' ? (
            <div className="space-y-6">
              <PresetsPanel
                presets={presets}
                activePresetId={activePresetId}
                characters={characters}
                currentTeamSlots={teamSlotIds}
                currentLeaderIndex={leaderSlotIndex}
                onApplyPreset={handleApplyPreset}
                onSaveCurrentToPreset={handleSaveCurrentToPreset}
                onClearPreset={handleClearPreset}
                onAddNewPreset={handleAddNewPreset}
              />
              <TeamFormation
                slots={teamSlotCharacters}
                leaderSlotIndex={leaderSlotIndex}
                selectedCharId={selectedCharId}
                onSelectCharacter={(char) => setSelectedCharId(char.id)}
                onRemoveFromSlot={handleRemoveFromSlot}
                onSetLeader={handleSetLeader}
                onEmptySlotClick={handleEmptySlotClick}
              />
            </div>
          ) : (
            /* Main Team & Box View */
            <div className="space-y-6">
              {/* 1. Team Formation Header (3 Slots + Combat Power) */}
              <TeamFormation
                slots={teamSlotCharacters}
                leaderSlotIndex={leaderSlotIndex}
                selectedCharId={selectedCharId}
                onSelectCharacter={(char) => setSelectedCharId(char.id)}
                onRemoveFromSlot={handleRemoveFromSlot}
                onSetLeader={handleSetLeader}
                onEmptySlotClick={handleEmptySlotClick}
              />

              {/* 2. Split Workspace: Character Inspector (Left) & Box Inventory (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Character Inspector (Detailed Status, Maestria, Despertar) */}
                <div className="lg:col-span-7 space-y-4">
                  {selectedCharacter ? (
                    <CharacterInspector
                      character={selectedCharacter}
                      isLeader={teamSlotIds.indexOf(selectedCharacter.id) === leaderSlotIndex && teamSlotIds.includes(selectedCharacter.id)}
                      isInTeam={teamSlotIds.includes(selectedCharacter.id)}
                      userCopper={userCopper}
                      userAwakeningMaterials={userAwakeningMaterials}
                      onToggleFavorite={handleToggleFavorite}
                      onToggleLock={handleToggleLock}
                      onSetLeader={handleSetLeader}
                      onToggleTeamMember={(id) => {
                        if (teamSlotIds.includes(id)) {
                          handleRemoveFromTeam(id);
                        } else {
                          handleEquipToTeam(id);
                        }
                      }}
                      onAwaken={handleAwaken}
                      onAddMasteryXp={handleAddMasteryXp}
                      onResetMastery={handleResetMastery}
                      onAddStars={handleAddStars}
                      onOpenForge={() => setIsForgeOpen(true)}
                      onOpenSkills={() => setIsSkillsOpen(true)}
                    />
                  ) : (
                    <div className="p-12 text-center text-white/40 bg-black/40 rounded-2xl border border-white/5">
                      Selecione um herói na BOX para inspecionar
                    </div>
                  )}
                </div>

                {/* Box Inventory (Characters list, Rarity filter pills, Search, Sort) */}
                <div className="lg:col-span-5">
                  <BoxInventory
                    characters={characters}
                    selectedCharId={selectedCharId}
                    teamSlotIds={teamSlotIds}
                    leaderSlotIndex={leaderSlotIndex}
                    onSelectCharacter={(char) => setSelectedCharId(char.id)}
                    onEquipToTeam={handleEquipToTeam}
                    onRemoveFromTeam={handleRemoveFromTeam}
                  />
                </div>
              </div>

              {/* 3. Dev Tools Sandbox Drawer */}
              {selectedCharacter && (
                <DevToolsDrawer
                  selectedChar={selectedCharacter}
                  userCopper={userCopper}
                  userMaterials={userAwakeningMaterials}
                  onSetAwakening={handleSetAwakeningDev}
                  onAddMasteryXp={handleAddMasteryXp}
                  onResetMastery={handleResetMastery}
                  onAddCopper={(amt) => setUserCopper((prev) => prev + amt)}
                  onAddMaterials={(amt) => setUserAwakeningMaterials((prev) => prev + amt)}
                  onLevelUpChar={handleLevelUpCharDev}
                  onAddStarFragments={handleAddStarFragmentsDev}
                  onResetChar={handleResetCharDev}
                />
              )}
            </div>
          )}
        </div>

        {/* Global Footer info */}
        <footer className="border-t border-white/5 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/40 uppercase tracking-widest">
          <div>
            Guarde no Box ou envie para a Equipe (máx. 3). O herói líder ativo concede bônus de combate.
          </div>
          <div className="flex items-center gap-3">
            <span>Forja tática ativa</span>
            <span>·</span>
            <span>Despertar e Maestria integrados</span>
            <span>·</span>
            <span>Presets Rápidos</span>
          </div>
        </footer>
      </main>

      {/* Modals */}
      {selectedCharacter && (
        <>
          <ForgeModal
            character={selectedCharacter}
            isOpen={isForgeOpen}
            onClose={() => setIsForgeOpen(false)}
            onEquipItem={handleEquipItem}
          />
          <SkillsModal
            character={selectedCharacter}
            isOpen={isSkillsOpen}
            onClose={() => setIsSkillsOpen(false)}
          />
        </>
      )}

      {/* Help / Rules Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0b101b] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold font-['Rajdhani'] text-white uppercase tracking-wider">
                  Guia do Sistema de Equipe
                </h3>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/5 text-white/40 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-white/70 leading-relaxed">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <strong className="text-yellow-400 block mb-1">👑 Líder Ativo & Posição:</strong>
                O herói definido como Líder concede sua habilidade de aura passiva para todos os integrantes e lidera o combate no Hub do jogo.
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <strong className="text-purple-400 block mb-1">⚡ Sistema de Despertar (0 a 3):</strong>
                Aumenta em 20% os atributos base do herói a cada estágio. Requer nível mínimo, estrelas, maestria e materiais específicos.
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <strong className="text-blue-400 block mb-1">🎖️ Maestria (Lv. 0 a 100):</strong>
                Heróis ganham maestria ao lutar na equipe ativa. Atingir marcos como Lv.10, Lv.25 e Lv.50 desbloqueia jutsus secretos e requisitos de despertar.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
