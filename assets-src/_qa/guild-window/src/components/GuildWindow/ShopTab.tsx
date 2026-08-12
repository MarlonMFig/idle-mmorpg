import React from 'react';
import { GuildShopItem } from '../../types';
import { ShoppingBag, Coins, Check, Sparkles, AlertCircle } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface ShopTabProps {
  items: GuildShopItem[];
  userGuildCoins: number;
  guildLevel: number;
  onBuyItem: (itemId: string, price: number) => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({
  items,
  userGuildCoins,
  guildLevel,
  onBuyItem,
}) => {
  return (
    <div className="p-4 space-y-4">
      {/* Header Info */}
      <div className="bg-[#131b16] border border-[#27362a] p-3.5 rounded-xl text-xs text-gray-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" />
            Loja Exclusiva da Guilda
          </h3>
          <p className="text-gray-400 text-[11px] mt-0.5">
            Troque suas Moedas de Guilda acumuladas por itens raros, fragmentos de ninjas e bônus de conta.
          </p>
        </div>

        <div className="bg-[#0e1410] border border-[#233126] px-4 py-2 rounded-xl text-xs font-mono font-bold text-amber-300 flex items-center gap-2 shrink-0">
          <span>Suas Moedas:</span>
          <span className="text-amber-400 text-sm">🪙 {userGuildCoins.toLocaleString()}</span>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const hasLevelReq = guildLevel >= item.reqGuildLevel;
          const hasStock = item.stock > 0;
          const canAfford = userGuildCoins >= item.priceCoins;

          return (
            <div
              key={item.id}
              className={`bg-[#121814] border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-lg relative overflow-hidden transition-all ${
                !hasLevelReq
                  ? 'border-gray-800 opacity-60'
                  : 'border-[#263529] hover:border-amber-500/70'
              }`}
            >
              {/* Category tag */}
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                <span className="bg-[#1c2720] border border-[#2e3e32] text-amber-300 px-2 py-0.5 rounded">
                  {item.category}
                </span>
                <span className="text-gray-400 font-mono">
                  Estoque: {item.stock}/{item.maxStock}
                </span>
              </div>

              {/* Item Details */}
              <div className="flex items-start gap-3 my-1">
                <div className="w-12 h-12 rounded-xl bg-[#18231c] border border-amber-600/50 flex items-center justify-center text-3xl shrink-0 shadow">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs leading-snug">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Level Requirement Notice if locked */}
              {!hasLevelReq && (
                <div className="text-[10px] text-red-400 bg-red-950/50 border border-red-800 p-1.5 rounded text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>Requer Guilda Nível {item.reqGuildLevel}</span>
                </div>
              )}

              {/* Price & Buy Button */}
              <div className="border-t border-[#1e2b21] pt-3 flex items-center justify-between gap-2">
                <div className="font-bold text-amber-300 text-xs font-mono">
                  🪙 {item.priceCoins.toLocaleString()}
                </div>

                <button
                  onClick={() => {
                    if (hasLevelReq && hasStock && canAfford) {
                      sounds.playCoin();
                      onBuyItem(item.id, item.priceCoins);
                    }
                  }}
                  disabled={!hasLevelReq || !hasStock || !canAfford}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    !hasLevelReq || !hasStock
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                      : canAfford
                      ? 'game-btn-gold shadow'
                      : 'bg-red-950/60 border border-red-800 text-red-300 cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>
                    {!hasStock
                      ? 'Esgotado'
                      : !hasLevelReq
                      ? 'Bloqueado'
                      : canAfford
                      ? 'Comprar'
                      : 'Moedas Insuficientes'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
