import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Filter,
  Settings,
  Share2,
  Search,
  ChevronsUpDown,
  ArrowUpDown,
  Mic,
  Disc,
  Music,
  Check,
  X,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';

export interface MilestoneDisplayOptions {
  showSalesColumns: boolean;
  peakOnly: boolean;
  showImages: boolean;
  separateArtistColumn: boolean;
  showWeekNumber: boolean;
  showChartPosition: boolean;
  showPlays: boolean;
  showWeeksAt1: boolean;
  fontSize: 'small' | 'normal' | 'large';
}

export type MilestoneSortOption =
  | 'week_desc'
  | 'week_asc'
  | 'rank_asc'
  | 'weeks_at_1_desc'
  | 'plays_desc'
  | 'sales_desc'
  | 'title_asc'
  | 'artist_asc';

interface MilestoneFilterBarProps {
  availableYears: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  
  limitCount: number | 'all';
  onLimitChange: (limit: number | 'all') => void;
  
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  positionFilter: string;
  onPositionFilterChange: (pos: string) => void;
  
  sortBy: MilestoneSortOption;
  onSortChange: (sort: MilestoneSortOption) => void;
  
  subType: 'artists' | 'albums' | 'tracks';
  onSubTypeChange: (type: 'artists' | 'albums' | 'tracks') => void;
  showEntityTabs?: boolean;
  
  displayOptions: MilestoneDisplayOptions;
  onDisplayOptionsChange: (options: MilestoneDisplayOptions) => void;
  
  onShare?: () => void;
  totalFilteredCount?: number;
}

