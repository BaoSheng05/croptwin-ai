import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle, BrainCircuit, Sparkles, Image as ImageIcon, Square } from "lucide-react";

type Diagnosis = {
  layer_id: string; crop: string; diagnosis: string; severity: string;
  confidence: number; causes: string[]; recommended_actions: string[]; expected_outcome: string;
};

type DiagnosisPanelProps = { layerId: string };

export function DiagnosisPanel({ layerId }: DiagnosisPanelProps) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

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
      setImagePreview(reader.result as string);
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

  async function submitImage(imageBase64: string) {
    setImagePreview(imageBase64);
    setLoading(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${apiBaseUrl}/api/diagnosis/image`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer_id: layerId, image_base64: imageBase64 }),
      });
      if (res.ok) setDiagnosis(await res.json());
    } catch (err) { console.error("Image diagnosis failed", err); }
    finally { setLoading(false); }
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Camera permission denied.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function captureCameraFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    await submitImage(canvas.toDataURL("image/jpeg", 0.86));
  }

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
            <h2 className="text-lg font-semibold text-ink">Vision & Data Diagnosis</h2>
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
            onClick={cameraActive ? captureCameraFrame : startCamera}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border border-card-border bg-field-bg px-4 py-2 text-xs font-semibold text-muted transition hover:bg-spring-green/20 hover:text-ink disabled:opacity-50"
            title="Use live camera for visual diagnosis"
          >
            <Camera size={14} /> <span className="hidden sm:inline">{cameraActive ? "Capture" : "Camera"}</span>
          </button>
          {cameraActive && (
            <button
              onClick={stopCamera}
              disabled={loading}
              className="grid h-8 w-8 place-items-center rounded-md border border-card-border bg-field-bg text-muted transition hover:bg-red-50 hover:text-status-critical disabled:opacity-50"
              title="Stop camera"
            >
              <Square size={13} />
            </button>
          )}
          <button
            onClick={runDiagnosis} disabled={loading}
            className="flex items-center gap-2 rounded-md bg-forest-green px-4 py-2 text-xs font-semibold text-white transition hover:bg-forest-green/90 disabled:opacity-50"
          >
            {loading ? <span className="animate-pulse">Analyzing...</span> : <><Sparkles size={14} /> Data Diagnosis</>}
          </button>
        </div>
      </div>

      {(cameraActive || cameraError) && (
        <div className="mb-5 rounded-lg border border-card-border bg-field-bg p-4">
          {cameraError ? (
            <p className="text-sm text-status-critical">{cameraError}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <video ref={videoRef} autoPlay playsInline muted className="h-44 w-full rounded-lg border border-card-border bg-black object-cover" />
              <div className="flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Live Camera Diagnosis</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">
                  Aim the camera at a plant leaf, then capture a frame. The image is sent to the same vision endpoint as uploads.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {diagnosis ? (
        <div className="space-y-5 animate-fade-up">
          {imagePreview && (
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <img
                src={imagePreview}
                alt="Uploaded plant sample"
                className="h-40 w-full rounded-lg border border-card-border object-cover"
              />
              <div className="rounded-lg border border-purple-300/30 bg-purple-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">AI Vision Diagnosis Demo</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">
                  CropTwin combines the uploaded leaf image with live humidity, moisture, pH, and temperature telemetry before producing a diagnosis.
                </p>
              </div>
            </div>
          )}
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
