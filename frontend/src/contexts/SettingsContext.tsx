import React, { createContext, useContext, useEffect, useState } from "react";
import { UserSettings } from "../types";
import { api } from "../services/api";

type SettingsContextType = {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  formatTemp: (celsius: number) => string;
  formatCurrency: (amountRM: number) => string;
  formatRate: (rateRM: number) => string;
  localizeText: (text: string) => string;
};

const DEFAULT_SETTINGS: UserSettings = {
  tempUnit: "C",
  currency: "RM",
  refreshRate: 30,
  autoPilot: false,
  aiSensitivity: 70,
  soundAlerts: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem("croptwin_settings");
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    let alive = true;
    api.getPreference<Partial<UserSettings>>("user_settings")
      .then((payload) => {
        if (alive && payload.value) {
          setSettings((current) => ({ ...current, ...payload.value }));
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem("croptwin_settings", JSON.stringify(settings));
    api.setPreference("user_settings", settings).catch(() => {});
  }, [settings]);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const formatTemp = (celsius: number) => {
    if (settings.tempUnit === "F") {
      return `${((celsius * 9) / 5 + 32).toFixed(1)}°F`;
    }
    return `${celsius.toFixed(1)}°C`;
  };

  const formatCurrency = (amountRM: number) => {
    if (settings.currency === "USD") {
      return `$${(amountRM / 4.7).toFixed(0)}`;
    }
    return `RM ${amountRM.toFixed(0)}`;
  };

  const formatRate = (rateRM: number) => {
    if (settings.currency === "USD") {
      return `$${(rateRM / 4.7).toFixed(2)}`;
    }
    return `RM ${rateRM.toFixed(2)}`;
  };

  const localizeText = (text: string) => {
    if (settings.tempUnit === "C") return text;
    
    // Pattern matches "22.5C", "22.52C", "16-24C", "16–24°C"
    // Handle ranges and single values
    return text.replace(/(\d+\.?\d*)\s*(?:[–-]\s*(\d+\.?\d*))?\s*°?C/g, (match, p1, p2) => {
      if (p2) {
        // Range
        const lowF = Math.round((parseFloat(p1) * 9) / 5 + 32);
        const highF = Math.round((parseFloat(p2) * 9) / 5 + 32);
        return `${lowF}–${highF}°F`;
      } else {
        // Single value
        const celsius = parseFloat(p1);
        const fahrenheit = (celsius * 9) / 5 + 32;
        return `${fahrenheit.toFixed(1)}°F`;
      }
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, formatTemp, formatCurrency, formatRate, localizeText }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
