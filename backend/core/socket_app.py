"""
socket_app.py — Real-time auction engine with AI bidding.

Room naming: every game gets its own Socket.IO room = f"game_{game_id}"

Events emitted by server:
  lobby-state        → { game, gameTeams }
  team-selected      → { gameTeam }
  auction-started    → { teamStates }
  auction-resumed    → { status, currentPlayer, currentBid, highestBidder, timerEnd, round, teamStates }
  player-nominated   → { player, currentBid, timerEnd, round, remainingPlayers }
  bid-placed         → { gameTeamId, teamName, teamColor, amount, timerEnd, isAI }
  player-sold        → { player, soldTo, soldPrice, teamPurse, teamSquadSize }
  player-unsold      → { player }
  auction-complete   → { gameTeams }
  timer-tick         → { seconds }  (every second while bidding)

Events received from clients:
  join-lobby         → { gameId, userId }
  place-bid          → { gameId, gameTeamId, amount }
"""

import asyncio
import random
import socketio
from asgiref.sync import sync_to_async
from django.utils import timezone
from datetime import timedelta

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Track active auction loops per game: game_id → asyncio.Task
_auction_tasks: dict[int, asyncio.Task] = {}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _room(game_id):
    return f"game_{game_id}"


@sync_to_async
def _get_game_teams_data(game_id):
    from core.models import GameTeam
    from core.serializers import GameTeamSerializer
    gts = GameTeam.objects.filter(game_id=game_id).select_related('user', 'team')
    return GameTeamSerializer(gts, many=True).data


@sync_to_async
def _get_game_data(game_id):
    from core.models import Game
    from core.serializers import GameSerializer
    try:
        game = Game.objects.get(pk=game_id)
        return GameSerializer(game).data
    except Game.DoesNotExist:
        return None


@sync_to_async
def _get_pending_player(game_id):
    """Pick the next pending player at random."""
    from core.models import GamePlayer
    pending = list(GamePlayer.objects.filter(game_id=game_id, status='pending').select_related('player'))
    if not pending:
        return None
    return random.choice(pending)


@sync_to_async
def _get_auction_state(game_id):
    from core.models import GameAuctionState
    try:
        return GameAuctionState.objects.select_related('currentNomination__player', 'highestBidder__team').get(game_id=game_id)
    except GameAuctionState.DoesNotExist:
        return None


@sync_to_async
def _set_nomination(game_id, game_player_id, base_price):
    from core.models import GameAuctionState
    timer_end = timezone.now() + timedelta(seconds=15)
    state = GameAuctionState.objects.get(game_id=game_id)
    state.currentNomination_id = game_player_id
    state.currentBid           = base_price
    state.highestBidder        = None
    state.timerEnd             = timer_end
    state.status               = 'bidding'
    state.round               += 1
    state.save()
    return timer_end, state.round


@sync_to_async
def _count_pending(game_id):
    from core.models import GamePlayer
    return GamePlayer.objects.filter(game_id=game_id, status='pending').count()


@sync_to_async
def _mark_sold(game_id, game_player_id, game_team_id, price):
    from core.models import GamePlayer, GameTeam, GameAuctionState
    gp = GamePlayer.objects.select_related('player').get(pk=game_player_id)
    gp.status    = 'sold'
    gp.soldTo_id = game_team_id
    gp.soldPrice = price
    gp.save()

    gt = GameTeam.objects.select_related('team').get(pk=game_team_id)
    gt.purseRemaining -= price
    gt.squadSize      += 1
    gt.save()

    state = GameAuctionState.objects.get(game_id=game_id)
    state.status = 'sold'
    state.save()

    from core.serializers import PlayerSerializer, GameTeamSerializer
    return {
        'player':       PlayerSerializer(gp.player).data,
        'soldTo':       GameTeamSerializer(gt).data,
        'soldPrice':    price,
        'teamPurse':    gt.purseRemaining,
        'teamSquadSize': gt.squadSize,
    }


@sync_to_async
def _mark_unsold(game_id, game_player_id):
    from core.models import GamePlayer, GameAuctionState
    gp = GamePlayer.objects.select_related('player').get(pk=game_player_id)
    gp.status = 'unsold'
    gp.save()

    state = GameAuctionState.objects.get(game_id=game_id)
    state.status = 'unsold'
    state.save()

    from core.serializers import PlayerSerializer
    return PlayerSerializer(gp.player).data


