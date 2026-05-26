import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { apiGetGameState, apiGetTeams, apiSelectTeam, apiStartGame } from '../api/index.js';
import Navbar from '../components/Navbar.jsx';
import {
  Users,
  Copy,
  Check,
  Play,
  Crown,
  Loader2,
  Shield,
  Bot,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const IPL_TEAM_COLORS = {
  CSK: '#f9c000',
  MI: '#004B8D',
  RCB: '#C8102E',
  KKR: '#3A225D',
  RR: '#EA1A8E',
  DC: '#17479E',
  PBKS: '#ED1B24',
  SRH: '#F7A721',
  LSG: '#C0D62B',
  GT: '#1C2B59',
};

export default function Lobby() {
  const { gameId } = useParams();
  const { user, token } = useAuth();
  const { on, off, joinLobby, emitStartAuction } = useSocket();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [gameTeams, setGameTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const userId = user?.id;

  const fetchState = useCallback(async () => {
    try {
      const [stateData, teamsData] = await Promise.all([
        apiGetGameState(gameId, token),
        apiGetTeams(token),
      ]);
      setGame(stateData.game);
      setGameTeams(stateData.gameTeams || []);
      // Node backend returns { teams: [...] }
      const rawTeams = teamsData.teams || teamsData.results || teamsData;
      setAllTeams(Array.isArray(rawTeams) ? rawTeams : []);

      if (stateData.game.status !== 'waiting') {
        navigate(`/auction/${gameId}`);
        return;
      }

      // Find my current team — Node serializer uses capitalised 'User' & 'Team'
      const myGT = (stateData.gameTeams || []).find(
        (gt) => (gt.User?.id ?? gt.userId) === userId
      );
      if (myGT) {
        setSelectedTeamId(myGT.Team?.id ?? myGT.teamId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gameId, token, userId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Join socket lobby
  useEffect(() => {
    if (gameId && userId) {
      joinLobby(gameId, userId);
    }
  }, [gameId, userId, joinLobby]);

  // Socket events
  useEffect(() => {
    const handleLobbyState = ({ game: g, gameTeams: gt }) => {
      if (g) setGame(g);
      if (gt) setGameTeams(gt);
    };

    const handleTeamSelected = ({ gameTeam }) => {
      setGameTeams((prev) => {
        const exists = prev.find((gt) => gt.id === gameTeam.id || gt._id === gameTeam._id);
        if (exists) return prev.map((gt) => (gt.id === gameTeam.id ? gameTeam : gt));
        return [...prev, gameTeam];
      });
    };

    const handleAuctionStarted = () => {
      navigate(`/auction/${gameId}`);
    };

    on('lobby-state', handleLobbyState);
    on('team-selected', handleTeamSelected);
    on('auction-started', handleAuctionStarted);
    on('auction-resumed', handleAuctionStarted);

    return () => {
      off('lobby-state', handleLobbyState);
      off('team-selected', handleTeamSelected);
      off('auction-started', handleAuctionStarted);
      off('auction-resumed', handleAuctionStarted);
    };
  }, [on, off, gameId, navigate]);

  const copyCode = () => {
    const code = game?.lobbyCode || '';
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectTeam = async (teamId) => {
    if (selectedTeamId === teamId || selecting) return;
    setSelecting(true);
    setError('');
    try {
      await apiSelectTeam(gameId, userId, teamId, token);
      setSelectedTeamId(teamId);
      // Re-fetch state to get updated gameTeams from server
      await fetchState();
    } catch (err) {
      setError(err.message);
    } finally {
      setSelecting(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      await apiStartGame(gameId, token);
      emitStartAuction(gameId);
      navigate(`/auction/${gameId}`);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  // Node backend sends hostUserId (not nested host.id)
  const isHost = game?.hostUserId === userId;
  const myGameTeam = gameTeams.find(
    (gt) => (gt.User?.id ?? gt.userId) === userId
  );
  const takenTeamIds = gameTeams
    .filter((gt) => gt.User || gt.userId)
    .map((gt) => gt.Team?.id ?? gt.teamId);

  const getTeamGameTeam = (teamId) =>
    gameTeams.find((gt) => (gt.Team?.id ?? gt.teamId) === teamId);

  if (loading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-ipl-gold animate-spin" />
          <p className="font-rajdhani text-white/60 text-lg">Loading lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-bg">
      <Navbar gameCode={game?.lobbyCode} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-rajdhani font-bold text-4xl text-white">
              Auction <span className="gold-text">Lobby</span>
            </h1>
            <p className="text-white/40 font-inter text-sm mt-1">
              {gameTeams.filter((gt) => gt.User || gt.userId).length} / 10 players joined
            </p>
          </div>

          {/* Lobby code */}
          <div className="glass-gold rounded-2xl px-6 py-4 flex items-center gap-4">
            <div>
              <p className="text-white/40 text-xs font-inter">Lobby Code</p>
              <p className="font-rajdhani font-bold text-3xl text-ipl-gold tracking-widest">
                {game?.lobbyCode || '------'}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="p-2.5 glass rounded-xl hover:bg-white/10 transition-all duration-200 group"
              title="Copy code"
            >
              {copied ? (
                <Check size={18} className="text-green-400" />
              ) : (
                <Copy size={18} className="text-white/60 group-hover:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 animate-slide-up">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-red-400 text-sm font-inter">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Team selection grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-rajdhani font-bold text-xl text-white/80">
                Pick Your Franchise
              </h2>
              <button
                onClick={fetchState}
                className="p-2 glass rounded-lg hover:bg-white/10 transition-all"
                title="Refresh"
              >
                <RefreshCw size={14} className="text-white/40" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {allTeams.map((team) => {
                const teamId = team.id;
                const color = team.primaryColor || '#f59e0b';
                const isTaken = takenTeamIds.includes(teamId);
                const isMyTeam = (selectedTeamId === teamId);
                const occupant = getTeamGameTeam(teamId);
                // Node backend serialises as 'User' (capital)
                const occupantUser = occupant?.User || occupant?.user;
                const isOccupantMe = (occupant?.User?.id ?? occupant?.userId) === userId;

                return (
                  <button
                    key={teamId}
                    onClick={() => !isTaken || isMyTeam ? handleSelectTeam(teamId) : null}
                    disabled={(isTaken && !isMyTeam) || selecting}
                    className={`relative rounded-2xl p-4 text-left transition-all duration-300 group
                      ${isMyTeam ? 'scale-[1.03] ring-2' : ''}
                      ${isTaken && !isMyTeam ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] cursor-pointer'}
                    `}
                    style={{
                      background: isMyTeam
                        ? `${color}22`
                        : isTaken
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isMyTeam ? color + '66' : isTaken ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`,
                      boxShadow: isMyTeam ? `0 0 25px ${color}33` : 'none',
                      '--tw-ring-color': color,
                    }}
                  >
                    {/* Team badge */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-rajdhani font-bold text-xs mb-3 transition-transform group-hover:scale-110"
                      style={{
                        background: `${color}22`,
                        border: `2px solid ${color}55`,
                        color,
                      }}
                    >
                      {team.shortName || team.name?.slice(0, 3)}
                    </div>

                    <p className="font-rajdhani font-bold text-sm text-white leading-tight mb-1">
                      {team.name}
                    </p>

                    {/* Occupant info */}
                    {occupant ? (
                      <div className="flex items-center gap-1 mt-2">
                        {isOccupantMe ? (
                          <>
                            <Crown size={10} className="text-ipl-gold" />
                            <span className="text-[10px] text-ipl-gold font-rajdhani font-bold">
                              Your pick
                            </span>
                          </>
                        ) : occupantUser ? (
                          <>
                            <Shield size={10} className="text-blue-400" />
                            <span className="text-[10px] text-blue-400 font-inter truncate">
                              {occupantUser.username || 'Player'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Bot size={10} className="text-purple-400" />
                            <span className="text-[10px] text-purple-400 font-inter">AI Bot</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] text-green-400 font-inter">Available</span>
                      </div>
                    )}

                    {/* My team indicator */}
                    {isMyTeam && (
                      <div
                        className="absolute top-2 right-2 text-[9px] font-rajdhani font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${color}33`, color }}
                      >
                        YOU
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Players in lobby */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-ipl-gold" />
                <h3 className="font-rajdhani font-bold text-base text-white/80">Players</h3>
                <span className="ml-auto text-xs text-white/30 font-inter">
                  {gameTeams.filter((gt) => gt.User || gt.userId).length} joined
                </span>
              </div>

              <div className="space-y-2">
                {gameTeams.length === 0 ? (
                  <p className="text-white/30 text-sm font-inter text-center py-4">
                    No players yet...
                  </p>
                ) : (
                  gameTeams.map((gt, i) => {
                    const u = gt.User || gt.user;
                    const t = gt.Team || gt.team;
                    const color = t?.primaryColor || '#9ca3af';
                    const isMe = (u?.id ?? gt.userId) === userId;

                    return (
                      <div
                        key={gt.id || gt._id || i}
                        className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{
                          background: isMe ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                          border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-rajdhani font-bold text-[10px]"
                          style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                        >
                          {t?.shortName || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-inter text-white truncate">
                            {u?.username || 'AI Bot'}
                            {isMe && (
                              <span className="text-ipl-gold text-xs ml-1 font-rajdhani font-bold">
                                (You)
                              </span>
                            )}
                            {!u && (
                              <span className="text-purple-400 text-xs ml-1">
                                <Bot size={10} className="inline" />
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-white/30 font-inter">{t?.name || 'No team'}</p>
                        </div>
                        {isHost && isMe && (
                          <Crown size={12} className="text-ipl-gold flex-shrink-0" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Host controls */}
            {isHost && (
              <div className="glass-gold rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Crown size={16} className="text-ipl-gold" />
                  <h3 className="font-rajdhani font-bold text-base text-ipl-gold">
                    Host Controls
                  </h3>
                </div>
                <p className="text-white/50 text-xs font-inter mb-4">
                  Start the auction when all players have joined and selected their teams.
                </p>
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full py-3.5 bg-ipl-gold text-black font-rajdhani font-bold text-lg rounded-xl hover:bg-ipl-gold-light transition-all duration-300 hover:scale-[1.02] glow-gold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {starting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Start Auction
                    </>
                  )}
                </button>
              </div>
            )}

            {!isHost && (
              <div className="glass rounded-2xl p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Loader2 size={20} className="text-white/30 animate-spin" />
                </div>
                <p className="font-rajdhani font-bold text-white/60">
                  Waiting for host...
                </p>
                <p className="text-white/30 text-xs font-inter mt-1">
                  The host will start the auction
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
