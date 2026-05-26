import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGetGameState, apiGetSquad, formatCrore, formatRole, getRoleColor } from '../api/index.js';
import Navbar from '../components/Navbar.jsx';
import { Users, ChevronLeft, Star, Globe, Shield, Trophy, Loader2 } from 'lucide-react';

const ROLE_ORDER = ['Batsman', 'All-Rounder', 'Wicketkeeper', 'Bowler'];

export default function Squad() {
  const { gameId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [gameTeams, setGameTeams] = useState([]);
  const [squads, setSquads] = useState({}); // gameTeamId → [squadEntries]
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = user?.id;

  useEffect(() => {
    if (!gameId || !token) return;
    apiGetGameState(gameId, token)
      .then(async (data) => {
        const gts = data.gameTeams || [];
        setGameTeams(gts);

        // Auto-select user's team first
        const myTeam = gts.find(gt => gt.user?.id === userId);
        if (myTeam) setSelectedTeamId(myTeam.id);
        else if (gts.length > 0) setSelectedTeamId(gts[0].id);

        // Load squads for all teams
        const squadMap = {};
        await Promise.all(
          gts.map(async (gt) => {
            try {
              const res = await apiGetSquad(gt.id, token);
              squadMap[gt.id] = res.squad || [];
            } catch {
              squadMap[gt.id] = [];
            }
          })
        );
        setSquads(squadMap);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [gameId, token, userId]);

  const selectedTeam = gameTeams.find(gt => gt.id === selectedTeamId);
  const selectedSquad = squads[selectedTeamId] || [];

  // Group by role
  const groupedByRole = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = selectedSquad.filter(s => s.Player?.role === role);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-ipl-gold animate-spin" />
          <p className="font-rajdhani font-bold text-white/60 text-xl">Loading Squads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="glass rounded-3xl p-10 text-center max-w-md">
          <p className="text-red-400 font-inter mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-ipl-gold text-black font-rajdhani font-bold rounded-xl">
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-bg flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to={`/auction/${gameId}`} className="glass p-2 rounded-xl text-white/50 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="font-rajdhani font-bold text-3xl gold-text">FINAL SQUADS</h1>
            <p className="text-white/40 font-inter text-sm">Post-auction player lists for all {gameTeams.length} franchises</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Trophy size={16} className="text-ipl-gold" />
            <span className="font-rajdhani font-bold text-ipl-gold">{gameTeams.length} Teams</span>
          </div>
        </div>

        {/* Team selector tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {gameTeams.map((gt) => {
            const isMe = gt.user?.id === userId || gt.User?.id === userId;
            const isSelected = gt.id === selectedTeamId;
            return (
              <button
                key={gt.id}
                onClick={() => setSelectedTeamId(gt.id)}
                className={`relative px-4 py-2 rounded-xl font-rajdhani font-bold text-sm transition-all duration-200 ${
                  isSelected
                    ? 'text-black scale-105 shadow-lg'
                    : 'glass text-white/60 hover:text-white'
                }`}
                style={isSelected ? {
                  background: gt.team?.primaryColor || gt.Team?.primaryColor || '#f59e0b',
                  boxShadow: `0 0 20px ${gt.team?.primaryColor || '#f59e0b'}44`,
                } : {}}
              >
                {gt.team?.shortName || gt.Team?.shortName}
                {isMe && <Star size={8} className="absolute top-1 right-1 text-yellow-300" />}
              </button>
            );
          })}
        </div>

        {selectedTeam && (
          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            {/* Team summary card */}
            <div
              className="glass rounded-3xl p-6 border"
              style={{ borderColor: `${selectedTeam.team?.primaryColor || selectedTeam.Team?.primaryColor || '#f59e0b'}33`,
                background: `${selectedTeam.team?.primaryColor || selectedTeam.Team?.primaryColor || '#f59e0b'}08` }}
            >
              {/* Team header */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center font-rajdhani font-bold text-xl"
                  style={{
                    background: `${selectedTeam.team?.primaryColor || selectedTeam.Team?.primaryColor || '#f59e0b'}22`,
                    color: selectedTeam.team?.primaryColor || selectedTeam.Team?.primaryColor || '#f59e0b',
                    border: `2px solid ${selectedTeam.team?.primaryColor || selectedTeam.Team?.primaryColor || '#f59e0b'}44`,
                  }}
                >
                  {selectedTeam.team?.logoInitials || selectedTeam.team?.shortName || selectedTeam.Team?.shortName}
                </div>
                <div>
                  <h2 className="font-rajdhani font-bold text-xl text-white">
                    {selectedTeam.team?.name || selectedTeam.Team?.name}
                  </h2>
                  <p className="text-white/40 font-inter text-xs">
                    {selectedTeam.isAI ? '🤖 AI Controlled' : `👤 ${selectedTeam.user?.username || selectedTeam.User?.username || 'Human'}`}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/50 font-inter text-sm">Squad Size</span>
                  <span className="font-rajdhani font-bold text-white">{selectedSquad.length} / 25</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/50 font-inter text-sm">Purse Remaining</span>
                  <span className="font-rajdhani font-bold text-ipl-gold">{formatCrore(selectedTeam.purseRemaining)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/50 font-inter text-sm flex items-center gap-1">
                    <Globe size={12} /> Overseas
                  </span>
                  <span className="font-rajdhani font-bold text-orange-400">
                    {selectedSquad.filter(s => s.Player?.nationality === 'Overseas').length} / 8
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-white/50 font-inter text-sm">Total Spend</span>
                  <span className="font-rajdhani font-bold text-green-400">
                    {formatCrore((selectedTeam.game?.startingPurse || 9000) - (selectedTeam.purseRemaining || 0))}
                  </span>
                </div>
              </div>

              {/* Role breakdown */}
              <div>
                <p className="text-white/40 font-inter text-xs uppercase tracking-wider mb-3">Role Breakdown</p>
                {ROLE_ORDER.map((role) => {
                  const count = groupedByRole[role]?.length || 0;
                  const max = role === 'Wicketkeeper' ? 3 : role === 'Bowler' ? 8 : 8;
                  return (
                    <div key={role} className="flex items-center gap-3 mb-2">
                      <span className="text-white/50 font-inter text-xs w-24 truncate">{role}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (count / max) * 100)}%`,
                            background: getRoleColor(role),
                          }}
                        />
                      </div>
                      <span className="text-white/60 font-rajdhani font-bold text-xs w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Players list */}
            <div>
              {selectedSquad.length === 0 ? (
                <div className="glass rounded-3xl p-12 text-center">
                  <Shield size={48} className="text-white/20 mx-auto mb-4" />
                  <p className="font-rajdhani font-bold text-2xl text-white/30 mb-2">No Players Acquired</p>
                  <p className="text-white/20 font-inter text-sm">This team didn't win any bids at auction.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {ROLE_ORDER.map((role) => {
                    const rolePlayers = groupedByRole[role];
                    if (!rolePlayers?.length) return null;
                    return (
                      <div key={role}>
                        <div className="flex items-center gap-3 mb-3">
                          <span
                            className="px-3 py-1 rounded-lg font-rajdhani font-bold text-xs uppercase tracking-wider"
                            style={{
                              background: `${getRoleColor(role)}22`,
                              color: getRoleColor(role),
                              border: `1px solid ${getRoleColor(role)}44`,
                            }}
                          >
                            {role}s ({rolePlayers.length})
                          </span>
                          <div className="flex-1 h-px bg-white/5" />
                        </div>
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {rolePlayers.map((squad) => {
                            const player = squad.Player;
                            return (
                              <div
                                key={squad.id}
                                className="glass rounded-2xl p-4 hover:bg-white/5 transition-all duration-200 group"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-rajdhani font-bold text-white text-base truncate">
                                      {player?.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {player?.nationality === 'Overseas' && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-inter">
                                          Overseas
                                        </span>
                                      )}
                                      <span
                                        className="text-[10px] font-inter"
                                        style={{ color: getRoleColor(player?.role) }}
                                      >
                                        {formatRole(player?.role)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right ml-3">
                                    <p className="font-rajdhani font-bold text-ipl-gold text-sm">
                                      {formatCrore(squad.soldPrice)}
                                    </p>
                                    <p className="text-white/25 font-inter text-[10px]">
                                      Base: {formatCrore(player?.basePrice)}
                                    </p>
                                  </div>
                                </div>
                                {player?.battingStyle && (
                                  <p className="text-white/25 font-inter text-[10px] truncate mt-1">
                                    {player.battingStyle}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
