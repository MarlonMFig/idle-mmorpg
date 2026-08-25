import React from 'react';
import { Character, Skill } from '../types';
import { RARITY_CONFIG } from '../utils/rarity';
import { sound } from '../utils/audio';
import { 
  X, 
  BookOpen, 
  Zap, 
  Flame, 
  Disc, 
  Sparkles, 
  Clock, 
  Eye, 
  ShieldAlert, 
  CloudLightning,
  Hammer
} from 'lucide-react';

interface SkillsModalProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
}

export const SkillsModal: React.FC<SkillsModalProps> = ({
  character,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const renderSkillIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap': return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'Flame': return <Flame className="w-5 h-5 text-orange-400" />;
      case 'Disc': return <Disc className="w-5 h-5 text-cyan-400" />;
      case 'Eye': return <Eye className="w-5 h-5 text-purple-400" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-amber-400" />;
      case 'CloudLightning': return <CloudLightning className="w-5 h-5 text-blue-400" />;
      case 'Hammer': return <Hammer className="w-5 h-5 text-rose-400" />;
      default: return <Zap className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Rajdhani'] uppercase tracking-wider text-white">
                Grimório de Jutsus & Habilidades · {character.name}
              </h2>
              <p className="text-xs text-white/50">
                Técnicas ativas, passivas e supremas desbloqueadas através de maestria
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {character.skills.map((skill) => {
            const isUltimate = skill.type === 'Suprema';
            const isPassive = skill.type === 'Passiva';

            return (
              <div
                key={skill.id}
                className={`p-4 rounded-xl border transition-all ${
                  isUltimate
                    ? 'bg-gradient-to-r from-purple-900/30 via-slate-900/40 to-slate-900/60 border-purple-500/50 shadow-md'
                    : isPassive
                    ? 'bg-slate-800/30 border-white/10'
                    : 'bg-slate-800/50 border-blue-500/30'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${
                    isUltimate
                      ? 'bg-purple-950/60 border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-900 border-white/10'
                  }`}>
                    {renderSkillIcon(skill.iconName)}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white font-['Rajdhani']">
                          {skill.name}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isUltimate
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            : isPassive
                            ? 'bg-white/5 text-white/50 border border-white/10'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {skill.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono">
                        {skill.chakraCost > 0 && (
                          <span className="text-blue-400 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {skill.chakraCost} Chakra
                          </span>
                        )}
                        {skill.cooldown > 0 && (
                          <span className="text-white/40 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {skill.cooldown}T Cooldown
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed pt-1">
                      {skill.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
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
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
