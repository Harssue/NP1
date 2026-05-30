/**
 * Auction Service — Core auction state management
 * Uses in-memory state (Map) per game for speed,
 * persisting key events to SQLite via Sequelize.
 */

const { AuctionState, GameTeam, Player, Squad, Game, Team, User } = require('../models');
const { getAIDecision, getBidIncrement } = require('./aiService');

const BID_TIMER_SECONDS   = 20;
const RESET_TIMER_SECONDS = 12;
const AI_BID_DELAY_MIN    = 1800;
const AI_BID_DELAY_MAX    = 4500;

class AuctionService {
  constructor() {
    this.io = null;
    // Map<gameId, liveState>
    this.liveGames = new Map();
  }

  setIO(io) {
    this.io = io;
  }

  emit(gameId, event, data) {
    if (this.io) this.io.to(String(gameId)).emit(event, data);
  }

  /**
   * Initialise in-memory state for a game when auction starts.
   */
  async initGame(gameId) {
    const auctionState = await AuctionState.findOne({ where: { gameId } });
    if (!auctionState) return null;

    const gameTeams = await GameTeam.findAll({
      where: { gameId },
      include: [
        { model: Team, as: 'Team' },
        { model: User, as: 'User', attributes: ['id', 'username'] },
      ],
    });

    const teamStates = new Map();
    for (const gt of gameTeams) {
      teamStates.set(String(gt.id), {
        id: String(gt.id),
        teamId: gt.Team.id,
        teamName: gt.Team.shortName,
        teamColor: gt.Team.primaryColor,
        userId: gt.User ? String(gt.User.id) : null,
        isAI: gt.isAI,
        purseRemaining: gt.purseRemaining,
        squadSize: gt.squadSize,
        overseasCount: gt.overseasCount,
        roleBreakdown: { Batsman: 0, Bowler: 0, 'All-Rounder': 0, Wicketkeeper: 0 },
      });
    }

    // playerPoolJson getter returns a parsed array already
    const live = {
      gameId: String(gameId),
      status: 'nominating',
      playerPool: auctionState.playerPoolJson.map((id) => String(id)),
      currentPlayer: null,
      currentBid: 0,
      highestBidder: null, // gameTeamId string
      timerRef: null,
      timerEnd: null,
      log: [],
      round: 0,
      teamStates,
      pendingAIBids: new Map(), // gameTeamId -> timeoutRef
    };

    this.liveGames.set(String(gameId), live);
    return live;
  }

  /**
   * Nominate the next player from the pool.
   */
  async nominateNextPlayer(gameId) {
    const gameIdStr = String(gameId);
    console.log(`[AuctionService] nominateNextPlayer called for gameId: ${gameIdStr}`);
    const live = this.liveGames.get(gameIdStr);
    if (!live) {
      console.log(`[AuctionService] live state not found for ${gameIdStr}`);
      return;
    }

    // Clear any pending timers
    this._clearTimer(live);
    this._clearAIPendingBids(live);

    if (live.playerPool.length === 0) {
      return this._completeAuction(gameIdStr);
    }

    // Check if all teams are at max squad — end auction
    const allFull = [...live.teamStates.values()].every((ts) => ts.squadSize >= 25);
    if (allFull) return this._completeAuction(gameIdStr);

    const playerId = live.playerPool.shift();
    const player = await Player.findByPk(playerId);
    if (!player) return this.nominateNextPlayer(gameIdStr); // skip missing player

    live.currentPlayer = player;
    live.currentBid    = player.basePrice;
    live.highestBidder = null;
    live.status        = 'bidding';
    live.round++;

    const timerEnd = new Date(Date.now() + BID_TIMER_SECONDS * 1000);
    live.timerEnd  = timerEnd;

    // Persist to DB
    const auctionState = await AuctionState.findOne({ where: { gameId: gameIdStr } });
    if (auctionState) {
      auctionState.status                  = 'bidding';
      auctionState.currentPlayerId         = player.id;
      auctionState.currentBid              = player.basePrice;
      auctionState.highestBidderGameTeamId = null;
      auctionState.timerEnd                = timerEnd;
      auctionState.round                   = live.round;
      auctionState.playerPoolJson          = live.playerPool; // setter auto-serialises
      await auctionState.save();
    }

    const nominatingTeam = this._getRandomTeamForDisplay(live);

    console.log(`[AuctionService] Emitting player-nominated for ${player.name} to gameId ${gameIdStr}`);
    this.emit(gameIdStr, 'player-nominated', {
      player: player.toJSON(),
      currentBid: player.basePrice,
      timerEnd: timerEnd.toISOString(),
      nominatingTeam,
      round: live.round,
      remainingPlayers: live.playerPool.length + 1,
      serverTime: new Date().toISOString(),
    });

    // Start countdown timer
    live.timerRef = this._startTimer(gameIdStr, BID_TIMER_SECONDS);

    // Schedule AI bids
    this._scheduleAIBids(gameIdStr);
  }

