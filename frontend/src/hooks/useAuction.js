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
  const [bidError, setBidError] = useState('');

  const timerRef = useRef(null);
  const serverClockOffsetRef = useRef(0);
  const gameTeamsRef = useRef([]);

  useEffect(() => {
    gameTeamsRef.current = gameTeams;
  }, [gameTeams]);

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
      const serverNow = Date.now() + serverClockOffsetRef.current;
      const remaining = Math.max(0, Math.ceil((new Date(timerEnd) - serverNow) / 1000));
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

    const updateOffset = (serverTime) => {
      if (serverTime) {
        serverClockOffsetRef.current = new Date(serverTime) - Date.now();
      }
    };

    const handleLobbyState = ({ gameTeams: gt }) => {
      if (gt?.length > 0) setGameTeams(gt);
    };

    const handleAuctionResumed = ({ status: s, currentPlayer: p, currentBid: cb, highestBidder: hb, timerEnd: te, round: r, log: l, teamStates, remainingPlayers: rem, serverTime }) => {
      updateOffset(serverTime);
      setStatus(s || 'bidding');
      setCurrentPlayer(p || null);
      setCurrentBid(cb || 0);
      
      if (hb) {
        const teamInfo = teamStates?.find(t => t.id === hb) || gameTeamsRef.current.find(t => t.id === hb);
        setHighestBidder({
          gameTeamId: hb,
          teamName: teamInfo?.teamName || teamInfo?.Team?.shortName || 'Unknown Team',
          teamColor: teamInfo?.teamColor || teamInfo?.Team?.primaryColor || '#f59e0b',
        });
      } else {
        setHighestBidder(null);
      }

      setTimerEnd(te || null);
      setRound(r || 0);
      setRemainingPlayers(rem || 0);

      if (Array.isArray(l)) {
        setLog(l.map(logItem => ({
          id: Date.now() + Math.random(),
          message: logItem.type === 'sold'
            ? `🔨 SOLD! ${logItem.player?.name} → ${logItem.soldTo?.name || logItem.soldTo} for ₹${logItem.soldPrice}L`
            : `❌ UNSOLD — ${logItem.player?.name}`,
          timestamp: new Date(logItem.timestamp).toLocaleTimeString(),
        })));
      }

      if (teamStates) {
        setGameTeams(prev => prev.map(gt => {
          const ts = teamStates.find(t => String(t.id) === String(gt.id));
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
          const ts = teamStates.find(t => String(t.id) === String(gt.id));
          return ts ? { ...gt, purseRemaining: ts.purseRemaining, squadSize: ts.squadSize, isAI: ts.isAI } : gt;
        }));
      }
    };

    const handlePlayerNominated = ({ player, currentBid: cb, timerEnd: te, round: r, remainingPlayers: rem, serverTime }) => {
      updateOffset(serverTime);
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

    const handleBidPlaced = ({ gameTeamId, teamName, teamColor, amount, timerEnd: te, isAI, serverTime }) => {
      updateOffset(serverTime);
      setCurrentBid(amount);
      setHighestBidder({ gameTeamId, teamName, teamColor });
      setTimerEnd(te);
      setStatus('bidding');
      setLastEvent({ type: 'bid', teamName, amount });
      addLog(`💰 ${teamName}${isAI ? ' (AI)' : ''} bid ₹${amount}L`);
    };

    const handlePlayerSold = ({ player, soldTo, soldPrice, teamPurse, teamSquadSize }) => {
      setStatus('sold');
      setLastEvent({ type: 'sold', player, soldTo: soldTo?.name || soldTo, soldToColor: soldTo?.color, soldToShortName: soldTo?.name, soldPrice });
      addLog(`🔨 SOLD! ${player?.name} → ${soldTo?.name || soldTo} for ₹${soldPrice}L`);
      // Update team purse/squad from server data
      // soldTo.id comes from in-memory service as a String; gt.id from Sequelize is an Integer
      setGameTeams((prev) =>
        prev.map((gt) =>
          String(gt.id) === String(soldTo?.id)
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
        prev.map((gt) => (String(gt.id) === String(gameTeam.id) ? { ...gt, ...gameTeam } : gt))
      );
    };

    const handleBidError = ({ message }) => {
      setBidError(message || 'Bid failed');
      setTimeout(() => setBidError(''), 4000);
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
    on('bid-error', handleBidError);

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
      off('bid-error', handleBidError);
    };
  }, [socket, on, off, addLog]);

  const placeBid = useCallback(
    async (gameTeamId, amount) => {
      try {
        // Use socket for real-time bidding (the socket handler already validates ownership)
        if (socket?.connected) {
          socket.emit('place-bid', { gameId, gameTeamId, amount });
        } else {
          // Fallback to HTTP if socket is not connected
          await apiPlaceBid(gameId, gameTeamId, amount, token);
        }
      } catch (err) {
        console.error('Bid error:', err);
        throw err;
      }
    },
    [gameId, token, socket]
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
    bidError,
    placeBid,
  };
}
