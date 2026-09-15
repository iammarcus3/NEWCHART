import React, { useMemo, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import { computeDetailedEntityStats } from '../utils/entityDetailEngine';
import { CreditedArtistLinks } from './CreditedArtistLinks';
import {
  X,
  Disc,
  Award,
  Radio,
  Trophy,
  Flame,
  Sparkles,
  TrendingUp,
  Calendar,
  Layers,
  Music2,
  ChevronRight,
  User,
  ArrowUpRight,
  Play,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

interface DetailDrawerProps {
  onAwardPlaque: (item: {
    title: string;
    subtitle: string;
    type: 'track' | 'artist' | 'album';
    scrobbles: number;
    coverArt?: string;
  }) => void;
}

interface DetailModalContentProps {
  selectedDetailItem: NonNullable<ReturnType<typeof useMusic>['selectedDetailItem']>;
  onAwardPlaque: DetailDrawerProps['onAwardPlaque'];
}

const DetailModalContent: React.FC<DetailModalContentProps> = ({
  selectedDetailItem,
  onAwardPlaque,
}) => {
  const {
    setSelectedDetailItem,
    openArtistProfile,
    allProcessedScrobbles,
    allWeeks,
    allWeeklyCharts,
    mergedMap,
    mergedAlbumsMap,
    zeroSettings,
    selectedWeekNumber,
  } = useMusic();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'overview' | 'trajectory' | 'genres' | 'tracks'>('overview');

  const { type, data } = selectedDetailItem;

  const rawTitle = type === 'track' ? data.title : type === 'artist' ? data.artist : data.title;
  const rawArtist = type === 'artist' ? data.artist : data.artist;

  // Compute 100% verified, comprehensive stats for this entity
  const stats = useMemo(() => {
    return computeDetailedEntityStats(
      type,
      rawTitle,
      rawArtist,
      allProcessedScrobbles,
      allWeeks,
      allWeeklyCharts,
      mergedMap,
      mergedAlbumsMap,
      zeroSettings,
      selectedWeekNumber
    );
  }, [
    type,
    rawTitle,
    rawArtist,
    allProcessedScrobbles,
    allWeeks,
    allWeeklyCharts,
    mergedMap,
    mergedAlbumsMap,
    zeroSettings,
    selectedWeekNumber,
  ]);

  const coverArt = data.coverArt || stats.coverArt;
  const title = stats.title || rawTitle;
  const artist = stats.artist || rawArtist;

  // Format large numbers with commas
  const fmt = (n: number) => n.toLocaleString();

  // Format stream numbers (e.g. 14.5M, 1.2B)
  const formatStreams = (streams: number) => {
    if (streams >= 1_000_000_000) {
      return `${(streams / 1_000_000_000).toFixed(2)}B`;
    }
    if (streams >= 1_000_000) {
      return `${(streams / 1_000_000).toFixed(1)}M`;
    }
    if (streams >= 1_000) {
      return `${(streams / 1_000).toFixed(0)}K`;
    }
    return fmt(streams);
  };

  const renderCertBadge = (label: string, tier: string | null) => {
    if (!label || label === '—' || !tier) {
      return (
        <span className="text-zinc-500 font-mono text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
          Uncertified
        </span>
      );
    }

    let badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10';
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
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-sm ${badgeClass}`}
      >
        <Award className={`w-3.5 h-3.5 ${iconColor}`} />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="detail-page-modal"
        className="w-full max-w-4xl h-full sm:h-auto sm:max-h-[92vh] bg-zinc-950 sm:border border-zinc-800 sm:rounded-3xl rounded-none shadow-2xl flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-900/60 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-md flex-shrink-0`}
            >
              {type === 'album' ? (
                <Disc className="w-4 sm:w-5 h-4 sm:h-5" />
              ) : (
                <Music2 className="w-4 sm:w-5 h-4 sm:h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-400 block truncate">
                {type === 'album' ? 'Official Album Deep Analytics' : 'Official Track Deep Analytics'}
              </span>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() =>
                onAwardPlaque({
                  title,
                  subtitle: type === 'album' ? `Album by ${artist}` : `Track by ${artist}`,
                  type,
                  scrobbles: stats.playCount,
                  coverArt,
                })
              }
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all cursor-pointer`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Forge Plaque</span>
            </button>

            <button
              onClick={() => setSelectedDetailItem(null)}
              className="p-2 sm:p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800 cursor-pointer"
              aria-label="Close detail modal"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Hero Banner with Artwork & Primary Details */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-zinc-900/50 via-zinc-950 to-zinc-950 border-b border-zinc-800/80 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
            {/* High-res Artwork with glow */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-zinc-900 border-2 border-zinc-800 shadow-2xl flex-shrink-0 group">
              <img
                src={coverArt}
                alt={title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    type === 'album'
                      ? 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop&q=80'
                      : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop&q=80';
                }}
              />
              {stats.peakRank === 1 && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[10px] font-black flex items-center gap-1 shadow-lg">
                  <Trophy className="w-3 h-3" />
                  <span>#1 HIT</span>
                </div>
              )}
            </div>

            {/* Metadata & Artists */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {type}
                </span>

                {renderCertBadge(stats.certLabel, stats.certTier)}

                {stats.isDebutNumberOne && (
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    #1 Debut
                  </span>
                )}

                {stats.isHotShotDebut && !stats.isDebutNumberOne && (
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-red-400" />
                    Hot Shot Debut
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                {title}
              </h2>

              <div className="text-sm font-semibold text-zinc-300 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <span className="text-zinc-400">By</span>
                <CreditedArtistLinks
                  artist={artist}
                  title={title}
                  onArtistClick={(art) => {
                    openArtistProfile(art);
                    setSelectedDetailItem(null);
                  }}
                  linkClassName="text-sky-400 hover:text-sky-300 hover:underline transition-colors font-bold text-sm"
                />
              </div>

              {/* Parent Album (for tracks) */}
              {type === 'track' && stats.albumName && (
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-zinc-400">
                  <Disc className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span className="text-zinc-500">From Album:</span>
                  <button
                    onClick={() =>
                      setSelectedDetailItem({
                        type: 'album',
                        data: {
                          title: stats.albumName,
                          artist,
                          coverArt: stats.albumCoverArt || coverArt,
                        },
                      })
                    }
                    className="text-amber-400 hover:text-amber-300 font-bold hover:underline truncate max-w-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>{stats.albumName}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Tracks Count (for albums) */}
              {type === 'album' && stats.albumTracks && (
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-zinc-400">
                  <Layers className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  <span className="font-semibold text-zinc-300">
                    {stats.albumTracks.length} Track{stats.albumTracks.length === 1 ? '' : 's'} Cataloged
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span>{fmt(stats.playCount)} total album plays</span>
                </div>
              )}
            </div>
          </div>

          {/* Plaque Milestone Progress Bar */}
          <div className="mt-4 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5 font-bold">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Next Milestone: <span className="text-white">{stats.nextMilestone.name}</span>
              </span>
              <span className="font-mono font-bold text-amber-400">
                {fmt(stats.nextMilestone.currentUnits)} / {fmt(stats.nextMilestone.targetUnits)} units (
                {stats.nextMilestone.progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full bg-gradient-to-r ${theme.accentGradient} rounded-full transition-all duration-500`}
                style={{ width: `${stats.nextMilestone.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>{fmt(stats.nextMilestone.remainingUnits)} units to next tier</span>
              <span>Based on ZeroCharts Verified Formula</span>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center gap-2 overflow-x-auto flex-shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Overview &amp; Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('trajectory')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trajectory'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Weekly Chart Run ({stats.weeksOnChart})</span>
          </button>

          <button
            onClick={() => setActiveTab('genres')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'genres'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Genre Charts ({stats.genrePerformances.length})</span>
          </button>

          {type === 'album' && stats.albumTracks && (
            <button
              onClick={() => setActiveTab('tracks')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tracks'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Disc className="w-3.5 h-3.5 text-amber-400" />
              <span>Tracklist ({stats.albumTracks.length})</span>
            </button>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* TAB 1: OVERVIEW & STATS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* PRIMARY STATS BENTO GRID - High visibility, large bold typography */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span>Verified Performance &amp; Sales Metrics</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
                  {/* Total Certified Sales */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-amber-500/30 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 mb-1">
                      Certified Sales
                    </span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-white">
                      {fmt(stats.sales)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">units sold</span>
                  </div>

                  {/* Total Streams */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-cyan-500/30 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-cyan-400 mb-1">
                      Streams
                    </span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-cyan-300">
                      {formatStreams(stats.streams)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">simulated</span>
                  </div>

                  {/* Peak Position */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Peak Position
                    </span>
                    <div className="flex items-center justify-center gap-1.5">
                      {stats.peakRank === 1 && <Trophy className="w-4 sm:w-5 h-4 sm:h-5 text-amber-400" />}
                      <span
                        className={`text-lg sm:text-2xl font-black font-mono ${
                          stats.peakRank === 1
                            ? 'text-amber-300'
                            : stats.peakRank && stats.peakRank <= 10
                            ? 'text-sky-400'
                            : 'text-white'
                        }`}
                      >
                        {stats.peakRank ? `#${stats.peakRank}` : '—'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {stats.peakRank ? 'official chart' : 'uncharted'}
                    </span>
                  </div>

                  {/* Weeks on Chart */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Weeks on Chart
                    </span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-white">
                      {stats.weeksOnChart}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {stats.weeksOnChart === 1 ? 'week' : 'weeks'}
                    </span>
                  </div>

                  {/* Weeks at #1 (Top 1) */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-amber-500/20 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400 mb-1">
                      Weeks at #1 (Top 1)
                    </span>
                    <span
                      className={`text-lg sm:text-2xl font-black font-mono ${
                        stats.weeksAtNumberOne > 0 ? 'text-amber-300 font-black' : 'text-zinc-500'
                      }`}
                    >
                      {stats.weeksAtNumberOne}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {stats.weeksAtNumberOne === 1 ? 'week at top' : 'weeks at top'}
                    </span>
                  </div>

                  {/* Weeks in Top 10 */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-sky-500/20 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-sky-400 mb-1">
                      Top 10 Weeks
                    </span>
                    <span
                      className={`text-lg sm:text-2xl font-black font-mono ${
                        stats.weeksInTop10 > 0 ? 'text-sky-300' : 'text-zinc-500'
                      }`}
                    >
                      {stats.weeksInTop10}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">weeks in top 10</span>
                  </div>

                  {/* Pure Plays (Scrobbles) */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Pure Scrobbles
                    </span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-zinc-200">
                      {fmt(stats.playCount)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5">library plays</span>
                  </div>

                  {/* Debut Position & Date */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-sm flex flex-col justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Chart Debut
                    </span>
                    <span className="text-lg sm:text-2xl font-black font-mono text-purple-300">
                      {stats.debutRank ? `#${stats.debutRank}` : '—'}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                      {stats.debutWeekNumber ? `Week ${stats.debutWeekNumber}` : 'never debuted'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Best Week Performance Highlight */}
              {stats.bestWeek && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Peak Weekly Record
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        Week {stats.bestWeek.weekNumber} ({stats.bestWeek.dateRange})
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Rank</span>
                      <span className="text-sm font-black text-amber-400">#{stats.bestWeek.rank}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Plays</span>
                      <span className="text-sm font-black text-white">{fmt(stats.bestWeek.plays)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Sales</span>
                      <span className="text-sm font-black text-white">{fmt(stats.bestWeek.sales)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Chart Trajectory Preview */}
              {stats.weeklyTrajectory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                      <span>Chart Run Highlights</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('trajectory')}
                      className="text-xs text-sky-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View all {stats.weeklyTrajectory.length} weeks</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                    {stats.weeklyTrajectory.slice(0, 16).map((pt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl flex-shrink-0 text-center font-mono border min-w-[62px] ${
                          pt.rank === 1
                            ? 'bg-amber-400/20 border-amber-500/50 text-amber-300 shadow-sm'
                            : pt.rank <= 10
                            ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        }`}
                        title={`Week ${pt.weekNumber}: #${pt.rank} • ${pt.plays} plays`}
                      >
                        <span className="text-[9px] text-zinc-500 block leading-tight">
                          W{pt.weekNumber}
                        </span>
                        <span className="text-xs font-black block mt-0.5">#{pt.rank}</span>
                        <span className="text-[9px] text-zinc-400 block mt-0.5">
                          {pt.plays}p
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Genre Rankings Preview */}
              {stats.genrePerformances.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5" />
                      <span>Genre Chart Highlights</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('genres')}
                      className="text-xs text-purple-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View all {stats.genrePerformances.length} genre charts</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stats.genrePerformances.slice(0, 4).map((perf) => (
                      <div
                        key={perf.genreKey}
                        className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: perf.genreColor }}
                          />
                          <span className="font-bold text-white truncate">
                            {perf.genreDisplayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono flex-shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              perf.peakRank === 1
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            PEAK #{perf.peakRank}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {perf.totalWeeksOnChart} wks
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WEEKLY CHART RUN TRAJECTORY */}
          {activeTab === 'trajectory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Full Weekly Chart Run</h3>
                  <p className="text-xs text-zinc-400">
                    Chronological performance across all {allWeeks.length} tracking weeks
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2.5 py-1 rounded-lg">
                  {stats.weeksOnChart} total weeks charted
                </span>
              </div>

              {stats.weeklyTrajectory.length === 0 ? (
                <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-500 space-y-1">
                  <p className="text-sm font-semibold">No chart history recorded yet</p>
                  <p className="text-xs">
                    This item has not yet entered the Top {zeroSettings.chartSize || 100} in any weekly tracking cycle.
                  </p>
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-md">
                  <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-zinc-900 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-800 z-10 font-mono">
                        <tr>
                          <th className="p-3">Week</th>
                          <th className="p-3">Date Range</th>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Plays</th>
                          <th className="p-3">Sales</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono">
                        {stats.weeklyTrajectory.map((pt, idx) => {
                          const prevPt = idx > 0 ? stats.weeklyTrajectory[idx - 1] : null;
                          let movement = 'same';
                          let moveDiff = 0;
                          if (prevPt) {
                            if (pt.rank < prevPt.rank) {
                              movement = 'up';
                              moveDiff = prevPt.rank - pt.rank;
                            } else if (pt.rank > prevPt.rank) {
                              movement = 'down';
                              moveDiff = pt.rank - prevPt.rank;
                            }
                          } else {
                            movement = 'new';
                          }

                          return (
                            <tr key={pt.weekNumber} className="hover:bg-zinc-900/50 transition-colors">
                              <td className="p-3 font-bold text-white">Week {pt.weekNumber}</td>
                              <td className="p-3 text-zinc-400 font-sans">{pt.dateRange}</td>
                              <td className="p-3 font-black">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-black inline-flex items-center gap-1 ${
                                    pt.rank === 1
                                      ? 'bg-amber-400/20 text-amber-300 border border-amber-500/50'
                                      : pt.rank <= 10
                                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                      : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                                  }`}
                                >
                                  {pt.rank === 1 && <Trophy className="w-3 h-3 text-amber-400" />}
                                  #{pt.rank}
                                </span>
                              </td>
                              <td className="p-3 text-zinc-200">{fmt(pt.plays)}</td>
                              <td className="p-3 text-zinc-400">{fmt(pt.sales)}</td>
                              <td className="p-3 text-right">
                                {movement === 'new' ? (
                                  <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    DEBUT
                                  </span>
                                ) : movement === 'up' ? (
                                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    +{moveDiff}
                                  </span>
                                ) : movement === 'down' ? (
                                  <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                    -{moveDiff}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-zinc-500">=</span >
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POSITIONS ON GENRE CHARTS */}
          {activeTab === 'genres' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-purple-400" />
                    <span>Positions on Genre Charts</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Tracked across Pop, Hip-Hop, R&amp;B, Rock, Electronic, Country, Latin, and Non-Pop charts
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2.5 py-1 rounded-lg">
                  {stats.genrePerformances.length} Charts
                </span>
              </div>

              {stats.genrePerformances.length === 0 ? (
                <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-zinc-500 space-y-1">
                  <p className="text-sm font-semibold">No genre chart history recorded</p>
                  <p className="text-xs">
                    This item has not yet appeared on any specific genre rankings.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.genrePerformances.map((perf) => (
                    <div
                      key={perf.genreKey}
                      className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 shadow-md"
                    >
                      {/* Header: Genre Name & Peak Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: perf.genreColor }}
                          />
                          <h4 className="text-sm font-black text-white truncate">
                            {perf.genreDisplayName} Chart
                          </h4>
                        </div>

                        {/* Prominent Peak Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black font-mono tracking-wide ${
                            perf.peakRank === 1
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-500/50 shadow-sm'
                              : perf.peakRank <= 5
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {perf.peakRank === 1 && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                          PEAK #{perf.peakRank}
                        </span>
                      </div>

                      {/* Summary Statement */}
                      <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-850 text-xs font-mono flex items-center justify-between text-zinc-300">
                        <span className="font-semibold text-zinc-200">
                          {perf.summaryText}
                        </span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-850">
                          <span className="text-zinc-500 text-[10px] block">Weeks at #1</span>
                          <span
                            className={`text-sm font-bold ${
                              perf.weeksAtNumberOne > 0 ? 'text-amber-400' : 'text-zinc-400'
                            }`}
                          >
                            {perf.weeksAtNumberOne} {perf.weeksAtNumberOne === 1 ? 'wk' : 'wks'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-850">
                          <span className="text-zinc-500 text-[10px] block">Total Charted</span>
                          <span className="text-sm font-bold text-cyan-300">
                            {perf.totalWeeksOnChart} {perf.totalWeeksOnChart === 1 ? 'wk' : 'wks'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-850">
                          <span className="text-zinc-500 text-[10px] block">Current Rank</span>
                          <span className="text-sm font-bold text-white">
                            {perf.currentRank ? `#${perf.currentRank}` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Weekly Trajectory Pills */}
                      {perf.allWeeklyRanks.length > 1 && (
                        <div className="pt-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block mb-1">
                            Genre Chart Run:
                          </span>
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[10px] font-mono">
                            {perf.allWeeklyRanks.slice(0, 16).map((w, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded-lg flex-shrink-0 font-bold ${
                                  w.rank === 1
                                    ? 'bg-amber-400 text-black font-black'
                                    : w.rank <= 5
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}
                                title={`Week ${w.weekNumber}: #${w.rank} (${w.plays} plays)`}
                              >
                                W{w.weekNumber}: #{w.rank}
                              </span>
                            ))}
                            {perf.allWeeklyRanks.length > 16 && (
                              <span className="text-zinc-500 text-[10px] px-1">
                                +{perf.allWeeklyRanks.length - 16} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ALBUM TRACKLIST (for albums) */}
          {type === 'album' && stats.albumTracks && activeTab === 'tracks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white">Album Tracklist &amp; Songs</h3>
                  <p className="text-xs text-zinc-400">
                    All tracks from this album with individual play counts and peak chart ranks
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-lg">
                  {stats.albumTracks.length} Songs
                </span>
              </div>

              <div className="space-y-2">
                {stats.albumTracks.map((tr, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      setSelectedDetailItem({
                        type: 'track',
                        data: {
                          title: tr.title,
                          artist,
                          coverArt: tr.coverArt || coverArt,
                        },
                      })
                    }
                    className="p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono font-bold text-zinc-500 w-5 text-center">
                        {idx + 1}
                      </span>
                      {tr.coverArt && (
                        <img
                          src={tr.coverArt}
                          alt={tr.title}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-lg object-cover border border-zinc-800 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = coverArt;
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                          {tr.title}
                        </h4>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span>{fmt(tr.playCount)} plays</span>
                          <span>•</span>
                          <span>{fmt(tr.sales)} units</span>
                          {tr.streams > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-cyan-400">{formatStreams(tr.streams)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tr.peakRank ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            tr.peakRank === 1
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          PEAK #{tr.peakRank}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono">Uncharted</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-4 sm:px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {stats.creditedArtists.slice(0, 2).map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  openArtistProfile(c.name);
                  setSelectedDetailItem(null);
                }}
                className="flex-1 sm:flex-initial py-2 px-3 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 flex items-center justify-center gap-1.5 transition-all hover:border-zinc-700 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span>View {c.name}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onAwardPlaque({
                title,
                subtitle: type === 'album' ? `Album by ${artist}` : `Track by ${artist}`,
                type,
                scrobbles: stats.playCount,
                coverArt,
              });
              setSelectedDetailItem(null);
            }}
            className={`w-full sm:w-auto py-2.5 px-6 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 flex items-center justify-center gap-2 transition-all cursor-pointer`}
          >
            <Award className="w-4 h-4" />
            <span>Forge Commemorative Plaque</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ onAwardPlaque }) => {
  const { selectedDetailItem } = useMusic();

  if (!selectedDetailItem) return null;

  return (
    <DetailModalContent
      selectedDetailItem={selectedDetailItem}
      onAwardPlaque={onAwardPlaque}
    />
  );
};
