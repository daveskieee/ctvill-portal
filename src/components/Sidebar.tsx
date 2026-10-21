import React, { useState, useMemo } from 'react';
import { UserSession } from '../types';
import { getSidebarSections } from '../config/navigation';
import { UserRole, normalizeRole } from '../utils/rbac';
import { getStoredSession } from '../utils/session';
import { ChevronDown, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  user?: UserSession | null;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
  rfisCount?: number;
  changeOrdersCount?: number;
  quotationsCount?: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  isSidebarOpen = true,
  isMobile = false,
  rfisCount = 0,
  changeOrdersCount = 0,
  quotationsCount = 0,
  onLogout,
}) => {
  // Collapsed sections tracker with persistent localStorage
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('ctvill_collapsed_sidebar_sections');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const updated = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem('ctvill_collapsed_sidebar_sections', JSON.stringify(updated));
      } catch { /* silent */ }
      return updated;
    });
  };

  // Step 2: Prevent Sidebar Collapse During Session Revalidation
  // If user prop is not yet passed or in flight, fallback synchronously to cached session
  const effectiveUser = user || getStoredSession();
  const rawRole = effectiveUser?.role;
  // If user exists in state or local storage, render full navigation menu for their active role immediately.
  // Never default to UNAUTHORIZED during background revalidation if session was active.
  const currentRole: UserRole = rawRole ? normalizeRole(rawRole) : UserRole.OM;
  const isTimekeeper = currentRole === UserRole.TIMEKEEPER;
  const isFinance = currentRole === UserRole.FINANCE;
  const isProjectManager = currentRole === UserRole.PM;

  const profileName = effectiveUser?.name || 'Administrator';
  const profileTitle = effectiveUser?.title || (
    isTimekeeper ? 'Site Timekeeper' :
    isFinance ? 'Finance Officer' :
    isProjectManager ? 'Project Manager' :
    'Operations Manager'
  );
  const avatarUrl = effectiveUser?.avatarUrl;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Static, immediately rendered navigation items without waiting for API calls
  const sidebarSections = useMemo(() => {
    return getSidebarSections(currentRole, {
      rfis: rfisCount,
      changeOrders: changeOrdersCount,
      quotations: quotationsCount,
    });
  }, [currentRole, rfisCount, changeOrdersCount, quotationsCount]);

  // Theme Hook for Light/Dark Mode Ergonomics
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <aside
      className={`
        ${isDark ? 'bg-slate-950 border-r border-slate-800' : 'bg-white border-r border-slate-200 shadow-sm'}
        flex flex-col justify-between shrink-0 select-none z-40
        transition-all duration-300 ease-in-out
        ${isMobile
          ? `fixed inset-y-0 left-0 top-0 h-full ${isSidebarOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full w-72'}`
          : `relative ${isSidebarOpen ? 'w-64' : 'w-16'}`
        }
      `}
      style={isMobile ? { paddingTop: '60px' } : undefined}
      aria-label="Main Navigation Sidebar"
    >
      {/* Sidebar Navigation Items - Static, Permanent, No Skeletons */}
      <div className={`flex-1 overflow-y-auto py-3 px-2 space-y-3 scrollbar-thin ${isDark ? 'scrollbar-thumb-slate-800' : 'scrollbar-thumb-slate-300'}`}>
        {sidebarSections.map((section) => {
          const isSectionActive = section.items.some(it => it.id === activeTab);
          const isCollapsed = !isSectionActive && !!collapsedSections[section.id];
          let totalSectionBadges = 0;
          (section.items as any[]).forEach((it: any) => {
            if (it.badge) {
              totalSectionBadges += parseInt(String(it.badge), 10) || 1;
            }
          });

          return (
            <div key={section.id} className="space-y-1">
              {isSidebarOpen ? (
                <button
                  type="button"
                  onClick={() => toggleSectionCollapse(section.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider uppercase rounded-lg transition-colors group cursor-pointer ${
                    isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {(section as any).step && (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                        isDark
                          ? 'bg-slate-800/90 text-amber-400/90 border-slate-700/60'
                          : 'bg-slate-100 text-amber-700 border-slate-200'
                      }`}>
                        {(section as any).step}
                      </span>
                    )}
                    <span className="truncate">{section.title}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCollapsed && totalSectionBadges > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold border ${
                        isDark
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        {totalSectionBadges}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-600'
                      } ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                    />
                  </div>
                </button>
              ) : (
                <div className={`h-px my-2 mx-2 ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
              )}

              {/* Section Items */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(item.id);
                        }}
                        title={!isSidebarOpen ? item.label : undefined}
                        className={`
                          relative w-full flex items-center gap-2.5 rounded-xl transition-all duration-150 cursor-pointer text-left
                          ${isSidebarOpen ? 'px-3 py-2 text-xs' : 'px-0 py-2.5 justify-center'}
                          ${isActive
                            ? isDark
                              ? 'bg-amber-500/12 text-amber-300 font-semibold border border-amber-500/30 shadow-xs'
                              : 'bg-slate-900 text-white font-medium shadow-sm border border-slate-900'
                            : isDark
                              ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70 border border-transparent'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent transition-colors'
                          }
                        `}
                      >
                        {/* Active Accent Indicator Bar - Dark Mode only */}
                        {isActive && isSidebarOpen && isDark && (
                          <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full shadow-sm bg-amber-400 shadow-amber-400/50" />
                        )}

                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? isDark ? 'text-amber-400' : 'text-white'
                              : isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-500 group-hover:text-slate-800'
                          }`}
                        />

                        {isSidebarOpen && (
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className="truncate">{item.label}</span>
                            {(item as any).badge && (
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ml-1.5 border ${
                                  isActive
                                    ? isDark
                                      ? 'bg-amber-500/25 text-amber-200 border-amber-500/40'
                                      : 'bg-slate-800 text-slate-200 border-slate-700'
                                    : isDark
                                      ? 'bg-slate-800 text-slate-300 border-slate-700/60'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {(item as any).badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Sidebar User Profile Card */}
      <div className={`border-t ${
        isDark ? 'border-slate-800/80 bg-slate-950/80' : 'border-slate-200 bg-slate-50/70'
      } ${isSidebarOpen ? 'p-3' : 'p-2'}`}>
        <div
          onClick={() => onSelectTab('account-settings')}
          className={`flex items-center gap-2.5 rounded-xl transition-colors cursor-pointer ${
            isSidebarOpen ? 'p-1.5' : 'justify-center p-1'
          } ${
            isDark ? 'hover:bg-slate-900' : 'hover:bg-slate-100'
          } ${activeTab === 'account-settings' ? 'ring-1 ring-amber-500/40' : ''}`}
          title="Open Account Settings"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-md shadow-amber-500/20 overflow-hidden border border-amber-500/40">
            {avatarUrl ? (
              <img src={avatarUrl} alt={profileName} className="w-full h-full object-cover" />
            ) : (
              <span>{getInitials(profileName)}</span>
            )}
          </div>
          {isSidebarOpen && (
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {profileName}
              </div>
              <div className={`text-[10px] font-mono truncate ${isDark ? 'text-amber-400' : 'text-amber-700 font-semibold'}`}>
                {profileTitle}
              </div>
            </div>
          )}
          {isSidebarOpen && onLogout && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Sign Out"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );

};

export default Sidebar;
