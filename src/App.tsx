import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MusicProvider, useMusic } from './context/MusicContext';
import { Navbar } from './components/Navbar';
import { HeroOverview } from './components/HeroOverview';
import { TopChartsWidget } from './components/widgets/TopChartsWidget';
import { WeeklyGenreChartsWidget } from './components/widgets/WeeklyGenreChartsWidget';
import { PlaqueWallWidget } from './components/widgets/PlaqueWallWidget';
import { TrackCombinerWidget } from './components/widgets/TrackCombinerWidget';
import { PlaqueDetailModal } from './components/PlaqueDetailModal';
import { PlaqueCreatorModal } from './components/PlaqueCreatorModal';
import { HistoryUploaderModal } from './components/HistoryUploaderModal';
import { LastfmSyncModal } from './components/LastfmSyncModal';
import { CustomizationDrawer } from './components/CustomizationDrawer';
import { DetailDrawer } from './components/DetailDrawer';
import { ChartSettingsModal } from './components/ChartSettingsModal';
import { ChartItemEditorModal } from './components/ChartItemEditorModal';
import { ArtistProfileModal } from './components/ArtistProfileModal';
import { MilestonesModal, MilestoneCategory } from './components/MilestonesModal';
import { AccountModal } from './components/AccountModal';
import { CloudSyncStatusModal } from './components/CloudSyncStatusModal';
import { PlaqueCertification, SubjectType, WidgetType } from './types/music';
import { RefreshCw, Radio, UploadCloud, Cloud, CheckCircle2, ArrowRight } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { theme, widgets } = useTheme();
  const { user } = useAuth();
  const {
    activeArtistProfile,
    setActiveArtistProfile,
    syncProgress,
    isSyncingLastfm,
    fetchLiveLastfm,
    allProcessedScrobbles,
    activeUsername,
    lastfmUsername,
    isCloudSynced,
    isCloudSyncing,
  } = useMusic();

  // Modals & Drawers state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCloudSyncProcessOpen, setIsCloudSyncProcessOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isPlaqueCreatorOpen, setIsPlaqueCreatorOpen] = useState(false);
  const [isMilestonesOpen, setIsMilestonesOpen] = useState(false);
  const [selectedMilestoneCategory, setSelectedMilestoneCategory] = useState<MilestoneCategory>('all_1s');
  const [selectedPlaque, setSelectedPlaque] = useState<PlaqueCertification | null>(null);
  const [prefillPlaqueItem, setPrefillPlaqueItem] = useState<{
    title: string;
    subtitle: string;
    type: SubjectType;
    scrobbles: number;
    coverArt?: string;
  } | null>(null);

  const handleAwardPlaque = (item: {
    title: string;
    subtitle: string;
    type: SubjectType;
    scrobbles: number;
    coverArt?: string;
  }) => {
    setPrefillPlaqueItem(item);
    setIsPlaqueCreatorOpen(true);
  };

  const openMilestonesWithCategory = (cat: MilestoneCategory = 'all_1s') => {
    setSelectedMilestoneCategory(cat);
    setIsMilestonesOpen(true);
  };

  const renderWidget = (id: WidgetType) => {
    switch (id) {
      case 'top-charts':
        return (
          <TopChartsWidget
            onAwardPlaque={handleAwardPlaque}
            onOpenMilestones={() => openMilestonesWithCategory('all_1s')}
          />
        );
      case 'weekly-genre-charts':
        return <WeeklyGenreChartsWidget onAwardPlaque={handleAwardPlaque} />;
      case 'plaque-wall':
        return (
          <PlaqueWallWidget
            onOpenPlaqueDetail={(p) => setSelectedPlaque(p)}
            onOpenPlaqueCreator={() => {
              setPrefillPlaqueItem(null);
              setIsPlaqueCreatorOpen(true);
            }}
          />
        );
      case 'track-combiner':
        return <TrackCombinerWidget />;
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen ${theme.bgClass} text-zinc-100 transition-colors selection:bg-amber-500 selection:text-black`}>
      {/* Top Navigation */}
      <Navbar
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenCloudSyncProcess={() => setIsCloudSyncProcessOpen(true)}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenPlaqueCreator={() => {
          setPrefillPlaqueItem(null);
          setIsPlaqueCreatorOpen(true);
        }}
        onOpenMilestones={() => openMilestonesWithCategory('all_1s')}
      />

      {/* Real-time Global Sync Progress Banner */}
      {syncProgress && syncProgress.isSyncing && (
        <div className="bg-gradient-to-r from-red-950/90 via-zinc-900 to-red-950/90 border-b border-red-500/30 px-4 py-3 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-red-400 animate-spin flex-shrink-0" />
              <div>
                <span className="font-bold text-white block">{syncProgress.message}</span>
                <span className="text-[11px] text-zinc-400">
                  Importing and calculating Friday-to-Thursday tracking cycles...
                </span>
              </div>
            </div>

            <div className="w-full sm:w-64 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, syncProgress.percent)}%` }}
                />
              </div>
              <span className="font-mono text-red-300 font-bold whitespace-nowrap">
                {syncProgress.percent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Canvas */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Empty Vault Onboarding Banner (if no scrobbles yet and not actively syncing) */}
        {allProcessedScrobbles.length === 0 && !isSyncingLastfm && (
          <div className="p-6 rounded-3xl bg-zinc-950/80 border border-zinc-800/90 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 text-xs font-bold font-mono">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Vault Ready For Last.fm Sync</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Import Listening History for @{lastfmUsername || 'iammarcus3'}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                Ready to pull your entire Last.fm library or merge older listening history files. All imported scrobbles automatically calculate your weekly charts and sync to the cloud for all devices.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => {
                  fetchLiveLastfm(lastfmUsername || 'iammarcus3', {
                    customApiKey: 'ffea75249cb48c306c867ca176340e3f',
                    mode: 'merge',
                    onlyNewFriThuWeeks: false,
                  });
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Fetch All Last.fm History</span>
              </button>

              <button
                onClick={() => setIsUploadOpen(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-sky-400" />
                <span>Upload Older History (File)</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats Overview */}
        <HeroOverview
          onOpenDuplicateDrawer={() => {
            const el = document.getElementById('track-combiner-widget');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onOpenGenreCharts={() => {
            const el = document.getElementById('weekly-genre-charts-widget');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          onOpenPlaqueWall={() => {
            const el = document.getElementById('plaque-wall-widget');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Dynamic Widgets Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgets
            .filter((w) => w.enabled)
            .map((widget) => (
              <div
                key={widget.id}
                className={widget.width === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'}
              >
                {renderWidget(widget.id)}
              </div>
            ))}
        </div>
      </main>

      {/* Modals and Side Drawers */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onOpenCloudSyncProcess={() => setIsCloudSyncProcessOpen(true)}
      />

      <CloudSyncStatusModal
        isOpen={isCloudSyncProcessOpen}
        onClose={() => setIsCloudSyncProcessOpen(false)}
      />

      <PlaqueDetailModal
        plaque={selectedPlaque}
        onClose={() => setSelectedPlaque(null)}
      />

      <PlaqueCreatorModal
        isOpen={isPlaqueCreatorOpen}
        onClose={() => {
          setIsPlaqueCreatorOpen(false);
          setPrefillPlaqueItem(null);
        }}
        prefillItem={prefillPlaqueItem}
      />

      <HistoryUploaderModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      <LastfmSyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        onOpenUpload={() => {
          setIsSyncOpen(false);
          setIsUploadOpen(true);
        }}
      />

      <CustomizationDrawer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />

      <DetailDrawer onAwardPlaque={handleAwardPlaque} />
      <ChartSettingsModal />
      <ChartItemEditorModal />
      <ArtistProfileModal
        artistName={activeArtistProfile}
        onClose={() => setActiveArtistProfile(null)}
        onAwardPlaque={handleAwardPlaque}
      />
      <MilestonesModal
        isOpen={isMilestonesOpen}
        onClose={() => setIsMilestonesOpen(false)}
        initialCategory={selectedMilestoneCategory}
        onAwardPlaque={handleAwardPlaque}
      />
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MusicProvider>
          <DashboardContent />
        </MusicProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

