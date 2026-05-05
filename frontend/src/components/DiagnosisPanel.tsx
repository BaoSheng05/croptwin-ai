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

  const severityStyles = {
    High:   { bg: "bg-coral/[0.06]", border: "border-coral/20", text: "text-coral", icon: AlertTriangle },
    Medium: { bg: "bg-amber/[0.06]", border: "border-amber/20", text: "text-amber", icon: AlertTriangle },
    Normal: { bg: "bg-mint/[0.06]",  border: "border-mint/20",  text: "text-mint",  icon: CheckCircle },
    Low:    { bg: "bg-white/[0.03]", border: "border-white/10", text: "text-white/60", icon: CheckCircle },
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet/15 to-fuchsia-500/10 text-violet">
            <BrainCircuit size={18} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">AI Engine</p>
            <h2 className="text-base font-semibold text-white mt-0.5">Live Diagnosis</h2>
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
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] font-semibold text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            title="Upload plant image for visual diagnosis"
          >
            <ImageIcon size={14} /> <span className="hidden sm:inline">Vision</span>
          </button>
          <button
            onClick={runDiagnosis} disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-fuchsia-500 px-5 py-2.5 text-[12px] font-semibold text-white shadow-lg shadow-violet/20 transition hover:shadow-violet/30 disabled:opacity-50"
          >
            {loading ? <span className="animate-pulse">Analyzing...</span> : <><Sparkles size={14} /> Data Diagnosis</>}
          </button>
        </div>
      </div>

      {diagnosis ? (
        <div className="space-y-5 animate-fade-up">
          {(() => {
            const s = severityStyles[diagnosis.severity as keyof typeof severityStyles] || severityStyles.Normal;
            const SIcon = s.icon;
            return (
              <div className={`rounded-2xl border ${s.border} ${s.bg} p-5`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <SIcon size={18} className={s.text} />
                    <div>
                      <h3 className="text-base font-semibold text-white">{diagnosis.diagnosis}</h3>
                      <p className="text-[12px] text-white/40 mt-0.5">{diagnosis.crop} · {diagnosis.severity} severity</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{diagnosis.confidence}%</div>
                    <div className="text-[10px] text-white/25 uppercase tracking-wide">Confidence</div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-3">Evidence</h4>
              <ul className="space-y-2">
                {diagnosis.causes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-white/55 leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/15" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-3">Actions</h4>
              <ul className="space-y-2">
                {diagnosis.recommended_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-white/55 leading-relaxed">
                    <CheckCircle size={12} className="mt-0.5 text-mint shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-white/20 mb-2">Expected Outcome</h4>
            <p className="text-[12px] leading-relaxed text-white/50">{diagnosis.expected_outcome}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.06] py-14 text-center">
          <BrainCircuit size={36} className="text-white/10 mb-3 animate-float" />
          <p className="text-[12px] text-white/25">Upload an image or run data analysis to diagnose</p>
        </div>
      )}
    </div>
  );
}
