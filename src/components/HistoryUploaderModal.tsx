import React, { useState, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import { parseScrobbleFilesAsync, ParseProgress, ParseResult } from '../utils/scrobbleParser';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Calendar,
  Layers,
  Database,
  Music2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Clock,
  HardDrive,
} from 'lucide-react';

interface HistoryUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryUploaderModal: React.FC<HistoryUploaderModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { uploadScrobbles, allProcessedScrobbles } = useMusic();
  const { theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<ParseProgress | null>(null);
  const [parsedSummary, setParsedSummary] = useState<ParseResult | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  // Multi-step Import Execution State
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    stage: string;
    percent: number;
    message: string;
  } | null>(null);
  const [importCompleted, setImportCompleted] = useState<{
    totalCount: number;
    weeksCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      f.name.match(/\.(json|csv|tsv|txt|ndjson|zip)$/i)
    );

    if (fileArray.length === 0) return;

    setSelectedFiles(fileArray);
    setIsParsing(true);
    setParseProgress({
      percent: 0,
      message: 'Initializing stream parser...',
      count: 0,
      fileIndex: 0,
      totalFiles: fileArray.length,
    });
    setParsedSummary(null);
    setImportCompleted(null);

    try {
      const result = await parseScrobbleFilesAsync(fileArray, (progress) => {
        setParseProgress(progress);
      });
      setParsedSummary(result);
    } catch (err: any) {
      console.error('Failed to parse files:', err);
      setParsedSummary({
        scrobbles: [],
        format: 'generic',
        errors: [err?.message || 'Failed to read files'],
        totalParsed: 0,
      });
    } finally {
      setIsParsing(false);
      setParseProgress(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleCommit = async () => {
    if (!parsedSummary || parsedSummary.scrobbles.length === 0) return;

    setIsExecutingImport(true);
    setImportProgress({
      stage: 'merging',
      percent: 15,
      message: 'Indexing and deduplicating timeline plays...',
    });

    try {
      const res = await uploadScrobbles(
        parsedSummary.scrobbles,
        importMode,
        (progress) => {
          setImportProgress(progress);
        }
      );

      if (res.success) {
        setImportCompleted({
          totalCount: res.count,
          weeksCount: res.weeksCount,
        });
      }
    } catch (e) {
      console.error('Import error:', e);
    } finally {
      setIsExecutingImport(false);
    }
  };

  const resetAll = () => {
    setSelectedFiles([]);
    setParsedSummary(null);
    setParseProgress(null);
    setIsExecutingImport(false);
    setImportProgress(null);
    setImportCompleted(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="history-uploader-modal"
        className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-2xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-lg flex items-center justify-center`}
          >
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Import Listening History
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" /> Multi-File &amp; Large Archives
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload Spotify Extended Streaming JSON, Last.fm CSV/TSV dumps, or Apple Music logs
            </p>
          </div>
        </div>

        {/* COMPLETED SUCCESS STATE */}
        {importCompleted ? (
          <div className="p-6 rounded-3xl bg-zinc-900/90 border border-emerald-500/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-500/50 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Vault Successfully Synchronized!
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                Your listening history has been parsed, indexed into Friday-to-Thursday tracking cycles, and saved to your persistent vault.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center">
                <span className="text-[11px] text-zinc-400 block">Total Scrobbles</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {importCompleted.totalCount.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-center">
                <span className="text-[11px] text-zinc-400 block">Weekly Tracking Cycles</span>
                <span className="text-lg font-black text-purple-400 font-mono">
                  {importCompleted.weeksCount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-center gap-3">
              <button
                onClick={resetAll}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
              >
                Upload More Files
              </button>
              <button
                onClick={onClose}
                className={`px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer`}
              >
                <span>Explore Your Charts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : isExecutingImport ? (
          /* LIVE IMPORT IN PROGRESS STATE */
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5 text-center">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-purple-400">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white">
                Importing History into Vault...
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                {importProgress?.message || 'Processing and synchronizing data snapshot...'}
              </p>
            </div>

            {/* Glowing progress bar */}
            <div className="space-y-1.5 max-w-md mx-auto">
              <div className="w-full h-3 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${theme.accentGradient} transition-all duration-300 shadow-sm`}
                  style={{ width: `${Math.max(5, importProgress?.percent || 10)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                <span>{importProgress?.stage?.toUpperCase() || 'SYNC'}</span>
                <span>{importProgress?.percent || 10}%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-left text-[11px] max-w-md mx-auto pt-2">
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">Step 1</span>
                  <span className="text-zinc-300 font-bold">Local Vault</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">Step 2</span>
                  <span className="text-zinc-300 font-bold">Fri–Thu Weeks</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">Step 3</span>
                  <span className="text-zinc-300 font-bold">Cloud Backup</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD UPLOAD & PREVIEW VIEW */
          <>
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer text-center space-y-3 ${
                dragActive
                  ? 'border-purple-400 bg-purple-950/20'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json,.csv,.tsv,.txt,.ndjson,.zip"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files);
                  }
                }}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-300 mx-auto flex items-center justify-center shadow-inner">
                {isParsing ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                ) : (
                  <FileText className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-bold text-white">
                  {isParsing
                    ? parseProgress?.message || 'Parsing audio streaming history...'
                    : 'Click to select or drop files here'}
                </p>
                <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                  Supports multiple files simultaneously: <span className="text-zinc-200 font-mono">Streaming_History_Audio_*.json</span>, <span className="text-zinc-200 font-mono">endsong.json</span>, Last.fm CSV/TSV, and Apple Music.
                </p>
              </div>

              {/* Parsing Progress Bar */}
              {isParsing && parseProgress && (
                <div className="max-w-xs mx-auto space-y-1 pt-2">
                  <div className="w-full h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${theme.accentGradient} transition-all duration-200`}
                      style={{ width: `${parseProgress.percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono block">
                    {parseProgress.count.toLocaleString()} plays found ({parseProgress.percent}%)
                  </span>
                </div>
              )}
            </div>

            {/* Selected File Badges */}
            {selectedFiles.length > 0 && !isParsing && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-zinc-500 mr-1">
                  Files ({selectedFiles.length}):
                </span>
                {selectedFiles.map((f, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300"
                  >
                    <FileText className="w-3 h-3 text-purple-400" />
                    <span className="truncate max-w-[160px]">{f.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      ({(f.size / (1024 * 1024)).toFixed(1)}MB)
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Parsed Result Preview */}
            {parsedSummary && parsedSummary.totalParsed > 0 && (
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-black text-white">
                      {parsedSummary.totalParsed.toLocaleString()} Valid Scrobbles Ready
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg bg-zinc-950 text-purple-300 border border-purple-800/40">
                    Format: {parsedSummary.format}
                  </span>
                </div>

                {/* Timeline Range and Top Artists Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {parsedSummary.startDate && parsedSummary.endDate && (
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Date Timeline</span>
                        <span className="text-zinc-200 font-semibold font-mono text-[11px]">
                          {parsedSummary.startDate.toLocaleDateString(undefined, {
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          →{' '}
                          {parsedSummary.endDate.toLocaleDateString(undefined, {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {parsedSummary.topArtists && parsedSummary.topArtists.length > 0 && (
                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/70 flex items-center gap-2.5">
                      <Music2 className="w-4 h-4 text-pink-400 flex-shrink-0" />
                      <div className="truncate">
                        <span className="text-[10px] text-zinc-500 block">Top Upload Artists</span>
                        <span className="text-zinc-200 font-semibold truncate block">
                          {parsedSummary.topArtists.map((a) => a.artist).join(', ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sample items preview */}
                {parsedSummary.scrobbles && parsedSummary.scrobbles.length > 0 && (
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Sample Extracted Streams:
                    </span>
                    {parsedSummary.scrobbles.slice(0, 3).map((item, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-zinc-300 flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-semibold">
                          {item.title}{' '}
                          <span className="text-zinc-500">— {item.artist}</span>
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">
                          {new Date(item.timestamp * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Import Strategy Radio */}
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Import Strategy
                    </label>
                    <span className="text-[10px] text-zinc-500">
                      Current Vault: {allProcessedScrobbles.length.toLocaleString()} plays
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all text-left space-y-0.5 cursor-pointer ${
                        importMode === 'merge'
                          ? 'bg-emerald-950/50 text-emerald-200 border-emerald-500/60 shadow-sm'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Safe Merge (Recommended)</span>
                        {importMode === 'merge' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-normal">
                        Appends new items & deduplicates without overriding existing data.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`p-3 rounded-xl text-xs font-bold border transition-all text-left space-y-0.5 cursor-pointer ${
                        importMode === 'replace'
                          ? 'bg-red-950/50 text-red-200 border-red-500/60 shadow-sm'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Replace Entire Vault</span>
                        {importMode === 'replace' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 font-normal">
                        Clears previous scrobbles and initializes vault with this upload.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-400 space-y-2">
              <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Supported file types &amp; export instructions:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-zinc-400 list-disc list-inside">
                <li>
                  <strong className="text-zinc-300">Spotify Extended History:</strong> JSON files from Spotify Privacy Export (<span className="font-mono text-zinc-300">Streaming_History_Audio_*.json</span> or <span className="font-mono text-zinc-300">endsong.json</span>).
                </li>
                <li>
                  <strong className="text-zinc-300">Last.fm Export CSV/TSV:</strong> CSV files containing columns (<span className="font-mono text-zinc-300">uts,utc_time,artist,album,track</span> or <span className="font-mono text-zinc-300">Artist,Album,Track,Date</span>).
                </li>
                <li>
                  <strong className="text-zinc-300">Apple Music Activity:</strong> <span className="font-mono text-zinc-300">Apple_Music_Play_Activity.csv</span> from Apple Privacy Data export.
                </li>
              </ul>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-900 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleCommit}
                disabled={!parsedSummary || parsedSummary.totalParsed === 0}
                className={`px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer`}
              >
                <span>Import into Vault ({parsedSummary?.totalParsed.toLocaleString() || 0})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
