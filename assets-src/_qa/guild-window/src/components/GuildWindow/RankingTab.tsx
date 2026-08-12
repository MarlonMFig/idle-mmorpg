import React, { useState } from 'react';
import { GuildRankEntry, GuildMember } from '../../types';
import { Trophy, Crown, Medal, Flame, Zap, Shield, ChevronRight } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface RankingTabProps {
  serverGuilds: GuildRankEntry[];
  members: GuildMember[];
}

export const RankingTab: React.FC<RankingTabProps> = ({ serverGuilds, members }) => {
  const [activeSubTab, setActiveSubTab] = useState<'SERVER' | 'INTERNAL'>('SERVER');

  // Sorted members by weekly EXP for internal ranking
  const sortedInternalMembers = [...members].sort((a, b) => b.weeklyExp - a.weeklyExp);

  return (
    <div className="p-4 space-y-4">
      {/* Sub-navigation Switcher */}
      <div className="flex items-center justify-center gap-2 bg-[#121914] p-1.5 rounded-xl border border-[#233126] max-w-md mx-auto">
        <button
          onClick={() => {
            sounds.playTabSwitch();
            setActiveSubTab('SERVER');
          }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSubTab === 'SERVER'
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#1a241d]'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-300" />
          <span>Ranking de Guildas (Servidor)</span>
        </button>

        <button
          onClick={() => {
            sounds.playTabSwitch();
            setActiveSubTab('INTERNAL');
          }}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSubTab === 'INTERNAL'
              ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow'
              : 'text-gray-400 hover:text-white hover:bg-[#1a241d]'
          }`}
        >
          <Crown className="w-3.5 h-3.5 text-amber-300" />
          <span>Ranking Interno de Membros</span>
        </button>
      </div>

      {/* VIEW 1: SERVER GUILD RANKINGS */}
      {activeSubTab === 'SERVER' && (
        <div className="space-y-4">
          
          {/* TOP 3 PODIUM DISPLAY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {serverGuilds.slice(0, 3).map((guild) => {
              const isFirst = guild.rank === 1;
              const isSecond = guild.rank === 2;

              return (
                <div
                  key={guild.id}
                  className={`relative bg-gradient-to-b ${
                    isFirst
                      ? 'from-amber-950/70 via-[#1e190e] to-[#131714] border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                      : isSecond
                      ? 'from-gray-900 via-[#181d1a] to-[#131714] border border-gray-400'
                      : 'from-amber-950/40 via-[#181d1a] to-[#131714] border border-amber-700'
                  } rounded-xl p-4 text-center flex flex-col items-center justify-between`}
                >
                  {/* Rank Crown/Medal */}
                  <div className="absolute -top-3 px-3 py-0.5 rounded-full text-xs font-bold uppercase border shadow flex items-center gap-1">
                    {isFirst && (
                      <span className="bg-amber-400 text-black border-amber-300 flex items-center gap-1 px-2 rounded-full">
                        👑 1º LUGAR
                      </span>
                    )}
                    {isSecond && (
                      <span className="bg-slate-300 text-black border-slate-200 flex items-center gap-1 px-2 rounded-full">
                        🥈 2º LUGAR
                      </span>
                    )}
                    {!isFirst && !isSecond && (
                      <span className="bg-amber-700 text-amber-100 border-amber-600 flex items-center gap-1 px-2 rounded-full">
                        🥉 3º LUGAR
                      </span>
                    )}
                  </div>

                  {/* Emblem */}
                  <div className="mt-2 w-14 h-14 rounded-2xl border-2 border-amber-400/80 flex items-center justify-center text-3xl bg-black/60 shadow-lg">
                    {guild.emblemIcon}
                  </div>

                  {/* Guild Title */}
                  <div className="mt-2">
                    <h3 className="text-lg font-bold game-title-font text-amber-400">
                      {guild.guildName}
                    </h3>
                    <div className="text-xs text-gray-300 font-medium">
                      Líder: <span className="text-white font-bold">{guild.leaderName}</span>
                    </div>
                  </div>

                  {/* Stats Badge */}
                  <div className="mt-3 w-full bg-[#0d130f] p-2 rounded-lg border border-[#27352b] text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Nível da Guilda:</span>
                      <strong className="text-emerald-400">Lv. {guild.level}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Poder de Luta:</span>
                      <strong className="text-amber-300 font-mono">⚡ {(guild.totalPower / 1000000).toFixed(1)}M</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Membros:</span>
                      <strong className="text-gray-200">{guild.memberCount}/{guild.maxMembers}</strong>
                    </div>
                  </div>

                  {guild.isUserGuild && (
                    <div className="mt-2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/80 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      ★ Sua Guilda Atual ★
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SERVER GUILDS TABLE */}
          <div className="bg-[#121814] border border-[#263529] rounded-xl overflow-hidden shadow-xl">
            <div className="p-3 bg-[#18221b] border-b border-[#28382d] font-bold text-amber-400 text-xs uppercase flex items-center justify-between">
              <span>Classificação Geral do Servidor</span>
              <span className="text-gray-400 font-normal">Atualizado diariamente</span>
            </div>

            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#151d17] text-gray-400 text-[10px] uppercase border-b border-[#233126]">
                <tr>
                  <th className="p-3 text-center">Posição</th>
                  <th className="p-3">Guilda</th>
                  <th className="p-3 text-center">Nível</th>
                  <th className="p-3 text-center">Líder</th>
                  <th className="p-3 text-center">Membros</th>
                  <th className="p-3 text-right">Poder Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b21]">
                {serverGuilds.map((guild) => (
                  <tr
                    key={guild.id}
                    className={`hover:bg-[#18231c] transition-colors ${
                      guild.isUserGuild ? 'bg-amber-950/30 border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    {/* Rank Number */}
                    <td className="p-3 text-center font-bold font-mono">
                      {guild.rank === 1 && <span className="text-amber-400">🥇 #1</span>}
                      {guild.rank === 2 && <span className="text-slate-300">🥈 #2</span>}
                      {guild.rank === 3 && <span className="text-amber-600">🥉 #3</span>}
                      {guild.rank > 3 && <span className="text-gray-400">#{guild.rank}</span>}
                    </td>

                    {/* Guild Emblem & Name */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg border border-amber-600/50 flex items-center justify-center text-lg bg-black/60">
                          {guild.emblemIcon}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{guild.guildName}</span>
                            <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800 px-1 rounded">
                              [{guild.tag}]
                            </span>
                            {guild.isUserGuild && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500 px-1 rounded">
                                Sua Guilda
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 italic">
                            {guild.description}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Guild Level */}
                    <td className="p-3 text-center font-bold text-emerald-400">
                      Lv. {guild.level}
                    </td>

                    {/* Leader Name */}
                    <td className="p-3 text-center text-gray-200 font-semibold">
                      {guild.leaderName}
                    </td>

                    {/* Members count */}
                    <td className="p-3 text-center text-gray-300">
                      {guild.memberCount} / {guild.maxMembers}
                    </td>

                    {/* Power */}
                    <td className="p-3 text-right font-bold text-amber-300 font-mono">
                      ⚡ {guild.totalPower.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: INTERNAL MEMBER RANKING */}
      {activeSubTab === 'INTERNAL' && (
        <div className="space-y-4">
          <div className="p-3 bg-[#131b16] rounded-xl border border-[#27362a] text-xs text-gray-300 flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-400">Membros de Destaque Semanal:</span>
              <p className="text-gray-400 text-[11px]">
                O ranking é resetado aos domingos às 00:00. Os Top 3 recebem título e bônus de Moedas de Guilda!
              </p>
            </div>
            <div className="bg-amber-950/60 border border-amber-700/80 text-amber-300 px-3 py-1 rounded-lg text-xs font-bold">
              🏆 Bônus Semanal Ativo
            </div>
          </div>

          {/* Internal Members Leaderboard Table */}
          <div className="bg-[#121814] border border-[#263529] rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#18221b] text-amber-400 uppercase font-bold text-[11px] border-b border-[#28382d]">
                <tr>
                  <th className="p-3 text-center">Posição</th>
                  <th className="p-3">Membro</th>
                  <th className="p-3 text-center">Cargo</th>
                  <th className="p-3 text-center">EXP Semanal Doada</th>
                  <th className="p-3 text-center">Moedas Doadas</th>
                  <th className="p-3 text-right">Poder de Luta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b21]">
                {sortedInternalMembers.map((member, index) => {
                  const rankNum = index + 1;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-[#18231c] transition-colors"
                    >
                      <td className="p-3 text-center font-bold font-mono">
                        {rankNum === 1 && <span className="text-amber-400">🥇 #1</span>}
                        {rankNum === 2 && <span className="text-slate-300">🥈 #2</span>}
                        {rankNum === 3 && <span className="text-amber-600">🥉 #3</span>}
                        {rankNum > 3 && <span className="text-gray-500">#{rankNum}</span>}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="w-8 h-8 rounded-lg border border-amber-600/50 object-cover"
                          />
                          <div>
                            <div className="font-bold text-white">{member.name}</div>
                            <div className="text-[10px] text-gray-400">{member.characterName}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center text-[10px] font-bold text-amber-300">
                        {member.role}
                      </td>

                      <td className="p-3 text-center font-bold text-emerald-400 font-mono">
                        +{member.weeklyExp.toLocaleString()} EXP
                      </td>

                      <td className="p-3 text-center font-mono text-amber-300">
                        🪙 {member.coinsDonated.toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-bold text-amber-300 font-mono">
                        ⚡ {member.power.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
