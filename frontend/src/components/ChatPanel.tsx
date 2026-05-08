import { FormEvent, useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Cpu } from "lucide-react";
import type { ChatMessage, ChatResponse, FarmLayer } from "../types";
import { useSettings } from "../contexts/SettingsContext";

type Message = ChatMessage & { mode?: ChatResponse["mode"] };

type ChatPanelProps = {
  layer: FarmLayer;
  chat: (
    question: string,
    layerId?: string,
    history?: ChatMessage[],
  ) => Promise<ChatResponse>;
  height?: number;
  compact?: boolean;
};

const suggestions = [
  { emoji: "⚠️", text: "What if I ignore it?" },
  { emoji: "🎯", text: "What should I do next?" },
  { emoji: "🤖", text: "Explain auto mode" },
  { emoji: "🌱", text: "Farm sustainability" },
  { emoji: "📊", text: "Give me an overall summary" },
];

export function ChatPanel({ layer, chat, height = 560, compact = false }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const { settings, localizeText } = useSettings();
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: localizeText(`Hi! I'm CropTwin AI. I'm monitoring ${layer.name} (${layer.crop}) — health score ${layer.health_score}. Ask me anything about your farm.`) },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function modeLabel(mode?: string) {
    if (mode === "deepseek") return "DeepSeek AI";
    if (mode === "gemini" || mode === "ai") return "Gemini AI";
    if (mode === "local_fallback") return "Local farm logic";
    if (mode === "unconfigured") return "AI not configured";
    if (mode === "ai_error") return "AI request failed";
    return "AI assistant";
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const response = await chat(text, layer.id, history);
      setMessages((prev) => [...prev, { role: "ai", text: localizeText(response.answer), mode: response.mode }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(question);
  }

  return (
    <div className="flex flex-col rounded-lg border border-card-border bg-white overflow-hidden shadow-card" style={{ height }}>
      {/* Messages */}
      <div className={`flex-1 overflow-y-auto ${compact ? "p-3" : "p-5"} space-y-4`}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 animate-fade-up ${msg.role === "user" ? "flex-row-reverse" : ""}`} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
              msg.role === "ai"
                ? "bg-spring-green/30 text-forest-green"
                : "bg-field-bg text-muted"
            }`}>
              {msg.role === "ai" ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
              msg.role === "ai"
                ? "bg-field-bg border border-card-border text-ink/80"
                : "bg-spring-green/20 border border-forest-green/20 text-ink"
            }`}>
              {msg.text}
              {msg.role === "ai" && msg.mode && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted/60">
                  {msg.mode === "unconfigured" || msg.mode === "ai_error" || msg.mode === "local_fallback" ? <Cpu size={10} /> : <Sparkles size={10} />}
                  {modeLabel(msg.mode)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-fade-up">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-spring-green/30 text-forest-green">
              <Bot size={14} />
            </div>
            <div className="rounded-lg bg-field-bg border border-card-border px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-forest-green/40 animate-bounce" style={{ animationDelay: "0s" }} />
                <span className="h-2 w-2 rounded-full bg-forest-green/40 animate-bounce" style={{ animationDelay: "0.15s" }} />
                <span className="h-2 w-2 rounded-full bg-forest-green/40 animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className={`${compact ? "px-3" : "px-5"} flex gap-1.5 py-2 overflow-x-auto border-t border-card-border`}>
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => send(s.text)}
            disabled={loading}
            className="shrink-0 rounded-full border border-card-border bg-field-bg px-3 py-1.5 text-xs text-muted transition hover:bg-spring-green/20 hover:text-ink disabled:opacity-50"
          >
            {s.emoji} {s.text}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className={`${compact ? "p-3" : "p-4"} flex gap-2 border-t border-card-border bg-field-bg/50`}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your farm..."
          disabled={loading}
          className="min-w-0 flex-1 rounded-md border border-card-border bg-white px-3 py-2 text-sm text-ink placeholder-muted/50 outline-none transition focus:border-forest-green/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-forest-green text-white transition hover:bg-forest-green/90 disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
