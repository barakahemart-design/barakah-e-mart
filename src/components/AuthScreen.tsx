import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Sparkles, Building2, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';

interface AuthScreenProps {
  onSignUp: (email: string, pass: string) => Promise<any>;
  onSignIn: (email: string, pass: string) => Promise<any>;
  onGuestLogin?: () => void;
  isDarkMode?: boolean;
}

export function AuthScreen({ onSignUp, onSignIn, onGuestLogin, isDarkMode = true }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<"classic-signin" | "classic-signup">("classic-signin");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const cleanEmail = email.trim();
      if (!cleanEmail.includes('@')) {
        throw new Error("Please enter a valid email address.");
      }

      if (authMode === "classic-signup") {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await onSignUp(cleanEmail, password);
      } else {
        await onSignIn(cleanEmail, password);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center p-2 sm:p-4 text-white font-sans selection:bg-emerald-500/30 overflow-hidden" id="auth-screen">
      
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-emerald-500/10 rounded-full blur-[70px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[250px] h-[250px] bg-sky-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-sm w-full bg-[#0d1527]/90 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 relative z-10 shadow-2xl backdrop-blur-md" id="auth-box">
        
        {/* Brand Header */}
        <div className="text-center space-y-1" id="auth-header">
          <div className="inline-flex items-center justify-center p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-1 text-emerald-400" id="brand-badge">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
            Barakah Bill Pro
          </h1>
          <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
            Point-of-Sale & Accounting Portal
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#050912] p-1 rounded-lg border border-slate-800/60" id="auth-tabs">
          <button 
            type="button"
            onClick={() => { setAuthMode("classic-signin"); setError(''); }} 
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all duration-150 ${authMode === 'classic-signin' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Login
          </button>
          
          <button 
            type="button"
            onClick={() => { setAuthMode("classic-signup"); setError(''); }} 
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all duration-150 ${authMode === 'classic-signup' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Signup
          </button>
        </div>

        {/* Dynamic Mode Explanations */}
        <div className="bg-[#050912]/80 border border-slate-800/40 p-2 rounded-lg space-y-0.5 text-center" id="mode-tip">
          {authMode === "classic-signin" ? (
            <>
              <p className="text-[10px] text-emerald-400/90 font-bold font-sans">🔐 Store Sign In</p>
              <p className="text-[9px] text-slate-400 leading-normal font-sans">
                Sign in to your store account. Cloud backup data will synchronize automatically.
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] text-emerald-400/90 font-bold font-sans">💼 Create a New Shop</p>
              <p className="text-[9px] text-slate-400 leading-normal font-sans">
                Register with your Gmail and a password to instantly set up your shop.
              </p>
            </>
          )}
        </div>

        {/* Main Authentication Form */}
        <form onSubmit={handleAction} className="space-y-3" id="auth-form">
          <div className="space-y-1" id="form-group-email">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 pl-0.5">Gmail Address</label>
            <input 
              type="email" 
              required
              placeholder="example@gmail.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              disabled={loading}
              className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-colors" 
            />
          </div>

          <div className="space-y-1 relative" id="form-group-password">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 pl-0.5">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="******" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                disabled={loading}
                className="w-full px-3 py-2 pr-9 bg-[#050912] border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-colors" 
              />
              <button
                type="button"
                id="toggle-pass-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Action toggle for classic */}
          <div className="text-right" id="auth-mode-toggle">
            <button 
              type="button"
              onClick={() => setAuthMode(authMode === "classic-signin" ? "classic-signup" : "classic-signin")}
              className="text-[10px] text-sky-400 hover:underline hover:text-sky-300 font-medium"
            >
              {authMode === "classic-signin" ? "Need a new account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

          {/* Error Message Box */}
          {error && (
            <div className="flex items-start gap-1.5 text-rose-300 text-[10px] bg-rose-950/40 p-2 rounded-lg border border-rose-500/10 animate-shake" id="error-alert">
              <AlertCircle className="w-3.5 h-3.5 text-rose-450 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg transition-all duration-200 shadow cursor-pointer bg-emerald-500 text-[#070b13] hover:bg-emerald-400 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Loading Store...
              </>
            ) : authMode === "classic-signup" ? (
              "Register New Shop"
            ) : (
              "Login to Store"
            )}
          </button>
        </form>

        {onGuestLogin && (
          <div className="text-center" id="guest-access-div">
            <button
              type="button"
              id="enter-as-guest-badge"
              onClick={onGuestLogin}
              className="text-[10px] text-slate-400 hover:text-white underline font-semibold py-0.5 transition-colors"
            >
              Enter directly in Guest Mode &rarr;
            </button>
          </div>
        )}

        {/* Decorative offline indicator */}
        <div className="text-center pt-1.5 border-t border-slate-900/50" id="auth-footer">
          <p className="text-[9px] text-slate-500 font-mono flex items-center justify-center gap-1">
            <span className="w-1 h-1 bg-emerald-500 rounded-full inline-block animate-pulse" />
            100% Offline-Core Database Engine Active
          </p>
        </div>

      </div>
    </div>
  );
}
