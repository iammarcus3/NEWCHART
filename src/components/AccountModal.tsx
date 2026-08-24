import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import {
  X,
  User,
  LogOut,
  Cloud,
  CloudCheck,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Disc3,
  HardDrive,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCloudSyncProcess?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onOpenCloudSyncProcess,
}) => {
  const { user, signInWithGoogle, logout, authError } = useAuth();
  const {
    isCloudSynced,
    isCloudSyncing,
    lastCloudSyncTime,
    manualCloudSync,
    pullLatestFromCloud,
    allProcessedScrobbles,
    plaques,
    zeroSettings,
    activeUsername,
    lastfmUsername,
    autoSyncFridayWeeks,
    setAutoSyncFridayWeeks,
    lastWeeklyFridaySync,
    syncNewFridayWeeks,
    isSyncingLastfm,
  } = useMusic();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isPullingFriday, setIsPullingFriday] = useState(false);
  const [isRestoringCloud, setIsRestoringCloud] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleManualSync = async () => {
    if (!user) return;
    const res = await manualCloudSync();
    if (res.success) {
      setSyncFeedback('Successfully backed up all music charts, scrobbles, and plaques to your cloud account!');
      setTimeout(() => setSyncFeedback(null), 3500);
    } else {
      setSyncFeedback(res.error || 'Cloud sync failed.');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!user) return;
    setIsRestoringCloud(true);
    const res = await pullLatestFromCloud();
    setIsRestoringCloud(false);
    if (res.success) {
      setSyncFeedback('Successfully loaded your cloud data onto this device!');
      setTimeout(() => setSyncFeedback(null), 3500);
    } else {
      setSyncFeedback(res.error || 'Could not restore cloud data.');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handlePullFridayWeek = async () => {
    setIsPullingFriday(true);
    const res = await syncNewFridayWeeks();
    setIsPullingFriday(false);
    if (res.success) {
      setSyncFeedback(`Merged new Friday-Thursday week scrobbles (${res.count || 0} retrieved)!`);
      setTimeout(() => setSyncFeedback(null), 3500);
    } else {
      setSyncFeedback(res.error || 'Could not pull new Friday week.');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        id="account-auth-modal"
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg flex items-center justify-center">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Cloud Account &amp; Storage
            </h2>
            <p className="text-xs text-zinc-400">
              Synchronize your charts, scrobbles, and plaques with your account
            </p>
          </div>
        </div>

        {authError && (
          <div className="p-3 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {syncFeedback && (
          <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {user ? (
          /* Signed In State */
          <div className="space-y-5">
            {/* User Profile Card */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-4">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/60 shadow"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-black text-lg">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">
                    {user.displayName || 'Music Enthusiast'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Cloud Synced
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono truncate">{user.email}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Vault Profile: <span className="text-purple-400 font-mono">@{lastfmUsername || activeUsername || 'iammarcus3'}</span>
                </p>
              </div>
            </div>

            {/* Connected Last.fm Account Display & Quick Sync */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Last.fm Connected Account
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  @{lastfmUsername || activeUsername || 'iammarcus3'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Weekly sync pulls only new Friday-Thursday tracking week scrobbles and safely merges them into your Cloud Vault without overriding or deleting any existing history.
              </p>
            </div>

            {/* Cloud Storage Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center">
                <span className="text-base font-black text-white font-mono block">
                  {allProcessedScrobbles.length.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-medium">Scrobbles</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center">
                <span className="text-base font-black text-amber-400 font-mono block">
                  {plaques.length}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-medium">Plaques</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center">
                <span className="text-base font-black text-purple-400 font-mono block">
                  {zeroSettings.chartSize}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-medium">Chart Size</span>
              </div>
            </div>

            {/* Sync Details & Status */}
            <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-purple-400" /> Database Cloud State:
                </span>
                <span className="text-emerald-400 font-mono font-bold">
                  {isCloudSyncing ? 'Synchronizing...' : isCloudSynced ? 'Up to date' : 'Saving...'}
                </span>
              </div>
              {lastCloudSyncTime && (
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Last Cloud Checkpoint:</span>
                  <span className="font-mono">{new Date(lastCloudSyncTime).toLocaleTimeString()}</span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Weekly Friday Cloud Sync (Fri–Thu):</span>
                <span className="text-purple-300 font-mono font-semibold">
                  {autoSyncFridayWeeks ? 'Active (Auto)' : 'Manual'}
                </span>
              </div>
            </div>

            {/* Friday Week Sync Button */}
            <div className="p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">Friday Tracking Week Update</span>
                <span className="text-[10px] text-zinc-400 block truncate">
                  Pulls new scrobbles for Fri–Thu cycle &amp; merges to Cloud Vault
                </span>
              </div>
              <button
                type="button"
                onClick={handlePullFridayWeek}
                disabled={isPullingFriday || isSyncingLastfm}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPullingFriday ? 'animate-spin' : ''}`} />
                <span>{isPullingFriday ? 'Pulling...' : 'Pull New Week'}</span>
              </button>
            </div>

            {/* Cloud Sync Process Pipeline Trigger */}
            {onOpenCloudSyncProcess && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCloudSyncProcess();
                }}
                className="w-full p-3 rounded-2xl bg-indigo-950/40 hover:bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 flex items-center justify-between gap-3 transition-all cursor-pointer text-xs font-bold"
              >
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span>Inspect Cloud Sync Process &amp; Diagnostics</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-900/60 text-indigo-200">
                  Open Pipeline →
                </span>
              </button>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isCloudSyncing || isRestoringCloud}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                <span>{isCloudSyncing ? 'Backing Up...' : 'Save to Cloud Now'}</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreFromCloud}
                disabled={isCloudSyncing || isRestoringCloud}
                className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Cloud className={`w-3.5 h-3.5 ${isRestoringCloud ? 'animate-pulse' : ''}`} />
                <span>{isRestoringCloud ? 'Restoring...' : 'Restore from Cloud'}</span>
              </button>

              <button
                type="button"
                onClick={logout}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:text-red-400"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* Logged Out State */
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
              <div className="flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <p className="font-bold text-white mb-1">Currently in Local Browser Storage</p>
                  Your music history and charts are temporarily stored in this browser session. Sign in with Google to automatically backup and sync your:
                </div>
              </div>

              <ul className="text-xs text-zinc-400 space-y-1.5 pl-8 list-disc">
                <li>ZeroCharts weekly chart archives and history</li>
                <li>Custom certified record plaques &amp; RIAA certifications</li>
                <li>Track duplicate clusters and custom title mergers</li>
                <li>Custom scoring formulas, weights, and manual chart overrides</li>
              </ul>
            </div>

            {/* Google Sign-in Button */}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-black text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {/* Google Icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                />
              </svg>
              <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google Account'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
