import { Activity, Bell, Layers, MessageSquare, Settings, Sliders, Leaf, BookOpen, GitBranch, PlugZap, Newspaper, FlaskConical, CloudSun } from "lucide-react";
import { BrowserRouter, Routes, Route, NavLink, Outlet, useOutletContext, useNavigate, useLocation } from "react-router-dom";

import { useFarmStream } from "./hooks/useFarmStream";
import { useResolveManager } from "./hooks/useResolveManager";
import type { useResolveManager as UseResolveManagerType } from "./hooks/useResolveManager";
import { VoiceControl } from "./components/VoiceControl";
import DashboardPage from "./pages/DashboardPage";
import LayerDetailPage from "./pages/LayerDetailPage";
import ControlPage from "./pages/ControlPage";
import AlertsPage from "./pages/AlertsPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import WhatIfPage from "./pages/WhatIfPage";
import EnergyPage from "./pages/EnergyPage";
import MarketIntelPage from "./pages/MarketIntelPage";
import NutrientPage from "./pages/NutrientPage";
import ClimateShieldPage from "./pages/ClimateShieldPage";

export type FarmStreamContext = ReturnType<typeof useFarmStream> & {
  resolveManager: ReturnType<typeof UseResolveManagerType>;
};

/* ── Exact Structural Colors ──────────────────────── */
const COLORS = {
  springGreen: "#00FF7F",   // Sidebar
  lightGreen:  "#90EE90",   // Header
  forestGreen: "#228B22",   // Active nav item
  darkGreen:   "#145A32",   // Logo badge
  appBg:       "#F0F7F0",   // Main content
  ink:         "#000000",   // All text
} as const;

function Layout() {
  const stream = useFarmStream();
  const resolveManager = useResolveManager(stream.farm.layers, stream.recommendations);
  const { farm, connected, sendCommand, executeSafeCommand } = stream;
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: Activity },
    { path: "/layers", label: "Layer Detail", icon: Layers },
    { path: "/whatif", label: "What-If", icon: GitBranch },
    { path: "/energy", label: "Energy Optimizer", icon: PlugZap },
    { path: "/climate", label: "Climate Shield", icon: CloudSun },
    { path: "/nutrients", label: "Nutrient Intel", icon: FlaskConical },
    { path: "/market", label: "Market Intel", icon: Newspaper },
    { path: "/control", label: "Control Panel", icon: Sliders },
    { path: "/alerts", label: "Alerts & Recs", icon: Bell },
    { path: "/chat", label: "Chat Assistant", icon: MessageSquare },
    { path: "/settings", label: "Crop Recipe", icon: BookOpen },
  ];

  // Current page title
  const currentPage = navItems.find(
    (item) => item.path === location.pathname || (item.path !== "/" && location.pathname.startsWith(item.path))
  ) || navItems[0];

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ backgroundColor: COLORS.appBg, color: COLORS.ink }}>

      {/* ── Sidebar — gradient SpringGreen → ForestGreen ── */}
      <aside
        className="flex w-64 flex-col"
        style={{ background: "linear-gradient(to bottom, #00FF7F 0%, #228B22 100%)", borderRight: "1px solid rgba(0,100,0,0.3)" }}
      >

        {/* Logo block */}
        <div
          className="flex items-center gap-3 p-6"
          style={{ borderBottom: "1px solid rgba(34,139,34,0.25)" }}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md"
            style={{ backgroundColor: COLORS.darkGreen, color: "#FFFFFF" }}
          >
            <Leaf size={21} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-normal" style={{ color: COLORS.ink }}>CropTwin AI</h1>
            <p className="text-xs" style={{ color: "#2D4A2D" }}>Digital Twin Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={({ isActive }) =>
                isActive
                  ? { backgroundColor: "#006400", color: "#FFFFFF", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }
                  : { color: COLORS.ink }
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Health indicator at bottom — new feature from baosheng, restyled */}
        <div
          className="mx-3 mb-4 rounded-xl p-4"
          style={{ backgroundColor: "rgba(255,255,255,0.35)", border: "1px solid rgba(34,139,34,0.3)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#2D4A2D" }}>Farm Health</span>
            <span className="text-lg font-bold" style={{ color: COLORS.forestGreen }}>{farm.average_health_score}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,100,0,0.15)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${farm.average_health_score}%`, background: "linear-gradient(to right, #228B22, #00FF7F)" }}
            />
          </div>
          <p className="mt-2 text-xs" style={{ color: "#2D4A2D" }}>{farm.layers.length} layers monitored</p>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header — gradient LightGreen → soft mint */}
        <header
          className="flex items-center justify-between px-8 py-4"
          style={{ background: "linear-gradient(to right, #90EE90 0%, #A8F2A8 100%)", borderBottom: "1px solid rgba(34,139,34,0.2)" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#2D4A2D" }}>{farm.name}</p>
            <h2 className="text-xl font-semibold" style={{ color: COLORS.ink }}>{currentPage.label}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Voice control — new feature from baosheng */}
            <VoiceControl onCommand={sendCommand} onSafeCommand={executeSafeCommand} onNavigate={(path) => navigate(path)} />

            {/* Live stream badge */}
            <div
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: connected ? COLORS.forestGreen : "#C0392B" }}
              />
              {connected ? "Live stream connected" : "Using local snapshot"}
            </div>

            {/* Settings icon */}
            <button
              id="settings-btn"
              className="grid h-9 w-9 place-items-center rounded-lg transition-colors hover:opacity-80"
              style={{ backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: COLORS.ink }}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: COLORS.appBg }}>
          <div className="mx-auto max-w-[1400px] p-8">
            <Outlet context={{ ...stream, resolveManager }} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="layers" element={<LayerDetailPage />} />
          <Route path="whatif" element={<WhatIfPage />} />
          <Route path="energy" element={<EnergyPage />} />
          <Route path="climate" element={<ClimateShieldPage />} />
          <Route path="nutrients" element={<NutrientPage />} />
          <Route path="market" element={<MarketIntelPage />} />
          <Route path="control" element={<ControlPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
