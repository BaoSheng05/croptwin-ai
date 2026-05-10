import { useMemo } from "react";
import { Bot, MessageSquare, Sparkles, X } from "lucide-react";

import { ChatPanel } from "./ChatPanel";
import type { ChatMessage, ChatResponse, FarmLayer } from "../types";
import { usePersistentBoolean, usePersistentString } from "../hooks/usePersistentState";

type FloatingChatAssistantProps = {
  layers: FarmLayer[];
  chat: (
    question: string,
    layerId?: string,
    history?: ChatMessage[],
  ) => Promise<ChatResponse>;
};

export function FloatingChatAssistant({ layers, chat }: FloatingChatAssistantProps) {
  const [open, setOpen] = usePersistentBoolean("croptwin_assistant_open", false);
  const [selectedLayerId, setSelectedLayerId] = usePersistentString("croptwin_assistant_layer", layers[0]?.id ?? "");

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? layers[0],
    [layers, selectedLayerId],
  );

  if (!selectedLayer) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] flex-col items-end">
      {open && (
        <section className="mb-3 w-[380px] max-w-full overflow-hidden rounded-lg border border-card-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-card-border bg-field-bg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-spring-green/30 text-forest-green">
                <Bot size={15} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">CropTwin Assistant</p>
                <p className="text-xs text-muted">Ask about farm status or next action</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md border border-card-border bg-white text-muted transition hover:text-ink"
              aria-label="Close assistant"
              title="Close assistant"
            >
              <X size={15} />
            </button>
          </div>

          <div className="border-b border-card-border bg-white px-3 py-2">
            <select
              value={selectedLayer.id}
              onChange={(event) => setSelectedLayerId(event.target.value)}
              className="w-full rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs font-medium text-ink outline-none focus:border-forest-green/60"
              aria-label="Assistant target layer"
            >
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name} · {layer.crop} · Health {layer.health_score}
                </option>
              ))}
            </select>
          </div>

          <ChatPanel key={selectedLayer.id} layer={selectedLayer} chat={chat} height={430} compact />
        </section>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="mb-2 flex items-center gap-2 rounded-full border border-forest-green/25 bg-white px-3 py-2 text-xs font-semibold text-forest-green shadow-xl transition hover:-translate-y-0.5 hover:bg-spring-green/10"
          aria-label="Open CropTwin assistant helper label"
          title="Open CropTwin assistant"
        >
          <Sparkles size={14} />
          Ask AI Assistant
        </button>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-forest-green text-white shadow-2xl transition hover:bg-forest-green/90 focus:outline-none focus:ring-4 focus:ring-forest-green/25"
        aria-label="Open CropTwin assistant"
        title="CropTwin assistant"
      >
        {!open && (
          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md">
            AI
          </span>
        )}
        {open ? <X size={24} /> : <MessageSquare size={26} />}
      </button>
    </div>
  );
}