@sync_to_async
def _complete_auction(game_id):
    from core.models import Game, GameAuctionState, GameTeam
    from core.serializers import GameTeamSerializer
    Game.objects.filter(pk=game_id).update(status='completed')
    GameAuctionState.objects.filter(game_id=game_id).update(status='complete')
    gts = GameTeam.objects.filter(game_id=game_id).select_related('user', 'team')
    return GameTeamSerializer(gts, many=True).data


@sync_to_async
def _get_ai_teams_that_can_bid(game_id, current_bid, current_nomination_id):
    """Return AI GameTeams that have enough purse and might want this player."""
    from core.models import GameTeam, GameAuctionState
    try:
        state = GameAuctionState.objects.get(game_id=game_id)
        if state.highestBidder and state.highestBidder.isAI:
            # Already highest — don't outbid ourselves unless another team wants
            pass
    except GameAuctionState.DoesNotExist:
        return []
    # AI teams with sufficient purse (leave at least 20L buffer)
    ai_teams = list(
        GameTeam.objects.filter(game_id=game_id, isAI=True, purseRemaining__gt=current_bid + 5)
        .exclude(id=state.highestBidder_id)  # don't outbid yourself
        .select_related('team')
    )
    return ai_teams


@sync_to_async
def _apply_ai_bid(game_id, game_team_id, amount):
    from core.models import GameAuctionState, GameTeam
    from core.serializers import GameTeamSerializer
    state = GameAuctionState.objects.get(game_id=game_id)
    if amount <= state.currentBid:
        return None
    state.currentBid    = amount
    state.highestBidder_id = game_team_id
    state.timerEnd      = timezone.now() + timedelta(seconds=10)
    state.save()
    gt = GameTeam.objects.select_related('team').get(pk=game_team_id)
    return {
        'gameTeamId': game_team_id,
        'teamName':   gt.team.name,
        'teamColor':  gt.team.primaryColor,
        'amount':     amount,
        'timerEnd':   state.timerEnd.isoformat(),
        'isAI':       True,
    }


@sync_to_async
def _read_state_for_timer(game_id):
    from core.models import GameAuctionState
    try:
        s = GameAuctionState.objects.select_related('currentNomination', 'highestBidder').get(game_id=game_id)
        return {
            'timerEnd':          s.timerEnd,
            'highestBidder_id':  s.highestBidder_id,
            'highestBidder_isAI': s.highestBidder.isAI if s.highestBidder else False,
            'currentBid':        s.currentBid,
            'currentNomination_id': s.currentNomination_id,
            'status':            s.status,
        }
    except GameAuctionState.DoesNotExist:
        return None


# ─── Auction Loop ─────────────────────────────────────────────────────────────

async def _run_auction(game_id: int):
    """Main auction coroutine. Nominates players one by one, runs bidding, handles AI."""
    room = _room(game_id)
    await asyncio.sleep(2)  # brief pause after start

    while True:
        game_player = await _get_pending_player(game_id)
        if not game_player:
            # All players auctioned
            gt_data = await _complete_auction(game_id)
            await sio.emit('auction-complete', {'gameTeams': list(gt_data)}, room=room)
            break

        # Nominate player
        remaining = await _count_pending(game_id)
        player_data = {
            'id':          game_player.player_id,
            'name':        game_player.player.name,
            'role':        game_player.player.role,
            'basePrice':   game_player.player.basePrice,
            'nationality': game_player.player.nationality,
        }
        timer_end, round_num = await _set_nomination(game_id, game_player.id, game_player.player.basePrice)

        await sio.emit('player-nominated', {
            'player':           player_data,
            'currentBid':       game_player.player.basePrice,
            'timerEnd':         timer_end.isoformat(),
            'round':            round_num,
            'remainingPlayers': remaining - 1,
        }, room=room)

        # ── Bidding window ──
        # AI bids happen randomly during this window
        bid_open = True
        while bid_open:
            s = await _read_state_for_timer(game_id)
            if not s or not s['timerEnd']:
                break

            now = timezone.now()
            remaining_secs = (s['timerEnd'] - now).total_seconds()

            if remaining_secs <= 0:
                bid_open = False
                break

            # AI bidding: random chance each second for an AI team to bid
            if random.random() < 0.40:  # 40% chance per second an AI tries
                ai_teams = await _get_ai_teams_that_can_bid(game_id, s['currentBid'], s['currentNomination_id'])
                if ai_teams:
                    chosen_ai = random.choice(ai_teams)
                    # AI bids a random increment: 5L, 10L, or 25L
                    increment = random.choice([5, 10, 25])
                    ai_amount = s['currentBid'] + increment
                    if ai_amount <= chosen_ai.purseRemaining:
                        bid_data = await _apply_ai_bid(game_id, chosen_ai.id, ai_amount)
                        if bid_data:
                            await sio.emit('bid-placed', bid_data, room=room)

            await asyncio.sleep(1)

        # ── Hammer falls ──
        final = await _read_state_for_timer(game_id)
        if final and final['highestBidder_id']:
            sold_data = await _mark_sold(
                game_id,
                game_player.id,
                final['highestBidder_id'],
                final['currentBid'],
            )
            await sio.emit('player-sold', sold_data, room=room)
        else:
            unsold_data = await _mark_unsold(game_id, game_player.id)
            await sio.emit('player-unsold', {'player': unsold_data}, room=room)

        # Pause between players
        await asyncio.sleep(4)


