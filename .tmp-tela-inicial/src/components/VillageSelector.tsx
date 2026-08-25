import React from 'react';
import { VILLAGES } from '../data/characters';
import { Village } from '../types';
import { sounds } from '../utils/audio';

interface VillageSelectorProps {
  selectedVillage: Village;
  onSelectVillage: (village: Village) => void;
}

export const VillageSelector: React.FC<VillageSelectorProps> = ({
  selectedVillage,
  onSelectVillage,
}) => {
  const handleSelect = (v: Village) => {
    sounds.playSelect();
    onSelectVillage(v);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
          AFINIDADE REGIONAL // VILA SHINOBI
        </label>
        <span className="text-[11px] text-cyan-400 font-mono font-medium">
          {VILLAGES.find((v) => v.id === selectedVillage)?.desc}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {VILLAGES.map((village) => {
          const isSelected = selectedVillage === village.id;
          return (
            <button
              key={village.id}
              type="button"
              id={`village-${village.id}`}
              onClick={() => handleSelect(village.id as Village)}
              className={`px-3 py-2 rounded-2xl text-xs font-medium border transition-all text-left flex flex-col gap-0.5 relative overflow-hidden backdrop-blur-md cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                  : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 hover:border-white/20'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-12 h-12 bg-cyan-400/10 rounded-full blur-lg pointer-events-none" />
              )}
              <div className="flex items-center justify-between w-full relative z-10">
                <span className="text-base">{village.symbol}</span>
                <span className="text-[10px] font-mono opacity-50 text-slate-400">{village.kanji}</span>
              </div>
              <span className={`font-bold text-xs mt-1 truncate relative z-10 ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                {village.name.replace('Vila da ', '')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
