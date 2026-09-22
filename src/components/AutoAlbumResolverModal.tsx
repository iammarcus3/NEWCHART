import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Download,
  Upload,
  FileCode,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Check,
  ExternalLink,
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
import { ApprovedAiResolution } from '../types/fixtures';

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
    duplicateClusters,
    mergeClusterVariants,
    unmergeCluster,
    mergeAllClusters,
    albumDuplicateClusters,
    mergeAlbumClusterVariants,
    unmergeAlbumCluster,
    mergeAllAlbumClusters,
    activeFixtures,
    exportFixtures,
    importFixtures,
    approveAiResolution,
    batchApproveAiResolutions,
    revertApprovedResolution,
    recomputeAllHistoricCharts,
    updateZeroSettings,
  } = useMusic();
  const { theme } = useTheme();

  // Tab State
  const [activeTab, setActiveTab] = useState<'singles' | 'tracks' | 'albums' | 'fixtures'>('singles');

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'high_confidence' | 'merged'>('all');

  // Auto-Merge >= 80% Confidence setting (persisted in zeroSettings / localStorage)
  const [autoMergeOver80, setAutoMergeOver80] = useState<boolean>(() => {
    return zeroSettings?.autoMergeOver80PercentConfidence ?? true;
  });

  // AI loading and suggestions state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, AlbumMergeSuggestion>>({});
  const [selectedCustomTargets, setSelectedCustomTargets] = useState<Record<string, string>>({});
  const [editingTargetForId, setEditingTargetForId] = useState<string | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoMergedSessionsRef = useRef<Set<string>>(new Set());

  // Unmerged clusters
  const unmergedTrackClusters = useMemo(() => duplicateClusters.filter((c) => !c.isMerged), [duplicateClusters]);
  const unmergedAlbumClusters = useMemo(() => albumDuplicateClusters.filter((c) => !c.isMerged), [albumDuplicateClusters]);

  // Generate initial client suggestions and fetch AI suggestions on open
  useEffect(() => {
    if (!isOpen || undersizedAlbumCandidates.length === 0) return;

    // 1. Instantly provide client heuristic suggestions so there's zero lag (0ms)
    const instantHeuristics = generateClientHeuristicSuggestions(undersizedAlbumCandidates);
    const initialMap: Record<string, AlbumMergeSuggestion> = {};
    for (const h of instantHeuristics) {
      initialMap[h.candidateId] = h;
    }
    setSuggestions((prev) => ({ ...initialMap, ...prev }));

    // 2. Query Gemini discography AI asynchronously for any remaining ambiguous candidates
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

  // Handle re-scan with AI
  const handleRescanWithAi = async () => {
    setIsAiLoading(true);
    try {
      const results = await fetchAiAlbumMergeSuggestions(undersizedAlbumCandidates);
      setSuggestions((prev) => {
        const updated = { ...prev };
        for (const item of results) {
          updated[item.candidateId] = item;
        }
        return updated;
      });
      // If auto-merge is active, auto-process the re-scanned results
      if (autoMergeOver80) {
        setTimeout(() => {
          executeAutoMergeOver80();
        }, 100);
      }
    } catch (err) {
      console.warn('Re-scan error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Filtered singles candidates
  const filteredCandidates = useMemo(() => {
    return undersizedAlbumCandidates.filter((c) => {
      const trackTitles = c.tracks.map((t) => t.title);
      const matchSearch =
        c.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.currentAlbum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trackTitles.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      const mergeKey = `${c.artist.toLowerCase()}:::${c.currentAlbum.toLowerCase()}`;
      const isMerged = !!resolvedAlbumMergesHistory[mergeKey] || !!activeFixtures?.parentAlbumMappings?.[mergeKey];
      const suggestion = suggestions[c.id];

      if (filterMode === 'pending') return !isMerged;
      if (filterMode === 'merged') return isMerged;
      if (filterMode === 'high_confidence') {
        return !isMerged && (suggestion?.confidence || 0) >= 80;
      }
      return true;
    });
  }, [undersizedAlbumCandidates, searchTerm, filterMode, suggestions, resolvedAlbumMergesHistory, activeFixtures]);

  // High confidence (>= 80%) unmerged count
  const highConfidencePendingCount = useMemo(() => {
    return undersizedAlbumCandidates.filter((c) => {
      const mergeKey = `${c.artist.toLowerCase()}:::${c.currentAlbum.toLowerCase()}`;
      const isMerged = !!resolvedAlbumMergesHistory[mergeKey] || !!activeFixtures?.parentAlbumMappings?.[mergeKey];
      const suggestion = suggestions[c.id];
      return !isMerged && (suggestion?.confidence || 0) >= 80;
    }).length;
  }, [undersizedAlbumCandidates, resolvedAlbumMergesHistory, suggestions, activeFixtures]);

  // Approve single merge
  const handleApproveMerge = async (candidate: UndersizedAlbumCandidate) => {
    const suggestion = suggestions[candidate.id];
    const targetAlbum =
      selectedCustomTargets[candidate.id] ||
      suggestion?.suggestedMasterAlbum ||
      candidate.currentAlbum;

    const resolution: ApprovedAiResolution = {
      id: `single_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'single_to_parent',
      artist: candidate.artist,
      source: candidate.currentAlbum,
      target: targetAlbum,
      tracks: candidate.tracks.map((t) => t.title),
      approvedAt: new Date().toISOString(),
      confidence: suggestion?.confidence ? suggestion.confidence / 100 : 0.9,
      reasoning: suggestion?.reasoning || 'Parent studio album for single release',
    };

    await approveAiResolution(resolution);
  };

  // Undo single merge
  const handleUndoMerge = async (candidate: UndersizedAlbumCandidate) => {
    await revertSubThreeSongMerge(
      candidate.artist,
      candidate.currentAlbum,
      candidate.tracks.map((t) => t.title),
      candidate.currentAlbum
    );
  };

  // Core Batch approve all high-confidence (>= 80%)
  const executeAutoMergeOver80 = async () => {
    const resolutionsToApprove: ApprovedAiResolution[] = [];

    for (const c of undersizedAlbumCandidates) {
      const mergeKey = `${c.artist.toLowerCase()}:::${c.currentAlbum.toLowerCase()}`;
      const isMerged = !!resolvedAlbumMergesHistory[mergeKey] || !!activeFixtures?.parentAlbumMappings?.[mergeKey];
      if (isMerged) continue;

      const suggestion = suggestions[c.id];
      if (suggestion && suggestion.confidence >= 80) {
        const target = selectedCustomTargets[c.id] || suggestion.suggestedMasterAlbum;
        resolutionsToApprove.push({
          id: `single_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'single_to_parent',
          artist: c.artist,
          source: c.currentAlbum,
          target,
          tracks: c.tracks.map((t) => t.title),
          approvedAt: new Date().toISOString(),
          confidence: suggestion.confidence / 100,
          reasoning: suggestion.reasoning,
        });
      }
    }

    if (resolutionsToApprove.length > 0) {
      await batchApproveAiResolutions(resolutionsToApprove);
      setImportNotice({
        type: 'success',
        message: `Auto-merged ${resolutionsToApprove.length} releases with ≥ 80% confidence into parent studio albums! Charts updated.`,
      });
      return resolutionsToApprove.length;
    }
    return 0;
  };

  const handleBatchApproveHighConfidence = async () => {
    await executeAutoMergeOver80();
  };

  // Auto-merge trigger when modal opens or suggestions arrive with >= 80% confidence
  useEffect(() => {
    if (!isOpen || !autoMergeOver80) return;
    if (Object.keys(suggestions).length === 0) return;

    // Find all eligible unmerged candidate IDs with >= 80% confidence that haven't been auto-merged this session
    const eligibleCandidateIds: string[] = [];
    for (const c of undersizedAlbumCandidates) {
      const mergeKey = `${c.artist.toLowerCase()}:::${c.currentAlbum.toLowerCase()}`;
      const isMerged = !!resolvedAlbumMergesHistory[mergeKey] || !!activeFixtures?.parentAlbumMappings?.[mergeKey];
      if (isMerged) continue;

      const s = suggestions[c.id];
      if (s && s.confidence >= 80 && !autoMergedSessionsRef.current.has(c.id)) {
        eligibleCandidateIds.push(c.id);
      }
    }

    if (eligibleCandidateIds.length > 0) {
      for (const id of eligibleCandidateIds) {
        autoMergedSessionsRef.current.add(id);
      }
      executeAutoMergeOver80();
    }
  }, [isOpen, autoMergeOver80, suggestions, undersizedAlbumCandidates, resolvedAlbumMergesHistory, activeFixtures]);

  // Toggle Auto-Merge setting
  const handleToggleAutoMerge = (enabled: boolean) => {
    setAutoMergeOver80(enabled);
    updateZeroSettings?.({ autoMergeOver80PercentConfidence: enabled });
    if (enabled) {
      executeAutoMergeOver80();
    }
  };

  // Handle historic charts recompute
  const handleTriggerRecompute = () => {
    setIsRecomputing(true);
    recomputeAllHistoricCharts();
    setTimeout(() => {
      setIsRecomputing(false);
    }, 600);
  };

  // Handle File Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importFixtures(content);
        if (result.success) {
          setImportNotice({
            type: 'success',
            message: `Successfully imported ${result.addedCount ?? 0} canonical fixtures! All charts updated.`,
          });
        } else {
          setImportNotice({
            type: 'error',
            message: result.error || 'Failed to import fixtures JSON.',
          });
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="auto-album-resolver-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        className={`w-full max-w-5xl h-[95dvh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl ${theme.cardBg} border ${theme.cardBorder} shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-zinc-950/90">
          <div className="w-12 h-1.5 bg-zinc-700/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 sm:p-6 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-lg flex-shrink-0`}>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black text-white tracking-tight truncate sm:whitespace-normal">
                AI Duplication &amp; Merger Hub
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 hidden sm:block">
                Real-Life Chart Deduplication • Multi-Artist Song Crediting • 1-2 Song Parent Album Resolution • Local Fixtures Sync
              </p>
              <p className="text-[10px] text-zinc-400 sm:hidden truncate">
                AI Chart Deduplication &amp; Album Resolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {highConfidencePendingCount > 0 && (
              <button
                onClick={handleBatchApproveHighConfidence}
                id="header-auto-merge-btn"
                className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:brightness-110 active:scale-95 transition-all"
                title={`Instantly merge all ${highConfidencePendingCount} high-confidence (≥ 80%) releases`}
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span className="hidden sm:inline">Auto-Merge ({highConfidencePendingCount})</span>
                <span className="sm:hidden font-bold">{highConfidencePendingCount}</span>
              </button>
            )}

            <button
              onClick={handleRescanWithAi}
              disabled={isAiLoading}
              id="rescan-ai-btn"
              className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-all active:scale-95 ${
                isAiLoading ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              title="Re-query AI for fresh suggestions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden md:inline">{isAiLoading ? 'AI Scanning...' : 'Scan AI'}</span>
            </button>

            <button
              onClick={exportFixtures}
              id="export-fixtures-btn"
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all active:scale-95"
              title="Download canonical fixtures JSON file"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Export Fixtures</span>
            </button>

            <button
              onClick={onClose}
              id="close-resolver-modal-btn"
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close Hub"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Fully Fluid, No Sliders */}
        <div className="px-3 sm:px-5 py-2.5 sm:pt-3 sm:pb-0 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('singles')}
              id="tab-singles"
              className={`min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-none sm:border-b-2 text-xs font-black transition-all ${
                activeTab === 'singles'
                  ? 'bg-amber-500/15 sm:bg-amber-500/5 text-amber-400 sm:border-amber-500 border border-amber-500/30 sm:border-t-0 sm:border-x-0'
                  : 'bg-zinc-900/60 sm:bg-transparent text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <Disc className="w-4 h-4 flex-shrink-0" />
              <span>Singles</span>
              {undersizedAlbumCandidates.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  {undersizedAlbumCandidates.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tracks')}
              id="tab-tracks"
              className={`min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-none sm:border-b-2 text-xs font-black transition-all ${
                activeTab === 'tracks'
                  ? 'bg-amber-500/15 sm:bg-amber-500/5 text-amber-400 sm:border-amber-500 border border-amber-500/30 sm:border-t-0 sm:border-x-0'
                  : 'bg-zinc-900/60 sm:bg-transparent text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <Music className="w-4 h-4 flex-shrink-0" />
              <span>Tracks</span>
              {unmergedTrackClusters.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                  {unmergedTrackClusters.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('albums')}
              id="tab-albums"
              className={`min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-none sm:border-b-2 text-xs font-black transition-all ${
                activeTab === 'albums'
                  ? 'bg-amber-500/15 sm:bg-amber-500/5 text-amber-400 sm:border-amber-500 border border-amber-500/30 sm:border-t-0 sm:border-x-0'
                  : 'bg-zinc-900/60 sm:bg-transparent text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>Albums</span>
              {unmergedAlbumClusters.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                  {unmergedAlbumClusters.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('fixtures')}
              id="tab-fixtures"
              className={`min-h-[44px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-none sm:border-b-2 text-xs font-black transition-all ${
                activeTab === 'fixtures'
                  ? 'bg-amber-500/15 sm:bg-amber-500/5 text-amber-400 sm:border-amber-500 border border-amber-500/30 sm:border-t-0 sm:border-x-0'
                  : 'bg-zinc-900/60 sm:bg-transparent text-zinc-400 hover:text-white border border-transparent'
              }`}
            >
              <FileCode className="w-4 h-4 flex-shrink-0" />
              <span>Fixtures</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                {Object.keys(activeFixtures?.parentAlbumMappings || {}).length +
                  Object.keys(activeFixtures?.trackMerges || {}).length +
                  Object.keys(activeFixtures?.albumMerges || {}).length}
              </span>
            </button>
          </div>

          {/* Quick Recompute Button */}
          <button
            onClick={handleTriggerRecompute}
            disabled={isRecomputing}
            className="w-full sm:w-auto min-h-[40px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 sm:bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-800 sm:border-transparent transition-colors"
            title="Recalculate all historic Friday-to-Thursday weeks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin text-amber-400' : ''}`} />
            <span>Recompute Historic Charts</span>
          </button>
        </div>

        {/* Notifications */}
        {importNotice && (
          <div
            className={`mx-6 mt-4 p-3 rounded-2xl flex items-center justify-between text-xs font-bold border ${
              importNotice.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-red-950/60 border-red-500/50 text-red-200'
            }`}
          >
            <span>{importNotice.message}</span>
            <button
              onClick={() => setImportNotice(null)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: SINGLES -> PARENT ALBUM (<3 SONGS) */}
        {activeTab === 'singles' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Rule Callout Banner & Auto-Merge Controls */}
            <div className="px-4 sm:px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-start sm:items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong>Official Chart Standard:</strong> Releases with 1–2 songs are classified as singles, not albums (Billboard 200 requires ≥3 songs). Matches with ≥ 80% AI confidence merge automatically into parent albums.
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                <button
                  onClick={() => handleToggleAutoMerge(!autoMergeOver80)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    autoMergeOver80
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'
                  }`}
                  title="Toggle automatic merging of high confidence releases"
                >
                  <Zap className={`w-3.5 h-3.5 ${autoMergeOver80 ? 'text-emerald-400 fill-emerald-400' : 'text-zinc-500'}`} />
                  <span>Auto-Merge ≥ 80%: <strong>{autoMergeOver80 ? 'ON' : 'OFF'}</strong></span>
                </button>

                {highConfidencePendingCount > 0 && (
                  <button
                    onClick={handleBatchApproveHighConfidence}
                    className={`min-h-[40px] flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>Merge All ≥ 80% ({highConfidencePendingCount})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 sm:p-4 sm:px-6 border-b border-zinc-800/80 bg-zinc-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by artist, release title, or song..."
                  className="w-full pl-9 pr-4 py-2.5 sm:py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                {(['all', 'pending', 'high_confidence', 'merged'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFilterMode(mode)}
                    className={`min-h-[40px] sm:min-h-0 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      filterMode === mode
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/80'
                    }`}
                  >
                    <span>
                      {mode === 'high_confidence'
                        ? '≥ 80% Confidence'
                        : mode === 'pending'
                        ? 'Pending'
                        : mode === 'merged'
                        ? 'Merged'
                        : 'All'}
                    </span>
                    {mode === 'high_confidence' && highConfidencePendingCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-black/40 text-amber-300">
                        {highConfidencePendingCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-base font-bold text-white">All Singles Organized</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    No releases with &lt; 3 tracks require parent album assignment under the current filter.
                  </p>
                </div>
              ) : (
                filteredCandidates.map((candidate) => {
                  const mergeKey = `${candidate.artist.toLowerCase()}:::${candidate.currentAlbum.toLowerCase()}`;
                  const isMerged = !!resolvedAlbumMergesHistory[mergeKey] || !!activeFixtures?.parentAlbumMappings?.[mergeKey];
                  const suggestion = suggestions[candidate.id];
                  const currentTarget =
                    selectedCustomTargets[candidate.id] ||
                    suggestion?.suggestedMasterAlbum ||
                    candidate.currentAlbum;
                  const confidence = suggestion?.confidence ? suggestion.confidence / 100 : 0.75;
                  const reasoning = suggestion?.reasoning || 'Single track release matched to parent LP';
                  const knownMasters = masterAlbumsByArtist[candidate.artist] || [];

                  return (
                    <div
                      key={candidate.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isMerged
                          ? 'bg-emerald-950/10 border-emerald-500/20'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                        {/* Source Single Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          {candidate.coverArt ? (
                            <img
                              src={candidate.coverArt}
                              alt={candidate.currentAlbum}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-zinc-800 flex-shrink-0 shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                              <Disc className="w-5 h-5 text-zinc-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-amber-400 block truncate">{candidate.artist}</span>
                            <h4 className="text-sm font-black text-white truncate">{candidate.currentAlbum}</h4>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 flex-wrap">
                              <span>{candidate.trackCount} {candidate.trackCount === 1 ? 'song' : 'songs'}</span>
                              <span>•</span>
                              <span>{candidate.totalPlays.toLocaleString()} plays ({formatStreamsFromPlays(candidate.totalPlays)})</span>
                            </div>
                          </div>
                        </div>

                        {/* Arrow separator (Desktop & Mobile) */}
                        <div className="hidden lg:flex items-center justify-center text-zinc-500">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="lg:hidden flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400 rotate-90" />
                          <span>Resolves into:</span>
                        </div>

                        {/* Suggested Master LP */}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400">
                              Assigned Parent Album
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                confidence >= 0.80
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {confidence >= 0.80 && <Zap className="w-3 h-3 fill-emerald-400" />}
                              <span>{Math.round(confidence * 100)}% AI Confidence</span>
                            </span>
                          </div>

                          {editingTargetForId === candidate.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={currentTarget}
                                onChange={(e) =>
                                  setSelectedCustomTargets((prev) => ({
                                    ...prev,
                                    [candidate.id]: e.target.value,
                                  }))
                                }
                                placeholder="Enter parent album title..."
                                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-amber-500 text-xs text-white font-bold focus:outline-none"
                              />
                              {knownMasters.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-zinc-400">
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
                                      className="min-h-[30px] px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 active:scale-95"
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => setEditingTargetForId(null)}
                                className="min-h-[32px] px-2 text-xs text-amber-400 font-bold hover:underline"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Disc className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <span className="text-sm font-black text-white truncate">{currentTarget}</span>
                              </div>
                              {!isMerged && (
                                <button
                                  onClick={() => setEditingTargetForId(candidate.id)}
                                  className="min-h-[36px] px-2 text-xs font-bold text-zinc-400 hover:text-amber-400 underline flex-shrink-0"
                                >
                                  Change
                                </button>
                              )}
                            </div>
                          )}

                          <p className="text-[11px] text-zinc-400 italic bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                            "{reasoning}"
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 flex-shrink-0 w-full lg:w-auto pt-1 lg:pt-0 border-t border-zinc-800/60 lg:border-t-0">
                          {isMerged ? (
                            <div className="flex items-center justify-between lg:justify-end gap-2 w-full lg:w-auto">
                              <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Merged
                              </span>
                              <button
                                onClick={() => handleUndoMerge(candidate)}
                                className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors active:scale-95"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Undo</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleApproveMerge(candidate)}
                              className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve &amp; Merge</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRACK DUPLICATE VARIANTS */}
        {activeTab === 'tracks' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 bg-purple-500/10 border-b border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-200">
              <div className="flex items-start sm:items-center gap-2">
                <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong>Hot 100 Real-Life Standard:</strong> A song has 1 canonical chart history. Acoustic versions, live cuts, radio edits, and remixes consolidate into the primary title. Song credits attribute all featured artists.
                </span>
              </div>
              {unmergedTrackClusters.length > 0 && (
                <button
                  onClick={mergeAllClusters}
                  className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all flex-shrink-0`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Merge All Detected Tracks ({unmergedTrackClusters.length})</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
              {duplicateClusters.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-base font-bold text-white">Tracks 100% Deduplicated</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    No duplicate remixes or version clusters detected. All song plays and chart histories are unified.
                  </p>
                </div>
              ) : (
                duplicateClusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      cluster.isMerged
                        ? 'bg-emerald-950/10 border-emerald-500/20'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <span className="text-xs font-bold text-amber-400 block truncate">{cluster.artist}</span>
                        <h4 className="text-sm font-black text-white flex items-center gap-2 truncate">
                          <Music className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="truncate">{cluster.canonicalTitle}</span>
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                          <span>{cluster.totalCombinedPlays.toLocaleString()} total plays</span>
                          <span>•</span>
                          <span>{cluster.variants.length} versions detected</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cluster.variants.map((v) => (
                            <span
                              key={v.originalTitle}
                              className="px-2 py-0.5 rounded-lg bg-zinc-800/80 text-[11px] text-zinc-300 border border-zinc-700/50"
                            >
                              {v.originalTitle} ({v.playCount} plays)
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-zinc-800/60 sm:border-t-0">
                        {cluster.isMerged ? (
                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Merged
                            </span>
                            <button
                              onClick={() => unmergeCluster(cluster.artist, cluster.variants.map((v) => v.originalTitle))}
                              className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors active:scale-95"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              mergeClusterVariants(
                                cluster.artist,
                                cluster.canonicalTitle,
                                cluster.variants.map((v) => v.originalTitle)
                              )
                            }
                            className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Merge</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ALBUM DELUXE & REISSUES */}
        {activeTab === 'albums' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 bg-blue-500/10 border-b border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-200">
              <div className="flex items-start sm:items-center gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong>Billboard 200 Real-Life Standard:</strong> Deluxe, Tour Edition, Anniversary, and Explicit releases combine into the canonical parent album for 1 unified chart history. Album credits strictly attribute 1 lead artist.
                </span>
              </div>
              {unmergedAlbumClusters.length > 0 && (
                <button
                  onClick={mergeAllAlbumClusters}
                  className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all flex-shrink-0`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Merge All Detected Albums ({unmergedAlbumClusters.length})</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
              {albumDuplicateClusters.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-base font-bold text-white">Albums 100% Consolidated</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    No duplicate deluxe or reissue album variants detected. All album sales and chart runs are unified.
                  </p>
                </div>
              ) : (
                albumDuplicateClusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      cluster.isMerged
                        ? 'bg-emerald-950/10 border-emerald-500/20'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <span className="text-xs font-bold text-amber-400 block truncate">{cluster.artist}</span>
                        <h4 className="text-sm font-black text-white flex items-center gap-2 truncate">
                          <Disc className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="truncate">{cluster.canonicalAlbum}</span>
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                          <span>{cluster.totalCombinedPlays.toLocaleString()} total plays</span>
                          <span>•</span>
                          <span>{cluster.variants.length} editions detected</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {cluster.variants.map((v) => (
                            <span
                              key={v.originalAlbum}
                              className="px-2 py-0.5 rounded-lg bg-zinc-800/80 text-[11px] text-zinc-300 border border-zinc-700/50"
                            >
                              {v.originalAlbum} ({v.playCount} plays)
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-zinc-800/60 sm:border-t-0">
                        {cluster.isMerged ? (
                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                            <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Merged
                            </span>
                            <button
                              onClick={() => unmergeAlbumCluster(cluster.artist, cluster.variants.map((v) => v.originalAlbum))}
                              className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors active:scale-95"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              mergeAlbumClusterVariants(
                                cluster.artist,
                                cluster.canonicalAlbum,
                                cluster.variants.map((v) => v.originalAlbum)
                              )
                            }
                            className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Merge</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CANONICAL FIXTURES & LOCAL FILE SYNC */}
        {activeTab === 'fixtures' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
            {/* Fixtures Explanation Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>Canonical Catalog Fixtures Architecture</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                    All your approved parent album assignments, track merges, and lead artist rules are persistently maintained in your website's canonical fixtures registry. You can export this file as a local JSON file (`canonical_catalog_fixtures.json`) to keep on your computer, edit, or import anytime.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    onClick={exportFixtures}
                    className={`min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Fixtures JSON</span>
                  </button>

                  <label className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer transition-colors active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>Import Fixtures JSON</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* 4 Rule Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500">
                    Parent Album Rules
                  </span>
                  <div className="text-lg sm:text-xl font-black text-amber-400 mt-1">
                    {Object.keys(activeFixtures?.parentAlbumMappings || {}).length}
                  </div>
                  <span className="text-[10px] text-zinc-500 block truncate">Singles mapped to parent LP</span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500">
                    Track Merges
                  </span>
                  <div className="text-lg sm:text-xl font-black text-purple-400 mt-1">
                    {Object.keys(activeFixtures?.trackMerges || {}).length}
                  </div>
                  <span className="text-[10px] text-zinc-500 block truncate">Remix / live unifications</span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500">
                    Album Merges
                  </span>
                  <div className="text-lg sm:text-xl font-black text-blue-400 mt-1">
                    {Object.keys(activeFixtures?.albumMerges || {}).length}
                  </div>
                  <span className="text-[10px] text-zinc-500 block truncate">Deluxe edition unifications</span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                  <span className="text-[10px] uppercase font-black tracking-wider text-zinc-500">
                    Lead Artist Rules
                  </span>
                  <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
                    {Object.keys(activeFixtures?.albumLeadArtistRules || {}).length}
                  </div>
                  <span className="text-[10px] text-zinc-500 block truncate">1-artist album crediting overrides</span>
                </div>
              </div>
            </div>

            {/* Approved Resolutions History Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-sm font-black text-white">
                  Active Approved Resolutions ({activeFixtures?.approvedAiResolutions?.length || 0})
                </h4>
                <button
                  onClick={handleTriggerRecompute}
                  disabled={isRecomputing}
                  className="min-h-[44px] sm:min-h-0 flex items-center gap-1.5 text-xs text-amber-400 hover:underline font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin' : ''}`} />
                  <span>Recompute Historic Charts</span>
                </button>
              </div>

              {(!activeFixtures?.approvedAiResolutions || activeFixtures.approvedAiResolutions.length === 0) ? (
                <div className="text-center py-8 text-xs text-zinc-500 bg-zinc-900/30 rounded-2xl border border-zinc-800/60">
                  No custom resolutions approved yet. Use the other tabs to approve AI suggested parent albums or duplicate clusters.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-900/30">
                  {activeFixtures.approvedAiResolutions.map((res) => (
                    <div
                      key={res.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-zinc-800 text-zinc-300">
                            {res.type.replace(/_/g, ' ')}
                          </span>
                          <span className="font-bold text-amber-400 truncate">{res.artist}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white flex-wrap">
                          <span className="text-zinc-400 font-mono text-[11px] truncate max-w-[200px]">{res.source}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                          <span className="font-bold text-emerald-400 truncate max-w-[200px]">{res.target}</span>
                        </div>
                        {res.reasoning && (
                          <p className="text-[11px] text-zinc-500 italic">"{res.reasoning}"</p>
                        )}
                      </div>

                      <button
                        onClick={() => revertApprovedResolution(res.id)}
                        className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors self-start sm:self-auto active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Revert</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 hidden sm:block" />
            <span className="text-[11px] sm:text-xs">
              All approved merges update weekly charts, certifications, milestones, and artist profiles across the site.
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-colors flex items-center justify-center active:scale-95"
          >
            Close Hub
          </button>
        </div>
      </div>
    </div>
  );
};
