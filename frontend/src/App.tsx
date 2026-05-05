import { Activity, Bell, Layers, MessageSquare, Settings, Sliders, Leaf, GitBranch, Mic } from "lucide-react";
import { BrowserRouter, Routes, Route, NavLink, Outlet, useOutletContext, useNavigate, useLocation } from "react-router-dom";

import { useFarmStream } from "./hooks/useFarmStream";
import { VoiceControl } from "./components/VoiceControl";
import DashboardPage from "./pages/DashboardPage";
import LayerDetailPage from "./pages/LayerDetailPage";
import ControlPage from "./pages/ControlPage";
import AlertsPage from "./pages/AlertsPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import WhatIfPage from "./pages/WhatIfPage";

export type FarmStreamContext = ReturnType<typeof useFarmStream>;

function Layout() {
  const stream = useFarmStream();
  const { farm, connected, sendCommand } = stream;
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Overview", icon: Activity },
    { path: "/layers", label: "Layers", icon: Layers },
    { path: "/whatif", label: "What-If", icon: GitBranch },
    { path: "/control", label: "Control", icon: Sliders },
    { path: "/alerts", label: "Alerts", icon: Bell },
    { path: "/chat", label: "Assistant", icon: MessageSquare },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  // Current page title
  const currentPage = navItems.find(
    (item) => item.path === location.pathname || (item.path !== "/" && location.pathname.startsWith(item.path))
  ) || navItems[0];

  return (
    <div className="flex h-screen overflow-hidden bg-ink text-white font-sans">
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.04] bg-surface">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="relative">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-mint/90 to-emerald-600 text-ink shadow-lg shadow-mint/20">
              <Leaf size={20} strokeWidth={2.5} />
            </span>
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-mint animate-pulse" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-white">CropTwin AI</h1>
            <p className="text-[11px] font-medium text-white/30">Digital Twin Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 pt-2">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">Navigation</p>
          {navItems.map((item) => {
            const isActive = item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-mint/[0.08] text-mint shadow-inner-glow"
                    : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg transition-all ${
                  isActive ? "bg-mint/15 text-mint" : "bg-white/[0.03] text-white/30 group-hover:text-white/50"
                }`}>
                  <item.icon size={16} />
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_rgba(125,223,150,0.5)]" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Health indicator at bottom */}
        <div className="mx-3 mb-4 rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-white/30 uppercase tracking-wide">Farm Health</span>
            <span className="text-lg font-bold text-mint">{farm.average_health_score}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint to-lime transition-all duration-1000"
              style={{ width: `${farm.average_health_score}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/25">{farm.layers.length} layers monitored</p>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/[0.04] bg-surface/80 px-8 py-4 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/20">{farm.name}</p>
            <h2 className="text-lg font-semibold text-white/90">{currentPage.label}</h2>
          </div>
          <div className="flex items-center gap-3">
            <VoiceControl onCommand={sendCommand} onNavigate={(path) => navigate(path)} />
            <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all ${
              connected
                ? "bg-mint/[0.08] text-mint border border-mint/20"
                : "bg-coral/[0.08] text-coral border border-coral/20"
            }`}>
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-mint shadow-[0_0_8px_rgba(125,223,150,0.5)]" : "bg-coral"}`} />
              {connected ? "Live" : "Offline"}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-surface via-ink to-ink">
          <div className="mx-auto max-w-[1400px] p-8">
            <Outlet context={stream} />
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
          <Route path="control" element={<ControlPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
