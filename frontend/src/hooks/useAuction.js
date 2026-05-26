import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { apiGetAuctionState, apiPlaceBid } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useAuction(gameId) {
  const { on, off, socket, placeBid: socketPlaceBid } = useSocket();
  const { token } = useAuth();

  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [timerEnd, setTimerEnd] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [log, setLog] = useState([]);
  const [gameTeams, setGameTeams] = useState([]);
  const [status, setStatus] = useState('idle');
  const [round, setRound] = useState(0);
  const [lastEvent, setLastEvent] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remainingPlayers, setRemainingPlayers] = useState(0);

  const timerRef = useRef(null);

  // Load initial auction state
  useEffect(() => {
    if (!gameId || !token) return;
    apiGetAuctionState(gameId, token)
      .then((data) => {
        if (data) {
          setStatus(data.auction?.status || 'idle');
          setCurrentPlayer(data.auction?.currentPlayer || null);
          setCurrentBid(data.auction?.currentBid || 0);
          setHighestBidder(data.auction?.highestBidderGameTeamId ? { gameTeamId: data.auction.highestBidderGameTeamId } : null);
          setTimerEnd(data.auction?.timerEnd || null);
          setLog(Array.isArray(data.auction?.log) ? data.auction.log.map(l => ({
            id: Date.now() + Math.random(),
            message: l.type === 'sold'
              ? `🔨 SOLD! ${l.player?.name} → ${l.soldTo?.name} for ₹${l.soldPrice}L`
              : `❌ UNSOLD — ${l.player?.name}`,
            timestamp: new Date(l.timestamp).toLocaleTimeString(),
          })) : []);
          setRound(data.auction?.round || 0);
          setRemainingPlayers(data.auction?.remainingPlayers || 0);
          if (data.auction?.status === 'complete') setIsComplete(true);
          if (data.gameTeams?.length > 0) setGameTeams(data.gameTeams);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gameId, token]);

  // Client-side timer countdown (smooth)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!timerEnd) {
      setTimerSeconds(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(timerEnd) - Date.now()) / 1000));
      setTimerSeconds(remaining);
      if (remaining <= 0) clearInterval(timerRef.current);
    };
    update();
    timerRef.current = setInterval(update, 250);
    return () => clearInterval(timerRef.current);
  }, [timerEnd]);

  const addLog = useCallback((message) => {
    setLog((prev) => [
      { id: Date.now() + Math.random(), message, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 99),
    ]);
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleLobbyState = ({ gameTeams: gt }) => {
      if (gt?.length > 0) setGameTeams(gt);
    };

    const handleAuctionResumed = ({ status: s, currentPlayer: p, currentBid: cb, highestBidder: hb, timerEnd: te, round: r, log: l, teamStates }) => {
      setStatus(s || 'bidding');
      setCurrentPlayer(p || null);
      setCurrentBid(cb || 0);
      setHighestBidder(hb ? { gameTeamId: hb } : null);
      setTimerEnd(te || null);
      setRound(r || 0);
      if (teamStates) {
        setGameTeams(prev => prev.map(gt => {
          const ts = teamStates.find(t => t.id === gt.id);
          return ts ? { ...gt, purseRemaining: ts.purseRemaining, squadSize: ts.squadSize } : gt;
        }));
      }
    };

    const handleAuctionStarted = ({ teamStates }) => {
      setStatus('nominating');
      setRound(0);
      setLog([]);
      setIsComplete(false);
      setLastEvent({ type: 'started' });
      if (teamStates) {
        setGameTeams(prev => prev.map(gt => {
          const ts = teamStates.find(t => t.id === gt.id);
          return ts ? { ...gt, purseRemaining: ts.purseRemaining, squadSize: ts.squadSize, isAI: ts.isAI } : gt;
        }));
      }
    };

    const handlePlayerNominated = ({ player, currentBid: cb, timerEnd: te, round: r, remainingPlayers: rem }) => {
      setCurrentPlayer(player);
      setCurrentBid(cb || player?.basePrice || 0);
      setHighestBidder(null);
      setTimerEnd(te);
      setStatus('bidding');
      setRound(r || 0);
      setRemainingPlayers(rem || 0);
      setLastEvent({ type: 'nominated', player });
      addLog(`🎯 ${player?.name} UP — Base: ₹${player?.basePrice}L`);
    };

    const handleBidPlaced = ({ gameTeamId, teamName, teamColor, amount, timerEnd: te, isAI }) => {
      setCurrentBid(amount);
      setHighestBidder({ gameTeamId, teamName, teamColor });
      setTimerEnd(te);
      setStatus('bidding');
      setLastEvent({ type: 'bid', teamName, amount });
      addLog(`💰 ${teamName}${isAI ? ' (AI)' : ''} bid ₹${amount}L`);
    };

    const handlePlayerSold = ({ player, soldTo, soldPrice, teamPurse, teamSquadSize }) => {
      setStatus('sold');
      setLastEvent({ type: 'sold', player, soldTo: soldTo?.name || soldTo, soldPrice });
      addLog(`🔨 SOLD! ${player?.name} → ${soldTo?.name || soldTo} for ₹${soldPrice}L`);
      // Update team purse/squad from server data
      setGameTeams((prev) =>
        prev.map((gt) =>
          (gt.id === soldTo?.id)
            ? { ...gt, purseRemaining: teamPurse, squadSize: teamSquadSize }
            : gt
        )
      );
    };

    const handlePlayerUnsold = ({ player }) => {
      setStatus('unsold');
      setLastEvent({ type: 'unsold', player });
      addLog(`❌ UNSOLD — ${player?.name} goes unsold`);
    };

    const handleAuctionComplete = ({ gameTeams: gt }) => {
      setStatus('complete');
      setIsComplete(true);
      if (gt?.length > 0) setGameTeams(gt);
      setLastEvent({ type: 'complete' });
      addLog('🏆 AUCTION COMPLETE!');
    };

    const handleTimerTick = ({ seconds }) => {
      setTimerSeconds(seconds);
    };

    const handleTeamSelected = ({ gameTeam }) => {
      if (!gameTeam) return;
      setGameTeams((prev) =>
        prev.map((gt) => (gt.id === gameTeam.id ? { ...gt, ...gameTeam } : gt))
      );
    };

    on('lobby-state', handleLobbyState);
    on('auction-resumed', handleAuctionResumed);
    on('auction-started', handleAuctionStarted);
    on('player-nominated', handlePlayerNominated);
    on('bid-placed', handleBidPlaced);
    on('player-sold', handlePlayerSold);
    on('player-unsold', handlePlayerUnsold);
    on('auction-complete', handleAuctionComplete);
    on('timer-tick', handleTimerTick);
    on('team-selected', handleTeamSelected);

    return () => {
      off('lobby-state', handleLobbyState);
      off('auction-resumed', handleAuctionResumed);
      off('auction-started', handleAuctionStarted);
      off('player-nominated', handlePlayerNominated);
      off('bid-placed', handleBidPlaced);
      off('player-sold', handlePlayerSold);
      off('player-unsold', handlePlayerUnsold);
      off('auction-complete', handleAuctionComplete);
      off('timer-tick', handleTimerTick);
      off('team-selected', handleTeamSelected);
    };
  }, [socket, on, off, addLog]);

  const placeBid = useCallback(
    async (gameTeamId, amount) => {
      try {
        await apiPlaceBid(gameId, gameTeamId, amount, token);
        // Also emit socket event so room gets real-time update
        if (socketPlaceBid) socketPlaceBid(gameId, gameTeamId, amount);
      } catch (err) {
        console.error('Bid error:', err);
        throw err;
      }
    },
    [gameId, token, socketPlaceBid]
  );

  return {
    currentPlayer,
    currentBid,
    highestBidder,
    timerEnd,
    timerSeconds,
    log,
    gameTeams,
    setGameTeams,
    status,
    round,
    lastEvent,
    isComplete,
    loading,
    remainingPlayers,
    placeBid,
  };
}
