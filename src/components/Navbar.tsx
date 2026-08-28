import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SAMPLE_PRESETS } from '../utils/sampleData';
import {
  Disc3,
  Radio,
  UploadCloud,
  Award,
  Sliders,
  Sparkles,
  Layers,
  ChevronDown,
  Clock,
  Database,
  User,
  Trophy,
  Cloud,
  CloudCheck,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  onOpenUpload: () => void;
  onOpenSync: () => void;
  onOpenCustomizer: () => void;
  onOpenPlaqueCreator: () => void;
  onOpenMilestones: () => void;
  onOpenAccount: () => void;
  onOpenCloudSyncProcess?: () => void;
  onOpenGateway?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenUpload,
  onOpenSync,
  onOpenCustomizer,
  onOpenPlaqueCreator,
  onOpenMilestones,
  onOpenAccount,
  onOpenCloudSyncProcess,
  onOpenGateway,
}) => {
  const { user } = useAuth();
  const {
    activeUsername,
    lastfmUsername,
    activePresetId,
    loadPreset,
    allProcessedScrobbles,
    timeRange,
    setTimeRange,
    weeklyArtistsChart,
    artistsChart,
    openArtistProfile,
    isCloudSynced,
    isCloudSyncing,
    syncProgress,
  } = useMusic();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const defaultTopArtist = weeklyArtistsChart[0]?.artist || artistsChart[0]?.artist || '';

  return (
    <header
      id="main-navbar"
      className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md transition-colors"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Logo */}
        <div
          onClick={onOpenGateway}
          className={`flex items-center gap-2.5 sm:gap-3 flex-shrink-0 ${onOpenGateway ? 'cursor-pointer group' : ''}`}
          title={onOpenGateway ? 'Return to Cloud Sync Gateway' : undefined}
        >
          <div
            className={`p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform`}
          >
            <Disc3 className="w-4 h-4 sm:w-5 h-5 animate-[spin_8s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight text-white font-mono lowercase group-hover:text-red-400 transition-colors">
                yourhot100
              </span>
              {syncProgress?.isSyncing && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-950 border border-red-500/50 text-red-400 text-[9px] font-mono font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Syncing
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium hidden md:block">
              Music Charts, Analytics &amp; Commemorative Plaque Forge
            </p>
          </div>
        </div>

        {/* Center: Vault Source Switcher */}
        <div className="hidden lg:flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 rounded-full px-3 py-1.5 shadow-inner">
          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 flex items-center gap-1">
            <Radio className="w-3 h-3 text-red-500" /> Vault:
          </span>
          <select
            value={activePresetId === 'custom' ? 'upload' : 'lastfm'}
            onChange={(e) => {
              if (e.target.value === 'sync' || e.target.value === 'lastfm') {
                onOpenSync();
              } else if (e.target.value === 'upload') {
                onOpenUpload();
              }
            }}
            className="bg-transparent text-xs font-semibold text-zinc-200 focus:outline-none cursor-pointer pr-1"
          >
            <option value="lastfm" className="bg-zinc-900 text-white font-semibold">
              Last.fm (@{lastfmUsername || activeUsername || 'iammarcus3'})
            </option>
            <option value="upload" className="bg-zinc-900 text-sky-400 font-semibold">
              📁 Uploaded History ({activePresetId === 'custom' ? 'Active' : 'Import File'})
            </option>
            <option value="sync" className="bg-zinc-900 text-emerald-400 font-bold">
              + Connect / Sync Last.fm Account...
            </option>
          </select>
        </div>

        {/* Desktop Actions Group */}
        <div className="hidden md:flex items-center gap-2">
          {/* Cloud Sync Gateway Portal Trigger */}
          {onOpenGateway && (
            <button
              onClick={onOpenGateway}
              id="nav-gateway-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all hover:border-red-500/40 cursor-pointer shadow-sm"
              title="Return to Cloud Sync Gateway & Login Portal"
            >
              <Disc3 className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden xl:inline">Cloud Gateway</span>
            </button>
          )}

          {/* Cloud Sync Process Diagnostic Trigger */}
          {onOpenCloudSyncProcess && (
            <button
              onClick={onOpenCloudSyncProcess}
              id="nav-cloud-sync-process-btn"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 transition-all cursor-pointer shadow-sm"
              title="Inspect live Cloud Sync Process & Diagnostics"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xl:inline">Sync Process</span>
            </button>
          )}

          {/* Account / Cloud Sync Trigger */}
          <button
            onClick={onOpenAccount}
            id="nav-account-btn"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all hover:border-purple-500/50 cursor-pointer"
            title="User Account & Cloud Database Storage"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Account"
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover border border-purple-500"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center text-[10px] font-black">
                {user?.email ? user.email[0].toUpperCase() : <Cloud className="w-3 h-3" />}
              </div>
            )}

            <span className="hidden sm:inline truncate max-w-[90px]">
              {user?.displayName?.split(' ')[0] || (user ? 'Account' : 'Cloud Sync')}
            </span>

            {/* Live Cloud Status Dot */}
            <span
              className={`w-2 h-2 rounded-full ${
                isCloudSyncing
                  ? 'bg-amber-400 animate-ping'
                  : user
                  ? 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
              title={isCloudSyncing ? 'Syncing...' : user ? 'Cloud Synced' : 'Local Storage Mode'}
            />
          </button>

          {/* Milestones & Records Trigger */}
          <button
            onClick={onOpenMilestones}
            id="nav-milestones-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all hover:border-amber-500/50 cursor-pointer"
            title="Browse All #1s, Milestones, Best Debuts & Records"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Milestones</span>
          </button>

          {/* Artist Archive / Profile Trigger */}
          <button
            onClick={() => openArtistProfile(defaultTopArtist)}
            id="nav-artist-profile-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all hover:border-zinc-700 cursor-pointer"
            title="Browse Artist Profile & Full Chart History"
          >
            <User className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Artist Archive</span>
          </button>

          {/* Last.fm Sync Modal Trigger with Live Count */}
          <button
            onClick={onOpenSync}
            id="nav-sync-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              syncProgress?.isSyncing
                ? 'bg-red-950/80 border-red-500 text-red-300 shadow-md shadow-red-950/50'
                : allProcessedScrobbles.length > 0
                ? 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-zinc-800 hover:border-red-500/40'
                : 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-sm'
            }`}
            title="Connect Last.fm Account or load profiles"
          >
            <Radio className={`w-3.5 h-3.5 ${syncProgress?.isSyncing ? 'text-red-400 animate-spin' : 'text-red-400'}`} />
            <span>
              {syncProgress?.isSyncing
                ? `Syncing (${syncProgress.fetchedCount.toLocaleString()})`
                : allProcessedScrobbles.length > 0
                ? `${allProcessedScrobbles.length.toLocaleString()} Plays`
                : 'Sync Last.fm'}
            </span>
          </button>

          {/* Upload History Trigger */}
          <button
            onClick={onOpenUpload}
            id="nav-upload-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-all cursor-pointer"
            title="Import Spotify JSON or Last.fm CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Import</span>
          </button>

          {/* Forge Plaque Button */}
          <button
            onClick={onOpenPlaqueCreator}
            id="nav-forge-plaque-btn"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-md hover:brightness-110 transition-all cursor-pointer`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Forge</span>
          </button>

          {/* Theme & Layout Customizer */}
          <button
            onClick={onOpenCustomizer}
            id="nav-customizer-btn"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all cursor-pointer"
            title="Customize studio theme and widget layout"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Quick Actions + Burger Toggle */}
        <div className="flex md:hidden items-center gap-1.5">
          {/* Quick Plaque Button */}
          <button
            onClick={onOpenPlaqueCreator}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-sm`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Forge</span>
          </button>

          {/* Quick Sync Button */}
          <button
            onClick={onOpenSync}
            className={`p-2 rounded-xl border text-xs font-bold ${
              syncProgress?.isSyncing
                ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                : 'bg-zinc-900 text-red-400 border-zinc-800'
            }`}
            title="Last.fm Sync"
          >
            <Radio className="w-4 h-4" />
          </button>

          {/* Burger Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            id="mobile-nav-toggle"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950/98 px-4 py-4 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {onOpenGateway && (
              <button
                onClick={() => {
                  onOpenGateway();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-red-300 text-left"
              >
                <Disc3 className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>Cloud Gateway</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenMilestones();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-left"
            >
              <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Milestones (#1s)</span>
            </button>

            <button
              onClick={() => {
                openArtistProfile(defaultTopArtist);
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sky-300 text-left"
            >
              <User className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span>Artist Archive</span>
            </button>

            <button
              onClick={() => {
                onOpenSync();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-left"
            >
              <Radio className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>Last.fm Sync</span>
            </button>

            <button
              onClick={() => {
                onOpenUpload();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-left"
            >
              <UploadCloud className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span>Upload History</span>
            </button>

            <button
              onClick={() => {
                onOpenAccount();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-purple-300 text-left"
            >
              <Cloud className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>Account &amp; Cloud</span>
            </button>

            <button
              onClick={() => {
                onOpenCustomizer();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-left"
            >
              <Sliders className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span>Customizer</span>
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
            <span>Logged Plays: <strong className="text-white font-mono">{allProcessedScrobbles.length.toLocaleString()}</strong></span>
            <span className="font-mono text-cyan-400">@{lastfmUsername || activeUsername || 'iammarcus3'}</span>
          </div>
        </div>
      )}
    </header>
  );
};


