import React from "react";
import { ArrowRight, Copy, Check, FileCode2 } from "lucide-react";

interface DiffViewerProps {
  originalCode: string;
  optimizedCode: string;
  language: string;
}

export function DiffViewer({ originalCode, optimizedCode, language }: DiffViewerProps) {
  const [copiedOriginal, setCopiedOriginal] = React.useState(false);
  const [copiedOptimized, setCopiedOptimized] = React.useState(false);

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  const originalLines = originalCode.replace(/\r/g, "").split("\n");
  const optimizedLines = optimizedCode.replace(/\r/g, "").split("\n");

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#090d16]" id="diff-viewer">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3" id="diff-viewer-header">
        <div className="flex items-center gap-2" id="diff-title-wrapper">
          <FileCode2 className="w-4 h-4 text-sky-400" />
          <span className="text-white font-mono text-xs font-medium">Refactored Optimization Diff</span>
        </div>
        <div className="flex items-center gap-1.5" id="diff-indicator-badges">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/10">- Deletion / Static</span>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">+ Addition / Optimized</span>
        </div>
      </div>

      {/* Code Side-By-Side Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 font-mono text-xs" id="diff-split-container">
        {/* Original Panel */}
        <div className="flex flex-col h-[400px] overflow-hidden" id="original-code-panel">
          <div className="flex items-center justify-between bg-slate-900/30 px-4 py-2 border-b border-slate-800/60" id="original-panel-header">
            <span className="text-slate-400 font-mono text-[11px]">Original Stack</span>
            <button
              id="copy-original-btn"
              onClick={() => copyToClipboard(originalCode, setCopiedOriginal)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              title="Copy original code"
            >
              {copiedOriginal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#06080e]" id="original-lines-scroll">
            <table className="w-full border-collapse">
              <tbody>
                {originalLines.map((line, idx) => (
                  <tr key={`orig-${idx}`} className="hover:bg-slate-900/30 group">
                    <td className="w-8 select-none text-right pr-3 text-slate-600 border-r border-slate-800/40 text-[10px] py-0.5">
                      {idx + 1}
                    </td>
                    <td className="pl-3 whitespace-pre text-slate-300 py-0.5 text-left font-mono">
                      {line || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Optimized Panel */}
        <div className="flex flex-col h-[400px] overflow-hidden" id="optimized-code-panel">
          <div className="flex items-center justify-between bg-slate-900/30 px-4 py-2 border-b border-slate-800/60" id="optimized-panel-header">
            <span className="text-emerald-400 font-semibold font-mono text-[11px]">Optimized Production Stack</span>
            <button
              id="copy-optimized-btn"
              onClick={() => copyToClipboard(optimizedCode, setCopiedOptimized)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              title="Copy optimized code"
            >
              {copiedOptimized ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#040c11]" id="optimized-lines-scroll">
            <table className="w-full border-collapse">
              <tbody>
                {optimizedLines.map((line, idx) => {
                  const isNew = !originalLines.includes(line);
                  return (
                    <tr 
                      key={`opt-${idx}`} 
                      className={`hover:bg-slate-900/30 group ${isNew ? "bg-emerald-950/20 text-emerald-300" : ""}`}
                    >
                      <td className="w-8 select-none text-right pr-3 text-slate-600 border-r border-slate-800/40 text-[10px] py-0.5 font-mono">
                        {idx + 1}
                      </td>
                      <td className={`pl-3 whitespace-pre py-0.5 text-left font-mono ${isNew ? "text-emerald-300 font-medium" : "text-slate-300"}`}>
                        {line || " "}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
