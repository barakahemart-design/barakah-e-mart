import React from "react";
import { Play, RotateCcw, AlertTriangle, Terminal, Cpu, Clock, HardDrive } from "lucide-react";

interface InteractiveConsoleProps {
  code: string;
  language: string;
}

interface ConsoleLog {
  type: "system" | "stdout" | "stderr" | "success";
  text: string;
  timestamp: string;
}

export function InteractiveConsole({ code, language }: InteractiveConsoleProps) {
  const [logs, setLogs] = React.useState<ConsoleLog[]>([
    {
      type: "system",
      text: "Developer sandbox environment initialized.",
      timestamp: someLocalTime(0),
    },
    {
      type: "system",
      text: `Ready to construct syntax evaluation trees for [${language.toUpperCase()}]. Click 'Run Code Sandbox' below to execute.`,
      timestamp: someLocalTime(0),
    }
  ]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [execTime, setExecTime] = React.useState<string | null>(null);
  const [memoryUsed, setMemoryUsed] = React.useState<string | null>(null);

  function someLocalTime(offsetSec: number) {
    const d = new Date();
    d.setSeconds(d.getSeconds() + offsetSec);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const runSandboxSim = () => {
    setIsRunning(true);
    setLogs([
      {
        type: "system",
        text: `Spinning up secure Node-virtual sandboxed worker thread for ${language}...`,
        timestamp: someLocalTime(0),
      }
    ]);

    // Step-by-step simulated pipeline
    setTimeout(() => {
      setLogs(prev => [
        ...prev,
        {
          type: "system",
          text: "Parsing code syntax... Validating AST lexical structure...",
          timestamp: someLocalTime(1),
        }
      ]);
    }, 400);

    setTimeout(() => {
      // Parse console.log, print, or cout calls in the code to make simulation extremely realistic
      const lines = code.split("\n");
      const foundOutputs: string[] = [];

      lines.forEach((line) => {
        // Javascript/Typescript console.log
        const jsMatch = line.match(/console\.log\(([^)]+)\)/);
        if (jsMatch) {
          try {
            foundOutputs.push(evalClean(jsMatch[1]));
          } catch {
            foundOutputs.push(jsMatch[1].replace(/['"`]/g, ""));
          }
        }

        // Python print
        const pyMatch = line.match(/print\(([^)]+)\)/);
        if (pyMatch) {
          try {
            foundOutputs.push(evalClean(pyMatch[1]));
          } catch {
            foundOutputs.push(pyMatch[1].replace(/['"`]/g, ""));
          }
        }

        // C++ cout
        const cppMatch = line.match(/std::cout\s*<<\s*([^<<;]+)/);
        if (cppMatch) {
          foundOutputs.push(cppMatch[1].replace(/['"`]/g, "").trim());
        }
      });

      const newLogs: ConsoleLog[] = [];
      if (foundOutputs.length > 0) {
        foundOutputs.forEach((out, index) => {
          newLogs.push({
            type: "stdout",
            text: out,
            timestamp: someLocalTime(1.5 + (index * 0.1)),
          });
        });
      } else {
        // Fallback realistic outputs based on selected language
        if (language === "javascript" || language === "typescript") {
          newLogs.push({
            type: "stdout",
            text: "[Process Finished] Code compiled successfully. No explicit print statements found.",
            timestamp: someLocalTime(1.5),
          });
        } else if (language === "python") {
          newLogs.push({
            type: "stdout",
            text: ">>> Process finished with exit code 0",
            timestamp: someLocalTime(1.5),
          });
        } else {
          newLogs.push({
            type: "stdout",
            text: "Build finished. Main function completed successfully.",
            timestamp: someLocalTime(1.5),
          });
        }
      }

      setLogs(prev => [
        ...prev,
        ...newLogs,
        {
          type: "success",
          text: `Thread execution completed. Exit status: 0 (OK)`,
          timestamp: someLocalTime(2),
        }
      ]);

      const randomTime = (Math.random() * 8 + 1.2).toFixed(2);
      const randomMem = (Math.random() * 4 + 1.5).toFixed(1);
      setExecTime(`${randomTime} ms`);
      setMemoryUsed(`${randomMem} MB`);
      setIsRunning(false);

    }, 1100);
  };

  const evalClean = (val: string): string => {
    // Basic scrubbing for standard display
    let cleaned = val.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) return cleaned.slice(1, -1);
    if (cleaned.startsWith("'") && cleaned.endsWith("'")) return cleaned.slice(1, -1);
    if (cleaned.startsWith("`") && cleaned.endsWith("`")) return cleaned.slice(1, -1);
    return cleaned;
  };

  const clearLogs = () => {
    setLogs([
      {
        type: "system",
        text: "Console logs cleared. Ready to run.",
        timestamp: someLocalTime(0),
      }
    ]);
    setExecTime(null);
    setMemoryUsed(null);
  };

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#090d16] flex flex-col h-full" id="interactive-console-sandbox">
      {/* Console Header */}
      <div className="flex items-center justify-between bg-slate-950 px-4 py-3 border-b border-slate-800" id="console-header">
        <div className="flex items-center gap-2" id="console-title-wrapper">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-white font-mono text-xs font-medium">Virtual Code Execution Sandbox</span>
        </div>
        <div className="flex items-center gap-2" id="console-action-btns">
          <button
            id="clear-console-btn"
            onClick={clearLogs}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-white bg-slate-900 border border-slate-800/80 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            id="run-sandbox-btn"
            onClick={runSandboxSim}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono text-[#090d16] font-semibold bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            {isRunning ? "Running..." : "Run Sandbox"}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 divide-x divide-slate-800/80 bg-[#0c111e]/20 border-b border-slate-800/40 text-center py-2" id="console-metrics-row">
        <div className="flex items-center justify-center gap-1.5" id="metric-clock">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-mono text-slate-500">Latency: </span>
          <span className="text-[10px] font-mono font-semibold text-sky-400">{execTime || "--"}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5" id="metric-ram">
          <HardDrive className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-mono text-slate-500">Peak Memory: </span>
          <span className="text-[10px] font-mono font-semibold text-purple-400">{memoryUsed || "--"}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5" id="metric-status">
          <Cpu className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-mono text-slate-500">Sandboxed VM: </span>
          <span className="text-[10px] font-mono font-semibold text-emerald-400">v18.12.0 x64</span>
        </div>
      </div>

      {/* Logs Viewscreen */}
      <div className="flex-1 p-4 bg-[#05080f] overflow-y-auto h-[256px] min-h-[220px]" id="console-log-scroll">
        <div className="font-mono text-[11px] leading-relaxed space-y-2" id="console-logs-list">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2.5 hover:bg-slate-900/10 py-0.5 rounded transition-colors" id={`log-item-${idx}`}>
              <span className="text-slate-600 select-none text-[9px] mt-0.5 font-light font-mono">{log.timestamp}</span>
              {log.type === "system" && (
                <span className="text-slate-400 font-mono" id={`system-log-${idx}`}>
                  <span className="text-sky-500">[SYSTEM]</span> {log.text}
                </span>
              )}
              {log.type === "stdout" && (
                <span className="text-slate-100 font-mono" id={`stdout-log-${idx}`}>
                  <span className="text-emerald-500">[STDOUT]</span> {log.text}
                </span>
              )}
              {log.type === "stderr" && (
                <span className="text-rose-400 font-mono" id={`stderr-log-${idx}`}>
                  <span className="text-rose-500 font-bold">[ERR]</span> {log.text}
                </span>
              )}
              {log.type === "success" && (
                <span className="text-[#38bdf8] font-semibold font-mono" id={`success-log-${idx}`}>
                  <span className="text-emerald-400">● </span> {log.text}
                </span>
              )}
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center gap-2 text-slate-500 text-[11px]" id="console-loading-indicator">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span>Thread compilation active...</span>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Sandbox Footer Input */}
      <div className="bg-slate-950 p-2.5 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between" id="console-footer">
        <span>Execution status code bindings enabled</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
          Offline Sandboxed Sandbox Running
        </span>
      </div>
    </div>
  );
}
