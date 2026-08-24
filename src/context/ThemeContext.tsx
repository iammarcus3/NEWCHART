import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeConfig, ThemePresetId, WidgetConfig, WidgetType } from '../types/music';

export const THEME_PRESETS: Record<ThemePresetId, ThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Studio Obsidian (Dark Gold)',
    bgClass: 'bg-zinc-950',
    cardBg: 'bg-zinc-900/70',
    cardBorder: 'border-zinc-800/80',
    accentPrimary: '#eab308',
    accentSecondary: '#ca8a04',
    accentGradient: 'from-amber-400 via-yellow-500 to-amber-600',
    textMuted: 'text-zinc-400',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Velvet Lounge',
    bgClass: 'bg-[#06140e]',
    cardBg: 'bg-emerald-950/40',
    cardBorder: 'border-emerald-800/40',
    accentPrimary: '#10b981',
    accentSecondary: '#059669',
    accentGradient: 'from-emerald-400 via-teal-500 to-emerald-600',
    textMuted: 'text-emerald-300/70',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Neon Synth',
    bgClass: 'bg-[#120a1c]',
    cardBg: 'bg-purple-950/40',
    cardBorder: 'border-purple-800/40',
    accentPrimary: '#ec4899',
    accentSecondary: '#f43f5e',
    accentGradient: 'from-pink-500 via-rose-500 to-orange-500',
    textMuted: 'text-purple-300/70',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Royal Sapphire Audiophile',
    bgClass: 'bg-[#081020]',
    cardBg: 'bg-sky-950/40',
    cardBorder: 'border-sky-800/40',
    accentPrimary: '#38bdf8',
    accentSecondary: '#0284c7',
    accentGradient: 'from-cyan-400 via-sky-500 to-blue-600',
    textMuted: 'text-sky-300/70',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Tokyo',
    bgClass: 'bg-black',
    cardBg: 'bg-zinc-950',
    cardBorder: 'border-cyan-500/30',
    accentPrimary: '#06b6d4',
    accentSecondary: '#ec4899',
    accentGradient: 'from-cyan-400 via-fuchsia-500 to-pink-500',
    textMuted: 'text-zinc-400',
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby Crimson Vinyl',
    bgClass: 'bg-[#18090b]',
    cardBg: 'bg-rose-950/40',
    cardBorder: 'border-rose-800/40',
    accentPrimary: '#f43f5e',
    accentSecondary: '#be123c',
    accentGradient: 'from-rose-500 via-red-500 to-amber-600',
    textMuted: 'text-rose-300/70',
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
    const saved = localStorage.getItem('groovevault_theme');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return THEME_PRESETS.obsidian;
  });

  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem('groovevault_widgets');
    if (saved) {
      try {
        const parsed: WidgetConfig[] = JSON.parse(saved);
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
      } catch (e) {}
    }
    return DEFAULT_WIDGETS;
  });

  useEffect(() => {
    localStorage.setItem('groovevault_theme', JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('groovevault_widgets', JSON.stringify(widgets));
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
