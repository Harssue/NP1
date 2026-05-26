from rest_framework import serializers
from .models import Team, Player, Game, GameTeam, GamePlayer, GameAuctionState, Auction, Match
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = '__all__'


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = '__all__'


class GameTeamSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = GameTeam
        fields = ('id', 'game', 'user', 'team', 'purseRemaining', 'squadSize', 'isAI')


class GamePlayerSerializer(serializers.ModelSerializer):
    player = PlayerSerializer(read_only=True)

    class Meta:
        model = GamePlayer
        fields = ('id', 'player', 'status', 'soldTo', 'soldPrice')


class GameSerializer(serializers.ModelSerializer):
    host = UserSerializer(read_only=True)

    class Meta:
        model = Game
        fields = ('id', 'lobbyCode', 'host', 'status', 'createdAt')


class GameAuctionStateSerializer(serializers.ModelSerializer):
    currentPlayer = serializers.SerializerMethodField()
    highestBidderGameTeamId = serializers.SerializerMethodField()

    class Meta:
        model = GameAuctionState
        fields = ('status', 'currentBid', 'timerEnd', 'round',
                  'currentPlayer', 'highestBidderGameTeamId')

    def get_currentPlayer(self, obj):
        if obj.currentNomination:
            return PlayerSerializer(obj.currentNomination.player).data
        return None

    def get_highestBidderGameTeamId(self, obj):
        return obj.highestBidder_id


class AuctionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Auction
        fields = '__all__'


class MatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Match
        fields = '__all__'
