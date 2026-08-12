import React, { useState } from 'react';
import { GuildMember, GuildRole } from '../../types';
import { Search, Shield, UserPlus, ArrowUpCircle, ArrowDownCircle, Trash2, Gift, CheckCircle, Flame, Filter, MessageSquare, ChevronDown } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface MembersTabProps {
  members: GuildMember[];
  userRole: GuildRole;
  currentUserName: string;
  onPromote: (memberId: string) => void;
  onDemote: (memberId: string) => void;
  onKick: (memberId: string) => void;
  onDonate: (amount: number) => void;
  onInviteMember: (name: string) => void;
  onWhisper: (memberName: string) => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  userRole,
  currentUserName,
  onPromote,
  onDemote,
  onKick,
  onDonate,
  onInviteMember,
  onWhisper,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | GuildRole>('ALL');
  const [selectedMember, setSelectedMember] = useState<GuildMember | null>(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [donateAmount, setDonateAmount] = useState(1000);

  // Filtered members list
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.characterName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const onlineCount = members.filter((m) => m.status === 'ONLINE').length;

  const canManage = userRole === 'LÍDER' || userRole === 'VICE-LÍDER';

  const getRoleBadge = (role: GuildRole) => {
    switch (role) {
      case 'LÍDER':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">👑 LÍDER</span>;
      case 'VICE-LÍDER':
        return <span className="bg-red-500/20 text-red-400 border border-red-500 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">⚔️ VICE</span>;
      case 'OFICIAL':
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">🛡️ OFICIAL</span>;
      default:
        return <span className="bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">MEMBRO</span>;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Toolbar: Search, Filters, Invite & Donate Buttons */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#131b16] p-3 rounded-xl border border-[#27362a]">
        
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar membro ou ninja..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0d130f] border border-[#2a3a2e] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#0d130f] border border-[#2a3a2e] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Status: Todos ({members.length})</option>
            <option value="ONLINE">🟢 Online ({onlineCount})</option>
            <option value="OFFLINE">🔴 Offline ({members.length - onlineCount})</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-[#0d130f] border border-[#2a3a2e] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Cargos: Todos</option>
            <option value="LÍDER">👑 Líder</option>
            <option value="VICE-LÍDER">⚔️ Vice-Líder</option>
            <option value="OFICIAL">🛡️ Oficial</option>
            <option value="MEMBRO">Membro</option>
          </select>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Donate to Guild Button */}
          <button
            onClick={() => {
              sounds.playClick();
              setShowDonateModal(true);
            }}
            className="game-btn-green px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow"
          >
            <Gift className="w-4 h-4 text-emerald-200" />
            <span>Doar para Guilda</span>
          </button>

          {/* Invite Member Button */}
          {canManage && (
            <button
              onClick={() => {
                sounds.playClick();
                setShowInviteModal(true);
              }}
              className="game-btn-gold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow"
            >
              <UserPlus className="w-4 h-4 text-amber-200" />
              <span>Convidar Ninja</span>
            </button>
          )}
        </div>
      </div>

      {/* Members Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-[#121914] border border-[#233126] p-2.5 rounded-lg flex items-center justify-between">
          <span className="text-gray-400">Total de Membros:</span>
          <strong className="text-amber-400 font-bold">{members.length} / 30</strong>
        </div>
        <div className="bg-[#121914] border border-[#233126] p-2.5 rounded-lg flex items-center justify-between">
          <span className="text-gray-400">Ativos Online:</span>
          <strong className="text-emerald-400 font-bold">🟢 {onlineCount}</strong>
        </div>
        <div className="bg-[#121914] border border-[#233126] p-2.5 rounded-lg flex items-center justify-between">
          <span className="text-gray-400">Poder Médio:</span>
          <strong className="text-amber-300 font-bold">
            {(members.reduce((acc, m) => acc + m.power, 0) / members.length / 1000).toFixed(0)}k
          </strong>
        </div>
        <div className="bg-[#121914] border border-[#233126] p-2.5 rounded-lg flex items-center justify-between">
          <span className="text-gray-400">Presença Hoje:</span>
          <strong className="text-blue-400 font-bold">
            {members.filter((m) => m.checkedInToday).length} / {members.length}
          </strong>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-[#121814] border border-[#263529] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            {/* Header */}
            <thead className="bg-[#18221b] text-amber-400 uppercase font-bold text-[11px] border-b border-[#28382d]">
              <tr>
                <th className="p-3">Membro / Personagem</th>
                <th className="p-3 text-center">Cargo</th>
                <th className="p-3 text-center">Nível</th>
                <th className="p-3 text-center">Poder de Luta</th>
                <th className="p-3 text-center">Contribuição Total</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-[#1e2b21]">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                    Nenhum membro encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelf = member.name === currentUserName;

                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-[#18231c] transition-colors ${
                        isSelf ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="w-9 h-9 rounded-lg border border-amber-600/50 object-cover shadow"
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{member.name}</span>
                              {isSelf && (
                                <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1 rounded border border-amber-600">
                                  Você
                                </span>
                              )}
                              {member.checkedInToday && (
                                <span className="text-[10px] text-emerald-400" title="Marcou presença hoje">
                                  ✓ Presença
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1">
                              <span>{member.characterName}</span>
                              <span>•</span>
                              <span className="text-amber-200/80">Vila da {member.village}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-3 text-center">
                        {getRoleBadge(member.role)}
                      </td>

                      {/* Level */}
                      <td className="p-3 text-center font-bold text-emerald-400 font-mono">
                        Lv. {member.level}
                      </td>

                      {/* Power */}
                      <td className="p-3 text-center font-bold text-amber-300 font-mono">
                        ⚡ {member.power.toLocaleString()}
                      </td>

                      {/* EXP / Coins Donated */}
                      <td className="p-3 text-center font-mono text-[11px]">
                        <div className="text-emerald-300">{member.expContributed.toLocaleString()} EXP</div>
                        <div className="text-amber-400/80 text-[10px]">🪙 {member.coinsDonated.toLocaleString()} Moedas</div>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {member.status === 'ONLINE' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Online
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">
                            {member.lastOnline}
                          </span>
                        )}
                      </td>

                      {/* Actions Menu */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Whisper / PM Button */}
                          {!isSelf && (
                            <button
                              onClick={() => {
                                sounds.playClick();
                                onWhisper(member.name);
                              }}
                              className="p-1.5 bg-[#19241d] hover:bg-[#28382d] border border-gray-700 text-gray-300 rounded transition"
                              title="Enviar mensagem particular"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Leader Management Dropdown / Buttons */}
                          {canManage && !isSelf && member.role !== 'LÍDER' && (
                            <div className="flex items-center gap-1">
                              {/* Promote */}
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  onPromote(member.id);
                                }}
                                className="p-1.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-800 text-blue-300 rounded transition"
                                title="Promover cargo"
                              >
                                <ArrowUpCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Demote */}
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  onDemote(member.id);
                                }}
                                className="p-1.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded transition"
                                title="Rebaixar cargo"
                              >
                                <ArrowDownCircle className="w-3.5 h-3.5" />
                              </button>

                              {/* Kick */}
                              <button
                                onClick={() => {
                                  sounds.playClick();
                                  if (confirm(`Tem certeza que deseja expulsar ${member.name} da guilda?`)) {
                                    onKick(member.id);
                                  }
                                }}
                                className="p-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded transition"
                                title="Expulsar da guilda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DONATE TO GUILD */}
      {showDonateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141c17] border-2 border-[#e5a93c] rounded-2xl w-full max-w-md p-5 text-white shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <h3 className="text-xl font-bold game-title-font text-amber-400 mb-1 flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Doação para a Guilda
            </h3>
            <p className="text-xs text-gray-300 mb-4">
              Doe moedas para aumentar o Fundo da Guilda e gerar EXP de guilda para desbloquear novas habilidades passivas para todos os membros!
            </p>

            <div className="space-y-3 bg-[#0e1410] p-3 rounded-xl border border-[#27362a] mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Sua Quantia de Doação:</span>
                <span className="text-amber-300 font-bold font-mono">🪙 {donateAmount.toLocaleString()} Moedas</span>
              </div>

              {/* Amount slider or presets */}
              <input
                type="range"
                min={500}
                max={25000}
                step={500}
                value={donateAmount}
                onChange={(e) => setDonateAmount(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex justify-between gap-1 text-[10px]">
                {[1000, 5000, 10000, 25000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setDonateAmount(preset)}
                    className="flex-1 bg-[#1b261f] hover:bg-[#28382d] border border-gray-700 rounded py-1 font-bold text-amber-300"
                  >
                    +{preset / 1000}k
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-800 pt-2 text-xs space-y-1">
                <div className="flex justify-between text-emerald-400">
                  <span>EXP de Guilda Obtido:</span>
                  <span className="font-bold font-mono">+{donateAmount * 2} EXP</span>
                </div>
                <div className="flex justify-between text-amber-300">
                  <span>Moedas de Guilda Pessoais:</span>
                  <span className="font-bold font-mono">+{Math.round(donateAmount * 0.1)} Moedas</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDonateModal(false)}
                className="game-btn-dark px-4 py-2 rounded-lg text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  sounds.playCoin();
                  onDonate(donateAmount);
                  setShowDonateModal(false);
                }}
                className="game-btn-green px-5 py-2 rounded-lg text-xs font-bold"
              >
                Confirmar Doação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INVITE MEMBER */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141c17] border-2 border-[#e5a93c] rounded-2xl w-full max-w-md p-5 text-white shadow-2xl relative">
            <h3 className="text-xl font-bold game-title-font text-amber-400 mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Convidar Novo Ninja
            </h3>
            <p className="text-xs text-gray-300 mb-4">
              Digite o nome do jogador online no servidor para enviar um convite direto para a guilda.
            </p>

            <div className="mb-4">
              <label className="text-xs text-amber-300 font-bold block mb-1">
                Nome do Jogador / Shinobi:
              </label>
              <input
                type="text"
                placeholder="Ex: Sasuke Uchiha, Naruto, Kakashi..."
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                className="w-full bg-[#0d130f] border border-amber-600/60 rounded-lg p-2 text-xs text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="game-btn-dark px-4 py-2 rounded-lg text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (inviteInput.trim()) {
                    sounds.playClick();
                    onInviteMember(inviteInput.trim());
                    setInviteInput('');
                    setShowInviteModal(false);
                  }
                }}
                className="game-btn-gold px-5 py-2 rounded-lg text-xs font-bold"
              >
                Enviar Convite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
