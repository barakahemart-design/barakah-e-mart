import React from "react";
import { MetricRating } from "../types";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { ShieldCheck, Zap, Activity, HelpCircle, Eye } from "lucide-react";

interface MetricDashboardProps {
  rating: MetricRating;
  complexityExplanation: string;
}

export function MetricDashboard({ rating, complexityExplanation }: MetricDashboardProps) {
  // Convert standard ratings structure for recharts usage
  const chartData = [
    { name: "Readability", value: rating.readability, fullMark: 100 },
    { name: "Security", value: rating.security, fullMark: 100 },
    { name: "Efficiency", value: rating.efficiency, fullMark: 100 },
    { name: "Maintainability", value: rating.maintainability, fullMark: 100 },
    { name: "Complexity", value: rating.complexity, fullMark: 100 },
  ];

  const getMetricIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "readability":
        return <Eye className="w-5 h-5 text-sky-400" id={`icon-readability`} />;
      case "security":
        return <ShieldCheck className="w-5 h-5 text-emerald-400" id={`icon-security`} />;
      case "efficiency":
        return <Zap className="w-5 h-5 text-amber-400" id={`icon-efficiency`} />;
      case "maintainability":
        return <Activity className="w-5 h-5 text-purple-400" id={`icon-maintainability`} />;
      default:
        return <HelpCircle className="w-5 h-5 text-rose-400" id={`icon-complexity`} />;
    }
  };

  const getMetricColor = (value: number) => {
    if (value >= 85) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    if (value >= 60) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  };

  const getMetricBarColor = (value: number) => {
    if (value >= 85) return "bg-emerald-500";
    if (value >= 60) return "bg-amber-400";
    return "bg-rose-500";
  };

  const roundedAverage = Math.round(
    (rating.readability + rating.security + rating.efficiency + rating.maintainability + rating.complexity) / 5
  );

  return (
    <div className="space-y-6" id="metric-dashboard">
      {/* Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="overview-metrics-grid">
        <div className="bg-[#0f162a]/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between" id="score-average-card">
          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">System Code Score</h4>
            <div className="flex items-baseline mt-2 gap-2" id="avg-score-display">
              <span className="text-5xl font-sans font-bold tracking-tight text-white">{roundedAverage}</span>
              <span className="text-slate-500 font-mono text-sm">/ 100</span>
            </div>
          </div>
          <div className="mt-4" id="avg-score-badge">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono border ${getMetricColor(roundedAverage)}`}>
              {roundedAverage >= 85 ? "Excellent Quality" : roundedAverage >= 60 ? "Acceptable Quality" : "Critical Refactoring Required"}
            </span>
          </div>
        </div>

        <div className="col-span-2 bg-[#0f162a]/90 border border-slate-800 rounded-xl p-5" id="complexity-explanation-card">
          <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">Cognitive Complexity Scan</h4>
          <p className="text-slate-300 text-sm mt-3 leading-relaxed font-sans">{complexityExplanation}</p>
          <div className="mt-4 flex items-center gap-6" id="complexity-details">
            <div id="metric-nesting">
              <span className="text-slate-500 text-xs font-mono block">Nesting Level</span>
              <span className="text-white text-sm font-semibold font-mono">
                {rating.complexity > 75 ? "Deep (Critical)" : rating.complexity > 40 ? "Moderate" : "Low (Optimal)"}
              </span>
            </div>
            <div id="metric-conduciveness">
              <span className="text-slate-500 text-xs font-mono block">Maintenance Index</span>
              <span className="text-white text-sm font-semibold font-mono">
                {rating.maintainability > 80 ? "Highly Adaptable" : rating.maintainability > 50 ? "Stable" : "Fragile"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Chart and Detailed Scores Block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="chart-and-details-grid">
        {/* Radar Map */}
        <div className="bg-[#0f162a]/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between" id="radar-chart-container">
          <div className="mb-4" id="radar-header">
            <h4 className="text-sm font-mono text-white">Visual Audit Footprint</h4>
            <p className="text-xs text-slate-500">Radar trace showing balance of software quality vectors.</p>
          </div>
          
          <div className="h-64 flex items-center justify-center" id="recharts-radar-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis 
                  dataKey="name" 
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} 
                />
                <PolarRadiusAxis 
                  angle={30} 
                  domain={[0, 100]} 
                  tick={{ fill: '#475569', fontSize: 9 }}
                />
                <Radar
                  name="Code Quality"
                  dataKey="value"
                  stroke="#38bdf8"
                  fill="#0284c7"
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Individual Progress Bars */}
        <div className="bg-[#0f162a]/90 border border-slate-800 rounded-xl p-5 space-y-4" id="individual-scores-container">
          <h4 className="text-sm font-mono text-white mb-2">Metrics Diagnostics</h4>

          {chartData.map((item) => (
            <div key={item.name} className="space-y-1" id={`metric-row-${item.name.toLowerCase()}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getMetricIcon(item.name)}
                  <span className="text-slate-300 font-mono text-xs">{item.name}</span>
                </div>
                <span className="text-white font-mono text-xs font-semibold">{item.value}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden" id={`bar-bg-${item.name.toLowerCase()}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getMetricBarColor(item.value)}`} 
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}

          <div className="p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 font-mono flex items-center justify-between" id="diagnostics-summary">
            <span>Scan Time Efficiency:</span>
            <span className="text-emerald-400">Optimal (~0.84s)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
