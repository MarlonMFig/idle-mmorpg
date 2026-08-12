import React, { useState } from 'react';
import { GuildRankEntry } from '../../types';
import { Shield, PlusCircle, Search, Users, Trophy, Check, X } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface CreateJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverGuilds: GuildRankEntry[];
  onCreateGuild: (name: string, tag: string, emblem: string) => void;
  onJoinGuild: (guildId: string) => void;
}

const EMBLEM_ICONS = ['👁️', '🍃', '⚔️', '🗡️', '⚡', '🏜️', '🔥', '🛡️', '👑', '🐉'];

export const CreateJoinModal: React.FC<CreateJoinModalProps> = ({
  isOpen,
  onClose,
  serverGuilds,
  onCreateGuild,
  onJoinGuild,
}) => {
  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [searchTerm, setSearchTerm] = useState('');
  const [newGuildName, setNewGuildName] = useState('');
  const [newGuildTag, setNewGuildTag] = useState('');
  const [selectedEmblem, setSelectedEmblem] = useState('👁️');

  if (!isOpen) return null;

  const filteredGuilds = serverGuilds.filter((g) =>
    g.guildName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGuildName.trim() && newGuildTag.trim()) {
      sounds.playCoin();
      onCreateGuild(newGuildName.trim(), newGuildTag.trim().toUpperCase(), selectedEmblem);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121814] border-2 border-[#e5a93c] rounded-2xl w-full max-w-xl p-5 text-white shadow-2xl relative animate-in fade-in zoom-in duration-150">
        
        {/* Close Modal Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-[#18231c] hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <h2 className="text-xl font-bold game-title-font text-amber-400 mb-1 flex items-center gap-2">
          <Shield className="w-6 h-6 text-amber-400" />
          Central de Guildas - Anime World Idle
        </h2>
        <p className="text-xs text-gray-300 mb-4">
          Junte-se a uma guilda existente para lutar com aliados ou funde sua própria guilda de elite!
        </p>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#28382d] mb-4">
          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('JOIN');
            }}
            className={`px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'JOIN'
                ? 'border-amber-400 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Procurar Guildas ({serverGuilds.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playTabSwitch();
              setActiveTab('CREATE');
            }}
            className={`px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 border-b-2 ${
              activeTab === 'CREATE'
                ? 'border-amber-400 text-amber-400 bg-amber-950/20'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Criar Nova Guilda</span>
          </button>
        </div>

        {/* TAB 1: JOIN GUILD */}
        {activeTab === 'JOIN' && (
          <div className="space-y-3">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Buscar por nome de guilda ou TAG..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0d130f] border border-[#2a3a2e] rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />

            {/* Guilds List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredGuilds.map((guild) => (
                <div
                  key={guild.id}
                  className="bg-[#18231c] border border-[#28382d] p-3 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-amber-600/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-amber-500/50 flex items-center justify-center text-xl bg-black/60 shrink-0">
                      {guild.emblemIcon}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{guild.guildName}</span>
                        <span className="text-[10px] text-amber-300 bg-amber-950/80 px-1 rounded">
                          [{guild.tag}]
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Líder: <strong className="text-gray-200">{guild.leaderName}</strong> • Lv. {guild.level} • ⚡ {(guild.totalPower / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playCoin();
                      onJoinGuild(guild.id);
                      onClose();
                    }}
                    className="game-btn-green px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 shadow"
                  >
                    Entrar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CREATE GUILD */}
        {activeTab === 'CREATE' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs text-amber-300 font-bold block mb-1">
                Nome da Guilda:
              </label>
              <input
                type="text"
                placeholder="Ex: Akatsuki Reborn, Lendas Ninja..."
                value={newGuildName}
                onChange={(e) => setNewGuildName(e.target.value)}
                maxLength={24}
                required
                className="w-full bg-[#0d130f] border border-[#2a3a2e] rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs text-amber-300 font-bold block mb-1">
                TAG da Guilda (3-4 letras):
              </label>
              <input
                type="text"
                placeholder="Ex: AKA, LEAF, FIRE"
                value={newGuildTag}
                onChange={(e) => setNewGuildTag(e.target.value.toUpperCase())}
                maxLength={4}
                required
                className="w-full bg-[#0d130f] border border-[#2a3a2e] rounded-xl p-2.5 text-xs text-white uppercase placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-amber-300 font-bold block mb-1">
                Escolha o Emblema Inicial:
              </label>
              <div className="flex flex-wrap gap-2">
                {EMBLEM_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setSelectedEmblem(icon)}
                    className={`w-9 h-9 rounded-lg text-xl border flex items-center justify-center transition ${
                      selectedEmblem === icon
                        ? 'border-amber-400 bg-amber-950/80 scale-105'
                        : 'border-gray-700 bg-[#18231c]'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0e1410] border border-[#233126] p-3 rounded-xl text-xs flex justify-between items-center text-amber-300 font-mono">
              <span>Custo de Criação de Guilda:</span>
              <strong className="text-amber-400 font-bold">💰 50.000 Gold</strong>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="game-btn-dark px-4 py-2 rounded-lg text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="game-btn-gold px-6 py-2 rounded-lg text-xs font-bold shadow-lg"
              >
                Fundar Guilda
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
