import React, { useState, useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  computeAutomaticCertifications,
  AutomaticCertification,
  toPlaqueCertification,
} from '../utils/automaticCertificationsEngine';
import { CertificationPlaqueCard } from './CertificationPlaqueCard';
import { PlaqueCertification, PlaqueMilestone } from '../types/music';
import {
  Award,
  ArrowLeft,
  Calendar,
  Disc,
  Music,
  Search,
  Filter,
  Sparkles,
  Layers,
  ChevronDown,
  ShieldCheck,
  TrendingUp,
  X,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  SlidersHorizontal,
} from 'lucide-react';

export type CertTypeFilter = 'all' | 'track' | 'album';
export type CertSortOption = 'date-desc' | 'date-asc' | 'tier-desc' | 'tier-asc';
export type CertGroupByOption = 'date' | 'tier';

interface CertificationsPageProps {
  onBack: () => void;
  onSelectPlaque: (plaque: PlaqueCertification) => void;
  onSelectArtist: (artist: string) => void;
}

// Numerical ranking for achievement tier sorting
const getTierRank = (cert: AutomaticCertification): number => {
  switch (cert.tier) {
    case 'diamond':
      return 40000 + cert.multiplier * 1000;
    case 'multi-platinum':
      return 20000 + cert.multiplier * 1000;
    case 'platinum':
      return 10000;
    case 'gold':
      return 5000;
    default:
      return 0;
  }
};

