import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useTheme } from '../context/ThemeContext';
import {
  BarChart3,
  Trophy,
  Award,
  Radio,
  User,
  Cloud,
  Layers,
  Sparkles,
  Disc3,
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenCharts: () => void;
  onOpenMilestones: () => void;
  onOpenPlaques: () => void;
  onOpenSync: () => void;
  onOpenAccount: () => void;
  activeSection?: 'charts' | 'milestones' | 'plaques' | 'sync' | 'account';
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenCharts,
  onOpenMilestones,
  onOpenPlaques,
  onOpenSync,
  onOpenAccount,
  activeSection = 'charts',
}) => {
  const { user } = useAuth();
  const { isCloudSyncing, syncProgress, allProcessedScrobbles, plaques } = useMusic();
  const { theme } = useTheme();

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Tab 1: Charts */}
        <button
          type="button"
          onClick={onOpenCharts}
          id="mobile-tab-charts"
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-[44px] rounded-2xl transition-all active:scale-95 cursor-pointer text-zinc-400 hover:text-cyan-400"
        >
          <div className="relative">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span className="sr-only">Charts</span>
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 text-zinc-200">
            Charts
          </span>
        </button>

        {/* Tab 2: Milestones (#1s & Records) */}
        <button
          type="button"
          onClick={onOpenMilestones}
          id="mobile-tab-milestones"
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-[44px] rounded-2xl transition-all active:scale-95 cursor-pointer text-zinc-400 hover:text-amber-400"
        >
          <div className="relative">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 text-zinc-200">
            #1s &amp; Recs
          </span>
        </button>

        {/* Tab 3: Plaque Wall & Forge */}
        <button
          type="button"
          onClick={onOpenPlaques}
          id="mobile-tab-plaques"
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-[44px] rounded-2xl transition-all active:scale-95 cursor-pointer text-zinc-400 hover:text-yellow-400"
        >
          <div className="relative">
            <Award className="w-5 h-5 text-yellow-400" />
            {plaques.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1 rounded-full bg-yellow-950 text-yellow-300 border border-yellow-500/60 text-[8px] font-mono font-black">
                {plaques.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 text-zinc-200">
            Plaques
          </span>
        </button>

        {/* Tab 4: Last.fm Sync */}
        <button
          type="button"
          onClick={onOpenSync}
          id="mobile-tab-sync"
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-[44px] rounded-2xl transition-all active:scale-95 cursor-pointer text-zinc-400 hover:text-red-400"
        >
          <div className="relative">
            <Radio
              className={`w-5 h-5 text-red-400 ${
                syncProgress?.isSyncing ? 'animate-spin text-red-300' : ''
              }`}
            />
            {syncProgress?.isSyncing && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400 animate-ping" />
            )}
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 text-zinc-200">
            {syncProgress?.isSyncing ? 'Syncing' : 'Last.fm'}
          </span>
        </button>

        {/* Tab 5: Account & Cloud */}
        <button
          type="button"
          onClick={onOpenAccount}
          id="mobile-tab-account"
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 min-h-[44px] rounded-2xl transition-all active:scale-95 cursor-pointer text-zinc-400 hover:text-purple-400"
        >
          <div className="relative">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Account"
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover border border-purple-500"
              />
            ) : (
              <Cloud className="w-5 h-5 text-purple-400" />
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-950 ${
                isCloudSyncing
                  ? 'bg-amber-400 animate-ping'
                  : user
                  ? 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
            />
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 text-zinc-200">
            Account
          </span>
        </button>
      </div>
    </nav>
  );
};
