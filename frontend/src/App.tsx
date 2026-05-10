import { useState } from "react";
import { Activity, Bell, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, HelpCircle, Layers, Settings, Sliders, BookOpen, GitBranch, PlugZap, Newspaper, CloudSun, Sprout, Menu, ZoomIn, ZoomOut } from "lucide-react";
import { BrowserRouter, Routes, Route, NavLink, Outlet, useNavigate, useLocation, Navigate } from "react-router-dom";

import { useFarmStream } from "./hooks/useFarmStream";
import { useResolveManager } from "./hooks/useResolveManager";
import type { useResolveManager as UseResolveManagerType } from "./hooks/useResolveManager";
import { COLORS } from "./utils/theme";
import { VoiceControl } from "./components/VoiceControl";
import { FloatingChatAssistant } from "./components/FloatingChatAssistant";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import DashboardPage from "./pages/DashboardPage";
import LayerDetailPage from "./pages/LayerDetailPage";
import ControlPage from "./pages/ControlPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import WhatIfPage from "./pages/WhatIfPage";
import YieldForecastPage from "./pages/YieldForecastPage";
import EnergyPage from "./pages/EnergyPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import ClimateShieldPage from "./pages/ClimateShieldPage";
import OperationsPage from "./pages/OperationsPage";
import { SettingsProvider } from "./contexts/SettingsContext";
import { SettingsModal } from "./components/SettingsModal";
import { usePersistentBoolean, usePersistentNumber } from "./hooks/usePersistentState";

export type FarmStreamContext = ReturnType<typeof useFarmStream> & {
  resolveManager: ReturnType<typeof UseResolveManagerType>;
};

