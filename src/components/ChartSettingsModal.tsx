import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  Settings,
  Target,
  ListOrdered,
  Filter,
  PenTool,
  Info,
  RotateCcw,
  Trash2,
  HelpCircle,
  Award,
} from 'lucide-react';
import { ManualChartOverride } from '../types/music';

// Number formatter helper for ZeroCharts display (e.g. 50000 -> 50.000)
function formatDotNumber(val: number): string {
  return Number(val || 0).toLocaleString('de-DE'); // de-DE uses dots for thousands
}

function parseDotNumber(str: string): number {
  const clean = str.replace(/\./g, '').replace(/,/g, '');
  return parseInt(clean, 10) || 0;
}

export const ChartSettingsModal: React.FC = () => {
  const {
    zeroSettings,
    updateZeroSettings,
    resetZeroSettings,
    removeItemOverride,
    toggleBlacklistKey,
    isChartSettingsOpen,
    setIsChartSettingsOpen,
  } = useMusic();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'general' | 'certifications' | 'tiebreak' | 'filters' | 'corrections'>('certifications');
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  if (!isChartSettingsOpen) return null;

  const overrideEntries: [string, ManualChartOverride][] = Object.entries(zeroSettings?.manualOverrides || {});

  // Formula preview calculation
  const trackPlayWeight = zeroSettings?.trackPlayWeight || 50000;
  const albumPlayWeight = zeroSettings?.albumPlayWeight || 5000;
  const goldThresholdTrack = zeroSettings?.goldThresholdTrack || 500000;
  const goldThresholdAlbum = zeroSettings?.goldThresholdAlbum || 500000;

  const trackPlaysForGold = Math.max(1, Math.round(goldThresholdTrack / (trackPlayWeight || 1)));
  const albumPlaysForGold = Math.max(1, Math.round(goldThresholdAlbum / (albumPlayWeight || 1)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div
        id="chart-settings-modal"
        className="relative w-full max-w-3xl rounded-2xl bg-[#1e2023] border border-[#2d3139] shadow-2xl text-zinc-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Tab Bar (ZeroCharts Style) */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 bg-[#181a1d] border-b border-[#2d3139]">
          <div className="flex items-center gap-1 sm:gap-6 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap ${
                activeTab === 'general'
                  ? 'text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>General</span>
              {activeTab === 'general' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('certifications')}
              className={`flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap ${
                activeTab === 'certifications'
                  ? 'text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Certifications</span>
              {activeTab === 'certifications' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tiebreak')}
              className={`flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap ${
                activeTab === 'tiebreak'
                  ? 'text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Tiebreak</span>
              {activeTab === 'tiebreak' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('filters')}
              className={`flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap ${
                activeTab === 'filters'
                  ? 'text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeTab === 'filters' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('corrections')}
              className={`flex items-center gap-2 py-3 px-2 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap ${
                activeTab === 'corrections'
                  ? 'text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Corrections</span>
              {activeTab === 'corrections' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>

          <button
            onClick={() => setIsChartSettingsOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#282c34] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-5 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-[#1a1c20]">
          {/* TAB 1: CERTIFICATIONS (Matched to Uploaded Screenshot) */}
          {activeTab === 'certifications' && (
            <div className="space-y-6">
              {/* Header with Title & How it works */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Certifications
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(!showHowItWorks)}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium cursor-pointer"
                >
                  <Info className="w-4 h-4" />
                  <span>How it works</span>
                </button>
              </div>

              {/* "How it works" Drawer/Popover */}
              {showHowItWorks && (
                <div className="p-4 rounded-xl bg-[#222834] border border-blue-900/60 text-xs text-blue-100 space-y-2">
                  <div className="flex items-center justify-between font-bold text-blue-300">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-4 h-4" /> ZeroCharts Certification Engine Rules
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHowItWorks(false)}
                      className="text-blue-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p>
                    • <strong>Formula Calculation:</strong> Total certified units are computed as:{' '}
                    <code className="px-1.5 py-0.5 rounded bg-[#181d28] font-mono text-blue-200">
                      Total Units = (Verified Plays × Play Weight) + (Stability Points × Stability Weight)
                    </code>
                  </p>
                  <p>
                    • <strong>Stability Points:</strong> Earned based on weekly chart tenure and momentum to reward longevity.
                  </p>
                  <p>
                    • <strong>Milestone Badges:</strong> When an item reaches the Gold, Platinum, or Diamond value, it receives an official certification badge across weekly charts and plaque shelves.
                  </p>
                </div>
              )}

              {/* Certification Formula Table */}
              <div className="rounded-xl border border-[#2d3139] bg-[#17191d] overflow-hidden">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#2d3139] text-zinc-400">
                      <th className="py-3 px-4 w-1/3 font-medium"></th>
                      <th className="py-3 px-4 w-1/3 font-bold text-white">Track</th>
                      <th className="py-3 px-4 w-1/3 font-bold text-white">Album</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252830]">
                    {/* SECTION: FORMULA WEIGHTS */}
                    <tr className="bg-[#141619]">
                      <td
                        colSpan={3}
                        className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400"
                      >
                        FORMULA WEIGHTS
                      </td>
                    </tr>

                    {/* Plays × weight */}
                    <tr className="hover:bg-[#1c1f24] transition-colors">
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        Plays <span className="text-zinc-400 font-normal">× weight</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="1000"
                            value={zeroSettings.trackPlayWeight ?? 50000}
                            onChange={(e) =>
                              updateZeroSettings({ trackPlayWeight: parseInt(e.target.value, 10) || 0 })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="500"
                            value={zeroSettings.albumPlayWeight ?? 5000}
                            onChange={(e) =>
                              updateZeroSettings({ albumPlayWeight: parseInt(e.target.value, 10) || 0 })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* Stability Points × weight */}
                    <tr className="hover:bg-[#1c1f24] transition-colors">
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        Stability Points <span className="text-zinc-400 font-normal">× weight</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="50"
                            value={zeroSettings.trackStabilityWeight ?? 500}
                            onChange={(e) =>
                              updateZeroSettings({ trackStabilityWeight: parseInt(e.target.value, 10) || 0 })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="50"
                            value={zeroSettings.albumStabilityWeight ?? 500}
                            onChange={(e) =>
                              updateZeroSettings({ albumStabilityWeight: parseInt(e.target.value, 10) || 0 })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </td>
                    </tr>

                    {/* SECTION: CERTIFICATION VALUES */}
                    <tr className="bg-[#141619]">
                      <td
                        colSpan={3}
                        className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400"
                      >
                        CERTIFICATION VALUES
                      </td>
                    </tr>

                    {/* Gold */}
                    <tr className="hover:bg-[#1c1f24] transition-colors">
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 align-middle shadow-sm shadow-amber-400/30" />
                        <span>Gold</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="50000"
                          value={zeroSettings.goldThresholdTrack ?? 500000}
                          onChange={(e) =>
                            updateZeroSettings({ goldThresholdTrack: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="50000"
                          value={zeroSettings.goldThresholdAlbum ?? 500000}
                          onChange={(e) =>
                            updateZeroSettings({ goldThresholdAlbum: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </td>
                    </tr>

                    {/* Platinum */}
                    <tr className="hover:bg-[#1c1f24] transition-colors">
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 mr-2 align-middle shadow-sm shadow-slate-300/30" />
                        <span>Platinum</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="100000"
                          value={zeroSettings.platinumThresholdTrack ?? 1000000}
                          onChange={(e) =>
                            updateZeroSettings({ platinumThresholdTrack: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="100000"
                          value={zeroSettings.platinumThresholdAlbum ?? 1000000}
                          onChange={(e) =>
                            updateZeroSettings({ platinumThresholdAlbum: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </td>
                    </tr>

                    {/* Diamond */}
                    <tr className="hover:bg-[#1c1f24] transition-colors">
                      <td className="py-3 px-4 text-zinc-300 font-medium">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 mr-2 align-middle shadow-sm shadow-cyan-400/40" />
                        <span>Diamond</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="1000000"
                          value={zeroSettings.diamondThresholdTrack ?? 10000000}
                          onChange={(e) =>
                            updateZeroSettings({ diamondThresholdTrack: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          step="1000000"
                          value={zeroSettings.diamondThresholdAlbum ?? 10000000}
                          onChange={(e) =>
                            updateZeroSettings({ diamondThresholdAlbum: parseInt(e.target.value, 10) || 0 })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Formula Preview Callout Banner (Exact ZeroCharts text & blue box) */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#1e293b]/70 border border-[#334155] text-blue-200 text-xs sm:text-sm flex items-center gap-3">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <p>
                  <strong>Formula preview:</strong> a track needs <strong>~{trackPlaysForGold} plays</strong> for Gold; an album needs <strong>~{albumPlaysForGold}</strong>. Updates as you type.
                </p>
              </div>

              {/* ADVANCED SETTINGS */}
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  ADVANCED SETTINGS
                </span>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Name of the &apos;sales&apos; value unit
                  </label>
                  <input
                    type="text"
                    value={zeroSettings.salesUnitName || 'Units Sold'}
                    onChange={(e) => updateZeroSettings({ salesUnitName: e.target.value })}
                    placeholder="e.g. Units Sold, Records, Streams"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#252830] border border-[#363a45] text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white">General Chart Configuration</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Chart Title</label>
                  <input
                    type="text"
                    value={zeroSettings.chartTitle}
                    onChange={(e) => updateZeroSettings({ chartTitle: e.target.value })}
                    placeholder="e.g. Billboard Hot 100"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#252830] border border-[#363a45] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Chart Subtitle</label>
                  <input
                    type="text"
                    value={zeroSettings.chartSubtitle}
                    onChange={(e) => updateZeroSettings({ chartSubtitle: e.target.value })}
                    placeholder="e.g. Dark Edition • Weekly Pulse"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#252830] border border-[#363a45] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Chart Size Limit</label>
                  <select
                    value={zeroSettings.chartSize}
                    onChange={(e) => updateZeroSettings({ chartSize: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#252830] border border-[#363a45] text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value={10}>Top 10</option>
                    <option value={20}>Top 20</option>
                    <option value={50}>Top 50</option>
                    <option value={100}>Top 100 (Hot 100)</option>
                    <option value={200}>Top 200 (Billboard 200)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Scrobbles Points Multiplier</label>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.1"
                      value={zeroSettings.playMultiplier}
                      onChange={(e) => updateZeroSettings({ playMultiplier: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-mono font-bold text-blue-300 w-12 text-right">
                      {zeroSettings.playMultiplier}x
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TIEBREAK */}
          {activeTab === 'tiebreak' && (
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white">Tie-Breaking Hierarchy</h3>
              <p className="text-xs text-zinc-400">
                Choose the rule to resolve equal points when multiple tracks or albums have the exact same point total:
              </p>

              <div className="space-y-2">
                {[
                  {
                    id: 'recent',
                    title: 'Most Recent Scrobbles (Default)',
                    desc: 'Prioritizes the track listened to most recently in the charting week.',
                  },
                  {
                    id: 'peak',
                    title: 'Highest Historic Peak Rank',
                    desc: 'Prefers items with higher historical chart peak positions.',
                  },
                  {
                    id: 'plays',
                    title: 'Most Lifetime All-Time Plays',
                    desc: 'Ranks the item with greater all-time career scrobble totals higher.',
                  },
                  {
                    id: 'alpha',
                    title: 'Alphabetical Order (A-Z)',
                    desc: 'Alphabetical comparison by Track or Artist title.',
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      zeroSettings.tieBreaker === item.id
                        ? 'bg-[#222733] border-blue-500/80 text-white'
                        : 'bg-[#1e2025] border-[#2d3139] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tiebreaker"
                      value={item.id}
                      checked={zeroSettings.tieBreaker === item.id}
                      onChange={() => updateZeroSettings({ tieBreaker: item.id as any })}
                      className="mt-0.5 accent-blue-500"
                    />
                    <div>
                      <span className="text-xs font-bold block text-white">{item.title}</span>
                      <span className="text-[11px] text-zinc-400">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FILTERS */}
          {activeTab === 'filters' && (
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white">Chart Eligibility & Recurrent Rules</h3>

              {/* Minimum Scrobbles */}
              <div className="p-4 rounded-xl bg-[#1e2025] border border-[#2d3139] space-y-2">
                <label className="text-xs font-bold text-white block">Minimum Scrobbles to Enter Chart</label>
                <select
                  value={zeroSettings.minScrobblesToChart}
                  onChange={(e) => updateZeroSettings({ minScrobblesToChart: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={1}>1 Scrobble (Standard)</option>
                  <option value={2}>2 Scrobbles (Strict)</option>
                  <option value={3}>3 Scrobbles</option>
                  <option value={5}>5 Scrobbles (High Bar)</option>
                </select>
              </div>

              {/* Minimum Album Tracks Qualification Rule */}
              <div className="p-4 rounded-xl bg-[#1e2025] border border-[#2d3139] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">Minimum Album Tracks (Album Chart Qualification)</label>
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                    Default: 3 Tracks
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Albums and debut albums must have at least this many total songs overall attached to qualify for the album charts.
                </p>
                <select
                  value={zeroSettings.minAlbumTracksToChart || 3}
                  onChange={(e) => updateZeroSettings({ minAlbumTracksToChart: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#252830] border border-[#363a45] text-xs text-blue-300 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={1}>1 Track (Singles/EPs chart as albums)</option>
                  <option value={2}>2 Tracks</option>
                  <option value={3}>3 Tracks (Standard Album Qualification)</option>
                  <option value={4}>4 Tracks</option>
                  <option value={5}>5 Tracks (Full LP only)</option>
                </select>
              </div>

              {/* Billboard Recurrent Rule */}
              <div className="p-4 rounded-xl bg-[#1e2025] border border-[#2d3139] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Billboard Recurrent Drop Rule</h4>
                    <p className="text-[11px] text-zinc-400">
                      Drops long-standing tracks after X weeks if they fall below a designated rank threshold
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateZeroSettings({ enableRecurrentRule: !zeroSettings.enableRecurrentRule })}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      zeroSettings.enableRecurrentRule ? 'bg-blue-600' : 'bg-[#363a45]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        zeroSettings.enableRecurrentRule ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {zeroSettings.enableRecurrentRule && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#2d3139]">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300">Weeks on Chart</label>
                      <input
                        type="number"
                        value={zeroSettings.recurrentWeeksCutoff}
                        onChange={(e) => updateZeroSettings({ recurrentWeeksCutoff: parseInt(e.target.value, 10) || 20 })}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#252830] border border-[#363a45] text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300">Rank Cutoff</label>
                      <input
                        type="number"
                        value={zeroSettings.recurrentRankCutoff}
                        onChange={(e) => updateZeroSettings({ recurrentRankCutoff: parseInt(e.target.value, 10) || 50 })}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#252830] border border-[#363a45] text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: CORRECTIONS / OVERRIDES */}
          {activeTab === 'corrections' && (
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Manual Corrections & Overrides ({overrideEntries.length + zeroSettings.blacklistedKeys.length})
              </h3>

              {overrideEntries.length === 0 && zeroSettings.blacklistedKeys.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#1e2025] border border-[#2d3139] text-center space-y-2">
                  <PenTool className="w-6 h-6 text-zinc-500 mx-auto" />
                  <p className="text-xs font-bold text-zinc-300">No manual corrections applied yet</p>
                  <p className="text-[11px] text-zinc-400">
                    Hover over any track, artist, or album on the weekly chart and click the edit pencil icon to rename, apply point adjustments, lock ranks, or hide items.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {overrideEntries.map(([key, ov]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#252830] border border-[#363a45] text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-white block truncate">
                          {ov.titleOverride || key}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          {ov.artistOverride && <span>Artist: {ov.artistOverride}</span>}
                          {ov.lockedRank && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-mono font-bold">
                              Locked #{ov.lockedRank}
                            </span>
                          )}
                          {ov.pointAdjustment !== undefined && ov.pointAdjustment !== 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-300 font-mono font-bold">
                              {ov.pointAdjustment > 0 ? `+${ov.pointAdjustment}` : ov.pointAdjustment} pts
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => removeItemOverride(key)}
                        className="p-1.5 rounded-lg bg-[#181a1d] hover:bg-red-950 hover:text-red-400 text-zinc-400 transition-colors"
                        title="Remove Override"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {zeroSettings.blacklistedKeys.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 block">
                        Blacklisted / Hidden Entries ({zeroSettings.blacklistedKeys.length})
                      </span>
                      {zeroSettings.blacklistedKeys.map((key) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-red-950/20 border border-red-900/40 text-xs"
                        >
                          <span className="text-red-300 font-mono text-[11px] truncate pr-2">{key}</span>
                          <button
                            onClick={() => toggleBlacklistKey(key)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-200 underline"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 bg-[#181a1d] border-t border-[#2d3139]">
          <button
            type="button"
            onClick={resetZeroSettings}
            className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => setIsChartSettingsOpen(false)}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all"
          >
            Close & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

