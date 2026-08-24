import React, { useState, useRef } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import { parseScrobbleFileContent } from '../utils/scrobbleParser';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldCheck,
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
  const [parsedSummary, setParsedSummary] = useState<{
    count: number;
    format: string;
    errors: string[];
    items: any[];
    sampleItems?: any[];
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      const result = parseScrobbleFileContent(text, file.name);

      setParsedSummary({
        count: result.totalParsed,
        format: result.format,
        errors: result.errors,
        items: result.scrobbles,
        sampleItems: result.scrobbles.slice(0, 3),
      });
      setIsParsing(false);
    };

    reader.readAsText(file);
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleCommit = () => {
    if (!parsedSummary || parsedSummary.items.length === 0) return;
    uploadScrobbles(parsedSummary.items, importMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="history-uploader-modal"
        className="relative w-full max-w-xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-lg`}>
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Import Listening History
            </h2>
            <p className="text-xs text-zinc-400">
              Upload Spotify Extended Streaming JSON or Last.fm CSV/TSV/JSON dumps
            </p>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer text-center space-y-3 ${
            dragActive
              ? 'border-amber-400 bg-amber-950/20'
              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.tsv,.txt,.ndjson"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 text-zinc-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-white">
              {isParsing ? 'Parsing audio stream data...' : 'Click to select or drag and drop file here'}
            </p>
            <p className="text-[11px] text-zinc-400">
              Supported formats: <span className="text-zinc-200 font-mono">endsong.json</span>, <span className="text-zinc-200 font-mono">StreamingHistory*.json</span>, Last.fm CSV (<span className="text-zinc-200 font-mono">uts,utc_time,artist,album,track</span>), TSV, and NDJSON.
            </p>
          </div>
        </div>

        {/* Parsed Result Preview */}
        {parsedSummary && (
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">
                  Found {parsedSummary.count.toLocaleString()} Valid Scrobbles
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                Format: {parsedSummary.format}
              </span>
            </div>

            {/* Sample items preview */}
            {parsedSummary.sampleItems && parsedSummary.sampleItems.length > 0 && (
              <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Sample Parsed Tracks:</span>
                {parsedSummary.sampleItems.map((item, idx) => (
                  <div key={idx} className="text-xs text-zinc-300 flex items-center justify-between">
                    <span className="truncate font-semibold">{item.title} <span className="text-zinc-500">— {item.artist}</span></span>
                    <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0 ml-2">
                      {new Date(item.timestamp * 1000).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Import Mode Radio (Default Merge) */}
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Import Strategy
                </label>
                <span className="text-[10px] text-zinc-500">
                  Current Vault: {allProcessedScrobbles.length.toLocaleString()} items
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left space-y-0.5 cursor-pointer ${
                    importMode === 'merge'
                      ? 'bg-emerald-950/50 text-emerald-200 border-emerald-500/60 shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Safe Merge (Recommended)</span>
                    {importMode === 'merge' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-normal">
                    Appends new items & deduplicates without overriding existing data.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-left space-y-0.5 cursor-pointer ${
                    importMode === 'replace'
                      ? 'bg-red-950/50 text-red-200 border-red-500/60 shadow-sm'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Replace Entire Vault</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-normal">
                    Clears previous scrobbles and replaces with this file.
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
            <li><strong className="text-zinc-300">Spotify Extended History:</strong> JSON files from Spotify Privacy Settings (<span className="font-mono text-zinc-300">Streaming_History_Audio_*.json</span> or <span className="font-mono text-zinc-300">endsong.json</span>).</li>
            <li><strong className="text-zinc-300">Last.fm Export CSV/TSV:</strong> CSV files containing columns (<span className="font-mono text-zinc-300">uts,utc_time,artist,album,track</span> or <span className="font-mono text-zinc-300">Artist,Album,Track,Date</span>).</li>
            <li><strong className="text-zinc-300">Last.fm JSON / NDJSON:</strong> RecentTracks API JSON dumps or line-by-line streaming objects.</li>
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
            disabled={!parsedSummary || parsedSummary.count === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer`}
          >
            Import into Vault ({parsedSummary?.count.toLocaleString() || 0})
          </button>
        </div>
      </div>
    </div>
  );
};
