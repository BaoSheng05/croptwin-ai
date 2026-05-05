import { useState } from "react";
import { Bot, AlertTriangle, CheckCircle, BrainCircuit } from "lucide-react";

type Diagnosis = {
  layer_id: string;
  crop: string;
  diagnosis: string;
  severity: string;
  confidence: number;
  causes: string[];
  recommended_actions: string[];
  expected_outcome: string;
};

type DiagnosisPanelProps = {
  layerId: string;
};

export function DiagnosisPanel({ layerId }: DiagnosisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);

  async function runDiagnosis() {
    setLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBaseUrl}/api/diagnosis/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer_id: layerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosis(data);
      }
    } catch (err) {
      console.error("Diagnosis failed", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-card-border bg-white p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-forest-green mb-1">
            <BrainCircuit size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">CropTwin AI Engine</span>
          </div>
          <h2 className="text-xl font-medium text-ink">Live Diagnosis Report</h2>
        </div>
        <button
          onClick={runDiagnosis}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-forest-green px-4 py-2 text-sm font-medium text-white transition hover:bg-forest-green/90 disabled:opacity-50"
        >
          {loading ? (
            <span className="animate-pulse">Analyzing...</span>
          ) : (
            <>
              <Bot size={16} />
              Run AI Diagnosis
            </>
          )}
        </button>
      </div>

      {diagnosis ? (
        <div className="space-y-6">
          <div className={`rounded-lg border p-4 ${diagnosis.severity === "High" ? "border-status-critical/40 bg-red-50" : diagnosis.severity === "Medium" ? "border-status-warning/40 bg-amber-50" : "border-forest-green/40 bg-spring-green/10"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink mb-1 flex items-center gap-2">
                  {diagnosis.severity === "High" ? <AlertTriangle size={18} className="text-status-critical" /> : <CheckCircle size={18} className="text-forest-green" />}
                  {diagnosis.diagnosis}
                </h3>
                <p className="text-sm text-muted">Target: {diagnosis.crop} • Severity: <span className={diagnosis.severity === "High" ? "text-status-critical font-medium" : ""}>{diagnosis.severity}</span></p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-ink">{diagnosis.confidence}%</div>
                <div className="text-xs text-muted uppercase tracking-wide">Confidence</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Evidence & Causes</h4>
              <ul className="space-y-2">
                {diagnosis.causes.map((cause, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink/80">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/40" />
                    {cause}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Recommended Actions</h4>
              <ul className="space-y-2">
                {diagnosis.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink/80">
                    <div className="mt-1 h-3.5 w-3.5 shrink-0 text-forest-green"><CheckCircle size={14} /></div>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-md border border-card-border bg-field-bg p-4">
            <h4 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Expected Outcome</h4>
            <p className="text-sm text-ink">{diagnosis.expected_outcome}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-field-bg py-12 text-center">
          <BrainCircuit size={32} className="text-muted/30 mb-3" />
          <p className="text-sm text-muted">Click the button above to run a live analysis of the current sensor data.</p>
        </div>
      )}
    </div>
  );
}
