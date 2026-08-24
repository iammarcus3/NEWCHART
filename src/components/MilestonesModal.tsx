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
  ChevronRight,
  ExternalLink,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  computeMilestonesData,
  MilestoneItem,
  EraMilestoneItem,
  PerfectAllKillItem,
} from '../utils/milestonesEngine';

export type MilestoneCategory =
  | 'graphs'
  | 'certifications'
  | 'all_1s'
  | 'artists_most_1s'
  | 'albums_most_1s'
  | 'most_weeks_accum'
  | 'most_weeks_at_1'
  | 'most_consec_1'
  | 'best_debuts'
  | 'most_plays_week'
  | 'artists_most_debuts_1'
  | 'artists_simul_tracks'
  | 'most_weeks_until_1'
  | 'perfect_all_kill'
  | 'points_accumulators'
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

  const [activeCategory, setActiveCategory] = useState<MilestoneCategory>(initialCategory);
  const [subType, setSubType] = useState<'tracks' | 'artists' | 'albums'>('tracks');
  const [searchQuery, setSearchQuery] = useState('');

  // Compute all milestones data
  const milestones = useMemo(() => {
    return computeMilestonesData(allWeeks, allProcessedScrobbles, mergedMap, zeroSettings);
  }, [allWeeks, allProcessedScrobbles, mergedMap, zeroSettings]);

  if (!isOpen) return null;

  // Navigation Items matching the user's exact uploaded sidebar
  const menuItems = [
    { id: 'graphs', label: 'Graphs', icon: LineChart, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'certifications', label: 'Certifications', icon: Award, badge: 'NEW', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    { id: 'all_1s', label: 'All #1s', icon: Trophy },
    { id: 'artists_most_1s', label: 'Artists with Most #1s', icon: Crown },
    { id: 'albums_most_1s', label: 'Albums with Most #1s', icon: Disc, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'most_weeks_accum', label: 'Most Weeks Accumulated', icon: Calendar },
    { id: 'most_weeks_at_1', label: 'Most Weeks at #1', icon: Star },
    { id: 'most_consec_1', label: 'Most Consecutive Weeks at #1', icon: CheckCircle2, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'best_debuts', label: 'Best Debuts', icon: Rocket },
    { id: 'most_plays_week', label: 'Most Plays in a Week', icon: Headphones },
    { id: 'artists_most_debuts_1', label: 'Artists with Most Debuts at #1', icon: Sparkles },
    { id: 'artists_simul_tracks', label: 'Artists with Most Simultaneous Tracks', icon: Music, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'most_weeks_until_1', label: 'Most Weeks Until Reaching #1', icon: TrendingUp, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'perfect_all_kill', label: 'Perfect All Kill', icon: Flame },
    { id: 'points_accumulators', label: 'Points Accumulators', icon: Layers },
    { id: 'most_units_sold', label: 'Most Units Sold', icon: BarChart3, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'artists_most_sales', label: 'Artists with Most Sales', icon: Users, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    { id: 'biggest_eras', label: 'Biggest Eras', icon: Zap, badge: 'PRO', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  ];

  // Helper for filtering items with search query
  const filterList = (items: MilestoneItem[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.artist && item.artist.toLowerCase().includes(q)) ||
        (item.album && item.album.toLowerCase().includes(q))
    );
  };

  return (
    <div
      id="milestones-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="milestones-modal-card"
        className="w-full max-w-7xl h-[92vh] max-h-[950px] flex flex-col bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl overflow-hidden text-zinc-100"
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-zinc-100">
                  Milestones & Historical Records
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ZeroCharts Record Hall
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                All-time chart endurance, historic peaks, unbroken #1 streaks, and certified milestones across {allWeeks.length} weeks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search milestone records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl text-xs bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500/50 w-48 sm:w-60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: Left Sidebar + Right Content Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* CATEGORY NAV (Horizontal scrolling bar on mobile, sidebar on md+) */}
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

          {/* RIGHT CONTENT PANEL */}
          <main className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
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
                        allWeeks.map((w, idx) => {
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
                                {/* Tooltip on hover */}
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

            {/* 2. CERTIFICATIONS (NEW) */}
            {activeCategory === 'certifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Award className="w-5 h-5 text-rose-400" />
                    <span>Certified Units & Plaque Hall</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Formula calculated sales units (Gold, Platinum, Multi-Platinum, Diamond) across your discography.
                  </p>
                </div>

                {/* Badges Overview Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/40 to-zinc-900 border border-cyan-500/30 text-center">
                    <div className="text-2xl font-black text-cyan-400">
                      {milestones.certificationsSummary.totalDiamond}
                    </div>
                    <div className="text-xs font-bold text-cyan-200 mt-1">💎 Diamond (10M+)</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-zinc-900 border border-slate-400/30 text-center">
                    <div className="text-2xl font-black text-slate-200">
                      {milestones.certificationsSummary.totalPlatinum}
                    </div>
                    <div className="text-xs font-bold text-slate-300 mt-1">💿 Platinum (1M+)</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 to-zinc-900 border border-amber-500/30 text-center">
                    <div className="text-2xl font-black text-amber-400">
                      {milestones.certificationsSummary.totalGold}
                    </div>
                    <div className="text-xs font-bold text-amber-200 mt-1">🥇 Gold (500K+)</div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center">
                    <div className="text-2xl font-black text-zinc-200">
                      {milestones.mostUnitsSold.tracks.length + milestones.mostUnitsSold.albums.length}
                    </div>
                    <div className="text-xs font-bold text-zinc-400 mt-1">Total Eligible Catalog</div>
                  </div>
                </div>

                {/* Sub-selector for Certifications */}
                <div className="flex gap-2 border-b border-zinc-800 pb-2">
                  <button
                    onClick={() => setSubType('tracks')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subType === 'tracks'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900'
                    }`}
                  >
                    Top Certified Songs ({milestones.certificationsSummary.topCertifiedTracks.length})
                  </button>
                  <button
                    onClick={() => setSubType('albums')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subType === 'albums'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900'
                    }`}
                  >
                    Top Certified Albums ({milestones.certificationsSummary.topCertifiedAlbums.length})
                  </button>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.certificationsSummary.topCertifiedTracks
                      : milestones.certificationsSummary.topCertifiedAlbums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. ALL #1s */}
            {activeCategory === 'all_1s' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <span>Complete Chronology of All #1s</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Every song, artist, and album that conquered the pinnacle of the weekly charts.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      #1 Songs ({milestones.allNumberOnes.tracks.length})
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      #1 Artists ({milestones.allNumberOnes.artists.length})
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      #1 Albums ({milestones.allNumberOnes.albums.length})
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.allNumberOnes.tracks
                      : subType === 'artists'
                      ? milestones.allNumberOnes.artists
                      : milestones.allNumberOnes.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 4. ARTISTS WITH MOST #1s */}
            {activeCategory === 'artists_most_1s' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span>Artists with Most #1 Hits</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Leaderboard of artists ranked by distinct #1 songs and total weeks crowned at the top.
                  </p>
                </div>

                <div className="space-y-2">
                  {filterList(milestones.artistsWithMostNum1s).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: 'artist', data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 5. ALBUMS WITH MOST #1s (PRO) */}
            {activeCategory === 'albums_most_1s' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Disc className="w-5 h-5 text-purple-400" />
                    <span>Albums with Most #1 Singles</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Record-breaking albums that produced multiple #1 chart-topping tracks.
                  </p>
                </div>

                <div className="space-y-2">
                  {filterList(milestones.albumsWithMostNum1s).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: 'album', data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 6. MOST WEEKS ACCUMULATED */}
            {activeCategory === 'most_weeks_accum' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-400" />
                      <span>Most Weeks Accumulated (Chart Longevity)</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      All-time endurance leaders with the highest total weeks spent charting.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Artists
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-emerald-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.mostWeeksAccumulated.tracks
                      : subType === 'artists'
                      ? milestones.mostWeeksAccumulated.artists
                      : milestones.mostWeeksAccumulated.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 7. MOST WEEKS AT #1 */}
            {activeCategory === 'most_weeks_at_1' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-400" />
                      <span>Most Cumulative Weeks at #1</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      The undisputed champions with the most cumulative weeks crowned at #1.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Artists
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.mostWeeksAtNum1.tracks
                      : subType === 'artists'
                      ? milestones.mostWeeksAtNum1.artists
                      : milestones.mostWeeksAtNum1.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 8. MOST CONSECUTIVE WEEKS AT #1 (PRO) */}
            {activeCategory === 'most_consec_1' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-purple-400" />
                      <span>Most Consecutive Weeks at #1 (Unbroken Streaks)</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Longest uninterrupted winning streaks holding the #1 spot without dropping.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-purple-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-purple-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Artists
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-purple-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.mostConsecutiveWeeksAtNum1.tracks
                      : subType === 'artists'
                      ? milestones.mostConsecutiveWeeksAtNum1.artists
                      : milestones.mostConsecutiveWeeksAtNum1.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 9. BEST DEBUTS */}
            {activeCategory === 'best_debuts' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Rocket className="w-5 h-5 text-sky-400" />
                      <span>Best Debuts in Chart History</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Highest entering new songs, albums (minimum 3 tracks), and artists.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-sky-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-sky-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Artists
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-sky-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.bestDebuts.tracks
                      : subType === 'artists'
                      ? milestones.bestDebuts.artists
                      : milestones.bestDebuts.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 10. MOST PLAYS IN A WEEK */}
            {activeCategory === 'most_plays_week' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-amber-400" />
                      <span>Most Plays in a Single Week</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Highest single-week streaming explosions recorded in your history.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Artists
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.mostPlaysInAWeek.tracks
                      : subType === 'artists'
                      ? milestones.mostPlaysInAWeek.artists
                      : milestones.mostPlaysInAWeek.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 11. ARTISTS WITH MOST DEBUTS AT #1 */}
            {activeCategory === 'artists_most_debuts_1' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span>Artists with Most Debuts at #1</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Artists capable of landing instant #1 hits on their debut week.
                  </p>
                </div>

                <div className="space-y-2">
                  {filterList(milestones.artistsWithMostDebutsAtNum1).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: 'artist', data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 12. ARTISTS WITH MOST SIMULTANEOUS TRACKS (PRO) */}
            {activeCategory === 'artists_simul_tracks' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Music className="w-5 h-5 text-purple-400" />
                    <span>Artists with Most Simultaneous Tracks</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Chart takeover records: Most concurrent tracks charting in a single week.
                  </p>
                </div>

                <div className="space-y-2">
                  {filterList(milestones.artistsWithMostSimultaneousTracks).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: 'artist', data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 13. MOST WEEKS UNTIL REACHING #1 (PRO) */}
            {activeCategory === 'most_weeks_until_1' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                    <span>Most Weeks Until Reaching #1 (Slow-Burn Hits)</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Sleeper hits that climbed patiently across multiple weeks before clinching the #1 throne.
                  </p>
                </div>

                <div className="space-y-2">
                  {filterList(milestones.mostWeeksUntilReachingNum1).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: 'track', data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 14. PERFECT ALL KILL */}
            {activeCategory === 'perfect_all_kill' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
                    <span>Perfect All-Kill (PAK) Hall of Fame</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Historic milestone: Holding #1 on the Song Chart, Artist Chart, and Album Chart simultaneously!
                  </p>
                </div>

                {milestones.perfectAllKills.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-3">
                    <Flame className="w-10 h-10 text-zinc-600 mx-auto" />
                    <h4 className="text-sm font-bold text-zinc-300">No Perfect All-Kills Recorded Yet</h4>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      A Perfect All-Kill occurs when an artist holds the #1 Song, #1 Artist, and #1 Album simultaneously in the same week!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {milestones.perfectAllKills.map((pak, idx) => (
                      <div
                        key={`pak_${idx}_${pak.weekNumber}`}
                        className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-amber-950/20 to-zinc-900 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={pak.coverArt}
                            alt={pak.artist}
                            className="w-14 h-14 rounded-xl object-cover border border-rose-500/40 shadow-lg"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white">
                                Perfect All-Kill
                              </span>
                              <span className="text-xs font-bold text-amber-400">Week {pak.weekNumber}</span>
                            </div>
                            <h4
                              onClick={() => openArtistProfile(pak.artist)}
                              className="text-sm font-black text-white hover:text-rose-300 cursor-pointer mt-0.5"
                            >
                              {pak.artist}
                            </h4>
                            <div className="text-xs text-zinc-300 mt-0.5">
                              Song: <span className="font-semibold text-rose-300">"{pak.trackTitle}"</span> | Album: <span className="font-semibold text-amber-300">"{pak.albumTitle}"</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold text-rose-400">{pak.totalWeekPlays} Plays</div>
                          <div className="text-[11px] text-zinc-400">{pak.dateRange}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 15. POINTS ACCUMULATORS */}
            {activeCategory === 'points_accumulators' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-400" />
                      <span>Points Accumulators (All-Time Point Giants)</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Highest scoring entries computed by the ZeroCharts weighted formula.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('artists')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'artists' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Artists
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.pointsAccumulators.tracks
                      : subType === 'artists'
                      ? milestones.pointsAccumulators.artists
                      : milestones.pointsAccumulators.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 16. MOST UNITS SOLD (PRO) */}
            {activeCategory === 'most_units_sold' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-purple-400" />
                      <span>Most Units Sold (Certified Sales Formula)</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Plays × Weight + Chart Stability × Weight = Certified Unit Sales.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setSubType('tracks')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'tracks' ? 'bg-purple-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Songs
                    </button>
                    <button
                      onClick={() => setSubType('albums')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        subType === 'albums' ? 'bg-purple-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Albums
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filterList(
                    subType === 'tracks'
                      ? milestones.mostUnitsSold.tracks
                      : milestones.mostUnitsSold.albums
                  ).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: item.type as any, data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 17. ARTISTS WITH MOST SALES (PRO) */}
            {activeCategory === 'artists_most_sales' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-400" />
                    <span>Artists with Most Career Sales Units</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Aggregated career certified units across all singles and albums combined.
                  </p>
                </div>

                <div className="space-y-2">
                  {filterList(milestones.artistsWithMostSales).map((item) => (
                    <MilestoneCardRow
                      key={item.id}
                      item={item}
                      onArtistClick={() => item.artist && openArtistProfile(item.artist)}
                      onDetailClick={() => setSelectedDetailItem({ type: 'artist', data: item })}
                      onAwardPlaque={onAwardPlaque}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 18. BIGGEST ERAS (PRO) */}
            {activeCategory === 'biggest_eras' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>Biggest Album Eras of All-Time</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Comprehensive album eras ranked by combined track streams, #1 singles generated, and chart endurance.
                  </p>
                </div>

                <div className="space-y-3">
                  {milestones.biggestEras.map((era, idx) => (
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
          </main>
        </div>
      </div>
    </div>
  );
};

// Sub-component for individual record rows
const MilestoneCardRow: React.FC<{
  item: MilestoneItem;
  onArtistClick?: () => void;
  onDetailClick?: () => void;
  onAwardPlaque?: (item: any) => void;
}> = ({ item, onArtistClick, onDetailClick, onAwardPlaque }) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all hover:bg-zinc-900 group">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-6 text-center font-mono font-black text-xs text-zinc-400 group-hover:text-amber-400">
          #{item.rank}
        </span>

        {item.coverArt && (
          <img
            src={item.coverArt}
            alt={item.title}
            className="w-10 h-10 rounded-lg object-cover border border-zinc-800 flex-shrink-0"
          />
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span
              onClick={onDetailClick}
              className="text-xs font-bold text-zinc-100 hover:text-amber-300 cursor-pointer truncate"
            >
              {item.title}
            </span>

            {item.extraBadge && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                {item.extraBadge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate">
            {item.artist ? (
              <span
                onClick={onArtistClick}
                className="hover:text-zinc-200 cursor-pointer hover:underline"
              >
                {item.artist}
              </span>
            ) : (
              <span>{item.subtitle}</span>
            )}
            {item.secondaryStat && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{item.secondaryStat}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 ml-3">
        <div className="text-right">
          <div className="text-xs font-black text-amber-400 font-mono">{item.statValue}</div>
          <div className="text-[10px] text-zinc-300">{item.statLabel}</div>
        </div>

        {onAwardPlaque && (
          <button
            onClick={() => onAwardPlaque(item)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
            title="Generate custom commemorative plaque"
          >
            <Award className="w-3 h-3 text-amber-400" />
            <span>Plaque</span>
          </button>
        )}
      </div>
    </div>
  );
};
