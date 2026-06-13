import React, { useState } from 'react';
import { EVENT_CLASSES } from '../routine/MarkovRoutineModel';
import { EVENT_ICONS } from '../constants';

interface RoutineHeatmapProps {
  heatmapData: number[][]; // [48][12]
}

export function RoutineHeatmap({ heatmapData }: RoutineHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  const now = new Date();
  const currentBin = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);

  // Time labels (every 4th bin = every 2 hours)
  const getHourLabel = (bin: number) => {
    const totalMinutes = bin * 30;
    const hStr = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const mStr = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  const handleCellMouseOver = (e: React.MouseEvent, bin: number, clsIdx: number, prob: number) => {
    const timeStr = `${getHourLabel(bin)} – ${getHourLabel(bin + 1)}`;
    const clsName = EVENT_CLASSES[clsIdx];
    const icon = EVENT_ICONS[clsName] || '';
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    
    setTooltip({
      text: `${timeStr} · ${icon} ${clsName.replace('_', ' ')} · Prob = ${(prob * 100).toFixed(0)}%`,
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 32,
    });
  };

  const handleCellMouseOut = () => {
    setTooltip(null);
  };

  // Safe checks for data loading
  const hasData = heatmapData && heatmapData.length === 48;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-xl space-y-5 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            🗺️ Learned Acoustic Routine Heatmap
          </h3>
          <p className="text-xxs text-slate-500">
            Markov probability matrix mapping expected household events against time of day.
          </p>
        </div>
        <span className="text-[10px] bg-teal-950/40 text-teal-400 border border-teal-900/30 px-2 py-0.5 rounded font-mono shrink-0">
          Live Model States
        </span>
      </div>

      {/* Beginner Explanation Guide */}
      <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-xs text-slate-400 leading-relaxed space-y-2">
        <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
          💡 How to Read the Heatmap:
        </h4>
        <p>
          This matrix represents the AI's **memory** of the occupant's typical daily routine. The model looks at sequences of sounds over a 24-hour cycle to learn typical behaviors:
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xxs text-slate-500 list-disc pl-4 pt-1">
          <li><strong>Columns (00:00 - 24:00):</strong> The 24-hour day split into 48 half-hour columns.</li>
          <li><strong>Rows (Sound Categories):</strong> The 12 household sounds the microphone listens for.</li>
          <li><strong>Teal Blocks (High Probability):</strong> Time periods where a sound is highly expected to occur.</li>
          <li><strong>Highlighted Column (Active Time):</strong> The current 30-minute window. The AI matches live sounds against this column to score anomalies.</li>
        </ul>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xxs font-mono text-slate-400 bg-slate-950/30 px-3 py-2 rounded-lg border border-slate-850/50">
        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-800/40 border border-transparent inline-block" />
          <span>Silence / Inactive</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-teal-500/50 border border-transparent inline-block" />
          <span>Expected Routine Sound</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-teal-500 border border-transparent inline-block shadow-md shadow-teal-500/20" />
          <span>Highly Expected Sound</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded border border-teal-400 bg-slate-950 inline-block animate-pulse" />
          <span>Current Time Window ({getHourLabel(currentBin)})</span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px] select-none py-2 space-y-1.5">
          {/* Top Indicator Row */}
          <div className="flex items-center pb-1">
            <div className="w-36" /> {/* spacer matching row labels */}
            <div className="flex-1 grid grid-cols-48 gap-0.5">
              {Array.from({ length: 48 }).map((_, bin) => {
                const isCurrent = bin === currentBin;
                return (
                  <div key={bin} className="flex flex-col items-center justify-end h-5">
                    {isCurrent && (
                      <>
                        <span className="text-[7px] text-teal-400 font-bold tracking-tighter leading-none animate-pulse">NOW</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping shadow-lg shadow-teal-500/50 mt-0.5" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event Rows */}
          {EVENT_CLASSES.map((cls, clsIdx) => {
            const icon = EVENT_ICONS[cls] || '❓';
            return (
              <div key={cls} className="flex items-center text-left">
                {/* Y-Axis Label */}
                <div className="w-36 flex items-center gap-1.5 text-xxs font-semibold text-slate-450 truncate pr-2">
                  <span className="text-xs shrink-0">{icon}</span>
                  <span className="capitalize truncate">{cls.replace(/_/g, ' ')}</span>
                </div>

                {/* 48 Grid columns */}
                <div className="flex-1 grid grid-cols-48 gap-0.5">
                  {Array.from({ length: 48 }).map((_, bin) => {
                    const prob = hasData ? heatmapData[bin]?.[clsIdx] || 0 : 0;
                    const opacity = Math.min(1, prob * 5); // scale 0.2 probability to full opacity
                    const isCurrent = bin === currentBin;

                    return (
                      <div
                        key={bin}
                        onMouseOver={(e) => handleCellMouseOver(e, bin, clsIdx, prob)}
                        onMouseOut={handleCellMouseOut}
                        className={`h-4.5 rounded-sm transition-all relative cursor-pointer ${
                          isCurrent 
                            ? 'border-2 border-teal-400 scale-y-110 z-10 shadow-lg shadow-teal-500/10' 
                            : 'border border-transparent hover:border-slate-700'
                        }`}
                        style={{
                          backgroundColor: opacity > 0.01 ? `rgba(20, 184, 166, ${opacity})` : 'rgba(30, 41, 59, 0.25)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Bottom Indicator Row */}
          <div className="flex items-center pt-1">
            <div className="w-36" />
            <div className="flex-1 grid grid-cols-48 gap-0.5">
              {Array.from({ length: 48 }).map((_, bin) => {
                const isCurrent = bin === currentBin;
                return (
                  <div key={bin} className="flex justify-center h-2">
                    {isCurrent && (
                      <span className="text-[9px] text-teal-400 animate-bounce leading-none">▲</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-Axis labels */}
          <div className="flex items-center pt-1.5 border-t border-slate-800/40">
            <div className="w-36" /> {/* alignment spacer */}
            <div className="flex-1 grid grid-cols-48 text-[9px] font-mono text-slate-500">
              {Array.from({ length: 48 }).map((_, bin) => {
                if (bin % 4 === 0) {
                  return (
                    <div key={bin} className="col-span-4 text-left translate-x-[2px] leading-none pt-1">
                      {getHourLabel(bin)}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-slate-950 border border-slate-800 text-slate-200 text-xxs px-2.5 py-1.5 rounded-lg shadow-lg font-mono -translate-x-1/2"
          style={{
            left: `${tooltip.x - window.scrollX - 24}px`, // Adjusted coordinate mapping relative to component container
            top: `${tooltip.y - window.scrollY - 10}px`,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
