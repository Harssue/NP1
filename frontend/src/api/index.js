const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : import.meta.env.PROD
  ? '/api'
  : 'http://localhost:5000/api';

function getHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || data.error || `HTTP error ${res.status}`);
  }
  return data;
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

export async function apiRegister({ username, email, password }) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, email, password }),
  });
  return handleResponse(res);
}

export async function apiLogin({ username, password }) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(res);
}

export async function apiGetMe(token) {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

// ─── GAME ─────────────────────────────────────────────────────────────────────

export async function apiCreateGame(userId, token) {
  const res = await fetch(`${BASE_URL}/game/create`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ userId }),
  });
  return handleResponse(res);
}

export async function apiJoinGame(lobbyCode, userId, token) {
  const res = await fetch(`${BASE_URL}/game/join`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ lobbyCode, userId }),
  });
  return handleResponse(res);
}

export async function apiGetGame(gameId, token) {
  const res = await fetch(`${BASE_URL}/game/${gameId}`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function apiStartGame(gameId, token) {
  const res = await fetch(`${BASE_URL}/game/${gameId}/start`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function apiGetGameState(gameId, token) {
  const res = await fetch(`${BASE_URL}/game/${gameId}/state`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

// ─── TEAMS ────────────────────────────────────────────────────────────────────

export async function apiGetTeams(token) {
  const res = await fetch(`${BASE_URL}/teams`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function apiSelectTeam(gameId, userId, teamId, token) {
  const res = await fetch(`${BASE_URL}/teams/select`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ gameId, userId, teamId }),
  });
  return handleResponse(res);
}

export async function apiGetSquad(gameTeamId, token) {
  const res = await fetch(`${BASE_URL}/teams/${gameTeamId}/squad`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

// ─── AUCTION ──────────────────────────────────────────────────────────────────

export async function apiGetAuctionState(gameId, token) {
  const res = await fetch(`${BASE_URL}/auction/${gameId}`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function apiPlaceBid(gameId, gameTeamId, amount, token) {
  const res = await fetch(`${BASE_URL}/auction/${gameId}/bid`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ gameTeamId, amount }),
  });
  return handleResponse(res);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function formatCrore(lakhs) {
  if (!lakhs && lakhs !== 0) return '₹0';
  const crore = lakhs / 100;
  if (crore >= 1) {
    const rounded = Math.round(crore * 100) / 100;
    return `₹${rounded % 1 === 0 ? rounded.toFixed(0) : rounded} Cr`;
  }
  return `₹${lakhs} L`;
}

export function formatRole(role) {
  const map = {
    'Batsman': '🏏 Batsman',
    'Bowler': '🎳 Bowler',
    'All-Rounder': '⚡ All-Rounder',
    'Wicketkeeper': '🧤 Wicketkeeper',
  };
  return map[role] || role;
}

export function getRoleColor(role) {
  const map = {
    'Batsman': '#3b82f6',
    'Bowler': '#22c55e',
    'All-Rounder': '#a855f7',
    'Wicketkeeper': '#f59e0b',
  };
  return map[role] || '#9ca3af';
}
