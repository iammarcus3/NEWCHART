import React, { useRef, useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { toPng } from 'html-to-image';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
  Award,
} from 'lucide-react';

interface ChartExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: 'tracks' | 'artists' | 'albums';
}

export const ChartExportModal: React.FC<ChartExportModalProps> = ({
  isOpen,
  onClose,
  tab,
}) => {
  const {
    zeroSettings,
    currentWeekInfo,
    selectedWeekNumber,
    weeklyTracksChart,
    weeklyArtistsChart,
    weeklyAlbumsChart,
    activeUsername,
  } = useMusic();

  const exportCardRef = useRef<HTMLDivElement>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [exportLimit, setExportLimit] = useState<number>(10);

  if (!isOpen) return null;

  const currentItems =
    tab === 'tracks'
      ? weeklyTracksChart
      : tab === 'artists'
      ? weeklyArtistsChart
      : weeklyAlbumsChart;

  const itemsToRender = currentItems.slice(0, exportLimit);

  // Generate PNG
  const handleDownloadImage = async () => {
    if (!exportCardRef.current) return;
    setIsExportingImage(true);
    try {
      const dataUrl = await toPng(exportCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#09090b',
      });
      const link = document.createElement('a');
      link.download = `${zeroSettings.chartTitle.toLowerCase().replace(/\s+/g, '_')}_week_${selectedWeekNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export chart image:', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Generate CSV
  const handleDownloadCSV = () => {
    let csv = 'Rank,Title,Artist,Points,Plays,Peak,Last,Weeks\n';
    currentItems.forEach((item: any) => {
      const title = (item.title || item.artist || '').replace(/"/g, '""');
      const artist = (item.artist || '').replace(/"/g, '""');
      csv += `${item.rank},"${title}","${artist}",${item.points},${item.playCount},${item.peakRank},${item.lastRank || '-'},${item.weeksOnChart}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chart_week_${selectedWeekNumber}.csv`;
    link.click();
  };

  // Copy Markdown Table
  const handleCopyMarkdown = () => {
    let md = `### 🏆 ${zeroSettings.chartTitle} • ${currentWeekInfo?.label || `Week ${selectedWeekNumber}`}\n`;
    md += `*${currentWeekInfo?.dateRange || ''} • Curated by @${activeUsername}*\n\n`;
    md += `| Pos | Move | Title | Artist | Peak | Wks | Pts |\n`;
    md += `| :---: | :---: | :--- | :--- | :---: | :---: | :---: |\n`;
    itemsToRender.forEach((item: any) => {
      const moveStr =
        item.moveStatus === 'new'
          ? '● NEW'
          : item.moveStatus === 'up'
          ? `▲ +${item.moveDiff}`
          : item.moveStatus === 'down'
          ? `▼ ${item.moveDiff}`
          : item.moveStatus === 'reentry'
          ? '↺ RE'
          : '—';
      const title = item.title || item.artist;
      const artist = item.artist;
      md += `| **#${item.rank}** | \`${moveStr}\` | **${title}** | ${artist} | #${item.peakRank} | ${item.weeksOnChart} | ${item.points} |\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedFormat('markdown');
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="chart-export-modal"
        className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Export Graphic & Share Chart
            </h2>
            <p className="text-xs text-zinc-400">
              Download stylized leaderboard poster graphics or copy formatted tables for Reddit & Discord
            </p>
          </div>
        </div>

        {/* Export Limit Selector */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-xs font-bold text-zinc-300">Graphic Size Limit:</span>
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {[10, 20, 50].map((limit) => (
              <button
                key={limit}
                type="button"
                onClick={() => setExportLimit(limit)}
                className={`px-3 py-1 rounded-xl font-bold border transition-all ${
                  exportLimit === limit
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                Top {limit}
              </button>
            ))}
          </div>
        </div>

        {/* Renderable Graphic Preview Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <span>Graphic Preview</span>
            <span className="text-[11px] font-mono text-cyan-400">HD 2x Render Ready</span>
          </div>

          <div
            ref={exportCardRef}
            className="p-6 rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-zinc-800 shadow-2xl space-y-4"
          >
            {/* Topbar in Card */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-magenta-500 to-amber-400 flex items-center justify-center p-0.5 shadow-lg">
                  <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                    <span className="text-xs font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-amber-300">
                      HOT
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight uppercase">
                    {zeroSettings.chartTitle}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {currentWeekInfo?.label} • {currentWeekInfo?.dateRange}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold">
                  {tab.toUpperCase()} • TOP {itemsToRender.length}
                </span>
                <p className="text-[10px] text-zinc-500 mt-1">@{activeUsername}</p>
              </div>
            </div>

            {/* List items */}
            <div className="space-y-2">
              {itemsToRender.map((item: any) => (
                <div
                  key={item.rank}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-black font-mono text-xs ${
                        item.rank === 1
                          ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                          : item.rank === 2
                          ? 'bg-slate-300 text-black'
                          : item.rank === 3
                          ? 'bg-amber-700 text-amber-100'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {item.rank}
                    </div>

                    <img
                      src={item.coverArt}
                      alt="Art"
                      className="w-8 h-8 rounded-lg object-cover border border-zinc-700 flex-shrink-0"
                    />

                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate text-xs">
                        {item.title || item.artist}
                      </span>
                      <span className="text-[11px] text-zinc-400 block truncate">
                        {item.artist}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-right text-xs">
                    <div className="text-[10px] text-zinc-400">
                      <span>Pk {item.peakRank}</span> • <span>{item.weeksOnChart}w</span>
                    </div>
                    <span className="font-black text-cyan-300">
                      {item.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Card Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-900 text-[10px] text-zinc-500">
              <span>ZeroCharts Architecture Engine</span>
              <span>Generated with yourhot100</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isExportingImage}
            className="px-4 py-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{isExportingImage ? 'Generating PNG...' : 'Download Image'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            {copiedFormat === 'markdown' ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Copied Table!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
