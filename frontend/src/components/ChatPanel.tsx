import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

import type { FarmLayer } from "../types";

type ChatPanelProps = {
  layer: FarmLayer;
  chat: (question: string, layerId?: string) => Promise<{ answer: string; referenced_layers: string[] }>;
};

export function ChatPanel({ layer, chat }: ChatPanelProps) {
  const [question, setQuestion] = useState(`What happens if I ignore the high humidity in ${layer.name}?`);
  const [answer, setAnswer] = useState(
    `${layer.name} is currently ${layer.status.toLowerCase()} with a health score of ${layer.health_score}.`,
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    const response = await chat(question, layer.id);
    setAnswer(response.answer);
  }

  async function handleSuggestion(suggestion: string) {
    setQuestion(suggestion);
    const response = await chat(suggestion, layer.id);
    setAnswer(response.answer);
  }

  return (
    <div className="rounded-lg border border-card-border bg-white p-4 shadow-card">
      <div>
        <p className="text-xs uppercase text-muted">Chat-to-Farm</p>
        <h2 className="text-lg font-semibold text-ink">Assistant</h2>
      </div>

      <div className="mt-4 rounded-md bg-field-bg p-3 text-sm leading-6 text-muted">{answer}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => handleSuggestion(`What happens if I ignore the warning in ${layer.name}?`)} className="rounded border border-card-border bg-field-bg px-2 py-1 text-xs text-muted transition hover:bg-spring-green/20 hover:text-ink">What if I ignore it?</button>
        <button type="button" onClick={() => handleSuggestion("What should I do next?")} className="rounded border border-card-border bg-field-bg px-2 py-1 text-xs text-muted transition hover:bg-spring-green/20 hover:text-ink">What to do next?</button>
        <button type="button" onClick={() => handleSuggestion("Explain auto mode")} className="rounded border border-card-border bg-field-bg px-2 py-1 text-xs text-muted transition hover:bg-spring-green/20 hover:text-ink">Explain auto mode</button>
        <button type="button" onClick={() => handleSuggestion("Overall farm sustainability")} className="rounded border border-card-border bg-field-bg px-2 py-1 text-xs text-muted transition hover:bg-spring-green/20 hover:text-ink">Sustainability info</button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-card-border bg-field-bg px-3 py-2 text-sm text-ink outline-none transition focus:border-forest-green/60"
        />
        <button
          type="submit"
          className="grid h-10 w-10 place-items-center rounded-md bg-forest-green text-white transition hover:bg-forest-green/90"
          title="Send"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
