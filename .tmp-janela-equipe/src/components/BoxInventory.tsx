import React, { useState, useMemo } from 'react';
import { Character, Rarity, ElementType } from '../types';
import { RARITY_CONFIG, ELEMENT_CONFIG } from '../utils/rarity';
import { sound } from '../utils/audio';
import { 
  Search, 
  X, 
  Crown, 
  Star, 
  Lock, 
  LayoutGrid, 
  List, 
  SlidersHorizontal,
  Plus,
  Check,
  Flame,
  Zap,
  Wind,
  Droplets,
  Mountain,
  Sun,
  Moon,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface BoxInventoryProps {
  characters: Character[];
  selectedCharId: string | null;
  teamSlotIds: (string | null)[];
  leaderSlotIndex: number;
  onSelectCharacter: (char: Character) => void;
  onEquipToTeam: (charId: string) => void;
  onRemoveFromTeam: (charId: string) => void;
}

export const BoxInventory: React.FC<BoxInventoryProps> = ({
  characters,
  selectedCharId,
  teamSlotIds,
  leaderSlotIndex,
  onSelectCharacter,
  onEquipToTeam,
  onRemoveFromTeam,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<Rarity | 'todos'>('todos');
  const [selectedElement, setSelectedElement] = useState<ElementType | 'todos'>('todos');
  const [sortBy, setSortBy] = useState<'power' | 'level' | 'rarity' | 'mastery' | 'name'>('power');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const rarityFilters: { id: Rarity | 'todos'; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'comum', label: 'Comum' },
    { id: 'incomum', label: 'Incomum' },
    { id: 'raro', label: 'Raro' },
    { id: 'epico', label: 'Épico' },
    { id: 'lendario', label: 'Lendário' },
    { id: 'mitico', label: 'Mítico' },
    { id: 'supremo', label: 'Supremo' },
  ];

  const rarityWeights: Record<Rarity, number> = {
    comum: 1,
    incomum: 2,
    raro: 3,
    epico: 4,
    lendario: 5,
    mitico: 6,
    supremo: 7,
  };

  const filteredCharacters = useMemo(() => {
    return characters
      .filter((char) => {
        // Search
        const matchesSearch =
          char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          char.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          char.role.toLowerCase().includes(searchTerm.toLowerCase());

        // Rarity
        const matchesRarity = selectedRarity === 'todos' || char.rarity === selectedRarity;

        // Element
        const matchesElement = selectedElement === 'todos' || char.element === selectedElement;

        return matchesSearch && matchesRarity && matchesElement;
      })
      .sort((a, b) => {
        if (sortBy === 'power') {
          const powerA = a.atk * 3 + a.def * 2 + a.hp / 10 + a.level * 20;
          const powerB = b.atk * 3 + b.def * 2 + b.hp / 10 + b.level * 20;
          return powerB - powerA;
        }
        if (sortBy === 'level') {
          return b.level - a.level;
        }
        if (sortBy === 'rarity') {
          return rarityWeights[b.rarity] - rarityWeights[a.rarity];
        }
        if (sortBy === 'mastery') {
          return b.masteryLevel - a.masteryLevel;
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [characters, searchTerm, selectedRarity, selectedElement, sortBy]);

  const renderElementIcon = (elem: ElementType) => {
    switch (elem) {
      case 'fogo': return <Flame className="w-3 h-3 text-orange-400" />;
      case 'trovao': return <Zap className="w-3 h-3 text-yellow-400" />;
      case 'vento': return <Wind className="w-3 h-3 text-emerald-400" />;
      case 'agua': return <Droplets className="w-3 h-3 text-blue-400" />;
      case 'terra': return <Mountain className="w-3 h-3 text-amber-600" />;
      case 'luz': return <Sun className="w-3 h-3 text-amber-200" />;
      case 'trevas': return <Moon className="w-3 h-3 text-purple-400" />;
    }
  };

  return (
    <div id="box-inventory-panel" className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col backdrop-blur-xl shadow-2xl gap-4">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Inventário BOX
              </h2>
              <span className="text-[10px] font-mono text-white/40">
                ({filteredCharacters.length}/{characters.length})
              </span>
            </div>
            <div className="text-[11px] text-white/50">
              Selecione heróis para inspecionar ou equipar na formação
            </div>
          </div>
        </div>

        {/* Search & Layout toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="box-search-input"
              type="text"
              placeholder="Filtrar herói..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-white/5 border border-white/10 focus:border-blue-400 text-xs text-white placeholder-white/30 outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5">
            <button
              onClick={() => {
                sound.playClick();
                setViewMode('grid');
              }}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white'
              }`}
              title="Grade"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setViewMode('list');
              }}
              className={`p-1.5 rounded-md transition ${
                viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white'
              }`}
              title="Lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rarity Filter Pills (Immersive UI Style) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {rarityFilters.map((filter) => {
          const isActive = selectedRarity === filter.id;
          return (
            <button
              key={filter.id}
              id={`filter-rarity-${filter.id}`}
              onClick={() => {
                sound.playSelect();
                setSelectedRarity(filter.id);
              }}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-white/40 hover:text-white border border-transparent'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Secondary Controls: Elements & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Element Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <span className="text-[10px] text-white/30 uppercase tracking-widest mr-1">Elemento:</span>
          {(['todos', 'fogo', 'trovao', 'vento', 'agua', 'terra', 'luz', 'trevas'] as const).map((elem) => (
            <button
              key={elem}
              onClick={() => {
                sound.playSelect();
                setSelectedElement(elem);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer uppercase ${
                selectedElement === elem
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-white/40 hover:text-white'
              }`}
            >
              {elem === 'todos' ? 'Todos' : elem}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 ml-auto">
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/40" />
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Ordenar:</span>
          <select
            id="box-sort-select"
            value={sortBy}
            onChange={(e) => {
              sound.playClick();
              setSortBy(e.target.value as any);
            }}
            className="px-2 py-1 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:border-blue-400 outline-none cursor-pointer"
          >
            <option value="power">Maior Poder (CP)</option>
            <option value="level">Nível</option>
            <option value="rarity">Raridade</option>
            <option value="mastery">Maestria</option>
            <option value="name">Nome (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Character Cards Display */}
      {filteredCharacters.length === 0 ? (
        <div className="py-12 text-center text-white/40 space-y-2 border border-dashed border-white/10 rounded-xl">
          <ShieldAlert className="w-8 h-8 mx-auto text-white/20" />
          <p className="text-xs font-medium">Nenhum personagem com os filtros selecionados.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedRarity('todos');
              setSelectedElement('todos');
            }}
            className="text-xs text-blue-400 hover:underline"
          >
            Redefinir filtros
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredCharacters.map((char) => {
            const isSelected = selectedCharId === char.id;
            const slotIndex = teamSlotIds.indexOf(char.id);
            const isInTeam = slotIndex !== -1;
            const isLeader = isInTeam && slotIndex === leaderSlotIndex;
            const rarity = RARITY_CONFIG[char.rarity];
            const element = ELEMENT_CONFIG[char.element];

            return (
              <div
                key={char.id}
                id={`box-char-${char.id}`}
                onClick={() => {
                  sound.playSelect();
                  onSelectCharacter(char);
                }}
                className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between relative group ${
                  isSelected
                    ? 'bg-slate-800 border-2 border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : `bg-slate-800/40 border-white/10 hover:border-white/30 hover:bg-slate-800/60`
                }`}
              >
                {/* Glowing Dot Indicator on top right */}
                {isInTeam && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]" />
                )}

                {/* Header with tags */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${rarity.badgeBg} ${rarity.badgeBorder} ${rarity.badgeText}`}>
                      {rarity.label}
                    </span>

                    {isInTeam && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[9px] font-bold uppercase">
                        {isLeader ? 'Líder' : 'Na Equipe'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs pr-2">
                    {char.isFavorite && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                    {char.isLocked && <Lock className="w-3 h-3 text-rose-400" />}
                  </div>
                </div>

                {/* Character preview */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl overflow-hidden border ${rarity.badgeBorder} bg-black/60`}>
                      <img
                        src={char.avatarUrl}
                        alt={char.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 p-0.5 rounded bg-black border border-white/10">
                      {renderElementIcon(char.element)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="font-bold text-sm text-white truncate font-['Rajdhani']">
                        {char.name}
                      </h4>
                      <div className="flex text-yellow-400 text-[10px]">
                        {Array.from({ length: Math.min(char.stars, 5) }).map((_, i) => (
                          <span key={i}>★</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-white/50 truncate">{char.title}</div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-white/40">
                      <span className="text-yellow-400 font-bold">Lv.{char.level}</span>
                      <span>ATK {char.atk}</span>
                    </div>
                  </div>
                </div>

                {/* Card footer / quick action */}
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] text-white/40 font-mono">
                    Maestria: Lv.{char.masteryLevel}
                  </span>

                  {isInTeam ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playClick();
                        onRemoveFromTeam(char.id);
                      }}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-rose-950/60 border border-white/10 hover:border-rose-500 text-white/50 hover:text-rose-300 text-[10px] font-bold transition uppercase"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playEquip();
                        onEquipToTeam(char.id);
                      }}
                      className="px-2.5 py-0.5 rounded bg-blue-600/80 hover:bg-blue-500 text-white text-[10px] font-bold transition flex items-center gap-1 uppercase"
                    >
                      <Plus className="w-3 h-3" />
                      Equipar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Mode View */
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredCharacters.map((char) => {
            const isSelected = selectedCharId === char.id;
            const slotIndex = teamSlotIds.indexOf(char.id);
            const isInTeam = slotIndex !== -1;
            const isLeader = isInTeam && slotIndex === leaderSlotIndex;
            const rarity = RARITY_CONFIG[char.rarity];

            return (
              <div
                key={char.id}
                onClick={() => {
                  sound.playSelect();
                  onSelectCharacter(char);
                }}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-400 bg-slate-800 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    : 'bg-slate-800/40 border-white/10 hover:border-white/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg overflow-hidden border ${rarity.badgeBorder} bg-black`}>
                    <img
                      src={char.avatarUrl}
                      alt={char.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm font-['Rajdhani'] text-white">{char.name}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${rarity.badgeBg} ${rarity.badgeBorder} ${rarity.badgeText}`}>
                        {rarity.label}
                      </span>
                      {isInTeam && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold uppercase">
                          {isLeader ? 'Líder' : 'Equipe'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/40">{char.title} · Lv.{char.level} · Maestria Lv.{char.masteryLevel}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono text-xs hidden sm:block">
                    <div className="text-white/70">HP {char.hp}</div>
                    <div className="text-blue-300">ATK {char.atk}</div>
                  </div>

                  {isInTeam ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playClick();
                        onRemoveFromTeam(char.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-950 border border-white/10 hover:border-rose-500 text-xs text-white/50 hover:text-rose-300 transition"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sound.playEquip();
                        onEquipToTeam(char.id);
                      }}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
                    >
                      Equipar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom inventory stats */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5 text-[10px] text-white/40 uppercase tracking-widest">
        <span>Capacidade BOX: {characters.length}/100</span>
        <span>Heróis na Equipe: {teamSlotIds.filter(Boolean).length}/3</span>
      </div>
    </div>
  );
};
