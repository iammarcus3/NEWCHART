import React, { useState, useEffect, useMemo } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Music,
  User,
  Disc,
  Award,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sliders,
  Share2,
  Lock,
  Flame,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3,
  Calendar,
  Layers,
  BarChart2,
  Clock,
  Radio,
  Headphones,
  Trophy,
} from 'lucide-react';
import { ChartExportModal } from '../ChartExportModal';
import { MoveStatus, SubjectType } from '../../types/music';
import { computeEntityGenreChartHistory } from '../../utils/genreEngine';

interface TopChartsWidgetProps {
  onAwardPlaque: (item: {
    title: string;
    subtitle: string;
    type: 'track' | 'artist' | 'album';
    scrobbles: number;
    coverArt?: string;
  }) => void;
  onOpenMilestones?: () => void;
}

export const TopChartsWidget: React.FC<TopChartsWidgetProps> = ({
  onAwardPlaque,
  onOpenMilestones,
}) => {
  const {
    zeroSettings,
    allWeeks,
    selectedWeekNumber,
    setSelectedWeekNumber,
    stepWeek,
    jumpToLatestWeek,
    currentWeekInfo,
    weeklyTracksChart,
    weeklyArtistsChart,
    weeklyAlbumsChart,
    tracksChart,
    artistsChart,
    albumsChart,
    setEditingChartItem,
    setIsChartSettingsOpen,
    setSelectedDetailItem,
    openArtistProfile,
    mergedMap,
  } = useMusic();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'tracks' | 'artists' | 'albums' | 'all-time'>('tracks');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Keyboard navigation for weeks & tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing when typing inside inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        stepWeek(-1);
      } else if (e.key === 'ArrowRight') {
        stepWeek(1);
      } else if (e.key === '1') {
        setActiveTab('tracks');
      } else if (e.key === '2') {
        setActiveTab('artists');
      } else if (e.key === '3') {
        setActiveTab('albums');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allWeeks, selectedWeekNumber]);

  // Reset page when tab or week changes
  useEffect(() => {
    setCurrentPage(1);
    setExpandedItemId(null);
  }, [activeTab, selectedWeekNumber]);

  // Choose data source
  const rawItems: any[] = useMemo(() => {
    switch (activeTab) {
      case 'tracks':
        return weeklyTracksChart;
      case 'artists':
        return weeklyArtistsChart;
      case 'albums':
        return weeklyAlbumsChart;
      default:
        return tracksChart;
    }
  }, [activeTab, weeklyTracksChart, weeklyArtistsChart, weeklyAlbumsChart, tracksChart]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.toLowerCase().trim();
    return rawItems.filter((item: any) => {
      const title = (item.title || '').toLowerCase();
      const artist = (item.artist || '').toLowerCase();
      return title.includes(q) || artist.includes(q);
    });
  }, [rawItems, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    return filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const toggleExpand = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id));
  };

  const getStatusBadge = (status: MoveStatus, moveDiff?: number) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-cyan-950 text-cyan-400 border border-cyan-500/40 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            NEW
          </span>
        );
      case 'reentry':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
            ↺ RE
          </span>
        );
      case 'up':
        return (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            ▲ +{moveDiff && moveDiff > 0 ? moveDiff : 1}
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-rose-950/80 text-rose-400 border border-rose-500/40">
            ▼ {moveDiff ? Math.abs(moveDiff) : 1}
          </span>
        );
      case 'flat':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-zinc-900 text-zinc-500 border border-zinc-800">
            —
          </span>
        );
    }
  };

  const getStatusBorderClass = (status: MoveStatus) => {
    switch (status) {
      case 'new':
        return 'border-l-4 border-l-cyan-400';
      case 'reentry':
        return 'border-l-4 border-l-amber-400';
      case 'up':
        return 'border-l-4 border-l-emerald-400';
      case 'down':
        return 'border-l-4 border-l-rose-500/70';
      case 'flat':
      default:
        return 'border-l-4 border-l-zinc-800';
    }
  };

  return (
    <div
      id="top-charts-widget"
      className="rounded-3xl bg-zinc-950 border border-zinc-800/80 shadow-2xl overflow-hidden space-y-0"
    >
      {/* 1. STICKY / SLEEK TOPBAR (Billboard Hot 100 Dark Edition UI) */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950 border-b border-zinc-800/80 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Brand & Chart Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-purple-500 to-amber-400 flex items-center justify-center p-0.5 shadow-lg shadow-cyan-500/10 flex-shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <span className="text-xs font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-magenta-400 to-amber-300">
                  HOT
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-white tracking-tight uppercase">
                  {zeroSettings.chartTitle}
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  {allWeeks.length > 0 ? `Week ${selectedWeekNumber} of ${allWeeks.length}` : 'Live'}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono text-zinc-500">
                  [⌨ ←/→ travel • 1-3 tabs]
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {zeroSettings.chartSubtitle}
              </p>
            </div>
          </div>

          {/* Stepper Navigation & Actions */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Week Stepper */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => stepWeek(-1)}
                disabled={selectedWeekNumber <= 1}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Previous Week (Arrow Left)"
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
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Next Week (Arrow Right)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Jump to Latest */}
            {selectedWeekNumber < allWeeks.length && (
              <button
                type="button"
                onClick={jumpToLatestWeek}
                className="px-3 py-2 rounded-2xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 text-cyan-300 text-xs font-bold transition-all"
              >
                Latest
              </button>
            )}

            {/* Milestones & Records Button */}
            {onOpenMilestones && (
              <button
                type="button"
                onClick={onOpenMilestones}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-300 shadow-sm transition-all"
                title="Browse All #1s, Milestones, Best Debuts & Records"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Milestones</span>
              </button>
            )}

            {/* Settings & Rules Button (ZeroCharts style) */}
            <button
              type="button"
              onClick={() => setIsChartSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 hover:text-white shadow-sm transition-all"
              title="ZeroCharts Settings & Rules Engine"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Settings & Rules</span>
            </button>

            {/* Export Graphic Button */}
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-black shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* 2. TABS & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Main Chart Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('tracks')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'tracks'
                  ? 'bg-zinc-800 text-cyan-300 shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Hot Tracks ({weeklyTracksChart.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('artists')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'artists'
                  ? 'bg-zinc-800 text-cyan-300 shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Top Artists ({weeklyArtistsChart.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('albums')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'albums'
                  ? 'bg-zinc-800 text-cyan-300 shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Top Albums ({weeklyAlbumsChart.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all-time')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'all-time'
                  ? 'bg-zinc-800 text-cyan-300 shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>All-Time Leaders</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter ${activeTab}...`}
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* 3. BOARD HEADER & STATUS LEGEND */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-900 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono font-bold text-white">
              {currentWeekInfo?.dateRange || 'Current Timeline'}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] text-zinc-400">
              Showing {paginatedItems.length} of {filteredItems.length} charted items
            </span>
          </div>

          {/* Status Legend & Rules */}
          <div className="flex items-center gap-2.5 flex-wrap text-[11px] font-mono text-zinc-400">
            {activeTab === 'albums' && (
              <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                💿 Qualify Rule: ≥ 3 tracks overall
              </span>
            )}
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> NEW
            </span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              ▲ UP
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              ▼ DOWN
            </span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              ↺ RE-ENTRY
            </span>
            <span className="flex items-center gap-1 text-zinc-500">
              — FLAT
            </span>
          </div>
        </div>
      </div>

      {/* 4. CHART TABLE (Billboard Hot 100 Dark Edition UI Grid - Responsive) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-950/60 text-[10px] sm:text-[11px] font-black uppercase font-mono tracking-wider text-zinc-400">
              <th className="py-3 px-2 sm:px-4 w-12 sm:w-16 text-center">Rank</th>
              <th className="py-3 px-1 sm:px-2 w-12 sm:w-24 text-center">Move</th>
              <th className="py-3 px-2 sm:px-4">Title & Artist</th>
              <th className="py-3 px-4 hidden md:table-cell text-center w-48">Chart Stats</th>
              <th className="py-3 px-2 sm:px-4 text-right w-24 sm:w-36">Points / Plays</th>
              <th className="py-3 px-2 sm:px-4 w-20 sm:w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-zinc-500">
                  No chart entries found matching your query in this week.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item: any) => {
                const isExpanded = expandedItemId === item.id || expandedItemId === item._key;
                const subjectType: SubjectType =
                  activeTab === 'artists' ? 'artist' : activeTab === 'albums' ? 'album' : 'track';

                return (
                  <React.Fragment key={item.id || item._key || `${item.rank}_${item.title || item.artist}`}>
                    <tr
                      onClick={() => toggleExpand(item.id || item._key)}
                      className={`group hover:bg-zinc-900/60 transition-colors cursor-pointer ${getStatusBorderClass(
                        item.moveStatus || 'flat'
                      )} ${isExpanded ? 'bg-zinc-900/80' : ''}`}
                    >
                      {/* Rank Column */}
                      <td className="py-2.5 sm:py-3 px-2 sm:px-4 text-center">
                        <div
                          className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center font-black font-mono text-xs sm:text-sm mx-auto shadow-sm transition-transform group-hover:scale-105 ${
                            item.rank === 1
                              ? 'bg-amber-400 text-black ring-2 ring-amber-400/40'
                              : item.rank === 2
                              ? 'bg-slate-300 text-black'
                              : item.rank === 3
                              ? 'bg-amber-700 text-amber-100'
                              : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                          }`}
                        >
                          {item.rank}
                        </div>
                      </td>

                      {/* Movement Status Column */}
                      <td className="py-2.5 sm:py-3 px-1 sm:px-2 text-center">
                        {getStatusBadge(item.moveStatus || 'flat', item.moveDiff)}
                      </td>

                      {/* Title & Artist & Badges */}
                      <td className="py-2.5 sm:py-3 px-2 sm:px-4 min-w-[150px] sm:min-w-[220px]">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Artwork Thumbnail */}
                          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800 shadow-sm">
                            <img
                              src={item.coverArt}
                              alt={item.title || item.artist}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';
                              }}
                            />
                            {item.isLocked && (
                              <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 p-0.5 rounded bg-amber-500 text-black">
                                <Lock className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Badges line */}
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap mb-0.5">
                              {item.isHotShotDebut && (
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider font-mono px-1 sm:px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/50">
                                  ★ DEBUT
                                </span>
                              )}
                              {item.isGreatestGainer && (
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider font-mono px-1 sm:px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                                  ▲ GAINER
                                </span>
                              )}
                              {item.certification && (
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider font-mono px-1 sm:px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-0.5">
                                  <Award className="w-2.5 h-2.5" />
                                  {item.certification.toUpperCase()}
                                </span>
                              )}
                              {item.isManuallyEdited && (
                                <span className="text-[8px] sm:text-[9px] font-bold uppercase font-mono px-1 sm:px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                                  EDITED
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate group-hover:text-cyan-300 transition-colors">
                              {item.title || item.artist}
                            </h3>

                            {/* Artist / Subtitle */}
                            <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openArtistProfile(item.artist);
                                }}
                                className="hover:text-cyan-300 hover:underline font-medium text-left transition-colors truncate"
                                title={`View ${item.artist} Profile`}
                              >
                                {item.artist}
                              </button>
                              {item.album ? <span className="hidden sm:inline text-zinc-500 truncate">• {item.album}</span> : ''}
                            </p>

                            {/* Mobile inline chart stats */}
                            <div className="md:hidden flex items-center gap-2 mt-1 text-[9px] font-mono text-zinc-400">
                              <span>Peak <strong className="text-amber-400 font-bold">#{item.peakRank || item.rank}</strong></span>
                              <span>•</span>
                              <span>Last <strong className="text-zinc-300 font-bold">{item.lastRank ? `#${item.lastRank}` : '—'}</strong></span>
                              <span>•</span>
                              <span><strong className="text-cyan-300 font-bold">{item.weeksOnChart || 1}w</strong></span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3-Pillar Chart Stats (Peak | Last | Weeks) */}
                      <td className="py-3 px-4 hidden md:table-cell text-center">
                        <div className="inline-flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs font-mono">
                          <div className="px-2 text-center">
                            <span className="text-[9px] text-zinc-500 block uppercase">Peak</span>
                            <span className="font-bold text-amber-400">#{item.peakRank || item.rank}</span>
                          </div>
                          <span className="text-zinc-700">|</span>
                          <div className="px-2 text-center">
                            <span className="text-[9px] text-zinc-500 block uppercase">Last</span>
                            <span className="font-bold text-zinc-300">
                              {item.lastRank ? `#${item.lastRank}` : '—'}
                            </span>
                          </div>
                          <span className="text-zinc-700">|</span>
                          <div className="px-2 text-center">
                            <span className="text-[9px] text-zinc-500 block uppercase">Weeks</span>
                            <span className="font-bold text-cyan-300">{item.weeksOnChart || 1}w</span>
                          </div>
                        </div>
                      </td>

                      {/* Points / Scrobbles */}
                      <td className="py-2.5 sm:py-3 px-2 sm:px-4 text-right">
                        <div className="font-mono">
                          <span className="text-xs sm:text-sm font-black text-cyan-300 block">
                            {(item.points !== undefined ? item.points : Math.max(1, 101 - item.rank)).toLocaleString()}{' '}
                            <span className="text-[9px] sm:text-[10px] text-zinc-400">pts</span>
                          </span>
                          <span className="text-[9px] sm:text-[10px] text-zinc-500 block">
                            {item.playCount} <span className="hidden sm:inline">{item.playCount === 1 ? 'scrobble' : 'scrobbles'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2.5 sm:py-3 px-2 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          {/* Artist Profile Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openArtistProfile(item.artist);
                            }}
                            className="p-1 sm:p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 border border-zinc-800 transition-all"
                            title={`Open ${item.artist} Profile`}
                          >
                            <User className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>

                          {/* ZeroCharts Item Editor Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChartItem({ type: subjectType, item });
                            }}
                            className="p-1 sm:p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 border border-zinc-800 transition-all hidden sm:inline-flex"
                            title="Edit on Chart (ZeroCharts style)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Forge Plaque Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAwardPlaque({
                                title: item.title || item.artist,
                                subtitle: item.artist,
                                type: subjectType,
                                scrobbles: item.playCount,
                                coverArt: item.coverArt,
                              });
                            }}
                            className="p-1 sm:p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black text-zinc-400 border border-zinc-800 transition-all"
                            title="Forge Commemorative Plaque"
                          >
                            <Award className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>

                          {/* Accordion Toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.id || item._key);
                            }}
                            className="p-1 sm:p-1.5 rounded-lg bg-zinc-900 text-zinc-500 hover:text-white transition-all"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            ) : (
                              <ChevronDown className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* 5. EXPANDED DETAIL DRAWER (ZeroCharts rich stats breakdown + Genre Chart Ranks) */}
                    {isExpanded && (() => {
                      const genreHistories = (subjectType === 'track' || subjectType === 'album')
                        ? computeEntityGenreChartHistory(subjectType, item.title, item.artist, allWeeks, mergedMap, selectedWeekNumber)
                        : [];

                      return (
                        <tr className="bg-zinc-900/40 border-b border-zinc-800/80">
                          <td colSpan={6} className="p-4 sm:p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                              {/* Pillar 1: Scoring Breakdown */}
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                                <span className="text-[10px] font-black uppercase font-mono tracking-wider text-cyan-400 block">
                                  Point Calculation Breakdown
                                </span>
                                <div className="space-y-1.5 text-zinc-300 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="flex items-center gap-1 text-zinc-400">
                                      <Headphones className="w-3 h-3" /> Pure Scrobbles:
                                    </span>
                                    <span className="text-white font-bold">{item.playCount} plays</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="flex items-center gap-1 text-zinc-400">
                                      <Sparkles className="w-3 h-3 text-cyan-400" /> Stream Points:
                                    </span>
                                    <span className="text-cyan-300">{item.streamPoints || item.playCount * 70} pts</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="flex items-center gap-1 text-zinc-400">
                                      <Radio className="w-3 h-3 text-amber-400" /> Radio Weights:
                                    </span>
                                    <span className="text-amber-300">{item.radioPoints || item.playCount * 30} pts</span>
                                  </div>
                                </div>
                              </div>

                              {/* Pillar 2: Chart Trajectory */}
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                                <span className="text-[10px] font-black uppercase font-mono tracking-wider text-amber-400 block">
                                  Hot 100 Movement &amp; Peak
                                </span>
                                <div className="space-y-1.5 text-zinc-300 font-mono text-[11px]">
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">Debut Status:</span>
                                    <span className="text-white font-bold">
                                      {item.moveStatus === 'new' ? 'Week Debut' : `Week #${item.weeksOnChart} run`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">Peak Position:</span>
                                    <span className="text-amber-300 font-bold">#{item.peakRank || item.rank}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-zinc-400">Week-over-Week:</span>
                                    <span className={item.changePct && item.changePct > 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                                      {item.changePct !== null && item.changePct !== undefined
                                        ? `${item.changePct > 0 ? '+' : ''}${item.changePct}%`
                                        : 'Initial baseline'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Pillar 3: Genre Chart Rankings & Formats */}
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase font-mono tracking-wider text-purple-400 flex items-center gap-1">
                                    <Radio className="w-3 h-3 text-purple-400" /> Genre Chart Ranks
                                  </span>
                                  {genreHistories.length > 0 && (
                                    <span className="text-[9px] font-mono text-zinc-500">
                                      {genreHistories.length} format{genreHistories.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1.5 font-mono text-[11px]">
                                  {genreHistories.length === 0 ? (
                                    <div className="text-zinc-500 text-[10px] py-2 text-center">
                                      No genre ranks recorded
                                    </div>
                                  ) : (
                                    genreHistories.slice(0, 2).map((gh) => (
                                      <div
                                        key={gh.genreKey}
                                        className="p-1.5 rounded-xl bg-zinc-900/80 border border-zinc-850 flex items-center justify-between gap-1"
                                      >
                                        <div className="truncate">
                                          <div className="flex items-center gap-1">
                                            <span
                                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                              style={{ backgroundColor: gh.genreColor }}
                                            />
                                            <span className="text-[10px] font-bold text-white truncate">
                                              {gh.genreDisplayName}
                                            </span>
                                          </div>
                                          <span className="text-[9px] text-zinc-400 block truncate">
                                            {gh.weeksAtNumberOne > 0
                                              ? `${gh.weeksAtNumberOne}w at #1 • ${gh.totalWeeksOnChart}w total`
                                              : `${gh.totalWeeksOnChart} weeks on chart`}
                                          </span>
                                        </div>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-black flex-shrink-0 ${
                                            gh.peakRank === 1
                                              ? 'bg-amber-400/20 text-amber-300 border border-amber-500/40'
                                              : 'bg-zinc-800 text-cyan-300 border border-zinc-700'
                                          }`}
                                        >
                                          #{gh.peakRank}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Pillar 4: ZeroCharts Quick Actions */}
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-2">
                                <span className="text-[10px] font-black uppercase font-mono tracking-wider text-emerald-400 block">
                                  Quick Chart Actions
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingChartItem({ type: subjectType, item })}
                                    className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
                                  >
                                    <Edit3 className="w-3 h-3 text-cyan-400" />
                                    <span>Edit Item</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedDetailItem({ type: subjectType, data: item })}
                                    className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
                                  >
                                    <BarChart2 className="w-3 h-3 text-amber-400" />
                                    <span>Deep View</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 6. PAGER & FOOTER CONTROLS */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Page Size selector */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Entries per page:</span>
          <div className="flex items-center gap-1 font-mono">
            {[10, 20, 50, 100].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  pageSize === size
                    ? 'bg-zinc-800 text-cyan-300 border-zinc-700'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-850 hover:text-zinc-300'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Page Pagination Numbers */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(0, 7)
              .map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    currentPage === page
                      ? 'bg-cyan-400 text-black shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {page}
                </button>
              ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Chart Export Modal */}
      <ChartExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tab={activeTab === 'all-time' ? 'tracks' : activeTab}
      />
    </div>
  );
};
