import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fallbackAlerts, fallbackFarm, fallbackRecommendations, seedChartData } from "../data/mock";
import { useSettings } from "../contexts/SettingsContext";
import { api, farmSocketUrl } from "../services/api";
import type { Alert, FarmLayer, FarmOverview, LayerUpdateEvent, Recommendation } from "../types";

type ChartPoint = (typeof seedChartData)[number];
type ChartDataByLayer = Record<string, ChartPoint[]>;

function seedLayerChartData(layer: FarmLayer): ChartPoint[] {
  const reading = layer.latest_reading;
  if (!reading) return seedChartData;

  const baseTime = new Date(reading.timestamp).getTime();
  return Array.from({ length: 16 }).map((_, index) => {
    const offset = index - 15;
    const wave = Math.sin(index / 3);
    const time = new Date(baseTime + offset * 2000).toLocaleTimeString([], {
      minute: "2-digit",
      second: "2-digit",
    });
    return {
      time,
      temperature: Number((reading.temperature + wave * 0.4).toFixed(2)),
      humidity: Number((reading.humidity + wave * 0.9).toFixed(2)),
      moisture: Number((reading.soil_moisture - wave * 0.6).toFixed(2)),
      ph: Number((reading.ph + wave * 0.03).toFixed(2)),
    };
  });
}

function chartPointFromReading(reading: FarmLayer["latest_reading"]): ChartPoint | null {
  if (!reading) return null;
  return {
    time: new Date(reading.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    temperature: reading.temperature,
    humidity: reading.humidity,
    moisture: reading.soil_moisture,
    ph: reading.ph,
  };
}

function alertKey(alert: Alert): string {
  return `${alert.layer_id}:${alert.title}:${alert.predictive ? "predictive" : "active"}`;
}

function upsertAlert(alert: Alert, current: Alert[], limit = 20): Alert[] {
  const key = alertKey(alert);
  return [alert, ...current.filter((item) => alertKey(item) !== key)].slice(0, limit);
}

function playAlertTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.onended = () => context.close().catch(() => {});
  } catch (error) {
    console.log("Sound play blocked", error);
  }
}

export function useFarmStream() {
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  const [farm, setFarm] = useState<FarmOverview>(fallbackFarm);
  const [alerts, setAlerts] = useState<Alert[]>(fallbackAlerts);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(fallbackRecommendations);
  const [chartData, setChartData] = useState<ChartPoint[]>(seedChartData);
  const [chartDataByLayer, setChartDataByLayer] = useState<ChartDataByLayer>(() =>
    Object.fromEntries(
      fallbackFarm.layers.map((layer) => [layer.id, seedLayerChartData(layer)]),
    ),
  );
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const refresh = useCallback(async () => {
    const [farmResult, alertsResult, recommendationsResult] = await Promise.allSettled([
      api.getFarm(),
      api.getAlerts(),
      api.getRecommendations(),
    ]);

    if (farmResult.status === "fulfilled") {
      const farmResponse = farmResult.value;
      setFarm(farmResponse);
      setChartDataByLayer((current) => {
        const next = { ...current };
        for (const layer of farmResponse.layers) {
          if (!next[layer.id]?.length) next[layer.id] = seedLayerChartData(layer);
        }
        return next;
      });
    }
    if (alertsResult.status === "fulfilled") {
      setAlerts(alertsResult.value);
    }
    if (recommendationsResult.status === "fulfilled") {
      setRecommendations(recommendationsResult.value);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Periodic refresh for non-streamed data (like Business Impact)
  useEffect(() => {
    const interval = setInterval(refresh, settings.refreshRate * 1000);
    return () => clearInterval(interval);
  }, [refresh, settings.refreshRate]);

  useEffect(() => {
    let retryTimer: number | undefined;
    let socket: WebSocket | undefined;
    let shouldReconnect = true;

    const connect = () => {
      socket = new WebSocket(farmSocketUrl());

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (shouldReconnect) retryTimer = window.setTimeout(connect, 2000);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (message) => {
        let payload: any;
        try {
          payload = JSON.parse(message.data);
        } catch (error) {
          console.warn("Ignoring malformed farm stream message", error);
          return;
        }
        if (payload.event === "snapshot") {
          setFarm((current) => ({ ...current, layers: payload.data as FarmLayer[] }));
          setChartDataByLayer((current) => {
            const next = { ...current };
            for (const layer of payload.data as FarmLayer[]) {
              next[layer.id] = next[layer.id]?.length ? next[layer.id] : seedLayerChartData(layer);
            }
            return next;
          });
          return;
        }

        if (payload.event === "layer_update") {
          const event = payload as LayerUpdateEvent;
          setFarm((current) => ({
            ...current,
            layers: current.layers.map((layer) => (layer.id === event.data.id ? event.data : layer)),
            average_health_score: Math.round(
              current.layers
                .map((layer) => (layer.id === event.data.id ? event.data.health_score : layer.health_score))
                .reduce((sum, score) => sum + score, 0) / current.layers.length,
            ),
          }));

          let shouldSyncRecommendations = false;
          if (event.alert) {
            setAlerts((current) => upsertAlert(event.alert!, current, 20));
            shouldSyncRecommendations = true;
            
            if (settingsRef.current.soundAlerts) {
              playAlertTone();
            }
          }
          if (event.resolved_alert_ids?.length) {
            const resolved = new Set(event.resolved_alert_ids);
            setAlerts((current) => current.filter((alert) => !resolved.has(alert.id)));
            shouldSyncRecommendations = true;
          }
          if (shouldSyncRecommendations) {
            api.getRecommendations()
              .then(setRecommendations)
              .catch(() => {});
          }
          if (event.data.latest_reading) {
            const reading = event.data.latest_reading;
            const point = chartPointFromReading(reading);
            if (!point) return;
            setChartData((current) =>
              [
                ...current.slice(-15),
                point,
              ],
            );
            setChartDataByLayer((current) => ({
              ...current,
              [reading.layer_id]: [...(current[reading.layer_id] ?? []).slice(-15), point],
            }));
          }
        }

        if (payload.event === "device_command") {
          const { layer_id, devices } = payload.data;
          setFarm((current) => ({
            ...current,
            layers: current.layers.map((layer) =>
              layer.id === layer_id ? { ...layer, devices } : layer
            ),
          }));
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  const selectedLayer = useMemo(
    () => farm.layers.find((layer) => layer.status !== "Healthy") ?? farm.layers[0],
    [farm.layers],
  );

  return {
    farm,
    alerts,
    recommendations,
    chartData,
    connected,
    selectedLayer,
    refresh,
    sendCommand: api.sendCommand,
    executeSafeCommand: api.executeSafeCommand,
    chat: api.chat,
    chartDataByLayer,
    getLayerChartData: (layerId: string) => chartDataByLayer[layerId] ?? chartData,
  };
}
