import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  SubjectType,
  PlaqueMilestone,
  PlaqueFrameStyle,
} from '../types/music';
import { X, Award, Disc, Sparkles, Plus, Check } from 'lucide-react';

interface PlaqueCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillItem?: {
    title: string;
    subtitle: string;
    type: SubjectType;
    scrobbles: number;
    coverArt?: string;
  } | null;
}

const PlaqueCreatorModalContent: React.FC<Omit<PlaqueCreatorModalProps, 'isOpen'>> = ({
  onClose,
  prefillItem,
}) => {
  const { createCustomPlaque, tracksChart, artistsChart, albumsChart } = useMusic();
  const { theme } = useTheme();

  const [subjectType, setSubjectType] = useState<SubjectType>(prefillItem?.type || 'track');
  const [selectedTitle, setSelectedTitle] = useState(prefillItem?.title || '');
  const [selectedSubtitle, setSelectedSubtitle] = useState(prefillItem?.subtitle || '');
  const [coverArt, setCoverArt] = useState(prefillItem?.coverArt || '');
  const [scrobblesEarned, setScrobblesEarned] = useState<number>(prefillItem?.scrobbles || 50);
  const [milestone, setMilestone] = useState<PlaqueMilestone>(
    (prefillItem?.scrobbles || 50) >= 500
      ? 'diamond'
      : (prefillItem?.scrobbles || 50) >= 200
      ? 'multi-platinum'
      : (prefillItem?.scrobbles || 50) >= 100
      ? 'platinum'
      : (prefillItem?.scrobbles || 50) >= 50
      ? 'gold'
      : 'silver'
  );
  const [frameStyle, setFrameStyle] = useState<PlaqueFrameStyle>('classic-walnut');
  const [engraving, setEngraving] = useState('Commemorating exceptional audio rotation and milestone verified plays.');

  useEffect(() => {
    if (prefillItem) {
      setSubjectType(prefillItem.type);
      setSelectedTitle(prefillItem.title);
      setSelectedSubtitle(prefillItem.subtitle);
      setCoverArt(prefillItem.coverArt || '');
      setScrobblesEarned(prefillItem.scrobbles);
      if (prefillItem.scrobbles >= 500) setMilestone('diamond');
      else if (prefillItem.scrobbles >= 200) setMilestone('multi-platinum');
      else if (prefillItem.scrobbles >= 100) setMilestone('platinum');
      else if (prefillItem.scrobbles >= 50) setMilestone('gold');
      else setMilestone('silver');
    }
  }, [prefillItem]);

  // Quick picker items based on type
  const quickItems =
    subjectType === 'track'
      ? tracksChart.slice(0, 8).map((t) => ({ title: t.title, subtitle: t.artist, plays: t.playCount, cover: t.coverArt }))
      : subjectType === 'artist'
      ? artistsChart.slice(0, 8).map((a) => ({ title: a.artist, subtitle: 'Career Artist Legacy', plays: a.playCount, cover: a.coverArt }))
      : albumsChart.slice(0, 8).map((alb) => ({ title: alb.title, subtitle: alb.artist, plays: alb.playCount, cover: alb.coverArt }));

  const handleSelectQuick = (item: { title: string; subtitle: string; plays: number; cover: string }) => {
    setSelectedTitle(item.title);
    setSelectedSubtitle(item.subtitle);
    setScrobblesEarned(item.plays);
    setCoverArt(item.cover);
    if (item.plays >= 500) setMilestone('diamond');
    else if (item.plays >= 200) setMilestone('multi-platinum');
    else if (item.plays >= 100) setMilestone('platinum');
    else if (item.plays >= 50) setMilestone('gold');
    else setMilestone('silver');
  };

  const handleCreate = () => {
    if (!selectedTitle.trim()) return;

    createCustomPlaque({
      subjectTitle: selectedTitle.trim(),
      subjectSubtitle: selectedSubtitle.trim() || 'Featured Masterpiece',
      subjectType,
      coverArt: coverArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop&q=80',
      milestone,
      threshold: scrobblesEarned,
      scrobblesEarned,
      awardedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      frameStyle,
      customEngraving: engraving,
      isCustom: true,
    });

    onClose();
  };

  const frameOptions: { id: PlaqueFrameStyle; label: string; previewColor: string }[] = [
    { id: 'classic-walnut', label: 'Classic Walnut & Gold', previewColor: '#d4af37' },
    { id: 'platinum-brushed', label: 'Brushed Platinum', previewColor: '#e2e8f0' },
    { id: 'obsidian', label: 'Obsidian & Neon', previewColor: '#06b6d4' },
    { id: 'rosegold', label: 'Rose Gold & Velvet', previewColor: '#fda4af' },
    { id: 'cyberpunk-neon', label: 'Cyberpunk Magenta', previewColor: '#ec4899' },
    { id: 'emerald-velvet', label: 'Emerald Vault', previewColor: '#10b981' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="plaque-creator-modal"
        className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-sm`}>
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Forge Commemorative Record Plaque
            </h2>
            <p className="text-xs text-zinc-400">
              Certify a track, artist, or album with custom laser engraving & metallic record styling
            </p>
          </div>
        </div>

        {/* Type Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-300">Certification Category</label>
          <div className="grid grid-cols-3 gap-2">
            {(['track', 'artist', 'album'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSubjectType(t);
                  setSelectedTitle('');
                  setSelectedSubtitle('');
                }}
                className={`py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                  subjectType === t
                    ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {t} Plaque
              </button>
            ))}
          </div>
        </div>

        {/* Quick Pick from Top Charts */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-400">Quick Pick from Top {subjectType}s</label>
          <div className="flex flex-wrap gap-1.5">
            {quickItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectQuick(item)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition-all truncate max-w-[200px] ${
                  selectedTitle === item.title
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {item.title} ({item.plays})
              </button>
            ))}
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Title (Song / Artist / Album)</label>
            <input
              type="text"
              value={selectedTitle}
              onChange={(e) => setSelectedTitle(e.target.value)}
              placeholder="e.g. Nightcall"
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Subtitle / Artist</label>
            <input
              type="text"
              value={selectedSubtitle}
              onChange={(e) => setSelectedSubtitle(e.target.value)}
              placeholder="e.g. Artist Name"
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        {/* Milestone Tier & Frame Finish */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Certification Milestone</label>
            <select
              value={milestone}
              onChange={(e) => setMilestone(e.target.value as PlaqueMilestone)}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-600"
            >
              <option value="silver">Silver Single (25+ Plays)</option>
              <option value="gold">Gold Record (50+ Plays)</option>
              <option value="platinum">Platinum Plaque (100+ Plays)</option>
              <option value="multi-platinum">2x Multi-Platinum (250+ Plays)</option>
              <option value="diamond">Diamond Disc of Honor (500+ Plays)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-300">Play Count to Inscribe</label>
            <input
              type="number"
              value={scrobblesEarned}
              onChange={(e) => setScrobblesEarned(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        {/* Frame Style */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-300">Museum Frame Finish</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {frameOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFrameStyle(opt.id)}
                className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                  frameStyle === opt.id
                    ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: opt.previewColor }} />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Laser Engraving */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-300">Custom Laser Engraved Inscription</label>
          <textarea
            value={engraving}
            onChange={(e) => setEngraving(e.target.value)}
            rows={2}
            className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-zinc-400 hover:text-white transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleCreate}
            disabled={!selectedTitle.trim()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all`}
          >
            <Plus className="w-4 h-4" />
            <span>Mount on Plaque Wall</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const PlaqueCreatorModal: React.FC<PlaqueCreatorModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) return null;
  return <PlaqueCreatorModalContent {...props} />;
};
