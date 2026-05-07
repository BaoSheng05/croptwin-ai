import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertTriangle, CheckCircle, Activity, Play, Image as ImageIcon, Camera, Square } from "lucide-react";
import { api } from "../services/api";

type AIDiagnosisResult = {
  diagnosis: string;
  severity: "Low" | "Medium" | "High" | "Critical" | "Normal";
  confidence: number;
  evidence: string[];
  recommended_actions: string[];
  device_command: { device: string; value: boolean | number; duration_minutes: number | null };
  expected_outcome: string;
};

function safeDuration(device: string, value: boolean | number, duration: number | null) {
  if (value !== true) return undefined;
  if (device === "pump") return Math.min(Math.max(duration || 2, 1), 5);
  if (device === "misting") return Math.min(Math.max(duration || 3, 1), 5);
  if (device === "fan") return Math.min(Math.max(duration || 10, 1), 30);
  return undefined;
}

export function AIDiagnosisPanel({ layerId }: { layerId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIDiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  const handleDiagnose = async () => {
    setLoading(true); setError(null); setSuccess(null);
    try { setResult(await api.aiDiagnose(layerId)); }
    catch (e: any) { setError(e.message || "Failed to run AI Diagnosis"); }
    finally { setLoading(false); }
  };

  const submitImageDiagnosis = async (imageBase64: string) => {
    setImagePreview(imageBase64);
    setLoading(true); setError(null); setSuccess(null);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBaseUrl}/api/diagnosis/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer_id: layerId, image_base64: imageBase64 }),
      });
      if (!res.ok) throw new Error(`Vision diagnosis failed: ${res.status}`);
      const data = await res.json();
      setResult({
        diagnosis: data.diagnosis,
        severity: data.severity,
        confidence: data.confidence,
        evidence: data.causes ?? [],
        recommended_actions: data.recommended_actions ?? [],
        device_command: { device: "none", value: false, duration_minutes: null },
        expected_outcome: data.expected_outcome ?? "Continue monitoring this layer.",
      });
    } catch (e: any) {
      setError(e.message || "Failed to run vision diagnosis");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => void submitImageDiagnosis(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (e: any) {
      setError(e.message || "Camera permission denied.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const captureCameraFrame = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    await submitImageDiagnosis(canvas.toDataURL("image/jpeg", 0.86));
  };

  const handleExecute = async () => {
    if (!result || result.device_command.device === "none") return;
    setExecuting(true); setError(null); setSuccess(null);
    try {
      await api.executeSafeCommand(
        layerId,
        result.device_command.device,
        result.device_command.value,
        safeDuration(result.device_command.device, result.device_command.value, result.device_command.duration_minutes),
      );
      setSuccess("Command executed safely.");
    } catch (e: any) { setError(e.message || "Command failed safety validation."); }
    finally { setExecuting(false); }
  };

  const sevCls = {
    Normal: "text-status-healthy border-status-healthy/20 bg-spring-green/10",
    Low: "text-sky-600 border-sky-300/20 bg-sky-50",
    Medium: "text-status-warning border-status-warning/20 bg-amber-50",
    High: "text-orange-600 border-orange-400/20 bg-orange-50",
    Critical: "text-status-critical border-status-critical/20 bg-red-50",
  }[result?.severity || "Normal"];

  return (
    <div className="rounded-lg border border-card-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-forest-green">
          <Sparkles size={18} />
          <h3 className="font-semibold text-ink">AI-First Diagnosis</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={loading}
            className="flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-50">
            <ImageIcon size={15} /> Upload Photo
          </button>
          <button onClick={cameraActive ? captureCameraFrame : startCamera} disabled={loading}
            className="flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-50">
            <Camera size={15} /> {cameraActive ? "Capture" : "Camera"}
          </button>
          {cameraActive && (
            <button onClick={stopCamera} disabled={loading}
              className="grid h-10 w-10 place-items-center rounded-md border border-card-border bg-field-bg text-muted transition hover:bg-red-50 hover:text-status-critical disabled:opacity-50"
              title="Stop camera">
              <Square size={14} />
            </button>
          )}
          <button onClick={handleDiagnose} disabled={loading}
            className="flex items-center gap-2 rounded-md bg-forest-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-green/90 disabled:opacity-50">
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>
      </div>

      {cameraActive && (
        <div className="mb-4 grid gap-4 rounded-md border border-card-border bg-field-bg p-4 md:grid-cols-[260px_minmax(0,1fr)]">
          <video ref={videoRef} autoPlay playsInline muted className="h-44 w-full rounded-md border border-card-border bg-black object-cover" />
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Live Camera Diagnosis</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              Aim at a plant leaf, then press Capture to analyze one frame with the vision diagnosis endpoint.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-status-critical/20 bg-red-50 p-3 text-sm text-status-critical flex items-center gap-2">
          <AlertTriangle size={16} />{error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-status-healthy/20 bg-spring-green/10 p-3 text-sm text-status-healthy flex items-center gap-2">
          <CheckCircle size={16} />{success}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          {imagePreview && (
            <div className="grid gap-4 rounded-md border border-purple-300/30 bg-purple-50 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <img src={imagePreview} alt="Uploaded plant sample" className="h-40 w-full rounded-md border border-card-border object-cover" />
              <div className="flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Vision Diagnosis</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">
                  CropTwin combines this plant image with live farm telemetry before producing the diagnosis below.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-base font-medium text-ink">{result.diagnosis}</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${sevCls}`}>{result.severity}</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold border border-card-border bg-field-bg text-ink/70 flex items-center gap-1">
              <Activity size={12} /> {result.confidence}% Confidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border border-card-border bg-field-bg p-4">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Evidence</h4>
              <ul className="space-y-1">
                {result.evidence.map((ev, i) => (
                  <li key={i} className="text-sm text-ink/80 flex items-start gap-2"><span className="text-muted/40 mt-0.5">•</span> {ev}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-card-border bg-field-bg p-4">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Recommended Actions</h4>
              <ul className="space-y-1">
                {result.recommended_actions.map((act, i) => (
                  <li key={i} className="text-sm text-ink/80 flex items-start gap-2"><span className="text-forest-green mt-0.5">→</span> {act}</li>
                ))}
              </ul>
            </div>
          </div>

          {result.device_command.device !== "none" && (
            <div className="rounded-md border border-forest-green/20 bg-spring-green/10 p-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-ink mb-1">Suggested Device Action</h4>
                <p className="text-sm text-muted">
                  Set <span className="font-mono text-forest-green font-semibold">{result.device_command.device}</span> to{" "}
                  <span className="font-mono text-forest-green font-semibold">{String(result.device_command.value)}</span>
                  {safeDuration(result.device_command.device, result.device_command.value, result.device_command.duration_minutes)
                    ? ` for ${safeDuration(result.device_command.device, result.device_command.value, result.device_command.duration_minutes)}m`
                    : ""}
                </p>
              </div>
              <button onClick={handleExecute} disabled={executing}
                className="flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-4 py-2 text-sm font-semibold text-ink transition hover:bg-spring-green/20 disabled:opacity-50">
                {executing ? "Executing..." : <><Play size={14} /> Execute Safely</>}
              </button>
            </div>
          )}

          <div className="text-sm text-muted italic">Expected outcome: {result.expected_outcome}</div>
        </div>
      )}
    </div>
  );
}
