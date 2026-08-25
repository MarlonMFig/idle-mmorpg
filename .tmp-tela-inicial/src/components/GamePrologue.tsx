import confetti from 'canvas-confetti';
import { ArrowLeft, Award, Flame, Play, RefreshCw, Shield, Sparkles, Swords, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { ShinobiCharacter, Village } from '../types';
import { sounds } from '../utils/audio';
import { ShinobiAvatar } from './ShinobiAvatar';

interface GamePrologueProps {
  character: ShinobiCharacter;
  playerName: string;
  village: Village;
  onReset: () => void;
}

export const GamePrologue: React.FC<GamePrologueProps> = ({
  character,
  playerName,
  village,
  onReset,
}) => {
  const [level, setLevel] = useState<number>(1);
  const [xp, setXp] = useState<number>(35);
  const [ryo, setRyo] = useState<number>(1000);
  const [chakra, setChakra] = useState<number>(100);
  const [battleLogs, setBattleLogs] = useState<string[]>([
    `[SISTEMA] Bem-vindo ao Mundo Shinobi, ${playerName}!`,
    `[REINO] Você iniciou sua jornada em ${village} como ${character.name}.`,
    `[RECOMPENSA] Kit de Iniciante recebido: 1.000 Ryos + 10x Kunais de Treino.`,
  ]);
  const [isTraining, setIsTraining] = useState<boolean>(false);

  useEffect(() => {
    // Fire celebratory confetti on game start
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: [character.themeColor.primary, '#38bdf8', '#ffffff'],
    });
  }, [character]);

  const handleIdleTrain = () => {
    setIsTraining(true);
    sounds.playJutsuTrigger();
    
    setTimeout(() => {
      const earnedXp = Math.floor(Math.random() * 25) + 20;
      const earnedRyo = Math.floor(Math.random() * 80) + 50;
      
      setXp((prev) => {
        const next = prev + earnedXp;
        if (next >= 100) {
          setLevel((l) => l + 1);
          sounds.playStartGame();
          setBattleLogs((logs) => [
            `🎉 LEVEL UP! ${playerName} avançou para o Nível ${level + 1}! Atributos aumentados!`,
            ...logs,
          ]);
          return next - 100;
        }
        return next;
      });

      setRyo((r) => r + earnedRyo);
      setBattleLogs((logs) => [
        `⚔️ Treinamento concluído com sucesso: +${earnedXp} EXP, +${earnedRyo} Ryos!`,
        ...logs.slice(0, 8),
      ]);
      setIsTraining(false);
    }, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl mx-auto bg-slate-950/80 border border-white/10 rounded-[32px] sm:rounded-[44px] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <button
          id="btn-back-to-select"
          onClick={() => {
            sounds.playSelect();
            onReset();
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Seleção</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_10px_rgba(34,211,238,0.15)]">
            <span>🪙</span>
            <span>{ryo.toLocaleString()} Ryos</span>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono font-bold shadow-[0_0_10px_rgba(56,189,248,0.15)]">
            <span>🌀</span>
            <span>{chakra}% Chakra</span>
          </div>
        </div>
      </div>

      {/* Main Hero Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Shinobi Card */}
        <div className="md:col-span-4 flex flex-col items-center text-center p-5 bg-slate-900/70 rounded-3xl border border-white/5 backdrop-blur-md">
          {/* Dashed circular ring around avatar */}
          <div 
            className="w-36 h-36 rounded-full border-2 border-dashed p-2 relative flex items-center justify-center mb-1"
            style={{ borderColor: `${character.themeColor.primary}55` }}
          >
            <ShinobiAvatar character={character} size="md" isJutsuActive={isTraining} />
          </div>
          
          <h2 className="text-xl font-black italic uppercase tracking-tight text-white mt-2 font-['Rajdhani',sans-serif]">
            {playerName}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {character.name} • RANK GENIN // LVL {level}
          </p>

          {/* EXP Bar */}
          <div className="w-full mt-4 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono font-bold uppercase text-slate-400">
              <span>PROGRESSO EXP</span>
              <span>{xp}/100</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                animate={{ width: `${xp}%` }}
                transition={{ duration: 0.3 }}
                style={{ boxShadow: '0 0 8px #22d3ee' }}
              />
            </div>
          </div>

          {/* Quick Train Action with Immersive Layered Offset */}
          <div className="w-full mt-4">
            <button
              id="btn-idle-train"
              disabled={isTraining}
              onClick={handleIdleTrain}
              className="group relative w-full py-3 px-4 bg-white text-black font-black text-xs uppercase italic tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <div 
                className="absolute inset-0 rounded-xl translate-x-1 translate-y-1 -z-10 group-hover:translate-x-1.5 group-hover:translate-y-1.5 transition-transform"
                style={{
                  backgroundColor: character.themeColor.primary,
                  boxShadow: `0 0 15px ${character.themeColor.primary}66`,
                }}
              />
              {isTraining ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Treinando Shinobi...</span>
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  <span>Treinar no Dojo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quest & Activity Feed */}
        <div className="md:col-span-8 flex flex-col gap-4">
          <div className="p-4 sm:p-5 bg-slate-900/60 rounded-3xl border border-white/5 backdrop-blur-md">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-300 flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              MISSÕES INICIAIS DA VILA (RANK D)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Capturar o Gato Tora</span>
                  <span className="text-emerald-400 font-mono">+150 XP</span>
                </div>
                <p className="text-[11px] text-slate-400">Pratique agilidade e furtividade pelas ruas da vila.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Treino de Escalada com Chakra</span>
                  <span className="text-cyan-400 font-mono">+220 XP</span>
                </div>
                <p className="text-[11px] text-slate-400">Controle o fluxo constante de chakra nos pés.</p>
              </div>
            </div>
          </div>

          {/* Battle / System Logs Console */}
          <div className="p-4 sm:p-5 bg-slate-950/70 rounded-3xl border border-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-cyan-400" />
                CONSOLE DE ATIVIDADES // LOGS EM TEMPO REAL
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto font-mono text-[11px] text-slate-300 pr-1">
              {battleLogs.map((log, index) => (
                <div key={index} className="leading-relaxed border-l-2 border-cyan-400/40 pl-2 py-0.5">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
