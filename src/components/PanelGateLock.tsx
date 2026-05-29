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
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    triggerVerification(pin);
  };

  // Focus input on load
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#06080e] flex flex-col justify-center items-center p-2 sm:p-4 text-slate-800 dark:text-white font-sans overflow-hidden" id="panel-gate-lock">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-blue-500/5 dark:bg-[#3b82f6]/5 rounded-full blur-[70px] pointer-events-none" />
      
      <div className="max-w-sm w-full bg-white dark:bg-[#0f121d] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 relative z-10 shadow-xl dark:shadow-2xl backdrop-blur-md text-center" id="lock-wrapper">
        
        {/* Header */}
        <div id="lock-brand">
          <div className="inline-flex items-center justify-center p-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl mb-2 text-blue-600 dark:text-blue-400">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Barakah Security Lock
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-1">
            {isGuest ? "GUEST MODE SANDBOX ACTIVE" : "AUTHENTICATED STORE SESSION"}
          </p>
        </div>

        {/* Panel Selector Choice */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/50" id="mode-chooser">
          <button
            type="button"
            onClick={() => { setSelectedMode("admin"); handleClear(); }}
            className={`py-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              selectedMode === "admin" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/15" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Panel
          </button>

          <button
            type="button"
            onClick={() => { setSelectedMode("sales"); handleClear(); }}
            className={`py-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              selectedMode === "sales" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/15" 
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Sales Panel
          </button>
        </div>

        {/* Master Input Wrapper for Keyboard / Soft Keyboard focus */}
        <div 
          className="relative bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 p-4 rounded-xl cursor-text group hover:border-blue-400 dark:hover:border-blue-500 transition-all select-none"
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            type="tel"
            pattern="[0-9]*"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(val);
              setErrorMessage("");
              if (val.length === 4) {
                triggerVerification(val);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-text pointer-events-auto z-20"
            autoFocus
          />

          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mb-0.5 pointer-events-none">
            {selectedMode === "admin" ? "💼 Owner Security Key" : "🛒 Cashier Terminal PIN"}
          </p>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-normal font-sans pointer-events-none">
            Tap here to type of open virtual keyboard on phone.
          </p>

          {/* Bullet Dots display */}
          <div className="flex justify-center gap-3 py-1.5 mt-3 pointer-events-none" id="bullets-container">
            {[0, 1, 2, 3].map((val) => (
              <div 
                 key={val} 
                 className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-100 ${
                   pin.length > val 
                     ? "bg-blue-600 border-blue-600 scale-110 shadow-sm shadow-blue-500/30" 
                     : "border-slate-300 dark:border-slate-700 bg-transparent"
                 }`}
              />
            ))}
          </div>
        </div>

        {/* Dynamic error display */}
        {errorMessage && (
          <div className="flex items-center gap-1.5 justify-center text-[10px] text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-500/10" id="error-badge">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Keypad Grid block */}
        <div className="grid grid-cols-3 gap-2 mx-auto max-w-[240px] pt-1" id="numeric-keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="py-2.5 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/20 rounded-xl font-bold text-base transition-all text-slate-805 dark:text-slate-200 active:scale-95 cursor-pointer shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="py-2.5 bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/20 rounded-xl text-[10px] font-bold text-slate-605 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            className="py-2.5 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800/20 rounded-xl font-bold text-base transition-all text-slate-805 dark:text-slate-200 active:scale-95 cursor-pointer shadow-sm"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="py-2.5 bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/20 rounded-xl text-[10px] font-bold text-slate-605 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all active:scale-95 cursor-pointer"
          >
            Del
          </button>
        </div>

        <div className="space-y-3 pt-2" id="sumbit-lock-wrapper">
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length < 4}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/15 cursor-pointer"
          >
            Unlock Dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:underline cursor-pointer inline-block mt-1 font-medium"
          >
            Switch Account / Log Out
          </button>
        </div>

      </div>
    </div>
  );
}
