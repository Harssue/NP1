import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuction } from '../hooks/useAuction.js';
import { apiGetGameState } from '../api/index.js';
import Navbar from '../components/Navbar.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import BidPanel from '../components/BidPanel.jsx';
import TeamCard from '../components/TeamCard.jsx';
import AuctionLog from '../components/AuctionLog.jsx';
import { formatCrore } from '../api/index.js';
import {
  Loader2,
  Trophy,
  Users,
  ChevronRight,
  AlertCircle,
  Gavel,
} from 'lucide-react';

export default function AuctionRoom() {
  const { gameId } = useParams();
  const { user, token } = useAuth();
  const { joinLobby } = useSocket();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [gameError, setGameError] = useState('');
  const [notification, setNotification] = useState(null);

  const userId = user?.id || user?._id;

  const {
    currentPlayer,
    currentBid,
    highestBidder,
    timerSeconds,
    timerEnd,
    log,
    gameTeams,
    setGameTeams,
    status,
    round,
    lastEvent,
    isComplete,
    loading: auctionLoading,
    placeBid,
  } = useAuction(gameId);

  // Load game metadata
  useEffect(() => {
    apiGetGameState(gameId, token)
      .then((data) => {
        setGame(data.game);
        if (data.gameTeams?.length > 0) {
          setGameTeams(data.gameTeams);
        }
      })
      .catch((err) => setGameError(err.message))
      .finally(() => setLoadingGame(false));
  }, [gameId, token]);

  // Join socket room
  useEffect(() => {
    if (gameId && userId) {
      joinLobby(gameId, userId);
    }
  }, [gameId, userId, joinLobby]);

  // Show notification on events
  useEffect(() => {
    if (!lastEvent) return;
    let msg = '';
    let color = '#f59e0b';
    if (lastEvent.type === 'sold') {
      msg = `🔨 ${lastEvent.player?.name} SOLD to ${lastEvent.soldTo} for ${formatCrore(lastEvent.soldPrice)}`;
      color = '#22c55e';
    } else if (lastEvent.type === 'unsold') {
      msg = `❌ ${lastEvent.player?.name} goes UNSOLD`;
      color = '#ef4444';
    } else if (lastEvent.type === 'bid') {
      msg = `💰 ${lastEvent.teamName} bid ${formatCrore(lastEvent.amount)}`;
      color = '#3b82f6';
    } else if (lastEvent.type === 'complete') {
      msg = '🏆 AUCTION COMPLETE! Check your squad.';
      color = '#f59e0b';
    }

    if (msg) {
      setNotification({ msg, color });
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  // Node backend serialises as 'User' / 'Team' (capitalised)
  const myGameTeam = gameTeams.find(
    (gt) =>
      (gt.User?.id ?? gt.userId) === userId ||
      gt.user?.id === userId // fallback for live socket updates
  );
  const myGameTeamId = myGameTeam?.id;

  // Sold state info — match capitalised Team fields
  const soldToTeam =
    status === 'sold' && highestBidder
      ? gameTeams.find((gt) => (gt.id || gt._id) === highestBidder?.gameTeamId)
      : null;

  const handleBid = useCallback(
    async (gameTeamId, amount) => {
      await placeBid(gameTeamId, amount);
    },
    [placeBid]
  );

  if (loadingGame || auctionLoading) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Gavel size={48} className="text-ipl-gold animate-bounce" />
            <div className="absolute inset-0 bg-ipl-gold/20 blur-2xl" />
          </div>
          <p className="font-rajdhani font-bold text-white/60 text-2xl animate-pulse">
            AUCTION IN PROGRESS
          </p>
          <Loader2 size={24} className="text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="min-h-screen animated-bg flex items-center justify-center px-4">
        <div className="glass rounded-3xl p-10 text-center max-w-md">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="font-rajdhani font-bold text-2xl text-white mb-2">Error</h2>
          <p className="text-red-400 font-inter text-sm mb-6">{gameError}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-ipl-gold text-black font-rajdhani font-bold rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Auction complete screen
  if (isComplete) {
    return (
      <div className="min-h-screen animated-bg">
        <Navbar gameCode={game?.lobbyCode} />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <div className="text-center max-w-2xl">
            <div className="relative inline-block mb-6">
              <Trophy size={80} className="text-ipl-gold animate-float mx-auto" />
              <div className="absolute inset-0 bg-ipl-gold/20 blur-3xl" />
            </div>
            <h1 className="font-rajdhani font-bold text-6xl gold-text mb-4">
              AUCTION COMPLETE!
            </h1>
            <p className="text-white/50 font-inter mb-10">
              All players have been auctioned. Check out the final squads!
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {gameTeams.map((gt) => (
                <TeamCard key={gt.id || gt._id} gameTeam={gt} isCurrentUser={myGameTeamId === (gt.id || gt._id)} />
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {myGameTeam && (
                <Link
                  to={`/squad/${gameId}`}
                  className="px-8 py-4 bg-ipl-gold text-black font-rajdhani font-bold text-xl rounded-full hover:bg-ipl-gold-light transition-all glow-gold hover:scale-105"
                >
                  View My Squad →
                </Link>
              )}
              <button
                onClick={() => navigate('/')}
                className="px-8 py-4 glass font-rajdhani font-bold text-xl text-white/70 rounded-full hover:text-white transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-bg flex flex-col">
      {/* Notification toast */}
      {notification && (
        <div
          className="fixed top-20 right-4 z-50 px-5 py-3 rounded-2xl font-rajdhani font-bold text-sm shadow-2xl toast-enter max-w-sm"
          style={{
            background: `${notification.color}22`,
            border: `1px solid ${notification.color}55`,
            color: notification.color,
          }}
        >
          {notification.msg}
        </div>
      )}

      {/* ─── FULL SCREEN OVERLAYS ─── */}
      {status === 'sold' && currentPlayer && soldToTeam && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in px-4">
          <div className="relative text-center p-12 max-w-4xl w-full glass rounded-3xl overflow-hidden"
               style={{
                 borderColor: `${soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#f59e0b'}44`,
                 boxShadow: `0 0 120px ${soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#f59e0b'}33`,
               }}>
            {/* Background Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <span className="text-[12rem] font-rajdhani font-bold whitespace-nowrap" style={{ color: soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#ffffff' }}>
                {soldToTeam.Team?.shortName || soldToTeam.team?.shortName}
              </span>
            </div>

            <div className="relative z-10 animate-slide-up">
              <h2 className="text-6xl md:text-8xl font-rajdhani font-bold text-white mb-6 drop-shadow-2xl">
                {currentPlayer.name}
              </h2>
              
              <div className="inline-flex items-center gap-4 px-8 py-3 rounded-full mb-12 shadow-2xl" 
                   style={{ background: `${soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#f59e0b'}22`, border: `1px solid ${soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#f59e0b'}66` }}>
                 <Trophy size={28} style={{ color: soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#f59e0b' }} className="animate-pulse" />
                 <span className="font-rajdhani font-bold tracking-[0.2em] text-2xl" style={{ color: soldToTeam.Team?.primaryColor || soldToTeam.team?.primaryColor || '#f59e0b' }}>
                   SOLD TO {(soldToTeam.Team?.name || soldToTeam.team?.name)?.toUpperCase()}
                 </span>
              </div>

              <div>
                <span className="text-xl md:text-2xl font-inter text-white/50 block mb-2 uppercase tracking-[0.3em]">Winning Bid</span>
                <span className="text-7xl md:text-9xl font-rajdhani font-bold gold-text drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]">
                  {formatCrore(currentBid)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'unsold' && currentPlayer && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in px-4">
          <div className="text-center p-12 max-w-4xl w-full glass rounded-3xl overflow-hidden border-red-500/20 shadow-[0_0_120px_rgba(239,68,68,0.15)]">
            <h2 className="text-6xl md:text-8xl font-rajdhani font-bold text-white/60 mb-10 animate-slide-up drop-shadow-2xl">
              {currentPlayer.name}
            </h2>
            <div className="inline-block px-10 py-4 rounded-full animate-slide-up bg-red-500/10 border border-red-500/30 shadow-2xl" style={{ animationDelay: '0.1s' }}>
               <span className="font-rajdhani font-bold tracking-[0.4em] text-3xl text-red-400">
                 WENT UNSOLD
               </span>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <Navbar gameCode={game?.lobbyCode} round={round} />

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 p-4 min-h-0">
        {/* ─── LEFT: Player Info ─── */}
        <div className="flex flex-col gap-4">
          {/* Player card */}
          <PlayerCard
            player={currentPlayer}
            basePrice={currentPlayer?.basePrice}
            status={status}
            soldPrice={status === 'sold' ? currentBid : null}
            soldTo={soldToTeam?.Team?.name || soldToTeam?.team?.name || highestBidder?.teamName}
            soldToColor={soldToTeam?.Team?.primaryColor || soldToTeam?.team?.primaryColor || highestBidder?.teamColor}
          />

          {/* My team quick info */}
          {myGameTeam && (
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-rajdhani font-bold"
                  style={{
                    background: `${myGameTeam.Team?.primaryColor || myGameTeam.team?.primaryColor || '#f59e0b'}22`,
                    color: myGameTeam.Team?.primaryColor || myGameTeam.team?.primaryColor || '#f59e0b',
                    border: `1px solid ${myGameTeam.Team?.primaryColor || myGameTeam.team?.primaryColor || '#f59e0b'}44`,
                  }}
                >
                  {myGameTeam.Team?.shortName || myGameTeam.team?.shortName || '?'}
                </div>
                <span className="font-rajdhani font-bold text-sm text-white/80">
                  Your Team
                </span>
                <Link
                  to={`/squad/${gameId}`}
                  className="ml-auto text-ipl-gold/60 hover:text-ipl-gold transition-colors"
                  title="View Squad"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="glass rounded-lg p-2 text-center">
                  <p className="text-[10px] text-white/30 font-inter">Purse</p>
                  <p className="font-rajdhani font-bold text-sm text-ipl-gold">
                    {formatCrore(myGameTeam.purseRemaining)}
                  </p>
                </div>
                <div className="glass rounded-lg p-2 text-center">
                  <p className="text-[10px] text-white/30 font-inter">Players</p>
                  <p className="font-rajdhani font-bold text-sm text-blue-400">
                    {myGameTeam.squadSize || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── CENTER: Bidding Arena ─── */}
        <div className="flex flex-col gap-4">
          {/* Bid panel */}
          <div className="flex-1">
            <BidPanel
              status={status}
              currentBid={currentBid}
              highestBidder={highestBidder}
              timerSeconds={timerSeconds}
              timerEnd={timerEnd}
              myGameTeam={myGameTeam}
              myGameTeamId={myGameTeamId}
              onBid={handleBid}
            />
          </div>

          {/* Auction log - center bottom */}
          <div className="h-48 lg:h-64">
            <AuctionLog log={log} />
          </div>
        </div>

        {/* ─── RIGHT: Teams List ─── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-ipl-gold" />
            <h3 className="font-rajdhani font-bold text-base text-white/80">
              Teams ({gameTeams.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {gameTeams.length === 0 ? (
              <div className="glass rounded-xl p-4 text-center">
                <p className="text-white/30 text-sm font-inter">No teams yet</p>
              </div>
            ) : (
              gameTeams.map((gt) => (
                <TeamCard
                  key={gt.id || gt._id}
                  gameTeam={gt}
                  compact
                  isHighestBidder={
                    highestBidder?.gameTeamId === (gt.id || gt._id)
                  }
                  isCurrentUser={(gt.User?.id ?? gt.userId ?? gt.user?.id) === userId}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
