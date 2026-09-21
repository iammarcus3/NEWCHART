import React, { useState, useEffect } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Layers,
  Merge,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Zap,
  Disc,
  Music,
  TrendingUp,
  Tag,
  Radio,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { formatStreamsFromPlays } from '../../utils/streamingUtils';
import { AlbumMergeSuggestion } from '../../types/albumResolver';
import { generateClientHeuristicSuggestions, fetchAiAlbumMergeSuggestions } from '../../utils/albumResolverEngine';

export const TrackCombinerWidget: React.FC = () => {
  const {
    duplicateClusters,
    mergeClusterVariants,
    unmergeCluster,
    mergeAllClusters,
    albumDuplicateClusters,
    mergeAlbumClusterVariants,
    unmergeAlbumCluster,
    mergeAllAlbumClusters,
    openArtistProfile,
    zeroSettings,
    undersizedAlbumCandidates,
    mergeSubThreeSongAlbum,
    revertSubThreeSongMerge,
    resolvedAlbumMergesHistory,
    setIsAutoAlbumResolverOpen,
  } = useMusic();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'albums' | 'tracks' | 'auto_ai'>('albums');
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AlbumMergeSuggestion>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (undersizedAlbumCandidates.length === 0) return;
    const initial = generateClientHeuristicSuggestions(undersizedAlbumCandidates);
    const map: Record<string, AlbumMergeSuggestion> = {};
    for (const item of initial) {
      map[item.candidateId] = item;
    }
    setAiSuggestions(map);

    let cancelled = false;
    setIsAiLoading(true);
    fetchAiAlbumMergeSuggestions(undersizedAlbumCandidates.slice(0, 15))
      .then((res) => {
        if (cancelled) return;
        setAiSuggestions((prev) => {
          const updated = { ...prev };
          for (const s of res) {
            updated[s.candidateId] = s;
          }
          return updated;
        });
      })
      .finally(() => {
        if (!cancelled) setIsAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [undersizedAlbumCandidates]);

  const unmergedAlbumClusters = albumDuplicateClusters.filter((c) => !c.isMerged);
  const unmergedTrackClusters = duplicateClusters.filter((c) => !c.isMerged);

  const albumPlayWeight = zeroSettings?.albumPlayWeight ?? 5000;
  const trackPlayWeight = zeroSettings?.trackPlayWeight ?? 50000;
  const minTracks = Math.max(3, zeroSettings?.minAlbumTracksToChart || 3);

  return (
    <div
      id="track-combiner-widget"
      className={`rounded-3xl p-6 ${theme.cardBg} border ${theme.cardBorder} shadow-xl space-y-6 flex flex-col justify-between`}
    >
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-sm`}>
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Catalog Deduplication & Sales Merger
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Auto-detects duplicates, remasters & deluxe editions with 90–100% similarity to consolidate plays, chart points & units sold.
          </p>
        </div>

        {/* Global Action Button */}
        {activeTab === 'albums' && unmergedAlbumClusters.length > 0 && (
          <button
            id="merge-all-albums-btn"
            onClick={mergeAllAlbumClusters}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all self-start sm:self-auto`}
          >
            <Merge className="w-3.5 h-3.5" />
            <span>Merge All Detected Albums ({unmergedAlbumClusters.length})</span>
          </button>
        )}

        {activeTab === 'tracks' && unmergedTrackClusters.length > 0 && (
          <button
            id="merge-all-tracks-btn"
            onClick={mergeAllClusters}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all self-start sm:self-auto`}
          >
            <Merge className="w-3.5 h-3.5" />
            <span>Merge All Detected Songs ({unmergedTrackClusters.length})</span>
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3">
        <button
          id="tab-album-merger"
          onClick={() => setActiveTab('albums')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'albums'
              ? 'bg-amber-500 text-black shadow-md'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Disc className="w-3.5 h-3.5" />
          <span>Albums Merger</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
              activeTab === 'albums'
                ? 'bg-black/20 text-black font-bold'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {albumDuplicateClusters.length}
          </span>
          {unmergedAlbumClusters.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          id="tab-track-merger"
          onClick={() => setActiveTab('tracks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'tracks'
              ? 'bg-amber-500 text-black shadow-md'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Songs / Tracks Merger</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
              activeTab === 'tracks'
                ? 'bg-black/20 text-black font-bold'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {duplicateClusters.length}
          </span>
          {unmergedTrackClusters.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        {/* 3rd Tab: Auto AI for albums < 3 songs */}
        <button
          id="tab-auto-ai-resolver"
          onClick={() => setActiveTab('auto_ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === 'auto_ai'
              ? 'bg-amber-500 text-black shadow-md'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auto AI: &lt; {minTracks} Songs</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
              activeTab === 'auto_ai'
                ? 'bg-black/20 text-black font-bold'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {undersizedAlbumCandidates.length}
          </span>
          {undersizedAlbumCandidates.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>

        {/* Direct Modal Launcher Button */}
        <button
          id="open-full-album-resolver-modal-btn"
          onClick={() => setIsAutoAlbumResolverOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 border border-amber-500/40 text-amber-300 hover:bg-zinc-800 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Open Auto AI Window</span>
          <ExternalLink className="w-3 h-3 text-zinc-400" />
        </button>
      </div>

      {/* Main List Container */}
      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
        {/* ALBUMS VIEW */}
        {activeTab === 'albums' && (
          <>
            {albumDuplicateClusters.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">Album Catalog is Completely Clean</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  No fragmented deluxe cuts, anniversary editions, or alternate album tag variations detected at the 90–100% similarity threshold.
                </p>
              </div>
            ) : (
              albumDuplicateClusters.map((cluster, cIdx) => {
                const variantAlbums = cluster.variants.map((v) => v.originalAlbum);
                const simScore = cluster.similarityScore || 98.5;
                const estimatedUnits = cluster.estimatedSales || cluster.totalCombinedPlays * albumPlayWeight;
                const formattedStreams = formatStreamsFromPlays(cluster.totalCombinedPlays);

                return (
                  <div
                    key={cluster.id ? `${cluster.id}_${cIdx}` : `album_cluster_${cIdx}`}
                    id={`album-cluster-${cIdx}`}
                    className={`p-4 rounded-2xl border transition-all ${
                      cluster.isMerged
                        ? 'bg-zinc-950/40 border-emerald-500/40'
                        : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white">
                            {cluster.canonicalAlbum}
                          </span>

                          {/* 90-100% Accuracy Badge */}
                          <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            {simScore}% match
                          </span>

                          {cluster.matchReason && (
                            <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                              {cluster.matchReason}
                            </span>
                          )}

                          {cluster.isMerged ? (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              Merged ({cluster.totalCombinedPlays} plays)
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                              Unmerged ({cluster.totalCombinedPlays} plays)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <button
                            onClick={() => openArtistProfile(cluster.artist)}
                            className="text-zinc-400 hover:text-sky-400 font-semibold transition-colors text-left inline-block"
                          >
                            {cluster.artist}
                          </button>

                          <span className="text-zinc-600">•</span>

                          {/* Calculated Units Sold */}
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {estimatedUnits.toLocaleString()} units sold
                          </span>

                          <span className="text-zinc-600">•</span>

                          {/* Simulated Streams */}
                          <span className="text-cyan-400 font-mono text-[11px] flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            {formattedStreams} streams
                          </span>
                        </div>
                      </div>

                      {/* Merge / Unmerge Action Button */}
                      {cluster.isMerged ? (
                        <button
                          onClick={() => unmergeAlbumCluster(cluster.artist, variantAlbums)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-all flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Unmerge
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            mergeAlbumClusterVariants(cluster.artist, cluster.canonicalAlbum, variantAlbums)
                          }
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
                        >
                          <Merge className="w-3.5 h-3.5" /> Combine Album Plays
                        </button>
                      )}
                    </div>

                    {/* Variants Breakdown */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-900 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        <span>Fragmented Album Editions ({cluster.variants.length})</span>
                        <span>Individual Units</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {cluster.variants.map((v, vIdx) => {
                          const variantUnits = v.playCount * albumPlayWeight;
                          return (
                            <div
                              key={vIdx}
                              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800/60 text-zinc-300 font-mono"
                            >
                              <div className="truncate pr-2">
                                <span className="text-zinc-200 font-sans font-medium">{v.originalAlbum}</span>
                                {v.sampleTrackTitle && (
                                  <span className="block text-[10px] text-zinc-500 truncate font-mono">
                                    track: {v.sampleTrackTitle}
                                  </span>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-white font-bold">{v.playCount} plays</span>
                                <span className="block text-[10px] text-emerald-400/90">
                                  {variantUnits.toLocaleString()} units
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* TRACKS / SONGS VIEW */}
        {activeTab === 'tracks' && (
          <>
            {duplicateClusters.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">Song Catalog is Completely Clean</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  No fragmented remasters, radio edits, or alternate track title tags detected.
                </p>
              </div>
            ) : (
              duplicateClusters.map((cluster, cIdx) => {
                const variantTitles = cluster.variants.map((v) => v.originalTitle);
                const simScore = cluster.similarityScore || 98.5;
                const estimatedSongUnits = cluster.totalCombinedPlays * trackPlayWeight;
                const formattedStreams = formatStreamsFromPlays(cluster.totalCombinedPlays);

                return (
                  <div
                    key={cluster.id ? `${cluster.id}_${cIdx}` : `track_cluster_${cIdx}`}
                    id={`track-cluster-${cIdx}`}
                    className={`p-4 rounded-2xl border transition-all ${
                      cluster.isMerged
                        ? 'bg-zinc-950/40 border-emerald-500/40'
                        : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white">
                            {cluster.canonicalTitle}
                          </span>

                          {/* Accuracy Badge */}
                          <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" />
                            {simScore}% match
                          </span>

                          {cluster.matchReason && (
                            <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                              {cluster.matchReason}
                            </span>
                          )}

                          {cluster.isMerged ? (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              Merged ({cluster.totalCombinedPlays} plays)
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                              Unmerged ({cluster.totalCombinedPlays} plays)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <button
                            onClick={() => openArtistProfile(cluster.artist)}
                            className="text-zinc-400 hover:text-sky-400 font-semibold transition-colors text-left inline-block"
                          >
                            {cluster.artist}
                          </button>

                          <span className="text-zinc-600">•</span>

                          {/* Calculated Song Units Sold */}
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {estimatedSongUnits.toLocaleString()} units sold
                          </span>

                          <span className="text-zinc-600">•</span>

                          {/* Simulated Streams */}
                          <span className="text-cyan-400 font-mono text-[11px] flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            {formattedStreams} streams
                          </span>
                        </div>
                      </div>

                      {/* Merge / Unmerge Action Button */}
                      {cluster.isMerged ? (
                        <button
                          onClick={() => unmergeCluster(cluster.artist, variantTitles)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-all flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Unmerge
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            mergeClusterVariants(cluster.artist, cluster.canonicalTitle, variantTitles)
                          }
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
                        >
                          <Merge className="w-3.5 h-3.5" /> Combine Song Plays
                        </button>
                      )}
                    </div>

                    {/* Variants Breakdown */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-900 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                        <span>Fragmented Song Tags ({cluster.variants.length})</span>
                        <span>Individual Units</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {cluster.variants.map((v, vIdx) => {
                          const variantUnits = v.playCount * trackPlayWeight;
                          return (
                            <div
                              key={vIdx}
                              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800/60 text-zinc-300 font-mono"
                            >
                              <span className="truncate pr-2 text-zinc-200 font-sans font-medium">{v.originalTitle}</span>
                              <div className="text-right flex-shrink-0">
                                <span className="text-white font-bold">{v.playCount} plays</span>
                                <span className="block text-[10px] text-emerald-400/90">
                                  {variantUnits.toLocaleString()} units
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* AUTO AI: < 3 SONGS ALBUM RESOLVER VIEW */}
        {activeTab === 'auto_ai' && (
          <div className="space-y-3">
            {/* Context Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">
                  3-Song Album Qualification Enforcement:
                </span>
                Releases with fewer than {minTracks} songs cannot chart on official Album charts or qualify for album certifications. Auto AI scans your library, identifies their canonical parent LP, and merges them with 1-click approval.
              </div>
            </div>

            {undersizedAlbumCandidates.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">All Albums Satisfy the {minTracks}-Song Rule</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Every album in your library contains at least {minTracks} tracks and qualifies for official album charts and sales certifications.
                </p>
              </div>
            ) : (
              undersizedAlbumCandidates.map((cand) => {
                const isMerged = Boolean(resolvedAlbumMergesHistory[cand.id]);
                const mergedRecord = resolvedAlbumMergesHistory[cand.id];
                const s = aiSuggestions[cand.id];
                const targetMaster = mergedRecord?.masterAlbum || s?.suggestedMasterAlbum || cand.currentAlbum;
                const confidence = s?.confidence || 80;
                const reasoning = s?.reasoning || `Matched in ${cand.artist}'s catalog.`;

                return (
                  <div
                    key={cand.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isMerged
                        ? 'bg-zinc-950/70 border-emerald-500/30'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Undersized Album */}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {cand.trackCount} of {minTracks} min songs
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {cand.totalPlays} plays
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-white">{cand.currentAlbum}</h4>
                        <p className="text-[11px] font-bold text-amber-400">{cand.artist}</p>
                      </div>

                      {/* Center: Merge Arrow & AI Suggestion */}
                      <div className="flex-1 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/80 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> Master LP:
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                              confidence >= 90
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {confidence}% AI Match
                          </span>
                        </div>
                        <p className="text-xs font-black text-white flex items-center gap-1">
                          <Disc className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{targetMaster}</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 italic truncate">
                          "{reasoning}"
                        </p>
                      </div>

                      {/* Right: Action */}
                      <div className="flex-shrink-0 self-start sm:self-auto">
                        {isMerged ? (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Merged
                            </span>
                            <button
                              onClick={() =>
                                revertSubThreeSongMerge(
                                  cand.artist,
                                  cand.currentAlbum,
                                  cand.tracks.map((t) => t.title)
                                )
                              }
                              className="text-[11px] font-bold text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                            >
                              Undo
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              mergeSubThreeSongAlbum(
                                cand.artist,
                                cand.currentAlbum,
                                cand.tracks.map((t) => t.title),
                                targetMaster
                              )
                            }
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 active:scale-95 transition-all`}
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

            {/* View Full Modal Launcher */}
            <div className="pt-2 text-center">
              <button
                onClick={() => setIsAutoAlbumResolverOpen(true)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 text-white flex items-center justify-center gap-2 transition-all`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Launch Full Auto AI Album Resolver Modal ({undersizedAlbumCandidates.length} Releases)</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Pill */}
      <div className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            Sales formula: Albums = (plays × 5,000) + (points × 500). Songs = (plays × 50,000) + (points × 50).
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400">
          1 play = 10.875M streams (engagement metric)
        </span>
      </div>
    </div>
  );
};
