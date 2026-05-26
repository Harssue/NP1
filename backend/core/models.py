from django.db import models
from django.contrib.auth.models import User
import random
import string


def generate_lobby_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ─── IPL Master Data ──────────────────────────────────────────────────────────

class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    shortName = models.CharField(max_length=10, default='')
    primaryColor = models.CharField(max_length=10, default='#f59e0b')

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=50)       # Batsman, Bowler, All-Rounder, Wicketkeeper
    basePrice = models.IntegerField()             # in Lakhs
    nationality = models.CharField(max_length=50) # Indian, Overseas

    def __str__(self):
        return self.name


# ─── Game / Lobby ─────────────────────────────────────────────────────────────

class Game(models.Model):
    STATUS_WAITING  = 'waiting'
    STATUS_AUCTION  = 'auction'
    STATUS_COMPLETE = 'completed'

    lobbyCode       = models.CharField(max_length=8, unique=True, default=generate_lobby_code)
    host            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hosted_games')
    status          = models.CharField(max_length=20, default=STATUS_WAITING)
    createdAt       = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Game {self.lobbyCode} ({self.status})"


class GameTeam(models.Model):
    game            = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='game_teams')
    user            = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    team            = models.ForeignKey(Team, on_delete=models.CASCADE)
    purseRemaining  = models.IntegerField(default=9000)  # 90 Crores in Lakhs
    squadSize       = models.IntegerField(default=0)
    isAI            = models.BooleanField(default=False)

    class Meta:
        unique_together = [('game', 'team'), ('game', 'user')]

    def __str__(self):
        ctrl = self.user.username if self.user else 'AI'
        return f"{self.team.shortName} ({ctrl}) in Game {self.game.lobbyCode}"


class GamePlayer(models.Model):
    STATUS_PENDING    = 'pending'
    STATUS_SOLD       = 'sold'
    STATUS_UNSOLD     = 'unsold'

    game        = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='game_players')
    player      = models.ForeignKey(Player, on_delete=models.CASCADE)
    status      = models.CharField(max_length=20, default=STATUS_PENDING)
    soldTo      = models.ForeignKey(GameTeam, on_delete=models.SET_NULL, null=True, blank=True, related_name='squad_entries')
    soldPrice   = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.player.name} in Game {self.game.lobbyCode}"


class GameAuctionState(models.Model):
    game                = models.OneToOneField(Game, on_delete=models.CASCADE, related_name='auction_state')
    currentNomination   = models.ForeignKey(GamePlayer, on_delete=models.SET_NULL, null=True, blank=True)
    currentBid          = models.IntegerField(default=0)
    highestBidder       = models.ForeignKey(GameTeam, on_delete=models.SET_NULL, null=True, blank=True)
    timerEnd            = models.DateTimeField(null=True, blank=True)
    round               = models.IntegerField(default=0)
    status              = models.CharField(max_length=20, default='idle')

    def __str__(self):
        return f"Auction state for Game {self.game.lobbyCode}"


# ─── Legacy models kept for admin ─────────────────────────────────────────────

class Auction(models.Model):
    status              = models.CharField(max_length=20, default='pending')
    currentNomination   = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True)
    currentBid          = models.IntegerField(default=0)
    highestBidder       = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)


class Match(models.Model):
    teamA       = models.ForeignKey(Team, related_name='matches_as_teamA', on_delete=models.CASCADE)
    teamB       = models.ForeignKey(Team, related_name='matches_as_teamB', on_delete=models.CASCADE)
    winner      = models.ForeignKey(Team, related_name='matches_won', on_delete=models.SET_NULL, null=True, blank=True)
    scorecard   = models.JSONField(default=dict)
    date        = models.DateTimeField(auto_now_add=True)
    status      = models.CharField(max_length=20, default='scheduled')
