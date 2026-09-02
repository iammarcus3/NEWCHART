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
import { CloudSyncGateway } from './components/CloudSyncGateway';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PlaqueCertification, SubjectType, WidgetType } from './types/music';
import { ErrorBoundary } from './components/ErrorBoundary';
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

  // Navigation View: 'gateway' (Cloud Sync / Login screen) vs 'dashboard' (Charts & Analytics)
  const [currentView, setCurrentView] = useState<'gateway' | 'dashboard'>('gateway');

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
      {currentView === 'gateway' ? (
        /* Starting View: Cloud Sync Login & Music Vault Gateway */
        <CloudSyncGateway
          onEnterCharts={() => setCurrentView('dashboard')}
          onOpenUpload={() => setIsUploadOpen(true)}
          onOpenLastfmModal={() => setIsSyncOpen(true)}
        />
      ) : (
        /* Main Charts & Analytics Dashboard View */
        <>
          {/* Top Navigation */}
          <Navbar
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenSync={() => setIsSyncOpen(true)}
            onOpenAccount={() => setIsAccountOpen(true)}
            onOpenCloudSyncProcess={() => setIsCloudSyncProcessOpen(true)}
            onOpenGateway={() => setCurrentView('gateway')}
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
          <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8 space-y-4 sm:space-y-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {widgets
                .filter((w) => w.enabled)
                .map((widget) => (
                  <div
                    key={widget.id}
                    className={widget.width === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'}
                  >
                    <ErrorBoundary fallbackTitle={`Widget "${widget.title}" encountered an error`}>
                      {renderWidget(widget.id)}
                    </ErrorBoundary>
                  </div>
                ))}
            </div>
          </main>

          {/* Mobile Bottom Docked Navigation */}
          <MobileBottomNav
            onOpenCharts={() => {
              const el = document.getElementById('top-charts-widget');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            onOpenMilestones={() => openMilestonesWithCategory('all_1s')}
            onOpenPlaques={() => {
              const el = document.getElementById('plaque-wall-widget');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              } else {
                setPrefillPlaqueItem(null);
                setIsPlaqueCreatorOpen(true);
              }
            }}
            onOpenSync={() => setIsSyncOpen(true)}
            onOpenAccount={() => setIsAccountOpen(true)}
          />
        </>
      )}

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

