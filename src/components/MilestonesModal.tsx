import React, { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  Crown,
  Disc,
  Calendar,
  Star,
  Rocket,
  Headphones,
  Sparkles,
  Flame,
  BarChart3,
  Users,
  Award,
  LineChart,
  Layers,
  TrendingUp,
  Music,
  Zap,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  computeMilestonesData,
  MilestoneItem,
  EraMilestoneItem,
  PerfectAllKillItem,
} from '../utils/milestonesEngine';
import {
  MilestoneFilterBar,
  MilestoneDisplayOptions,
  MilestoneSortOption,
} from './MilestoneFilterBar';
import { MilestonesTable } from './MilestonesTable';

export type MilestoneCategory =
  | 'graphs'
  | 'certifications'
  | 'all_1s'
  | 'artists_most_1s'
  | 'songs_most_weeks_at_1'
  | 'most_weeks_accum_1'
  | 'artists_most_consec_1'
  | 'albums_most_1s'
  | 'artists_most_debuts_1'
  | 'songs_most_consec_weeks_1'
  | 'most_weeks_until_1'
  | 'artists_simul_tracks'
  | 'albums_most_tracks_1'
  | 'best_debuts'
  | 'most_plays_week'
  | 'points_accumulators'
  | 'fastest_artists_1'
  | 'longest_active_1_span'
  | 'songs_biggest_jump_1'
  | 'songs_longest_climb_1'
  | 'artists_highest_conv_rate'
  | 'perfect_all_kill'
  | 'chart_domination'
  | 'most_weeks_accum'
  | 'most_weeks_at_1'
  | 'most_consec_1'
  | 'most_units_sold'
  | 'artists_most_sales'
  | 'biggest_eras';

interface MilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: MilestoneCategory;
  onAwardPlaque?: (item: any) => void;
}

