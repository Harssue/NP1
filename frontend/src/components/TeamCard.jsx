import { Users, Wallet, Bot, Crown } from 'lucide-react';
import { formatCrore } from '../api/index.js';

export default function TeamCard({ gameTeam, isHighestBidder, isCurrentUser, compact }) {
  if (!gameTeam) return null;

  const team = gameTeam.team || gameTeam.Team || {};
  const user = gameTeam.user || gameTeam.User;
  const isAI = gameTeam.isAI || !user;
  const color = team.primaryColor || '#f59e0b';
  const purse = gameTeam.purseRemaining ?? 0;
  const maxPurse = 9000; // 90 Cr in lakhs
  const pursePercent = Math.min(100, Math.round((purse / maxPurse) * 100));

  const getPurseColor = () => {
    if (pursePercent > 50) return '#22c55e';
    if (pursePercent > 25) return '#f59e0b';
    return '#ef4444';
  };

  if (compact) {
    return (
      <div
        className={`relative rounded-xl p-3 transition-all duration-300 cursor-default
          ${isHighestBidder ? 'ring-2 scale-[1.02]' : ''}
          ${isCurrentUser ? 'ring-1 ring-white/20' : ''}
        `}
        style={{
          background: isHighestBidder
            ? `${color}22`
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isHighestBidder ? color + '66' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isHighestBidder ? `0 0 20px ${color}33` : 'none',
        }}
      >
        {/* Top row */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-rajdhani font-bold text-xs flex-shrink-0"
            style={{ background: `${color}33`, color, border: `1px solid ${color}55` }}
          >
            {team.shortName || team.name?.slice(0, 2) || '??'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-rajdhani font-bold text-sm text-white truncate leading-none">
              {team.name || 'Unknown'}
            </p>
            <p className="text-[10px] text-white/40 truncate font-inter mt-0.5 flex items-center gap-1">
              {isAI ? (
                <>
                  <Bot size={9} className="text-purple-400" />
                  <span className="text-purple-400">AI</span>
                </>
              ) : (
                <>
                  {isCurrentUser && <Crown size={9} className="text-ipl-gold" />}
                  <span>{user?.username || 'Player'}</span>
                </>
              )}
            </p>
          </div>
          {isHighestBidder && (
            <div
              className="text-[9px] font-rajdhani font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${color}33`, color }}
            >
              TOP
            </div>
          )}
        </div>

        {/* Purse bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pursePercent}%`, background: getPurseColor() }}
            />
          </div>
          <span className="text-[10px] font-rajdhani font-bold text-white/60 flex-shrink-0">
            {formatCrore(purse)}
          </span>
        </div>

        {/* Squad size */}
        <div className="flex items-center gap-1 mt-1.5">
          <Users size={9} className="text-white/30" />
          <span className="text-[10px] text-white/30 font-inter">
            {gameTeam.squadSize || 0} players
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-300
        ${isHighestBidder ? 'scale-[1.02]' : ''}
        ${isCurrentUser ? 'ring-2 ring-white/20' : ''}
      `}
      style={{
        background: isHighestBidder
          ? `${color}18`
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isHighestBidder ? color + '55' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isHighestBidder ? `0 0 30px ${color}33` : 'none',
      }}
    >
      {/* Top color bar */}
      <div className="h-1 w-full" style={{ background: color }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-rajdhani font-bold text-sm flex-shrink-0"
            style={{
              background: `${color}22`,
              color,
              border: `2px solid ${color}55`,
              boxShadow: `0 0 15px ${color}22`,
            }}
          >
            {team.shortName || team.name?.slice(0, 3) || '???'}
          </div>
          <div className="min-w-0">
            <h3 className="font-rajdhani font-bold text-base text-white truncate">
              {team.name || 'Unknown Team'}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              {isAI ? (
                <>
                  <Bot size={11} className="text-purple-400" />
                  <span className="text-xs text-purple-400 font-inter">AI Bot</span>
                </>
              ) : (
                <>
                  {isCurrentUser && <Crown size={11} className="text-ipl-gold" />}
                  <span className="text-xs text-white/50 font-inter">
                    {user?.username || 'Player'}
                  </span>
                  {isCurrentUser && (
                    <span className="text-[10px] text-ipl-gold font-rajdhani font-bold ml-1">
                      (You)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          {isHighestBidder && (
            <div
              className="ml-auto text-xs font-rajdhani font-bold px-2 py-1 rounded-full animate-pulse"
              style={{ background: `${color}33`, color }}
            >
              LEADING
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="glass rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wallet size={11} className="text-ipl-gold" />
              <span className="text-[10px] text-white/40 font-inter">Purse</span>
            </div>
            <span className="font-rajdhani font-bold text-sm text-ipl-gold">
              {formatCrore(purse)}
            </span>
          </div>
          <div className="glass rounded-lg p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users size={11} className="text-blue-400" />
              <span className="text-[10px] text-white/40 font-inter">Squad</span>
            </div>
            <span className="font-rajdhani font-bold text-sm text-blue-400">
              {gameTeam.squadSize || 0}
            </span>
          </div>
        </div>

        {/* Purse bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-white/30 font-inter">Purse remaining</span>
            <span className="text-[10px] font-rajdhani font-bold" style={{ color: getPurseColor() }}>
              {pursePercent}%
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pursePercent}%`, background: getPurseColor() }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
