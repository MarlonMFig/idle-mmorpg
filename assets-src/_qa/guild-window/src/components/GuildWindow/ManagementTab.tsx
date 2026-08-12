import React, { useState } from 'react';
import { GuildInfo, JoinRequest } from '../../types';
import { Settings, Check, X, Shield, Save, Edit3, UserCheck, AlertTriangle } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface ManagementTabProps {
  guildInfo: GuildInfo;
  joinRequests: JoinRequest[];
  onUpdateNotice: (notice: string) => void;
  onUpdateEmblem: (icon: string, bg: string) => void;
  onApproveRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onLeaveGuild: () => void;
}

const EMBLEM_ICONS = ['👁️', '🍃', '⚔️', '🗡️', '⚡', '🏜️', '🔥', '🛡️', '👑', '🐉', '🍥', '🌌'];
const EMBLEM_BGS = ['#7f1d1d', '#15803d', '#4338ca', '#0e7490', '#a16207', '#b45309', '#18181b', '#701a75'];

export const ManagementTab: React.FC<ManagementTabProps> = ({
  guildInfo,
  joinRequests,
  onUpdateNotice,
  onUpdateEmblem,
  onApproveRequest,
  onRejectRequest,
  onLeaveGuild,
}) => {
  const [noticeInput, setNoticeInput] = useState(guildInfo.notice);
  const [selectedIcon, setSelectedIcon] = useState(guildInfo.emblemIcon);
  const [selectedBg, setSelectedBg] = useState(guildInfo.emblemBg);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const handleSaveNotice = () => {
    sounds.playClick();
    onUpdateNotice(noticeInput);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handleSaveEmblem = () => {
    sounds.playClick();
    onUpdateEmblem(selectedIcon, selectedBg);
  };

  return (
    <div className="p-4 space-y-5">
      
      {/* 1. MURAL DE RECADOS & AVISOS DA GUILDA */}
      <div className="bg-[#121814] border border-[#263529] rounded-xl p-4 space-y-3 shadow-lg">
        <h3 className="text-sm font-bold game-title-font text-amber-400 flex items-center gap-2 border-b border-gray-800 pb-2">
          <Edit3 className="w-4 h-4" />
          Mural de Avisos da Liderança
        </h3>

        <textarea
          rows={3}
          value={noticeInput}
          onChange={(e) => setNoticeInput(e.target.value)}
          placeholder="Digite o aviso oficial da guilda..."
          className="w-full bg-[#0d130f] border border-[#2a3a2e] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />

        <div className="flex justify-between items-center">
          <span className="text-[11px] text-gray-400">
            {isSavedNotice ? '✓ Aviso atualizado com sucesso!' : 'Apenas Líderes e Vice-Líderes podem editar o aviso.'}
          </span>
          <button
            onClick={handleSaveNotice}
            className="game-btn-gold px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Aviso</span>
          </button>
        </div>
      </div>

      {/* 2. SOLICITAÇÕES DE ENTRADA (JOIN REQUESTS QUEUE) */}
      <div className="bg-[#121814] border border-[#263529] rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex justify-between items-center border-b border-gray-800 pb-2">
          <h3 className="text-sm font-bold game-title-font text-amber-400 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Solicitações de Entrada Pendentes ({joinRequests.length})
          </h3>
        </div>

        {joinRequests.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 italic bg-[#0c120e] rounded-lg border border-[#212f25]">
            Nenhuma solicitação de recrutamento pendente no momento.
          </div>
        ) : (
          <div className="space-y-2">
            {joinRequests.map((req) => (
              <div
                key={req.id}
                className="bg-[#18231c] border border-[#28382d] p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={req.avatarUrl}
                    alt={req.playerName}
                    className="w-9 h-9 rounded-lg border border-amber-600/50 object-cover"
                  />
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{req.playerName}</span>
                      <span className="text-emerald-400 font-mono">Lv. {req.level}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-2">
                      <span>{req.characterName}</span>
                      <span>•</span>
                      <span className="text-amber-300 font-mono">⚡ {req.power.toLocaleString()} Poder</span>
                      <span>•</span>
                      <span>{req.requestedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      sounds.playCoin();
                      onApproveRequest(req.id);
                    }}
                    className="p-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aceitar</span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.playClick();
                      onRejectRequest(req.id);
                    }}
                    className="p-2 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 rounded-lg text-xs font-bold transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. EMBLEM & CREST CUSTOMIZER */}
      <div className="bg-[#121814] border border-[#263529] rounded-xl p-4 space-y-4 shadow-lg">
        <h3 className="text-sm font-bold game-title-font text-amber-400 flex items-center gap-2 border-b border-gray-800 pb-2">
          <Shield className="w-4 h-4" />
          Personalizar Emblema da Guilda
        </h3>

        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Emblem Preview */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-20 h-20 rounded-2xl border-2 border-amber-400 flex items-center justify-center text-4xl shadow-xl transition-all"
              style={{ backgroundColor: selectedBg }}
            >
              <span>{selectedIcon}</span>
            </div>
            <span className="text-xs text-gray-400 font-medium">Pré-visualização</span>
          </div>

          <div className="flex-1 space-y-3">
            {/* Icon Picker */}
            <div>
              <span className="text-xs text-amber-300 font-bold block mb-1.5">
                Ícone do Emblema:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EMBLEM_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={`w-8 h-8 rounded-lg text-lg border flex items-center justify-center transition ${
                      selectedIcon === icon
                        ? 'border-amber-400 bg-amber-950/80 scale-105'
                        : 'border-gray-700 bg-[#18231c] hover:border-gray-500'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Color Picker */}
            <div>
              <span className="text-xs text-amber-300 font-bold block mb-1.5">
                Cor de Fundo:
              </span>
              <div className="flex flex-wrap gap-2">
                {EMBLEM_BGS.map((bg) => (
                  <button
                    key={bg}
                    onClick={() => setSelectedBg(bg)}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      selectedBg === bg ? 'border-amber-400 scale-110 shadow' : 'border-gray-800'
                    }`}
                    style={{ backgroundColor: bg }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveEmblem}
              className="game-btn-gold px-4 py-1.5 rounded-lg text-xs font-bold shadow"
            >
              Salvar Novo Emblema
            </button>
          </div>
        </div>
      </div>

      {/* 4. DANGER ZONE (LEAVE GUILD) */}
      <div className="bg-[#1a1213] border border-red-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <strong className="text-red-400 font-bold block">Sair da Guilda</strong>
            <span className="text-gray-400 text-[11px]">
              Sair da guilda resultará na perda de bônus passivos até se juntar a outra.
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            sounds.playClick();
            if (confirm('Tem certeza de que deseja sair da guilda?')) {
              onLeaveGuild();
            }
          }}
          className="bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded-lg font-bold text-xs shrink-0 transition"
        >
          Sair da Guilda
        </button>
      </div>

    </div>
  );
};
