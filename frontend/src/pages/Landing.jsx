import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Trophy, Zap, Users, Crown, ArrowRight, Star, Globe, Shield } from 'lucide-react';
import { apiCreateGame, apiJoinGame } from '../api/index.js';

const FEATURES = [
  {
    icon: <Zap size={24} className="text-ipl-gold" />,
    title: 'Real-time Bidding',
    desc: 'Live auction with Socket.IO. Every bid is instant across all connected players.',
    color: '#f59e0b',
  },
  {
    icon: <Users size={24} className="text-ipl-pink" />,
    title: 'Multiplayer Lobbies',
    desc: 'Create or join a room with up to 10 teams. Share a lobby code with friends.',
    color: '#ec4899',
  },
  {
    icon: <Crown size={24} className="text-purple-400" />,
    title: 'All 10 IPL Teams',
    desc: 'Choose from CSK, MI, RCB, KKR and all your favorite franchises.',
    color: '#a855f7',
  },
  {
    icon: <Globe size={24} className="text-blue-400" />,
    title: 'Complete Squad',
    desc: 'Build a balanced squad with batsmen, bowlers, all-rounders and keepers.',
    color: '#3b82f6',
  },
];

const IPL_TEAMS = [
  { short: 'CSK', color: '#f9c000' },
  { short: 'MI', color: '#004B8D' },
  { short: 'RCB', color: '#C8102E' },
  { short: 'KKR', color: '#3A225D' },
  { short: 'RR', color: '#EA1A8E' },
  { short: 'DC', color: '#17479E' },
  { short: 'PBKS', color: '#ED1B24' },
  { short: 'SRH', color: '#F7A721' },
  { short: 'LSG', color: '#C0D62B' },
  { short: 'GT', color: '#1C2B59' },
];

