import React, { useState, useEffect, useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  Sparkles,
  ArrowRight,
  Disc,
  Music,
  CheckCircle2,
  RotateCcw,
  Search,
  Filter,
  Layers,
  ChevronDown,
  AlertCircle,
  TrendingUp,
  X,
  Play,
  Zap,
  Info,
} from 'lucide-react';
import {
  AlbumMergeSuggestion,
  UndersizedAlbumCandidate,
} from '../types/albumResolver';
import {
  fetchAiAlbumMergeSuggestions,
  generateClientHeuristicSuggestions,
} from '../utils/albumResolverEngine';
import { formatStreamsFromPlays } from '../utils/streamingUtils';

interface AutoAlbumResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutoAlbumResolverModal: React.FC<AutoAlbumResolverModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    undersizedAlbumCandidates,
    masterAlbumsByArtist,
    mergeSubThreeSongAlbum,
    batchMergeSubThreeSongAlbums,
    revertSubThreeSongMerge,
    resolvedAlbumMergesHistory,
    zeroSettings,
  } = useMusic();
  const { theme } = useTheme();

  const minTracks = Math.max(3, zeroSettings?.minAlbumTracksToChart || 3);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'pending' | 'high_confidence' | 'merged'
  >('all');

  // AI loading and suggestions state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, AlbumMergeSuggestion>>({});
  const [selectedCustomTargets, setSelectedCustomTargets] = useState<Record<string, string>>({});
  const [editingTargetForId, setEditingTargetForId] = useState<string | null>(null);
  const [justMergedIds, setJustMergedIds] = useState<Set<string>>(new Set());

  // Generate initial client suggestions and fetch AI suggestions on open
  useEffect(() => {
    if (!isOpen || undersizedAlbumCandidates.length === 0) return;

    // 1. Instantly provide client heuristic suggestions so there's zero lag
    const instantHeuristics = generateClientHeuristicSuggestions(undersizedAlbumCandidates);
    const initialMap: Record<string, AlbumMergeSuggestion> = {};
    for (const h of instantHeuristics) {
      initialMap[h.candidateId] = h;
    }
    setSuggestions((prev) => ({ ...initialMap, ...prev }));

    // 2. Query Gemini 3.8 Flash discography AI asynchronously
    let isCancelled = false;
    setIsAiLoading(true);

    fetchAiAlbumMergeSuggestions(undersizedAlbumCandidates)
      .then((aiResults) => {
        if (isCancelled) return;
        setSuggestions((prev) => {
          const updated = { ...prev };
          for (const item of aiResults) {
            updated[item.candidateId] = item;
          }
          return updated;
        });
      })
      .catch((err) => {
        console.warn('AI resolution completed with fallback:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsAiLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, undersizedAlbumCandidates]);

  // Total statistics
  const totalUndersizedCount = undersizedAlbumCandidates.length;
  const mergedCount = Object.keys(resolvedAlbumMergesHistory).length;

  // Filtered list
  const filteredCandidates = useMemo(() => {
    return undersizedAlbumCandidates.filter((cand) => {
      const isAlreadyMerged = Boolean(resolvedAlbumMergesHistory[cand.id]);
      const suggestion = suggestions[cand.id];
      const confidence = suggestion?.confidence || 75;

      // Filter by mode
      if (filterMode === 'merged' && !isAlreadyMerged) return false;
      if (filterMode === 'pending' && isAlreadyMerged) return false;
      if (filterMode === 'high_confidence' && (isAlreadyMerged || confidence < 85)) return false;

      // Filter by search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const artistMatch = cand.artist.toLowerCase().includes(query);
        const albumMatch = cand.currentAlbum.toLowerCase().includes(query);
        const trackMatch = cand.tracks.some((t) => t.title.toLowerCase().includes(query));
        const targetMatch = (suggestion?.suggestedMasterAlbum || '').toLowerCase().includes(query);
        return artistMatch || albumMatch || trackMatch || targetMatch;
      }

      return true;
    });
  }, [undersizedAlbumCandidates, resolvedAlbumMergesHistory, suggestions, filterMode, searchTerm]);

  // High confidence suggestions ready to merge
  const highConfidencePending = useMemo(() => {
    return undersizedAlbumCandidates.filter((cand) => {
      const isAlreadyMerged = Boolean(resolvedAlbumMergesHistory[cand.id]);
      if (isAlreadyMerged) return false;
      const s = suggestions[cand.id];
      return s && s.confidence >= 85;
    });
  }, [undersizedAlbumCandidates, resolvedAlbumMergesHistory, suggestions]);

  // Handle single approval & merge
  const handleApproveMerge = async (candidate: UndersizedAlbumCandidate) => {
    const s = suggestions[candidate.id];
    const targetMaster = selectedCustomTargets[candidate.id] || s?.suggestedMasterAlbum || candidate.currentAlbum;
    const trackTitles = candidate.tracks.map((t) => t.title);

    await mergeSubThreeSongAlbum(candidate.artist, candidate.currentAlbum, trackTitles, targetMaster);

    setJustMergedIds((prev) => new Set(prev).add(candidate.id));
    setTimeout(() => {
      setJustMergedIds((prev) => {
        const next = new Set(prev);
        next.delete(candidate.id);
        return next;
      });
    }, 3000);
  };

  // Handle bulk approval of all high-confidence
  const handleApproveAllHighConfidence = async () => {
    const mergesToRun = highConfidencePending.map((cand) => {
      const s = suggestions[cand.id];
      const targetMaster = selectedCustomTargets[cand.id] || s?.suggestedMasterAlbum || cand.currentAlbum;
      return {
        artist: cand.artist,
        currentAlbum: cand.currentAlbum,
        tracks: cand.tracks.map((t) => t.title),
        masterAlbum: targetMaster,
      };
    });

    await batchMergeSubThreeSongAlbums(mergesToRun);
  };

  // Handle Undo
  const handleUndoMerge = async (candidate: UndersizedAlbumCandidate) => {
    const trackTitles = candidate.tracks.map((t) => t.title);
    await revertSubThreeSongMerge(candidate.artist, candidate.currentAlbum, trackTitles);
  };

  if (!isOpen) return null;

  return (
    <div
      id="auto-album-resolver-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden`}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-center justify-between gap-4 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-lg`}>
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Auto AI Album Resolver
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Minimum {minTracks} Songs Rule
                </span>
                {isAiLoading && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 animate-pulse">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    Gemini 3.8 Flash Analyzing Discography...
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                ZeroCharts requires an album to have a minimum of {minTracks} songs to qualify for album charts and certifications. Auto AI identifies standalone singles and EP fragments, predicts their master album, and consolidates them upon your approval.
              </p>
            </div>
          </div>

          <button
            id="close-auto-album-resolver-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats & Quick Actions Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 flex-1">
            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                Undersized Releases
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-white">{totalUndersizedCount}</span>
                <span className="text-[11px] text-zinc-500">(&lt; {minTracks} songs)</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                AI Suggestions Ready
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-amber-400">
                  {Object.keys(suggestions).length}
                </span>
                <span className="text-[11px] text-amber-500/80">discography matches</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                High Confidence (85%+)
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-emerald-400">
                  {highConfidencePending.length}
                </span>
                <span className="text-[11px] text-emerald-500/80">ready to merge</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                Consolidated to Masters
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-cyan-400">{mergedCount}</span>
                <span className="text-[11px] text-cyan-500/80">merged</span>
              </div>
            </div>
          </div>

          {/* Bulk Action */}
          {highConfidencePending.length > 0 && (
            <button
              id="approve-all-high-confidence-btn"
              onClick={handleApproveAllHighConfidence}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 active:scale-95 transition-all flex-shrink-0`}
            >
              <Zap className="w-4 h-4" />
              <span>Approve All High-Confidence ({highConfidencePending.length})</span>
            </button>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950/40">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="album-resolver-search"
              type="text"
              placeholder="Search artist, track, or album..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Segmented Filter Control */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 self-stretch sm:self-auto overflow-x-auto">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Releases ({totalUndersizedCount})
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'pending'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pending Approval ({totalUndersizedCount - mergedCount})
            </button>
            <button
              onClick={() => setFilterMode('high_confidence')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'high_confidence'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              High Confidence ({highConfidencePending.length})
            </button>
            <button
              onClick={() => setFilterMode('merged')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterMode === 'merged'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Merged History ({mergedCount})
            </button>
          </div>
        </div>

        {/* List of Candidates */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredCandidates.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-950/40 border border-zinc-800 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-black text-white">No Undersized Albums Found</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {filterMode === 'merged'
                  ? 'No releases have been merged yet. Switch to "Pending Approval" to review AI recommendations.'
                  : 'Every album in this view currently satisfies the minimum 3-song qualification rule or has been consolidated into its master LP.'}
              </p>
            </div>
          ) : (
            filteredCandidates.map((candidate) => {
              const suggestion = suggestions[candidate.id];
              const isMerged = Boolean(resolvedAlbumMergesHistory[candidate.id]);
              const mergedInfo = resolvedAlbumMergesHistory[candidate.id];
              const isJustMerged = justMergedIds.has(candidate.id);

              const currentTarget =
                selectedCustomTargets[candidate.id] ||
                suggestion?.suggestedMasterAlbum ||
                mergedInfo?.masterAlbum ||
                candidate.currentAlbum;

              const confidence = suggestion?.confidence || 80;
              const reasoning =
                suggestion?.reasoning ||
                `Identified as canonical track in ${candidate.artist}'s discography catalog.`;
              const source = suggestion?.source || 'heuristic-discography';

              const knownMasters = candidate.knownArtistMasterAlbums || [];
              const isTargetMasterInCatalog = knownMasters.some(
                (m) => m.toLowerCase() === currentTarget.toLowerCase()
              );

              return (
                <div
                  key={candidate.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isMerged
                      ? 'bg-zinc-950/70 border-emerald-500/30'
                      : isJustMerged
                      ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/40'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Source: Current Undersized Album */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Current Release Tag:
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {candidate.trackCount} of {minTracks} min songs
                        </span>
                        <span className="text-xs font-mono text-zinc-400">
                          {candidate.totalPlays} plays ({formatStreamsFromPlays(candidate.totalPlays)})
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {candidate.coverArt ? (
                            <img
                              src={candidate.coverArt}
                              alt={candidate.currentAlbum}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Disc className="w-6 h-6 text-zinc-600" />
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-2">
                            <span>{candidate.currentAlbum}</span>
                          </h4>
                          <p className="text-xs font-bold text-amber-400/90">{candidate.artist}</p>
                        </div>
                      </div>

                      {/* Track list preview */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400">
                        <span className="font-semibold text-zinc-500">Tracks included:</span>
                        {candidate.tracks.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-200"
                          >
                            ♫ {t.title} ({t.playCount} plays)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Merge Indicator & AI Confidence */}
                    <div className="flex flex-col items-center justify-center px-2 py-1 text-center">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <ArrowRight className="w-5 h-5 text-amber-400 animate-pulse" />
                      </div>
                      <div className="mt-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            confidence >= 90
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : confidence >= 80
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {confidence}% AI Confidence
                        </span>
                      </div>
                    </div>

                    {/* Target: Master Album Selection */}
                    <div className="flex-1 space-y-2 bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Target Master Album:
                        </span>

                        {isTargetMasterInCatalog ? (
                          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                            In Your Catalog (Qualified LP)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            New Official Master Target
                          </span>
                        )}
                      </div>

                      {/* Target Album input/picker */}
                      {editingTargetForId === candidate.id ? (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={currentTarget}
                            onChange={(e) =>
                              setSelectedCustomTargets((prev) => ({
                                ...prev,
                                [candidate.id]: e.target.value,
                              }))
                            }
                            placeholder="Enter master album title..."
                            className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-amber-500 text-xs text-white font-bold focus:outline-none"
                          />
                          {knownMasters.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap text-[10px] text-zinc-400">
                              <span>Existing masters:</span>
                              {knownMasters.map((m) => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    setSelectedCustomTargets((prev) => ({
                                      ...prev,
                                      [candidate.id]: m,
                                    }));
                                    setEditingTargetForId(null);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => setEditingTargetForId(null)}
                            className="text-[10px] text-amber-400 font-bold hover:underline"
                          >
                            Done Editing
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Disc className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-black text-white">{currentTarget}</span>
                          </div>
                          {!isMerged && (
                            <button
                              onClick={() => setEditingTargetForId(candidate.id)}
                              className="text-[10px] font-bold text-zinc-400 hover:text-amber-400 underline"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      )}

                      {/* AI Reasoning quote */}
                      <p className="text-[11px] text-zinc-400 italic bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                        "{reasoning}"
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex sm:flex-col items-center justify-end gap-2 flex-shrink-0">
                      {isMerged ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Merged
                          </span>
                          <button
                            onClick={() => handleUndoMerge(candidate)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                            title="Undo this album merge"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Undo</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleApproveMerge(candidate)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Merge</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-zinc-500" />
            <span>
              Merging updates parent album tags and re-runs weekly sales, point rankings, and album certifications automatically.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
