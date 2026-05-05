import { useState, useRef } from "react";
import { AlertTriangle, CheckCircle, BrainCircuit, Sparkles, Image as ImageIcon } from "lucide-react";

type Diagnosis = {
  layer_id: string; crop: string; diagnosis: string; severity: string;
  confidence: number; causes: string[]; recommended_actions: string[]; expected_outcome: string;
};

type DiagnosisPanelProps = { layerId: string };

export function DiagnosisPanel({ layerId }: DiagnosisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function runDiagnosis() {
    setLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBaseUrl}/api/diagnosis/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer_id: layerId }),
      });
      if (res.ok) setDiagnosis(await res.json());
    } catch (err) { console.error("Diagnosis failed", err); }
    finally { setLoading(false); }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setLoading(true);
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
        const res = await fetch(`${apiBaseUrl}/api/diagnosis/image`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layer_id: layerId, image_base64: reader.result as string }),
        });
        if (res.ok) setDiagnosis(await res.json());
      } catch (err) { console.error("Image diagnosis failed", err); }
      finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
  };

  const severityBg = {
    High:   "border-status-critical/30 bg-red-50",
    Medium: "border-status-warning/30 bg-amber-50",
    Normal: "border-forest-green/30 bg-spring-green/10",
    Low:    "border-card-border bg-field-bg",
  };

  return (
    <div className="rounded-lg border border-card-border bg-white p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-purple-50 text-purple-600">
            <BrainCircuit size={18} />
          </span>
          <div>
            <p className="text-xs uppercase text-muted">AI Engine</p>
            <h2 className="text-lg font-semibold text-ink">Live Diagnosis</h2>
          </div>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()} disabled={loading}
            className="flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-4 py-2 text-xs font-semibold text-muted transition hover:bg-spring-green/20 hover:text-ink disabled:opacity-50"
            title="Upload plant image for visual diagnosis"
          >
            <ImageIcon size={14} /> <span className="hidden sm:inline">Vision</span>
          </button>
          <button
            onClick={runDiagnosis} disabled={loading}
            className="flex items-center gap-2 rounded-md bg-forest-green px-4 py-2 text-xs font-semibold text-white transition hover:bg-forest-green/90 disabled:opacity-50"
          >
            {loading ? <span className="animate-pulse">Analyzing...</span> : <><Sparkles size={14} /> Data Diagnosis</>}
          </button>
        </div>
      </div>

      {diagnosis ? (
        <div className="space-y-5 animate-fade-up">
          <div className={`rounded-lg border p-4 ${severityBg[diagnosis.severity as keyof typeof severityBg] || severityBg.Normal}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {diagnosis.severity === "High" ? <AlertTriangle size={18} className="text-status-critical" /> : <CheckCircle size={18} className="text-forest-green" />}
                <div>
                  <h3 className="text-lg font-semibold text-ink">{diagnosis.diagnosis}</h3>
                  <p className="text-sm text-muted mt-0.5">{diagnosis.crop} · {diagnosis.severity} severity</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-ink">{diagnosis.confidence}%</div>
                <div className="text-xs text-muted uppercase tracking-wide">Confidence</div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Evidence & Causes</h4>
              <ul className="space-y-2">
                {diagnosis.causes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink/80 leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/40" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted uppercase tracking-wide mb-3">Recommended Actions</h4>
              <ul className="space-y-2">
                {diagnosis.recommended_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink/80 leading-relaxed">
                    <CheckCircle size={14} className="mt-0.5 text-forest-green shrink-0" />
                    {a}
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-card-border bg-field-bg py-14 text-center">
          <BrainCircuit size={36} className="text-muted/30 mb-3 animate-float" />
          <p className="text-sm text-muted">Upload an image or run data analysis to diagnose</p>
        </div>
      )}
    </div>
  );
}
