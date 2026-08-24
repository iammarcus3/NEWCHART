import React from 'react';
import { useTheme, THEME_PRESETS } from '../context/ThemeContext';
import { ThemePresetId, WidgetType } from '../types/music';
import {
  X,
  Sliders,
  Palette,
  LayoutGrid,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface CustomizationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizationDrawer: React.FC<CustomizationDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    theme,
    setThemePreset,
    updateCustomTheme,
    widgets,
    toggleWidget,
    reorderWidget,
    setWidgetWidth,
    resetLayout,
  } = useTheme();

  if (!isOpen) return null;

  const presetList: { id: ThemePresetId; label: string; primary: string; secondary: string }[] = [
    { id: 'obsidian', label: 'Studio Obsidian (Gold)', primary: '#eab308', secondary: '#ca8a04' },
    { id: 'emerald', label: 'Emerald Velvet', primary: '#10b981', secondary: '#059669' },
    { id: 'sunset', label: 'Sunset Neon Synth', primary: '#ec4899', secondary: '#f43f5e' },
    { id: 'sapphire', label: 'Royal Sapphire', primary: '#38bdf8', secondary: '#0284c7' },
    { id: 'cyberpunk', label: 'Cyberpunk Tokyo', primary: '#06b6d4', secondary: '#ec4899' },
    { id: 'ruby', label: 'Ruby Crimson Vinyl', primary: '#f43f5e', secondary: '#be123c' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div
        id="customization-drawer"
        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl h-full flex flex-col justify-between p-6 overflow-y-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${theme.accentGradient} text-white shadow-sm`}>
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">
                Studio Customization
              </h2>
              <p className="text-[11px] text-zinc-400">
                Endless color themes & dashboard widget arrangement
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Color Themes */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Audiophile Color Presets</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {presetList.map((p) => (
              <button
                key={p.id}
                onClick={() => setThemePreset(p.id)}
                className={`p-3 rounded-2xl border text-left transition-all space-y-1.5 ${
                  theme.id === p.id
                    ? 'bg-zinc-800 border-zinc-600 shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.primary }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.secondary }} />
                </div>
                <span className="text-xs font-bold text-white block truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Custom Accent Wheel */}
        <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <label className="text-xs font-bold text-zinc-300 block">Custom Hex Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={theme.accentPrimary}
              onChange={(e) =>
                updateCustomTheme({
                  accentPrimary: e.target.value,
                  accentGradient: `from-[${e.target.value}] to-zinc-900`,
                })
              }
              className="w-10 h-10 rounded-xl bg-transparent border-0 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-zinc-300">
              {theme.accentPrimary}
            </span>
          </div>
        </div>

        {/* Section 3: Widget Reordering & Visibility */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span>Dashboard Widgets</span>
            </div>

            <button
              onClick={resetLayout}
              className="text-[11px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="space-y-2">
            {widgets.map((widget, idx) => (
              <div
                key={widget.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                  widget.enabled
                    ? 'bg-zinc-900/80 border-zinc-800'
                    : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => toggleWidget(widget.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    {widget.enabled ? (
                      <Eye className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-zinc-600" />
                    )}
                  </button>
                  <span className="text-xs font-bold text-white truncate">{widget.title}</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Width toggle */}
                  <button
                    onClick={() => setWidgetWidth(widget.id, widget.width === 'full' ? 'half' : 'full')}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-mono font-bold"
                    title={`Width: ${widget.width}`}
                  >
                    {widget.width === 'full' ? '100%' : '50%'}
                  </button>

                  {/* Move Up */}
                  <button
                    onClick={() => reorderWidget(widget.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    onClick={() => reorderWidget(widget.id, 'down')}
                    disabled={idx === widgets.length - 1}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-xs font-black bg-gradient-to-r ${theme.accentGradient} text-white shadow-lg hover:brightness-110 transition-all`}
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