  _getRandomTeamForDisplay(live) {
    const teams = [...live.teamStates.values()];
    if (teams.length === 0) return null;
    const t = teams[Math.floor(Math.random() * teams.length)];
    return { id: t.id, name: t.teamName, color: t.teamColor };
  }

  /**
   * Place a bid (human or AI).
   */
  async placeBid(gameId, gameTeamId, amount, isAI = false) {
    const gameIdStr     = String(gameId);
    const gameTeamIdStr = String(gameTeamId);

    const live = this.liveGames.get(gameIdStr);
    if (!live) return { success: false, error: 'Auction not active' };
    if (live.status !== 'bidding') return { success: false, error: 'Not in bidding phase' };
    if (!live.currentPlayer) return { success: false, error: 'No player nominated' };

    const teamState = live.teamStates.get(gameTeamIdStr);
    if (!teamState) return { success: false, error: 'Team not in game' };

    // Validation
    if (amount <= live.currentBid) return { success: false, error: 'Bid must exceed current bid' };
    if (amount > teamState.purseRemaining) return { success: false, error: 'Insufficient purse' };

    // Overseas player limit (max 8 per squad) — mirrors the AI check in aiService.js
    const MAX_OVERSEAS = 8;
    if (live.currentPlayer.nationality === 'Overseas' && teamState.overseasCount >= MAX_OVERSEAS) {
      return { success: false, error: `Overseas limit reached (${MAX_OVERSEAS} overseas players max)` };
    }

    const minNextBid = live.currentBid + getBidIncrement(live.currentBid);
    if (amount < minNextBid) return { success: false, error: `Minimum bid increment: ${minNextBid}L` };

    // Can't bid on yourself if you're already highest bidder
    if (live.highestBidder === gameTeamIdStr) return { success: false, error: 'You are already the highest bidder' };

    // Apply bid
    live.currentBid    = amount;
    live.highestBidder = gameTeamIdStr;

    // Reset timer
    const newTimerEnd = new Date(Date.now() + RESET_TIMER_SECONDS * 1000);
    live.timerEnd = newTimerEnd;
    this._clearTimer(live);
    live.timerRef = this._startTimer(gameIdStr, RESET_TIMER_SECONDS);

    this.emit(gameIdStr, 'bid-placed', {
      gameTeamId: gameTeamIdStr,
      teamName:   teamState.teamName,
      teamColor:  teamState.teamColor,
      amount,
      timerEnd:   newTimerEnd.toISOString(),
      isAI,
      serverTime: new Date().toISOString(),
    });

    // Re-schedule AI bids (other AI teams respond)
    this._scheduleAIBids(gameIdStr, gameTeamIdStr);

    return { success: true, currentBid: amount };
  }

  _scheduleAIBids(gameId, excludeTeamId = null) {
    const live = this.liveGames.get(gameId);
    if (!live) return;

    // Cancel old AI timers
    this._clearAIPendingBids(live);

    const aiTeams = [...live.teamStates.values()].filter(
      (ts) => ts.isAI && ts.id !== excludeTeamId && ts.id !== live.highestBidder
    );

    // Shuffle AI teams for random bidding order
    aiTeams.sort(() => Math.random() - 0.5);

    let delay = AI_BID_DELAY_MIN;
    for (const aiTeam of aiTeams) {
      const decision = getAIDecision(
        aiTeam,
        live.currentPlayer,
        live.currentBid,
        live.teamStates
      );

      if (decision.shouldBid) {
        const t = setTimeout(async () => {
          const currentLive = this.liveGames.get(gameId);
          if (!currentLive || currentLive.status !== 'bidding') return;
          if (currentLive.highestBidder === aiTeam.id) return;
          await this.placeBid(gameId, aiTeam.id, decision.bidAmount, true);
        }, delay + Math.floor(Math.random() * 800));

        live.pendingAIBids.set(aiTeam.id, t);
        delay += AI_BID_DELAY_MIN + Math.floor(Math.random() * (AI_BID_DELAY_MAX - AI_BID_DELAY_MIN));
      }
    }
  }

  _startTimer(gameId, seconds) {
    let remaining = seconds;

    const tickInterval = setInterval(() => {
      const currentLive = this.liveGames.get(gameId);
      if (!currentLive || currentLive.timerRef !== tickInterval) {
        clearInterval(tickInterval);
        return;
      }
      remaining--;
      this.emit(gameId, 'timer-tick', { seconds: remaining });

      if (remaining <= 0) {
        clearInterval(tickInterval);
        this._hammerDown(gameId);
      }
    }, 1000);

    return tickInterval;
  }

  _clearTimer(live) {
    if (live.timerRef) {
      clearInterval(live.timerRef);
      live.timerRef = null;
    }
  }

  _clearAIPendingBids(live) {
    for (const [, t] of live.pendingAIBids) clearTimeout(t);
    live.pendingAIBids.clear();
  }

