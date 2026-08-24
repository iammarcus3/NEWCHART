import React from 'react';
import { PlaqueCertification } from '../types/music';
import { Award, Disc, Sparkles } from 'lucide-react';

interface PlaqueCardProps {
  plaque: PlaqueCertification;
  onClick: () => void;
}

export const PlaqueCard: React.FC<PlaqueCardProps> = ({ plaque, onClick }) => {
  // Styles for different frame finishes
  const frameStyles: Record<string, { frameBorder: string; matting: string; vinylGlow: string; badgeColor: string }> = {
    'classic-walnut': {
      frameBorder: 'border-[#d4af37] bg-gradient-to-b from-[#2b1f13] via-[#1a130b] to-[#0d0905]',
      matting: 'bg-[#120e09] border-[#d4af37]/30',
      vinylGlow: 'from-amber-400 via-yellow-500 to-amber-600',
      badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-950/60',
    },
    'platinum-brushed': {
      frameBorder: 'border-slate-300 bg-gradient-to-b from-slate-800 via-slate-900 to-zinc-950',
      matting: 'bg-zinc-900 border-slate-400/30',
      vinylGlow: 'from-slate-200 via-zinc-400 to-slate-500',
      badgeColor: 'text-slate-200 border-slate-400/40 bg-slate-800/60',
    },
    'obsidian': {
      frameBorder: 'border-cyan-500/60 bg-gradient-to-b from-zinc-900 via-black to-zinc-950',
      matting: 'bg-black border-cyan-500/30',
      vinylGlow: 'from-cyan-400 via-teal-500 to-blue-600',
      badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/60',
    },
    'rosegold': {
      frameBorder: 'border-rose-300/80 bg-gradient-to-b from-[#2d181e] via-[#1a0f12] to-[#0c0708]',
      matting: 'bg-[#150a0e] border-rose-400/30',
      vinylGlow: 'from-rose-300 via-pink-400 to-rose-500',
      badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-950/60',
    },
    'cyberpunk-neon': {
      frameBorder: 'border-fuchsia-500 bg-black',
      matting: 'bg-zinc-950 border-fuchsia-500/40',
      vinylGlow: 'from-cyan-400 via-fuchsia-500 to-pink-500',
      badgeColor: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-950/60',
    },
    'emerald-velvet': {
      frameBorder: 'border-emerald-500/80 bg-gradient-to-b from-[#061e12] via-[#031109] to-[#010804]',
      matting: 'bg-[#04120a] border-emerald-500/30',
      vinylGlow: 'from-emerald-400 via-teal-500 to-emerald-600',
      badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/60',
    },
  };

  const style = frameStyles[plaque.frameStyle] || frameStyles['classic-walnut'];

  const milestoneTitles: Record<string, string> = {
    silver: 'Certified Silver Single',
    gold: 'Certified Gold Record',
    platinum: 'Certified Platinum Plaque',
    'multi-platinum': 'Certified 2x Multi-Platinum',
    diamond: 'Certified Diamond Elite',
    custom: 'Special Commemorative Issue',
  };

  return (
    <div
      onClick={onClick}
      id={`plaque-card-${plaque.id}`}
      className={`group relative rounded-3xl p-5 cursor-pointer border-2 ${style.frameBorder} shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-hidden`}
    >
      {/* Gloss reflection overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-70 pointer-events-none group-hover:opacity-100 transition-opacity" />

      {/* Velvet Matting Inner Container */}
      <div className={`relative rounded-2xl p-4 border ${style.matting} flex flex-col items-center space-y-4 shadow-inner`}>
        {/* Top Plaque Header Badge */}
        <div className="flex items-center justify-between w-full">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.badgeColor}`}>
            {milestoneTitles[plaque.milestone] || plaque.milestone.toUpperCase()}
          </span>
          <span className="text-[10px] font-mono font-bold text-zinc-400">
            {plaque.awardedDate}
          </span>
        </div>

        {/* Realistic Vinyl / Gold Record Simulation */}
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-zinc-950 border border-zinc-700 shadow-2xl flex items-center justify-center overflow-hidden group-hover:rotate-12 transition-transform duration-700">
          {/* Micro-grooves concentric rings */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(255,255,255,0.04)_21%,_transparent_22%,_rgba(255,255,255,0.04)_35%,_transparent_36%,_rgba(255,255,255,0.04)_50%,_transparent_51%,_rgba(255,255,255,0.04)_65%,_transparent_66%,_rgba(255,255,255,0.04)_80%,_transparent_81%)]" />

          {/* Vinyl metallic shine streaks */}
          <div className={`absolute inset-0 bg-gradient-to-tr ${style.vinylGlow} opacity-30 mix-blend-screen`} />

          {/* Center Label with Cover Art */}
          <div className="relative w-16 h-16 rounded-full bg-black border-2 border-zinc-400/60 shadow-lg overflow-hidden flex items-center justify-center z-10">
            {plaque.coverArt ? (
              <img
                src={plaque.coverArt}
                alt={plaque.subjectTitle}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Disc className="w-8 h-8 text-zinc-500" />
            )}
            {/* Spindle hole */}
            <div className="absolute w-3 h-3 rounded-full bg-zinc-950 border border-zinc-500 shadow-inner" />
          </div>
        </div>

        {/* Official Engraved Brass Nameplate */}
        <div className="w-full rounded-xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border border-zinc-600/60 p-3 shadow-md text-center space-y-1 relative">
          {/* Simulated screw rivets */}
          <div className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full bg-zinc-500 border border-zinc-700" />
          <div className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-500 border border-zinc-700" />
          <div className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-zinc-500 border border-zinc-700" />
          <div className="absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-500 border border-zinc-700" />

          <h3 className="text-sm font-black text-white tracking-tight uppercase line-clamp-1">
            {plaque.subjectTitle}
          </h3>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider line-clamp-1">
            {plaque.subjectSubtitle}
          </p>
          <div className="pt-1 flex items-center justify-center gap-2">
            <span className="text-[10px] font-mono font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/30">
              {plaque.scrobblesEarned.toLocaleString()} Certified Plays
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
