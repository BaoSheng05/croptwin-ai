import { ClipboardList } from "lucide-react";

import { api } from "../services/api";
import type { OperationsTimeline } from "../types";
import { useApiResource } from "../hooks/useApiResource";

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperationsPage() {
  const { data: timeline, loading } = useApiResource<OperationsTimeline>(
    () => api.getOperationsTimeline(),
    [],
  );

  if (loading || !timeline) {
    return <div className="rounded-lg border border-card-border bg-white p-8 text-sm text-muted shadow-card">Loading operations timeline...</div>;
  }

  return (
    <div className="grid gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Operations Timeline</h2>
          <p className="mt-1 text-xs text-muted">Audit trail for AI recommendations, actions, and before/after results.</p>
        </div>
        <span className="rounded-md border border-card-border bg-white px-3 py-1.5 text-xs font-semibold text-muted">
          {timeline.closed_loop_events} events
        </span>
      </div>

      <section className="rounded-lg border border-card-border bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-forest-green">
          <ClipboardList size={17} />
          <h3 className="text-sm font-semibold text-ink">Audit List</h3>
        </div>
        <div className="overflow-hidden rounded-lg border border-card-border">
          <table className="w-full min-w-[980px] border-collapse bg-white text-sm">
            <thead className="bg-field-bg text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Layer</th>
                <th className="p-3">Event</th>
                <th className="p-3">AI Action</th>
                <th className="p-3">Result</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {timeline.events.map((event) => (
                <tr key={event.id} className="border-t border-card-border align-top">
                  <td className="p-3 text-muted">{formatTime(event.timestamp)}</td>
                  <td className="p-3 font-semibold text-ink">{event.layer_name} · {event.crop}</td>
                  <td className="p-3">
                    <p className="font-semibold text-ink">{event.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{event.trigger}</p>
                  </td>
                  <td className="p-3 text-ink/80">{event.ai_recommendation}</td>
                  <td className="p-3 text-forest-green">{event.impact}</td>
                  <td className="p-3">
                    <span className="rounded-md border border-forest-green/20 bg-spring-green/10 px-2 py-1 text-xs font-semibold text-forest-green">
                      {event.after.risk} · Health {event.before.health_score} → {event.after.health_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