  /**
   * Timer expired — sell or mark as unsold.
   */
  async _hammerDown(gameId) {
    const live = this.liveGames.get(gameId);
    if (!live || live.status !== 'bidding') return;

    live.status = 'sold';
    this._clearAIPendingBids(live);

    const { currentPlayer, currentBid, highestBidder } = live;

    if (!highestBidder) {
      // No bids — player unsold
      const logEntry = {
        type: 'unsold',
        player: currentPlayer.toJSON ? currentPlayer.toJSON() : currentPlayer,
        timestamp: new Date().toISOString(),
      };
      live.log.unshift(logEntry);

      await this._persistAuctionState(gameId, live, 'unsold');

      this.emit(gameId, 'player-unsold', {
        player: currentPlayer.toJSON ? currentPlayer.toJSON() : currentPlayer,
        log: logEntry,
      });
    } else {
      // Sold!
      const winnerState = live.teamStates.get(highestBidder);
      winnerState.purseRemaining -= currentBid;
      winnerState.squadSize++;

      if (currentPlayer.nationality === 'Overseas') {
        winnerState.overseasCount++;
      }
      if (winnerState.roleBreakdown[currentPlayer.role] !== undefined) {
        winnerState.roleBreakdown[currentPlayer.role]++;
      }

      // Persist to DB
      try {
        await GameTeam.update(
          {
            purseRemaining: winnerState.purseRemaining,
            squadSize:      winnerState.squadSize,
            overseasCount:  winnerState.overseasCount,
          },
          { where: { id: highestBidder } }
        );

        await Squad.create({
          gameId,
          gameTeamId: highestBidder,
          playerId:   currentPlayer.id,
          soldPrice:  currentBid,
        });
      } catch (e) {
        console.error('DB persist error on hammer down:', e);
      }

      const logEntry = {
        type: 'sold',
        player: currentPlayer.toJSON ? currentPlayer.toJSON() : currentPlayer,
        soldTo: { id: highestBidder, name: winnerState.teamName, color: winnerState.teamColor },
        soldPrice: currentBid,
        timestamp: new Date().toISOString(),
      };
      live.log.unshift(logEntry);

      await this._persistAuctionState(gameId, live, 'sold');

      this.emit(gameId, 'player-sold', {
        player: currentPlayer.toJSON ? currentPlayer.toJSON() : currentPlayer,
        soldTo: { id: highestBidder, name: winnerState.teamName, color: winnerState.teamColor },
        soldPrice: currentBid,
        teamPurse: winnerState.purseRemaining,
        teamSquadSize: winnerState.squadSize,
        log: logEntry,
      });
    }

    // Short pause, then nominate next
    setTimeout(() => this.nominateNextPlayer(gameId), 3000);
  }

  async _persistAuctionState(gameId, live, status) {
    try {
      const auctionState = await AuctionState.findOne({ where: { gameId } });
      if (auctionState) {
        auctionState.status                  = status;
        auctionState.currentPlayerId         = live.currentPlayer?.id || null;
        auctionState.currentBid              = live.currentBid;
        auctionState.highestBidderGameTeamId = live.highestBidder || null;
        auctionState.logJson                 = live.log.slice(0, 100); // setter auto-serialises
        auctionState.playerPoolJson          = live.playerPool;         // setter auto-serialises
        await auctionState.save();
      }
    } catch (e) {
      console.error('Persist error:', e);
    }
  }

  async _completeAuction(gameId) {
    const live = this.liveGames.get(gameId);
    if (!live) return;

    live.status = 'complete';
    this._clearTimer(live);
    this._clearAIPendingBids(live);

    try {
      await Game.update({ status: 'complete' }, { where: { id: gameId } });
      const auctionState = await AuctionState.findOne({ where: { gameId } });
      if (auctionState) {
        auctionState.status = 'complete';
        await auctionState.save();
      }
    } catch (e) {
      console.error('Complete auction persist error:', e);
    }

    const finalGameTeams = await GameTeam.findAll({
      where: { gameId },
      include: [
        { model: Team, as: 'Team' },
        { model: User, as: 'User', attributes: ['id', 'username'] },
      ],
    });

    this.emit(gameId, 'auction-complete', {
      gameTeams: finalGameTeams.map((gt) => ({
        id:           gt.id,
        teamName:     gt.Team.name,
        shortName:    gt.Team.shortName,
        primaryColor: gt.Team.primaryColor,
        userId:       gt.User?.id || null,
        isAI:         gt.isAI,
        purseRemaining: gt.purseRemaining,
        squadSize:    gt.squadSize,
      })),
    });

    // Clean up in-memory state after a delay
    setTimeout(() => this.liveGames.delete(String(gameId)), 60000);
  }

  getLiveState(gameId) {
    return this.liveGames.get(String(gameId));
  }
}

module.exports = new AuctionService();
