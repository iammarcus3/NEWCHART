import React from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  Music,
  User,
  Disc,
  Award,
  Layers,
  Sparkles,
  Tag,
  Flame,
} from 'lucide-react';

interface HeroOverviewProps {
  onOpenDuplicateDrawer: () => void;
  onOpenGenreCharts: () => void;
  onOpenPlaqueWall: () => void;
}

export const HeroOverview: React.FC<HeroOverviewProps> = ({
  onOpenDuplicateDrawer,
  onOpenGenreCharts,
  onOpenPlaqueWall,
}) => {
  const {
    listeningStats,
    duplicateClusters,
    plaques,
    tracksChart,
    artistsChart,
    weeklyTracksChart,
    allWeeks,
    selectedWeekNumber,
  } = useMusic();
  const { theme } = useTheme();

  const unmergedCount = duplicateClusters.filter((c) => !c.isMerged).length;
  const topArtist = artistsChart[0];
  const topTrack = weeklyTracksChart[0] || tracksChart[0];

  return (
    <section id="hero-overview-section" className="space-y-3 pt-2 sm:pt-4">
      {/* Top Banner Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* Metric 1: Total Scrobbles */}
        <div className={`p-3 sm:p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-1 relative overflow-hidden group`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Scrobbles
            </span>
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight font-mono truncate">
            {listeningStats.totalScrobbles.toLocaleString()}
          </div>
          <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate">
            ~{listeningStats.totalListeningHours}h logged
          </p>
        </div>

        {/* Metric 2: Unique Artists */}
        <div className={`p-3 sm:p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-1`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Artists
            </span>
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight font-mono truncate">
            {listeningStats.uniqueArtists.toLocaleString()}
          </div>
          <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate">
            #1: {topArtist?.artist || 'None'}
          </p>
        </div>

        {/* Metric 3: Top Track of the Week */}
        <div className={`p-3 sm:p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-1`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              #1 Hot Track
            </span>
            <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 flex-shrink-0" />
          </div>
          <div className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
            {topTrack?.title || 'No data'}
          </div>
          <p className="text-[10px] sm:text-[11px] text-amber-400/80 truncate">
            {topTrack ? `${topTrack.artist}` : '—'}
          </p>
        </div>

        {/* Metric 4: Weekly Genre Hot 5 Jump */}
        <button
          onClick={onOpenGenreCharts}
          className={`p-3 sm:p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-1 text-left hover:border-cyan-500/50 transition-all group cursor-pointer active:scale-95`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Genre Hot 5s
            </span>
            <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-cyan-300 tracking-tight font-mono truncate">
            Week {selectedWeekNumber || 1}
          </div>
          <p className="text-[10px] sm:text-[11px] text-cyan-400/80 truncate">
            View Hot 5s &rarr;
          </p>
        </button>

        {/* Metric 5: Certified Plaques */}
        <button
          onClick={onOpenPlaqueWall}
          className={`p-3 sm:p-4 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} shadow-sm space-y-1 text-left hover:border-yellow-500/50 transition-all group cursor-pointer active:scale-95`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Plaques
            </span>
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight font-mono truncate">
            {plaques.length}
          </div>
          <p className="text-[10px] sm:text-[11px] text-yellow-400/80 truncate">
            Plaque Wall &rarr;
          </p>
        </button>

        {/* Metric 6: Duplicate Cleanliness */}
        <button
          onClick={onOpenDuplicateDrawer}
          className={`p-3 sm:p-4 rounded-2xl ${theme.cardBg} border ${
            unmergedCount > 0 ? 'border-amber-500/50 bg-amber-950/20' : theme.cardBorder
          } shadow-sm space-y-1 text-left hover:border-indigo-500/50 transition-all cursor-pointer active:scale-95`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Duplicates
            </span>
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-white tracking-tight font-mono truncate">
            {unmergedCount} <span className="text-[10px] sm:text-xs font-normal text-zinc-400">sets</span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-indigo-400 truncate">
            {unmergedCount > 0 ? 'Consolidate &rarr;' : 'Clean'}
          </p>
        </button>
      </div>
    </section>
  );
};
