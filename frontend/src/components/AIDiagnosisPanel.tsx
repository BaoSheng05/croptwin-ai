import { useState } from "react";
import { Sparkles, AlertTriangle, CheckCircle, Activity, Play } from "lucide-react";
import { api } from "../services/api";

type AIDiagnosisResult = {
  diagnosis: string;
  severity: "Low" | "Medium" | "High" | "Critical" | "Normal";
  confidence: number;
  evidence: string[];
  recommended_actions: string[];
  device_command: {
    device: string;
    value: boolean | number;
    duration_minutes: number | null;
  };
  expected_outcome: string;
};

export function AIDiagnosisPanel({ layerId }: { layerId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIDiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.aiDiagnose(layerId);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Failed to run AI Diagnosis");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!result || result.device_command.device === "none") return;
    setExecuting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.executeSafeCommand(
        layerId,
        result.device_command.device,
        result.device_command.value,
        result.device_command.duration_minutes || undefined
      );
      setSuccess("Command executed safely.");
    } catch (e: any) {
      setError(e.message || "Failed to execute command. Safety guardrail might have blocked it.");
    } finally {
      setExecuting(false);
    }
  };

  const severityColor = {
    Normal: "text-mint border-mint/20 bg-mint/10",
    Low: "text-blue-400 border-blue-400/20 bg-blue-400/10",
    Medium: "text-yellow-400 border-yellow-400/20 bg-yellow-400/10",
    High: "text-orange-400 border-orange-400/20 bg-orange-400/10",
    Critical: "text-coral border-coral/20 bg-coral/10",
  }[result?.severity || "Normal"];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-mint">
          <Sparkles size={18} />
          <h3 className="font-semibold text-white/90">AI-First Diagnosis</h3>
        </div>
        <button
          onClick={handleDiagnose}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-mint to-emerald-500 px-4 py-2 text-[13px] font-semibold text-ink transition hover:shadow-lg hover:shadow-mint/20 disabled:opacity-50"
        >
          {loading ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-coral/20 bg-coral/10 p-3 text-[13px] text-coral flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-xl border border-mint/20 bg-mint/10 p-3 text-[13px] text-mint flex items-center gap-2">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[15px] font-medium text-white/90">{result.diagnosis}</span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${severityColor}`}>
              {result.severity}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-white/10 bg-white/5 text-white/70 flex items-center gap-1">
              <Activity size={12} /> {result.confidence}% Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
              <h4 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-2">Evidence</h4>
              <ul className="space-y-1">
                {result.evidence.map((ev, i) => (
                  <li key={i} className="text-[13px] text-white/70 flex items-start gap-2">
                    <span className="text-white/20 mt-0.5">•</span> {ev}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
              <h4 className="text-[12px] font-semibold text-white/40 uppercase tracking-wider mb-2">Recommended Actions</h4>
              <ul className="space-y-1">
                {result.recommended_actions.map((act, i) => (
                  <li key={i} className="text-[13px] text-white/70 flex items-start gap-2">
                    <span className="text-mint/60 mt-0.5">→</span> {act}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {result.device_command.device !== "none" && (
            <div className="rounded-xl border border-mint/20 bg-mint/[0.05] p-4 flex items-center justify-between">
              <div>
                <h4 className="text-[13px] font-semibold text-white/90 mb-1">Suggested Device Action</h4>
                <p className="text-[12px] text-white/60">
                  Set <span className="font-mono text-mint">{result.device_command.device}</span> to{" "}
                  <span className="font-mono text-mint">{String(result.device_command.value)}</span>
                  {result.device_command.duration_minutes ? ` for ${result.device_command.duration_minutes}m` : ""}
                </p>
              </div>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                {executing ? "Executing..." : <><Play size={14} /> Execute Safely</>}
              </button>
            </div>
          )}

          <div className="text-[12px] text-white/40 italic">
            Expected outcome: {result.expected_outcome}
          </div>
        </div>
      )}
    </div>
  );
}
