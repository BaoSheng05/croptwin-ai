import { useOutletContext } from "react-router-dom";
import { AlertsPanel } from "../components/AlertsPanel";
import { RecommendationPanel } from "../components/RecommendationPanel";
import type { FarmStreamContext } from "../App";

export default function AlertsPage() {
  const { alerts, recommendations } = useOutletContext<FarmStreamContext>();

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-white">Alerts & Recommendations</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <AlertsPanel alerts={alerts} />
        </div>
        <div>
          <RecommendationPanel recommendations={recommendations} />
        </div>
      </div>
    </div>
  );
}
