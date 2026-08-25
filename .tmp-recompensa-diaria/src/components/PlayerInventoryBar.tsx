import React from 'react';
import { PlayerInventory } from '../types';
import { ItemIcon } from './ItemIcon';

interface PlayerInventoryBarProps {
  inventory: PlayerInventory;
}

export const PlayerInventoryBar: React.FC<PlayerInventoryBarProps> = ({ inventory }) => {
  return (
    <div
      id="player-inventory-bar"
      className="flex items-center gap-2 sm:gap-4 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs sm:text-sm backdrop-blur-md"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:inline">
        Bolsa:
      </span>

      {/* Copper Coins */}
      <div className="flex items-center gap-1.5 font-bold text-amber-300" title="Moedas de Ouro / Cobre">
        <ItemIcon type="copper" size="sm" showGlow={false} className="border-none !bg-transparent !w-4 !h-4" />
        <span className="text-xs sm:text-sm">{inventory.copper}</span>
      </div>

      {/* Potions */}
      <div className="flex items-center gap-1.5 font-bold text-red-300" title="Poções de Vida">
        <ItemIcon type="potion" size="sm" showGlow={false} className="border-none !bg-transparent !w-4 !h-4" />
        <span className="text-xs sm:text-sm">
          {inventory.potions + inventory.concentratedPotions + inventory.ultraPotions}
        </span>
      </div>

      {/* Scrolls */}
      <div className="flex items-center gap-1.5 font-bold text-pink-300" title="Pergaminhos de Selamento">
        <ItemIcon type="scroll" size="sm" showGlow={false} className="border-none !bg-transparent !w-4 !h-4" />
        <span className="text-xs sm:text-sm">{inventory.scrolls}</span>
      </div>

      {/* Revives */}
      <div className="flex items-center gap-1.5 font-bold text-orange-300" title="Penas de Fênix (Revive)">
        <ItemIcon type="revive" size="sm" showGlow={false} className="border-none !bg-transparent !w-4 !h-4" />
        <span className="text-xs sm:text-sm">{inventory.revives}</span>
      </div>
    </div>
  );
};
