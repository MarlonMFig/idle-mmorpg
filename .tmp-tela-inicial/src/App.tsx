import { Dice5, Play, ShieldAlert, Sparkles, Volume2, VolumeX, Swords, Shield, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { BackgroundEffects } from './components/BackgroundEffects';
import { CharacterCarousel } from './components/CharacterCarousel';
import { GamePrologue } from './components/GamePrologue';
import { VillageSelector } from './components/VillageSelector';
import { CHARACTERS, RANDOM_NICKNAMES } from './data/characters';
import { ShinobiCharacter, Village } from './types';
import { sounds } from './utils/audio';

export default function App() {
  const [selectedCharacter, setSelectedCharacter] = useState<ShinobiCharacter>(CHARACTERS[0]);
  const [direction, setDirection] = useState<number>(0);
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedVillage, setSelectedVillage] = useState<Village>('Konohagakure');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  // Toggle Sound effects
  const toggleSound = () => {
    sounds.soundEnabled = !sounds.soundEnabled;
    setIsAudioMuted(!sounds.soundEnabled);
    if (sounds.soundEnabled) {
      sounds.playSelect();
    }
  };

  // Keyboard navigation for arrows & enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStarted) return;
      // Don't trigger if user is actively typing in the input field
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT') {
        if (e.key === 'Enter') {
          handleStartJourney();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedCharacter.id);
        const nextIdx = (currentIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
        sounds.playWhoosh('left');
        setDirection(-1);
        setSelectedCharacter(CHARACTERS[nextIdx]);
      } else if (e.key === 'ArrowRight') {
        const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedCharacter.id);
        const nextIdx = (currentIndex + 1) % CHARACTERS.length;
        sounds.playWhoosh('right');
        setDirection(1);
        setSelectedCharacter(CHARACTERS[nextIdx]);
      } else if (e.key === 'Enter') {
        handleStartJourney();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCharacter, playerName, selectedVillage, gameStarted]);

  // Handle character switch with direction
  const handleSelectCharacter = (char: ShinobiCharacter, dir: 'left' | 'right') => {
    setDirection(dir === 'right' ? 1 : -1);
    setSelectedCharacter(char);
  };

  // Random nickname generator
  const handleRandomNickname = () => {
    sounds.playSelect();
    const randomName = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)];
    const randomSuffix = Math.floor(Math.random() * 90 + 10);
    setPlayerName(`${randomName}${randomSuffix}`);
    setValidationError(null);
  };

  // Start journey submission
  const handleStartJourney = () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setValidationError('Por favor, informe seu nome shinobi para iniciar a aventura.');
      sounds.playWhoosh('left');
      return;
    }

    if (trimmedName.length < 3) {
      setValidationError('Seu nome ninja deve ter pelo menos 3 caracteres.');
      return;
    }

    setValidationError(null);
    sounds.playStartGame();
    setGameStarted(true);
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-3 sm:p-6 md:p-8 font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Animated Chakra Field & Particles */}
      <BackgroundEffects activeCharacter={selectedCharacter} />

      {/* Audio Mute / Unmute Floating Control */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <button
          id="btn-toggle-audio"
          onClick={toggleSound}
          aria-label={isAudioMuted ? 'Ativar som' : 'Desativar som'}
          className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white transition-all backdrop-blur-md shadow-xl flex items-center gap-2 text-xs cursor-pointer hover:scale-105 active:scale-95"
        >
          {isAudioMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline text-slate-400 font-mono">Mudo</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline text-slate-300 font-mono">Som Ativo</span>
            </>
          )}
        </button>
      </div>

      {/* Main Container View */}
      <div className="relative z-10 w-full max-w-2xl my-auto py-4">
        <AnimatePresence mode="wait">
          {!gameStarted ? (
            <motion.div
              key="setup-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full bg-slate-950/80 backdrop-blur-2xl border border-white/10 rounded-[32px] sm:rounded-[44px] p-5 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex flex-col gap-5 relative overflow-hidden"
              style={{
                boxShadow: `0 20px 60px -15px ${selectedCharacter.themeColor.primary}25, 0 0 0 1px rgba(255,255,255,0.08)`,
              }}
            >
              {/* Top Tactical Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.35em] text-cyan-400 font-bold block mb-0.5">
                    SHINOBI PROTOCOL // S-04
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter italic uppercase text-white font-['Rajdhani',sans-serif] leading-none">
                    SELEÇÃO DE PERSONAGEM
                  </h1>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">TEMPORADA 04</div>
                    <div className="text-xs font-mono font-bold text-slate-200">RANK // CHŪNIN IV</div>
                  </div>
                  <div 
                    className="w-10 h-10 rounded-full border border-cyan-500/30 bg-slate-900 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(34,211,238,0.2)] text-base"
                    style={{ borderColor: `${selectedCharacter.themeColor.primary}66` }}
                  >
                    <span>{selectedCharacter.elementIcon}</span>
                  </div>
                </div>
              </div>

              {/* Name Input Section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="player-name-input"
                    className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 flex items-center gap-1.5"
                  >
                    <span>IDENTIFICAÇÃO DO NINJA</span>
                  </label>
                  <button
                    id="btn-random-name"
                    type="button"
                    onClick={handleRandomNickname}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline transition-all cursor-pointer font-mono font-semibold"
                  >
                    <Dice5 className="w-3.5 h-3.5" />
                    <span>Nome Aleatório</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="player-name-input"
                    type="text"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Digite seu nome ninja (ex: UzumakiRen, ShadowGenin)..."
                    maxLength={20}
                    className={`w-full bg-slate-900/90 border rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-all ${
                      validationError
                        ? 'border-rose-500/80 focus:ring-2 focus:ring-rose-500/30'
                        : 'border-white/10 focus:border-cyan-400/80 focus:ring-2 focus:ring-cyan-400/20'
                    }`}
                  />
                  {playerName.length > 0 && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-500">
                      {playerName.length}/20
                    </span>
                  )}
                </div>

                {/* Validation Error Notice */}
                {validationError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 text-xs text-rose-400 font-medium mt-0.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{validationError}</span>
                  </motion.div>
                )}
              </div>

              {/* Character Selection with Navigation Arrows & Immersive Presentation */}
              <CharacterCarousel
                selectedCharacter={selectedCharacter}
                onSelectCharacter={handleSelectCharacter}
                direction={direction}
              />

              {/* Village Regional Affinity Selector */}
              <VillageSelector
                selectedVillage={selectedVillage}
                onSelectVillage={setSelectedVillage}
              />

              {/* Immersive UI Layered Offset CTA Button */}
              <div className="pt-2">
                <motion.button
                  id="btn-start-shinobi-journey"
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={handleStartJourney}
                  className="group relative w-full py-4 px-6 bg-white text-black font-black uppercase italic tracking-wider transition-all rounded-2xl cursor-pointer shadow-2xl flex items-center justify-center gap-3 overflow-visible"
                >
                  {/* Layered Accent Offset Shadow */}
                  <div 
                    className="absolute inset-0 rounded-2xl translate-x-1.5 translate-y-1.5 -z-10 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform"
                    style={{
                      backgroundColor: selectedCharacter.themeColor.primary,
                      boxShadow: `0 0 25px ${selectedCharacter.themeColor.primary}88`,
                    }}
                  />

                  <Swords className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span className="text-sm sm:text-base font-extrabold tracking-widest drop-shadow-sm font-['Rajdhani',sans-serif]">
                    INICIAR JORNADA 
                  </span>
                  <Swords className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <GamePrologue
              key="game-prologue"
              character={selectedCharacter}
              playerName={playerName}
              village={selectedVillage}
              onReset={() => setGameStarted(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer System Branding */}
      <footer className="relative z-10 text-center mt-4 text-[11px] text-slate-500 font-mono">
        <span>AURA PROTOCOL // UNIVERSO SHINOBI © 2026 • NAVEGUE COM AS SETAS ◀ ▶</span>
      </footer>
    </div>
  );
}
