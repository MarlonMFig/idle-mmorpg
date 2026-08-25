import React from 'react';
import { ItemType, ItemRarity } from '../types';

interface ItemIconProps {
  type: ItemType;
  rarity?: ItemRarity;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  count?: number;
  className?: string;
  showGlow?: boolean;
}

export const ItemIcon: React.FC<ItemIconProps> = ({
  type,
  rarity = 'common',
  size = 'md',
  count,
  className = '',
  showGlow = true,
}) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-xs',
    lg: 'w-16 h-16 text-sm',
    xl: 'w-24 h-24 text-base',
  };

  const rarityBorders: Record<ItemRarity, string> = {
    common: 'border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-slate-900/80',
    rare: 'border-blue-500/40 bg-gradient-to-b from-blue-950/30 to-slate-900/80 shadow-[0_0_12px_rgba(59,130,246,0.2)]',
    epic: 'border-purple-500/50 bg-gradient-to-b from-purple-950/30 to-slate-900/80 shadow-[0_0_15px_rgba(168,85,247,0.25)]',
    legendary: 'border-amber-400/70 bg-gradient-to-b from-amber-900/40 to-slate-900/90 shadow-[0_0_20px_rgba(251,191,36,0.35)]',
  };

  const renderIconGraphic = () => {
    switch (type) {
      case 'copper':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" fill="none">
            {/* Ambient coin glow */}
            <circle cx="24" cy="24" r="18" fill="url(#copperGlow)" opacity="0.3" />
            
            {/* Background Coins */}
            <ellipse cx="18" cy="30" rx="11" ry="6" fill="#78350f" stroke="#b45309" strokeWidth="1.5" />
            <ellipse cx="18" cy="28" rx="10" ry="5.5" fill="#92400e" />
            
            <ellipse cx="30" cy="28" rx="11" ry="6" fill="#78350f" stroke="#b45309" strokeWidth="1.5" />
            <ellipse cx="30" cy="26" rx="10" ry="5.5" fill="#b45309" />
            
            {/* Front Big Coin */}
            <circle cx="24" cy="21" r="13" fill="url(#copperGrad)" stroke="#fef08a" strokeWidth="1.2" />
            <circle cx="24" cy="21" r="10.5" fill="none" stroke="#ca8a04" strokeWidth="1" strokeDasharray="2 1.5" />
            
            {/* Emblem / Star */}
            <path
              d="M24 13.5L25.8 18.2L30.5 19L27 22.2L28 27L24 24.5L20 27L21 22.2L17.5 19L22.2 18.2L24 13.5Z"
              fill="#fef9c3"
              opacity="0.9"
            />

            {/* Sparkle highlight */}
            <circle cx="18" cy="15" r="1.5" fill="#ffffff" />
            
            <defs>
              <radialGradient id="copperGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="copperGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="30%" stopColor="#eab308" />
                <stop offset="70%" stopColor="#ca8a04" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'potion':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1.5 drop-shadow-[0_4px_8px_rgba(239,68,68,0.4)]" fill="none">
            {/* Cork */}
            <rect x="21" y="7" width="6" height="4" rx="1" fill="#78350f" stroke="#a16207" strokeWidth="1" />
            
            {/* Neck */}
            <path d="M20 11H28V15H20V11Z" fill="#e2e8f0" fillOpacity="0.4" stroke="#94a3b8" strokeWidth="1" />
            
            {/* Flask Body */}
            <path
              d="M19 15L11 29C9 32.5 10 39 16 41C21 42.5 27 42.5 32 41C38 39 39 32.5 37 29L29 15H19Z"
              fill="url(#potionLiquid)"
              stroke="#fca5a5"
              strokeWidth="1.5"
            />

            {/* Liquid Highlight & Reflection */}
            <path
              d="M14 30C16 35 20 39 28 39C32 39 34 37 34 37"
              stroke="#fee2e2"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />
            
            {/* Bubbles */}
            <circle cx="21" cy="32" r="1.5" fill="#ffffff" opacity="0.8" />
            <circle cx="26" cy="27" r="1" fill="#ffffff" opacity="0.6" />
            <circle cx="23" cy="24" r="1.8" fill="#ffffff" opacity="0.9" />

            {/* Glass Neck Highlight */}
            <line x1="21" y1="13" x2="21" y2="15" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />

            <defs>
              <linearGradient id="potionLiquid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="40%" stopColor="#ef4444" />
                <stop offset="85%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'concentrated_potion':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1.5 drop-shadow-[0_4px_10px_rgba(59,130,246,0.5)]" fill="none">
            {/* Ornate Gold Cap */}
            <path d="M20 6H28L26 11H22L20 6Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
            <circle cx="24" cy="5" r="2" fill="#60a5fa" stroke="#fcd34d" strokeWidth="1" />

            {/* Diamond/Elixir Flask */}
            <path
              d="M22 11H26L35 24L24 42L13 24L22 11Z"
              fill="url(#concPotionGrad)"
              stroke="#93c5fd"
              strokeWidth="1.5"
            />

            {/* Internal Rune / Core */}
            <polygon points="24,19 29,27 24,35 19,27" fill="#dbeafe" opacity="0.85" />
            <polygon points="24,22 27,27 24,32 21,27" fill="#ffffff" />

            {/* Glass facets */}
            <line x1="13" y1="24" x2="35" y2="24" stroke="#bfdbfe" strokeWidth="1" opacity="0.6" />
            <line x1="24" y1="11" x2="24" y2="42" stroke="#ffffff" strokeWidth="1" opacity="0.5" />

            <defs>
              <linearGradient id="concPotionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'ultra_potion':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1 drop-shadow-[0_4px_12px_rgba(168,85,247,0.6)]" fill="none">
            {/* Mystical Sphere Flask */}
            <circle cx="24" cy="26" r="15" fill="url(#ultraPotionGrad)" stroke="#e9d5ff" strokeWidth="1.5" />
            
            {/* Ornate Gold Crown Cap */}
            <path d="M19 12L24 7L29 12L27 15H21L19 12Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
            <circle cx="24" cy="6" r="2.5" fill="#f43f5e" stroke="#fbbf24" strokeWidth="1" />

            {/* Swirling Arcane Galaxy */}
            <ellipse cx="24" cy="26" rx="10" ry="4" stroke="#f5d0fe" strokeWidth="1.5" transform="rotate(-25 24 26)" opacity="0.8" />
            <ellipse cx="24" cy="26" rx="10" ry="4" stroke="#c084fc" strokeWidth="1" transform="rotate(35 24 26)" opacity="0.8" />
            
            {/* Sparkles */}
            <circle cx="20" cy="22" r="1.5" fill="#ffffff" />
            <circle cx="28" cy="28" r="1.2" fill="#ffffff" />
            <circle cx="23" cy="30" r="1.8" fill="#ffffff" opacity="0.9" />

            <defs>
              <radialGradient id="ultraPotionGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f0abfc" />
                <stop offset="40%" stopColor="#a855f7" />
                <stop offset="80%" stopColor="#7e22ce" />
                <stop offset="100%" stopColor="#3b0764" />
              </radialGradient>
            </defs>
          </svg>
        );

      case 'scroll':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1.5 drop-shadow-[0_4px_10px_rgba(236,72,153,0.45)]" fill="none">
            {/* Rolled Parchment Ends */}
            <ellipse cx="14" cy="14" rx="4" ry="7" fill="#fde68a" stroke="#ca8a04" strokeWidth="1.5" />
            <ellipse cx="34" cy="34" rx="4" ry="7" fill="#fde68a" stroke="#ca8a04" strokeWidth="1.5" />

            {/* Main Scroll Body */}
            <path
              d="M14 7L34 27C37 30 36 38 34 41L14 21C11 18 12 10 14 7Z"
              fill="url(#scrollGrad)"
              stroke="#f59e0b"
              strokeWidth="1.5"
            />

            {/* Ancient Arcane Glyphs / Runes */}
            <path d="M19 16L24 21M22 23L27 28M25 30L29 34" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
            <circle cx="23" cy="20" r="1.2" fill="#f43f5e" />
            <circle cx="27" cy="27" r="1.2" fill="#f43f5e" />

            {/* Sealing Ribbon & Wax Stamp */}
            <line x1="20" y1="13" x2="31" y2="24" stroke="#be185d" strokeWidth="2.5" />
            <circle cx="26" cy="19" r="4.5" fill="#e11d48" stroke="#fbcfe8" strokeWidth="1" />
            <path d="M24 19L28 19M26 17L26 21" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />

            <defs>
              <linearGradient id="scrollGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="60%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'revive':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1.5 drop-shadow-[0_4px_12px_rgba(249,115,22,0.6)]" fill="none">
            {/* Phoenix Flame Wings Aura */}
            <path
              d="M24 4C24 4 15 14 15 26C15 34 20 42 24 44C28 42 33 34 33 26C33 14 24 4 24 4Z"
              fill="url(#phoenixFlame)"
              opacity="0.35"
            />

            {/* Sacred Golden Feather */}
            <path
              d="M34 8C27 12 18 20 16 34C15 39 17 41 18 42C19 43 22 41 24 38C26 35 34 23 35 15C36 10 35 8 34 8Z"
              fill="url(#featherGrad)"
              stroke="#fed7aa"
              strokeWidth="1.2"
            />

            {/* Feather Spine */}
            <path d="M34 8Q24 24 16 41" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />

            {/* Divine Cross Sparkle in center */}
            <path
              d="M24 20L25.5 24.5L30 26L25.5 27.5L24 32L22.5 27.5L18 26L22.5 24.5L24 20Z"
              fill="#ffffff"
            />
            <circle cx="24" cy="26" r="1.5" fill="#f97316" />

            <defs>
              <linearGradient id="phoenixFlame" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
              <linearGradient id="featherGrad" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="35%" stopColor="#fb923c" />
                <stop offset="80%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#9a3412" />
              </linearGradient>
            </defs>
          </svg>
        );

      case 'chest':
        return (
          <svg viewBox="0 0 48 48" className="w-full h-full p-1 drop-shadow-[0_6px_15px_rgba(245,158,11,0.6)]" fill="none">
            {/* Chest Base */}
            <rect x="8" y="20" width="32" height="22" rx="3" fill="#451a03" stroke="#b45309" strokeWidth="1.5" />
            
            {/* Metal Straps */}
            <rect x="14" y="20" width="4" height="22" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
            <rect x="30" y="20" width="4" height="22" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />

            {/* Chest Lid */}
            <path
              d="M6 20C6 14 12 8 24 8C36 8 42 14 42 20H6Z"
              fill="url(#chestLidGrad)"
              stroke="#fbbf24"
              strokeWidth="1.5"
            />

            {/* Gold Trim & Straps on Lid */}
            <path d="M14 9.5C14 9.5 15 16 14 20" stroke="#fef08a" strokeWidth="2.5" />
            <path d="M34 9.5C34 9.5 33 16 34 20" stroke="#fef08a" strokeWidth="2.5" />

            {/* Front Big Royal Ruby Lock */}
            <rect x="21" y="18" width="6" height="9" rx="1.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1" />
            <circle cx="24" cy="22.5" r="2.2" fill="#dc2626" stroke="#fef08a" strokeWidth="0.8" />
            <line x1="24" y1="23.5" x2="24" y2="25.5" stroke="#78350f" strokeWidth="1" strokeLinecap="round" />

            {/* Light Rays & Shimmer */}
            <circle cx="12" cy="14" r="1.5" fill="#ffffff" />
            <circle cx="36" cy="14" r="1.5" fill="#ffffff" />

            <defs>
              <linearGradient id="chestLidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="60%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
            </defs>
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div
      id={`item-icon-${type}-${rarity}`}
      className={`relative flex items-center justify-center rounded-xl border transition-all duration-300 ${
        sizeMap[size]
      } ${rarityBorders[rarity]} ${className}`}
    >
      {/* Background Soft Glow */}
      {showGlow && (
        <div
          className="absolute inset-0 rounded-xl opacity-30 blur-md pointer-events-none transition-opacity duration-300"
          style={{
            background:
              rarity === 'legendary'
                ? 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 75%)'
                : rarity === 'epic'
                ? 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 75%)'
                : rarity === 'rare'
                ? 'radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 75%)'
                : 'radial-gradient(circle, rgba(234,179,8,0.4) 0%, transparent 75%)',
          }}
        />
      )}

      {/* Graphic */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {renderIconGraphic()}
      </div>

      {/* Item Quantity Badge */}
      {count !== undefined && count > 1 && (
        <span className="absolute -bottom-1.5 -right-1.5 z-20 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-amber-500/50 text-[10px] sm:text-xs font-bold font-rajdhani text-amber-200 shadow-md">
          {count}×
        </span>
      )}
    </div>
  );
};
