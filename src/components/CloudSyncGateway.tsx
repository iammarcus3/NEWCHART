import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  Cloud,
  CheckCircle2,
  Disc3,
  Radio,
  UploadCloud,
  ArrowRight,
  RefreshCw,
  Database,
  Trophy,
  Sliders,
  ShieldCheck,
  Zap,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CloudSyncGatewayProps {
  onEnterCharts: () => void;
  onOpenUpload: () => void;
  onOpenLastfmModal: () => void;
}

export const CloudSyncGateway: React.FC<CloudSyncGatewayProps> = ({
  onEnterCharts,
  onOpenUpload,
  onOpenLastfmModal,
}) => {
  const { user, signInWithGoogle, logout, authError, loading: authLoading } = useAuth();
  const {
    allProcessedScrobbles,
    allWeeks,
    lastfmUsername,
    activeUsername,
    isCloudSynced,
    isCloudSyncing,
    lastCloudSyncTime,
    manualCloudSync,
    pullLatestFromCloud,
    plaques,
  } = useMusic();
  const { theme } = useTheme();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setActionMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setActionMessage({
        text: err?.message || 'Google sign-in could not be completed. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleManualCloudPull = async () => {
    setActionMessage(null);
    const res = await pullLatestFromCloud();
    if (res.success) {
      setActionMessage({
        text: 'Cloud Vault restored successfully! All scrobbles and weekly charts are ready.',
        type: 'success',
      });
    } else {
      setActionMessage({
        text: res.error || 'Failed to pull cloud vault.',
        type: 'error',
      });
    }
  };

  const handleManualCloudSave = async () => {
    setActionMessage(null);
    const res = await manualCloudSync();
    if (res.success) {
      setActionMessage({
        text: 'Vault snapshot successfully backed up to Firestore.',
        type: 'success',
      });
    } else {
      setActionMessage({
        text: res.error || 'Failed to save to cloud.',
        type: 'error',
      });
    }
  };

  const totalScrobbles = allProcessedScrobbles.length;
  const totalWeeks = allWeeks.length;

  return (
    <div className={`min-h-screen ${theme.bgClass} text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black`}>
      {/* Top Simple Header */}
      <header className="w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-2xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-lg flex items-center justify-center`}>
            <Disc3 className="w-5 h-5 animate-[spin_8s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg tracking-tight text-white font-mono lowercase">yourhot100</span>
              <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-400 text-[10px] font-mono font-bold">
                Cloud Sync Gateway
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">Weekly Music Charts &amp; Scrobble Vault</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Signed in as <strong className="text-zinc-200">{user.email}</strong></span>
            </div>
            <button
              onClick={onEnterCharts}
              id="header-enter-charts-btn"
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Go to Charts</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* Main Center Gateway Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Status Messages */}
        {actionMessage && (
          <div
            className={`mb-6 p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/60 border-red-500/40 text-red-300'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {authError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-3">
            <Zap className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <div className="bg-zinc-950/90 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden backdrop-blur-xl">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Description */}
          <div className="text-center space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-mono font-semibold">
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              <span>Multi-Device Cloud Persistence</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Music Vault &amp; Cloud Sync Access
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Sign in with your Google account to automatically load and backup your scrobble vault, weekly chart calculations, custom plaques, and artist credit settings.
            </p>
          </div>

          {/* Conditional User State: Signed In vs Signed Out */}
          {user ? (
            /* =================== SIGNED IN STATE =================== */
            <div className="space-y-6 relative z-10">
              <div className="p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-2xl border-2 border-emerald-500/80 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xl">
                      {user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <h2 className="text-base font-bold text-white">{user.displayName || 'Music Curator'}</h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono font-bold">
                        Cloud Connected
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">{user.email}</p>
                    {lastCloudSyncTime && (
                      <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                        Last cloud sync: {new Date(lastCloudSyncTime).toLocaleDateString()} {new Date(lastCloudSyncTime).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => logout()}
                  id="gateway-sign-out-btn"
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </div>

              {/* Vault Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                    Scrobbles
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                    {totalScrobbles.toLocaleString()}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                    Fri-Thu Weeks
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-sky-400">
                    {totalWeeks}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                    Plaques
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-purple-400">
                    {plaques.length}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                    Last.fm Target
                  </span>
                  <span className="text-sm font-bold font-mono text-zinc-200 truncate block mt-1">
                    @{lastfmUsername || activeUsername || 'iammarcus3'}
                  </span>
                </div>
              </div>

              {/* Primary Action to Enter Dashboard */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={onEnterCharts}
                  id="gateway-enter-dashboard-btn"
                  className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:opacity-95 text-white font-black text-sm tracking-wide shadow-xl shadow-red-950/50 transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>Enter Charts &amp; Music Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleManualCloudPull}
                  disabled={isCloudSyncing}
                  id="gateway-restore-cloud-btn"
                  className="w-full sm:w-auto py-4 px-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Force download latest snapshot from cloud"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>Restore from Cloud</span>
                </button>
              </div>
            </div>
          ) : (
            /* =================== SIGNED OUT / LOGIN PROMPT =================== */
            <div className="space-y-6 relative z-10">
              <div className="p-6 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800 space-y-4 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Persistent Google Cloud Sync</span>
                    </h2>
                    <p className="text-xs text-zinc-400 max-w-md">
                      Prevent re-syncing from page 1 every visit. Signing in keeps your complete listening history stored in Firebase Firestore for instant access anywhere.
                    </p>
                  </div>

                  {/* Big Google Sign-In Button */}
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn || authLoading}
                    id="gateway-google-signin-btn"
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Instant instant-load without re-scrape</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Syncs plaques &amp; ZeroCharts rules</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Multi-device synchronization</span>
                  </div>
                </div>
              </div>

              {/* Guest / Alternative Entry Options */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={onEnterCharts}
                  id="gateway-continue-guest-btn"
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Charts as Guest (Local Mode)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={onOpenLastfmModal}
                    id="gateway-connect-lastfm-btn"
                    className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-red-950/70 hover:bg-red-900/80 text-red-300 border border-red-700/50 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 text-red-400" />
                    <span>Last.fm Account</span>
                  </button>

                  <button
                    onClick={onOpenUpload}
                    id="gateway-upload-history-btn"
                    className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-sky-950/70 hover:bg-sky-900/80 text-sky-300 border border-sky-700/50 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                    <span>Upload History</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Feature Pillars Footer */}
          <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-zinc-400">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">Strict Fri-Thu Tracking</strong>
                <span>Calculates authentic weekly charts with debut, peak, and streak records.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">Plaque &amp; Record Forge</strong>
                <span>Mint custom Gold, Platinum, and Multi-Platinum certifications for tracks &amp; albums.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Sliders className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">Custom Points Engine</strong>
                <span>Fully customize ZeroCharts scoring, tie-breakers, and artist crediting rules.</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="w-full border-t border-zinc-800/60 bg-zinc-950/60 py-4 px-4 text-center text-xs text-zinc-500">
        <span>yourhot100 • Cloud-Synced Scrobble Vault &amp; ZeroCharts Analytics Engine</span>
      </footer>
    </div>
  );
};