function Layout() {
  const stream = useFarmStream();
  const resolveManager = useResolveManager(stream.farm.layers, stream.recommendations);
  const { farm, connected, sendCommand, executeSafeCommand } = stream;
  const navigate = useNavigate();
  const location = useLocation();

  const coreNavItems = [
    { path: "/", label: "Dashboard", icon: Activity },
    { path: "/whatif", label: "Simulator & Detector", icon: GitBranch },
    { path: "/alerts", label: "Alerts", icon: Bell },
    { path: "/control", label: "Control Panel", icon: Sliders },
    { path: "/yield", label: "Yield Forecast", icon: Sprout },
    { path: "/layers", label: "Layer Detail", icon: Layers },
  ];

  const advancedNavItems = [
    { path: "/operations", label: "Operations Timeline", icon: ClipboardList },
    { path: "/energy", label: "Energy Optimizer", icon: PlugZap },
    { path: "/climate", label: "Climate Shield", icon: CloudSun },
    { path: "/market", label: "Market Intel", icon: Newspaper },
    { path: "/settings", label: "Crop Recipe", icon: BookOpen },
  ];
  const navItems = [...coreNavItems, ...advancedNavItems];
  const [showAdvancedNav, setShowAdvancedNav] = usePersistentBoolean(
    "croptwin_show_advanced_nav_v2",
    advancedNavItems.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
  );

  const currentPage = navItems.find(
    (item) => item.path === location.pathname || (item.path !== "/" && location.pathname.startsWith(item.path))
  ) || navItems[0];

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tutorialSession, setTutorialSession] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentBoolean("croptwin_sidebar_collapsed", false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [mobileContentScale, setMobileContentScale] = usePersistentNumber("croptwin_mobile_content_scale", 0.85);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);
  const sidebarExpanded = !isSidebarCollapsed || isMobileSidebarOpen;
  const navLinkClassName = sidebarExpanded
    ? "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
    : "flex min-h-11 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
  const mobileScaleOptions = [0.75, 0.85, 1];
  const mobileScaleIndex = mobileScaleOptions.indexOf(mobileContentScale);
  const mobileScaleLabel = `${Math.round(mobileContentScale * 100)}%`;
  const decreaseMobileScale = () => setMobileContentScale(mobileScaleOptions[Math.max(0, mobileScaleIndex === -1 ? 1 : mobileScaleIndex - 1)]);
  const increaseMobileScale = () => setMobileContentScale(mobileScaleOptions[Math.min(mobileScaleOptions.length - 1, mobileScaleIndex === -1 ? 1 : mobileScaleIndex + 1)]);

  return (
    <div className="flex h-dvh overflow-hidden font-sans" style={{ backgroundColor: COLORS.appBg, color: COLORS.ink }}>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <OnboardingTutorial forceOpen={tutorialSession > 0} onClose={() => setTutorialSession(0)} />
      <FloatingChatAssistant layers={farm.layers} chat={stream.chat} />

      {isMobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={closeMobileSidebar}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex max-w-[86vw] flex-col transition-all duration-300 md:relative md:max-w-none md:translate-x-0 ${
          isMobileSidebarOpen ? "w-72 translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isSidebarCollapsed && !isMobileSidebarOpen ? "md:w-20" : "md:w-64"}`}
        style={{ background: "linear-gradient(to bottom, #00FF7F 0%, #228B22 100%)", borderRight: "1px solid rgba(0,100,0,0.3)" }}
      >
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((value) => !value)}
          className="absolute -right-4 top-5 z-50 hidden h-8 w-8 place-items-center rounded-full shadow-md transition-colors hover:opacity-90 md:grid"
          style={{ backgroundColor: "#EAF8EA", border: "1px solid rgba(34,139,34,0.35)", color: COLORS.ink }}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div
          className={`flex items-center gap-3 p-4 ${sidebarExpanded ? "justify-between" : "justify-center"}`}
          style={{ borderBottom: "1px solid rgba(34,139,34,0.25)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md shadow-sm"
              style={{ backgroundColor: COLORS.darkGreen }}
            >
              <img src="/croptwin-logo-new.png" alt="CropTwin AI logo" className="h-full w-full object-cover" />
            </span>
            {sidebarExpanded && (
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-normal" style={{ color: COLORS.ink }}>CropTwin AI</h1>
                <p className="truncate text-xs" style={{ color: "#2D4A2D" }}>Digital Twin Platform</p>
              </div>
            )}
          </div>
          {sidebarExpanded && (
            <button
              type="button"
              onClick={() => {
                if (isMobileSidebarOpen) {
                  closeMobileSidebar();
                  return;
                }
                setIsSidebarCollapsed((value) => !value);
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:opacity-80 md:hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.45)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
              title={isMobileSidebarOpen ? "Close sidebar" : "Collapse sidebar"}
              aria-label={isMobileSidebarOpen ? "Close sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <nav className={`flex-1 space-y-2 overflow-y-auto ${sidebarExpanded ? "p-4" : "p-3"}`}>
          <div className="space-y-1">
            {sidebarExpanded && <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-forest-green/80">Demo Flow</p>}
            {coreNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={closeMobileSidebar}
                className={navLinkClassName}
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: "#006400", color: "#FFFFFF", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }
                    : { color: COLORS.ink }
                }
                title={item.label}
              >
                <item.icon size={18} className="shrink-0" />
                {sidebarExpanded && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>

          <div className={`pt-2 ${sidebarExpanded ? "" : "hidden"}`}>
            <button
              onClick={() => setShowAdvancedNav((value) => !value)}
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{ color: COLORS.ink, backgroundColor: "rgba(255,255,255,0.22)" }}
            >
              <span className="truncate">Advanced Tools</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform ${showAdvancedNav ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showAdvancedNav && advancedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={closeMobileSidebar}
              className={navLinkClassName}
              style={({ isActive }) =>
                isActive
                  ? { backgroundColor: "#006400", color: "#FFFFFF", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }
                  : { color: COLORS.ink }
              }
              title={item.label}
            >
              <item.icon size={18} className="shrink-0" />
              {sidebarExpanded && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex min-h-[76px] items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-8"
          style={{ background: "linear-gradient(to right, #90EE90 0%, #A8F2A8 100%)", borderBottom: "1px solid rgba(34,139,34,0.2)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors hover:opacity-80 md:hidden"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest sm:text-xs" style={{ color: "#2D4A2D" }}>{farm.name}</p>
              <h2 className="truncate text-base font-semibold sm:text-lg md:text-xl" style={{ color: COLORS.ink }}>{currentPage.label}</h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            <div
              className="flex items-center rounded-lg"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
            >
              <button
                type="button"
                onClick={decreaseMobileScale}
                disabled={mobileContentScale <= mobileScaleOptions[0]}
                className="grid h-10 w-9 place-items-center rounded-l-lg transition-colors hover:opacity-80 disabled:opacity-35 md:hidden"
                title="Show more content"
                aria-label="Show more content"
              >
                <ZoomOut size={16} />
              </button>
              <span className="hidden min-w-10 text-center text-[10px] font-semibold sm:inline md:hidden">{mobileScaleLabel}</span>
              <button
                type="button"
                onClick={increaseMobileScale}
                disabled={mobileContentScale >= mobileScaleOptions[mobileScaleOptions.length - 1]}
                className="grid h-10 w-9 place-items-center rounded-r-lg transition-colors hover:opacity-80 disabled:opacity-35 md:hidden"
                title="Zoom in content"
                aria-label="Zoom in content"
              >
                <ZoomIn size={16} />
              </button>
            </div>

            <div
              className="hidden min-w-36 rounded-lg px-3 py-2 lg:block"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
              title={`${farm.layers.length} layers monitored`}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#2D4A2D" }}>Farm Health</span>
                <span className="text-sm font-bold" style={{ color: COLORS.forestGreen }}>{farm.average_health_score}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(0,100,0,0.15)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${farm.average_health_score}%`, background: "linear-gradient(to right, #228B22, #00FF7F)" }}
                />
              </div>
            </div>

            <VoiceControl onCommand={sendCommand} onSafeCommand={executeSafeCommand} onNavigate={(path) => navigate(path)} />

            <button
              onClick={() => setTutorialSession((value) => value + 1)}
              className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
              title="Help"
              aria-label="Open tutorial"
            >
              <HelpCircle size={18} />
            </button>

            <div
              className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium sm:flex"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: connected ? COLORS.forestGreen : "#C0392B" }}
              />
              <span className="hidden whitespace-nowrap md:inline">{connected ? "Live stream connected" : "Using local snapshot"}</span>
            </div>

            <button
              id="settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: COLORS.appBg }}>
          <div className="mx-auto w-full max-w-[1400px] p-3 sm:p-5 md:p-8">
            <div
              className="mobile-content-scale"
              style={{ "--mobile-content-scale": mobileContentScale } as React.CSSProperties}
            >
              <Outlet context={{ ...stream, resolveManager }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="layers" element={<LayerDetailPage />} />
            <Route path="whatif" element={<WhatIfPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="yield" element={<YieldForecastPage />} />
            <Route path="energy" element={<EnergyPage />} />
            <Route path="climate" element={<ClimateShieldPage />} />
            <Route path="nutrients" element={<Navigate to="/control" replace />} />
            <Route path="market" element={<MarketIntelPage />} />
            <Route path="control" element={<ControlPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
}
