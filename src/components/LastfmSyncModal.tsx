import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  Radio,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  ArrowRight,
  Calendar,
  Layers,
  ShieldCheck,
  Zap,
  UploadCloud,
} from 'lucide-react';

interface LastfmSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpload?: () => void;
}

export const LastfmSyncModal: React.FC<LastfmSyncModalProps> = ({
  isOpen,
  onClose,
  onOpenUpload,
}) => {
  const {
    activeUsername,
    lastfmUsername,
    fetchLiveLastfm,
    isSyncingLastfm,
    syncProgress,
    autoSyncFridayWeeks,
    setAutoSyncFridayWeeks,
    lastWeeklyFridaySync,
    allProcessedScrobbles,
  } = useMusic();
  const { theme } = useTheme();

  const [usernameInput, setUsernameInput] = useState(
    lastfmUsername || 'iammarcus3'
  );
  const [syncScope, setSyncScope] = useState<'full' | 'friday-week'>('full');
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [customApiKey, setCustomApiKey] = useState('ffea75249cb48c306c867ca176340e3f');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message: string;
  }>({ type: 'idle', message: '' });

  if (!isOpen) return null;

  const handleSyncLive = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = usernameInput.trim().replace(/^@/, '');
    if (!cleanUsername) return;

    setSyncStatus({ type: 'idle', message: '' });

    const isFridayWeekOnly = syncScope === 'friday-week';
    const result = await fetchLiveLastfm(cleanUsername, {
      customApiKey: customApiKey.trim() || 'ffea75249cb48c306c867ca176340e3f',
      mode: mergeMode,
      onlyNewFriThuWeeks: isFridayWeekOnly,
    });

    if (result.success) {
      setSyncStatus({
        type: 'success',
        message: isFridayWeekOnly
          ? `Successfully synchronized Fri–Thu week! ${result.added || 0} new scrobbles merged into your vault.`
          : `Successfully pulled entire library (${result.count?.toLocaleString()} scrobbles) for @${cleanUsername}! All data saved & synced.`,
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      setSyncStatus({
        type: 'error',
        message: result.error || 'Could not reach Last.fm servers for this username.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="lastfm-sync-modal"
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-red-600 text-white shadow-lg flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Last.fm Weekly Sync &amp; Cloud Vault
            </h2>
            <p className="text-xs text-zinc-400">
              Pulls new Fri–Thu tracking weeks and safely appends into your existing Cloud Vault
            </p>
          </div>
        </div>

        {/* Live Username & Sync Settings Form */}
        <form onSubmit={handleSyncLive} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span>Last.fm Username</span>
              <span className="text-[10px] text-zinc-500 font-normal">
                Currently vault has {allProcessedScrobbles.length.toLocaleString()} scrobbles
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 font-mono">
                @
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. your_lastfm_handle"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Sync Scope Selection (Fri-Thu Week vs Full History) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300">Sync Scope</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSyncScope('full')}
                className={`p-3 rounded-2xl border text-left transition-all space-y-1 cursor-pointer ${
                  syncScope === 'full'
                    ? 'bg-red-950/40 border-red-500/80 text-white shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Layers className="w-3.5 h-3.5 text-red-400" />
                  <span>Entire History (All Weeks)</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Fetches your complete listening history from Last.fm from your very first scrobble to build every single chart week.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSyncScope('friday-week')}
                className={`p-3 rounded-2xl border text-left transition-all space-y-1 cursor-pointer ${
                  syncScope === 'friday-week'
                    ? 'bg-red-950/40 border-red-500/80 text-white shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Calendar className="w-3.5 h-3.5 text-red-400" />
                  <span>Latest Fri–Thu Week</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  Quickly pulls only the latest unrecorded scrobbles for the current Friday–Thursday cycle.
                </p>
              </button>
            </div>
          </div>

          {/* Safe Non-Overriding Merge Setting */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Data Protection:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMergeMode('merge')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    mergeMode === 'merge'
                      ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Safe Merge (Append)
                </button>
                <button
                  type="button"
                  onClick={() => setMergeMode('replace')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    mergeMode === 'replace'
                      ? 'bg-red-950 border border-red-500/60 text-red-300'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Replace Vault
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              {mergeMode === 'merge'
                ? 'Safe Merge deduplicates newly retrieved plays and appends them to your existing scrobbles and Cloud Sync without overriding historical weeks or custom plaques.'
                : 'Replace Vault discards local data and replaces it entirely with the newly retrieved batch.'}
            </p>
          </div>

          {/* Automatic Friday Sync Toggle */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-Sync Every Friday</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Automatically fetches new Fri–Thu tracking scrobbles and updates Cloud Sync every Friday.
              </p>
              {lastWeeklyFridaySync && (
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  Last Friday Check: {new Date(lastWeeklyFridaySync).toLocaleDateString()}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAutoSyncFridayWeeks(!autoSyncFridayWeeks)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                autoSyncFridayWeeks ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSyncFridayWeeks ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Advanced Custom Key Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors underline cursor-pointer"
            >
              {showAdvanced ? 'Hide advanced API options' : 'Custom Last.fm API Key (optional)'}
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400 block">
                  Last.fm API Key (Optional Override)
                </label>
                <input
                  type="text"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Paste your 32-character Last.fm API key"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-700"
                />
                <p className="text-[10px] text-zinc-500">
                  By default, yourhot100 cycles through working key pools automatically.
                </p>
              </div>
            )}
          </div>

          {/* Real-time Sync Progress */}
          {syncProgress && syncProgress.isSyncing && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-red-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-red-500 animate-spin" />
                  {syncProgress.message}
                </span>
                <span className="text-red-400 font-mono">{syncProgress.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, syncProgress.percent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Page {syncProgress.currentPage} of {syncProgress.totalPages}</span>
                <span>{syncProgress.fetchedCount.toLocaleString()} / {syncProgress.totalScrobbles.toLocaleString()} tracks</span>
              </div>
            </div>
          )}

          {/* Sync Status Banner */}
          {syncStatus.type === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{syncStatus.message}</span>
            </div>
          )}

          {syncStatus.type === 'error' && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">{syncStatus.message}</span>
                <span className="text-[11px] text-red-400 block">
                  Tip: Ensure your Last.fm account listening history is set to public in Last.fm Privacy Settings.
                </span>
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSyncingLastfm || !usernameInput.trim()}
            className="w-full py-3 rounded-2xl text-xs font-black bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSyncingLastfm ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            <span>
              {isSyncingLastfm
                ? 'Pulling Tracking Weeks...'
                : syncScope === 'friday-week'
                ? 'Pull New Fri–Thu Week & Merge into Vault'
                : 'Fetch & Merge Last.fm History'}
            </span>
          </button>
        </form>

        {/* Direct History File Upload Action */}
        <div className="pt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Have a Spotify or Last.fm Dump?</h4>
              <p className="text-[11px] text-zinc-400">Import Spotify JSON or Last.fm CSV export directly.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenUpload) onOpenUpload();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer whitespace-nowrap"
          >
            Upload History
          </button>
        </div>
      </div>
    </div>
  );
};
