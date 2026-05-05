import { Activity, Bell, Layers, MessageSquare, Settings, Sliders, Leaf, GitBranch } from "lucide-react";
import { BrowserRouter, Routes, Route, NavLink, Outlet, useOutletContext, useNavigate } from "react-router-dom";

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

  const navItems = [
    { path: "/", label: "Dashboard", icon: Activity },
    { path: "/layers", label: "Layer Detail", icon: Layers },
    { path: "/whatif", label: "What-If Simulator", icon: GitBranch },
    { path: "/control", label: "Control Panel", icon: Sliders },
    { path: "/alerts", label: "Alerts & Recs", icon: Bell },
    { path: "/chat", label: "Chat Assistant", icon: MessageSquare },
    { path: "/settings", label: "Crop Recipe", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-ink text-white font-sans">
      <aside className="flex w-64 flex-col border-r border-white/10 bg-[#0A0A0A]">
        <div className="flex items-center gap-3 border-b border-white/10 p-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-mint text-ink">
            <Leaf size={21} />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-normal text-white">CropTwin AI</h1>
            <p className="text-xs text-white/55">Digital Twin Platform</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-mint/10 text-mint" : "text-white/60 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/10 bg-[#0A0A0A]/50 px-8 py-4 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white/90">{farm.name}</h2>
          <div className="flex items-center gap-4">
            <VoiceControl onCommand={sendCommand} onNavigate={(path) => navigate(path)} />
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-panel px-3 py-1.5 text-xs text-white/65">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-mint" : "bg-coral"}`} />
              {connected ? "Live stream connected" : "Using local snapshot"}
            </div>
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
