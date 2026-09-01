import React from 'react';
import { Award, Music, Disc, Mic, Sparkles, Trophy, Calendar } from 'lucide-react';
import { MilestoneItem } from '../utils/milestonesEngine';
import { MilestoneDisplayOptions } from './MilestoneFilterBar';

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

  // Font size configuration mapping
  const sizeClasses = {
    small: {
      text: 'text-[11px]',
      title: 'text-xs font-bold',
      sub: 'text-[10px]',
      image: 'w-8 h-8 rounded-md',
      padding: 'p-2',
      badge: 'text-[9px] px-1 py-0.2',
    },
    normal: {
      text: 'text-xs',
      title: 'text-xs font-bold',
      sub: 'text-[11px]',
      image: 'w-10 h-10 rounded-lg',
      padding: 'p-2.5 sm:p-3',
      badge: 'text-[10px] px-1.5 py-0.5',
    },
    large: {
      text: 'text-sm',
      title: 'text-sm font-black',
      sub: 'text-xs',
      image: 'w-12 h-12 rounded-xl',
      padding: 'p-3.5 sm:p-4',
      badge: 'text-xs px-2 py-0.5',
    },
  }[fontSize || 'normal'];

  if (items.length === 0) {
    return (
      <div className="py-12 px-4 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 my-2">
        <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-xs font-medium text-zinc-400">{emptyMessage}</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          Try adjusting your search query, year filter, or position threshold.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const displayRank = item.peakPosition || item.rank || index + 1;
        const isNum1 = displayRank === 1;

        return (
          <div
            key={`${item.id}_${index}`}
            className={`flex items-center justify-between ${sizeClasses.padding} rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all hover:bg-zinc-900 group shadow-sm`}
          >
            {/* Left Section: Rank + Cover + Title + Details */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              {/* Chart Position / Rank */}
              {showChartPosition && (
                <span
                  className={`w-6 text-center font-mono font-black ${sizeClasses.text} flex-shrink-0 ${
                    isNum1
                      ? 'text-amber-400 font-bold drop-shadow-sm'
                      : displayRank <= 3
                      ? 'text-amber-200'
                      : displayRank <= 10
                      ? 'text-purple-300'
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                >
                  #{displayRank}
                </span>
              )}

              {/* Cover Art Image Thumbnail */}
              {showImages && item.coverArt && (
                <img
                  src={item.coverArt}
                  alt={item.title}
                  className={`${sizeClasses.image} object-cover border border-zinc-800 flex-shrink-0 shadow-sm`}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}

              {/* Week Number Tag */}
              {showWeekNumber && item.weekNumber && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800/90 text-zinc-400 border border-zinc-700/60 flex-shrink-0">
                  <Calendar className="w-2.5 h-2.5 text-zinc-500" />
                  W{item.weekNumber}
                </span>
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

                  {item.extraBadge && (
                    <span
                      className={`${sizeClasses.badge} rounded font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0`}
                    >
                      {item.extraBadge}
                    </span>
                  )}
                </div>

                {/* Subtitle / Artist / Date / Secondary Stat */}
                {!separateArtistColumn && (
                  <div className={`flex items-center gap-1.5 ${sizeClasses.sub} text-zinc-400 truncate mt-0.5`}>
                    {item.artist ? (
                      <span
                        onClick={() => item.artist && onArtistClick && onArtistClick(item.artist)}
                        className="hover:text-zinc-200 cursor-pointer hover:underline truncate"
                      >
                        {item.artist}
                      </span>
                    ) : (
                      <span className="truncate">{item.subtitle}</span>
                    )}

                    {item.dateRange && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500 truncate">{item.dateRange}</span>
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

              {/* SEPARATE ARTIST COLUMN (when toggled on in Display Options) */}
              {separateArtistColumn && item.artist && (
                <div className="hidden sm:block min-w-0 w-36 lg:w-48 flex-shrink-0">
                  <span
                    onClick={() => item.artist && onArtistClick && onArtistClick(item.artist)}
                    className={`${sizeClasses.sub} font-semibold text-zinc-300 hover:text-amber-300 cursor-pointer hover:underline truncate block`}
                  >
                    {item.artist}
                  </span>
                  {item.album && item.album !== item.title && (
                    <span className="text-[10px] text-zinc-500 truncate block">
                      {item.album}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right Section: Plays + Weeks at #1 + Sales Columns + Plaque Button */}
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 ml-3">
              {/* Weeks at #1 / Stat Value */}
              {showWeeksAt1 && (
                <div className="text-right">
                  <div className={`${sizeClasses.text} font-black text-amber-400 font-mono`}>
                    {item.statValue}
                  </div>
                  <div className={`${sizeClasses.sub} text-zinc-400`}>
                    {item.statLabel}
                  </div>
                </div>
              )}

              {/* Plays Metric */}
              {showPlays && item.plays !== undefined && item.plays > 0 && (
                <div className="hidden md:block text-right">
                  <div className={`${sizeClasses.text} font-bold text-purple-300 font-mono`}>
                    {item.plays.toLocaleString()}
                  </div>
                  <div className={`${sizeClasses.sub} text-zinc-500`}>Plays</div>
                </div>
              )}

              {/* SALES COLUMN (when toggled on in Display Options) */}
              {showSalesColumns && (
                <div className="hidden lg:block text-right">
                  <div className={`${sizeClasses.text} font-bold text-emerald-400 font-mono`}>
                    {(item.salesUnits || item.points || item.plays || 0).toLocaleString()}
                  </div>
                  <div className={`${sizeClasses.sub} text-zinc-500`}>
                    {item.salesUnits ? 'Units' : 'Points'}
                  </div>
                </div>
              )}

              {/* Plaque Creation Action */}
              {onAwardPlaque && (
                <button
                  onClick={() => onAwardPlaque(item)}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 transition-colors shadow-sm"
                  title="Generate custom commemorative plaque"
                >
                  <Award className="w-3 h-3 text-amber-400" />
                  <span>Plaque</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
