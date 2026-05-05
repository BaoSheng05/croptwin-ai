import { useOutletContext } from "react-router-dom";
import { AlertsPanel } from "../components/AlertsPanel";
import { RecommendationPanel } from "../components/RecommendationPanel";
import type { FarmStreamContext } from "../App";

export default function AlertsPage() {
  const { alerts, recommendations } = useOutletContext<FarmStreamContext>();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-6 lg:grid-cols-2">
        <AlertsPanel alerts={alerts} />
        <RecommendationPanel recommendations={recommendations} />
      </div>
    </div>
  );
}
