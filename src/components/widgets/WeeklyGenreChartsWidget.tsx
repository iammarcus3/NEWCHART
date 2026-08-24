import React, { useState, useMemo } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useTheme } from '../../context/ThemeContext';
import {
  computeWeeklyGenreCharts,
  computeWeeklyNonPopAggregateChart,
  enrichGenresFromLastfm,
  GenreWeekData,
  GENRE_METADATA,
  isNonPopGenre,
} from '../../utils/genreEngine';
import {
  Music,
  Disc,
  User,
  Award,
  Sparkles,
  RefreshCw,
  Radio,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag,
  Layers,
  Flame,
  CheckCircle2,
  Sliders,
  Zap,
} from 'lucide-react';

interface WeeklyGenreChartsWidgetProps {
  onAwardPlaque: (item: {
    title: string;
    subtitle: string;
    type: 'track' | 'artist' | 'album';
    scrobbles: number;
    coverArt?: string;
  }) => void;
}

export const WeeklyGenreChartsWidget: React.FC<WeeklyGenreChartsWidgetProps> = ({
  onAwardPlaque,
}) => {
  const {
    allWeeks,
    selectedWeekNumber,
    setSelectedWeekNumber,
    stepWeek,
    currentWeekInfo,
    mergedMap,
    openArtistProfile,
    setEditingChartItem,
  } = useMusic();
  const { theme } = useTheme();

  // Active filter tab: 'all' | 'pop' | 'rnb' | 'hiphop' | 'non_pop' | specific genre key
  const [selectedGenreKey, setSelectedGenreKey] = useState<string>('all');
  const [isEnrichingTags, setIsEnrichingTags] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);

  // Extract scrobbles for the active week
  const currentWeekScrobbles = useMemo(() => {
    const currentWeek = allWeeks.find((w) => w.weekNumber === selectedWeekNumber);
    return currentWeek?.scrobbles || [];
  }, [allWeeks, selectedWeekNumber]);

  // Compute genre charts for this week
  const genreDataList = useMemo(() => {
    return computeWeeklyGenreCharts(currentWeekScrobbles, mergedMap);
  }, [currentWeekScrobbles, mergedMap]);

  // Compute Non-Pop Aggregate Chart
  const nonPopAggregateData = useMemo(() => {
    return computeWeeklyNonPopAggregateChart(currentWeekScrobbles, mergedMap);
  }, [currentWeekScrobbles, mergedMap]);

  // Handle live Last.fm tag enrichment
  const handleEnrichLastfmTags = async () => {
    setIsEnrichingTags(true);
    setEnrichResult(null);

    const weekArtists = (Array.from(
      new Set(currentWeekScrobbles.map((s) => s.artist))
    ) as string[]).slice(0, 20);

    try {
      const added = await enrichGenresFromLastfm(weekArtists);
      setEnrichResult(
        added > 0
          ? `Updated ${added} artist genre community tags from Last.fm!`
          : 'All weekly artist tags are verified and current.'
      );
      setTimeout(() => setEnrichResult(null), 3500);
    } catch (e) {
      setEnrichResult('Could not fetch Last.fm tags.');
    } finally {
      setIsEnrichingTags(false);
    }
  };

  // Filtered list based on tab
  const displayedGenres: GenreWeekData[] = useMemo(() => {
    if (selectedGenreKey === 'all') {
      return genreDataList.slice(0, 6);
    }
    if (selectedGenreKey === 'non_pop') {
      // Non-Pop view: return all non-pop individual genres
      return genreDataList.filter((g) => isNonPopGenre(g.genre));
    }
    return genreDataList.filter((g) => g.genre === selectedGenreKey);
  }, [genreDataList, selectedGenreKey]);

  return (
    <div
      id="weekly-genre-charts-widget"
      className="rounded-3xl bg-zinc-950 border border-zinc-800/80 shadow-2xl overflow-hidden space-y-0"
    >
      {/* Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 border-b border-zinc-800/80 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-2 text-cyan-400 shadow-inner flex-shrink-0">
              <Tag className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white tracking-tight uppercase">
                  Weekly Genre Hot Charts
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  {allWeeks.length > 0
                    ? `Week ${selectedWeekNumber} (${genreDataList.length} Active Genres)`
                    : 'Live Session'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                Top Songs & Albums categorized into POP, R&B, HIP-HOP & Non-Pop charts for{' '}
                <span className="font-mono text-zinc-300">
                  {currentWeekInfo?.dateRange || 'Current Timeline'}
                </span>
              </p>
            </div>
          </div>

          {/* Stepper Navigation & Last.fm Tag Refresh */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Week Stepper */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => stepWeek(-1)}
                disabled={selectedWeekNumber <= 1}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedWeekNumber}
                onChange={(e) => setSelectedWeekNumber(parseInt(e.target.value, 10))}
                className="bg-transparent text-xs font-bold text-cyan-300 px-2 py-1 focus:outline-none cursor-pointer"
              >
                {allWeeks.map((w) => (
                  <option key={w.weekNumber} value={w.weekNumber} className="bg-zinc-900 text-white">
                    {w.label} ({w.dateRange})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => stepWeek(1)}
                disabled={selectedWeekNumber >= allWeeks.length}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 transition-all cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Last.fm Live Tag Enrichment Button */}
            <button
              type="button"
              onClick={handleEnrichLastfmTags}
              disabled={isEnrichingTags || currentWeekScrobbles.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 hover:text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Query Last.fm for live artist & track genre tags"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-red-400 ${isEnrichingTags ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isEnrichingTags ? 'Pulling Tags...' : 'Pull Last.fm Tags'}
              </span>
            </button>
          </div>
        </div>

        {/* Tag Banner Feedback */}
        {enrichResult && (
          <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{enrichResult}</span>
          </div>
        )}

        {/* Core Genre Tabs & Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          {/* All Genres */}
          <button
            type="button"
            onClick={() => setSelectedGenreKey('all')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGenreKey === 'all'
                ? 'bg-zinc-800 text-cyan-300 shadow-sm border border-zinc-700'
                : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Genres ({genreDataList.length})</span>
          </button>

          {/* POP Button */}
          <button
            type="button"
            onClick={() => setSelectedGenreKey('pop')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGenreKey === 'pop'
                ? 'bg-pink-950/80 border border-pink-500/60 text-pink-300 shadow-sm'
                : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-pink-300'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            <span>POP</span>
            {genreDataList.find((g) => g.genre === 'pop') && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-zinc-950 text-pink-300 border border-zinc-800">
                {genreDataList.find((g) => g.genre === 'pop')?.sharePct}%
              </span>
            )}
          </button>

          {/* R&B / SOUL Button */}
          <button
            type="button"
            onClick={() => setSelectedGenreKey('rnb')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGenreKey === 'rnb'
                ? 'bg-purple-950/80 border border-purple-500/60 text-purple-300 shadow-sm'
                : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-purple-300'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>RNB (R&B / Soul)</span>
            {genreDataList.find((g) => g.genre === 'rnb') && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-zinc-950 text-purple-300 border border-zinc-800">
                {genreDataList.find((g) => g.genre === 'rnb')?.sharePct}%
              </span>
            )}
          </button>

          {/* HIP-HOP / RAP Button */}
          <button
            type="button"
            onClick={() => setSelectedGenreKey('hiphop')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGenreKey === 'hiphop'
                ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300 shadow-sm'
                : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-amber-300'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>HIP-HOP</span>
            {genreDataList.find((g) => g.genre === 'hiphop') && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-zinc-950 text-amber-300 border border-zinc-800">
                {genreDataList.find((g) => g.genre === 'hiphop')?.sharePct}%
              </span>
            )}
          </button>

          {/* NON-POP Combined Chart Button */}
          <button
            type="button"
            onClick={() => setSelectedGenreKey('non_pop')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGenreKey === 'non_pop'
                ? 'bg-indigo-950/80 border border-indigo-500/60 text-indigo-300 shadow-sm'
                : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-indigo-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>NON-POP CHARTS</span>
            {nonPopAggregateData && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-zinc-950 text-indigo-300 border border-zinc-800">
                {nonPopAggregateData.sharePct}%
              </span>
            )}
          </button>

          {/* Other Genre Pills */}
          {genreDataList
            .filter((g) => g.genre !== 'pop' && g.genre !== 'rnb' && g.genre !== 'hiphop')
            .map((g) => (
              <button
                key={g.genre}
                type="button"
                onClick={() => setSelectedGenreKey(g.genre)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedGenreKey === g.genre
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                    : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <span>{g.displayName}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-zinc-950 text-zinc-400 border border-zinc-800">
                  {g.sharePct}%
                </span>
              </button>
            ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* NON-POP Aggregated Mega Chart Banner when non_pop is selected */}
        {selectedGenreKey === 'non_pop' && nonPopAggregateData && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-zinc-900/40 border border-indigo-500/30 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-indigo-800/40 pb-3">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-black text-white tracking-tight">
                  Non-Pop Overall Hot 10 Chart
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {nonPopAggregateData.totalPlays} plays ({nonPopAggregateData.sharePct}% of week)
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                All Non-Pop tracks aggregated
              </span>
            </div>

            {/* Grid of Top 10 Non-Pop Songs & Albums */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Songs Column */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-300 px-1">
                  <div className="flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Top Non-Pop Songs</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Rank / Plays</span>
                </div>

                <div className="space-y-1.5">
                  {nonPopAggregateData.top5Tracks.map((track) => (
                    <div
                      key={`nonpop_${track.rank}_${track.title}_${track.artist}`}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black font-mono text-xs flex-shrink-0 ${
                            track.rank === 1
                              ? 'bg-amber-400 text-black'
                              : track.rank === 2
                              ? 'bg-slate-300 text-black'
                              : track.rank === 3
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                          }`}
                        >
                          {track.rank}
                        </div>

                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                          <img
                            src={track.coverArt}
                            alt={track.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';
                            }}
                          />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate">
                            <button
                              type="button"
                              onClick={() => openArtistProfile(track.artist)}
                              className="hover:text-indigo-300 hover:underline cursor-pointer"
                            >
                              {track.artist}
                            </button>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right font-mono">
                          <span className="text-xs font-black text-indigo-300 block">
                            {track.playCount}
                          </span>
                          <span className="text-[9px] text-zinc-500">plays</span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onAwardPlaque({
                              title: track.title,
                              subtitle: track.artist,
                              type: 'track',
                              scrobbles: track.playCount,
                              coverArt: track.coverArt,
                            })
                          }
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-400 border border-zinc-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Forge Commemorative Plaque"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Albums Column */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-300 px-1">
                  <div className="flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5 text-purple-400" />
                    <span>Top Non-Pop Albums</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Rank / Plays</span>
                </div>

                <div className="space-y-1.5">
                  {nonPopAggregateData.top5Albums.map((album) => (
                    <div
                      key={`nonpop_album_${album.rank}_${album.title}_${album.artist}`}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-purple-500/50 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-black font-mono text-xs flex-shrink-0 ${
                            album.rank === 1
                              ? 'bg-amber-400 text-black'
                              : album.rank === 2
                              ? 'bg-slate-300 text-black'
                              : album.rank === 3
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                          }`}
                        >
                          {album.rank}
                        </div>

                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                          <img
                            src={album.coverArt}
                            alt={album.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';
                            }}
                          />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                            {album.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate">
                            <button
                              type="button"
                              onClick={() => openArtistProfile(album.artist)}
                              className="hover:text-purple-300 hover:underline cursor-pointer"
                            >
                              {album.artist}
                            </button>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right font-mono">
                          <span className="text-xs font-black text-purple-300 block">
                            {album.playCount}
                          </span>
                          <span className="text-[9px] text-zinc-500">plays</span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            onAwardPlaque({
                              title: album.title,
                              subtitle: album.artist,
                              type: 'album',
                              scrobbles: album.playCount,
                              coverArt: album.coverArt,
                            })
                          }
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-400 border border-zinc-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                          title="Forge Commemorative Plaque"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Individual Genre Cards */}
        {genreDataList.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 font-mono">
            No scrobble entries found for Week #{selectedWeekNumber}.
          </div>
        ) : (
          <div className="space-y-6">
            {displayedGenres.map((g) => (
              <div
                key={g.genre}
                className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4"
              >
                {/* Genre Header */}
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: g.color }}
                    />
                    <h3 className="text-base font-black text-white tracking-tight">
                      {g.displayName}
                    </h3>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800">
                      {g.totalPlays} plays ({g.sharePct}% of week)
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                    Week #{selectedWeekNumber}
                  </span>
                </div>

                {/* Grid of Top 5 Songs & Top 5 Albums */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Column 1: Top 5 Songs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-300 px-1">
                      <div className="flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Top 5 Songs</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">Rank / Plays</span>
                    </div>

                    <div className="space-y-1.5">
                      {g.top5Tracks.length === 0 ? (
                        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 text-xs text-zinc-500 text-center">
                          No songs charted
                        </div>
                      ) : (
                        g.top5Tracks.map((track) => (
                          <div
                            key={`${track.rank}_${track.title}_${track.artist}`}
                            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Rank */}
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-black font-mono text-xs flex-shrink-0 ${
                                  track.rank === 1
                                    ? 'bg-amber-400 text-black'
                                    : track.rank === 2
                                    ? 'bg-slate-300 text-black'
                                    : track.rank === 3
                                    ? 'bg-amber-700 text-amber-100'
                                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}
                              >
                                {track.rank}
                              </div>

                              {/* Thumbnail */}
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                                <img
                                  src={track.coverArt}
                                  alt={track.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src =
                                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';
                                  }}
                                />
                              </div>

                              {/* Title & Artist */}
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                                  {track.title}
                                </h4>
                                <p className="text-[11px] text-zinc-400 truncate">
                                  <button
                                    type="button"
                                    onClick={() => openArtistProfile(track.artist)}
                                    className="hover:text-cyan-300 hover:underline cursor-pointer"
                                  >
                                    {track.artist}
                                  </button>
                                </p>
                              </div>
                            </div>

                            {/* Plays & Quick Award */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right font-mono">
                                <span className="text-xs font-black text-cyan-300 block">
                                  {track.playCount}
                                </span>
                                <span className="text-[9px] text-zinc-500">plays</span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  onAwardPlaque({
                                    title: track.title,
                                    subtitle: track.artist,
                                    type: 'track',
                                    scrobbles: track.playCount,
                                    coverArt: track.coverArt,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-400 border border-zinc-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Forge Commemorative Plaque"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 2: Top 5 Albums */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-300 px-1">
                      <div className="flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-purple-400" />
                        <span>Top 5 Albums</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">Rank / Plays</span>
                    </div>

                    <div className="space-y-1.5">
                      {g.top5Albums.length === 0 ? (
                        <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 text-xs text-zinc-500 text-center">
                          No albums charted with ≥ 3 tracks
                        </div>
                      ) : (
                        g.top5Albums.map((album) => (
                          <div
                            key={`${album.rank}_${album.title}_${album.artist}`}
                            className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Rank */}
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-black font-mono text-xs flex-shrink-0 ${
                                  album.rank === 1
                                    ? 'bg-amber-400 text-black'
                                    : album.rank === 2
                                    ? 'bg-slate-300 text-black'
                                    : album.rank === 3
                                    ? 'bg-amber-700 text-amber-100'
                                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                }`}
                              >
                                {album.rank}
                              </div>

                              {/* Thumbnail */}
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                                <img
                                  src={album.coverArt}
                                  alt={album.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src =
                                      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';
                                  }}
                                />
                              </div>

                              {/* Title & Artist */}
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                                  {album.title}
                                </h4>
                                <p className="text-[11px] text-zinc-400 truncate">
                                  <button
                                    type="button"
                                    onClick={() => openArtistProfile(album.artist)}
                                    className="hover:text-purple-300 hover:underline cursor-pointer"
                                  >
                                    {album.artist}
                                  </button>
                                </p>
                              </div>
                            </div>

                            {/* Plays & Quick Award */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right font-mono">
                                <span className="text-xs font-black text-purple-300 block">
                                  {album.playCount}
                                </span>
                                <span className="text-[9px] text-zinc-500">plays</span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  onAwardPlaque({
                                    title: album.title,
                                    subtitle: album.artist,
                                    type: 'album',
                                    scrobbles: album.playCount,
                                    coverArt: album.coverArt,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-400 border border-zinc-800 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Forge Commemorative Plaque"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
