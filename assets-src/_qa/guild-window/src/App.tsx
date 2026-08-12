import React, { useState, useEffect } from 'react';
import { GameHUD } from './components/GameHUD';
import { GuildWindow } from './components/GuildWindow/GuildWindow';
import { CreateJoinModal } from './components/GuildWindow/CreateJoinModal';
import {
  initialGuildInfo,
  initialMembers,
  initialServerGuilds,
  initialMissions,
  initialBoss,
  initialSkills,
  initialShopItems,
  initialJoinRequests,
} from './data/mockGuildData';
import { GuildInfo, GuildMember, GuildRankEntry, GuildMission, GuildBoss, GuildSkill, GuildShopItem, JoinRequest, GuildRole } from './types';

export default function App() {
  const [isGuildOpen, setIsGuildOpen] = useState(true);
  const [isCreateJoinOpen, setIsCreateJoinOpen] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Player User
  const [currentUserName] = useState('MONARCA');
  const [currentUserRole, setCurrentUserRole] = useState<GuildRole>('LÍDER');
  const [userGuildCoins, setUserGuildCoins] = useState(1250);

  // Guild States
  const [guildInfo, setGuildInfo] = useState<GuildInfo>(() => {
    const saved = localStorage.getItem('awi_guild_info');
    return saved ? JSON.parse(saved) : initialGuildInfo;
  });

  const [members, setMembers] = useState<GuildMember[]>(() => {
    const saved = localStorage.getItem('awi_guild_members');
    return saved ? JSON.parse(saved) : initialMembers;
  });

  const [serverGuilds, setServerGuilds] = useState<GuildRankEntry[]>(() => {
    const saved = localStorage.getItem('awi_server_guilds');
    return saved ? JSON.parse(saved) : initialServerGuilds;
  });

  const [missions, setMissions] = useState<GuildMission[]>(() => {
    const saved = localStorage.getItem('awi_guild_missions');
    return saved ? JSON.parse(saved) : initialMissions;
  });

  const [boss, setBoss] = useState<GuildBoss>(() => {
    const saved = localStorage.getItem('awi_guild_boss');
    return saved ? JSON.parse(saved) : initialBoss;
  });

  const [skills, setSkills] = useState<GuildSkill[]>(() => {
    const saved = localStorage.getItem('awi_guild_skills');
    return saved ? JSON.parse(saved) : initialSkills;
  });

  const [shopItems, setShopItems] = useState<GuildShopItem[]>(() => {
    const saved = localStorage.getItem('awi_guild_shop');
    return saved ? JSON.parse(saved) : initialShopItems;
  });

  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>(() => {
    const saved = localStorage.getItem('awi_join_requests');
    return saved ? JSON.parse(saved) : initialJoinRequests;
  });

  // LocalStorage Sync
  useEffect(() => {
    localStorage.setItem('awi_guild_info', JSON.stringify(guildInfo));
    localStorage.setItem('awi_guild_members', JSON.stringify(members));
    localStorage.setItem('awi_server_guilds', JSON.stringify(serverGuilds));
    localStorage.setItem('awi_guild_missions', JSON.stringify(missions));
    localStorage.setItem('awi_guild_boss', JSON.stringify(boss));
    localStorage.setItem('awi_guild_skills', JSON.stringify(skills));
    localStorage.setItem('awi_guild_shop', JSON.stringify(shopItems));
    localStorage.setItem('awi_join_requests', JSON.stringify(joinRequests));
  }, [guildInfo, members, serverGuilds, missions, boss, skills, shopItems, joinRequests]);

  // Helper to advance mission progress automatically
  const updateMissionProgress = (missionId: string, amount: number = 1) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id === missionId && !m.isCompleted) {
          const nextProg = Math.min(m.targetProgress, m.currentProgress + amount);
          return {
            ...m,
            currentProgress: nextProg,
            isCompleted: nextProg >= m.targetProgress,
          };
        }
        return m;
      })
    );
  };

  // Handlers
  const handleCheckIn = () => {
    if (isCheckedIn) return;

    setIsCheckedIn(true);
    setUserGuildCoins((prev) => prev + 100);

    setGuildInfo((prev) => ({
      ...prev,
      exp: prev.exp + 500,
      dailyCheckInCount: prev.dailyCheckInCount + 1,
    }));

    // Advance daily checkin mission
    updateMissionProgress('m-checkin', 1);
  };

  const handleDonateToGuild = (amount: number) => {
    const gainedExp = amount * 2;
    const gainedCoins = Math.round(amount * 0.1);

    setUserGuildCoins((prev) => prev + gainedCoins);

    setGuildInfo((prev) => ({
      ...prev,
      funds: prev.funds + amount,
      exp: prev.exp + gainedExp,
    }));

    // Update player member stats
    setMembers((prev) =>
      prev.map((m) =>
        m.name === currentUserName
          ? {
              ...m,
              coinsDonated: m.coinsDonated + amount,
              expContributed: m.expContributed + gainedExp,
              weeklyExp: m.weeklyExp + gainedExp,
            }
          : m
      )
    );

    // Advance donation mission
    updateMissionProgress('m-donation', amount);
  };

  const handleClaimMissionReward = (missionId: string) => {
    const target = missions.find((m) => m.id === missionId);
    if (!target || !target.isCompleted || target.isClaimed) return;

    setUserGuildCoins((prev) => prev + target.rewardCoins);
    setGuildInfo((prev) => ({ ...prev, exp: prev.exp + target.rewardExp }));

    setMissions((prev) =>
      prev.map((m) => (m.id === missionId ? { ...m, isClaimed: true } : m))
    );
  };

  const handleClaimAllMissionRewards = () => {
    let extraCoins = 0;
    let extraExp = 0;

    const updated = missions.map((m) => {
      if (m.isCompleted && !m.isClaimed) {
        extraCoins += m.rewardCoins;
        extraExp += m.rewardExp;
        return { ...m, isClaimed: true };
      }
      return m;
    });

    if (extraCoins > 0) {
      setUserGuildCoins((prev) => prev + extraCoins);
      setGuildInfo((prev) => ({ ...prev, exp: prev.exp + extraExp }));
      setMissions(updated);
    }
  };

  const handleSimulateMissionProgress = (missionId: string) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id === missionId) {
          const step = m.targetProgress > 10 ? 5 : 1;
          const nextVal = Math.min(m.targetProgress, m.currentProgress + step);
          return {
            ...m,
            currentProgress: nextVal,
            isCompleted: nextVal >= m.targetProgress,
          };
        }
        return m;
      })
    );
  };

  const handlePromoteMember = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const nextRole: GuildRole = m.role === 'MEMBRO' ? 'OFICIAL' : 'VICE-LÍDER';
          return { ...m, role: nextRole };
        }
        return m;
      })
    );
  };

  const handleDemoteMember = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const nextRole: GuildRole = m.role === 'VICE-LÍDER' ? 'OFICIAL' : 'MEMBRO';
          return { ...m, role: nextRole };
        }
        return m;
      })
    );
  };

  const handleKickMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setGuildInfo((prev) => ({ ...prev, memberCount: Math.max(1, prev.memberCount - 1) }));
  };

  const handleInviteMember = (name: string) => {
    const newMember: GuildMember = {
      id: `m-${Date.now()}`,
      name: name,
      characterName: 'Ninja Convidado',
      level: 45,
      role: 'MEMBRO',
      status: 'ONLINE',
      lastOnline: 'Agora',
      power: 850000,
      expContributed: 0,
      coinsDonated: 0,
      weeklyExp: 0,
      village: 'Folha',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      joinedAt: new Date().toLocaleDateString('pt-BR'),
      checkedInToday: false,
    };

    setMembers((prev) => [...prev, newMember]);
    setGuildInfo((prev) => ({ ...prev, memberCount: prev.memberCount + 1 }));
  };

  const handleAttackBoss = (damage: number) => {
    setBoss((prev) => {
      const newHp = Math.max(0, prev.currentHp - damage);

      // Update player's damage contribution in list
      const existingDamagerIndex = prev.topDamagers.findIndex(
        (d) => d.memberName === currentUserName
      );

      let updatedDamagers = [...prev.topDamagers];

      if (existingDamagerIndex >= 0) {
        const oldDamager = updatedDamagers[existingDamagerIndex];
        const newDmg = oldDamager.damage + damage;
        updatedDamagers[existingDamagerIndex] = {
          ...oldDamager,
          damage: newDmg,
          attacksCount: oldDamager.attacksCount + 1,
        };
      } else {
        updatedDamagers.push({
          id: `bd-${Date.now()}`,
          memberName: currentUserName,
          characterName: 'Rock Lee',
          role: currentUserRole,
          damage: damage,
          percentage: 0,
          attacksCount: 1,
        });
      }

      // Recalculate damage percentages
      const totalDealt = updatedDamagers.reduce((acc, d) => acc + d.damage, 0);
      updatedDamagers = updatedDamagers
        .map((d) => ({
          ...d,
          percentage: Number(((d.damage / totalDealt) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.damage - a.damage);

      return {
        ...prev,
        currentHp: newHp,
        topDamagers: updatedDamagers,
      };
    });

    setUserGuildCoins((prev) => prev + 50);

    // Advance boss mission
    updateMissionProgress('m-boss', 1);
  };

  const handleUpgradeSkill = (skillId: string) => {
    const targetSkill = skills.find((s) => s.id === skillId);
    if (!targetSkill) return;

    if (
      guildInfo.funds >= targetSkill.upgradeCostFunds &&
      userGuildCoins >= targetSkill.upgradeCostCoins
    ) {
      setGuildInfo((prev) => ({ ...prev, funds: prev.funds - targetSkill.upgradeCostFunds }));
      setUserGuildCoins((prev) => prev - targetSkill.upgradeCostCoins);

      setSkills((prev) =>
        prev.map((s) => {
          if (s.id === skillId) {
            return {
              ...s,
              level: s.level + 1,
              upgradeCostFunds: Math.round(s.upgradeCostFunds * 1.25),
              upgradeCostCoins: Math.round(s.upgradeCostCoins * 1.2),
            };
          }
          return s;
        })
      );
    }
  };

  const handleBuyShopItem = (itemId: string, price: number) => {
    if (userGuildCoins >= price) {
      setUserGuildCoins((prev) => prev - price);

      setShopItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return { ...item, stock: Math.max(0, item.stock - 1) };
          }
          return item;
        })
      );

      // Advance shop mission
      updateMissionProgress('m-shop', 1);
    }
  };

  const handleUpdateNotice = (notice: string) => {
    setGuildInfo((prev) => ({ ...prev, notice }));
  };

  const handleUpdateEmblem = (icon: string, bg: string) => {
    setGuildInfo((prev) => ({ ...prev, emblemIcon: icon, emblemBg: bg }));
  };

  const handleApproveRequest = (requestId: string) => {
    const req = joinRequests.find((r) => r.id === requestId);
    if (!req) return;

    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));

    const newMember: GuildMember = {
      id: `m-${Date.now()}`,
      name: req.playerName,
      characterName: req.characterName,
      level: req.level,
      role: 'MEMBRO',
      status: 'ONLINE',
      lastOnline: 'Agora',
      power: req.power,
      expContributed: 0,
      coinsDonated: 0,
      weeklyExp: 0,
      village: req.village,
      avatarUrl: req.avatarUrl,
      joinedAt: new Date().toLocaleDateString('pt-BR'),
      checkedInToday: false,
    };

    setMembers((prev) => [...prev, newMember]);
    setGuildInfo((prev) => ({ ...prev, memberCount: prev.memberCount + 1 }));
  };

  const handleRejectRequest = (requestId: string) => {
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  const handleLeaveGuild = () => {
    setIsGuildOpen(false);
    setIsCreateJoinOpen(true);
  };

  const handleCreateGuild = (name: string, tag: string, emblem: string) => {
    const newG: GuildInfo = {
      id: `guild-${Date.now()}`,
      name: name,
      tag: tag,
      level: 1,
      exp: 0,
      maxExp: 10000,
      leaderName: currentUserName,
      memberCount: 1,
      maxMembers: 30,
      totalPower: 1450000,
      serverRank: serverGuilds.length + 1,
      emblemIcon: emblem,
      emblemBg: '#15803d',
      notice: 'Bem-vindo à nova guilda! Vamos recrutar os ninjas mais fortes.',
      funds: 50000,
      guildCoins: 500,
      requiredLevelToJoin: 1,
      isOpenJoin: true,
      creationDate: new Date().toLocaleDateString('pt-BR'),
      dailyCheckInCount: 1,
    };

    setGuildInfo(newG);
    setCurrentUserRole('LÍDER');

    const soleMember: GuildMember = {
      id: 'm-self',
      name: currentUserName,
      characterName: 'Rock Lee',
      level: 51,
      role: 'LÍDER',
      status: 'ONLINE',
      lastOnline: 'Agora',
      power: 1450000,
      expContributed: 0,
      coinsDonated: 0,
      weeklyExp: 0,
      village: 'Folha',
      avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80',
      joinedAt: new Date().toLocaleDateString('pt-BR'),
      checkedInToday: false,
    };

    setMembers([soleMember]);
    setIsGuildOpen(true);
  };

  const handleJoinGuild = (guildId: string) => {
    const targetGuild = serverGuilds.find((g) => g.id === guildId);
    if (!targetGuild) return;

    setGuildInfo((prev) => ({
      ...prev,
      name: targetGuild.guildName,
      tag: targetGuild.tag,
      leaderName: targetGuild.leaderName,
      level: targetGuild.level,
      emblemIcon: targetGuild.emblemIcon,
    }));

    setCurrentUserRole('MEMBRO');
    setIsGuildOpen(true);
  };

  const handleResetData = () => {
    localStorage.clear();
    setGuildInfo(initialGuildInfo);
    setMembers(initialMembers);
    setServerGuilds(initialServerGuilds);
    setMissions(initialMissions);
    setBoss(initialBoss);
    setSkills(initialSkills);
    setShopItems(initialShopItems);
    setJoinRequests(initialJoinRequests);
    setIsCheckedIn(false);
    setUserGuildCoins(1250);
  };

  const unclaimedMissionsCount = missions.filter((m) => m.isCompleted && !m.isClaimed).length;

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans">
      {/* Background Battlefield HUD */}
      <GameHUD
        onOpenGuild={() => setIsGuildOpen(true)}
        isGuildOpen={isGuildOpen}
        unreadGuildChatCount={unclaimedMissionsCount}
      />

      {/* Main Guild Window Overlay */}
      <GuildWindow
        isOpen={isGuildOpen}
        onClose={() => setIsGuildOpen(false)}
        guildInfo={guildInfo}
        members={members}
        serverGuilds={serverGuilds}
        missions={missions}
        boss={boss}
        skills={skills}
        shopItems={shopItems}
        joinRequests={joinRequests}
        currentUserName={currentUserName}
        currentUserRole={currentUserRole}
        userGuildCoins={userGuildCoins}
        isCheckedIn={isCheckedIn}
        onCheckIn={handleCheckIn}
        onPromoteMember={handlePromoteMember}
        onDemoteMember={handleDemoteMember}
        onKickMember={handleKickMember}
        onDonateToGuild={handleDonateToGuild}
        onInviteMember={handleInviteMember}
        onClaimMissionReward={handleClaimMissionReward}
        onClaimAllMissionRewards={handleClaimAllMissionRewards}
        onSimulateMissionProgress={handleSimulateMissionProgress}
        onAttackBoss={handleAttackBoss}
        onUpgradeSkill={handleUpgradeSkill}
        onBuyShopItem={handleBuyShopItem}
        onUpdateNotice={handleUpdateNotice}
        onUpdateEmblem={handleUpdateEmblem}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onLeaveGuild={handleLeaveGuild}
        onResetData={handleResetData}
      />

      {/* Join / Create Guild Center Modal */}
      <CreateJoinModal
        isOpen={isCreateJoinOpen}
        onClose={() => setIsCreateJoinOpen(false)}
        serverGuilds={serverGuilds}
        onCreateGuild={handleCreateGuild}
        onJoinGuild={handleJoinGuild}
      />
    </div>
  );
}