export const MilestoneFilterBar: React.FC<MilestoneFilterBarProps> = ({
  availableYears,
  selectedYear,
  onYearChange,
  limitCount,
  onLimitChange,
  searchQuery,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  sortBy,
  onSortChange,
  subType,
  onSubTypeChange,
  showEntityTabs = true,
  displayOptions,
  onDisplayOptionsChange,
  onShare,
  totalFilteredCount,
}) => {
  const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gearButtonRef = useRef<HTMLButtonElement>(null);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        gearButtonRef.current &&
        !gearButtonRef.current.contains(event.target as Node)
      ) {
        setIsDisplayOptionsOpen(false);
      }
    };

    if (isDisplayOptionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDisplayOptionsOpen]);

  const toggleOption = (key: keyof MilestoneDisplayOptions) => {
    if (key === 'fontSize') return;
    onDisplayOptionsChange({
      ...displayOptions,
      [key]: !displayOptions[key],
    });
  };

  const setFontSize = (size: 'small' | 'normal' | 'large') => {
    onDisplayOptionsChange({
      ...displayOptions,
      fontSize: size,
    });
  };

  return (
    <div className="w-full space-y-3 pb-3">
      {/* ROW 1: Year Selector (Left) & Limit / Settings / Share (Right) */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Year Filter */}
        <div className="relative inline-block">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 text-xs font-semibold text-zinc-200 hover:border-zinc-700 transition-colors shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer pr-4 appearance-none"
              aria-label="Filter by Year"
            >
              <option value="all" className="bg-zinc-900 text-zinc-200">
                All Years
              </option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr} className="bg-zinc-900 text-zinc-200">
                  {yr}
                </option>
              ))}
            </select>
            <ChevronsUpDown className="w-3 h-3 text-zinc-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Right: Limit Dropdown, Settings Gear, Share */}
        <div className="flex items-center gap-2 relative">
          {/* Limit Count Dropdown */}
          <div className="relative inline-block">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/90 text-xs font-mono font-semibold text-zinc-300 hover:border-zinc-700 transition-colors shadow-sm">
              <Filter className="w-3 h-3 text-zinc-400 flex-shrink-0" />
              <select
                value={String(limitCount)}
                onChange={(e) => onLimitChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent text-xs font-mono font-bold text-zinc-200 focus:outline-none cursor-pointer pr-4 appearance-none"
                aria-label="Limit items count"
              >
                <option value="10" className="bg-zinc-900 text-zinc-200">10</option>
                <option value="25" className="bg-zinc-900 text-zinc-200">25</option>
                <option value="50" className="bg-zinc-900 text-zinc-200">50</option>
                <option value="100" className="bg-zinc-900 text-zinc-200">100</option>
                <option value="all" className="bg-zinc-900 text-zinc-200">All</option>
              </select>
              <ChevronsUpDown className="w-3 h-3 text-zinc-500 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Display Options Settings Gear Button */}
          <button
            ref={gearButtonRef}
            onClick={() => setIsDisplayOptionsOpen((prev) => !prev)}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
              isDisplayOptionsOpen
                ? 'border-sky-500 bg-sky-950/40 text-sky-400 ring-2 ring-sky-500/30'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
            title="Display Options"
            aria-label="Display Options"
          >
            <Settings className={`w-4 h-4 transition-transform ${isDisplayOptionsOpen ? 'rotate-45' : ''}`} />
          </button>

          {/* Share Button */}
          {onShare && (
            <button
              onClick={onShare}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
              title="Share milestones summary"
              aria-label="Share milestones summary"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* DISPLAY OPTIONS POPOVER MODAL */}
          {isDisplayOptionsOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-11 z-50 w-72 rounded-2xl bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-2xl p-4 text-zinc-100 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/80">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Display Options
                </span>
                <button
                  onClick={() => setIsDisplayOptionsOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. Show sales columns */}
                <div
                  onClick={() => toggleOption('showSalesColumns')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.showSalesColumns
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.showSalesColumns && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.showSalesColumns ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Show sales columns
                  </span>
                </div>

                {/* 2. Peak only */}
                <div
                  onClick={() => toggleOption('peakOnly')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.peakOnly
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.peakOnly && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.peakOnly ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Peak only
                  </span>
                </div>

                {/* Divider */}
                <div className="my-2 border-t border-zinc-800/80" />

                {/* 3. Show images */}
                <div
                  onClick={() => toggleOption('showImages')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.showImages
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.showImages && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.showImages ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Show images
                  </span>
                </div>

                {/* 4. Separate artist column */}
                <div
                  onClick={() => toggleOption('separateArtistColumn')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.separateArtistColumn
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.separateArtistColumn && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.separateArtistColumn ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Separate artist column
                  </span>
                </div>

                {/* 5. Show week number */}
                <div
                  onClick={() => toggleOption('showWeekNumber')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.showWeekNumber
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.showWeekNumber && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.showWeekNumber ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Show week number
                  </span>
                </div>

                {/* 6. Show chart position */}
                <div
                  onClick={() => toggleOption('showChartPosition')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.showChartPosition
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.showChartPosition && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.showChartPosition ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Show chart position
                  </span>
                </div>

                {/* 7. Plays */}
                <div
                  onClick={() => toggleOption('showPlays')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.showPlays
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.showPlays && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.showPlays ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Plays
                  </span>
                </div>

                {/* 8. Weeks at #1 */}
                <div
                  onClick={() => toggleOption('showWeeksAt1')}
                  className="flex items-center gap-3 cursor-pointer group select-none py-0.5"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                      displayOptions.showWeeksAt1
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'border-2 border-zinc-600 bg-transparent group-hover:border-zinc-400'
                    }`}
                  >
                    {displayOptions.showWeeksAt1 && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`${displayOptions.showWeeksAt1 ? 'text-zinc-100 font-medium' : 'text-zinc-300'}`}>
                    Weeks at #1
                  </span>
                </div>

                {/* Font size control */}
                <div className="pt-3 border-t border-zinc-800/80">
                  <div className="text-[11px] font-semibold text-zinc-400 mb-2">
                    Font size
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setFontSize('small')}
                      className={`py-1 rounded-lg text-xs font-bold transition-all ${
                        displayOptions.fontSize === 'small'
                          ? 'bg-zinc-700 text-white shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      A-
                    </button>
                    <button
                      onClick={() => setFontSize('normal')}
                      className={`py-1 rounded-lg text-xs font-bold transition-all ${
                        displayOptions.fontSize === 'normal'
                          ? 'bg-zinc-700 text-white shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      A
                    </button>
                    <button
                      onClick={() => setFontSize('large')}
                      className={`py-1 rounded-lg text-xs font-bold transition-all ${
                        displayOptions.fontSize === 'large'
                          ? 'bg-zinc-700 text-white shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      A+
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: Search Bar + Position Filter (# 1) + Sorter (Week newest first) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or artist..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-zinc-900/90 border border-zinc-800/90 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 text-xs"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Position Filter Dropdown (# 1 / Top 3 / Top 5 / Top 10...) */}
        <div className="relative flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800/90 text-xs font-semibold text-zinc-200 hover:border-zinc-700 transition-colors shadow-sm">
            <span className="font-mono text-zinc-400 font-bold">#</span>
            <select
              value={positionFilter}
              onChange={(e) => onPositionFilterChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer pr-4 appearance-none"
              aria-label="Filter by chart position"
            >
              <option value="1" className="bg-zinc-900 text-zinc-200">1</option>
              <option value="3" className="bg-zinc-900 text-zinc-200">Top 3</option>
              <option value="5" className="bg-zinc-900 text-zinc-200">Top 5</option>
              <option value="10" className="bg-zinc-900 text-zinc-200">Top 10</option>
              <option value="20" className="bg-zinc-900 text-zinc-200">Top 20</option>
              <option value="40" className="bg-zinc-900 text-zinc-200">Top 40</option>
              <option value="100" className="bg-zinc-900 text-zinc-200">Top 100</option>
              <option value="all" className="bg-zinc-900 text-zinc-200">All Positions</option>
            </select>
            <ChevronsUpDown className="w-3 h-3 text-zinc-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="relative flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800/90 text-xs font-semibold text-zinc-200 hover:border-zinc-700 transition-colors shadow-sm">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as MilestoneSortOption)}
              className="bg-transparent text-xs font-medium text-zinc-200 focus:outline-none cursor-pointer pr-4 appearance-none"
              aria-label="Sort milestones by"
            >
              <option value="week_desc" className="bg-zinc-900 text-zinc-200">Week (newest first)</option>
              <option value="week_asc" className="bg-zinc-900 text-zinc-200">Week (oldest first)</option>
              <option value="rank_asc" className="bg-zinc-900 text-zinc-200">Rank (1 to 100)</option>
              <option value="weeks_at_1_desc" className="bg-zinc-900 text-zinc-200">Most weeks at #1</option>
              <option value="plays_desc" className="bg-zinc-900 text-zinc-200">Most plays</option>
              <option value="sales_desc" className="bg-zinc-900 text-zinc-200">Most units / points</option>
              <option value="title_asc" className="bg-zinc-900 text-zinc-200">Title (A-Z)</option>
              <option value="artist_asc" className="bg-zinc-900 text-zinc-200">Artist (A-Z)</option>
            </select>
            <ChevronsUpDown className="w-3 h-3 text-zinc-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* ROW 3: Segmented Entity Tabs (Artists | Albums | Tracks) */}
      {showEntityTabs && (
        <div className="flex justify-center pt-1">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-zinc-900/90 border border-zinc-800/90 shadow-sm">
            <button
              onClick={() => onSubTypeChange('artists')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                subType === 'artists'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Artists</span>
            </button>
            <button
              onClick={() => onSubTypeChange('albums')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                subType === 'albums'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Albums</span>
            </button>
            <button
              onClick={() => onSubTypeChange('tracks')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                subType === 'tracks'
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Tracks</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
