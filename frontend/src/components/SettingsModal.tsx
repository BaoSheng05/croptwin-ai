import React from "react";
import { X, Settings, Bell, Globe, RefreshCw, Volume2, VolumeX, CreditCard, Thermometer, Gauge, ChevronRight } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";
import { usePersistentString } from "../hooks/usePersistentState";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Tab = "general" | "notifications";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [activeTab, setActiveTab] = usePersistentString("croptwin_settings_tab", "general") as readonly [Tab, (value: Tab) => void];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />

      <div className="relative flex h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-white/20 bg-white/95 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-zoom-in sm:h-[600px] sm:rounded-3xl md:flex-row">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-spring-green/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-forest-green/5 blur-3xl pointer-events-none" />

        <aside className="relative z-10 flex shrink-0 flex-col border-b border-card-border bg-field-bg/40 p-5 md:w-72 md:border-b-0 md:border-r md:p-8">
          <div className="mb-5 flex items-center gap-4 md:mb-10">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-forest-green to-spring-green text-white shadow-lg shadow-forest-green/20 md:h-12 md:w-12">
              <Settings size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-ink md:text-xl">Settings</h2>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted/60">System Configuration</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-1 md:flex-col md:space-y-2 md:overflow-visible md:pb-0">
            <TabButton
              active={activeTab === "general"}
              onClick={() => setActiveTab("general")}
              icon={Globe}
              label="Preferences"
              description="Units, currency & sync"
            />
            <TabButton
              active={activeTab === "notifications"}
              onClick={() => setActiveTab("notifications")}
              icon={Bell}
              label="Alerts"
              description="Sounds & notifications"
            />
          </nav>

          <div className="mt-4 hidden pt-2 md:mt-auto md:block md:pt-6">
            <button
              onClick={onClose}
              className="group flex w-full items-center justify-between rounded-2xl bg-forest-green px-6 py-4 text-sm font-bold text-white shadow-xl shadow-forest-green/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Save & Apply
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </aside>

        <main className="relative z-10 min-h-0 flex-1 overflow-y-auto bg-white/50 p-5 pb-24 sm:p-8 md:p-12">
          <div className="mx-auto max-w-xl">
            {activeTab === "general" && (
              <div className="space-y-8 animate-fade-in md:space-y-10">
                <div>
                  <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted/80 md:mb-6">Localization & Display</h3>
                  <div className="grid gap-6 md:gap-8">
                    <SettingItem
                      icon={Thermometer}
                      label="Temperature Scale"
                      description="Displayed across all live telemetry charts."
                    >
                      <div className="flex rounded-xl bg-field-bg p-1">
                        <ToggleButton active={settings.tempUnit === "C"} onClick={() => updateSettings({ tempUnit: "C" })}>Celsius</ToggleButton>
                        <ToggleButton active={settings.tempUnit === "F"} onClick={() => updateSettings({ tempUnit: "F" })}>Fahrenheit</ToggleButton>
                      </div>
                    </SettingItem>

                    <SettingItem
                      icon={CreditCard}
                      label="Primary Currency"
                      description="Used for ROI and savings calculations."
                    >
                      <div className="flex rounded-xl bg-field-bg p-1">
                        <ToggleButton active={settings.currency === "RM"} onClick={() => updateSettings({ currency: "RM" })}>RM</ToggleButton>
                        <ToggleButton active={settings.currency === "USD"} onClick={() => updateSettings({ currency: "USD" })}>USD</ToggleButton>
                      </div>
                    </SettingItem>
                  </div>
                </div>

                <div className="border-t border-card-border/50 pt-4">
                  <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted/80 md:mb-6">Data Synchronization</h3>
                  <SettingItem
                    icon={RefreshCw}
                    label="Refresh Rate"
                    description="Background polling frequency for static data."
                  >
                    <select
                      value={settings.refreshRate}
                      onChange={(e) => updateSettings({ refreshRate: Number(e.target.value) })}
                      className="w-full rounded-xl border border-card-border bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition-all focus:ring-2 focus:ring-spring-green/50"
                    >
                      <option value={10}>10s (Real-time Feel)</option>
                      <option value={30}>30s (Balanced)</option>
                      <option value={60}>60s (Energy Saver)</option>
                    </select>
                  </SettingItem>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-8 animate-fade-in md:space-y-10">
                <div>
                  <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted/80 md:mb-6">System Alerts</h3>
                  <div className="grid gap-6 md:gap-8">
                    <SettingItem
                      icon={settings.soundAlerts ? Volume2 : VolumeX}
                      label="Audible Feedback"
                      description="Play audio cues for new predictive alerts."
                    >
                      <button
                        onClick={() => updateSettings({ soundAlerts: !settings.soundAlerts })}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${settings.soundAlerts ? "bg-forest-green" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-all duration-300 ${settings.soundAlerts ? "translate-x-8" : "translate-x-1"}`} />
                      </button>
                    </SettingItem>

                    <div className="rounded-3xl bg-gradient-to-br from-spring-green/10 to-blue-50 p-5 border border-spring-green/20 md:p-6">
                      <div className="mb-3 flex items-center gap-3 text-sm font-bold text-forest-green">
                        <Gauge size={18} />
                        Smart Monitoring Active
                      </div>
                      <p className="text-xs leading-relaxed text-ink/70">
                        CropTwin AI is continuously monitoring your farm layers. Notification settings only affect your local browser behavior and do not pause the underlying AI control loop.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-start md:absolute md:bottom-10 md:right-12 md:mt-0">
            <button
              onClick={resetSettings}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-5 py-2.5 text-xs font-bold text-status-critical transition-all hover:bg-status-critical hover:text-white hover:border-status-critical shadow-sm active:scale-95"
            >
              <RefreshCw size={14} />
              Reset to Defaults
            </button>
          </div>
        </main>

        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-card-border bg-white/95 p-4 md:hidden">
          <button
            onClick={onClose}
            className="group flex w-full items-center justify-between rounded-2xl bg-forest-green px-6 py-4 text-sm font-bold text-white shadow-xl shadow-forest-green/20 transition-all active:scale-95"
          >
            Save & Apply
            <ChevronRight size={18} />
          </button>
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-30 rounded-full p-2 text-muted/60 transition-all hover:bg-black/5 hover:text-ink md:right-8 md:top-8"
        >
          <X size={22} />
        </button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, description }: { active: boolean; onClick: () => void; icon: any; label: string; description: string }) {
  return (
    <button
      onClick={onClick}
      className={`group flex min-w-[185px] flex-1 items-center gap-3 rounded-2xl p-3 text-left transition-all md:min-w-0 md:gap-4 md:p-4 ${
        active
        ? "bg-white text-forest-green shadow-xl shadow-black/5"
        : "text-muted hover:bg-black/5 hover:text-ink"
      }`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all ${active ? "bg-spring-green/20 text-forest-green" : "bg-white/50 text-muted/60 group-hover:bg-white group-hover:text-ink"}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{label}</p>
        <p className={`truncate text-[10px] font-medium transition-colors ${active ? "text-forest-green/70" : "text-muted/50"}`}>{description}</p>
      </div>
    </button>
  );
}

function SettingItem({ icon: Icon, label, description, children }: { icon: any; label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:flex md:items-start md:justify-between md:gap-8">
      <div className="flex min-w-0 gap-4">
        <div className="mt-1 shrink-0 text-muted/40"><Icon size={20} /></div>
        <div className="min-w-0">
          <h4 className="mb-1 text-sm font-bold text-ink">{label}</h4>
          <p className="max-w-[240px] text-xs leading-relaxed text-muted/70">{description}</p>
        </div>
      </div>
      <div className="w-full md:w-48 md:shrink-0">{children}</div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${
        active
        ? "bg-white text-forest-green shadow-md"
        : "text-muted/60 hover:text-muted"
      }`}
    >
      {children}
    </button>
  );
}
