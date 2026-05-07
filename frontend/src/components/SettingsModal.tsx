import React, { useState } from "react";
import { X, Settings, Bell, Globe, RefreshCw, Volume2, VolumeX, CreditCard, Thermometer, Gauge, ChevronRight } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Tab = "general" | "notifications";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with sophisticated blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" 
        onClick={onClose} 
      />

      {/* Modal Container - Ultra Premium Look */}
      <div className="relative flex h-[600px] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-zoom-in">
        
        {/* Decorative background element */}
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-spring-green/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-forest-green/5 blur-3xl pointer-events-none" />

        {/* Sidebar - Sleek and Modern */}
        <aside className="relative z-10 w-72 border-r border-card-border bg-field-bg/40 p-8 flex flex-col">
          <div className="mb-10 flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-forest-green to-spring-green text-white shadow-lg shadow-forest-green/20">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink">Settings</h2>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">System Configuration</p>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
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

          <div className="mt-auto pt-6">
            <button 
              onClick={onClose}
              className="group flex w-full items-center justify-between rounded-2xl bg-forest-green px-6 py-4 text-sm font-bold text-white shadow-xl shadow-forest-green/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Save & Apply
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </aside>

        {/* Content Area - Spacious and Clean */}
        <main className="relative z-10 flex-1 overflow-y-auto bg-white/50 p-12">
          <div className="mx-auto max-w-xl">
            {activeTab === "general" && (
              <div className="space-y-10 animate-fade-in">
                <div>
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-muted/80">Localization & Display</h3>
                  <div className="grid gap-8">
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

                <div className="pt-4 border-t border-card-border/50">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-muted/80">Data Synchronization</h3>
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
              <div className="space-y-10 animate-fade-in">
                <div>
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-widest text-muted/80">System Alerts</h3>
                  <div className="grid gap-8">
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

                    <div className="rounded-3xl bg-gradient-to-br from-spring-green/10 to-blue-50 p-6 border border-spring-green/20">
                      <div className="flex items-center gap-3 mb-3 text-forest-green font-bold text-sm">
                        <Gauge size={18} />
                        Smart Monitoring Active
                      </div>
                      <p className="text-xs text-ink/70 leading-relaxed">
                        CropTwin AI is continuously monitoring your farm layers. Notification settings only affect your local browser behavior and do not pause the underlying AI control loop.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reset Button - Solid Shape */}
          <div className="absolute bottom-10 right-12">
            <button
              onClick={resetSettings}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-5 py-2.5 text-xs font-bold text-status-critical transition-all hover:bg-status-critical hover:text-white hover:border-status-critical shadow-sm active:scale-95"
            >
              <RefreshCw size={14} />
              Reset to Defaults
            </button>
          </div>
        </main>
        
        {/* Close Button - Top Right */}
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 z-20 rounded-full p-2 text-muted/40 hover:bg-black/5 hover:text-ink transition-all"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, description }: { active: boolean; onClick: () => void; icon: any; label: string; description: string }) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all ${
        active 
        ? "bg-white text-forest-green shadow-xl shadow-black/5" 
        : "text-muted hover:bg-black/5 hover:text-ink"
      }`}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-xl transition-all ${active ? "bg-spring-green/20 text-forest-green" : "bg-white/50 text-muted/60 group-hover:bg-white group-hover:text-ink"}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className={`text-[10px] font-medium transition-colors ${active ? "text-forest-green/70" : "text-muted/50"}`}>{description}</p>
      </div>
    </button>
  );
}

function SettingItem({ icon: Icon, label, description, children }: { icon: any; label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="flex gap-4">
        <div className="mt-1 text-muted/40"><Icon size={20} /></div>
        <div>
          <h4 className="text-sm font-bold text-ink mb-1">{label}</h4>
          <p className="text-xs text-muted/70 leading-relaxed max-w-[240px]">{description}</p>
        </div>
      </div>
      <div className="w-48 shrink-0">{children}</div>
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
