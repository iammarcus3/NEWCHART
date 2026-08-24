import React from 'react';
import { useMusic } from '../../context/MusicContext';
import { useTheme } from '../../context/ThemeContext';
import { PlaqueCard } from '../PlaqueCard';
import { PlaqueCertification } from '../../types/music';
import { Award, Plus, Sparkles, ShieldCheck } from 'lucide-react';

interface PlaqueWallWidgetProps {
  onOpenPlaqueDetail: (plaque: PlaqueCertification) => void;
  onOpenPlaqueCreator: () => void;
}

export const PlaqueWallWidget: React.FC<PlaqueWallWidgetProps> = ({
  onOpenPlaqueDetail,
  onOpenPlaqueCreator,
}) => {
  const { plaques } = useMusic();
  const { theme } = useTheme();

  return (
    <div
      id="plaque-wall-widget"
      className={`rounded-3xl p-6 ${theme.cardBg} border ${theme.cardBorder} shadow-xl space-y-6 relative overflow-hidden`}
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-sm`}>
              <Award className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Commemorative Plaque Wall
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Physical-style metallic certification frames celebrating your personal listening milestones
          </p>
        </div>

        <button
          onClick={onOpenPlaqueCreator}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 transition-all`}
        >
          <Plus className="w-4 h-4" />
          <span>Forge New Plaque</span>
        </button>
      </div>

      {/* Plaques Bento Grid */}
      {plaques.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 space-y-3">
          <Award className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-white">No Certification Plaques Forged Yet</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Surpass 50, 100, or 500 plays on your favorite songs or artists to forge an official Gold, Platinum, or Diamond virtual record frame.
          </p>
          <button
            onClick={onOpenPlaqueCreator}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-all mt-2"
          >
            Create Your First Plaque
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plaques.map((plaque) => (
            <PlaqueCard
              key={plaque.id}
              plaque={plaque}
              onClick={() => onOpenPlaqueDetail(plaque)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
