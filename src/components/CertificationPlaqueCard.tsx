import React from 'react';
import { AutomaticCertification } from '../utils/automaticCertificationsEngine';
import { MusicImage } from './MusicImage';
import { CreditedArtistLinks } from './CreditedArtistLinks';
import { Award, Disc, Music, Calendar, Sparkles, Flame } from 'lucide-react';

interface CertificationPlaqueCardProps {
  cert: AutomaticCertification;
  onClick: () => void;
  onSelectArtist?: (artist: string) => void;
}

export const CertificationPlaqueCard: React.FC<CertificationPlaqueCardProps> = ({
  cert,
  onClick,
  onSelectArtist,
}) => {
  // Metallic frame finishes based on milestone tier
  const frameThemes = {
    gold: {
      border: 'border-amber-400/90 shadow-[0_10px_35px_rgba(217,119,6,0.3)] hover:shadow-[0_15px_45px_rgba(217,119,6,0.45)]',
      matting: 'bg-gradient-to-b from-[#1c150c] via-[#100d07] to-[#080603] border-amber-500/30',
      recordGlow: 'from-amber-300 via-yellow-500 to-amber-600',
      badge: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md font-black',
      plateBorder: 'border-amber-500/40 bg-gradient-to-b from-[#251a0d] to-[#120d06]',
      accentText: 'text-amber-400',
      pillBg: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
    },
    platinum: {
      border: 'border-slate-300/90 shadow-[0_10px_35px_rgba(148,163,184,0.3)] hover:shadow-[0_15px_45px_rgba(148,163,184,0.45)]',
      matting: 'bg-gradient-to-b from-[#13161c] via-[#0d0f14] to-[#07080a] border-slate-400/30',
      recordGlow: 'from-slate-100 via-slate-300 to-zinc-500',
      badge: 'bg-gradient-to-r from-slate-200 to-zinc-400 text-black shadow-md font-black',
      plateBorder: 'border-slate-400/40 bg-gradient-to-b from-[#191d24] to-[#0e1014]',
      accentText: 'text-slate-200',
      pillBg: 'bg-slate-900/80 border-slate-400/40 text-slate-200',
    },
    'multi-platinum': {
      border: 'border-slate-200 shadow-[0_10px_40px_rgba(203,213,225,0.35)] hover:shadow-[0_15px_50px_rgba(203,213,225,0.5)]',
      matting: 'bg-gradient-to-b from-[#141923] via-[#0d1017] to-[#06080d] border-cyan-400/40',
      recordGlow: 'from-cyan-200 via-slate-200 to-indigo-400',
      badge: 'bg-gradient-to-r from-cyan-300 via-slate-100 to-cyan-400 text-black shadow-md font-black',
      plateBorder: 'border-cyan-400/40 bg-gradient-to-b from-[#18202d] to-[#0d121a]',
      accentText: 'text-cyan-300',
      pillBg: 'bg-cyan-950/70 border-cyan-400/40 text-cyan-200',
    },
    diamond: {
      border: 'border-cyan-300 shadow-[0_10px_45px_rgba(6,182,212,0.4)] hover:shadow-[0_20px_60px_rgba(6,182,212,0.6)]',
      matting: 'bg-gradient-to-b from-[#0a1820] via-[#050e14] to-[#020609] border-cyan-400/50',
      recordGlow: 'from-cyan-300 via-teal-300 to-blue-500',
      badge: 'bg-gradient-to-r from-cyan-300 via-white to-teal-300 text-black shadow-lg font-black',
      plateBorder: 'border-cyan-400/60 bg-gradient-to-b from-[#0e222d] to-[#061117]',
      accentText: 'text-cyan-300',
      pillBg: 'bg-cyan-950/90 border-cyan-400/50 text-cyan-200',
    },
  };

  const style = frameThemes[cert.tier] || frameThemes.gold;

  return (
    <div
      id={`cert-plaque-${cert.id}`}
      onClick={onClick}
      className={`group relative rounded-3xl p-4 sm:p-5 cursor-pointer border-2 sm:border-[2.5px] ${style.border} transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between overflow-hidden bg-black/95`}
    >
      {/* Glossy light reflection sheen across glass */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-70 pointer-events-none group-hover:opacity-100 transition-opacity" />

      {/* Velvet Matting Inner Container */}
      <div className={`relative rounded-2xl p-4 sm:p-5 border ${style.matting} flex flex-col items-center space-y-4 shadow-inner`}>
        {/* Top Header Row: Type Badge + Milestone + Award Date */}
        <div className="flex items-center justify-between w-full gap-2">
          {/* Release Type (Song vs Album) */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-zinc-900/90 border border-zinc-700/60 text-zinc-300">
            {cert.type === 'album' ? (
              <>
                <Disc className="w-3 h-3 text-amber-400" />
                <span>Album</span>
              </>
            ) : (
              <>
                <Music className="w-3 h-3 text-indigo-400" />
                <span>Song</span>
              </>
            )}
          </span>

          {/* Award Date */}
          <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-zinc-400">
            <Calendar className="w-3 h-3 text-zinc-500" />
            <span>{cert.awardedDate}</span>
          </div>
        </div>

        {/* Milestone Pill Banner */}
        <div className="w-full text-center">
          <span className={`inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full ${style.badge}`}>
            {cert.tierLabel}
          </span>
        </div>

        {/* Physical Vinyl / Metallic Record Presentation WITH PROMINENT PICTURE */}
        <div className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-zinc-950 border-2 border-zinc-700/80 shadow-2xl flex items-center justify-center overflow-hidden group-hover:rotate-6 transition-transform duration-700">
          {/* Micro-grooves concentric sound rings */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_transparent_22%,_rgba(255,255,255,0.05)_23%,_transparent_24%,_rgba(255,255,255,0.05)_36%,_transparent_37%,_rgba(255,255,255,0.05)_50%,_transparent_51%,_rgba(255,255,255,0.05)_66%,_transparent_67%,_rgba(255,255,255,0.05)_82%,_transparent_83%)] pointer-events-none" />

          {/* Dynamic vinyl metallic shine reflection */}
          <div className={`absolute inset-0 bg-gradient-to-tr ${style.recordGlow} opacity-35 mix-blend-screen pointer-events-none`} />

          {/* Center Record Label: HIGH-RESOLUTION PICTURE */}
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-black border-2 border-white/60 shadow-2xl overflow-hidden flex items-center justify-center z-10">
            <MusicImage
              type={cert.type}
              artist={cert.leadArtist}
              title={cert.type === 'track' ? cert.title : undefined}
              album={cert.type === 'album' ? cert.title : cert.albumTitle}
              src={cert.coverArt}
              alt={cert.title}
              className="w-full h-full object-cover"
            />
            {/* Vinyl Spindle Center Hole */}
            <div className="absolute w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 border-zinc-400 shadow-inner pointer-events-none" />
          </div>
        </div>

        {/* Official Engraved Brass / Steel Commemorative Nameplate */}
        <div className={`w-full rounded-2xl border ${style.plateBorder} p-3.5 shadow-lg text-center space-y-2 relative`}>
          {/* Simulated screw rivets in corners */}
          <div className="absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full bg-zinc-400/80 border border-zinc-700" />
          <div className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-zinc-400/80 border border-zinc-700" />
          <div className="absolute bottom-1.5 left-2 w-1.5 h-1.5 rounded-full bg-zinc-400/80 border border-zinc-700" />
          <div className="absolute bottom-1.5 right-2 w-1.5 h-1.5 rounded-full bg-zinc-400/80 border border-zinc-700" />

          {/* Title & Picture Thumbnail Row */}
          <div className="flex items-center justify-center gap-2.5">
            {/* Picture thumbnail guarantee */}
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-700 flex-shrink-0 shadow-sm">
              <MusicImage
                type={cert.type}
                artist={cert.leadArtist}
                title={cert.type === 'track' ? cert.title : undefined}
                album={cert.type === 'album' ? cert.title : cert.albumTitle}
                src={cert.coverArt}
                alt={cert.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="text-left overflow-hidden">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase line-clamp-1 group-hover:text-amber-300 transition-colors">
                {cert.title}
              </h3>
              <div
                className="text-[11px] font-semibold text-zinc-400 line-clamp-1"
                onClick={(e) => {
                  if (onSelectArtist) {
                    e.stopPropagation();
                  }
                }}
              >
                {/* STRICT CREDITING RULES: Albums = single lead artist; Songs = shared credit */}
                <CreditedArtistLinks
                  artist={cert.rawArtist || cert.artist}
                  title={cert.type === 'track' ? cert.title : undefined}
                  isAlbum={cert.type === 'album'}
                  className="text-zinc-400 hover:text-white"
                  onArtistClick={onSelectArtist}
                />
              </div>
            </div>
          </div>

          {/* Certified Units & Streams Pills */}
          <div className="pt-1 flex items-center justify-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${style.pillBg}`}>
              {cert.unitsEarned.toLocaleString()} Units
            </span>
            <span className="text-[10px] font-mono font-bold text-zinc-400 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
              {cert.totalPlays} Plays
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
