import { Activity, Bell, Layers, MessageSquare, Settings, Sliders, Leaf, BookOpen } from "lucide-react";
import { BrowserRouter, Routes, Route, NavLink, Outlet } from "react-router-dom";

import { useFarmStream } from "./hooks/useFarmStream";
import DashboardPage from "./pages/DashboardPage";
import LayerDetailPage from "./pages/LayerDetailPage";
import ControlPage from "./pages/ControlPage";
import AlertsPage from "./pages/AlertsPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";

export type FarmStreamContext = ReturnType<typeof useFarmStream>;

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
  const { farm, connected } = stream;

  const navItems = [
    { path: "/", label: "Dashboard", icon: Activity },
    { path: "/layers", label: "Layer Detail", icon: Layers },
    { path: "/control", label: "Control Panel", icon: Sliders },
    { path: "/alerts", label: "Alerts & Recs", icon: Bell },
    { path: "/chat", label: "Chat Assistant", icon: MessageSquare },
    { path: "/settings", label: "Crop Recipe", icon: BookOpen },
  ];

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
      </aside>

      {/* ── Main content area ────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header — gradient LightGreen → soft mint */}
        <header
          className="flex items-center justify-between px-8 py-4"
          style={{ background: "linear-gradient(to right, #90EE90 0%, #A8F2A8 100%)", borderBottom: "1px solid rgba(34,139,34,0.2)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: COLORS.ink }}>{farm.name}</h2>

          <div className="flex items-center gap-3">
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

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">
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
          <Route path="control" element={<ControlPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
