import React, { useState, useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  User,
  Disc,
  Music,
  Award,
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Flame,
  Calendar,
  Share2,
  GitMerge,
  Layers,
  CheckCircle2,
  Check,
  AlertCircle,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  computeArtistProfile,
  getAllLibraryArtists,
  ArtistProfileSongEntry,
} from '../utils/artistCrediting';
import { SubjectType } from '../types/music';
import { resolveGenre, GENRE_METADATA } from '../utils/genreEngine';
import {
  detectArtistDuplicateClusters,
  detectArtistAlbumDuplicateClusters,
} from '../utils/trackCombiner';
import { formatStreams, formatStreamsFromPlays } from '../utils/streamingUtils';

interface ArtistProfileModalProps {
  artistName: string | null;
  onClose: () => void;
  onAwardPlaque: (item: {
    title: string;
    subtitle: string;
    type: SubjectType;
    scrobbles: number;
    coverArt?: string;
  }) => void;
}

export const ArtistProfileModal: React.FC<ArtistProfileModalProps> = ({
  artistName,
  onClose,
  onAwardPlaque,
}) => {
  const {
    allProcessedScrobbles,
    allWeeks,
    mergedMap,
    mergedAlbumsMap,
    zeroSettings,
    artistsChart,
    weeklyArtistsChart,
    setActiveArtistProfile,
    setSelectedDetailItem,
    mergeClusterVariants,
    unmergeCluster,
    mergeAlbumClusterVariants,
    unmergeAlbumCluster,
  } = useMusic();
  const { theme } = useTheme();

  const [searchArtistQuery, setSearchArtistQuery] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [songViewMode, setSongViewMode] = useState<'byYear' | 'sales' | 'peak' | 'plays'>('byYear');
  const [activeTab, setActiveTab] = useState<'all' | 'albums' | 'songs' | 'dedup'>('all');
  const [dedupSubTab, setDedupSubTab] = useState<'albums' | 'songs'>('albums');

  // Compute profile data using ultra-fast inverted index & LRU cache
  const profile = useMemo(() => {
    if (!artistName) return null;
    return computeArtistProfile(
      artistName,
      allProcessedScrobbles,
      allWeeks,
      mergedMap,
      zeroSettings,
      mergedAlbumsMap
    );
  }, [artistName, allProcessedScrobbles, allWeeks, mergedMap, zeroSettings, mergedAlbumsMap]);

  // Fast O(1) genre resolver for table rows to keep rendering instant
  const getFastGenre = (artist: string, title?: string) => {
    const key = resolveGenre(artist, title);
    return GENRE_METADATA[key] || { name: 'Pop', color: '#ec4899' };
  };

  // Filtered albums based on search query
  const filteredAlbums = useMemo(() => {
    if (!profile) return [];
    if (!catalogSearch.trim()) return profile.albums;
    const q = catalogSearch.toLowerCase();
    return profile.albums.filter((a) => a.name.toLowerCase().includes(q));
  }, [profile, catalogSearch]);

  // All unique songs flat list for alternate sorting views
  const allSongsList = useMemo(() => {
    if (!profile) return [];
    const list: ArtistProfileSongEntry[] = [];
    profile.songsByYear.forEach((yr) => {
      list.push(...yr.songs);
    });
    return list;
  }, [profile]);

  const filteredSongsList = useMemo(() => {
    let list = allSongsList;
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.titleDisplay.toLowerCase().includes(q) ||
          (s.album && s.album.toLowerCase().includes(q))
      );
    }
    if (songViewMode === 'sales') {
      return [...list].sort((a, b) => b.salesBase - a.salesBase);
    }
    if (songViewMode === 'peak') {
      return [...list].sort((a, b) => {
        if (a.peakRank !== b.peakRank) return a.peakRank - b.peakRank;
        return b.salesBase - a.salesBase;
      });
    }
    if (songViewMode === 'plays') {
      return [...list].sort((a, b) => b.playCount - a.playCount);
    }
    return list;
  }, [allSongsList, catalogSearch, songViewMode]);

  // Compute artist-specific album duplicate clusters (90-100% similarity threshold)
  const artistAlbumClusters = useMemo(() => {
    if (!profile?.artistName || activeTab !== 'dedup') return [];
    return detectArtistAlbumDuplicateClusters(
      profile.artistName,
      allProcessedScrobbles,
      mergedAlbumsMap,
      0.90,
      zeroSettings
    );
  }, [profile?.artistName, allProcessedScrobbles, mergedAlbumsMap, activeTab, zeroSettings]);

  // Compute artist-specific track duplicate clusters lazily only when viewing the dedup tab
  const artistTrackClusters = useMemo(() => {
    if (!profile?.artistName || activeTab !== 'dedup') return [];
    return detectArtistDuplicateClusters(profile.artistName, allProcessedScrobbles, mergedMap);
  }, [profile?.artistName, allProcessedScrobbles, mergedMap, activeTab]);

  const mergedAlbumClustersCount = useMemo(() => {
    return artistAlbumClusters.filter((c) => c.isMerged).length;
  }, [artistAlbumClusters]);

  const mergedTrackClustersCount = useMemo(() => {
    return artistTrackClusters.filter((c) => c.isMerged).length;
  }, [artistTrackClusters]);

  const handleMergeAllAlbumsForArtist = () => {
    if (!profile?.artistName) return;
    for (const cluster of artistAlbumClusters) {
      const variantAlbums = cluster.variants.map((v) => v.originalAlbum);
      mergeAlbumClusterVariants(cluster.artist, cluster.canonicalAlbum, variantAlbums);
    }
  };

  const handleMergeAllTracksForArtist = () => {
    if (!profile?.artistName) return;
    for (const cluster of artistTrackClusters) {
      const variantTitles = cluster.variants.map((v) => v.originalTitle);
      mergeClusterVariants(cluster.artist, cluster.canonicalTitle, variantTitles);
    }
  };

  // Instant global search of all known library artists
  const allKnownArtists = useMemo(() => {
    return getAllLibraryArtists(allProcessedScrobbles);
  }, [allProcessedScrobbles]);

  const filteredKnownArtists = useMemo(() => {
    if (!searchArtistQuery.trim()) return allKnownArtists.slice(0, 10);
    const q = searchArtistQuery.toLowerCase();
    return allKnownArtists.filter((a) => a.toLowerCase().includes(q)).slice(0, 15);
  }, [allKnownArtists, searchArtistQuery]);

  if (!artistName || !profile) return null;

  // Format compact numbers (e.g. 1.2M, 450K, 12)
  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  };

  // Helper for certification badge
  const renderCertBadge = (label: string, tier: string | null) => {
    if (!label || label === '—' || !tier) {
      return <span className="text-zinc-600 font-mono text-xs">—</span>;
    }

    let badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    let iconColor = 'text-amber-400';

    if (tier === 'diamond') {
      badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/20';
      iconColor = 'text-cyan-400';
    } else if (tier === 'platinum' || tier === 'multi-platinum') {
      badgeClass = 'bg-slate-300/20 text-slate-200 border-slate-400/40 shadow-slate-500/10';
      iconColor = 'text-slate-300';
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border shadow-sm ${badgeClass}`}
      >
        <Award className={`w-3.5 h-3.5 ${iconColor}`} />
        <span>{label}</span>
      </span>
    );
  };

  // Helper to format cert line in hierarchical prestige order
  const formatCertLine = (counts: Record<string, number> | undefined) => {
    if (!counts || Object.keys(counts).length === 0) return 'None';
    const tierConfig: Record<string, { label: string; priority: number }> = {
      diamond: { label: 'Diamond', priority: 4 },
      'multi-platinum': { label: 'Multi-Platinum', priority: 3 },
      platinum: { label: 'Platinum', priority: 2 },
      gold: { label: 'Gold', priority: 1 },
    };

    return Object.entries(counts)
      .sort((a, b) => {
        const prioA = tierConfig[a[0].toLowerCase()]?.priority || 0;
        const prioB = tierConfig[b[0].toLowerCase()]?.priority || 0;
        return prioB - prioA;
      })
      .map(([k, v]) => `${tierConfig[k.toLowerCase()]?.label || k}: ${v}`)
      .join(' | ');
  };

  // Album certs summary line (strict minimum 3 songs per album)
  const albumCertsLine = formatCertLine(profile?.albumCertCounts);

  // Track certs summary line
  const trackCertsLine = formatCertLine(profile?.trackCertCounts);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        id="artist-profile-page"
        className="w-full max-w-6xl h-full sm:h-auto sm:max-h-[94vh] bg-zinc-950 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div
              className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-md flex-shrink-0`}
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-400 block truncate">
                Artist Discography &amp; Chart Archive
              </span>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                {profile.artistName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() =>
                onAwardPlaque({
                  title: profile.artistName,
                  subtitle: 'Career Artist Achievement',
                  type: 'artist',
                  scrobbles: profile.totalPlays,
                  coverArt:
                    profile.albums[0]?.coverArt ||
                    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop&q=80',
                })
              }
              className={`hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all cursor-pointer`}
            >
              <Award className="w-4 h-4" />
              <span>Forge Plaque</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800 cursor-pointer"
              aria-label="Close artist profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Artist Search & Filter Bar */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-900/40 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search or switch artist..."
              value={searchArtistQuery}
              onChange={(e) => setSearchArtistQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {filteredKnownArtists.length > 0 && searchArtistQuery && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full custom-scrollbar">
              <span className="text-zinc-500 text-xs pr-1 font-semibold">Switch to:</span>
              {filteredKnownArtists.map((art) => (
                <button
                  key={art}
                  onClick={() => {
                    setActiveArtistProfile(art);
                    setSearchArtistQuery('');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    art.toLowerCase() === profile.artistName.toLowerCase()
                      ? 'bg-amber-500 text-black font-bold'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                  }`}
                >
                  {art}
                </button>
              ))}
            </div>
          )}

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-bold overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setActiveTab('albums')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'albums'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Albums ({profile.albums.length})
            </button>
            <button
              onClick={() => setActiveTab('songs')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'songs'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Songs ({profile.totalSongsCharted})
            </button>
            <button
              onClick={() => setActiveTab('dedup')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'dedup'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Deduplicator ({artistAlbumClusters.length + artistTrackClusters.length})</span>
            </button>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* HIGH-READABILITY BENTO STATS GRID */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Career Chart &amp; Sales Achievements</span>
              </span>
              <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-3">
                <span>Albums: <strong className="text-amber-400">{albumCertsLine}</strong></span>
                <span>•</span>
                <span>Songs: <strong className="text-sky-400">{trackCertsLine}</strong></span>
              </div>
            </div>

            {/* Responsive Metrics Grid: 2 cols on mobile, 4 on tablet, 8 on wide */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
              {/* Certified Units */}
              <div className="p-3 rounded-2xl bg-gradient-to-b from-amber-500/15 to-transparent border border-amber-500/30 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 mb-0.5">
                  Certified Units
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-white">
                  {fmt(profile.totalCalculatedUnits)}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">verified sales</span>
              </div>

              {/* Charted Songs */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-sky-400 mb-0.5">
                  Charted Songs
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-sky-300">
                  {profile.totalSongsCharted}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">Hot 100 entries</span>
              </div>

              {/* #1 Songs */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-amber-500/20 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 mb-0.5">
                  #1 Songs
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-amber-300">
                  {profile.distinctNum1Songs}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">distinct hits</span>
              </div>

              {/* Weeks at #1 */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-amber-500/20 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 mb-0.5">
                  Weeks at #1
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-amber-300">
                  {profile.totalNum1Weeks}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">weeks on top</span>
              </div>

              {/* Top 10s */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-sky-400 mb-0.5">
                  Top 10s
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-sky-300">
                  {profile.totalTop10s}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">top 10 hits</span>
              </div>

              {/* #1 Debuts */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-400 mb-0.5">
                  #1 Debuts
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-purple-300">
                  {profile.debutAt1Count}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">straight to #1</span>
              </div>

              {/* Total Plays */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 mb-0.5">
                  Total Plays
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-white">
                  {fmt(profile.totalPlays)}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">scrobbles</span>
              </div>

              {/* Simulated Streams */}
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-cyan-500/20 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-cyan-400 mb-0.5">
                  Streams
                </span>
                <span className="text-base sm:text-xl font-black font-mono text-cyan-300">
                  {profile.totalStreams !== undefined ? formatStreams(profile.totalStreams) : '—'}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono mt-0.5">simulated</span>
              </div>
            </div>

            {/* In-Catalog Search Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
              <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                placeholder={`Filter ${profile.artistName}'s songs or albums...`}
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {catalogSearch && (
                <button
                  onClick={() => setCatalogSearch('')}
                  className="text-xs text-zinc-500 hover:text-white px-2 py-0.5 rounded cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Section 1: ALBUMS */}
          {(activeTab === 'all' || activeTab === 'albums') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight border-b-2 border-zinc-700 pb-0.5">
                    Albums ({filteredAlbums.length})
                  </h2>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    Min. 3 Songs
                  </span>
                </div>
              </div>

              {/* MOBILE CARDS VIEW (Clean, Large, Touch-Friendly) */}
              <div className="block sm:hidden space-y-2.5">
                {filteredAlbums.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-500 text-xs italic">
                    No qualifying albums found (releases require at least 3 songs).
                  </div>
                ) : (
                  filteredAlbums.map((alb) => {
                    const genreInfo = getFastGenre(profile.artistName, alb.name);

                    return (
                      <div
                        key={alb.key}
                        onClick={() =>
                          setSelectedDetailItem({
                            type: 'album',
                            data: {
                              title: alb.name,
                              artist: profile.artistName,
                              playCount: alb.playCount,
                              coverArt: alb.coverArt,
                            },
                          })
                        }
                        className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3.5 cursor-pointer shadow-md group"
                      >
                        <img
                          src={
                            alb.coverArt ||
                            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop&q=80'
                          }
                          alt={alb.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-xl object-cover border border-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                        />

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                              {alb.name}
                            </h3>
                            {alb.peakRank ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-black font-mono flex-shrink-0 ${
                                  alb.peakRank === 1
                                    ? 'bg-amber-400 text-black shadow-sm'
                                    : 'bg-zinc-800 text-white'
                                }`}
                              >
                                #{alb.peakRank}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-mono">—</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-amber-400 font-bold">{fmt(alb.salesBase)} units</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-300">{fmt(alb.playCount)} plays</span>
                            {alb.streamsBase !== undefined && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-cyan-400">{formatStreams(alb.streamsBase)}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                            <span>{alb.weeksOnChart ? `${alb.weeksOnChart} wks` : 'Uncharted'}</span>
                            <span>•</span>
                            <span>{alb.tracksCount} tracks</span>
                            <span className="ml-auto inline-flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: genreInfo.color }}
                              />
                              <span className="text-zinc-400">{genreInfo.name}</span>
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white flex-shrink-0 transition-colors" />
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP TABLE VIEW (Spacious, High-Contrast) */}
              <div className="hidden sm:block border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-md">
                <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 z-10 font-mono">
                      <tr>
                        <th className="p-3.5">Album</th>
                        <th className="p-3.5">Certified Sales</th>
                        <th className="p-3.5">Streams / Plays</th>
                        <th className="p-3.5">Peak</th>
                        <th className="p-3.5">Weeks</th>
                        <th className="p-3.5">Tracks</th>
                        <th className="p-3.5">Certification</th>
                        <th className="p-3.5">Primary Genre</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-sm">
                      {filteredAlbums.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-6 text-center text-zinc-500 italic">
                            No qualifying albums found (releases must have at least 3 songs).
                          </td>
                        </tr>
                      ) : (
                        filteredAlbums.map((alb) => {
                          const genreInfo = getFastGenre(profile.artistName, alb.name);

                          return (
                            <tr
                              key={alb.key}
                              className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                              onClick={() =>
                                setSelectedDetailItem({
                                  type: 'album',
                                  data: {
                                    title: alb.name,
                                    artist: profile.artistName,
                                    playCount: alb.playCount,
                                    coverArt: alb.coverArt,
                                  },
                                })
                              }
                            >
                              <td className="p-3.5 font-semibold text-white">
                                <div className="flex items-center gap-3">
                                  {alb.coverArt && (
                                    <img
                                      src={alb.coverArt}
                                      alt={alb.name}
                                      referrerPolicy="no-referrer"
                                      className="w-10 h-10 rounded-xl object-cover border border-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                                    />
                                  )}
                                  <div>
                                    <span className="text-sky-400 group-hover:underline font-bold text-sm block">
                                      {alb.name}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-amber-400">
                                {fmt(alb.salesBase)} units
                              </td>
                              <td className="p-3.5 font-mono text-zinc-300">
                                <div>{fmt(alb.playCount)}</div>
                                {alb.streamsBase !== undefined && (
                                  <div className="text-xs text-cyan-400 font-sans">
                                    {formatStreams(alb.streamsBase)} streams
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 font-mono font-bold">
                                {alb.peakRank ? (
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-black inline-flex items-center gap-1 ${
                                      alb.peakRank === 1
                                        ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40'
                                        : 'text-white'
                                    }`}
                                  >
                                    {alb.peakRank === 1 && <Trophy className="w-3 h-3 text-amber-400" />}
                                    #{alb.peakRank}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">—</span>
                                )}
                              </td>
                              <td className="p-3.5 font-mono text-zinc-400">
                                {alb.weeksOnChart ? `${alb.weeksOnChart} wks` : '—'}
                              </td>
                              <td className="p-3.5 font-mono text-zinc-400">
                                {alb.tracksCount} tracks
                              </td>
                              <td className="p-3.5">
                                {renderCertBadge(alb.certLabel, alb.certTier)}
                              </td>
                              <td className="p-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: genreInfo.color }}
                                  />
                                  <span>{genreInfo.name}</span>
                                </span>
                              </td>
                              <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() =>
                                    onAwardPlaque({
                                      title: alb.name,
                                      subtitle: profile.artistName,
                                      type: 'album',
                                      scrobbles: alb.playCount,
                                      coverArt: alb.coverArt,
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-300 border border-zinc-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>Plaque</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: SONGS */}
          {(activeTab === 'all' || activeTab === 'songs') && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Music className="w-5 h-5 text-sky-400" />
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight border-b-2 border-zinc-700 pb-0.5">
                    Songs ({filteredSongsList.length})
                  </h2>
                </div>

                {/* View Mode Controls */}
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-bold overflow-x-auto max-w-full">
                  <span className="text-zinc-500 px-2 text-[10px] uppercase font-bold">View:</span>
                  <button
                    onClick={() => setSongViewMode('byYear')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      songViewMode === 'byYear'
                        ? 'bg-zinc-800 text-sky-400 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Debut Year
                  </button>
                  <button
                    onClick={() => setSongViewMode('sales')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      songViewMode === 'sales'
                        ? 'bg-zinc-800 text-amber-400 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    By Sales
                  </button>
                  <button
                    onClick={() => setSongViewMode('peak')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      songViewMode === 'peak'
                        ? 'bg-zinc-800 text-cyan-400 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    By Peak
                  </button>
                  <button
                    onClick={() => setSongViewMode('plays')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      songViewMode === 'plays'
                        ? 'bg-zinc-800 text-emerald-400 font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    By Plays
                  </button>
                </div>
              </div>

              {/* MOBILE CARDS VIEW FOR SONGS */}
              <div className="block sm:hidden space-y-2.5">
                {filteredSongsList.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-500 text-xs italic">
                    No charted songs recorded for this artist.
                  </div>
                ) : (
                  filteredSongsList.map((song) => {
                    const genreInfo = getFastGenre(
                      song.artistDisplay || profile.artistName,
                      song.titleDisplay
                    );

                    return (
                      <div
                        key={song.key}
                        onClick={() =>
                          setSelectedDetailItem({
                            type: 'track',
                            data: {
                              title: song.titleDisplay,
                              artist: song.artistDisplay || profile.artistName,
                              playCount: song.playCount,
                              coverArt: song.coverArt,
                            },
                          })
                        }
                        className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-3.5 cursor-pointer shadow-md group"
                      >
                        {song.coverArt ? (
                          <img
                            src={song.coverArt}
                            alt={song.titleDisplay}
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 rounded-xl object-cover border border-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                            <Music className="w-6 h-6 text-zinc-500" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors truncate">
                              {song.titleDisplay}
                            </h3>
                            {song.peakRank ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-black font-mono flex-shrink-0 ${
                                  song.peakRank === 1
                                    ? 'bg-amber-400 text-black shadow-sm'
                                    : 'bg-zinc-800 text-white'
                                }`}
                              >
                                #{song.peakRank}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-mono">—</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-amber-400 font-bold">{fmt(song.salesBase)} units</span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-300">{fmt(song.playCount)} plays</span>
                            {song.streamsBase !== undefined && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-cyan-400">{formatStreams(song.streamsBase)}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                            <span>{song.weeksOnChart} wks</span>
                            {song.num1s > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 font-bold">{song.num1s}w at #1</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{song.debutYear}</span>
                            <span className="ml-auto inline-flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: genreInfo.color }}
                              />
                              <span className="text-zinc-400">{genreInfo.name}</span>
                            </span>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white flex-shrink-0 transition-colors" />
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP TABLE VIEW FOR SONGS */}
              <div className="hidden sm:block border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-md">
                <div className="max-h-[55vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 z-10 font-mono">
                      <tr>
                        <th className="p-3.5">Title</th>
                        <th className="p-3.5">Certified Sales</th>
                        <th className="p-3.5">Streams</th>
                        <th className="p-3.5">Weeks</th>
                        <th className="p-3.5">Hot 100 Peak</th>
                        <th className="p-3.5">#1 Weeks</th>
                        <th className="p-3.5">Certification</th>
                        <th className="p-3.5">Genre</th>
                        <th className="p-3.5">Debut</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-sm">
                      {filteredSongsList.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-6 text-center text-zinc-500 italic">
                            No charted songs recorded for this artist.
                          </td>
                        </tr>
                      ) : songViewMode === 'byYear' && !catalogSearch.trim() ? (
                        profile.songsByYear.map((yrGroup) => (
                          <React.Fragment key={yrGroup.year}>
                            {/* Year Divider Banner */}
                            <tr className="bg-black text-sky-400 font-black border-y border-zinc-800">
                              <td colSpan={10} className="px-4 py-2 text-sm tracking-wide">
                                {yrGroup.year}
                              </td>
                            </tr>

                            {/* Year Statistics Subheader */}
                            <tr className="bg-zinc-900/90 text-zinc-300 font-medium text-xs border-b border-zinc-800">
                              <td colSpan={10} className="px-4 py-1.5 italic font-mono">
                                🎵 Songs: {yrGroup.songsCount} &nbsp;|&nbsp; 🥇 #1 songs:{' '}
                                {yrGroup.num1sCount} &nbsp;|&nbsp; 🔟 Top 10s: {yrGroup.top10sCount}
                              </td>
                            </tr>

                            {/* Songs for this year */}
                            {yrGroup.songs.map((song) => {
                              const genreInfo = getFastGenre(
                                song.artistDisplay || profile.artistName,
                                song.titleDisplay
                              );

                              return (
                                <tr
                                  key={song.key}
                                  className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                                  onClick={() =>
                                    setSelectedDetailItem({
                                      type: 'track',
                                      data: {
                                        title: song.titleDisplay,
                                        artist: song.artistDisplay || profile.artistName,
                                        playCount: song.playCount,
                                        coverArt: song.coverArt,
                                      },
                                    })
                                  }
                                >
                                  <td className="p-3.5 font-semibold text-white">
                                    <div className="flex items-center gap-3">
                                      {song.coverArt && (
                                        <img
                                          src={song.coverArt}
                                          alt={song.titleDisplay}
                                          referrerPolicy="no-referrer"
                                          className="w-9 h-9 rounded-xl object-cover border border-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                                        />
                                      )}
                                      <div>
                                        <div className="text-sky-400 group-hover:underline flex items-center gap-1.5 font-bold text-sm">
                                          <span>{song.titleDisplay}</span>
                                          {song.peakRank === 1 && (
                                            <span className="text-[10px] font-black px-1.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                              #1
                                            </span>
                                          )}
                                        </div>
                                        {song.artistDisplay.toLowerCase() !==
                                          profile.artistName.toLowerCase() && (
                                          <p className="text-xs text-zinc-500 mt-0.5">
                                            Credited with: {song.artistDisplay}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3.5 font-mono font-bold text-amber-400">
                                    {fmt(song.salesBase)} units
                                  </td>
                                  <td className="p-3.5 font-mono text-zinc-300">
                                    <div>{fmt(song.playCount)}</div>
                                    {song.streamsBase !== undefined && (
                                      <div className="text-xs text-cyan-400 font-sans">
                                        {formatStreams(song.streamsBase)} streams
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3.5 font-mono text-zinc-400">
                                    {song.weeksOnChart} wks
                                  </td>
                                  <td className="p-3.5 font-mono font-bold text-white">
                                    {song.peakRank === 1 ? (
                                      <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                        <Trophy className="w-3 h-3 text-amber-400" />
                                        #1
                                      </span>
                                    ) : (
                                      `#${song.peakRank}`
                                    )}
                                  </td>
                                  <td className="p-3.5 font-mono text-amber-400 font-bold">
                                    {song.num1s > 0 ? `${song.num1s}w` : '—'}
                                  </td>
                                  <td className="p-3.5">
                                    {renderCertBadge(song.certLabel, song.certTier)}
                                  </td>
                                  <td className="p-3.5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: genreInfo.color }}
                                      />
                                      <span>{genreInfo.name}</span>
                                    </span>
                                  </td>
                                  <td className="p-3.5 font-mono text-zinc-400">
                                    {song.debutYear}
                                  </td>
                                  <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() =>
                                        onAwardPlaque({
                                          title: song.titleDisplay,
                                          subtitle: song.artistDisplay,
                                          type: 'track',
                                          scrobbles: song.playCount,
                                          coverArt: song.coverArt,
                                        })
                                      }
                                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-300 border border-zinc-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Award className="w-3.5 h-3.5" />
                                      <span>Plaque</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))
                      ) : (
                        filteredSongsList.map((song) => {
                          const genreInfo = getFastGenre(
                            song.artistDisplay || profile.artistName,
                            song.titleDisplay
                          );

                          return (
                            <tr
                              key={song.key}
                              className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                              onClick={() =>
                                setSelectedDetailItem({
                                  type: 'track',
                                  data: {
                                    title: song.titleDisplay,
                                    artist: song.artistDisplay || profile.artistName,
                                    playCount: song.playCount,
                                    coverArt: song.coverArt,
                                  },
                                })
                              }
                            >
                              <td className="p-3.5 font-semibold text-white">
                                <div className="flex items-center gap-3">
                                  {song.coverArt && (
                                    <img
                                      src={song.coverArt}
                                      alt={song.titleDisplay}
                                      referrerPolicy="no-referrer"
                                      className="w-9 h-9 rounded-xl object-cover border border-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                                    />
                                  )}
                                  <div>
                                    <div className="text-sky-400 group-hover:underline flex items-center gap-1.5 font-bold text-sm">
                                      <span>{song.titleDisplay}</span>
                                      {song.peakRank === 1 && (
                                        <span className="text-[10px] font-black px-1.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                          #1
                                        </span>
                                      )}
                                    </div>
                                    {song.artistDisplay.toLowerCase() !==
                                      profile.artistName.toLowerCase() && (
                                      <p className="text-xs text-zinc-500 mt-0.5">
                                        Credited with: {song.artistDisplay}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5 font-mono font-bold text-amber-400">
                                {fmt(song.salesBase)} units
                              </td>
                              <td className="p-3.5 font-mono text-zinc-300">
                                <div>{fmt(song.playCount)}</div>
                                {song.streamsBase !== undefined && (
                                  <div className="text-xs text-cyan-400 font-sans">
                                    {formatStreams(song.streamsBase)} streams
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 font-mono text-zinc-400">
                                {song.weeksOnChart} wks
                              </td>
                              <td className="p-3.5 font-mono font-bold text-white">
                                {song.peakRank === 1 ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                    <Trophy className="w-3 h-3 text-amber-400" />
                                    #1
                                  </span>
                                ) : (
                                  `#${song.peakRank}`
                                )}
                              </td>
                              <td className="p-3.5 font-mono text-amber-400 font-bold">
                                {song.num1s > 0 ? `${song.num1s}w` : '—'}
                              </td>
                              <td className="p-3.5">
                                {renderCertBadge(song.certLabel, song.certTier)}
                              </td>
                              <td className="p-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-300 border border-zinc-800">
                                  <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: genreInfo.color }}
                                  />
                                  <span>{genreInfo.name}</span>
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-zinc-400">
                                {song.debutYear}
                              </td>
                              <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() =>
                                    onAwardPlaque({
                                      title: song.titleDisplay,
                                      subtitle: song.artistDisplay,
                                      type: 'track',
                                      scrobbles: song.playCount,
                                      coverArt: song.coverArt,
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-300 border border-zinc-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>Plaque</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: DEDUPLICATOR / REMASTER COMBINER */}
          {activeTab === 'dedup' && (
            <div className="space-y-4">
              {/* Header Box with Sub-Tab Selector */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <GitMerge className="w-5 h-5 text-amber-400" />
                      <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                        Remaster &amp; Deluxe Catalog Deduplicator
                      </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      Consolidate alternate album editions and song remasters with 90–100% similarity to unify sales and chart metrics for {profile.artistName}.
                    </p>
                  </div>

                  {dedupSubTab === 'albums' && artistAlbumClusters.length > 0 && (
                    <button
                      onClick={handleMergeAllAlbumsForArtist}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Merge All {artistAlbumClusters.length} Albums</span>
                    </button>
                  )}

                  {dedupSubTab === 'songs' && artistTrackClusters.length > 0 && (
                    <button
                      onClick={handleMergeAllTracksForArtist}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Merge All {artistTrackClusters.length} Songs</span>
                    </button>
                  )}
                </div>

                {/* Sub-tab navigation */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                  <button
                    onClick={() => setDedupSubTab('albums')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      dedupSubTab === 'albums'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Disc className="w-4 h-4" />
                    <span>Album Clusters ({artistAlbumClusters.length})</span>
                    {artistAlbumClusters.length - mergedAlbumClustersCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={() => setDedupSubTab('songs')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      dedupSubTab === 'songs'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Music className="w-4 h-4" />
                    <span>Song Clusters ({artistTrackClusters.length})</span>
                    {artistTrackClusters.length - mergedTrackClustersCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>

              {/* ALBUMS DEDUP VIEW */}
              {dedupSubTab === 'albums' && (
                <>
                  {artistAlbumClusters.length === 0 ? (
                    <div className="p-8 text-center border border-zinc-800 rounded-2xl bg-zinc-900/30 text-zinc-400 text-xs sm:text-sm">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                      <p className="font-bold text-zinc-200">Album catalog is pristine!</p>
                      <p className="text-zinc-500 mt-1">
                        No fragmented deluxe editions or alternate album tags detected for {profile.artistName}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {artistAlbumClusters.map((cluster, cIdx) => {
                        const variantAlbums = cluster.variants.map((v) => v.originalAlbum);
                        const albumUnits =
                          cluster.estimatedSales ||
                          cluster.totalCombinedPlays * (zeroSettings?.albumPlayWeight ?? 5000);
                        const streamStr = formatStreamsFromPlays(cluster.totalCombinedPlays);

                        return (
                          <div
                            key={cluster.id ? `${cluster.id}_${cIdx}` : `artist_album_cluster_${cIdx}`}
                            className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3 shadow-md"
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm sm:text-base font-black text-white">
                                    {cluster.canonicalAlbum}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    {cluster.similarityScore}% Match
                                  </span>
                                  {cluster.isMerged ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" /> Merged
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                      Unmerged
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5 flex-wrap">
                                  <span>{cluster.matchReason}</span>
                                  <span>•</span>
                                  <span className="text-emerald-400 font-bold">
                                    {albumUnits.toLocaleString()} units sold
                                  </span>
                                  <span>•</span>
                                  <span className="text-cyan-400 font-mono">{streamStr} streams</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {cluster.isMerged ? (
                                  <button
                                    onClick={() => unmergeAlbumCluster(cluster.artist, variantAlbums)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                                  >
                                    Unmerge Albums
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      mergeAlbumClusterVariants(
                                        cluster.artist,
                                        cluster.canonicalAlbum,
                                        variantAlbums
                                      )
                                    }
                                    className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all cursor-pointer"
                                  >
                                    Merge All Editions
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Variants List */}
                            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-850 space-y-1.5 text-xs font-mono">
                              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                                Grouped Variants:
                              </span>
                              {cluster.variants.map((v, vIdx) => (
                                <div
                                  key={vIdx}
                                  className="flex items-center justify-between text-zinc-300 py-0.5"
                                >
                                  <span className="truncate pr-2">{v.originalAlbum}</span>
                                  <span className="text-zinc-500 flex-shrink-0">
                                    {v.playCount} plays
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* SONGS DEDUP VIEW */}
              {dedupSubTab === 'songs' && (
                <>
                  {artistTrackClusters.length === 0 ? (
                    <div className="p-8 text-center border border-zinc-800 rounded-2xl bg-zinc-900/30 text-zinc-400 text-xs sm:text-sm">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                      <p className="font-bold text-zinc-200">Song catalog is clean!</p>
                      <p className="text-zinc-500 mt-1">
                        No fragmented remasters, acoustic, or live duplicate tracks found for {profile.artistName}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {artistTrackClusters.map((cluster, cIdx) => {
                        const variantTitles = cluster.variants.map((v) => v.originalTitle);

                        return (
                          <div
                            key={cluster.id ? `${cluster.id}_${cIdx}` : `artist_track_cluster_${cIdx}`}
                            className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3 shadow-md"
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm sm:text-base font-black text-white">
                                    {cluster.canonicalTitle}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                    {cluster.similarityScore}% Match
                                  </span>
                                  {cluster.isMerged ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" /> Merged
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                      Unmerged
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5 flex-wrap">
                                  <span>{cluster.matchReason}</span>
                                  <span>•</span>
                                  <span className="text-emerald-400 font-bold">
                                    {cluster.totalCombinedPlays.toLocaleString()} total plays
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                {cluster.isMerged ? (
                                  <button
                                    onClick={() => unmergeCluster(cluster.artist, variantTitles)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
                                  >
                                    Unmerge Songs
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      mergeClusterVariants(
                                        cluster.artist,
                                        cluster.canonicalTitle,
                                        variantTitles
                                      )
                                    }
                                    className="px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all cursor-pointer"
                                  >
                                    Merge All Songs
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Variants List */}
                            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-850 space-y-1.5 text-xs font-mono">
                              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                                Grouped Variants:
                              </span>
                              {cluster.variants.map((v, vIdx) => (
                                <div
                                  key={vIdx}
                                  className="flex items-center justify-between text-zinc-300 py-0.5"
                                >
                                  <span className="truncate pr-2">{v.originalTitle}</span>
                                  <span className="text-zinc-500 flex-shrink-0">
                                    {v.playCount} plays
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