# ─── Socket Events ────────────────────────────────────────────────────────────

@sio.event
async def connect(sid, environ, auth):
    print(f'[Socket] Client connected: {sid}')


@sio.event
async def disconnect(sid):
    print(f'[Socket] Client disconnected: {sid}')


@sio.event
async def join_lobby(sid, data):
    """Client joins a game room and receives current state."""
    game_id = data.get('gameId')
    if not game_id:
        return
    room = _room(game_id)
    await sio.enter_room(sid, room)

    game_data  = await _get_game_data(game_id)
    teams_data = await _get_game_teams_data(game_id)
    await sio.emit('lobby-state', {
        'game':      game_data,
        'gameTeams': list(teams_data),
    }, to=sid)


@sio.event
async def team_selected(sid, data):
    """Broadcast to room that a team was selected."""
    game_id = data.get('gameId')
    if not game_id:
        return
    teams_data = await _get_game_teams_data(game_id)
    await sio.emit('lobby-state', {
        'gameTeams': list(teams_data),
    }, room=_room(game_id))


@sio.event
async def start_auction(sid, data):
    """Called by host after REST /game/<id>/start/ succeeds — kicks off the auction loop."""
    game_id = data.get('gameId')
    if not game_id:
        return

    teams_data = await _get_game_teams_data(game_id)
    team_states = [
        {'id': gt['id'], 'purseRemaining': gt['purseRemaining'], 'squadSize': gt['squadSize'], 'isAI': gt['isAI']}
        for gt in teams_data
    ]
    await sio.emit('auction-started', {'teamStates': team_states}, room=_room(game_id))

    # Cancel any existing loop for this game
    if game_id in _auction_tasks and not _auction_tasks[game_id].done():
        _auction_tasks[game_id].cancel()

    _auction_tasks[game_id] = asyncio.create_task(_run_auction(game_id))


@sio.event
async def place_bid(sid, data):
    """A human player places a bid via socket (after the REST call succeeds)."""
    game_id     = data.get('gameId')
    game_team_id = data.get('gameTeamId')
    amount      = data.get('amount', 0)

    if not game_id or not game_team_id:
        return

    @sync_to_async
    def _read_bid_broadcast(game_id, game_team_id):
        from core.models import GameAuctionState, GameTeam
        try:
            state = GameAuctionState.objects.get(game_id=game_id)
            gt    = GameTeam.objects.select_related('team').get(pk=game_team_id)
            return {
                'gameTeamId': game_team_id,
                'teamName':   gt.team.name,
                'teamColor':  gt.team.primaryColor,
                'amount':     state.currentBid,
                'timerEnd':   state.timerEnd.isoformat() if state.timerEnd else None,
                'isAI':       False,
            }
        except Exception:
            return None

    bid_data = await _read_bid_broadcast(game_id, game_team_id)
    if bid_data:
        await sio.emit('bid-placed', bid_data, room=_room(game_id))
