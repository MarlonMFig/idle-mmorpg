import React from 'react';
import { Shield, Trophy, MessageSquare, Compass, Users, HeartPulse, Sparkles, Map, ArrowLeft, Crosshair, ChevronRight } from 'lucide-react';
import { sounds } from '../utils/audio';

interface GameHUDProps {
  onOpenGuild: () => void;
  isGuildOpen: boolean;
  unreadGuildChatCount?: number;
}

export const GameHUD: React.FC<GameHUDProps> = ({ onOpenGuild, isGuildOpen, unreadGuildChatCount = 0 }) => {
  return (
    <div className="relative w-full h-screen overflow-hidden select-none bg-[#0a100c] text-white">
      {/* Pixelated Forest Battlefield Background (Simulating Anime World Idle Field) */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-70 filter brightness-90 saturate-110"
        style={{
          backgroundImage: `radial-gradient(circle at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.85) 100%), url('https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1600&auto=format&fit=crop&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Pixel Grass overlay texture */}
        <div className="absolute inset-0 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
      </div>

      {/* Simulated Character Sprites on Field */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {/* Monarca (Player Character) */}
        <div className="absolute top-[48%] left-[49%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="bg-[#111813]/90 border border-[#f59e0b] text-[#f59e0b] px-2 py-0.5 rounded text-[11px] font-bold shadow-lg uppercase tracking-wider animate-pulse">
            MONARCA
          </div>
          <div className="w-10 h-12 bg-[#22c55e]/20 border-2 border-[#22c55e] rounded-full mt-1 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.4)]">
            <span className="text-xl">🥋</span>
          </div>
        </div>

        {/* Uchiha Itachi Spawns on Field */}
        {[
          { top: '30%', left: '35%', label: 'Uchiha Itachi' },
          { top: '25%', left: '50%', label: 'Uchiha Itachi' },
          { top: '28%', left: '60%', label: 'Uchiha Itachi' },
          { top: '40%', left: '30%', label: 'Uchiha Itachi' },
          { top: '42%', left: '68%', label: 'Uchiha Itachi' },
          { top: '55%', left: '36%', label: 'Uchiha Itachi' },
          { top: '53%', left: '64%', label: 'Uchiha Itachi' },
        ].map((item, idx) => (
          <div key={idx} className="absolute flex flex-col items-center" style={{ top: item.top, left: item.left }}>
            <div className="text-[10px] text-gray-200 font-semibold bg-black/70 px-1.5 py-0.2 rounded border border-gray-700">
              {item.label}
            </div>
            <div className="w-6 h-1 bg-[#22c55e] rounded-full mt-0.5 border border-black" />
            <div className="w-8 h-10 mt-0.5 flex items-center justify-center opacity-90">
              <span className="text-lg">🥷</span>
            </div>
          </div>
        ))}

        {/* Vila Landmark Indicator */}
        <div className="absolute top-[58%] left-[70%] flex flex-col items-center">
          <span className="text-xs font-bold text-white bg-black/80 px-2 py-0.5 rounded border border-gray-600">
            Vila
          </span>
          <div className="w-12 h-12 bg-pink-300/80 rounded-full border-2 border-white flex items-center justify-center text-xl font-bold text-black mt-1 shadow-lg">
            V
          </div>
        </div>
      </div>

      {/* TOP MENU NAVIGATION BAR (Exact replica of top menu in user screenshot) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#121714]/90 border border-[#2b382f] p-1.5 rounded-2xl shadow-2xl backdrop-blur-md">
        {/* Equipe */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">👥</span>
          <span className="text-[9px] text-gray-300 font-medium">Equipe</span>
        </button>

        {/* Inventário */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🎒</span>
          <span className="text-[9px] text-gray-300 font-medium">Inventário</span>
        </button>

        {/* Médico */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🧰</span>
          <span className="text-[9px] text-gray-300 font-medium">Médico</span>
        </button>

        {/* Anime Coins */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🪙</span>
          <span className="text-[9px] text-gray-300 font-medium">Coins</span>
        </button>

        {/* Clã */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🛡️</span>
          <span className="text-[9px] text-gray-300 font-medium">Clã</span>
        </button>

        {/* GUILD (HIGHLIGHTED & CLICKABLE) */}
        <button
          onClick={() => {
            sounds.playClick();
            onOpenGuild();
          }}
          className={`relative flex flex-col items-center justify-center w-14 h-13 rounded-xl border transition-all duration-200 transform hover:scale-105 ${
            isGuildOpen
              ? 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.6)]'
              : 'bg-gradient-to-b from-amber-900/80 to-amber-950/90 border-amber-500/80 hover:border-amber-400 shadow-md'
          }`}
        >
          {unreadGuildChatCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce border border-white">
              {unreadGuildChatCount}
            </span>
          )}
          <span className="text-xl drop-shadow">🚩</span>
          <span className="text-[10px] text-amber-200 font-bold uppercase tracking-wider">Guild</span>
        </button>

        {/* Ranking */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🏆</span>
          <span className="text-[9px] text-gray-300 font-medium">Ranking</span>
        </button>

        {/* Analyzer */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🔍</span>
          <span className="text-[9px] text-gray-300 font-medium">Analyzer</span>
        </button>

        {/* Mapa */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#19221c] border border-[#2b3a2e] hover:border-gray-400 transition"
        >
          <span className="text-lg">🗺️</span>
          <span className="text-[9px] text-gray-300 font-medium">Mapa</span>
        </button>

        {/* Voltar */}
        <button 
          onClick={() => sounds.playClick()}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[#1e272b] border border-blue-900/80 hover:border-blue-500 transition text-blue-300"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[9px] font-bold uppercase">Voltar</span>
        </button>
      </div>

      {/* TOP LEFT CHARACTER TEAM HUD */}
      <div className="absolute top-3 left-3 z-10 w-64 bg-[#111613]/90 border border-[#2b382f] rounded-lg p-2.5 shadow-2xl backdrop-blur-sm">
        <div className="text-[10px] text-amber-500 font-bold tracking-wider uppercase">EQUIPE</div>
        <div className="text-lg font-bold text-white game-title-font flex items-center justify-between">
          <span>MONARCA</span>
          <span className="text-xs text-gray-400 font-normal">Nível 51 – Rock Lee</span>
        </div>

        {/* Party list */}
        <div className="mt-2 space-y-1.5">
          {/* Uchiha Itachi */}
          <div className="flex items-center gap-2 bg-[#17201a] p-1 rounded border border-[#27352b]">
            <div className="w-7 h-7 bg-red-950 rounded border border-red-800 flex items-center justify-center text-xs">
              🥷
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-200 truncate">UCHIHA ITACHI</span>
                <span className="text-emerald-400">Lv.51</span>
              </div>
              <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800 mt-0.5">
                <div className="bg-emerald-500 h-full w-[100%]" />
              </div>
              <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden border border-gray-800 mt-0.5">
                <div className="bg-amber-400 h-full w-[80%]" />
              </div>
            </div>
          </div>

          {/* Toshiro Hitsugaya */}
          <div className="flex items-center gap-2 bg-[#17201a] p-1 rounded border border-[#27352b]">
            <div className="w-7 h-7 bg-blue-950 rounded border border-blue-800 flex items-center justify-center text-xs">
              ⚔️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-200 truncate">TOSHIRO HITSUGAYA</span>
                <span className="text-emerald-400">Lv.51</span>
              </div>
              <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800 mt-0.5">
                <div className="bg-emerald-500 h-full w-[100%]" />
              </div>
              <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden border border-gray-800 mt-0.5">
                <div className="bg-amber-400 h-full w-[0%]" />
              </div>
            </div>
          </div>

          {/* Rock Lee */}
          <div className="flex items-center gap-2 bg-[#17201a] p-1 rounded border border-[#27352b]">
            <div className="w-7 h-7 bg-emerald-950 rounded border border-emerald-800 flex items-center justify-center text-xs">
              🥋
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-gray-200 truncate">ROCK LEE</span>
                <span className="text-emerald-400">Lv.51</span>
              </div>
              <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-800 mt-0.5">
                <div className="bg-emerald-500 h-full w-[100%]" />
              </div>
              <div className="w-full bg-gray-900 h-1 rounded-full overflow-hidden border border-gray-800 mt-0.5">
                <div className="bg-amber-400 h-full w-[84%]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE QUEST BOX */}
      <div className="absolute top-3 right-3 z-10 w-64 bg-[#111613]/90 border border-[#2b382f] rounded-lg p-2 shadow-2xl backdrop-blur-sm">
        <div className="flex justify-between items-center border-b border-gray-800 pb-1">
          <span className="text-xs font-bold text-white uppercase tracking-wider">VILAS (V)</span>
          <span className="text-[10px] text-gray-500">J  x</span>
        </div>
        <div className="mt-2 text-xs font-bold text-gray-300">MISSÕES</div>
        <div className="mt-1 text-[11px] text-gray-400 italic">
          Nenhuma missão em andamento. Fale com Iruka.
        </div>
        <div className="mt-3 flex items-center text-[10px] text-gray-400 hover:text-amber-400 cursor-pointer">
          <ChevronRight className="w-3 h-3 mr-0.5" />
          <span>TODAS AS MISSÕES</span>
        </div>
      </div>

      {/* BOTTOM LEFT MINI GAME CHAT PREVIEW */}
      <div className="absolute bottom-3 left-3 z-10 w-80 bg-[#0d120f]/95 border border-[#232e27] rounded-lg p-2 shadow-2xl">
        <div className="text-xs font-bold text-amber-500 mb-1 border-b border-gray-800 pb-1 flex justify-between items-center">
          <span>CHAT DO JOGO</span>
          <button 
            onClick={onOpenGuild}
            className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/80"
          >
            <span>Janela de Guilda</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="h-20 overflow-y-auto text-[11px] space-y-1 pr-1 text-gray-300 font-mono">
          <p className="text-gray-400">[Sistema] Bem-vindo à jornada.</p>
          <p className="text-amber-300">[Guilda] MONARCA: Galera, abram a Janela de Guilda no menu topo!</p>
          <p className="text-emerald-400">[Sistema] Selamento bem-sucedido! Rock Lee entrou na coleção (Comum).</p>
        </div>
        <div className="mt-2 flex gap-1">
          <input 
            type="text" 
            placeholder="Mensagem..." 
            disabled
            className="flex-1 bg-black/60 border border-gray-800 rounded px-2 py-1 text-xs text-gray-400 cursor-not-allowed"
          />
          <button 
            onClick={onOpenGuild}
            className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded border border-emerald-600"
          >
            ENVIAR
          </button>
        </div>
      </div>

      {/* BOTTOM MIDDLE JUTSUS BAR */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-[#111613]/90 border border-[#2b382f] p-1.5 rounded-lg flex items-center gap-2 shadow-2xl">
        <div className="text-[10px] text-gray-400 font-bold uppercase mr-1">JUTSUS <span className="text-emerald-400">auto</span></div>
        {[1, 2, 3, 4].map((slot) => (
          <div key={slot} className="w-10 h-10 bg-black/80 border border-gray-700 rounded flex flex-col items-center justify-center text-xs relative">
            <span className="text-[9px] text-gray-500 absolute top-0.5 left-1">{slot}</span>
            <span className="text-sm">🌀</span>
            <span className="text-[8px] text-gray-400 absolute bottom-0.5 right-1">3.0</span>
          </div>
        ))}
      </div>
    </div>
  );
};
