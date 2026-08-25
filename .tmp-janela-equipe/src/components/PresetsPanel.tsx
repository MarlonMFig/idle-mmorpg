import React, { useState } from 'react';
import { TeamPreset, Character } from '../types';
import { sound } from '../utils/audio';
import { 
  Bookmark, 
  Check, 
  Trash2, 
  Save, 
  Plus, 
  Crown, 
  Sparkles, 
  X,
  AlertCircle,
  Copy
} from 'lucide-react';

interface PresetsPanelProps {
  presets: TeamPreset[];
  activePresetId: string;
  characters: Character[];
  currentTeamSlots: (string | null)[];
  currentLeaderIndex: number;
  onApplyPreset: (preset: TeamPreset) => void;
  onSaveCurrentToPreset: (presetId: string) => void;
  onClearPreset: (presetId: string) => void;
  onAddNewPreset: (name: string) => void;
}

export const PresetsPanel: React.FC<PresetsPanelProps> = ({
  presets,
  activePresetId,
  characters,
  currentTeamSlots,
  currentLeaderIndex,
  onApplyPreset,
  onSaveCurrentToPreset,
  onClearPreset,
  onAddNewPreset,
}) => {
  const [newPresetName, setNewPresetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const getCharById = (id: string | null) => {
    if (!id) return null;
    return characters.find((c) => c.id === id) || null;
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    sound.playClick();
    onAddNewPreset(newPresetName.trim());
    setNewPresetName('');
    setIsCreating(false);
  };

  return (
    <div id="presets-panel" className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col backdrop-blur-xl shadow-2xl gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400">
              Presets de Formação
            </h2>
            <p className="text-[11px] text-white/50">
              Alterne rapidamente entre composições táticas salvas.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            sound.playClick();
            setIsCreating(!isCreating);
          }}
          className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer uppercase"
        >
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          Novo Preset
        </button>
      </div>

      {/* Creation form */}
      {isCreating && (
        <form onSubmit={handleCreateNew} className="flex gap-2 p-3 bg-white/5 rounded-xl border border-blue-500/40">
          <input
            type="text"
            placeholder="Nome do Preset (ex: Equipe Boss, Farm XP)..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg text-xs text-white outline-none focus:border-blue-400"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition uppercase"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => setIsCreating(false)}
            className="px-2 py-1.5 text-white/40 hover:text-white text-xs"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Presets List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const slotChars = preset.slotIds.map(getCharById);

          return (
            <div
              key={preset.id}
              id={`preset-card-${preset.id}`}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                isActive
                  ? 'bg-slate-800 border-2 border-blue-400 ring-4 ring-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                  : 'bg-slate-800/40 border-white/10 hover:border-white/20'
              }`}
            >
              {/* Preset Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white font-['Rajdhani']">
                    {preset.name}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase">
                      ATIVO
                    </span>
                  )}
                </div>
              </div>

              {/* Slot Preview */}
              <div className="flex items-center gap-2 py-1">
                {slotChars.map((char, sIdx) => {
                  const isLeader = sIdx === preset.leaderSlotIndex;
                  if (!char) {
                    return (
                      <div
                        key={sIdx}
                        className="w-12 h-12 rounded-lg border border-dashed border-white/10 bg-black/40 flex items-center justify-center text-[9px] text-white/30 font-mono"
                      >
                        VAZIO
                      </div>
                    );
                  }
                  return (
                    <div key={sIdx} className="relative group">
                      <div className={`w-12 h-12 rounded-lg overflow-hidden border ${isLeader ? 'border-yellow-400' : 'border-white/10'} bg-black`}>
                        <img
                          src={char.avatarUrl}
                          alt={char.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {isLeader && (
                        <div className="absolute -top-1 -right-1 p-0.5 bg-yellow-500 rounded text-slate-950 shadow-[0_0_8px_#eab308]">
                          <Crown className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <div className="text-[9px] text-center text-white/50 truncate mt-0.5 max-w-[48px]">
                        {char.name}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                {!isActive ? (
                  <button
                    onClick={() => {
                      sound.playEquip();
                      onApplyPreset(preset);
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer uppercase"
                  >
                    Ativar
                  </button>
                ) : (
                  <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-xs text-center border border-blue-500/30 uppercase">
                    Ativo
                  </div>
                )}

                <button
                  onClick={() => {
                    sound.playClick();
                    onSaveCurrentToPreset(preset.id);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1 border border-white/10"
                  title="Salvar formação atual"
                >
                  <Save className="w-3 h-3 text-blue-400" />
                  Salvar
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    onClearPreset(preset.id);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-rose-950/80 text-white/40 hover:text-rose-300 text-[10px] font-bold uppercase transition cursor-pointer border border-white/10"
                  title="Limpar preset"
                >
                  Limpar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
