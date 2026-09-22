import React, { useMemo, useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import { computeDetailedEntityStats } from '../utils/entityDetailEngine';
import { CreditedArtistLinks } from './CreditedArtistLinks';
import { splitArtistList } from '../utils/artistCrediting';
import { MusicImage } from './MusicImage';
import {
  X,
  Disc,
  Award,
  Radio,
  Trophy,
  Flame,
  Sparkles,
  TrendingUp,
  Layers,
  Music2,
  ChevronRight,
  User,
  ArrowUpRight,
  BarChart3,
  Edit3,
  Check,
  ChevronDown,
} from 'lucide-react';

interface DetailDrawerProps {
  onAwardPlaque?: (item: {
    title: string;
    subtitle: string;
    type: 'track' | 'artist' | 'album';
    scrobbles: number;
    coverArt?: string;
  }) => void;
  onOpenCertifications?: () => void;
}

interface DetailModalContentProps {
  selectedDetailItem: NonNullable<ReturnType<typeof useMusic>['selectedDetailItem']>;
  onAwardPlaque?: DetailDrawerProps['onAwardPlaque'];
  onOpenCertifications?: () => void;
}

const DetailModalContent: React.FC<DetailModalContentProps> = ({
  selectedDetailItem,
  onAwardPlaque,
  onOpenCertifications,
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
    updateTrackAlbum,
  } = useMusic();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'overview' | 'trajectory' | 'genres' | 'tracks'>('overview');

  const { type, data } = selectedDetailItem;

  const rawTitle = type === 'track' ? data.title : type === 'artist' ? data.artist : data.title;
  const rawArtist = type === 'artist' ? data.artist : data.artist;

  const [isEditingAlbum, setIsEditingAlbum] = useState(false);
  const [albumInput, setAlbumInput] = useState('');
  const [albumSavedNotice, setAlbumSavedNotice] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedDetailItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedDetailItem]);

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

  // IMPORTANT CREDITING RULES:
  // - Albums CANNOT have shared credit (strictly single lead artist)
  // - Songs (tracks) MUST have shared credit if there are more than one artist
  const artist = type === 'album'
    ? (splitArtistList(stats.artist || rawArtist)[0] || stats.artist || rawArtist).trim()
    : (stats.artist || rawArtist);

  const album = data.album || (stats as any).album;

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
        <span className="text-zinc-500 font-mono text-xs px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 inline-flex items-center">
          Uncertified
        </span>
      );
    }

    let badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10';
    let iconColor = 'text-amber-400';

    if (tier === 'diamond') {
      badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20';
      iconColor = 'text-cyan-400';
    } else if (tier === 'platinum' || tier === 'multi-platinum') {
      badgeClass = 'bg-slate-300/20 text-slate-100 border-slate-400/50 shadow-slate-500/10';
      iconColor = 'text-slate-200';
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
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 lg:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={() => setSelectedDetailItem(null)}
    >
      <div
        id="detail-page-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl lg:max-w-6xl h-full sm:h-auto sm:max-h-[92vh] bg-zinc-950 sm:border border-zinc-800/90 sm:rounded-3xl rounded-none shadow-2xl flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div
              className={`p-2 sm:p-2.5 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-md flex-shrink-0`}
            >
              {type === 'album' ? (
                <Disc className="w-4 sm:w-5 h-4 sm:h-5" />
              ) : (
                <Music2 className="w-4 sm:w-5 h-4 sm:h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-400 block truncate">
                {type === 'album' ? 'Official Album Analytics' : 'Official Track Analytics'}
              </span>
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-white tracking-tight truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSelectedDetailItem(null)}
              className="p-2 sm:p-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-800 cursor-pointer"
              aria-label="Close detail modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero Section with Artwork & Essential Metadata */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-zinc-900/70 via-zinc-950 to-zinc-950 border-b border-zinc-800/80 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
            {/* High-res Artwork with Status Badges */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl overflow-hidden bg-zinc-900 border-2 border-zinc-800 shadow-2xl flex-shrink-0 group">
              <MusicImage
                type={type}
                artist={artist}
                title={type === 'track' ? title : undefined}
                album={type === 'album' ? title : album}
                src={coverArt}
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              {stats.peakRank === 1 && (
                <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md bg-amber-400 text-black text-[11px] font-black flex items-center gap-1 shadow-lg">
                  <Trophy className="w-3 h-3" />
                  <span>#1 HIT</span>
                </div>
              )}
            </div>

            {/* Metadata, Artist Attribution & Highlights */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Badges Row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] sm:text-xs uppercase font-black px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700">
                  {type}
                </span>

                {renderCertBadge(stats.certLabel, stats.certTier)}

                {stats.peakRank === 1 ? (
                  <span className="text-[10px] sm:text-xs uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    {stats.weeksAtNumberOne > 1 ? `${stats.weeksAtNumberOne} Wks at #1` : '1 Week at #1'}
                  </span>
                ) : stats.peakRank ? (
                  <span className="text-[10px] sm:text-xs font-black font-mono px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    Peak #{stats.peakRank}
                  </span>
                ) : null}

                {stats.isDebutNumberOne && (
                  <span className="text-[10px] sm:text-xs uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    #1 Debut
                  </span>
                )}

                {stats.isHotShotDebut && !stats.isDebutNumberOne && (
                  <span className="text-[10px] sm:text-xs uppercase font-black px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/50 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-red-400" />
                    Hot Shot Debut
                  </span>
                )}
              </div>

              {/* Title (Big & Legible) */}
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                {title}
              </h2>

              {/* Artist Crediting:
                  - Songs: MUST have shared credit for multiple artists (all links clickable)
                  - Albums: CANNOT have shared credit (strictly single lead artist)
              */}
              <div className="text-sm sm:text-base font-semibold text-zinc-300 flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                <span className="text-zinc-400 font-normal">By</span>
                <CreditedArtistLinks
                  artist={artist}
                  title={type === 'album' ? undefined : title}
                  isAlbum={type === 'album'}
                  onArtistClick={(art) => {
                    openArtistProfile(art);
                    setSelectedDetailItem(null);
                  }}
                  linkClassName="text-sky-400 hover:text-sky-300 hover:underline transition-colors font-bold text-sm sm:text-base"
                />
              </div>

              {/* Parent Album (for tracks) */}
              {type === 'track' && (
                <div className="pt-1 space-y-1.5">
                  {!isEditingAlbum ? (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-zinc-400">
                      <Disc className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-zinc-500 font-medium">Album:</span>
                      {stats.albumName ? (
                        <button
                          onClick={() =>
                            setSelectedDetailItem({
                              type: 'album',
                              data: {
                                title: stats.albumName,
                                artist: splitArtistList(artist)[0] || artist,
                                coverArt: stats.albumCoverArt || coverArt,
                              },
                            })
                          }
                          className="text-amber-400 hover:text-amber-300 font-bold hover:underline truncate max-w-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>{stats.albumName}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-zinc-500 italic">No album assigned</span>
                      )}

                      <button
                        onClick={() => {
                          setAlbumInput(stats.albumName || '');
                          setIsEditingAlbum(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-semibold transition-colors border border-zinc-700/60 ml-1 cursor-pointer"
                        title="Edit parent album"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{stats.albumName ? 'Change Album' : 'Assign Album'}</span>
                      </button>

                      {albumSavedNotice && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 animate-fade-in">
                          <Check className="w-3 h-3" />
                          Updated everywhere!
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900/90 border border-amber-500/40 max-w-md">
                      <Disc className="w-4 h-4 text-amber-400 flex-shrink-0 ml-1" />
                      <input
                        type="text"
                        value={albumInput}
                        onChange={(e) => setAlbumInput(e.target.value)}
                        placeholder="Enter album name..."
                        className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none font-medium"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          updateTrackAlbum(artist, title, albumInput);
                          setIsEditingAlbum(false);
                          setAlbumSavedNotice(true);
                          setTimeout(() => setAlbumSavedNotice(false), 3000);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingAlbum(false)}
                        className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tracks Count & Play count (for albums) */}
              {type === 'album' && stats.albumTracks && (
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5 text-xs text-zinc-400">
                  <Layers className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="font-bold text-zinc-200">
                    {stats.albumTracks.length} Track{stats.albumTracks.length === 1 ? '' : 's'} Cataloged
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="font-mono text-zinc-300">{fmt(stats.playCount)} total album plays</span>
                </div>
              )}
            </div>
          </div>

          {/* Plaque Milestone Progress Bar */}
          <div className="mt-4 p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5 font-bold">
                <Award className="w-4 h-4 text-amber-400" />
                Next Milestone: <span className="text-white">{stats.nextMilestone.name}</span>
              </span>
              <span className="font-mono font-bold text-amber-400">
                {fmt(stats.nextMilestone.currentUnits)} / {fmt(stats.nextMilestone.targetUnits)} units (
                {stats.nextMilestone.progressPercent}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full bg-gradient-to-r ${theme.accentGradient} rounded-full transition-all duration-500`}
                style={{ width: `${stats.nextMilestone.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
              <span>{fmt(stats.nextMilestone.remainingUnits)} units to next tier</span>
              <span className="text-zinc-500">ZeroCharts Verified Formula</span>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs - Fluid Wrap, No Sliders */}
        <div className="px-3 sm:px-6 py-2.5 bg-zinc-900/60 border-b border-zinc-800/80 flex flex-wrap items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 min-h-[40px] ${
              activeTab === 'overview'
                ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Overview &amp; Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('trajectory')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 min-h-[40px] ${
              activeTab === 'trajectory'
                ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <span>Weekly Chart Run ({stats.weeksOnChart})</span>
          </button>

          <button
            onClick={() => setActiveTab('genres')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 min-h-[40px] ${
              activeTab === 'genres'
                ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Radio className="w-4 h-4 text-purple-400" />
            <span>Genre Charts ({stats.genrePerformances.length})</span>
          </button>

          {type === 'album' && stats.albumTracks && (
            <button
              onClick={() => setActiveTab('tracks')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 min-h-[40px] ${
                activeTab === 'tracks'
                  ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Disc className="w-4 h-4 text-amber-400" />
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
                  <span>Performance &amp; Chart Records</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {/* Total Certified Sales */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/30 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 mb-1">
                      Certified Sales
                    </span>
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-white">
                      {fmt(stats.sales)}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">units sold</span>
                  </div>

                  {/* Total Streams */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-cyan-500/30 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 mb-1">
                      Streams
                    </span>
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-cyan-300">
                      {formatStreams(stats.streams)}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">simulated</span>
                  </div>

                  {/* Peak Position */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Peak Position
                    </span>
                    <div className="flex items-center justify-center gap-1.5">
                      {stats.peakRank === 1 && <Trophy className="w-5 h-5 text-amber-400" />}
                      <span
                        className={`text-xl sm:text-2xl lg:text-3xl font-black font-mono ${
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
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {stats.peakRank ? 'official chart' : 'uncharted'}
                    </span>
                  </div>

                  {/* Weeks on Chart */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Weeks on Chart
                    </span>
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-white">
                      {stats.weeksOnChart}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {stats.weeksOnChart === 1 ? 'week' : 'weeks'}
                    </span>
                  </div>

                  {/* Weeks at #1 (Top 1) */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-amber-500/20 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 mb-1">
                      Weeks at #1
                    </span>
                    <span
                      className={`text-xl sm:text-2xl lg:text-3xl font-black font-mono ${
                        stats.weeksAtNumberOne > 0 ? 'text-amber-300 font-black' : 'text-zinc-500'
                      }`}
                    >
                      {stats.weeksAtNumberOne}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {stats.weeksAtNumberOne === 1 ? 'week on top' : 'weeks on top'}
                    </span>
                  </div>

                  {/* Weeks in Top 10 */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-sky-500/20 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-sky-400 mb-1">
                      Top 10 Weeks
                    </span>
                    <span
                      className={`text-xl sm:text-2xl lg:text-3xl font-black font-mono ${
                        stats.weeksInTop10 > 0 ? 'text-sky-300' : 'text-zinc-500'
                      }`}
                    >
                      {stats.weeksInTop10}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">weeks in top 10</span>
                  </div>

                  {/* Pure Plays (Scrobbles) */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Pure Scrobbles
                    </span>
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-zinc-200">
                      {fmt(stats.playCount)}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5">library plays</span>
                  </div>

                  {/* Debut Position & Week */}
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-purple-500/20 shadow-md flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-400 mb-1">
                      Chart Debut
                    </span>
                    <span className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-purple-300">
                      {stats.debutRank ? `#${stats.debutRank}` : '—'}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono mt-0.5 truncate">
                      {stats.debutWeekNumber ? `Week ${stats.debutWeekNumber}` : 'never debuted'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Best Week Performance Highlight */}
              {stats.bestWeek && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-md">
                  <div className="flex items-center gap-3.5 text-center sm:text-left">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Flame className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                        Peak Weekly Performance Record
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        Week {stats.bestWeek.weekNumber} ({stats.bestWeek.dateRange})
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-center font-mono">
                    <div>
                      <span className="text-[11px] text-zinc-500 block">Rank</span>
                      <span className="text-base sm:text-lg font-black text-amber-400">#{stats.bestWeek.rank}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-500 block">Plays</span>
                      <span className="text-base sm:text-lg font-black text-white">{fmt(stats.bestWeek.plays)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-500 block">Sales</span>
                      <span className="text-base sm:text-lg font-black text-white">{fmt(stats.bestWeek.sales)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Chart Trajectory Preview */}
              {stats.weeklyTrajectory.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                      <span>Chart Run Highlights</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('trajectory')}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View all {stats.weeklyTrajectory.length} weeks</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {stats.weeklyTrajectory.slice(0, 16).map((pt, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl flex-shrink-0 text-center font-mono border min-w-[70px] ${
                          pt.rank === 1
                            ? 'bg-amber-400/20 border-amber-500/60 text-amber-300 shadow-md'
                            : pt.rank <= 10
                            ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        }`}
                        title={`Week ${pt.weekNumber}: #${pt.rank} • ${pt.plays} plays`}
                      >
                        <span className="text-[10px] text-zinc-400 block font-semibold">
                          W{pt.weekNumber}
                        </span>
                        <span className="text-sm font-black block mt-0.5">#{pt.rank}</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5 font-medium">
                          {pt.plays}p
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Genre Rankings Preview */}
              {stats.genrePerformances.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Radio className="w-4 h-4" />
                      <span>Genre Chart Highlights</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('genres')}
                      className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View all {stats.genrePerformances.length} genre charts</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {stats.genrePerformances.slice(0, 4).map((perf) => (
                      <div
                        key={perf.genreKey}
                        className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3 text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: perf.genreColor }}
                          />
                          <span className="font-bold text-white truncate text-sm">
                            {perf.genreDisplayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 font-mono flex-shrink-0">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-black ${
                              perf.peakRank === 1
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-500/50 shadow-sm'
                                : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                            }`}
                          >
                            PEAK #{perf.peakRank}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-semibold">
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
                  <h3 className="text-base font-black text-white">Full Weekly Chart Run</h3>
                  <p className="text-xs text-zinc-400">
                    Chronological ranking history across all {allWeeks.length} tracking weeks
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/70 border border-sky-800/80 px-3 py-1.5 rounded-xl">
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
                <>
                  {/* MOBILE CARDS STREAM VIEW (Touch-friendly, high readability) */}
                  <div className="block sm:hidden space-y-2">
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
                        <div
                          key={pt.weekNumber}
                          className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3 font-mono shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-12 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${
                                pt.rank === 1
                                  ? 'bg-amber-400/20 text-amber-300 border-amber-500/50 shadow-md'
                                  : pt.rank <= 10
                                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                  : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                              }`}
                            >
                              #{pt.rank}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-white">
                                Week {pt.weekNumber}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-sans">
                                {pt.dateRange}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-right text-xs">
                            <div>
                              <span className="text-zinc-200 font-bold block">{fmt(pt.plays)}p</span>
                              <span className="text-[10px] text-zinc-400 font-sans block">{fmt(pt.sales)}u</span>
                            </div>

                            <div className="w-12 text-center">
                              {movement === 'new' ? (
                                <span className="text-[10px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                                  NEW
                                </span>
                              ) : movement === 'up' ? (
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                  +{moveDiff}
                                </span>
                              ) : movement === 'down' ? (
                                <span className="text-[10px] font-black text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-md border border-rose-500/30">
                                  -{moveDiff}
                                </span>
                              ) : (
                                <span className="text-[10px] font-black text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                                  =
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP TABLE VIEW */}
                  <div className="hidden sm:block border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-md">
                    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-zinc-900 text-[11px] uppercase font-bold text-zinc-400 border-b border-zinc-800 z-10 font-mono">
                          <tr>
                            <th className="p-3.5">Week</th>
                            <th className="p-3.5">Date Range</th>
                            <th className="p-3.5">Rank</th>
                            <th className="p-3.5">Plays</th>
                            <th className="p-3.5">Sales Units</th>
                            <th className="p-3.5 text-right">Movement</th>
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
                              <tr key={pt.weekNumber} className="hover:bg-zinc-900/60 transition-colors">
                                <td className="p-3.5 font-bold text-white">Week {pt.weekNumber}</td>
                                <td className="p-3.5 text-zinc-400 font-sans">{pt.dateRange}</td>
                                <td className="p-3.5 font-black">
                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1.5 ${
                                      pt.rank === 1
                                        ? 'bg-amber-400/20 text-amber-300 border border-amber-500/50 shadow-sm'
                                        : pt.rank <= 10
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                        : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                                    }`}
                                  >
                                    {pt.rank === 1 && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                                    #{pt.rank}
                                  </span>
                                </td>
                                <td className="p-3.5 text-zinc-200 font-bold">{fmt(pt.plays)}</td>
                                <td className="p-3.5 text-zinc-300">{fmt(pt.sales)}</td>
                                <td className="p-3.5 text-right">
                                  {movement === 'new' ? (
                                    <span className="text-[10px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                                      DEBUT
                                    </span>
                                  ) : movement === 'up' ? (
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                      +{moveDiff}
                                    </span>
                                  ) : movement === 'down' ? (
                                    <span className="text-[10px] font-black text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-md border border-rose-500/30">
                                      -{moveDiff}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-black text-zinc-500 bg-zinc-850 px-2 py-0.5 rounded-md">
                                      =
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: POSITIONS ON GENRE CHARTS */}
          {activeTab === 'genres' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-400" />
                    <span>Positions on Genre Charts</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Tracked across Pop, Hip-Hop, R&amp;B, Rock, Electronic, Country, Latin, and Non-Pop charts
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/70 border border-purple-800/80 px-3 py-1.5 rounded-xl">
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
                      className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 shadow-md"
                    >
                      {/* Header: Genre Name & Peak Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: perf.genreColor }}
                          />
                          <h4 className="text-sm sm:text-base font-black text-white truncate">
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
                              : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                          }`}
                        >
                          {perf.peakRank === 1 && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                          PEAK #{perf.peakRank}
                        </span>
                      </div>

                      {/* Summary Statement */}
                      <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-850 text-xs font-mono flex items-center justify-between text-zinc-300">
                        <span className="font-semibold text-zinc-200">
                          {perf.summaryText}
                        </span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-mono">
                        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                          <span className="text-zinc-500 text-[11px] block">Weeks at #1</span>
                          <span
                            className={`text-sm sm:text-base font-bold ${
                              perf.weeksAtNumberOne > 0 ? 'text-amber-400' : 'text-zinc-400'
                            }`}
                          >
                            {perf.weeksAtNumberOne} {perf.weeksAtNumberOne === 1 ? 'wk' : 'wks'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                          <span className="text-zinc-500 text-[11px] block">Total Charted</span>
                          <span className="text-sm sm:text-base font-bold text-cyan-300">
                            {perf.totalWeeksOnChart} {perf.totalWeeksOnChart === 1 ? 'wk' : 'wks'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                          <span className="text-zinc-500 text-[11px] block">Current Rank</span>
                          <span className="text-sm sm:text-base font-bold text-white">
                            {perf.currentRank ? `#${perf.currentRank}` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Weekly Trajectory Pills */}
                      {perf.allWeeklyRanks.length > 1 && (
                        <div className="pt-1">
                          <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider block mb-1.5">
                            Genre Trajectory:
                          </span>
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px] font-mono">
                            {perf.allWeeklyRanks.slice(0, 16).map((w, idx) => (
                              <span
                                key={idx}
                                className={`px-2.5 py-1 rounded-lg flex-shrink-0 font-bold ${
                                  w.rank === 1
                                    ? 'bg-amber-400 text-black font-black shadow-sm'
                                    : w.rank <= 5
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                    : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                                }`}
                                title={`Week ${w.weekNumber}: #${w.rank} (${w.plays} plays)`}
                              >
                                W{w.weekNumber}: #{w.rank}
                              </span>
                            ))}
                            {perf.allWeeklyRanks.length > 16 && (
                              <span className="text-zinc-400 text-xs px-1 font-semibold">
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
                  <h3 className="text-base font-black text-white">Album Tracklist &amp; Songs</h3>
                  <p className="text-xs text-zinc-400">
                    All songs from this album with play counts, sales, and peak Hot 100 ranks
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/70 border border-amber-800/80 px-3 py-1.5 rounded-xl">
                  {stats.albumTracks.length} Songs
                </span>
              </div>

              <div className="space-y-2.5">
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
                    className="p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between gap-3.5 cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="text-sm font-mono font-bold text-zinc-500 w-6 text-center">
                        {idx + 1}
                      </span>
                      <MusicImage
                        type="track"
                        artist={artist}
                        title={tr.title}
                        album={title}
                        src={tr.coverArt || coverArt}
                        alt={tr.title}
                        className="w-11 h-11 rounded-xl object-cover border border-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                          {tr.title}
                        </h4>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5 font-mono">
                          <span className="font-bold text-zinc-200">{fmt(tr.playCount)} plays</span>
                          <span>•</span>
                          <span className="text-amber-400">{fmt(tr.sales)} units</span>
                          {tr.streams > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-cyan-400">{formatStreams(tr.streams)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {tr.peakRank ? (
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                            tr.peakRank === 1
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40 shadow-sm'
                              : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                          }`}
                        >
                          PEAK #{tr.peakRank}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600 font-mono">Uncharted</span>
                      )}
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-4 sm:px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {type === 'track' ? (
              stats.creditedArtists.slice(0, 3).map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    openArtistProfile(c.name);
                    setSelectedDetailItem(null);
                  }}
                  className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 flex items-center justify-center gap-1.5 transition-all hover:border-zinc-700 cursor-pointer min-h-[42px]"
                  title={`View ${c.name}'s Profile`}
                >
                  <User className="w-4 h-4 text-sky-400" />
                  <span>View {c.name}</span>
                </button>
              ))
            ) : (
              <button
                onClick={() => {
                  openArtistProfile(splitArtistList(artist)[0] || artist);
                  setSelectedDetailItem(null);
                }}
                className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 flex items-center justify-center gap-1.5 transition-all hover:border-zinc-700 cursor-pointer min-h-[42px]"
                title={`View ${splitArtistList(artist)[0] || artist}'s Profile`}
              >
                <User className="w-4 h-4 text-amber-400" />
                <span>View {splitArtistList(artist)[0] || artist}</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setSelectedDetailItem(null)}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl text-xs sm:text-sm font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-all cursor-pointer min-h-[44px]"
          >
            <span>Close Details</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  onAwardPlaque,
  onOpenCertifications,
}) => {
  const { selectedDetailItem } = useMusic();

  if (!selectedDetailItem) return null;

  return (
    <DetailModalContent
      selectedDetailItem={selectedDetailItem}
      onAwardPlaque={onAwardPlaque}
      onOpenCertifications={onOpenCertifications}
    />
  );
};
