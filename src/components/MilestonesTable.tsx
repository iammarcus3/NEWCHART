import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award,
  Music,
  Disc,
  Mic,
  Sparkles,
  Trophy,
  Crown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Star,
  Flame,
} from 'lucide-react';
import { MilestoneItem } from '../utils/milestonesEngine';
import { MilestoneDisplayOptions } from './MilestoneFilterBar';
import { CreditedArtistLinks } from './CreditedArtistLinks';
import { resolvePersistentImage } from '../utils/lastfmImageFetcher';
import { MusicImage } from './MusicImage';
import { useTheme } from '../context/ThemeContext';

interface MilestonesTableProps {
  items: MilestoneItem[];
  displayOptions: MilestoneDisplayOptions;
  onArtistClick?: (artist: string) => void;
  onDetailClick?: (item: MilestoneItem) => void;
  onAwardPlaque?: (item: MilestoneItem) => void;
  emptyMessage?: string;
}

export const MilestonesTable: React.FC<MilestonesTableProps> = ({
  items,
  displayOptions,
  onArtistClick,
  onDetailClick,
  onAwardPlaque,
  emptyMessage = 'No matching milestone records found.',
}) => {
  const {
    showSalesColumns,
    showImages,
    separateArtistColumn,
    showWeekNumber,
    showChartPosition,
    showPlays,
    showWeeksAt1,
    fontSize,
  } = displayOptions;

  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Reset page to 1 whenever item list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(items.length / pageSize);
  const safePage = Math.min(Math.max(1, currentPage), totalPages || 1);

  const displayedItems = useMemo(() => {
    if (pageSize === 'all') return items;
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Font size configuration mapping
  const sizeClasses = {
    small: {
      text: 'text-[11px]',
      title: 'text-xs font-bold',
      sub: 'text-[10px]',
      image: 'w-10 h-10 rounded-lg',
      badge: 'text-[9px] px-1 py-0.2',
    },
    normal: {
      text: 'text-xs',
      title: 'text-sm font-bold',
      sub: 'text-xs',
      image: 'w-12 h-12 rounded-xl',
      badge: 'text-[10px] px-1.5 py-0.5',
    },
    large: {
      text: 'text-sm',
      title: 'text-base font-black',
      sub: 'text-xs sm:text-sm',
      image: 'w-14 h-14 rounded-xl',
      badge: 'text-xs px-2 py-0.5',
    },
  }[fontSize || 'normal'];

  if (items.length === 0) {
    return (
      <div className="py-16 px-6 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800/70 my-3 shadow-inner">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-3 text-zinc-400">
          <Trophy className="w-6 h-6 text-amber-500/70" />
        </div>
        <h4 className="text-sm font-bold text-zinc-200">{emptyMessage}</h4>
        <p className="text-xs text-zinc-400 mt-1.5 max-w-md mx-auto">
          Try expanding your search query, clearing specific year filters, or lowering your position threshold.
        </p>
      </div>
    );
  }

  const startRecord = pageSize === 'all' ? 1 : (safePage - 1) * pageSize + 1;
  const endRecord = pageSize === 'all' ? items.length : Math.min(safePage * pageSize, items.length);

  return (
    <div ref={tableTopRef} className="space-y-3">
      {/* Top Pagination & Record Count Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs shadow-sm">
        <div className="text-zinc-400 font-medium">
          Showing <span className="text-white font-bold">{startRecord}–{endRecord}</span> of <span className="text-amber-400 font-bold">{items.length}</span> historic records
        </div>

        <div className="flex items-center gap-3">
          {/* Items Per Page Selector */}
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
            <span className="hidden sm:inline">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All ({items.length})</option>
            </select>
          </div>

          {/* Page navigation buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={safePage <= 1}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 transition-colors"
                title="First page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage <= 1}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2 text-zinc-300 font-bold font-mono text-xs">
                {safePage} / {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={safePage >= totalPages}
                className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-300 transition-colors"
                title="Last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rows Container */}
      <div className="space-y-2 sm:space-y-2.5">
        {displayedItems.map((item, index) => {
          const absoluteIndex = (pageSize === 'all' ? 0 : (safePage - 1) * pageSize) + index;
          const displayRank = item.rank || absoluteIndex + 1;
          const isNum1 = displayRank === 1;
          const isTop3 = displayRank <= 3;
          const isTop10 = displayRank <= 10;
          const itemImgType = item.type === 'artist' ? 'artist' : item.type === 'album' ? 'album' : 'track';
          const resolvedCover = item.coverArt || resolvePersistentImage(itemImgType, item.artist || '', item.title, item.album);

          return (
            <div
              key={`${item.id}_${absoluteIndex}`}
              className={`rounded-2xl transition-all group shadow-sm border ${
                isNum1
                  ? 'bg-gradient-to-r from-amber-950/30 via-zinc-900/90 to-zinc-900/90 border-amber-500/40 hover:border-amber-500/60 shadow-amber-950/20'
                  : isTop3
                  ? 'bg-zinc-900/80 border-zinc-700/80 hover:border-zinc-600'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80'
              } p-3 sm:p-3.5`}
            >
              {/* DESKTOP VIEW (sm and up) */}
              <div className="hidden sm:flex items-center justify-between gap-3.5">
                {/* Left Section: Rank + Cover + Title + Subtitle */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Rank Position */}
                  {showChartPosition && (
                    <div className="w-9 flex-shrink-0 text-center flex flex-col items-center justify-center">
                      {isNum1 ? (
                        <div className="flex flex-col items-center">
                          <Crown className="w-4 h-4 text-amber-400 mb-0.5 drop-shadow" />
                          <span className="font-mono font-black text-amber-400 text-base leading-none">1</span>
                        </div>
                      ) : isTop3 ? (
                        <span className="font-mono font-black text-zinc-300 text-sm">{displayRank}</span>
                      ) : isTop10 ? (
                        <span className="font-mono font-bold text-zinc-400 text-xs">{displayRank}</span>
                      ) : (
                        <span className="font-mono font-medium text-zinc-500 group-hover:text-zinc-400 text-xs">{displayRank}</span>
                      )}
                    </div>
                  )}

                  {/* Cover Art Image */}
                  {showImages && (
                    <div
                      className="cursor-pointer relative flex-shrink-0 group/cover"
                      onClick={() => onDetailClick && onDetailClick(item)}
                    >
                      <MusicImage
                        type={itemImgType}
                        artist={item.artist || ''}
                        title={item.title}
                        album={item.album}
                        src={resolvedCover}
                        alt={item.title}
                        className={`${sizeClasses.image} object-cover border border-zinc-800 flex-shrink-0 shadow-md rounded-xl transition-transform group-hover/cover:scale-105`}
                      />
                    </div>
                  )}

                  {/* Title & Artist Information */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        onClick={() => onDetailClick && onDetailClick(item)}
                        className={`${sizeClasses.title} text-zinc-100 hover:text-amber-300 cursor-pointer truncate transition-colors`}
                        title={item.title}
                      >
                        {item.title}
                      </span>

                      {/* Extra Badges */}
                      {item.extraBadge && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex-shrink-0">
                          {item.extraBadge}
                        </span>
                      )}

                      {/* Week tag */}
                      {showWeekNumber && item.weekNumber && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60 flex-shrink-0">
                          <Calendar className="w-2.5 h-2.5 text-zinc-500" />
                          W{item.weekNumber}
                        </span>
                      )}
                    </div>

                    {/* Subtitle / Artist / Date / Secondary Stat */}
                    {!separateArtistColumn && (
                      <div className={`flex items-center gap-1.5 ${sizeClasses.sub} text-zinc-400 truncate mt-1`}>
                        {item.artist ? (
                          <CreditedArtistLinks
                            artist={item.artist}
                            title={item.type === 'album' ? undefined : item.title}
                            isAlbum={item.type === 'album'}
                            onArtistClick={onArtistClick}
                            className="truncate text-zinc-300 font-medium"
                            linkClassName="hover:text-amber-300 cursor-pointer hover:underline truncate"
                          />
                        ) : (
                          <span className="truncate text-zinc-300 font-medium">{item.subtitle}</span>
                        )}

                        {item.dateRange && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-400 truncate">{item.dateRange}</span>
                          </>
                        )}

                        {item.secondaryStat && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-400 truncate">{item.secondaryStat}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Separate Artist Column (when toggled on) */}
                  {separateArtistColumn && item.artist && (
                    <div className="min-w-0 w-36 lg:w-48 flex-shrink-0">
                      <CreditedArtistLinks
                        artist={item.artist}
                        title={item.type === 'album' ? undefined : item.title}
                        isAlbum={item.type === 'album'}
                        onArtistClick={onArtistClick}
                        linkClassName={`${sizeClasses.sub} font-semibold text-zinc-200 hover:text-amber-300 cursor-pointer hover:underline truncate block`}
                      />
                      {item.album && item.album !== item.title && (
                        <span className="text-[10px] text-zinc-400 truncate block mt-0.5">
                          {item.album}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Section: Stats + Plaque Action */}
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                  {/* Key Milestone Stat (Weeks at #1, Units, etc.) */}
                  {showWeeksAt1 && (
                    <div className="text-right min-w-[90px]">
                      <div className={`${sizeClasses.text} font-black ${isNum1 ? 'text-amber-400' : 'text-zinc-200'} font-mono`}>
                        {item.statValue}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                        {item.statLabel}
                      </div>
                    </div>
                  )}

                  {/* Plays Metric */}
                  {showPlays && item.plays !== undefined && item.plays > 0 && (
                    <div className="hidden md:block text-right min-w-[70px]">
                      <div className={`${sizeClasses.text} font-bold text-purple-300 font-mono`}>
                        {item.plays.toLocaleString()}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400">Plays</div>
                    </div>
                  )}

                  {/* Sales Column */}
                  {showSalesColumns && (
                    <div className="hidden lg:block text-right min-w-[80px]">
                      <div className={`${sizeClasses.text} font-bold text-emerald-400 font-mono`}>
                        {(item.salesUnits || item.points || item.plays || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400">
                        {item.salesUnits ? 'Units' : 'Points'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* MOBILE VIEW (< sm) */}
              <div className="sm:hidden space-y-2.5">
                {/* Top: Rank badge, badges, and Week # */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {showChartPosition && (
                      <span
                        className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg border ${
                          isNum1
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : isTop3
                            ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        #{displayRank}
                      </span>
                    )}

                    {item.extraBadge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {item.extraBadge}
                      </span>
                    )}
                  </div>

                  {showWeekNumber && item.weekNumber && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800/90 text-zinc-400 border border-zinc-700/60">
                      <Calendar className="w-2.5 h-2.5 text-zinc-500" />
                      W{item.weekNumber}
                    </span>
                  )}
                </div>

                {/* Center: Image + Title + Artist */}
                <div className="flex items-center gap-3">
                  {showImages && (
                    <div
                      className="cursor-pointer relative flex-shrink-0"
                      onClick={() => onDetailClick && onDetailClick(item)}
                    >
                      <MusicImage
                        type={itemImgType}
                        artist={item.artist || ''}
                        title={item.title}
                        album={item.album}
                        src={resolvedCover}
                        alt={item.title}
                        className="w-12 h-12 object-cover border border-zinc-800 rounded-xl shadow-md flex-shrink-0"
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div
                      onClick={() => onDetailClick && onDetailClick(item)}
                      className="font-bold text-sm text-zinc-100 hover:text-amber-300 truncate cursor-pointer leading-tight"
                    >
                      {item.title}
                    </div>

                    <div className="text-xs text-zinc-400 truncate mt-0.5">
                      {item.artist ? (
                        <CreditedArtistLinks
                          artist={item.artist}
                          title={item.type === 'album' ? undefined : item.title}
                          isAlbum={item.type === 'album'}
                          onArtistClick={onArtistClick}
                          className="truncate text-zinc-300"
                          linkClassName="hover:text-amber-300 cursor-pointer hover:underline truncate"
                        />
                      ) : (
                        <span className="truncate">{item.subtitle}</span>
                      )}
                    </div>

                    {item.secondaryStat && (
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {item.secondaryStat}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Key Stat */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                  <div>
                    <div className="font-mono font-black text-xs text-amber-400">
                      {item.statValue}
                    </div>
                    <div className="text-[9px] uppercase font-semibold text-zinc-400">
                      {item.statLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Pagination controls if multi-page */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1 text-xs text-zinc-400">
          <div>Page <span className="text-zinc-200 font-bold">{safePage}</span> of {totalPages}</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 transition-colors cursor-pointer font-semibold"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-200 transition-colors cursor-pointer font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

