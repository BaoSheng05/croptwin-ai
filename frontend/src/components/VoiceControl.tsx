import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";

type VoiceControlProps = {
  onCommand: (layerId: string, device: string, value: boolean | number) => Promise<unknown>;
  onSafeCommand?: (layerId: string, device: string, value: boolean | number, duration?: number) => Promise<unknown>;
  onNavigate: (path: string) => void;
};

const DEVICE_MAP: Record<string, string> = {
  fan: "fan", pump: "pump", water: "pump", watering: "pump", irrigate: "pump", irrigation: "pump",
  misting: "misting", mist: "misting", auto: "auto_mode", "auto mode": "auto_mode",
};
const LAYER_MAP: Record<string, string> = {
  "layer 1": "a_01", "layer 2": "b_02", "layer 3": "c_01", "layer one": "a_01", "layer two": "b_02", "layer three": "c_01",
  "layer a 1": "a_01", "layer a-1": "a_01", "a-1": "a_01",
  "layer a 2": "a_02", "layer a-2": "a_02", "a-2": "a_02",
  "layer a 3": "a_03", "layer a-3": "a_03", "a-3": "a_03",
  "layer a 4": "a_04", "layer a-4": "a_04", "a-4": "a_04",
  "layer a 5": "a_05", "layer a-5": "a_05", "a-5": "a_05",
  "a 1": "a_01", "a 2": "a_02", "a 3": "a_03", "a 4": "a_04", "a 5": "a_05",
  "b 1": "b_01", "b 2": "b_02", "b 3": "b_03", "b 4": "b_04", "b 5": "b_05",
  "c 1": "c_01", "c 2": "c_02", "c 3": "c_03", "c 4": "c_04", "c 5": "c_05",
  lettuce: "a_01", basil: "b_01", strawberry: "c_01", spinach: "a_03", mint: "b_03", tomato: "c_03",
};
const NAV_MAP: Record<string, string> = {
  dashboard: "/", overview: "/", layers: "/layers", "layer detail": "/layers", control: "/control",
  "control panel": "/control", alerts: "/alerts", chat: "/chat", assistant: "/chat",
  settings: "/settings", recipe: "/settings", "what if": "/whatif", predict: "/whatif", prediction: "/whatif", simulator: "/whatif",
};

function parseCommand(transcript: string): { type: string; detail: string; layerId?: string; device?: string; value?: boolean } | null {
  const t = transcript.toLowerCase().trim().replace(/[._]/g, " ").replace(/\s+/g, " ");
  for (const [keyword, path] of Object.entries(NAV_MAP)) { if (t.includes(keyword)) return { type: "navigate", detail: path }; }
  const wateringIntent = /\b(water|watering|irrigate|irrigating|irrigation)\b/.test(t);
  if (wateringIntent) {
    let layerId = "a_01";
    for (const [lk, lid] of Object.entries(LAYER_MAP)) { if (t.includes(lk)) { layerId = lid; break; } }
    return { type: "safeDevice", detail: "Water for 2 minutes", layerId, device: "pump", value: true };
  }
  const turnMatch = t.match(/turn\s+(on|off)\s+(.+?)(?:\s+(?:in|on|for)\s+(.+))?$/);
  if (turnMatch) {
    const value = turnMatch[1] === "on";
    const device = DEVICE_MAP[turnMatch[2]?.trim()];
    const layerId = turnMatch[3]?.trim() ? LAYER_MAP[turnMatch[3].trim()] : "b_01";
    if (device) return { type: "device", detail: `${value ? "On" : "Off"}: ${device}`, layerId: layerId || "b_01", device, value };
  }
  for (const [keyword, device] of Object.entries(DEVICE_MAP)) {
    if (t.includes(keyword)) {
      const value = !t.includes("off");
      let layerId = "b_01";
      for (const [lk, lid] of Object.entries(LAYER_MAP)) { if (t.includes(lk)) { layerId = lid; break; } }
      return { type: device === "pump" && value ? "safeDevice" : "device", detail: `${value ? "On" : "Off"}: ${device}`, layerId, device, value };
    }
  }
  return null;
}

export function VoiceControl({ onCommand, onSafeCommand, onNavigate }: VoiceControlProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");
  const recognitionRef = useRef<any>(null);
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false); setStatus("idle");
  }, []);

  const startListening = useCallback(() => {
    if (!supported) { setFeedback("Speech not supported"); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onstart = () => { setListening(true); setStatus("listening"); setFeedback("Listening..."); setTranscript(""); };
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text); setStatus("processing"); setFeedback("Processing...");
      const cmd = parseCommand(text);
      if (!cmd) { setStatus("error"); setFeedback(`Didn't understand: "${text}"`); setTimeout(() => setStatus("idle"), 3000); return; }
      try {
        if (cmd.type === "navigate") { onNavigate(cmd.detail); setStatus("success"); setFeedback(`Navigating to ${cmd.detail}`); }
        else if (cmd.type === "safeDevice" && cmd.layerId && cmd.device) {
          if (onSafeCommand) await onSafeCommand(cmd.layerId, cmd.device, cmd.value!, 2);
          else await onCommand(cmd.layerId, cmd.device, cmd.value!);
          setStatus("success");
          setFeedback(`✓ ${cmd.layerId} ${cmd.device} → ${cmd.value ? "ON" : "OFF"}${cmd.device === "pump" && cmd.value ? " for 2m" : ""}`);
        }
        else if (cmd.type === "device" && cmd.layerId && cmd.device) { await onCommand(cmd.layerId, cmd.device, cmd.value!); setStatus("success"); setFeedback(`✓ ${cmd.device} → ${cmd.value ? "ON" : "OFF"}`); }
      } catch { setStatus("error"); setFeedback("Command failed"); }
      setTimeout(() => { setStatus("idle"); setFeedback(""); }, 3000);
    };
    recognition.onerror = (event: any) => { setStatus("error"); setFeedback(`Error: ${event.error}`); setListening(false); setTimeout(() => setStatus("idle"), 3000); };
    recognition.onend = () => { setListening(false); };
    recognition.start();
  }, [supported, onCommand, onNavigate]);

  if (!supported) return null;

  return (
    <div className="relative flex items-center gap-2">
      {feedback && (
        <div
          className="rounded-md px-3 py-1 text-xs font-medium transition-all"
          style={
            status === "listening" ? { backgroundColor: "rgba(125,61,152,0.15)", color: "#7D3C98" }
            : status === "success" ? { backgroundColor: "rgba(30,132,73,0.15)", color: "#1E8449" }
            : status === "error" ? { backgroundColor: "rgba(192,57,43,0.15)", color: "#C0392B" }
            : { backgroundColor: "rgba(0,0,0,0.08)", color: "#2D4A2D" }
          }
        >
          {feedback}
        </div>
      )}
      <button
        onClick={listening ? stopListening : startListening}
        className="relative grid h-9 w-9 place-items-center rounded-lg transition-all"
        style={listening
          ? { backgroundColor: "#7D3C98", color: "#FFFFFF", boxShadow: "0 2px 10px rgba(125,61,152,0.4)" }
          : { backgroundColor: "rgba(255,255,255,0.6)", border: "1px solid rgba(34,139,34,0.3)", color: "#000000" }
        }
        title={listening ? "Stop listening" : "Voice command"}
      >
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
        {listening && (
          <>
            <span className="absolute inset-0 animate-ping rounded-lg" style={{ backgroundColor: "rgba(125,61,152,0.2)" }} />
          </>
        )}
      </button>
    </div>
  );
}
