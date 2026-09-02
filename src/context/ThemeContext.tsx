import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeConfig, ThemePresetId, WidgetConfig, WidgetType } from '../types/music';
import { safeLocalStorageGetJSON, safeLocalStorageSetJSON } from '../utils/safeStorage';

export const THEME_PRESETS: Record<ThemePresetId, ThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Executive Obsidian (Champagne Gold)',
    bgClass: 'bg-[#090a0f]',
    cardBg: 'bg-zinc-900/80',
    cardBorder: 'border-zinc-800/90',
    accentPrimary: '#f59e0b',
    accentSecondary: '#d97706',
    accentGradient: 'from-amber-400 via-amber-500 to-yellow-600',
    textMuted: 'text-zinc-400',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Vault (Forest Noir)',
    bgClass: 'bg-[#06120c]',
    cardBg: 'bg-[#0a1f15]/80',
    cardBorder: 'border-emerald-900/60',
    accentPrimary: '#10b981',
    accentSecondary: '#059669',
    accentGradient: 'from-emerald-400 via-teal-500 to-emerald-600',
    textMuted: 'text-emerald-200/70',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Midnight Titanium (Steel Blue)',
    bgClass: 'bg-[#070b14]',
    cardBg: 'bg-[#0c1424]/80',
    cardBorder: 'border-sky-900/60',
    accentPrimary: '#38bdf8',
    accentSecondary: '#0284c7',
    accentGradient: 'from-sky-400 via-blue-500 to-indigo-600',
    textMuted: 'text-slate-300/70',
  },
  sunset: {
    id: 'sunset',
    name: 'Champagne Rose (Velvet Bronze)',
    bgClass: 'bg-[#100a12]',
    cardBg: 'bg-[#1a101c]/80',
    cardBorder: 'border-pink-900/50',
    accentPrimary: '#f43f5e',
    accentSecondary: '#e11d48',
    accentGradient: 'from-rose-400 via-pink-500 to-amber-500',
    textMuted: 'text-rose-200/70',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Tokyo Neon Grid',
    bgClass: 'bg-[#050508]',
    cardBg: 'bg-zinc-950/90',
    cardBorder: 'border-cyan-500/40',
    accentPrimary: '#06b6d4',
    accentSecondary: '#ec4899',
    accentGradient: 'from-cyan-400 via-fuchsia-500 to-pink-500',
    textMuted: 'text-zinc-400',
  },
  ruby: {
    id: 'ruby',
    name: 'Royal Crimson Vinyl',
    bgClass: 'bg-[#120709]',
    cardBg: 'bg-[#1e0d11]/80',
    cardBorder: 'border-rose-900/60',
    accentPrimary: '#fb7185',
    accentSecondary: '#e11d48',
    accentGradient: 'from-rose-500 via-red-500 to-amber-600',
    textMuted: 'text-rose-200/70',
  },
};

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'top-charts', title: 'Top Charts & Discography', enabled: true, width: 'full' },
  { id: 'weekly-genre-charts', title: 'Weekly Genre Hot 5 Charts', enabled: true, width: 'full' },
  { id: 'plaque-wall', title: 'Commemorative Plaque Wall', enabled: true, width: 'full' },
  { id: 'track-combiner', title: 'Duplicate & Remaster Combiner', enabled: true, width: 'full' },
];

interface ThemeContextType {
  theme: ThemeConfig;
  setThemePreset: (presetId: ThemePresetId) => void;
  updateCustomTheme: (overrides: Partial<ThemeConfig>) => void;
  widgets: WidgetConfig[];
  toggleWidget: (widgetId: WidgetType) => void;
  reorderWidget: (widgetId: WidgetType, direction: 'up' | 'down') => void;
  setWidgetWidth: (widgetId: WidgetType, width: 'full' | 'half') => void;
  resetLayout: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    return safeLocalStorageGetJSON<ThemeConfig>('groovevault_theme', THEME_PRESETS.obsidian);
  });

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const parsed = safeLocalStorageGetJSON<WidgetConfig[]>('groovevault_widgets', DEFAULT_WIDGETS);
    if (Array.isArray(parsed)) {
      const validIds = new Set(['top-charts', 'weekly-genre-charts', 'plaque-wall', 'track-combiner']);
      const filtered = parsed.filter((w) => validIds.has(w.id));
      if (!filtered.some((w) => w.id === 'weekly-genre-charts')) {
        filtered.splice(1, 0, {
          id: 'weekly-genre-charts',
          title: 'Weekly Genre Hot 5 Charts',
          enabled: true,
          width: 'full',
        });
      }
      if (filtered.length > 0) return filtered;
    }
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    safeLocalStorageSetJSON('groovevault_theme', theme);
  }, [theme]);

  useEffect(() => {
    safeLocalStorageSetJSON('groovevault_widgets', widgets);
  }, [widgets]);

  const setThemePreset = (presetId: ThemePresetId) => {
    if (THEME_PRESETS[presetId]) {
      setTheme(THEME_PRESETS[presetId]);
    }
  };

  const updateCustomTheme = (overrides: Partial<ThemeConfig>) => {
    setTheme((prev) => ({
      ...prev,
      ...overrides,
      id: 'custom',
      name: 'Custom Palette',
    }));
  };

  const toggleWidget = (widgetId: WidgetType) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const reorderWidget = (widgetId: WidgetType, direction: 'up' | 'down') => {
    setWidgets((prev) => {
      const idx = prev.findIndex((w) => w.id === widgetId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
  };

  const setWidgetWidth = (widgetId: WidgetType, width: 'full' | 'half') => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, width } : w))
    );
  };

  const resetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setThemePreset,
        updateCustomTheme,
        widgets,
        toggleWidget,
        reorderWidget,
        setWidgetWidth,
        resetLayout,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
