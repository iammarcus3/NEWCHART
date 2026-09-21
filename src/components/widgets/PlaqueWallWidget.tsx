import React, { useMemo } from 'react';
import { useMusic } from '../../context/MusicContext';
import { useTheme } from '../../context/ThemeContext';
import {
  computeAutomaticCertifications,
  toPlaqueCertification,
} from '../../utils/automaticCertificationsEngine';
import { CertificationPlaqueCard } from '../CertificationPlaqueCard';
import { PlaqueCertification } from '../../types/music';
import { Award, ArrowRight, ShieldCheck, Sparkles, Disc, Music } from 'lucide-react';

interface PlaqueWallWidgetProps {
  onOpenPlaqueDetail: (plaque: PlaqueCertification) => void;
  onOpenCertificationsPage?: () => void;
  onSelectArtist?: (artist: string) => void;
}

export const PlaqueWallWidget: React.FC<PlaqueWallWidgetProps> = ({
  onOpenPlaqueDetail,
  onOpenCertificationsPage,
  onSelectArtist,
}) => {
  const { allProcessedScrobbles, zeroSettings } = useMusic();
  const { theme } = useTheme();

  // Compute automatic certifications
  const certSummary = useMemo(() => {
    return computeAutomaticCertifications(allProcessedScrobbles, zeroSettings);
  }, [allProcessedScrobbles, zeroSettings]);

  // Show top recent 6 automatic plaques for the dashboard preview
  const recentPlaques = useMemo(() => {
    return certSummary.allPlaques.slice(0, 6);
  }, [certSummary]);

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
              Official Certifications Archive
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
              {certSummary.totalCertifications} Awarded
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Automatic gold, platinum, and diamond plaques grouped chronologically by year and month
          </p>
        </div>

        {onOpenCertificationsPage && (
          <button
            onClick={onOpenCertificationsPage}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 transition-all cursor-pointer`}
          >
            <span>View Full Archive</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Plaques Bento Grid */}
      {recentPlaques.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-zinc-800 space-y-3">
          <Award className="w-10 h-10 text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-white">No Automatic Certifications Yet</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Songs reach Gold at 500,000 units (10 plays) and Platinum at 1,000,000 units (20 plays). Keep listening to automatically unlock official commemorative plaques!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentPlaques.map((cert) => (
              <CertificationPlaqueCard
                key={cert.id}
                cert={cert}
                onClick={() => onOpenPlaqueDetail(toPlaqueCertification(cert))}
                onSelectArtist={onSelectArtist}
              />
            ))}
          </div>

          {certSummary.allPlaques.length > 6 && onOpenCertificationsPage && (
            <div className="pt-2 text-center">
              <button
                onClick={onOpenCertificationsPage}
                className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <span>View all {certSummary.totalCertifications} plaques grouped by year &amp; month &rarr;</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
