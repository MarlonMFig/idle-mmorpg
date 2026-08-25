import React from 'react';
import { Character, Equipment, Rarity } from '../types';
import { RARITY_CONFIG } from '../utils/rarity';
import { sound } from '../utils/audio';
import { 
  X, 
  Anvil, 
  Sword, 
  Shield, 
  Sparkles, 
  Check, 
  Plus, 
  Hammer,
  RotateCcw
} from 'lucide-react';

interface ForgeModalProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
  onEquipItem: (slot: keyof Character['equipment'], item: Equipment | undefined) => void;
}

const AVAILABLE_GEAR: Equipment[] = [
  { id: 'g-kusanagi', name: 'Espada Kusanagi Negra', type: 'Arma', rarity: 'mitico', bonus: '+160 ATK · +15% Taxa Crítica', iconName: 'Sword' },
  { id: 'g-kunai-vento', name: 'Kunai de Vento Puro', type: 'Arma', rarity: 'lendario', bonus: '+90 ATK · +12% Dano Vento', iconName: 'Sword' },
  { id: 'g-katana-aco', name: 'Katana de Aço Shinobi', type: 'Arma', rarity: 'raro', bonus: '+40 ATK · +5% Velocidade', iconName: 'Sword' },
  { id: 'g-capa-akatsuki', name: 'Manto da Alvorada Sombria', type: 'Armadura', rarity: 'mitico', bonus: '+800 HP · +80 DEF', iconName: 'Shield' },
  { id: 'g-veste-sabio', name: 'Capa do Sábio', type: 'Armadura', rarity: 'epico', bonus: '+450 HP · +35 DEF', iconName: 'Shield' },
  { id: 'g-colete-jonin', name: 'Colete Tático Jounin', type: 'Armadura', rarity: 'raro', bonus: '+250 HP · +20 DEF', iconName: 'Shield' },
  { id: 'g-anel-shui', name: 'Anel Shui da Aliança', type: 'Acessório', rarity: 'mitico', bonus: '+25% Chakra Max · +15% Regeneração', iconName: 'Sparkles' },
  { id: 'g-livro-icha', name: 'Táticas de Paraíso', type: 'Acessório', rarity: 'epico', bonus: '+15% Taxa Crítica · +10 Velocidade', iconName: 'Sparkles' },
  { id: 'g-colar-hokage', name: 'Colar de Cristal do Primeiro', type: 'Amuleto', rarity: 'supremo', bonus: '+1200 HP · Concede Escudo Divino de 500', iconName: 'Sparkles' },
  { id: 'g-espelho-yata', name: 'Espelho Sagrado de Yata', type: 'Amuleto', rarity: 'mitico', bonus: '+500 HP · +25% Resistência Elemental', iconName: 'Sparkles' },
];

export const ForgeModal: React.FC<ForgeModalProps> = ({
  character,
  isOpen,
  onClose,
  onEquipItem,
}) => {
  if (!isOpen) return null;

  const slots: { key: keyof Character['equipment']; label: string; icon: any }[] = [
    { key: 'weapon', label: 'Arma Principal', icon: Sword },
    { key: 'armor', label: 'Armadura / Manto', icon: Shield },
    { key: 'accessory', label: 'Acessório Tático', icon: Sparkles },
    { key: 'amulet', label: 'Amuleto Sagrado', icon: Sparkles },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Anvil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Rajdhani'] uppercase tracking-wider text-white">
                Forja de Equipamentos · {character.name}
              </h2>
              <p className="text-xs text-white/50">
                Equipe armas e relíquias para amplificar os atributos de combate
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Current Equipped Slots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {slots.map(({ key, label, icon: Icon }) => {
              const currentItem = character.equipment[key];
              const rarityConfig = currentItem ? RARITY_CONFIG[currentItem.rarity] : null;

              return (
                <div
                  key={key}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    currentItem
                      ? `${rarityConfig?.cardBorder} ${rarityConfig?.cardBg}`
                      : 'bg-slate-800/40 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${
                      currentItem ? `${rarityConfig?.badgeBorder} ${rarityConfig?.badgeBg}` : 'bg-black/60 border-white/10 text-white/30'
                    }`}>
                      <Icon className={`w-5 h-5 ${currentItem ? rarityConfig?.textColor : 'text-white/30'}`} />
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-white/40 tracking-wider">{label}</div>
                      <div className="text-xs font-bold text-white">
                        {currentItem ? currentItem.name : 'Nenhum Equipado'}
                      </div>
                      {currentItem && (
                        <div className="text-[11px] text-blue-300 font-mono mt-0.5">
                          {currentItem.bonus}
                        </div>
                      )}
                    </div>
                  </div>

                  {currentItem && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onEquipItem(key, undefined);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-950/80 text-white/40 hover:text-rose-300 text-xs transition cursor-pointer border border-white/10"
                      title="Desequipar"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Available Gear Inventory to Equip */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-white/70 border-b border-white/10 pb-2">
              <span className="uppercase tracking-widest text-blue-400 text-[10px]">Inventário da Forja</span>
              <span className="text-white/40 font-normal text-[11px]">Selecione um item para equipar</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {AVAILABLE_GEAR.map((item) => {
                const rarityConfig = RARITY_CONFIG[item.rarity];
                const slotKey: keyof Character['equipment'] =
                  item.type === 'Arma'
                    ? 'weapon'
                    : item.type === 'Armadura'
                    ? 'armor'
                    : item.type === 'Acessório'
                    ? 'accessory'
                    : 'amulet';

                const isEquippedHere = character.equipment[slotKey]?.id === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition ${
                      isEquippedHere
                        ? 'border-blue-400 bg-slate-800 ring-2 ring-blue-400/20'
                        : `${rarityConfig.cardBorder} bg-slate-800/40 hover:bg-slate-800/60`
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${rarityConfig.badgeBg} ${rarityConfig.badgeBorder} ${rarityConfig.badgeText}`}>
                          {item.rarity}
                        </span>
                        <span className="font-bold text-xs text-white truncate">{item.name}</span>
                      </div>
                      <div className="text-[10px] text-white/50 mt-1 font-mono">{item.bonus}</div>
                    </div>

                    <button
                      onClick={() => {
                        sound.playEquip();
                        onEquipItem(slotKey, isEquippedHere ? undefined : item);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer uppercase ${
                        isEquippedHere
                          ? 'bg-white/10 text-white/60 hover:bg-white/20'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {isEquippedHere ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {isEquippedHere ? 'Equipado' : 'Equipar'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
