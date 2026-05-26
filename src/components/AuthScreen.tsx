import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Sparkles, Building2, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';

interface AuthScreenProps {
  onSignUp: (email: string, pass: string) => Promise<any>;
  onSignIn: (email: string, pass: string) => Promise<any>;
  onPasscodeLogin: (email: string, pin: string) => Promise<any>;
  onGuestLogin?: () => void;
}

export function AuthScreen({ onSignUp, onSignIn, onPasscodeLogin, onGuestLogin }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<"passcode" | "classic-signin" | "classic-signup">("passcode");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (!email.includes('@')) {
        throw new Error("Please enter a valid email address.");
      }

      if (authMode === "passcode") {
        if (pin.length < 4) {
          throw new Error("Passcode must be at least 4 digits.");
        }
        await onPasscodeLogin(email, pin);
      } else if (authMode === "classic-signup") {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await onSignUp(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center p-4 text-white font-sans selection:bg-emerald-500/30 overflow-y-auto" id="auth-screen">
      
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-sky-500/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-md w-full bg-[#0d1527]/90 border border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 relative z-10 shadow-2xl backdrop-blur-md" id="auth-box">
        
        {/* Brand Header */}
        <div className="text-center space-y-2" id="auth-header">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-2 text-emerald-400" id="brand-badge">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight font-display bg-gradient-to-r from-white via-slate-100 to-emerald-400 bg-clip-text text-transparent">
            Barakah Bill Pro
          </h1>
          <p className="text-xs text-slate-400 font-mono tracking-wider uppercase">
            Intelligent Shop Point-of-Sale & Accounting Portal
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#050912] p-1 rounded-xl border border-slate-800/60" id="auth-tabs">
          <button 
            type="button"
            onClick={() => { setAuthMode("passcode"); setError(''); }} 
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${authMode === 'passcode' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            Passcode Cloud Sync
          </button>
          
          <button 
            type="button"
            onClick={() => { setAuthMode("classic-signin"); setError(''); }} 
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${authMode !== 'passcode' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Classic Account
          </button>
        </div>

        {/* Dynamic Mode Explanations */}
        <div className="bg-[#050912]/80 border border-slate-800/40 p-3.5 rounded-xl space-y-1 text-center" id="mode-tip">
          {authMode === "passcode" ? (
            <>
              <p className="text-[11px] text-emerald-400/90 font-medium font-sans">✨ Easy PIN Access</p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                Enter your email and 4-digit secret PIN. Your previous transactions, stock, and settings will automatically synchronize from cloud backup.
              </p>
            </>
          ) : authMode === "classic-signin" ? (
            <>
              <p className="text-[11px] text-sky-400/90 font-medium font-sans">🔐 Classic Account Sign In</p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                Enter your registered email address and password to log in to your shop portal.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] text-purple-400/90 font-medium font-sans">💼 Create a New Shop</p>
              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                Create your shop account today using any active email address. Unlimited product catalogs and POS invoice generation are fully free.
              </p>
            </>
          )}
        </div>

        {/* Main Authentication Form */}
        <form onSubmit={handleAction} className="space-y-4" id="auth-form">
          <div className="space-y-1.5" id="form-group-email">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pl-1">Gmail Address</label>
            <input 
              type="email" 
              required
              placeholder="example@gmail.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              disabled={loading}
              className="w-full px-4 py-3 bg-[#050912] border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 font-mono transition-colors" 
            />
          </div>

          {authMode === "passcode" ? (
            <div className="space-y-1.5" id="form-group-pin">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pl-1">4-Digit PIN Access</label>
              <input 
                type="password" 
                maxLength={4}
                required
                placeholder="••••" 
                value={pin} 
                onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ""))} 
                disabled={loading}
                className="w-full px-4 py-3 bg-[#050912] border border-slate-800 rounded-xl text-white text-center font-mono text-xl tracking-widest outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/20 transition-colors" 
              />
            </div>
          ) : (
            <div className="space-y-1.5 relative" id="form-group-password">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pl-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  placeholder="******" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  disabled={loading}
                  className="w-full px-4 py-3 pr-10 bg-[#050912] border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20 font-mono transition-colors" 
                />
                <button
                  type="button"
                  id="toggle-pass-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Action toggle for classic */}
          {authMode !== "passcode" && (
            <div className="text-right" id="auth-mode-toggle">
              <button 
                type="button"
                onClick={() => setAuthMode(authMode === "classic-signin" ? "classic-signup" : "classic-signin")}
                className="text-xs text-sky-400 hover:underline hover:text-sky-300 font-medium bg-none border-none cursor-pointer"
              >
                {authMode === "classic-signin" ? "Create a New Store Account" : "Already have an account? Sign In"}
              </button>
            </div>
          )}

          {/* Error Message Box */}
          {error && (
            <div className="flex items-start gap-2 text-rose-300 text-xs bg-rose-950/40 p-3 rounded-xl border border-rose-500/20 animate-shake" id="error-alert">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg cursor-pointer bg-emerald-500 text-[#070b13] hover:bg-emerald-400 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading Store...
              </>
            ) : authMode === "passcode" ? (
              "Load Shop & Cloud Sync"
            ) : authMode === "classic-signup" ? (
              "Register New Shop Account"
            ) : (
              "Login to Store Account"
            )}
          </button>
        </form>

        {onGuestLogin && (
          <div className="pt-1 text-center" id="guest-access-div">
            <button
              type="button"
              id="enter-as-guest-badge"
              onClick={onGuestLogin}
              className="text-xs text-slate-400 hover:text-white underline font-semibold cursor-pointer py-1.5 transition-colors"
            >
              Enter directly in Guest Mode &rarr;
            </button>
          </div>
        )}

        {/* Decorative offline indicator */}
        <div className="text-center pt-2 border-t border-slate-900/50" id="auth-footer">
          <p className="text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse" />
            100% Offline-Core Database Engine Active
          </p>
        </div>

      </div>
    </div>
  );
}
