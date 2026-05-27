import React, { useState } from "react";
import { ShieldCheck, UserCheck, Lock, ArrowRight, ShieldAlert } from "lucide-react";

interface PanelGateLockProps {
  adminPasscode: string;
  salesPasscode: string;
  onUnlock: (panel: "admin" | "sales") => void;
  onLogout: () => void;
  isGuest: boolean;
  isDarkMode?: boolean;
}

export function PanelGateLock({ 
  adminPasscode = "1234", 
  salesPasscode = "5555", 
  onUnlock, 
  onLogout,
  isGuest,
  isDarkMode = true
}: PanelGateLockProps) {
  const [selectedMode, setSelectedMode] = useState<"admin" | "sales">("admin");
  const [pin, setPin] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState("");

  const triggerVerification = (currentPin: string) => {
    const correctPin = selectedMode === "admin" ? adminPasscode : salesPasscode;
    if (currentPin === correctPin) {
      onUnlock(selectedMode);
    } else {
      setErrorMessage("Wrong Passcode! Please enter the correct PIN code.");
      setPin("");
    }
  };

  const handleKeyPress = (num: string) => {
    setErrorMessage("");
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Immediate, synchronous validation – extremely fast, zero lag!
        triggerVerification(nextPin);
      }
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
    triggerVerification(pin);
  };

  // Support standard keyboard entry for maximum fluidity and convenience!
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keys when focused on input/textarea (though here we don't have regular inputs on screen)
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        handleClear();
      } else if (e.key === "Enter") {
        if (pin.length === 4) {
          handleSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, selectedMode, adminPasscode, salesPasscode]);

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center p-2 sm:p-4 text-white font-sans selection:bg-emerald-500/30 overflow-hidden" id="panel-gate-lock">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-[#10b981]/15 rounded-full blur-[70px] pointer-events-none" />
      
      <div className="max-w-sm w-full bg-[#0d1527]/95 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 relative z-10 shadow-2xl backdrop-blur-md text-center" id="lock-wrapper">
        
        {/* Header */}
        <div id="lock-brand">
          <div className="inline-flex items-center justify-center p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-1.5 text-emerald-400">
            <Lock className="w-5 h-5 animate-pulse" />
          </div>
          <h2 className="text-xl font-black bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">
            Barakah Security Lock
          </h2>
          <p className="text-[10px] text-slate-400 font-mono tracking-wide mt-0.5">
            {isGuest ? "GUEST MODE SANDBOX ACTIVE" : "AUTHENTICATED STORE SESSION"}
          </p>
        </div>

        {/* Panel Selector Choice */}
        <div className="grid grid-cols-2 gap-2 bg-[#050912] p-1 rounded-xl border border-slate-800/50" id="mode-chooser">
          <button
            type="button"
            onClick={() => { setSelectedMode("admin"); handleClear(); }}
            className={`py-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${selectedMode === "admin" ? "bg-emerald-500 text-[#070b13] shadow" : "text-slate-400 hover:text-slate-200"}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Panel
          </button>

          <button
            type="button"
            onClick={() => { setSelectedMode("sales"); handleClear(); }}
            className={`py-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${selectedMode === "sales" ? "bg-emerald-500 text-[#070b13] shadow" : "text-slate-400 hover:text-slate-200"}`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Sales Panel
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-[#050912]/80 border border-slate-800/60 p-2 rounded-lg">
          <p className="text-[10px] text-emerald-400 font-bold mb-0.5">
            {selectedMode === "admin" ? "💼 Owner Security Key" : "🛒 Cashier Terminal PIN"}
          </p>
          <p className="text-[9px] text-slate-400 leading-normal font-sans">
            Enter your 4-digit passcode to unlock this panel.
          </p>
        </div>

        {/* Bullet Dots display */}
        <div className="flex justify-center gap-3 py-1" id="bullets-container">
          {[0, 1, 2, 3].map((val) => (
            <div 
              key={val} 
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-100 ${pin.length > val ? "bg-emerald-400 border-emerald-400 scale-110 shadow-sm shadow-emerald-400/20" : "border-slate-700 bg-transparent"}`}
            />
          ))}
        </div>

        {/* Dynamic error display */}
        {errorMessage && (
          <div className="flex items-center gap-1.5 justify-center text-[10px] text-rose-300 bg-rose-950/40 p-1.5 rounded-lg border border-rose-500/10" id="error-badge">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-450 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Keypad Grid block */}
        <div className="grid grid-cols-3 gap-1.5 mx-auto max-w-[240px] pt-0.5" id="numeric-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-1.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/20 rounded-lg font-mono text-base font-bold transition-all text-slate-200 active:scale-95 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/20 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="py-1.5 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/20 rounded-lg font-mono text-base font-bold transition-all text-slate-200 active:scale-95 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="py-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/20 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            Del
          </button>
        </div>

        <div className="space-y-2 pt-1" id="sumbit-lock-wrapper">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length < 4}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#070b13] font-bold text-xs rounded-lg uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
          >
            Unlock Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="text-[10px] text-slate-400 hover:text-rose-450 underline cursor-pointer inline-block mt-0.5"
          >
            Switch Account / Log Out
          </button>
        </div>

      </div>
    </div>
  );
}
