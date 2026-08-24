import React, { useState } from 'react';
import { PlaqueCertification, PlaqueFrameStyle, PlaqueMilestone } from '../types/music';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  Award,
  Disc,
  Trash2,
  Share2,
  Download,
  Sparkles,
  Edit3,
  Check,
  RotateCw,
} from 'lucide-react';

interface PlaqueDetailModalProps {
  plaque: PlaqueCertification | null;
  onClose: () => void;
}

const PlaqueDetailModalContent: React.FC<{
  plaque: PlaqueCertification;
  onClose: () => void;
}> = ({ plaque, onClose }) => {
  const { updatePlaque, deletePlaque } = useMusic();
  const { theme } = useTheme();

  const [isEditing, setIsEditing] = useState(false);
  const [engraving, setEngraving] = useState(plaque.customEngraving || '');
  const [selectedFrame, setSelectedFrame] = useState<PlaqueFrameStyle>(plaque.frameStyle);
  const [copied, setCopied] = useState(false);

  const frameOptions: { id: PlaqueFrameStyle; label: string; previewColor: string }[] = [
    { id: 'classic-walnut', label: 'Classic Walnut & Gold', previewColor: '#d4af37' },
    { id: 'platinum-brushed', label: 'Brushed Platinum & Steel', previewColor: '#e2e8f0' },
    { id: 'obsidian', label: 'Obsidian & Cyan Neon', previewColor: '#06b6d4' },
    { id: 'rosegold', label: 'Rose Gold & Velvet', previewColor: '#fda4af' },
    { id: 'cyberpunk-neon', label: 'Cyberpunk Magenta', previewColor: '#ec4899' },
    { id: 'emerald-velvet', label: 'Emerald Vault', previewColor: '#10b981' },
  ];

  const handleSave = () => {
    updatePlaque({
      ...plaque,
      customEngraving: engraving,
      frameStyle: selectedFrame,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    deletePlaque(plaque.id);
    onClose();
  };

  const handleCopyShare = () => {
    navigator.clipboard?.writeText(
      `Check out my Official Certified ${plaque.milestone.toUpperCase()} Record Plaque for "${plaque.subjectTitle}" on yourhot100!`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const currentStyle = frameStyles[selectedFrame] || frameStyles['classic-walnut'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="plaque-detail-modal"
        className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-sm`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Commemorative Plaque Studio
            </h2>
            <p className="text-xs text-zinc-400">
              High-resolution museum frame preview with custom laser engraving
            </p>
          </div>
        </div>

        {/* Central High-Res Plaque Display */}
        <div
          className={`relative rounded-3xl p-6 sm:p-8 border-4 ${currentStyle.frameBorder} shadow-2xl flex flex-col items-center space-y-6 overflow-hidden`}
        >
          {/* Glass reflection */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none" />

          {/* Plaque Inner Velvet */}
          <div className={`w-full rounded-2xl p-6 border ${currentStyle.matting} flex flex-col items-center space-y-6 shadow-inner relative z-10`}>
            {/* Top Badge */}
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${currentStyle.badgeColor}`}>
                Official {plaque.milestone.toUpperCase()} Certification
              </span>
              <span className="text-xs font-mono font-bold text-zinc-400">
                Awarded {plaque.awardedDate}
              </span>
            </div>

            {/* Realistic Vinyl / Gold Record Simulation */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-zinc-950 border-2 border-zinc-700 shadow-2xl flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(255,255,255,0.06)_21%,_transparent_22%,_rgba(255,255,255,0.06)_35%,_transparent_36%,_rgba(255,255,255,0.06)_50%,_transparent_51%,_rgba(255,255,255,0.06)_65%,_transparent_66%,_rgba(255,255,255,0.06)_80%,_transparent_81%)]" />
              <div className={`absolute inset-0 bg-gradient-to-tr ${currentStyle.vinylGlow} opacity-35 mix-blend-screen`} />

              <div className="relative w-20 h-20 rounded-full bg-black border-2 border-zinc-400/80 shadow-lg overflow-hidden flex items-center justify-center z-10">
                {plaque.coverArt ? (
                  <img
                    src={plaque.coverArt}
                    alt={plaque.subjectTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Disc className="w-10 h-10 text-zinc-500" />
                )}
                <div className="absolute w-4 h-4 rounded-full bg-zinc-950 border border-zinc-500 shadow-inner" />
              </div>
            </div>

            {/* Engraved Brass Plate */}
            <div className="w-full rounded-xl bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 border border-zinc-600/70 p-4 shadow-xl text-center space-y-1.5 relative">
              <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <div className="absolute bottom-2 left-2 w-1.5 h-1.5 rounded-full bg-zinc-500" />
              <div className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-zinc-500" />

              <h3 className="text-base font-black text-white tracking-tight uppercase">
                {plaque.subjectTitle}
              </h3>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {plaque.subjectSubtitle}
              </p>
              <p className="text-xs text-amber-300/90 font-serif italic max-w-md mx-auto pt-1">
                "{isEditing ? engraving : plaque.customEngraving || 'Presented in honor of continuous dedication to music discovery.'}"
              </p>
              <div className="pt-2">
                <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/30">
                  {plaque.scrobblesEarned.toLocaleString()} Verified Scrobbles
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Customization Options */}
        {isEditing ? (
          <div className="space-y-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Custom Inscribed Dedication</label>
              <textarea
                value={engraving}
                onChange={(e) => setEngraving(e.target.value)}
                rows={2}
                placeholder="Enter personal engraved text..."
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Frame Style Finish</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {frameOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedFrame(opt.id)}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                      selectedFrame === opt.id
                        ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.previewColor }} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all`}
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          /* Action Controls */
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Customize Engraving</span>
              </button>

              <button
                onClick={handleCopyShare}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Link!' : 'Share Plaque'}</span>
              </button>
            </div>

            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove from Wall</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const PlaqueDetailModal: React.FC<PlaqueDetailModalProps> = ({ plaque, onClose }) => {
  if (!plaque) return null;
  return <PlaqueDetailModalContent plaque={plaque} onClose={onClose} />;
};
