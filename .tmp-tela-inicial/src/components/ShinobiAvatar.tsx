import { motion } from 'motion/react';
import React from 'react';
import { ShinobiCharacter } from '../types';

interface ShinobiAvatarProps {
  character: ShinobiCharacter;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isJutsuActive?: boolean;
}

export const ShinobiAvatar: React.FC<ShinobiAvatarProps> = ({
  character,
  size = 'lg',
  isJutsuActive = false,
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-48 h-48 sm:w-56 sm:h-56',
    xl: 'w-64 h-64 sm:w-72 sm:h-72',
  }[size];

  // Specific pixel avatar graphics based on character id
  const renderPixelCharacter = () => {
    switch (character.id) {
      case 'naruto':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl" shapeRendering="crispEdges">
            {/* Ambient Chakra Aura */}
            <circle cx="32" cy="32" r="28" fill="url(#narutoGlow)" opacity="0.4" />
            
            {/* Naruto Spiky Yellow Hair */}
            <rect x="24" y="6" width="16" height="4" fill="#fbbf24" />
            <rect x="20" y="8" width="6" height="6" fill="#f59e0b" />
            <rect x="38" y="8" width="6" height="6" fill="#f59e0b" />
            <rect x="18" y="12" width="6" height="6" fill="#f59e0b" />
            <rect x="40" y="12" width="6" height="6" fill="#f59e0b" />
            <rect x="22" y="10" width="20" height="6" fill="#fbbf24" />

            {/* Konoha Blue Headband */}
            <rect x="22" y="16" width="20" height="5" fill="#1e3a8a" />
            {/* Metal Plate */}
            <rect x="26" y="17" width="12" height="3" fill="#cbd5e1" />
            <rect x="30" y="18" width="4" height="1" fill="#475569" />

            {/* Face */}
            <rect x="22" y="21" width="20" height="11" fill="#fed7aa" />
            {/* Eyes */}
            <rect x="25" y="23" width="3" height="3" fill="#0284c7" />
            <rect x="36" y="23" width="3" height="3" fill="#0284c7" />
            <rect x="26" y="23" width="1" height="1" fill="#ffffff" />
            <rect x="37" y="23" width="1" height="1" fill="#ffffff" />
            {/* Whiskers */}
            <rect x="23" y="27" width="2" height="1" fill="#ea580c" />
            <rect x="23" y="29" width="2" height="1" fill="#ea580c" />
            <rect x="39" y="27" width="2" height="1" fill="#ea580c" />
            <rect x="39" y="29" width="2" height="1" fill="#ea580c" />
            {/* Smile */}
            <rect x="30" y="29" width="4" height="1" fill="#c2410c" />

            {/* Orange Jacket & Blue Neck */}
            <rect x="20" y="32" width="24" height="5" fill="#3b82f6" />
            <rect x="26" y="32" width="12" height="4" fill="#fed7aa" />
            <rect x="18" y="37" width="28" height="14" fill="#ea580c" />
            <rect x="29" y="37" width="6" height="14" fill="#ffffff" />
            
            {/* Arms & Hands */}
            <rect x="14" y="38" width="4" height="10" fill="#ea580c" />
            <rect x="46" y="38" width="4" height="10" fill="#ea580c" />
            <rect x="13" y="47" width="5" height="4" fill="#fed7aa" />
            <rect x="46" y="47" width="5" height="4" fill="#fed7aa" />

            {/* Orange Pants */}
            <rect x="22" y="51" width="9" height="7" fill="#ea580c" />
            <rect x="33" y="51" width="9" height="7" fill="#ea580c" />
            {/* Leg Bandage */}
            <rect x="33" y="53" width="9" height="3" fill="#ffffff" />

            {/* Blue Sandals */}
            <rect x="21" y="58" width="10" height="4" fill="#1e3a8a" />
            <rect x="33" y="58" width="10" height="4" fill="#1e3a8a" />

            {/* Rasengan Orb when Jutsu is active */}
            {isJutsuActive && (
              <g className="animate-spin origin-[48px_48px]">
                <circle cx="48" cy="48" r="10" fill="#38bdf8" opacity="0.8" />
                <circle cx="48" cy="48" r="6" fill="#e0f2fe" />
                <path d="M40 48 Q48 40 56 48 Q48 56 40 48" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              </g>
            )}

            <defs>
              <radialGradient id="narutoGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );

      case 'sasuke':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl" shapeRendering="crispEdges">
            <circle cx="32" cy="32" r="28" fill="url(#sasukeGlow)" opacity="0.4" />
            
            {/* Dark Spiky Uchiha Hair */}
            <rect x="22" y="6" width="20" height="6" fill="#1e1b4b" />
            <rect x="18" y="10" width="8" height="10" fill="#1e1b4b" />
            <rect x="38" y="10" width="8" height="10" fill="#1e1b4b" />
            <rect x="16" y="16" width="6" height="10" fill="#0f172a" />
            <rect x="42" y="16" width="6" height="10" fill="#0f172a" />

            {/* Headband */}
            <rect x="22" y="16" width="20" height="4" fill="#1e293b" />
            <rect x="26" y="17" width="12" height="2" fill="#94a3b8" />

            {/* Face */}
            <rect x="22" y="20" width="20" height="11" fill="#fde68a" />
            {/* Sharingan Eyes */}
            <rect x="25" y="23" width="3" height="3" fill="#ef4444" />
            <rect x="36" y="23" width="3" height="3" fill="#ef4444" />
            <rect x="26" y="24" width="1" height="1" fill="#000000" />
            <rect x="37" y="24" width="1" height="1" fill="#000000" />
            {/* Calm Expression */}
            <rect x="30" y="29" width="4" height="1" fill="#78350f" />

            {/* High Blue Collar & Shirt */}
            <rect x="18" y="31" width="28" height="6" fill="#1e3a8a" />
            <rect x="20" y="37" width="24" height="13" fill="#1d4ed8" />
            
            {/* Arm Warmers */}
            <rect x="14" y="38" width="4" height="10" fill="#ffffff" />
            <rect x="46" y="38" width="4" height="10" fill="#ffffff" />
            <rect x="13" y="47" width="5" height="4" fill="#fde68a" />
            <rect x="46" y="47" width="5" height="4" fill="#fde68a" />

            {/* White Shorts */}
            <rect x="22" y="50" width="20" height="5" fill="#f8fafc" />

            {/* Dark Blue Shinobi Boots */}
            <rect x="22" y="55" width="8" height="7" fill="#1e3a8a" />
            <rect x="34" y="55" width="8" height="7" fill="#1e3a8a" />

            {/* Chidori Lightning effect */}
            {isJutsuActive && (
              <g>
                <circle cx="14" cy="48" r="8" fill="#818cf8" opacity="0.8" />
                <path d="M8 44 L16 48 L12 56 L20 50" stroke="#c7d2fe" strokeWidth="2" fill="none" />
                <path d="M12 40 L18 46 L14 52" stroke="#ffffff" strokeWidth="1.5" fill="none" />
              </g>
            )}

            <defs>
              <radialGradient id="sasukeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );

      case 'lee':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl" shapeRendering="crispEdges">
            <circle cx="32" cy="32" r="28" fill="url(#leeGlow)" opacity="0.4" />

            {/* Shiny Bowl Cut Black Hair */}
            <rect x="20" y="8" width="24" height="12" fill="#0f172a" />
            <rect x="24" y="10" width="8" height="2" fill="#94a3b8" />
            <rect x="36" y="10" width="4" height="2" fill="#94a3b8" />

            {/* Face */}
            <rect x="22" y="20" width="20" height="12" fill="#fed7aa" />
            {/* Huge Bushy Eyebrows */}
            <rect x="23" y="21" width="6" height="3" fill="#000000" />
            <rect x="35" y="21" width="6" height="3" fill="#000000" />
            {/* Round Eyes */}
            <circle cx="26" cy="26" r="2.5" fill="#000000" />
            <circle cx="38" cy="26" r="2.5" fill="#000000" />
            <circle cx="26.5" cy="25.5" r="0.8" fill="#ffffff" />
            <circle cx="38.5" cy="25.5" r="0.8" fill="#ffffff" />
            {/* Confident Smile */}
            <rect x="28" y="30" width="8" height="2" fill="#ffffff" />

            {/* Red Belt / Konoha Waistband */}
            <rect x="22" y="44" width="20" height="3" fill="#dc2626" />

            {/* Green Jumpsuit */}
            <rect x="20" y="32" width="24" height="12" fill="#059669" />
            <rect x="22" y="47" width="9" height="8" fill="#059669" />
            <rect x="33" y="47" width="9" height="8" fill="#059669" />

            {/* Bandaged Forearms */}
            <rect x="14" y="34" width="6" height="14" fill="#f8fafc" />
            <rect x="44" y="34" width="6" height="14" fill="#f8fafc" />
            <rect x="14" y="38" width="6" height="1" fill="#cbd5e1" />
            <rect x="44" y="38" width="6" height="1" fill="#cbd5e1" />

            {/* Orange Leg Warmers */}
            <rect x="21" y="54" width="10" height="6" fill="#f97316" />
            <rect x="33" y="54" width="10" height="6" fill="#f97316" />
            <rect x="21" y="60" width="10" height="2" fill="#1e3a8a" />
            <rect x="33" y="60" width="10" height="2" fill="#1e3a8a" />

            {/* Lotus Green Flames */}
            {isJutsuActive && (
              <g>
                <circle cx="32" cy="32" r="26" stroke="#34d399" strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.9" />
                <path d="M20 16 Q32 0 44 16 Q54 32 44 48 Q32 64 20 48 Z" fill="#10b981" opacity="0.3" />
              </g>
            )}

            <defs>
              <radialGradient id="leeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );

      case 'gaara':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl" shapeRendering="crispEdges">
            <circle cx="32" cy="32" r="28" fill="url(#gaaraGlow)" opacity="0.4" />

            {/* Spiky Auburn Red Hair */}
            <rect x="22" y="8" width="20" height="8" fill="#991b1b" />
            <rect x="18" y="12" width="6" height="8" fill="#b91c1c" />
            <rect x="40" y="12" width="6" height="8" fill="#b91c1c" />

            {/* Pale Face */}
            <rect x="22" y="20" width="20" height="12" fill="#f3f4f6" />
            {/* 'Ai' (Love) Kanji on Forehead */}
            <rect x="24" y="18" width="4" height="4" fill="#dc2626" />
            {/* Dark Ringed Turquoise Eyes (No Eyebrows) */}
            <rect x="24" y="23" width="5" height="4" fill="#0f172a" />
            <rect x="35" y="23" width="5" height="4" fill="#0f172a" />
            <rect x="25" y="24" width="3" height="2" fill="#2dd4bf" />
            <rect x="36" y="24" width="3" height="2" fill="#2dd4bf" />

            {/* Sand Gourd Strap on Chest */}
            <rect x="18" y="32" width="28" height="15" fill="#451a03" />
            <line x1="20" y1="32" x2="44" y2="47" stroke="#ffffff" strokeWidth="2" />

            {/* Giant Sand Gourd Behind */}
            <circle cx="48" cy="36" r="10" fill="#d97706" />
            <circle cx="48" cy="24" r="7" fill="#d97706" />

            {/* Dark Pants & Sand Boots */}
            <rect x="22" y="47" width="9" height="10" fill="#1c1917" />
            <rect x="33" y="47" width="9" height="10" fill="#1c1917" />
            <rect x="21" y="57" width="10" height="4" fill="#78350f" />
            <rect x="33" y="57" width="10" height="4" fill="#78350f" />

            {/* Sand Swirl Effect */}
            {isJutsuActive && (
              <g>
                <circle cx="32" cy="32" r="26" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 3" fill="none" opacity="0.8" />
                <rect x="10" y="20" width="8" height="6" fill="#d97706" opacity="0.6" />
                <rect x="46" y="45" width="10" height="6" fill="#d97706" opacity="0.6" />
              </g>
            )}

            <defs>
              <radialGradient id="gaaraGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );

      case 'kakashi':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl" shapeRendering="crispEdges">
            <circle cx="32" cy="32" r="28" fill="url(#kakashiGlow)" opacity="0.4" />

            {/* Silver Spiky Hair swept to side */}
            <rect x="22" y="6" width="20" height="8" fill="#cbd5e1" />
            <rect x="18" y="10" width="10" height="8" fill="#e2e8f0" />
            <rect x="38" y="8" width="10" height="8" fill="#94a3b8" />

            {/* Tilted Konoha Headband covering Left Eye */}
            <line x1="18" y1="18" x2="46" y2="24" stroke="#1e293b" strokeWidth="5" />
            <rect x="27" y="18" width="10" height="4" fill="#cbd5e1" />

            {/* Face Mask */}
            <rect x="22" y="21" width="20" height="12" fill="#1e293b" />
            {/* Right Calm Dark Eye */}
            <rect x="36" y="21" width="4" height="2" fill="#0f172a" />
            <rect x="37" y="22" width="2" height="1" fill="#ffffff" />

            {/* Jonin Flak Vest (Green) */}
            <rect x="18" y="33" width="28" height="15" fill="#065f46" />
            <rect x="22" y="36" width="8" height="5" fill="#047857" />
            <rect x="34" y="36" width="8" height="5" fill="#047857" />
            {/* High Blue Collar */}
            <rect x="24" y="30" width="16" height="4" fill="#1e293b" />

            {/* Dark Blue Pants & Shinobi Sandals */}
            <rect x="22" y="48" width="9" height="10" fill="#0f172a" />
            <rect x="33" y="48" width="9" height="10" fill="#0f172a" />
            <rect x="21" y="58" width="10" height="4" fill="#1e293b" />
            <rect x="33" y="58" width="10" height="4" fill="#1e293b" />

            {/* Raikiri Lightning Hand */}
            {isJutsuActive && (
              <g>
                <circle cx="50" cy="48" r="9" fill="#38bdf8" opacity="0.9" />
                <path d="M44 42 L52 48 L48 54 L56 50" stroke="#ffffff" strokeWidth="2" fill="none" />
              </g>
            )}

            <defs>
              <radialGradient id="kakashiGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );

      case 'itachi':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-2xl" shapeRendering="crispEdges">
            <circle cx="32" cy="32" r="28" fill="url(#itachiGlow)" opacity="0.4" />

            {/* Center-parted Black Hair */}
            <rect x="22" y="8" width="20" height="8" fill="#09090b" />
            <rect x="18" y="12" width="6" height="16" fill="#18181b" />
            <rect x="40" y="12" width="6" height="16" fill="#18181b" />

            {/* Scratched Renegade Headband */}
            <rect x="22" y="16" width="20" height="4" fill="#18181b" />
            <rect x="26" y="17" width="12" height="2" fill="#a1a1aa" />
            <line x1="26" y1="18" x2="38" y2="18" stroke="#dc2626" strokeWidth="1" />

            {/* Pale Face with Deep Tear-trough lines */}
            <rect x="22" y="20" width="20" height="11" fill="#f4f4f5" />
            <line x1="25" y1="26" x2="27" y2="30" stroke="#71717a" strokeWidth="1" />
            <line x1="39" y1="26" x2="37" y2="30" stroke="#71717a" strokeWidth="1" />

            {/* Mangekyō Sharingan Glowing Red */}
            <rect x="25" y="23" width="3" height="3" fill="#ef4444" />
            <rect x="36" y="23" width="3" height="3" fill="#ef4444" />
            <circle cx="26.5" cy="24.5" r="0.8" fill="#000000" />
            <circle cx="37.5" cy="24.5" r="0.8" fill="#000000" />

            {/* Akatsuki Cloak with Red Clouds */}
            <rect x="16" y="31" width="32" height="26" fill="#09090b" />
            <rect x="22" y="31" width="20" height="4" fill="#881337" />
            {/* Red Cloud Motif */}
            <circle cx="28" cy="42" r="4" fill="#dc2626" />
            <circle cx="34" cy="42" r="5" fill="#dc2626" />
            <rect x="26" y="42" width="10" height="4" fill="#dc2626" />

            {/* Amaterasu Black Flames Effect */}
            {isJutsuActive && (
              <g>
                <circle cx="32" cy="32" r="26" stroke="#f43f5e" strokeWidth="2" fill="none" opacity="0.8" />
                <path d="M22 28 Q32 14 42 28 Q48 40 32 50 Q16 40 22 28 Z" fill="#000000" stroke="#e11d48" strokeWidth="1.5" opacity="0.8" />
              </g>
            )}

            <defs>
              <radialGradient id="itachiGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#e11d48" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#881337" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses}`}>
      {/* Background Pulse Aura */}
      <motion.div
        animate={{
          scale: isJutsuActive ? [1, 1.25, 1.1] : [1, 1.08, 1],
          opacity: isJutsuActive ? [0.6, 0.95, 0.7] : [0.3, 0.6, 0.3],
        }}
        transition={{
          repeat: Infinity,
          duration: isJutsuActive ? 1.2 : 2.8,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 rounded-full blur-xl pointer-events-none"
        style={{
          backgroundColor: character.themeColor.primary,
        }}
      />

      {/* Floating Shinobi Sprite */}
      <motion.div
        animate={{
          y: isJutsuActive ? [0, -6, 0] : [0, -4, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: 'easeInOut',
        }}
        className="relative w-full h-full flex items-center justify-center"
      >
        {renderPixelCharacter()}
      </motion.div>
    </div>
  );
};
