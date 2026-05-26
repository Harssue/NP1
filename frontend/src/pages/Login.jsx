import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Trophy, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen animated-bg dot-grid flex items-center justify-center px-4 py-12">
      {/* Orbs */}
      <div
        className="hero-orb w-[400px] h-[400px] -top-20 -left-20 opacity-15"
        style={{ background: 'radial-gradient(circle, #f59e0b, transparent 70%)' }}
      />
      <div
        className="hero-orb w-[300px] h-[300px] -bottom-10 -right-10 opacity-10"
        style={{ background: 'radial-gradient(circle, #6d28d9, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-gold mb-4 animate-float">
            <Trophy size={32} className="text-ipl-gold" />
          </div>
          <h1 className="font-rajdhani font-bold text-4xl gold-text">IPL AUCTION</h1>
          <p className="text-white/40 font-inter text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8">
          <h2 className="font-rajdhani font-bold text-2xl text-white mb-6">Welcome back</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-white/50 text-xs font-inter mb-1.5 ml-1">
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="CricketFan2025"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white font-inter text-sm placeholder:text-white/20 focus:outline-none focus:border-ipl-gold/50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-white/50 text-xs font-inter mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white font-inter text-sm placeholder:text-white/20 focus:outline-none focus:border-ipl-gold/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 animate-slide-up">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm font-inter">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-ipl-gold text-black font-rajdhani font-bold text-lg rounded-xl hover:bg-ipl-gold-light transition-all duration-300 hover:scale-[1.02] glow-gold flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100 mt-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/20 text-xs font-inter">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Register link */}
          <p className="text-center text-white/40 font-inter text-sm">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-ipl-gold font-semibold hover:text-ipl-gold-light transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </div>

        {/* Back */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-white/30 font-inter text-sm hover:text-white/60 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
