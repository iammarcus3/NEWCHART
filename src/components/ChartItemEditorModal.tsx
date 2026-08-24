import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import {
  X,
  Edit3,
  Image as ImageIcon,
  Lock,
  Flame,
  Award,
  ShieldBan,
  Plus,
  Minus,
  Sparkles,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { ManualChartOverride, MoveStatus } from '../types/music';

const ChartItemEditorModalContent: React.FC<{
  editingChartItem: { type: 'track' | 'artist' | 'album'; item: any };
}> = ({ editingChartItem }) => {
  const {
    setEditingChartItem,
    zeroSettings,
    saveItemOverride,
    removeItemOverride,
    toggleBlacklistKey,
    createCustomPlaque,
  } = useMusic();

  const { type, item } = editingChartItem;
  const key: string = item._key || (type === 'artist' ? item.artist.toLowerCase() : `${item.artist.toLowerCase()}:::${(item.title || '').toLowerCase()}`);
  const existingOverride = zeroSettings.manualOverrides[key];
  const isBlacklisted = zeroSettings.blacklistedKeys.includes(key);

  const [titleOverride, setTitleOverride] = useState(existingOverride?.titleOverride || (type === 'artist' ? item.artist : item.title) || '');
  const [artistOverride, setArtistOverride] = useState(existingOverride?.artistOverride || item.artist || '');
  const [coverArtOverride, setCoverArtOverride] = useState(existingOverride?.coverArtOverride || item.coverArt || '');
  const [pointAdjustment, setPointAdjustment] = useState<number>(existingOverride?.pointAdjustment || 0);
  const [lockedRank, setLockedRank] = useState<number | string>(existingOverride?.lockedRank || '');
  const [forceStatus, setForceStatus] = useState<MoveStatus | 'auto'>(existingOverride?.forceStatus || 'auto');
  const [notes, setNotes] = useState<string>(existingOverride?.notes || '');

  const handleSave = () => {
    const override: ManualChartOverride = {
      key,
      type,
      titleOverride: titleOverride.trim() || undefined,
      artistOverride: artistOverride.trim() || undefined,
      coverArtOverride: coverArtOverride.trim() || undefined,
      pointAdjustment: pointAdjustment !== 0 ? pointAdjustment : undefined,
      lockedRank: lockedRank !== '' ? parseInt(String(lockedRank), 10) : undefined,
      forceStatus: forceStatus !== 'auto' ? forceStatus : undefined,
      notes: notes.trim() || undefined,
      isBlacklisted: false,
    };

    saveItemOverride(override);
    setEditingChartItem(null);
  };

  const handleResetItem = () => {
    removeItemOverride(key);
    setEditingChartItem(null);
  };

  const handleToggleBlacklist = () => {
    toggleBlacklistKey(key);
    setEditingChartItem(null);
  };

  const handleForgePlaque = () => {
    createCustomPlaque({
      subjectTitle: titleOverride || item.title || item.artist,
      subjectSubtitle: artistOverride || item.artist || 'Official Certification',
      subjectType: type,
      coverArt: coverArtOverride || item.coverArt,
      milestone: 'platinum',
      threshold: item.playCount || 100,
      scrobblesEarned: item.playCount || 100,
      awardedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      frameStyle: 'platinum-brushed',
      customEngraving: `COMMEMORATING #1 CHART RUN • ${zeroSettings.chartTitle.toUpperCase()}`,
      isCustom: true,
    });
    setEditingChartItem(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="chart-item-editor-modal"
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={() => setEditingChartItem(null)}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Preview */}
        <div className="flex items-start gap-4">
          <img
            src={coverArtOverride || item.coverArt}
            alt="Cover"
            className="w-16 h-16 rounded-2xl object-cover border border-zinc-700 shadow-md flex-shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';
            }}
          />
          <div className="min-w-0 pr-6">
            <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 inline-block mb-1">
              ZeroCharts Manual Item Editor • {type.toUpperCase()}
            </span>
            <h3 className="text-base font-black text-white truncate">
              {type === 'artist' ? item.artist : item.title}
            </h3>
            <p className="text-xs text-zinc-400 truncate">{item.artist}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 font-mono">
              <span>Current Rank: #{item.rank}</span>
              <span>•</span>
              <span>Points: {item.points}</span>
              <span>•</span>
              <span>Plays: {item.playCount}</span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="space-y-3.5 pt-2 border-t border-zinc-800">
          {/* Title and Artist Fields */}
          {type !== 'artist' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">Track Title Override</label>
              <input
                type="text"
                value={titleOverride}
                onChange={(e) => setTitleOverride(e.target.value)}
                placeholder="Custom title on chart..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-semibold"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Artist Name Override</label>
            <input
              type="text"
              value={artistOverride}
              onChange={(e) => setArtistOverride(e.target.value)}
              placeholder="Custom artist name..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-semibold"
            />
          </div>

          {/* Artwork URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span>Custom Artwork URL</span>
              <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
            </label>
            <input
              type="url"
              value={coverArtOverride}
              onChange={(e) => setCoverArtOverride(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Point Boost & Position Lock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Points Boost (+/-)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPointAdjustment((p) => p - 10)}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  value={pointAdjustment}
                  onChange={(e) => setPointAdjustment(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-center text-cyan-300 font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={() => setPointAdjustment((p) => p + 10)}
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lock Rank (#)</span>
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={lockedRank}
                onChange={(e) => setLockedRank(e.target.value)}
                placeholder="Auto (None)"
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-amber-300 font-mono font-bold placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Force Status badge */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">Force Movement Status Badge</label>
            <div className="grid grid-cols-5 gap-1.5 text-[11px] font-mono">
              {(['auto', 'new', 'up', 'down', 'reentry', 'flat'] as const).slice(0, 5).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setForceStatus(st)}
                  className={`py-1.5 rounded-xl border text-center font-bold uppercase transition-all ${
                    forceStatus === st
                      ? 'bg-zinc-800 text-white border-cyan-400 shadow-sm'
                      : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={handleForgePlaque}
            className="px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Forge Plaque</span>
          </button>

          <button
            type="button"
            onClick={handleToggleBlacklist}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              isBlacklisted
                ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                : 'bg-red-950/40 hover:bg-red-900/50 border-red-500/40 text-red-300'
            }`}
          >
            <ShieldBan className="w-3.5 h-3.5" />
            <span>{isBlacklisted ? 'Unblock Item' : 'Hide from Charts'}</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          {existingOverride ? (
            <button
              type="button"
              onClick={handleResetItem}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Edits</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingChartItem(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-black bg-cyan-400 hover:bg-cyan-300 text-black shadow-lg transition-all"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChartItemEditorModal: React.FC = () => {
  const { editingChartItem } = useMusic();
  if (!editingChartItem) return null;
  return <ChartItemEditorModalContent editingChartItem={editingChartItem} />;
};
