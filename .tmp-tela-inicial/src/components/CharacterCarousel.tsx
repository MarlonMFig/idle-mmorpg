import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React from 'react';
import { CHARACTERS } from '../data/characters';
import { ShinobiCharacter } from '../types';
import { sounds } from '../utils/audio';
import { ShinobiAvatar } from './ShinobiAvatar';

interface CharacterCarouselProps {
  selectedCharacter: ShinobiCharacter;
  onSelectCharacter: (char: ShinobiCharacter, direction: 'left' | 'right') => void;
  direction: number; // -1 for prev, 1 for next
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
    scale: 0.92,
    filter: 'blur(6px)',
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      x: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.3 },
      scale: { duration: 0.3 },
      filter: { duration: 0.2 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 100 : -100,
    opacity: 0,
    scale: 0.92,
    filter: 'blur(6px)',
    transition: {
      x: { type: 'spring', stiffness: 350, damping: 30 },
      opacity: { duration: 0.25 },
      scale: { duration: 0.25 },
      filter: { duration: 0.2 },
    },
  }),
};

export const CharacterCarousel: React.FC<CharacterCarouselProps> = ({
  selectedCharacter,
  onSelectCharacter,
  direction,
}) => {
  const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedCharacter.id);

  const handlePrev = () => {
    sounds.playWhoosh('left');
    const nextIdx = (currentIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
    onSelectCharacter(CHARACTERS[nextIdx], 'left');
  };

  const handleNext = () => {
    sounds.playWhoosh('right');
    const nextIdx = (currentIndex + 1) % CHARACTERS.length;
    onSelectCharacter(CHARACTERS[nextIdx], 'right');
  };

  const handleQuickSelect = (index: number) => {
    if (index === currentIndex) return;
    const dir = index > currentIndex ? 'right' : 'left';
    sounds.playSelect();
    onSelectCharacter(CHARACTERS[index], dir);
  };

  return (
    <div className="relative w-full flex flex-col gap-4">
      {/* Top Header Protocol Bar & Character Counter */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_currentColor]"
            style={{ backgroundColor: selectedCharacter.themeColor.primary, color: selectedCharacter.themeColor.primary }}
          />
          <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400">
            AGENTE SELECIONADO // {currentIndex + 1} DE {CHARACTERS.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono font-bold text-slate-300">
          <span className="text-cyan-400 font-bold">ELEMENTO:</span>
          <span>{selectedCharacter.element}</span>
        </div>
      </div>

      {/* Main Carousel Area with Centered Character Display */}
      <div className="relative min-h-[340px] sm:min-h-[380px] flex items-center justify-center">
        {/* Left Arrow Button */}
        <button
          id="btn-nav-prev-character"
          onClick={handlePrev}
          aria-label="Personagem Anterior"
          className="absolute -left-2 sm:-left-5 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/10 bg-slate-900/80 hover:bg-slate-800/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all group focus:outline-none focus:ring-2 focus:ring-cyan-400/50 cursor-pointer"
          style={{
            boxShadow: `0 8px 24px -4px ${selectedCharacter.themeColor.primary}44`,
          }}
        >
          <ChevronLeft className="w-6 h-6 text-slate-300 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
          <span className="sr-only">Anterior</span>
        </button>

        {/* Right Arrow Button */}
        <button
          id="btn-nav-next-character"
          onClick={handleNext}
          aria-label="Próximo Personagem"
          className="absolute -right-2 sm:-right-5 z-20 w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/10 bg-slate-900/80 hover:bg-slate-800/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all group focus:outline-none focus:ring-2 focus:ring-cyan-400/50 cursor-pointer"
          style={{
            boxShadow: `0 8px 24px -4px ${selectedCharacter.themeColor.primary}44`,
          }}
        >
          <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
          <span className="sr-only">Próximo</span>
        </button>

        {/* Animated Character Card - Purely Centered Character */}
        <div className="w-full overflow-hidden px-2 sm:px-4 py-2">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={selectedCharacter.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full bg-slate-900/60 rounded-[32px] sm:rounded-[40px] border border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md flex flex-col items-center justify-center text-center"
            >
              {/* Subtle top edge highlight */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${selectedCharacter.themeColor.primary}, transparent)`,
                }}
              />

              {/* Immersive Giant Watermark Text behind Avatar */}
              <div className="absolute inset-0 flex items-center justify-center text-[90px] sm:text-[140px] font-black text-white/[0.03] select-none tracking-tighter uppercase pointer-events-none font-['Rajdhani',sans-serif] leading-none">
                {selectedCharacter.id}
              </div>

              {/* Dashed Circular Aura Container with Avatar */}
              <div className="relative py-2 z-10 flex flex-col items-center">
                <div 
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-2 border-dashed p-3 sm:p-4 relative flex items-center justify-center transition-colors duration-500"
                  style={{
                    borderColor: `${selectedCharacter.themeColor.primary}66`,
                    boxShadow: `0 0 35px ${selectedCharacter.themeColor.primary}25`,
                  }}
                >
                  {/* Inner Circular Aura Glow */}
                  <div 
                    className="absolute inset-2 rounded-full pointer-events-none opacity-45 blur-lg"
                    style={{
                      background: `radial-gradient(circle, ${selectedCharacter.themeColor.primary} 0%, transparent 70%)`,
                    }}
                  />

                  <ShinobiAvatar
                    character={selectedCharacter}
                    size="lg"
                    isJutsuActive={false}
                  />
                </div>

                {/* Character Name in High-Contrast Centered Typography */}
                <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-wider text-white mt-4 font-['Rajdhani',sans-serif] drop-shadow-md">
                  {selectedCharacter.name}
                </h3>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Character Selector Roster (Immersive UI Thumbnail Cards) */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 pt-1">
        {CHARACTERS.map((char, idx) => {
          const isActive = char.id === selectedCharacter.id;
          return (
            <button
              key={char.id}
              id={`char-thumb-${char.id}`}
              onClick={() => handleQuickSelect(idx)}
              className="flex flex-col items-center gap-1 cursor-pointer transition-all group focus:outline-none"
            >
              <div 
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-base sm:text-lg transition-all ${
                  isActive
                    ? 'border-2 border-cyan-400 bg-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-105'
                    : 'border border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30 grayscale hover:grayscale-0'
                }`}
                style={{
                  borderColor: isActive ? char.themeColor.primary : undefined,
                  boxShadow: isActive ? `0 0 15px ${char.themeColor.primary}66` : undefined,
                }}
              >
                <span>{char.elementIcon}</span>
              </div>
              <span className={`text-[9px] uppercase font-bold tracking-widest transition-colors ${
                isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
              }`}>
                {char.name.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
