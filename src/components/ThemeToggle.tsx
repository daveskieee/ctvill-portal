import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Sparkles, Check, ChevronDown } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className = '' }) => {
  const { theme, resolvedTheme, isDark, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const options: Array<{
    id: ThemeMode;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    badge?: string;
  }> = [
    {
      id: 'light',
      label: 'Light',
      sublabel: 'Daylight Surface (#F5F6F8)',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark',
      sublabel: 'Carbon Slate (#111625)',
      icon: Moon,
    },
    {
      id: 'night',
      label: 'Night (Obsidian)',
      sublabel: 'True Obsidian (#0A0A0C)',
      icon: Sparkles,
      badge: 'Deep',
    },
    {
      id: 'system',
      label: 'System default',
      sublabel: 'Matches OS appearance',
      icon: Laptop,
    },
  ];

  const getTriggerIcon = () => {
    if (theme === 'system') return Laptop;
    if (resolvedTheme === 'light') return Sun;
    if (resolvedTheme === 'night') return Sparkles;
    return Moon;
  };

  const TriggerIcon = getTriggerIcon();

  return (
    <div className={`relative inline-block text-left ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Appearance: ${theme} (Click to change)`}
        aria-label="Select Color Theme"
        aria-expanded={isOpen}
        className={`relative inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer select-none ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 hover:bg-slate-800/80 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 shadow-xs'
        } ${isOpen ? 'ring-2 ring-amber-500/30 border-amber-500/60' : ''}`}
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
          <TriggerIcon
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              resolvedTheme === 'light'
                ? 'text-amber-500'
                : resolvedTheme === 'night'
                ? 'text-purple-400'
                : 'text-blue-400'
            }`}
          />
        </div>
        {showLabel && (
          <span className="font-medium text-xs capitalize">
            {theme === 'night' ? 'Night' : theme === 'system' ? 'System' : resolvedTheme === 'light' ? 'Light' : 'Dark'}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* monday.com-Style Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-200 shadow-black/60'
              : 'bg-white border-slate-200 text-slate-800 shadow-slate-900/10'
          }`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/40 mb-1">
            Interface Theme
          </div>

          <div className="space-y-0.5">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isSelected
                      ? isDark
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-amber-50 text-amber-900 border border-amber-300'
                      : isDark
                      ? 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        opt.id === 'light'
                          ? 'bg-amber-500/10 text-amber-500'
                          : opt.id === 'night'
                          ? 'bg-purple-500/10 text-purple-400'
                          : opt.id === 'dark'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs leading-none">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] opacity-60 block mt-0.5 font-mono">{opt.sublabel}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
