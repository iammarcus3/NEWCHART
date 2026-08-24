import React, { useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import { computeEntityGenreChartHistory } from '../utils/genreEngine';
import {
  X,
  Music,
  User,
  Disc,
  Award,
  Calendar,
  Sparkles,
  TrendingUp,
  Clock,
  ExternalLink,
  Radio,
  Trophy,
  Layers,
  Flame,
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

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ onAwardPlaque }) => {
  const {
    selectedDetailItem,
    setSelectedDetailItem,
    openArtistProfile,
    allWeeks,
    mergedMap,
    selectedWeekNumber,
  } = useMusic();
  const { theme } = useTheme();

  if (!selectedDetailItem) return null;

  const { type, data } = selectedDetailItem;

  const title = type === 'track' ? data.title : type === 'artist' ? data.artist : data.title;
  const subtitle = type === 'track' ? data.artist : type === 'artist' ? 'Artist Profile' : data.artist;
  const artistName = type === 'artist' ? data.artist : data.artist;
  const plays = data.playCount;
  const coverArt = data.coverArt;

  // Compute historical genre rankings for tracks and albums across all weekly chart periods
  const genrePerformances = useMemo(() => {
    if (type !== 'track' && type !== 'album') return [];
    return computeEntityGenreChartHistory(
      type,
      title,
      artistName,
      allWeeks,
      mergedMap,
      selectedWeekNumber
    );
  }, [type, title, artistName, allWeeks, mergedMap, selectedWeekNumber]);

  // Next Milestone calculation
  let nextMilestone = 'Gold (50)';
  let target = 50;
  if (plays >= 500) {
    nextMilestone = 'Multi-Diamond';
    target = 1000;
  } else if (plays >= 250) {
    nextMilestone = 'Diamond (500)';
    target = 500;
  } else if (plays >= 100) {
    nextMilestone = 'Multi-Platinum (250)';
    target = 250;
  } else if (plays >= 50) {
    nextMilestone = 'Platinum (100)';
    target = 100;
  }
  const progressPercent = Math.min(100, Math.round((plays / target) * 100));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="detail-drawer"
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl h-full flex flex-col justify-between p-6 overflow-y-auto space-y-6 custom-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              {type} Deep Analytics
            </span>
            {genrePerformances.length > 0 && (
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                {genrePerformances.length} Genre {genrePerformances.length === 1 ? 'Chart' : 'Charts'}
              </span>
            )}
          </div>

          <button
            onClick={() => setSelectedDetailItem(null)}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
            aria-label="Close detail panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hero Detail Card */}
        <div className="space-y-4 text-center">
          <div className="relative w-36 h-36 mx-auto rounded-2xl overflow-hidden bg-zinc-900 border-2 border-zinc-800 shadow-2xl">
            <img
              src={coverArt}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';
              }}
            />
          </div>

          <div>
            <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
            <p className="text-xs font-semibold text-zinc-400 mt-0.5">{subtitle}</p>
          </div>

          {/* Plaque Milestone Progress */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Next Plaque Tier: {nextMilestone}</span>
              <span className="font-mono font-bold text-amber-400">{plays} / {target} plays</span>
            </div>
            <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full bg-gradient-to-r ${theme.accentGradient} rounded-full transition-all`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* GENRE CHARTS RANKINGS & PEAK RECORDS (Requested Feature) */}
        {(type === 'track' || type === 'album') && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-mono">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Genre Chart Rankings &amp; Peak History
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {allWeeks.length} tracking weeks
              </span>
            </div>

            {genrePerformances.length === 0 ? (
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center text-xs text-zinc-400">
                <span>No genre chart positions registered yet in historical tracking.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {genrePerformances.map((perf) => (
                  <div
                    key={perf.genreKey}
                    className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2.5"
                  >
                    {/* Header: Genre Name & Peak Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: perf.genreColor }}
                        />
                        <h4 className="text-xs font-bold text-white truncate">
                          {perf.genreDisplayName} Chart
                        </h4>
                      </div>

                      {/* Prominent Peak Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black font-mono tracking-wide ${
                          perf.peakRank === 1
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-500/50 shadow-sm'
                            : perf.peakRank <= 5
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {perf.peakRank === 1 && <Trophy className="w-3 h-3 text-amber-400" />}
                        PEAK #{perf.peakRank}
                      </span>
                    </div>

                    {/* Summary Statement: e.g. "Peaked #1 on RNB chart for 7 weeks" */}
                    <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-850 text-[11px] font-mono flex items-center justify-between text-zinc-300">
                      <span className="font-semibold text-zinc-200">
                        {perf.summaryText}
                      </span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                      <div className="p-2 rounded-xl bg-zinc-950/50 border border-zinc-850">
                        <span className="text-zinc-500 block">Weeks at #1</span>
                        <span className={`text-xs font-bold ${perf.weeksAtNumberOne > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                          {perf.weeksAtNumberOne} {perf.weeksAtNumberOne === 1 ? 'wk' : 'wks'}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-zinc-950/50 border border-zinc-850">
                        <span className="text-zinc-500 block">Total Charted</span>
                        <span className="text-xs font-bold text-cyan-300">
                          {perf.totalWeeksOnChart} {perf.totalWeeksOnChart === 1 ? 'wk' : 'wks'}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-zinc-950/50 border border-zinc-850">
                        <span className="text-zinc-500 block">Current Rank</span>
                        <span className="text-xs font-bold text-white">
                          {perf.currentRank ? `#${perf.currentRank}` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Weekly Trajectory Pills */}
                    {perf.allWeeklyRanks.length > 1 && (
                      <div className="pt-1">
                        <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider block mb-1">
                          Chart Run History:
                        </span>
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[9px] font-mono">
                          {perf.allWeeklyRanks.slice(0, 12).map((w, idx) => (
                            <span
                              key={idx}
                              className={`px-1.5 py-0.5 rounded flex-shrink-0 font-bold ${
                                w.rank === 1
                                  ? 'bg-amber-400 text-black'
                                  : w.rank <= 5
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                              }`}
                              title={`Week ${w.weekNumber}: #${w.rank} (${w.plays} plays)`}
                            >
                              W{w.weekNumber}: #{w.rank}
                            </span>
                          ))}
                          {perf.allWeeklyRanks.length > 12 && (
                            <span className="text-zinc-500 text-[9px] px-1">
                              +{perf.allWeeklyRanks.length - 12} more
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

        {/* Top Tracks for Artist */}
        {type === 'artist' && data.topTracks && (
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
              Top Catalog Rotation
            </span>
            <div className="space-y-1.5">
              {data.topTracks.map((tr: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/40 text-xs text-zinc-300 font-mono"
                >
                  <span className="truncate pr-2">{tr.title}</span>
                  <span className="text-zinc-500 flex-shrink-0">{tr.playCount} plays</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-zinc-800 space-y-2">
          {artistName && (
            <button
              onClick={() => {
                openArtistProfile(artistName);
                setSelectedDetailItem(null);
              }}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 flex items-center justify-center gap-2 transition-all hover:border-zinc-700"
            >
              <User className="w-4 h-4 text-sky-400" />
              <span>View Full Artist Archive &amp; Chart Records</span>
            </button>
          )}

          <button
            onClick={() => {
              onAwardPlaque({
                title,
                subtitle: type === 'artist' ? 'Career Artist Achievement' : subtitle,
                type,
                scrobbles: plays,
                coverArt,
              });
              setSelectedDetailItem(null);
            }}
            className={`w-full py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 flex items-center justify-center gap-2 transition-all`}
          >
            <Award className="w-4 h-4" />
            <span>Forge Commemorative Plaque</span>
          </button>
        </div>
      </div>
    </div>
  );
};

