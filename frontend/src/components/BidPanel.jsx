import { useState, useCallback } from 'react';
import { formatCrore } from '../api/index.js';
import { Gavel, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import Timer from './Timer.jsx';

const BID_INCREMENTS = [
  { label: '+5L', amount: 5 },
  { label: '+10L', amount: 10 },
  { label: '+25L', amount: 25 },
  { label: '+50L', amount: 50 },
  { label: '+1Cr', amount: 100 },
];

export default function BidPanel({
  status,
  currentBid,
  highestBidder,
  timerSeconds,
  timerEnd,
  myGameTeam,
  myGameTeamId,
  onBid,
  serverError,
}) {
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');
  const [lastBid, setLastBid] = useState(null);

  const canBid =
    status === 'bidding' &&
    myGameTeam &&
    highestBidder?.gameTeamId !== myGameTeamId;

  const myPurse = myGameTeam?.purseRemaining ?? 0;

  const handleBid = useCallback(
    async (increment) => {
      const amount = currentBid + increment;
      if (amount > myPurse) {
        setError(`Insufficient purse! You have ${formatCrore(myPurse)}`);
        setTimeout(() => setError(''), 3000);
        return;
      }
      setBidding(true);
      setError('');
      try {
        await onBid(myGameTeamId, amount);
        setLastBid(amount);
        setTimeout(() => setLastBid(null), 2000);
      } catch (err) {
        setError(err.message || 'Bid failed');
        setTimeout(() => setError(''), 3000);
      } finally {
        setBidding(false);
      }
    },
    [currentBid, myPurse, myGameTeamId, onBid]
  );

  const getStatusLabel = () => {
    if (status === 'idle') return { text: 'Waiting for auction...', color: '#9ca3af' };
    if (status === 'nominating') return { text: 'Player being nominated...', color: '#a855f7' };
    if (status === 'bidding') return { text: 'BIDDING OPEN', color: '#22c55e' };
    if (status === 'sold') return { text: 'SOLD!', color: '#f59e0b' };
    if (status === 'unsold') return { text: 'UNSOLD', color: '#ef4444' };
    if (status === 'complete') return { text: 'AUCTION COMPLETE', color: '#f59e0b' };
    return { text: status, color: '#9ca3af' };
  };

  const { text: statusText, color: statusColor } = getStatusLabel();

  const iAmHighest = highestBidder?.gameTeamId === myGameTeamId;

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4 h-full">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: statusColor }}
          />
          <span
            className="font-rajdhani font-bold text-sm tracking-widest"
            style={{ color: statusColor }}
          >
            {statusText}
          </span>
        </div>
        {status === 'bidding' && (
          <Timer seconds={timerSeconds} timerEnd={timerEnd} />
        )}
      </div>

      {/* Current Bid */}
      <div className="text-center py-4">
        <p className="text-white/40 font-inter text-xs mb-1 tracking-widest uppercase">
          Current Bid
        </p>
        <div
          className={`font-rajdhani font-bold transition-all duration-300 ${
            status === 'bidding' ? 'text-5xl' : 'text-4xl'
          } ${lastBid ? 'scale-110' : 'scale-100'}`}
        >
          <span className="gold-text">{formatCrore(currentBid)}</span>
        </div>

        {/* Highest bidder */}
        {highestBidder && (
          <div className="mt-3 flex items-center justify-center gap-2 animate-slide-up">
            <Shield size={14} style={{ color: highestBidder.teamColor || '#f59e0b' }} />
            <span
              className="font-rajdhani font-bold text-base"
              style={{ color: highestBidder.teamColor || '#f59e0b' }}
            >
              {highestBidder.teamName || 'Unknown Team'}
            </span>
            {iAmHighest && (
              <span className="text-xs bg-ipl-gold/20 text-ipl-gold px-2 py-0.5 rounded-full font-rajdhani font-bold">
                YOU!
              </span>
            )}
          </div>
        )}
        {!highestBidder && status === 'bidding' && (
          <p className="text-white/30 text-sm font-inter mt-2">No bids yet — be first!</p>
        )}
      </div>

      {/* Your status */}
      {myGameTeam && (
        <div
          className={`rounded-xl px-4 py-2.5 flex items-center justify-between
            ${iAmHighest ? 'bg-ipl-gold/10 border border-ipl-gold/30' : 'glass'}`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp
              size={14}
              className={iAmHighest ? 'text-ipl-gold' : 'text-white/40'}
            />
            <span className="font-inter text-xs text-white/50">Your Purse</span>
          </div>
          <span
            className={`font-rajdhani font-bold text-sm ${
              iAmHighest ? 'text-ipl-gold' : 'text-white/80'
            }`}
          >
            {formatCrore(myPurse)}
          </span>
        </div>
      )}

      {/* Error message (local validation or server bid-error) */}
      {(error || serverError) && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 animate-slide-up">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs font-inter">{error || serverError}</p>
        </div>
      )}

      {/* Bid buttons */}
      {canBid && (
        <div className="space-y-3">
          <p className="text-center text-white/40 text-xs font-inter">
            Tap to bid — no pass button needed
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BID_INCREMENTS.map(({ label, amount }) => {
              const bidAmount = currentBid + amount;
              const affordable = bidAmount <= myPurse;
              return (
                <button
                  key={amount}
                  onClick={() => handleBid(amount)}
                  disabled={!affordable || bidding}
                  className={`relative rounded-xl py-3 font-rajdhani font-bold text-sm transition-all duration-200
                    ${affordable && !bidding
                      ? 'bid-btn-active hover:scale-105 active:scale-95 cursor-pointer'
                      : 'opacity-30 cursor-not-allowed'
                    }
                  `}
                  style={{
                    background: affordable
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))'
                      : 'rgba(255,255,255,0.03)',
                    border: affordable
                      ? '1px solid rgba(245,158,11,0.4)'
                      : '1px solid rgba(255,255,255,0.05)',
                    color: affordable ? '#f59e0b' : '#6b7280',
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <Gavel size={12} />
                    <span>{label}</span>
                    <span className="text-[9px] opacity-70">{formatCrore(bidAmount)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Already highest */}
      {status === 'bidding' && iAmHighest && (
        <div className="glass-gold rounded-xl px-4 py-3 text-center animate-pulse-gold">
          <p className="font-rajdhani font-bold text-ipl-gold text-sm">
            🔥 You're the highest bidder!
          </p>
          <p className="text-ipl-gold/60 text-xs font-inter mt-1">
            Sit tight — outbid others will raise
          </p>
        </div>
      )}

      {/* No team */}
      {!myGameTeam && status === 'bidding' && (
        <div className="glass rounded-xl px-4 py-3 text-center">
          <p className="text-white/40 text-sm font-inter">
            You're spectating this auction
          </p>
        </div>
      )}

      {/* Sold/Unsold banners */}
      {status === 'sold' && (
        <div className="glass-gold rounded-xl px-4 py-3 text-center animate-slide-up">
          <p className="font-rajdhani font-bold text-2xl text-ipl-gold animate-glow">
            🔨 SOLD!
          </p>
        </div>
      )}
      {status === 'unsold' && (
        <div className="rounded-xl px-4 py-3 text-center bg-red-500/10 border border-red-500/30 animate-slide-up">
          <p className="font-rajdhani font-bold text-xl text-red-400">
            ❌ UNSOLD
          </p>
        </div>
      )}
    </div>
  );
}
