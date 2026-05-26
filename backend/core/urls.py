from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()
router.register(r'teams',   views.TeamViewSet)
router.register(r'players', views.PlayerViewSet)

urlpatterns = [
    # ── Master data ──────────────────────────────────────────────────────────
    path('', include(router.urls)),

    # ── Auth ─────────────────────────────────────────────────────────────────
    path('auth/register/', views.register,               name='register'),
    path('auth/login/',    TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/',  TokenRefreshView.as_view(),    name='token_refresh'),
    path('auth/me/',       views.get_me,                  name='get_me'),

    # ── Game / Lobby ──────────────────────────────────────────────────────────
    path('game/create/',           views.create_game,  name='create_game'),
    path('game/join/',             views.join_game,    name='join_game'),
    path('game/<int:game_id>/state/', views.game_state,  name='game_state'),
    path('game/<int:game_id>/start/', views.start_game,  name='start_game'),

    # ── Team selection & squad ────────────────────────────────────────────────
    path('teams/select/',                    views.select_team, name='select_team'),
    path('teams/<int:game_team_id>/squad/',  views.get_squad,   name='get_squad'),

    # ── Auction ───────────────────────────────────────────────────────────────
    path('auction/<int:game_id>/',       views.auction_state, name='auction_state'),
    path('auction/<int:game_id>/bid/',   views.place_bid,     name='place_bid'),
]
