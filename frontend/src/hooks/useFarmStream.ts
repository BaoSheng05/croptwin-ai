import { useCallback, useEffect, useMemo, useState } from "react";

import { fallbackAlerts, fallbackFarm, fallbackRecommendations, seedChartData } from "../data/mock";
import { api, farmSocketUrl } from "../services/api";
import type { Alert, FarmLayer, FarmOverview, LayerUpdateEvent, Recommendation } from "../types";

type ChartPoint = (typeof seedChartData)[number];

export function useFarmStream() {
  const [farm, setFarm] = useState<FarmOverview>(fallbackFarm);
  const [alerts, setAlerts] = useState<Alert[]>(fallbackAlerts);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(fallbackRecommendations);
  const [chartData, setChartData] = useState<ChartPoint[]>(seedChartData);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [farmResponse, alertsResponse, recommendationsResponse] = await Promise.all([
        api.getFarm(),
        api.getAlerts(),
        api.getRecommendations(),
      ]);
      setFarm(farmResponse);
      setAlerts(alertsResponse.length ? alertsResponse : fallbackAlerts);
      setRecommendations(recommendationsResponse.length ? recommendationsResponse : fallbackRecommendations);
    } catch {
      setFarm(fallbackFarm);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let retryTimer: number | undefined;
    let socket: WebSocket | undefined;

    const connect = () => {
      socket = new WebSocket(farmSocketUrl());

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        retryTimer = window.setTimeout(connect, 2000);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (message) => {
        const payload = JSON.parse(message.data);
        if (payload.event === "snapshot") {
          setFarm((current) => ({ ...current, layers: payload.data as FarmLayer[] }));
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

          if (event.alert) {
            setAlerts((current) => [event.alert!, ...current].slice(0, 8));
          }
          if (event.recommendation) {
            setRecommendations((current) => [event.recommendation!, ...current].slice(0, 8));
          }
          if (event.data.latest_reading) {
            const reading = event.data.latest_reading;
            setChartData((current) =>
              [
                ...current.slice(-15),
                {
                  time: new Date(reading.timestamp).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
                  temperature: reading.temperature,
                  humidity: reading.humidity,
                  moisture: reading.soil_moisture,
                  ph: reading.ph,
                },
              ],
            );
          }
        }
      };
    };

    connect();

    return () => {
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
    chat: api.chat,
  };
}
