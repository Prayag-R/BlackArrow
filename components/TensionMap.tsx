import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { DilemmaAnalysis } from '../types';

interface TensionMapProps {
  analysis: DilemmaAnalysis;
}

const TensionMap: React.FC<TensionMapProps> = ({ analysis }) => {
  const data = analysis.ethicalDimensions.map(dim => ({
    subject: dim.label,
    A: dim.score,
    fullMark: 100,
  }));

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-800/50 rounded-xl border border-slate-700 backdrop-blur-sm">
      <h3 className="text-slate-300 font-serif font-bold mb-4 tracking-wide uppercase text-sm">Value Constellation</h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#475569" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Dilemma Profile"
              dataKey="A"
              stroke="#818cf8"
              strokeWidth={2}
              fill="#6366f1"
              fillOpacity={0.4}
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
                itemStyle={{ color: '#818cf8' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 w-full space-y-3">
        {analysis.tensions.map((tension, idx) => (
          <div key={idx} className="relative pt-2">
            <div className="flex justify-between text-xs text-slate-400 font-semibold uppercase mb-1">
              <span>{tension.valueA}</span>
              <span>{tension.valueB}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
              <div 
                className="absolute top-0 bottom-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 w-full opacity-80"
              />
              {/* Indicator Dot */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                style={{ left: `${tension.score}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 italic text-center">{tension.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TensionMap;