export default function Landing() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [lobbyCode, setLobbyCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!user) return navigate('/login');
    setCreating(true);
    setError('');
    try {
      const data = await apiCreateGame(user.id || user._id, token);
      navigate(`/lobby/${data.game.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return navigate('/login');
    if (!lobbyCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const data = await apiJoinGame(lobbyCode.trim().toUpperCase(), user.id || user._id, token);
      navigate(`/lobby/${data.game.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg dot-grid overflow-hidden">
      {/* Orbs */}
      <div
        className="hero-orb w-[600px] h-[600px] -top-48 -left-48 opacity-20"
        style={{ background: 'radial-gradient(circle, #f59e0b, transparent 70%)' }}
      />
      <div
        className="hero-orb w-[400px] h-[400px] top-1/3 -right-32 opacity-15"
        style={{ background: 'radial-gradient(circle, #6d28d9, transparent 70%)' }}
      />
      <div
        className="hero-orb w-[300px] h-[300px] bottom-20 left-1/4 opacity-10"
        style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)' }}
      />

      {/* Navbar */}
      <nav className="relative z-10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Trophy size={32} className="text-ipl-gold animate-float" />
          <span className="font-rajdhani font-bold text-2xl gold-text tracking-wider">
            IPL AUCTION
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-white/60 font-inter text-sm hidden sm:block">
                Welcome, <span className="text-ipl-gold font-semibold">{user.username}</span>
              </span>
              <button
                onClick={handleCreate}
                className="px-5 py-2 bg-ipl-gold text-black font-rajdhani font-bold rounded-full hover:bg-ipl-gold-light transition-all duration-300 hover:scale-105 glow-gold text-sm"
              >
                Create Game
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 glass font-rajdhani font-semibold text-sm text-white/80 hover:text-white rounded-full transition-all duration-300"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-5 py-2 bg-ipl-gold text-black font-rajdhani font-bold rounded-full hover:bg-ipl-gold-light transition-all duration-300 hover:scale-105 glow-gold text-sm"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-16 pb-20 px-6 text-center max-w-5xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full mb-8 animate-fade-in">
          <Star size={12} className="text-ipl-gold" />
          <span className="font-rajdhani text-sm text-white/70 tracking-wider">
            TATA IPL 2025 • LIVE AUCTION SIMULATOR
          </span>
          <Star size={12} className="text-ipl-gold" />
        </div>

        <h1 className="font-rajdhani font-bold text-6xl md:text-8xl leading-none mb-6 animate-slide-up">
          <span className="text-white">BUILD YOUR</span>
          <br />
          <span className="gold-text animate-glow">DREAM XI</span>
        </h1>

        <p className="font-inter text-lg md:text-xl text-white/50 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in">
          Experience the thrill of an IPL mega auction. Create a room, invite friends,
          pick your franchise and battle it out to sign the best players.
        </p>

        {/* Team badges orbit */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {IPL_TEAMS.map((team) => (
            <div
              key={team.short}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-rajdhani font-bold text-xs transition-all duration-300 hover:scale-125 cursor-default"
              style={{
                background: `${team.color}22`,
                border: `1px solid ${team.color}66`,
                color: team.color,
                boxShadow: `0 0 10px ${team.color}22`,
              }}
            >
              {team.short}
            </div>
          ))}
        </div>

        {/* Action cards */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
          {/* Create game */}
          <div className="glass-gold rounded-2xl p-6 text-left hover:scale-[1.02] transition-all duration-300 glow-gold">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={20} className="text-ipl-gold" />
              <h3 className="font-rajdhani font-bold text-lg text-white">Create Lobby</h3>
            </div>
            <p className="text-white/50 text-sm font-inter mb-4">
              Start a new auction room as the host. Invite others with a code.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3 bg-ipl-gold text-black font-rajdhani font-bold rounded-xl hover:bg-ipl-gold-light transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? (
                <span className="animate-spin">⚡</span>
              ) : (
                <>
                  {user ? 'Create Game' : 'Login to Create'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Join game */}
          <div className="glass rounded-2xl p-6 text-left hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center gap-2 mb-3">
              <Users size={20} className="text-ipl-pink" />
              <h3 className="font-rajdhani font-bold text-lg text-white">Join Lobby</h3>
            </div>
            <p className="text-white/50 text-sm font-inter mb-4">
              Enter a 6-character code from your host to join their auction room.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="LOBBY CODE"
                maxLength={8}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-rajdhani font-bold tracking-widest text-sm placeholder:text-white/20 focus:outline-none focus:border-ipl-gold/50 transition-colors"
              />
              <button
                onClick={handleJoin}
                disabled={joining}
                className="px-4 py-2.5 bg-ipl-pink/20 border border-ipl-pink/40 text-ipl-pink font-rajdhani font-bold rounded-xl hover:bg-ipl-pink/30 transition-all duration-300 disabled:opacity-60"
              >
                {joining ? '...' : 'Join'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 glass rounded-xl px-4 py-3 text-red-400 text-sm font-inter animate-slide-up max-w-xl mx-auto">
            ⚠️ {error}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        <h2 className="font-rajdhani font-bold text-4xl text-center mb-2">
          <span className="gold-text">HOW IT WORKS</span>
        </h2>
        <p className="text-white/40 text-center font-inter mb-12">
          Everything you need for an epic IPL auction experience
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-6 hover:scale-[1.03] transition-all duration-300 group"
              style={{
                borderColor: `${f.color}22`,
                '--hover-glow': `0 0 30px ${f.color}22`,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
                style={{ background: `${f.color}15`, border: `1px solid ${f.color}33` }}
              >
                {f.icon}
              </div>
              <h3 className="font-rajdhani font-bold text-lg text-white mb-2">{f.title}</h3>
              <p className="text-white/40 font-inter text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative z-10 py-20 px-6 text-center">
        <div className="glass-gold max-w-2xl mx-auto rounded-3xl p-10">
          <Trophy size={48} className="text-ipl-gold mx-auto mb-4 animate-float" />
          <h2 className="font-rajdhani font-bold text-4xl text-white mb-3">
            Ready to bid?
          </h2>
          <p className="text-white/50 font-inter mb-6">
            Join thousands of fans in the ultimate IPL auction experience
          </p>
          {user ? (
            <button
              onClick={handleCreate}
              className="px-8 py-4 bg-ipl-gold text-black font-rajdhani font-bold text-xl rounded-full hover:bg-ipl-gold-light transition-all duration-300 hover:scale-105 glow-gold-strong"
            >
              Start Your Auction →
            </button>
          ) : (
            <Link
              to="/register"
              className="inline-block px-8 py-4 bg-ipl-gold text-black font-rajdhani font-bold text-xl rounded-full hover:bg-ipl-gold-light transition-all duration-300 hover:scale-105 glow-gold-strong"
            >
              Get Started Free →
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center border-t border-white/5">
        <p className="text-white/20 font-inter text-sm">
          © 2025 IPL Auction Room • Built with React + Socket.IO
        </p>
      </footer>
    </div>
  );
}