export const CertificationsPage: React.FC<CertificationsPageProps> = ({
  onBack,
  onSelectPlaque,
  onSelectArtist,
}) => {
  const { allProcessedScrobbles, zeroSettings } = useMusic();
  const { theme } = useTheme();

  // Filter & Sort States
  const [selectedType, setSelectedType] = useState<CertTypeFilter>('all');
  const [sortBy, setSortBy] = useState<CertSortOption>('date-desc');
  const [groupBy, setGroupBy] = useState<CertGroupByOption>('date');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all_milestones' | 'highest_only'>('all_milestones');

  // Compute all automatic certifications
  const certSummary = useMemo(() => {
    return computeAutomaticCertifications(allProcessedScrobbles, zeroSettings);
  }, [allProcessedScrobbles, zeroSettings]);

  // Handle Sort Change: Automatically synchronize grouping to match intent
  const handleSortChange = (newSort: CertSortOption) => {
    setSortBy(newSort);
    if (newSort === 'tier-desc' || newSort === 'tier-asc') {
      setGroupBy('tier');
    } else {
      setGroupBy('date');
    }
  };

  // Filter and Sort plaques according to user selection
  const filteredPlaques = useMemo(() => {
    let list = certSummary.allPlaques;

    // View mode: highest milestone only vs all historical milestones
    if (viewMode === 'highest_only') {
      const highestMap = new Map<string, AutomaticCertification>();
      list.forEach((p) => {
        const key = `${p.type}:::${p.title.toLowerCase()}:::${p.leadArtist.toLowerCase()}`;
        const existing = highestMap.get(key);
        if (!existing || p.multiplier > existing.multiplier) {
          highestMap.set(key, p);
        }
      });
      list = Array.from(highestMap.values());
    }

    // Filter by Release Type ('all' | 'track' | 'album')
    if (selectedType !== 'all') {
      list = list.filter((p) => p.type === selectedType);
    }

    // Filter by Tier
    if (selectedTier !== 'all') {
      list = list.filter((p) => p.tier === selectedTier);
    }

    // Filter by Year
    if (selectedYear !== 'all') {
      list = list.filter((p) => p.year === selectedYear);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.artist.toLowerCase().includes(q) ||
          (p.albumTitle && p.albumTitle.toLowerCase().includes(q))
      );
    }

    // Sort plaques according to chosen sort option
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'date-desc') {
        // Date Awarded: Newest first
        return b.awardTimestamp - a.awardTimestamp;
      }
      if (sortBy === 'date-asc') {
        // Date Awarded: Oldest first
        return a.awardTimestamp - b.awardTimestamp;
      }
      if (sortBy === 'tier-desc') {
        // Achievement Tier: Diamond -> Multi-Platinum -> Platinum -> Gold
        const diff = getTierRank(b) - getTierRank(a);
        if (diff !== 0) return diff;
        const unitDiff = b.unitsEarned - a.unitsEarned;
        if (unitDiff !== 0) return unitDiff;
        return b.awardTimestamp - a.awardTimestamp;
      }
      if (sortBy === 'tier-asc') {
        // Achievement Tier: Gold -> Platinum -> Multi-Platinum -> Diamond
        const diff = getTierRank(a) - getTierRank(b);
        if (diff !== 0) return diff;
        const unitDiff = a.unitsEarned - b.unitsEarned;
        if (unitDiff !== 0) return unitDiff;
        return a.awardTimestamp - b.awardTimestamp;
      }
      return 0;
    });

    return sorted;
  }, [certSummary, selectedType, selectedTier, selectedYear, searchQuery, viewMode, sortBy]);

  // Group filtered plaques by Year -> Month
  const groupedByDate = useMemo(() => {
    const yMap = new Map<number, Map<number, AutomaticCertification[]>>();

    filteredPlaques.forEach((p) => {
      if (!yMap.has(p.year)) {
        yMap.set(p.year, new Map<number, AutomaticCertification[]>());
      }
      const mmap = yMap.get(p.year)!;
      if (!mmap.has(p.monthIndex)) {
        mmap.set(p.monthIndex, []);
      }
      mmap.get(p.monthIndex)!.push(p);
    });

    // Sort years ascending if date-asc, otherwise descending
    const years = Array.from(yMap.keys()).sort((a, b) => {
      return sortBy === 'date-asc' ? a - b : b - a;
    });

    return years.map((year) => {
      const mmap = yMap.get(year)!;
      // Sort months ascending if date-asc, otherwise descending
      const months = Array.from(mmap.keys()).sort((a, b) => {
        return sortBy === 'date-asc' ? a - b : b - a;
      });

      const monthGroups = months.map((mIndex) => {
        const plaques = mmap.get(mIndex)!;
        const monthName = plaques[0]?.month || 'Unknown';
        const tracksCount = plaques.filter((p) => p.type === 'track').length;
        const albumsCount = plaques.filter((p) => p.type === 'album').length;

        return {
          month: monthName,
          monthIndex: mIndex,
          total: plaques.length,
          tracksCount,
          albumsCount,
          plaques,
        };
      });

      const totalYearCerts = monthGroups.reduce((acc, m) => acc + m.total, 0);

      return {
        year,
        total: totalYearCerts,
        months: monthGroups,
      };
    });
  }, [filteredPlaques, sortBy]);

  // Group filtered plaques by Achievement Tier (Diamond, Multi-Platinum, Platinum, Gold)
  const groupedByTier = useMemo(() => {
    const tierOrder = sortBy === 'tier-asc'
      ? (['gold', 'platinum', 'multi-platinum', 'diamond'] as const)
      : (['diamond', 'multi-platinum', 'platinum', 'gold'] as const);

    const tierMeta: Record<string, {
      name: string;
      subtitle: string;
      badgeBg: string;
      borderColor: string;
      textColor: string;
      accentBg: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = {
      diamond: {
        name: 'Diamond Tier',
        subtitle: '10,000,000+ Certified Units (10x Platinum & above)',
        badgeBg: 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/40',
        borderColor: 'border-cyan-500/30',
        textColor: 'text-cyan-300',
        accentBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
        icon: Sparkles,
      },
      'multi-platinum': {
        name: 'Multi-Platinum Tier',
        subtitle: '2,000,000 – 9,000,000 Certified Units (2x to 9x Platinum)',
        badgeBg: 'bg-sky-950/40 text-sky-200 border border-sky-400/40',
        borderColor: 'border-sky-500/30',
        textColor: 'text-sky-200',
        accentBg: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
        icon: Layers,
      },
      platinum: {
        name: 'Platinum Tier',
        subtitle: '1,000,000+ Certified Units (1x Platinum)',
        badgeBg: 'bg-slate-900/60 text-slate-100 border border-slate-400/40',
        borderColor: 'border-slate-500/30',
        textColor: 'text-slate-200',
        accentBg: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
        icon: ShieldCheck,
      },
      gold: {
        name: 'Gold Tier',
        subtitle: '500,000+ Certified Units',
        badgeBg: 'bg-amber-950/40 text-amber-300 border border-amber-500/40',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-300',
        accentBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        icon: Award,
      },
    };

    const groups: {
      tierKey: string;
      name: string;
      subtitle: string;
      badgeBg: string;
      borderColor: string;
      textColor: string;
      accentBg: string;
      icon: React.ComponentType<{ className?: string }>;
      total: number;
      tracksCount: number;
      albumsCount: number;
      plaques: AutomaticCertification[];
    }[] = [];

    tierOrder.forEach((key) => {
      const plaquesInTier = filteredPlaques.filter((p) => p.tier === key);
      if (plaquesInTier.length > 0) {
        const meta = tierMeta[key];
        groups.push({
          tierKey: key,
          name: meta.name,
          subtitle: meta.subtitle,
          badgeBg: meta.badgeBg,
          borderColor: meta.borderColor,
          textColor: meta.textColor,
          accentBg: meta.accentBg,
          icon: meta.icon,
          total: plaquesInTier.length,
          tracksCount: plaquesInTier.filter((p) => p.type === 'track').length,
          albumsCount: plaquesInTier.filter((p) => p.type === 'album').length,
          plaques: plaquesInTier,
        });
      }
    });

    return groups;
  }, [filteredPlaques, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedTier !== 'all' ||
    selectedType !== 'all' ||
    selectedYear !== 'all' ||
    sortBy !== 'date-desc' ||
    viewMode !== 'all_milestones';

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedTier('all');
    setSelectedType('all');
    setSelectedYear('all');
    setSortBy('date-desc');
    setGroupBy('date');
    setViewMode('all_milestones');
  };

  return (
    <div className={`min-h-screen ${theme.bgClass} text-zinc-100 pb-28 pt-4 sm:pt-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 sm:space-y-8`}>
      {/* Top Navigation & Back Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            id="back-to-charts-btn"
            className="p-2 sm:p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all border border-zinc-800 cursor-pointer flex items-center gap-2 group active:scale-95 shadow-sm"
            title="Return to music charts & analytics dashboard"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs sm:text-sm font-bold">Back to Charts</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-md`}>
                <Award className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Official Certifications Archive
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Automatic gold, platinum, and diamond plaques grouped chronologically by date or achievement tier
            </p>
          </div>
        </div>

        {/* View Mode Toggle: All Milestones vs Latest Only */}
        <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-2xl self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('all_milestones')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'all_milestones'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Milestones
          </button>
          <button
            type="button"
            onClick={() => setViewMode('highest_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'highest_only'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Highest Plaque Only
          </button>
        </div>
      </div>

      {/* Career Certifications Summary Banner */}
      <div className={`rounded-3xl p-5 sm:p-6 ${theme.cardBg} border ${theme.cardBorder} shadow-xl relative overflow-hidden`}>
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Automatic Vault Milestones
          </span>
          <span className="text-xs font-mono text-zinc-400">
            {certSummary.totalCertifiedUnits.toLocaleString()} Total Units Awarded
          </span>
        </div>

        {/* Bento Stats Grid - Interactive quick filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Total Certifications */}
          <button
            type="button"
            onClick={() => {
              setSelectedType('all');
              setSelectedTier('all');
            }}
            className="p-3.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 space-y-1 text-left transition-all cursor-pointer active:scale-98"
            title="Show all certifications"
          >
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Total Plaques
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {certSummary.totalCertifications.toLocaleString()}
            </div>
            <span className="text-[10px] text-zinc-500 block">
              {certSummary.totalTrackCerts} Songs • {certSummary.totalAlbumCerts} Albums
            </span>
          </button>

          {/* Diamond */}
          <button
            type="button"
            onClick={() => {
              setSelectedTier(selectedTier === 'diamond' ? 'all' : 'diamond');
              handleSortChange('tier-desc');
            }}
            className={`p-3.5 rounded-2xl space-y-1 text-left transition-all cursor-pointer active:scale-98 ${
              selectedTier === 'diamond'
                ? 'bg-cyan-900/40 border-2 border-cyan-400 ring-2 ring-cyan-400/20'
                : 'bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/30'
            }`}
            title="Filter by Diamond Tier (10M+ units)"
          >
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">
              Diamond (10M+)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
              {certSummary.totalDiamond}
            </div>
            <span className="text-[10px] text-cyan-400/80 block">Elite status</span>
          </button>

          {/* Multi-Platinum */}
          <button
            type="button"
            onClick={() => {
              setSelectedTier(selectedTier === 'multi-platinum' ? 'all' : 'multi-platinum');
              handleSortChange('tier-desc');
            }}
            className={`p-3.5 rounded-2xl space-y-1 text-left transition-all cursor-pointer active:scale-98 ${
              selectedTier === 'multi-platinum'
                ? 'bg-sky-900/40 border-2 border-sky-400 ring-2 ring-sky-400/20'
                : 'bg-sky-950/30 hover:bg-sky-950/50 border border-sky-400/30'
            }`}
            title="Filter by Multi-Platinum Tier (2M - 9M units)"
          >
            <span className="text-[10px] font-bold text-sky-200 uppercase tracking-wider block">
              Multi-Platinum
            </span>
            <div className="text-2xl sm:text-3xl font-black text-sky-200 font-mono">
              {certSummary.totalMultiPlatinum}
            </div>
            <span className="text-[10px] text-sky-300/80 block">2M - 9M Units</span>
          </button>

          {/* Platinum */}
          <button
            type="button"
            onClick={() => {
              setSelectedTier(selectedTier === 'platinum' ? 'all' : 'platinum');
              handleSortChange('tier-desc');
            }}
            className={`p-3.5 rounded-2xl space-y-1 text-left transition-all cursor-pointer active:scale-98 ${
              selectedTier === 'platinum'
                ? 'bg-slate-800 border-2 border-slate-300 ring-2 ring-slate-300/20'
                : 'bg-slate-900/80 hover:bg-slate-850 border border-slate-400/30'
            }`}
            title="Filter by Platinum Tier (1M+ units)"
          >
            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider block">
              Platinum
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono">
              {certSummary.totalPlatinum}
            </div>
            <span className="text-[10px] text-slate-400 block">1M+ Units</span>
          </button>

          {/* Gold */}
          <button
            type="button"
            onClick={() => {
              setSelectedTier(selectedTier === 'gold' ? 'all' : 'gold');
              handleSortChange('tier-asc');
            }}
            className={`p-3.5 rounded-2xl space-y-1 text-left transition-all cursor-pointer active:scale-98 ${
              selectedTier === 'gold'
                ? 'bg-amber-900/40 border-2 border-amber-400 ring-2 ring-amber-400/20'
                : 'bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/30'
            }`}
            title="Filter by Gold Tier (500K+ units)"
          >
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
              Gold
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {certSummary.totalGold}
            </div>
            <span className="text-[10px] text-amber-500/80 block">500K+ Units</span>
          </button>

          {/* Years Active */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Active Years
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {certSummary.yearsList.length}
            </div>
            <span className="text-[10px] text-zinc-500 block">
              {certSummary.yearsList[certSummary.yearsList.length - 1] || '—'} – {certSummary.yearsList[0] || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SORT BAR */}
      <div
        id="certifications-filter-bar"
        className={`rounded-3xl p-4 sm:p-5 ${theme.cardBg} border ${theme.cardBorder} shadow-lg space-y-4`}
      >
        {/* ROW 1: Toggle 'Songs' vs 'Albums' + Sort By Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Release Type Segmented Toggle: All / Songs / Albums */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-2xl shadow-inner self-start sm:self-auto">
            <button
              type="button"
              id="filter-type-all"
              onClick={() => setSelectedType('all')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Types ({certSummary.totalCertifications})
            </button>

            <button
              type="button"
              id="filter-type-songs"
              onClick={() => setSelectedType('track')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedType === 'track'
                  ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Songs ({certSummary.totalTrackCerts})</span>
            </button>

            <button
              type="button"
              id="filter-type-albums"
              onClick={() => setSelectedType('album')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedType === 'album'
                  ? 'bg-amber-600 text-white shadow-md ring-1 ring-amber-400/50'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Albums ({certSummary.totalAlbumCerts})</span>
            </button>
          </div>

          {/* Sort & Grouping Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Dropdown Selector */}
            <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-2xl">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs font-bold text-zinc-400 whitespace-nowrap">Sort by:</span>
              <select
                id="cert-sort-select"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as CertSortOption)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="date-desc" className="bg-zinc-900 text-white">Date Awarded (Newest)</option>
                <option value="date-asc" className="bg-zinc-900 text-white">Date Awarded (Oldest)</option>
                <option value="tier-desc" className="bg-zinc-900 text-white">Achievement Tier (Diamond → Gold)</option>
                <option value="tier-asc" className="bg-zinc-900 text-white">Achievement Tier (Gold → Diamond)</option>
              </select>
            </div>

            {/* Layout Grouping Switcher */}
            <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-2xl text-xs">
              <button
                type="button"
                id="group-by-date-btn"
                onClick={() => setGroupBy('date')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  groupBy === 'date'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Group chronological awards by Year and Month"
              >
                <Calendar className="w-3 h-3" />
                <span>By Date</span>
              </button>
              <button
                type="button"
                id="group-by-tier-btn"
                onClick={() => setGroupBy('tier')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  groupBy === 'tier'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Group awards by Achievement Tier (Gold, Platinum, Diamond)"
              >
                <Award className="w-3 h-3" />
                <span>By Tier</span>
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2: Search Input & Quick Sort Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              id="cert-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search certified songs, albums, or artists..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Sort Direct Buttons - Fluid, No Sliders */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              id="sort-btn-newest"
              onClick={() => handleSortChange('date-desc')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sortBy === 'date-desc'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
              }`}
              title="Sort Date Awarded: Newest to Oldest"
            >
              <ArrowDown className="w-3 h-3" />
              <span>Newest</span>
            </button>
            <button
              type="button"
              id="sort-btn-oldest"
              onClick={() => handleSortChange('date-asc')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sortBy === 'date-asc'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800'
              }`}
              title="Sort Date Awarded: Oldest to Newest"
            >
              <ArrowUp className="w-3 h-3" />
              <span>Oldest</span>
            </button>
            <button
              type="button"
              id="sort-btn-diamond"
              onClick={() => handleSortChange('tier-desc')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sortBy === 'tier-desc'
                  ? 'bg-cyan-400 text-black shadow-sm font-black'
                  : 'bg-zinc-900 text-cyan-300 hover:text-white border border-zinc-800'
              }`}
              title="Sort Achievement Tier: Diamond to Gold"
            >
              <Sparkles className="w-3 h-3" />
              <span>Diamond First</span>
            </button>
            <button
              type="button"
              id="sort-btn-gold"
              onClick={() => handleSortChange('tier-asc')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                sortBy === 'tier-asc'
                  ? 'bg-amber-400 text-black shadow-sm font-black'
                  : 'bg-zinc-900 text-amber-300 hover:text-white border border-zinc-800'
              }`}
              title="Sort Achievement Tier: Gold to Diamond"
            >
              <Award className="w-3 h-3" />
              <span>Gold First</span>
            </button>
          </div>
        </div>

        {/* ROW 3: Secondary Filters (Year Pills, Tier Pills, and Reset) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
          {/* Quick-Jump Year Pills - Fluid Wrap */}
          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-zinc-500" /> Year:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedYear === 'all'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
              }`}
            >
              All Years ({certSummary.yearsList.length})
            </button>
            {certSummary.yearsList.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedYear === y
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Tier Filter Pills - Fluid Wrap */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
              Tier:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTier('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTier === 'all'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier('diamond')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTier === 'diamond'
                  ? 'bg-cyan-400 text-black font-black'
                  : 'bg-zinc-900 text-cyan-300 hover:text-cyan-200 border border-zinc-800'
              }`}
            >
              Diamond
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier('multi-platinum')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTier === 'multi-platinum'
                  ? 'bg-sky-300 text-black font-black'
                  : 'bg-zinc-900 text-sky-300 hover:text-sky-200 border border-zinc-800'
              }`}
            >
              Multi-Plat
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier('platinum')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTier === 'platinum'
                  ? 'bg-slate-300 text-black font-black'
                  : 'bg-zinc-900 text-slate-300 hover:text-slate-200 border border-zinc-800'
              }`}
            >
              Platinum
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier('gold')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTier === 'gold'
                  ? 'bg-amber-400 text-black font-black'
                  : 'bg-zinc-900 text-amber-300 hover:text-amber-200 border border-zinc-800'
              }`}
            >
              Gold
            </button>
          </div>
        </div>

        {/* Active Filter Indicators Bar (if any non-default filters applied) */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-zinc-400">
              <span className="font-semibold text-zinc-300">Showing {filteredPlaques.length} matching plaques</span>
              {selectedType !== 'all' && (
                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 font-medium">
                  {selectedType === 'track' ? 'Songs only' : 'Albums only'}
                </span>
              )}
              {selectedTier !== 'all' && (
                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 font-medium capitalize">
                  {selectedTier} tier
                </span>
              )}
              {selectedYear !== 'all' && (
                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 font-medium">
                  Year {selectedYear}
                </span>
              )}
              {sortBy !== 'date-desc' && (
                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-200 font-medium">
                  {sortBy === 'date-asc'
                    ? 'Oldest first'
                    : sortBy === 'tier-desc'
                    ? 'Diamond first'
                    : 'Gold first'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold whitespace-nowrap cursor-pointer hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT: Grouped by Date (Year & Month) OR by Achievement Tier */}
      {filteredPlaques.length === 0 ? (
        <div className="p-16 text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/40 space-y-4">
          <Award className="w-14 h-14 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No Matching Certifications Found</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Try clearing active search queries or filters to view all historical plaques.'
                : 'Scrobble more music! Songs reach Gold at 500,000 units (10 plays) and Platinum at 1,000,000 units.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-all cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : groupBy === 'tier' ? (
        /* ACHIEVEMENT TIER GROUPING VIEW */
        <div className="space-y-12">
          {groupedByTier.map((tierGroup) => {
            const TierIcon = tierGroup.icon;
            return (
              <section
                key={tierGroup.tierKey}
                id={`tier-section-${tierGroup.tierKey}`}
                className="space-y-6"
              >
                {/* Tier Section Header Banner */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border ${tierGroup.borderColor} bg-zinc-900/60 shadow-lg`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl ${tierGroup.badgeBg}`}>
                      <TierIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className={`text-xl sm:text-2xl font-black ${tierGroup.textColor} tracking-tight`}>
                          {tierGroup.name}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${tierGroup.accentBg}`}>
                          {tierGroup.total} {tierGroup.total === 1 ? 'Plaque' : 'Plaques'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{tierGroup.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 self-start sm:self-auto">
                    {tierGroup.tracksCount > 0 && (
                      <span className="flex items-center gap-1 text-indigo-300">
                        <Music className="w-3.5 h-3.5" />
                        {tierGroup.tracksCount} {tierGroup.tracksCount === 1 ? 'Song' : 'Songs'}
                      </span>
                    )}
                    {tierGroup.tracksCount > 0 && tierGroup.albumsCount > 0 && <span>•</span>}
                    {tierGroup.albumsCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-300">
                        <Disc className="w-3.5 h-3.5" />
                        {tierGroup.albumsCount} {tierGroup.albumsCount === 1 ? 'Album' : 'Albums'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Plaque Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                  {tierGroup.plaques.map((plaque) => (
                    <CertificationPlaqueCard
                      key={plaque.id}
                      cert={plaque}
                      onClick={() => onSelectPlaque(toPlaqueCertification(plaque))}
                      onSelectArtist={onSelectArtist}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* CHRONOLOGICAL DATE GROUPING VIEW (Year & Month) */
        <div className="space-y-12">
          {groupedByDate.map((yearGroup) => (
            <section
              key={yearGroup.year}
              id={`year-section-${yearGroup.year}`}
              className="space-y-8"
            >
              {/* Year Section Header */}
              <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                    {yearGroup.year}
                  </h2>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    {yearGroup.total} {yearGroup.total === 1 ? 'Plaque' : 'Plaques'}
                  </span>
                </div>
              </div>

              {/* Month Subsections */}
              <div className="space-y-8 pl-0 sm:pl-3">
                {yearGroup.months.map((monthGroup) => (
                  <div
                    key={`${yearGroup.year}-${monthGroup.month}`}
                    id={`month-section-${yearGroup.year}-${monthGroup.month}`}
                    className="space-y-4"
                  >
                    {/* Month Header Banner */}
                    <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 rounded-2xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm sm:text-base font-black text-white">
                          {monthGroup.month} {yearGroup.year}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
                        {monthGroup.tracksCount > 0 && (
                          <span className="flex items-center gap-1 text-indigo-300">
                            <Music className="w-3 h-3" />
                            {monthGroup.tracksCount} {monthGroup.tracksCount === 1 ? 'Song' : 'Songs'}
                          </span>
                        )}
                        {monthGroup.tracksCount > 0 && monthGroup.albumsCount > 0 && (
                          <span>•</span>
                        )}
                        {monthGroup.albumsCount > 0 && (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Disc className="w-3 h-3" />
                            {monthGroup.albumsCount} {monthGroup.albumsCount === 1 ? 'Album' : 'Albums'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Plaque Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                      {monthGroup.plaques.map((plaque) => (
                        <CertificationPlaqueCard
                          key={plaque.id}
                          cert={plaque}
                          onClick={() => onSelectPlaque(toPlaqueCertification(plaque))}
                          onSelectArtist={onSelectArtist}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

