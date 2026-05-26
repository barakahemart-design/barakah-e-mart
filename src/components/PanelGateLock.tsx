import React, { useState } from "react";
import { ShieldCheck, UserCheck, Lock, ArrowRight, ShieldAlert } from "lucide-react";

interface PanelGateLockProps {
  adminPasscode: string;
  salesPasscode: string;
  onUnlock: (panel: "admin" | "sales") => void;
  onLogout: () => void;
  isGuest: boolean;
}

export function PanelGateLock({ 
  adminPasscode = "1234", 
  salesPasscode = "5555", 
  onUnlock, 
  onLogout,
  isGuest
}: PanelGateLockProps) {
  const [selectedMode, setSelectedMode] = useState<"admin" | "sales">("admin");
  const [pin, setPin] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleKeyPress = (num: string) => {
    setErrorMessage("");
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
    setErrorMessage("");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = selectedMode === "admin" ? adminPasscode : salesPasscode;
    
    if (pin === correctPin) {
      onUnlock(selectedMode);
    } else {
      setErrorMessage("Wrong Passcode! Please enter the correct PIN code.");
      setPin("");
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center p-4 text-white font-sans selection:bg-emerald-500/30" id="panel-gate-lock">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#10b981]/15 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="max-w-md w-full bg-[#0d1527]/95 border border-slate-800/80 rounded-3xl p-6 md:p-8 space-y-6 relative z-10 shadow-2xl backdrop-blur-md text-center" id="lock-wrapper">
        
        {/* Header */}
        <div id="lock-brand">
          <div className="inline-flex items-center justify-center p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-3 text-emerald-400">
            <Lock className="w-7 h-7 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">
            Barakah Security Lock
          </h2>
          <p className="text-xs text-slate-400 font-mono tracking-wide mt-1">
            {isGuest ? "GUEST MODE SANDBOX ACTIVE" : "AUTHENTICATED STORE SESSION"}
          </p>
        </div>

        {/* Panel Selector Choice */}
        <div className="grid grid-cols-2 gap-3 bg-[#050912] p-1.5 rounded-2xl border border-slate-800/50" id="mode-chooser">
          <button
            type="button"
            onClick={() => { setSelectedMode("admin"); handleClear(); }}
            className={`py-3.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${selectedMode === "admin" ? "bg-emerald-500 text-[#070b13] shadow-lg scale-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Panel
          </button>

          <button
            type="button"
            onClick={() => { setSelectedMode("sales"); handleClear(); }}
            className={`py-3.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${selectedMode === "sales" ? "bg-emerald-500 text-[#070b13] shadow-lg scale-100" : "text-slate-400 hover:text-slate-200"}`}
          >
            <UserCheck className="w-4 h-4" />
            Sales Panel
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-[#050912]/80 border border-slate-800/60 p-3 rounded-xl">
          <p className="text-[11px] text-emerald-400 font-semibold mb-0.5">
            {selectedMode === "admin" ? "💼 Admin Account Security Key" : "🛒 Salesman POS Terminal Password"}
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
            To maintain business security, please enter your 4-digit passcode to unlock the dashboard.
          </p>
        </div>

        {/* Bullet Dots display */}
        <div className="flex justify-center gap-4 py-2" id="bullets-container">
          {[0, 1, 2, 3].map((val) => (
            <div 
              key={val} 
              className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-100 ${pin.length > val ? "bg-emerald-400 border-emerald-400 scale-110 shadow-md shadow-emerald-400/20" : "border-slate-700 bg-transparent"}`}
            />
          ))}
        </div>

        {/* Dynamic error display */}
        {errorMessage && (
          <div className="flex items-center gap-2 justify-center text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/20" id="error-badge">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Keypad Grid block */}
        <div className="grid grid-cols-3 gap-2 mx-auto max-w-xs pt-1" id="numeric-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/30 rounded-xl font-mono text-lg font-bold transition-all text-slate-200 active:scale-95 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/30 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="py-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/30 rounded-xl font-mono text-lg font-bold transition-all text-slate-200 active:scale-95 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="py-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/30 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            Del
          </button>
        </div>

        <div className="space-y-4 pt-2" id="sumbit-lock-wrapper">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length < 4}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#070b13] font-bold text-xs rounded-xl uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer"
          >
            Enter Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Passcode hint removed for security */}

          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-rose-400 underline cursor-pointer"
          >
            Switch User Account / Log Out
          </button>
        </div>

      </div>
    </div>
  );
}
