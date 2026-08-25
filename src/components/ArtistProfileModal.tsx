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
} from 'lucide-react';
import { computeArtistProfile } from '../utils/artistCrediting';
import { SubjectType } from '../types/music';
import { computeEntityGenreChartHistory } from '../utils/genreEngine';
import { detectArtistDuplicateClusters } from '../utils/trackCombiner';

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
    zeroSettings,
    artistsChart,
    weeklyArtistsChart,
    setActiveArtistProfile,
    setSelectedDetailItem,
    mergeClusterVariants,
    unmergeCluster,
  } = useMusic();
  const { theme } = useTheme();

  const [searchArtistQuery, setSearchArtistQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'albums' | 'songs' | 'dedup'>('all');

  // Compute profile data using multi-artist and feature crediting engine
  const profile = useMemo(() => {
    if (!artistName) return null;
    return computeArtistProfile(
      artistName,
      allProcessedScrobbles,
      allWeeks,
      mergedMap,
      zeroSettings
    );
  }, [artistName, allProcessedScrobbles, allWeeks, mergedMap, zeroSettings]);

  // Compute artist-specific duplicate clusters (97-99% accuracy threshold)
  const artistClusters = useMemo(() => {
    if (!profile?.artistName) return [];
    return detectArtistDuplicateClusters(profile.artistName, allProcessedScrobbles, mergedMap);
  }, [profile?.artistName, allProcessedScrobbles, mergedMap]);

  const mergedClustersCount = useMemo(() => {
    return artistClusters.filter((c) => c.isMerged).length;
  }, [artistClusters]);

  const handleMergeAllForArtist = () => {
    if (!profile?.artistName) return;
    for (const cluster of artistClusters) {
      const variantTitles = cluster.variants.map((v) => v.originalTitle);
      mergeClusterVariants(cluster.artist, cluster.canonicalTitle, variantTitles);
    }
  };

  // List of all known artists for quick search/switch
  const allKnownArtists = useMemo(() => {
    const artistSet = new Set<string>();
    for (const item of weeklyArtistsChart) {
      if (item.artist) artistSet.add(item.artist);
    }
    for (const item of artistsChart) {
      if (item.artist) artistSet.add(item.artist);
    }
    return Array.from(artistSet).sort((a, b) => a.localeCompare(b));
  }, [weeklyArtistsChart, artistsChart]);

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

  // Album certs summary line
  const albumCertsLine = Object.entries(profile?.albumCertCounts || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  // Track certs summary line
  const trackCertsLine = Object.entries(profile?.trackCertCounts || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        id="artist-profile-page"
        className="w-full max-w-5xl max-h-[92vh] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-md`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Artist Discography & Chart Archive
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                {profile.artistName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              className={`hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Forge Plaque</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Artist Search & Filter Bar */}
        <div className="px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search or switch artist..."
              value={searchArtistQuery}
              onChange={(e) => setSearchArtistQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {filteredKnownArtists.length > 0 && searchArtistQuery && (
            <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
              <span className="text-zinc-500 text-[11px] pr-1">Switch to:</span>
              {filteredKnownArtists.map((art) => (
                <button
                  key={art}
                  onClick={() => {
                    setActiveArtistProfile(art);
                    setSearchArtistQuery('');
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
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
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setActiveTab('albums')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTab === 'albums'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Albums ({profile.albums.length})
            </button>
            <button
              onClick={() => setActiveTab('songs')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTab === 'songs'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Songs ({profile.totalSongsCharted})
            </button>
            <button
              onClick={() => setActiveTab('dedup')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                activeTab === 'dedup'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Deduplicator ({artistClusters.length})</span>
            </button>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Stats Bar matching user spec */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-300">
              <span className="text-sm font-black text-white">
                Songs Charted (Top 100):{' '}
                <span className="text-amber-400 font-mono">{profile.totalSongsCharted}</span>
              </span>

              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-black text-sky-400 border border-zinc-700 shadow-sm">
                #1 Songs: {profile.distinctNum1Songs}
              </span>

              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-black text-sky-400 border border-zinc-700 shadow-sm">
                Weeks at #1: {profile.totalNum1Weeks}
              </span>

              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-black text-sky-400 border border-zinc-700 shadow-sm">
                Top 10s: {profile.totalTop10s}
              </span>

              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-black text-sky-400 border border-zinc-700 shadow-sm">
                #1 Debuts: {profile.debutAt1Count}
              </span>

              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-black text-amber-400 border border-zinc-700 shadow-sm ml-auto">
                Total Plays: {fmt(profile.totalPlays)}
              </span>
            </div>

            <p className="text-[11px] text-zinc-500">
              ⚡ Multi-Artist Crediting Active: All lead, featured, and collaborative scrobbles and weeks on chart are fully attributed to {profile.artistName}.
            </p>
          </div>

          {/* Section 1: ALBUMS */}
          {(activeTab === 'all' || activeTab === 'albums') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <h2 className="text-base font-black text-white tracking-tight border-b-2 border-zinc-700 pb-0.5">
                    Albums ({profile.albums.length})
                  </h2>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-md">
                <div className="max-h-[35vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 z-10">
                      <tr>
                        <th className="p-3">Album</th>
                        <th className="p-3">Certification</th>
                        <th className="p-3">Streams / Plays</th>
                        <th className="p-3">Tracks Charted</th>
                        <th className="p-3">Genre Chart Peak</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-xs">
                      {profile.albums.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-zinc-500 italic">
                            No album catalog entries found for this artist.
                          </td>
                        </tr>
                      ) : (
                        profile.albums.map((alb) => {
                          const albGenreHistories = computeEntityGenreChartHistory(
                            'album',
                            alb.name,
                            profile.artistName,
                            allWeeks,
                            mergedMap
                          );
                          const topGenre = albGenreHistories[0];

                          return (
                          <tr
                            key={alb.key}
                            className="hover:bg-zinc-900/50 transition-colors group cursor-pointer"
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
                            <td className="p-3 font-semibold text-white">
                              <div className="flex items-center gap-2.5">
                                {alb.coverArt && (
                                  <img
                                    src={alb.coverArt}
                                    alt={alb.name}
                                    referrerPolicy="no-referrer"
                                    className="w-7 h-7 rounded-lg object-cover border border-zinc-800 flex-shrink-0"
                                  />
                                )}
                                <span className="text-sky-400 group-hover:underline">
                                  {alb.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">{renderCertBadge(alb.certLabel, alb.certTier)}</td>
                            <td className="p-3 font-mono text-zinc-300">{fmt(alb.playCount)}</td>
                            <td className="p-3 font-mono text-zinc-400">{alb.tracksCount} tracks</td>
                            <td className="p-3 font-mono">
                              {topGenre ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    topGenre.peakRank === 1
                                      ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-zinc-900 text-cyan-300 border border-zinc-800'
                                  }`}
                                  title={topGenre.summaryText}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: topGenre.genreColor }}
                                  />
                                  <span>
                                    #{topGenre.peakRank} {topGenre.genreDisplayName.split('/')[0].trim()}
                                    {topGenre.weeksAtNumberOne > 0 ? ` (${topGenre.weeksAtNumberOne}w)` : ''}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-300 border border-zinc-800 transition-all inline-flex items-center gap-1"
                              >
                                <Award className="w-3 h-3" />
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-sky-400" />
                  <h2 className="text-base font-black text-white tracking-tight border-b-2 border-zinc-700 pb-0.5">
                    Songs ({profile.totalSongsCharted})
                  </h2>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-md">
                <div className="max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 z-10">
                      <tr>
                        <th className="p-3">Title</th>
                        <th className="p-3">Certification</th>
                        <th className="p-3">Streams</th>
                        <th className="p-3">Weeks</th>
                        <th className="p-3">Hot 100 Peak</th>
                        <th className="p-3">Genre Chart Peak</th>
                        <th className="p-3">#1s</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-xs">
                      {profile.songsByYear.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-zinc-500 italic">
                            No charted songs recorded for this artist.
                          </td>
                        </tr>
                      ) : (
                        profile.songsByYear.map((yrGroup) => (
                          <React.Fragment key={yrGroup.year}>
                            {/* Year Divider Banner matching spec */}
                            <tr className="bg-black text-sky-400 font-black border-y border-zinc-800">
                              <td colSpan={8} className="px-3 py-1.5 text-sm tracking-wide">
                                {yrGroup.year}
                              </td>
                            </tr>

                            {/* Year Statistics Subheader row matching spec */}
                            <tr className="bg-zinc-900/90 text-zinc-300 font-medium text-[11px] border-b border-zinc-800">
                              <td colSpan={8} className="px-3 py-1 italic">
                                🎵 Songs: {yrGroup.songsCount} &nbsp;|&nbsp; 🥇 #1 songs:{' '}
                                {yrGroup.num1sCount} &nbsp;|&nbsp; 🔟 Top 10s: {yrGroup.top10sCount}
                              </td>
                            </tr>

                            {/* Songs for this year */}
                            {yrGroup.songs.map((song) => {
                              const songGenreHistories = computeEntityGenreChartHistory(
                                'track',
                                song.titleDisplay,
                                song.artistDisplay || profile.artistName,
                                allWeeks,
                                mergedMap
                              );
                              const topGenre = songGenreHistories[0];

                              return (
                              <tr
                                key={song.key}
                                className="hover:bg-zinc-900/50 transition-colors group cursor-pointer"
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
                                <td className="p-3 font-semibold text-white">
                                  <div className="flex items-center gap-2">
                                    {song.coverArt && (
                                      <img
                                        src={song.coverArt}
                                        alt={song.titleDisplay}
                                        referrerPolicy="no-referrer"
                                        className="w-7 h-7 rounded-lg object-cover border border-zinc-800 flex-shrink-0"
                                      />
                                    )}
                                    <div>
                                      <div className="text-sky-400 group-hover:underline flex items-center gap-1.5">
                                        <span>{song.titleDisplay}</span>
                                        {song.peakRank === 1 && (
                                          <span className="text-[9px] font-black px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                            #1
                                          </span>
                                        )}
                                      </div>
                                      {song.artistDisplay.toLowerCase() !==
                                        profile.artistName.toLowerCase() && (
                                        <p className="text-[10px] text-zinc-500">
                                          Credited with: {song.artistDisplay}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {renderCertBadge(song.certLabel, song.certTier)}
                                </td>
                                <td className="p-3 font-mono text-zinc-300">
                                  {fmt(song.playCount)}
                                </td>
                                <td className="p-3 font-mono text-zinc-400">{song.weeksOnChart}</td>
                                <td className="p-3 font-mono font-bold text-white">
                                  #{song.peakRank}
                                </td>
                                <td className="p-3 font-mono">
                                  {topGenre ? (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        topGenre.peakRank === 1
                                          ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-zinc-900 text-cyan-300 border border-zinc-800'
                                      }`}
                                      title={topGenre.summaryText}
                                    >
                                      <span
                                        className="w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: topGenre.genreColor }}
                                      />
                                      <span>
                                        #{topGenre.peakRank} {topGenre.genreDisplayName.split('/')[0].trim()}
                                        {topGenre.weeksAtNumberOne > 0 ? ` (${topGenre.weeksAtNumberOne}w)` : ''}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-amber-400 font-bold">
                                  {song.num1s > 0 ? song.num1s : '—'}
                                </td>
                                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-300 border border-zinc-800 transition-all inline-flex items-center gap-1"
                                  >
                                    <Award className="w-3 h-3" />
                                    <span>Plaque</span>
                                  </button>
                                </td>
                              </tr>
                              );
                            })}
                          </React.Fragment>
                        ))
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
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <GitMerge className="w-4 h-4 text-amber-400" />
                      <h2 className="text-base font-black text-white tracking-tight">
                        Remaster & Deluxe Variant Deduplicator
                      </h2>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Automatically detects remastered, deluxe, radio edit, and alternate cuts for {profile.artistName} (97–99% similarity accuracy threshold).
                    </p>
                  </div>

                  {artistClusters.length > 0 && (
                    <button
                      onClick={handleMergeAllForArtist}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all flex items-center gap-1.5 flex-shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Merge All {artistClusters.length} Clusters</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-zinc-400 pt-2 border-t border-zinc-800/60">
                  <span>Detected Clusters: <strong className="text-white">{artistClusters.length}</strong></span>
                  <span>Merged: <strong className="text-emerald-400">{mergedClustersCount}</strong></span>
                  <span>Unmerged: <strong className="text-amber-400">{artistClusters.length - mergedClustersCount}</strong></span>
                </div>
              </div>

              {artistClusters.length === 0 ? (
                <div className="p-8 text-center border border-zinc-800 rounded-2xl bg-zinc-900/30 text-zinc-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="font-bold text-zinc-200">Catalog is pristine!</p>
                  <p className="text-zinc-500 mt-1">No unmerged remasters or alternate track titles detected for {profile.artistName}.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {artistClusters.map((cluster) => {
                    const variantTitles = cluster.variants.map((v) => v.originalTitle);

                    return (
                      <div
                        key={cluster.id}
                        className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 space-y-3 shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">
                                {cluster.canonicalTitle}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {cluster.similarityScore}% Match
                              </span>
                              {cluster.isMerged && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Merged
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              {cluster.matchReason} • Combined Plays: <strong className="text-amber-400">{fmt(cluster.totalCombinedPlays)}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {cluster.isMerged ? (
                              <button
                                onClick={() => unmergeCluster(cluster.artist, variantTitles)}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all"
                              >
                                Unmerge Variants
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
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black font-black transition-all flex items-center gap-1"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                                Merge Cluster
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Variants list */}
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5 text-xs">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                            Track Variants Included ({cluster.variants.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {cluster.variants.map((v) => {
                              const isThisMerged =
                                mergedMap[`${cluster.artist.toLowerCase()}:::${v.originalTitle.toLowerCase()}`] !==
                                undefined;

                              return (
                                <div
                                  key={v.originalTitle}
                                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800"
                                >
                                  <span className="truncate text-zinc-300 font-medium mr-2" title={v.originalTitle}>
                                    {v.originalTitle}
                                  </span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-mono text-zinc-400 text-[11px]">
                                      {v.playCount} plays
                                    </span>
                                    {isThisMerged ? (
                                      <button
                                        onClick={() => unmergeCluster(cluster.artist, [v.originalTitle])}
                                        className="text-[10px] text-zinc-400 hover:text-red-400 underline font-bold"
                                      >
                                        Unlink
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          mergeClusterVariants(
                                            cluster.artist,
                                            cluster.canonicalTitle,
                                            [v.originalTitle]
                                          )
                                        }
                                        className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold"
                                      >
                                        Merge
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Certification Totals Summary Bar matching spec */}
        <div className="px-6 py-3.5 bg-zinc-900 border-t border-zinc-800 text-xs font-bold text-zinc-300 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="truncate">
            <span className="text-amber-400 font-black">ALBUM CERTS — </span>
            <span>{albumCertsLine || 'None'}</span>
            <span className="mx-2 text-zinc-600">|</span>
            <span className="text-cyan-400 font-black">TRACK CERTS — </span>
            <span>{trackCertsLine || 'None'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