export const MilestonesModal: React.FC<MilestonesModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'all_1s',
  onAwardPlaque,
}) => {
  const {
    allWeeks,
    allProcessedScrobbles,
    mergedMap,
    zeroSettings,
    openArtistProfile,
    setSelectedDetailItem,
  } = useMusic();
  const { theme } = useTheme();

  // Navigation & Entity sub-type
  const [activeCategory, setActiveCategory] = useState<MilestoneCategory>(initialCategory);
  const [subType, setSubType] = useState<'tracks' | 'artists' | 'albums'>('tracks');

  // Filter & Sorter states
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [limitCount, setLimitCount] = useState<number | 'all'>(25);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('1');
  const [sortBy, setSortBy] = useState<MilestoneSortOption>('week_desc');

  // Toast message feedback (for sharing)
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Display options
  const [displayOptions, setDisplayOptions] = useState<MilestoneDisplayOptions>({
    showSalesColumns: false,
    peakOnly: false,
    showImages: true,
    separateArtistColumn: false,
    showWeekNumber: true,
    showChartPosition: true,
    showPlays: true,
    showWeeksAt1: true,
    fontSize: 'normal',
  });

  // Extract all distinct chart years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    allWeeks.forEach((w) => {
      if (w.startTimestamp) {
        const yr = new Date(w.startTimestamp * 1000).getFullYear();
        if (!isNaN(yr)) yearsSet.add(yr.toString());
      } else if (w.dateRange) {
        const match = w.dateRange.match(/\b(19\d\d|20\d\d)\b/);
        if (match) yearsSet.add(match[0]);
      }
    });
    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear().toString());
    }
    return Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [allWeeks]);

  // Compute all milestones data
  const milestones = useMemo(() => {
    return computeMilestonesData(allWeeks, allProcessedScrobbles, mergedMap, zeroSettings);
  }, [allWeeks, allProcessedScrobbles, mergedMap, zeroSettings]);

  // Navigation menu items
  const menuItems = [
    { id: 'graphs', label: 'Graphs', icon: LineChart, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'certifications', label: 'Certifications', icon: Award, badge: 'NEW', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    { id: 'all_1s', label: 'All #1s', icon: Trophy },
    { id: 'artists_most_1s', label: 'Artists with Most #1s', icon: Crown },
    { id: 'songs_most_weeks_at_1', label: 'Songs with Most Weeks at #1', icon: Star },
    { id: 'most_weeks_accum_1', label: 'Most Weeks Accumulated at #1 (Career Total)', icon: Calendar, badge: 'TOP', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { id: 'artists_most_consec_1', label: 'Artists with Most Consecutive #1s', icon: CheckCircle2 },
    { id: 'albums_most_1s', label: 'Albums with Most #1s', icon: Disc, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'artists_most_debuts_1', label: 'Artists with Most Debuts at #1', icon: Sparkles },
    { id: 'songs_most_consec_weeks_1', label: 'Songs with Most Consecutive Weeks at #1', icon: Flame },
    { id: 'most_weeks_until_1', label: 'Most Weeks Until Reaching #1', icon: TrendingUp, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'artists_simul_tracks', label: 'Artists with Most Simultaneous Tracks', icon: Music, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'albums_most_tracks_1', label: 'Albums with Most Tracks That Reached #1', icon: Disc },
    { id: 'best_debuts', label: 'Best Debuts', icon: Rocket },
    { id: 'most_plays_week', label: 'Most Plays / Streams in a Week', icon: Headphones },
    { id: 'points_accumulators', label: 'Points Accumulators', icon: Layers },
    { id: 'fastest_artists_1', label: 'Fastest Artist to Reach 5 / 10 / 20 #1s', icon: Zap, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'longest_active_1_span', label: 'Longest Active #1 Career Span', icon: Calendar },
    { id: 'songs_biggest_jump_1', label: 'Songs with Biggest Jump to #1', icon: TrendingUp },
    { id: 'songs_longest_climb_1', label: 'Songs with Longest Climb to #1', icon: TrendingUp },
    { id: 'artists_highest_conv_rate', label: 'Artists with Highest #1 Conversion Rate', icon: Crown, badge: 'NEW', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { id: 'perfect_all_kill', label: 'Perfect All Kill / Most PAKs', icon: Flame },
    { id: 'chart_domination', label: 'Biggest Chart Domination Score', icon: BarChart3, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'most_weeks_accum', label: 'Most Weeks Accumulated (Total)', icon: Calendar },
    { id: 'most_units_sold', label: 'Most Units Sold', icon: BarChart3, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'artists_most_sales', label: 'Artists with Most Sales', icon: Users, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'biggest_eras', label: 'Biggest Eras', icon: Zap, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  ];

  // Helper pipeline to filter, deduplicate (peak only), sort, and limit items
  const processItemsList = (rawItems: MilestoneItem[]) => {
    let list = [...rawItems];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          (item.artist && item.artist.toLowerCase().includes(q)) ||
          (item.album && item.album.toLowerCase().includes(q)) ||
          (item.dateRange && item.dateRange.toLowerCase().includes(q)) ||
          (item.secondaryStat && item.secondaryStat.toLowerCase().includes(q))
      );
    }

    // 2. Year Filter
    if (selectedYear !== 'all') {
      list = list.filter((item) => {
        if (item.year && item.year.toString() === selectedYear) return true;
        if (item.dateRange && item.dateRange.includes(selectedYear)) return true;
        if (item.statLabel && String(item.statLabel).includes(selectedYear)) return true;
        if (item.weekNumber && allWeeks[item.weekNumber - 1]) {
          const wInfo = allWeeks[item.weekNumber - 1];
          if (wInfo.startTimestamp && new Date(wInfo.startTimestamp * 1000).getFullYear().toString() === selectedYear) return true;
          if (wInfo.dateRange && wInfo.dateRange.includes(selectedYear)) return true;
        }
        return false;
      });
    }

    // 3. Position / Rank Filter (# 1, Top 3, Top 5, Top 10, Top 20, Top 40, Top 100, All)
    if (positionFilter !== 'all') {
      const maxPos = parseInt(positionFilter, 10);
      if (!isNaN(maxPos)) {
        list = list.filter((item) => {
          const pos = item.peakPosition || item.rank || 1;
          return pos <= maxPos;
        });
      }
    }

    // 4. Peak Only Deduplication
    if (displayOptions.peakOnly) {
      const seen = new Map<string, MilestoneItem>();
      for (const it of list) {
        const key = `${it.type}_${it.title.toLowerCase()}_${(it.artist || '').toLowerCase()}`;
        if (!seen.has(key)) {
          seen.set(key, it);
        } else {
          const prev = seen.get(key)!;
          const prevRank = prev.peakPosition || prev.rank || 999;
          const curRank = it.peakPosition || it.rank || 999;
          if (curRank < prevRank || (curRank === prevRank && (it.plays || 0) > (prev.plays || 0))) {
            seen.set(key, it);
          }
        }
      }
      list = Array.from(seen.values());
    }

    // 5. Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case 'week_desc':
          return (b.weekNumber || 0) - (a.weekNumber || 0);
        case 'week_asc':
          return (a.weekNumber || 0) - (b.weekNumber || 0);
        case 'rank_asc':
          return (a.peakPosition || a.rank || 999) - (b.peakPosition || b.rank || 999);
        case 'weeks_at_1_desc':
          return (b.weeksAtNum1 || 0) - (a.weeksAtNum1 || 0) || (b.plays || 0) - (a.plays || 0);
        case 'plays_desc':
          return (b.plays || 0) - (a.plays || 0);
        case 'sales_desc':
          return (b.salesUnits || b.points || b.plays || 0) - (a.salesUnits || a.points || a.plays || 0);
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'artist_asc':
          return (a.artist || a.title).localeCompare(b.artist || b.title);
        default:
          return 0;
      }
    });

    // 6. Limit Count
    if (limitCount !== 'all') {
      return list.slice(0, Number(limitCount));
    }

    return list;
  };

  // Helper to share current filtered milestones summary
  const handleShare = (categoryTitle: string, itemsCount: number) => {
    const shareText = `🏆 ZeroCharts Milestones: ${categoryTitle} (${selectedYear === 'all' ? 'All-Time' : selectedYear})\nFeaturing ${itemsCount} records calculated across ${allWeeks.length} weekly charts.\nCheck your music history at YourHot100!`;
    navigator.clipboard.writeText(shareText).then(() => {
      setToastMessage('Milestone summary copied to clipboard!');
      setTimeout(() => setToastMessage(null), 2500);
    });
  };

  // Resolve active raw item list based on category & sub-type
  const getActiveRawList = (): MilestoneItem[] => {
    switch (activeCategory) {
      case 'certifications':
        return subType === 'tracks'
          ? milestones.certificationsSummary.topCertifiedTracks
          : subType === 'artists'
          ? milestones.artistsWithMostSales
          : milestones.certificationsSummary.topCertifiedAlbums;
      case 'all_1s':
        return subType === 'tracks'
          ? milestones.allNumberOnes.tracks
          : subType === 'artists'
          ? milestones.allNumberOnes.artists
          : milestones.allNumberOnes.albums;
      case 'artists_most_1s':
        return milestones.artistsWithMostNum1s;
      case 'songs_most_weeks_at_1':
        return milestones.songsWithMostWeeksAtNum1;
      case 'most_weeks_accum_1':
        return milestones.mostWeeksAccumulatedAtNum1;
      case 'artists_most_consec_1':
        return milestones.artistsWithMostConsecutiveNum1s;
      case 'albums_most_1s':
        return milestones.albumsWithMostNum1s;
      case 'artists_most_debuts_1':
        return milestones.artistsWithMostDebutsAtNum1;
      case 'songs_most_consec_weeks_1':
        return milestones.songsWithMostConsecutiveWeeksAtNum1;
      case 'most_weeks_until_1':
        return milestones.mostWeeksUntilReachingNum1;
      case 'artists_simul_tracks':
        return milestones.artistsWithMostSimultaneousTracks;
      case 'albums_most_tracks_1':
        return milestones.albumsWithMostTracksAtNum1;
      case 'best_debuts':
        return subType === 'tracks'
          ? milestones.bestDebuts.tracks
          : subType === 'artists'
          ? milestones.bestDebuts.artists
          : milestones.bestDebuts.albums;
      case 'most_plays_week':
        return subType === 'tracks'
          ? milestones.mostPlaysInAWeek.tracks
          : subType === 'artists'
          ? milestones.mostPlaysInAWeek.artists
          : milestones.mostPlaysInAWeek.albums;
      case 'points_accumulators':
        return subType === 'tracks'
          ? milestones.pointsAccumulators.tracks
          : subType === 'artists'
          ? milestones.pointsAccumulators.artists
          : milestones.pointsAccumulators.albums;
      case 'fastest_artists_1':
        return subType === 'tracks'
          ? milestones.fastestArtistsToReachMilestones.to5
          : subType === 'artists'
          ? milestones.fastestArtistsToReachMilestones.to10
          : milestones.fastestArtistsToReachMilestones.to20;
      case 'longest_active_1_span':
        return milestones.longestActiveNum1CareerSpan;
      case 'songs_biggest_jump_1':
        return milestones.songsWithBiggestJumpToNum1;
      case 'songs_longest_climb_1':
        return milestones.songsWithLongestClimbToNum1;
      case 'artists_highest_conv_rate':
        return milestones.artistsWithHighestNum1ConversionRate;
      case 'chart_domination':
        return subType === 'tracks'
          ? milestones.chartDominationScores.tracks
          : subType === 'artists'
          ? milestones.chartDominationScores.artists
          : milestones.chartDominationScores.albums;
      case 'most_weeks_accum':
        return subType === 'tracks'
          ? milestones.mostWeeksAccumulated.tracks
          : subType === 'artists'
          ? milestones.mostWeeksAccumulated.artists
          : milestones.mostWeeksAccumulated.albums;
      case 'most_weeks_at_1':
        return subType === 'tracks'
          ? milestones.mostWeeksAtNum1.tracks
          : subType === 'artists'
          ? milestones.mostWeeksAtNum1.artists
          : milestones.mostWeeksAtNum1.albums;
      case 'most_consec_1':
        return subType === 'tracks'
          ? milestones.mostConsecutiveWeeksAtNum1.tracks
          : subType === 'artists'
          ? milestones.mostConsecutiveWeeksAtNum1.artists
          : milestones.mostConsecutiveWeeksAtNum1.albums;
      case 'most_units_sold':
        return subType === 'tracks'
          ? milestones.mostUnitsSold.tracks
          : milestones.mostUnitsSold.albums;
      case 'artists_most_sales':
        return milestones.artistsWithMostSales;
      default:
        return [];
    }
  };

  const activeRawList = getActiveRawList();
  const processedItems = processItemsList(activeRawList);

  if (!isOpen) return null;

  return (
    <div
      id="milestones-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="milestones-modal-card"
        className="w-full max-w-7xl h-[92vh] max-h-[950px] flex flex-col bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 relative"
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 right-20 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-800 bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-100">
                  Milestones & Historical Records
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ZeroCharts Hall
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                All-time chart endurance, historic peaks, unbroken #1 streaks, and certified milestones across {allWeeks.length} weeks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Left Navigation Sidebar + Right Content Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* CATEGORY NAV (Sidebar on desktop, horizontal bar on mobile) */}
          <aside className="w-full md:w-72 lg:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-800/90 bg-zinc-950/95 overflow-x-auto md:overflow-y-auto p-2 md:p-3 flex md:flex-col gap-1.5 md:space-y-1 custom-scrollbar">
            <div className="hidden md:block px-3 py-1 text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Chart Record Categories
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveCategory(item.id as MilestoneCategory);
                    setSearchQuery('');
                  }}
                  id={`milestone-nav-${item.id}`}
                  className={`flex-shrink-0 md:w-full flex items-center justify-between px-3 md:px-3.5 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-zinc-800/90 text-white shadow-sm border border-zinc-700/80'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 md:gap-3 truncate">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-zinc-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase border ml-2 ${
                        item.badgeColor || 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </aside>

          {/* RIGHT CONTENT PANEL WITH FILTER & SORTER BAR */}
          <main className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
            {/* 1. GRAPHS (PRO) */}
            {activeCategory === 'graphs' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <LineChart className="w-5 h-5 text-purple-400" />
                      <span>Chart Trajectories & Weekly Stream Momentum</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Weekly play volume and historical #1 point trends over time.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Total Weekly Plays Trend */}
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        All-Time Weekly Streaming Volume (Scrobbles per Week)
                      </h4>
                      <span className="text-xs font-mono text-purple-400 font-bold">
                        {allWeeks.reduce((acc, w) => acc + w.tracksCount, 0).toLocaleString()} Total Scrobbles
                      </span>
                    </div>

                    <div className="h-64 w-full relative flex items-end gap-1 pt-6 pb-6 px-2 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
                      {allWeeks.length === 0 ? (
                        <div className="w-full text-center text-xs text-zinc-500 my-auto">
                          No weekly chart history available.
                        </div>
                      ) : (
                        allWeeks.map((w) => {
                          const maxPlays = Math.max(...allWeeks.map((wk) => wk.tracksCount), 1);
                          const heightPct = Math.max(8, Math.round((w.tracksCount / maxPlays) * 100));
                          return (
                            <div
                              key={w.weekNumber}
                              className="flex-1 flex flex-col items-center h-full justify-end group relative"
                            >
                              <div
                                style={{ height: `${heightPct}%` }}
                                className="w-full max-w-[28px] bg-gradient-to-t from-purple-600/80 to-purple-400 rounded-t-sm group-hover:from-amber-500 group-hover:to-amber-300 transition-all cursor-pointer relative"
                              >
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-zinc-900 border border-zinc-700 text-white text-[10px] py-1 px-2 rounded-lg shadow-xl z-20 whitespace-nowrap pointer-events-none">
                                  <span className="font-bold">{w.label}</span>
                                  <span className="text-amber-400 font-mono">{w.tracksCount} plays</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-mono text-zinc-500 mt-1 truncate w-full text-center">
                                W{w.weekNumber}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Top 5 Artists Weekly Share */}
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                      Historical #1 Artists Dominance
                    </h4>
                    <div className="space-y-3">
                      {milestones.artistsWithMostNum1s.slice(0, 5).map((art, idx) => (
                        <div
                          key={art.id}
                          onClick={() => openArtistProfile(art.artist || art.title)}
                          className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-purple-500/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 text-center font-mono font-bold text-xs text-purple-400">
                              #{idx + 1}
                            </span>
                            <img
                              src={art.coverArt}
                              alt={art.title}
                              className="w-10 h-10 rounded-lg object-cover border border-zinc-800"
                            />
                            <div>
                              <div className="text-xs font-bold text-zinc-200 hover:text-purple-300">
                                {art.title}
                              </div>
                              <div className="text-[11px] text-zinc-400">{art.subtitle}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-purple-400">{art.statValue}</div>
                            <div className="text-[10px] text-zinc-300">{art.statLabel}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BIGGEST ERAS (PRO) */}
            {activeCategory === 'biggest_eras' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      <span>Biggest Album Eras of All-Time</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Comprehensive album eras ranked by combined track streams, #1 singles generated, and chart endurance.
                    </p>
                  </div>
                </div>

                {/* Filter Bar for Eras */}
                <MilestoneFilterBar
                  availableYears={availableYears}
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear}
                  limitCount={limitCount}
                  onLimitChange={setLimitCount}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  positionFilter={positionFilter}
                  onPositionFilterChange={setPositionFilter}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  subType={subType}
                  onSubTypeChange={setSubType}
                  showEntityTabs={false}
                  displayOptions={displayOptions}
                  onDisplayOptionsChange={setDisplayOptions}
                  onShare={() => handleShare('Biggest Eras', milestones.biggestEras.length)}
                />

                <div className="space-y-3">
                  {milestones.biggestEras
                    .filter((era) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        era.albumName.toLowerCase().includes(q) ||
                        era.artist.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, limitCount === 'all' ? undefined : Number(limitCount))
                    .map((era, idx) => (
                      <div
                        key={`era_${idx}_${era.albumName}`}
                        className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 font-mono font-black text-sm text-amber-400">
                              #{idx + 1}
                            </span>
                            <img
                              src={era.coverArt}
                              alt={era.albumName}
                              className="w-12 h-12 rounded-xl object-cover border border-zinc-800"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-white">{era.albumName}</h4>
                                {era.certLabel !== '—' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {era.certLabel}
                                  </span>
                                )}
                              </div>
                              <div
                                onClick={() => openArtistProfile(era.artist)}
                                className="text-xs text-zinc-400 hover:text-amber-300 cursor-pointer"
                              >
                                {era.artist} • {era.trackCount} Tracks
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <div className="text-sm font-black text-amber-400">
                                {era.totalUnits.toLocaleString()} Units
                              </div>
                              <div className="text-[11px] text-zinc-300">
                                {era.totalEraStreams.toLocaleString()} Total Plays • {era.albumWeeksOnChart} Wks (Peak #{era.albumPeak})
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Singles in Era */}
                        {era.topTracks.length > 0 && (
                          <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              Key Singles:
                            </span>
                            {era.topTracks.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-2 py-1 rounded-lg text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-1.5"
                              >
                                <span>{t.title}</span>
                                <span className="text-[10px] font-bold text-amber-400 font-mono">
                                  #{t.peak === 1 ? '🥇1' : t.peak} ({t.plays}p)
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 3. PERFECT ALL KILL (PAK) */}
            {activeCategory === 'perfect_all_kill' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <span>Perfect All-Kill (PAK) Hall of Fame</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    The ultra-rare historical achievement where a single artist captured #1 Song, #1 Artist, and #1 Album simultaneously in the exact same week.
                  </p>
                </div>

                {milestones.perfectAllKills.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
                    <Flame className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">No Perfect All-Kill recorded yet.</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      To achieve a PAK, a single artist must hold the #1 Song, #1 Artist, and #1 Album in the same charting week.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {milestones.perfectAllKills.map((pak, idx) => (
                      <div
                        key={`pak_${idx}_${pak.weekNumber}`}
                        className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 border border-amber-500/40 shadow-xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500 text-black font-mono">
                              PAK #{idx + 1}
                            </span>
                            <div>
                              <div
                                onClick={() => openArtistProfile(pak.artist)}
                                className="text-sm font-black text-white hover:text-amber-300 cursor-pointer"
                              >
                                {pak.artist}
                              </div>
                              <div className="text-xs text-zinc-400">
                                Week {pak.weekNumber} ({pak.dateRange})
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-amber-400">{pak.totalWeekPlays} Plays</div>
                            <div className="text-[10px] text-zinc-500">Weekly Dominance</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-800">
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                            <div className="text-[10px] uppercase font-bold text-amber-400">🥇 #1 Song</div>
                            <div className="text-xs font-bold text-zinc-200 truncate">{pak.trackTitle}</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                            <div className="text-[10px] uppercase font-bold text-amber-400">🥇 #1 Artist</div>
                            <div className="text-xs font-bold text-zinc-200 truncate">{pak.artist}</div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80">
                            <div className="text-[10px] uppercase font-bold text-amber-400">🥇 #1 Album</div>
                            <div className="text-xs font-bold text-zinc-200 truncate">{pak.albumTitle}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. ALL TABLE-DRIVEN RECORD CATEGORIES (All #1s, Most Weeks, Debuts, Sales, etc.) */}
            {activeCategory !== 'graphs' && activeCategory !== 'biggest_eras' && activeCategory !== 'perfect_all_kill' && (
              <div className="space-y-4">
                {/* Category Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      {React.createElement(
                        menuItems.find((m) => m.id === activeCategory)?.icon || Trophy,
                        { className: 'w-5 h-5 text-amber-400' }
                      )}
                      <span>{menuItems.find((m) => m.id === activeCategory)?.label}</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Browse and filter all calculated historical milestones, streaks, and achievements.
                    </p>
                  </div>
                </div>

                {/* Filter and Sorter Bar matching the user's uploaded layout */}
                <MilestoneFilterBar
                  availableYears={availableYears}
                  selectedYear={selectedYear}
                  onYearChange={setSelectedYear}
                  limitCount={limitCount}
                  onLimitChange={setLimitCount}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  positionFilter={positionFilter}
                  onPositionFilterChange={setPositionFilter}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  subType={subType}
                  onSubTypeChange={setSubType}
                  showEntityTabs={
                    activeCategory === 'all_1s' ||
                    activeCategory === 'most_weeks_accum' ||
                    activeCategory === 'most_weeks_at_1' ||
                    activeCategory === 'most_consec_1' ||
                    activeCategory === 'best_debuts' ||
                    activeCategory === 'most_plays_week' ||
                    activeCategory === 'points_accumulators' ||
                    activeCategory === 'most_units_sold' ||
                    activeCategory === 'certifications' ||
                    activeCategory === 'chart_domination' ||
                    activeCategory === 'fastest_artists_1'
                  }
                  displayOptions={displayOptions}
                  onDisplayOptionsChange={setDisplayOptions}
                  onShare={() =>
                    handleShare(
                      menuItems.find((m) => m.id === activeCategory)?.label || 'Milestones',
                      processedItems.length
                    )
                  }
                  totalFilteredCount={processedItems.length}
                />

                {/* Certifications Badge Summary (when viewing Certifications) */}
                {activeCategory === 'certifications' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pb-2">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/40 to-zinc-900 border border-cyan-500/30 text-center">
                      <div className="text-xl font-black text-cyan-400">
                        {milestones.certificationsSummary.totalDiamond}
                      </div>
                      <div className="text-[11px] font-bold text-cyan-200 mt-0.5">💎 Diamond (10M+)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-slate-900 to-zinc-900 border border-slate-400/30 text-center">
                      <div className="text-xl font-black text-slate-200">
                        {milestones.certificationsSummary.totalPlatinum}
                      </div>
                      <div className="text-[11px] font-bold text-slate-300 mt-0.5">💿 Platinum (1M+)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-950/40 to-zinc-900 border border-amber-500/30 text-center">
                      <div className="text-xl font-black text-amber-400">
                        {milestones.certificationsSummary.totalGold}
                      </div>
                      <div className="text-[11px] font-bold text-amber-200 mt-0.5">🥇 Gold (500K+)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                      <div className="text-xl font-black text-zinc-200">
                        {milestones.mostUnitsSold.tracks.length + milestones.mostUnitsSold.albums.length}
                      </div>
                      <div className="text-[11px] font-bold text-zinc-400 mt-0.5">Total Eligible Catalog</div>
                    </div>
                  </div>
                )}

                {/* Render Milestones Table with full display options */}
                <MilestonesTable
                  items={processedItems}
                  displayOptions={displayOptions}
                  onArtistClick={(art) => openArtistProfile(art)}
                  onDetailClick={(item) => setSelectedDetailItem({ type: item.type as any, data: item })}
                  onAwardPlaque={onAwardPlaque}
                  emptyMessage={`No milestone records match your search query (${searchQuery}) or filters.`}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
