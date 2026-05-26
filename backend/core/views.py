from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Team, Player, Game, GameTeam, GamePlayer, GameAuctionState
from .serializers import (
    TeamSerializer, PlayerSerializer, GameSerializer,
    GameTeamSerializer, GamePlayerSerializer, UserSerializer,
    GameAuctionStateSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken


# ─── AUTH ─────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email    = request.data.get('email', '')
    if not username or not password:
        return Response({'detail': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'detail': 'Username already taken.'}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=username, email=email, password=password)
    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
        'user':    UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_me(request):
    return Response({'user': UserSerializer(request.user).data})


# ─── GAME ─────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_game(request):
    """Create a new lobby. The creator becomes the host and is added as a GameTeam placeholder (no team chosen yet)."""
    game = Game.objects.create(host=request.user)
    return Response({
        'game': GameSerializer(game).data,
        'gameTeams': [],
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def join_game(request):
    """Join an existing lobby by lobbyCode."""
    code = request.data.get('lobbyCode', '').upper().strip()
    try:
        game = Game.objects.get(lobbyCode=code)
    except Game.DoesNotExist:
        return Response({'detail': 'Invalid lobby code.'}, status=status.HTTP_404_NOT_FOUND)

    if game.status != Game.STATUS_WAITING:
        return Response({'detail': 'Game has already started.'}, status=status.HTTP_400_BAD_REQUEST)

    # Count human slots already taken
    human_count = GameTeam.objects.filter(game=game, isAI=False).count()
    if human_count >= 10:
        return Response({'detail': 'Lobby is full.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if user is already in this game
    already = GameTeam.objects.filter(game=game, user=request.user).first()
    if already:
        game_teams = GameTeam.objects.filter(game=game).select_related('user', 'team')
        return Response({
            'game':      GameSerializer(game).data,
            'gameTeams': GameTeamSerializer(game_teams, many=True).data,
        })

    return Response({
        'game':      GameSerializer(game).data,
        'gameTeams': GameTeamSerializer(GameTeam.objects.filter(game=game).select_related('user','team'), many=True).data,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def game_state(request, game_id):
    """Return current game + all game teams."""
    try:
        game = Game.objects.get(pk=game_id)
    except Game.DoesNotExist:
        return Response({'detail': 'Game not found.'}, status=status.HTTP_404_NOT_FOUND)

    game_teams = GameTeam.objects.filter(game=game).select_related('user', 'team')
    return Response({
        'game':      GameSerializer(game).data,
        'gameTeams': GameTeamSerializer(game_teams, many=True).data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def start_game(request, game_id):
    """Host starts the auction. AI teams are created for every unselected IPL franchise."""
    try:
        game = Game.objects.get(pk=game_id)
    except Game.DoesNotExist:
        return Response({'detail': 'Game not found.'}, status=status.HTTP_404_NOT_FOUND)

    if game.host != request.user:
        return Response({'detail': 'Only the host can start the game.'}, status=status.HTTP_403_FORBIDDEN)

    if game.status != Game.STATUS_WAITING:
        return Response({'detail': 'Game already started.'}, status=status.HTTP_400_BAD_REQUEST)

    # Fill remaining IPL teams with AI
    taken_team_ids = set(GameTeam.objects.filter(game=game).values_list('team_id', flat=True))
    all_teams = Team.objects.all()
    for team in all_teams:
        if team.id not in taken_team_ids:
            GameTeam.objects.create(game=game, team=team, isAI=True)

    # Copy all players into GamePlayer pool
    players = list(Player.objects.all().order_by('?'))  # shuffle
    for p in players:
        GamePlayer.objects.get_or_create(game=game, player=p)

    # Create auction state
    GameAuctionState.objects.get_or_create(game=game)

    # Mark game as auction
    game.status = Game.STATUS_AUCTION
    game.save()

    game_teams = GameTeam.objects.filter(game=game).select_related('user', 'team')
    return Response({
        'game':      GameSerializer(game).data,
        'gameTeams': GameTeamSerializer(game_teams, many=True).data,
    })


# ─── TEAM SELECTION ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def select_team(request):
    """User picks their IPL franchise in the lobby."""
    game_id = request.data.get('gameId')
    team_id = request.data.get('teamId')

    try:
        game = Game.objects.get(pk=game_id)
        team = Team.objects.get(pk=team_id)
    except (Game.DoesNotExist, Team.DoesNotExist):
        return Response({'detail': 'Game or Team not found.'}, status=status.HTTP_404_NOT_FOUND)

    if game.status != Game.STATUS_WAITING:
        return Response({'detail': 'Game already started.'}, status=status.HTTP_400_BAD_REQUEST)

    # Release any team this user previously held
    GameTeam.objects.filter(game=game, user=request.user).delete()

    # Check if team is already taken by another user
    if GameTeam.objects.filter(game=game, team=team, isAI=False).exists():
        return Response({'detail': 'Team already taken.'}, status=status.HTTP_400_BAD_REQUEST)

    gt = GameTeam.objects.create(game=game, user=request.user, team=team, isAI=False)
    return Response({'gameTeam': GameTeamSerializer(gt).data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_squad(request, game_team_id):
    """Return the squad (sold players) for a specific GameTeam."""
    try:
        gt = GameTeam.objects.get(pk=game_team_id)
    except GameTeam.DoesNotExist:
        return Response({'detail': 'GameTeam not found.'}, status=status.HTTP_404_NOT_FOUND)

    squad = GamePlayer.objects.filter(soldTo=gt, status='sold').select_related('player')
    return Response({'squad': GamePlayerSerializer(squad, many=True).data})


# ─── AUCTION ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def auction_state(request, game_id):
    """Return current auction state for a game."""
    try:
        game  = Game.objects.get(pk=game_id)
        state = game.auction_state
    except Game.DoesNotExist:
        return Response({'detail': 'Game not found.'}, status=status.HTTP_404_NOT_FOUND)
    except GameAuctionState.DoesNotExist:
        return Response({'auction': None, 'gameTeams': []})

    game_teams = GameTeam.objects.filter(game=game).select_related('user', 'team')
    return Response({
        'auction':   GameAuctionStateSerializer(state).data,
        'gameTeams': GameTeamSerializer(game_teams, many=True).data,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def place_bid(request, game_id):
    """Place a bid for a player in the auction."""
    game_team_id = request.data.get('gameTeamId')
    amount       = request.data.get('amount', 0)

    try:
        game     = Game.objects.get(pk=game_id)
        state    = game.auction_state
        gt       = GameTeam.objects.get(pk=game_team_id, game=game)
    except (Game.DoesNotExist, GameAuctionState.DoesNotExist, GameTeam.DoesNotExist):
        return Response({'detail': 'Invalid game or team.'}, status=status.HTTP_404_NOT_FOUND)

    if state.status != 'bidding':
        return Response({'detail': 'Bidding not active.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount <= state.currentBid:
        return Response({'detail': 'Bid must be higher than current bid.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount > gt.purseRemaining:
        return Response({'detail': 'Insufficient purse.'}, status=status.HTTP_400_BAD_REQUEST)

    # Update state
    state.currentBid   = amount
    state.highestBidder = gt
    state.timerEnd     = timezone.now() + timezone.timedelta(seconds=10)
    state.save()

    return Response({'detail': 'Bid placed successfully.'})


# ─── MASTER DATA ──────────────────────────────────────────────────────────────

class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset         = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [permissions.AllowAny]


class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset         = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.AllowAny]
