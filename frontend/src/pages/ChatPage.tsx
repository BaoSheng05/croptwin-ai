import { useOutletContext } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import type { FarmStreamContext } from "../App";
import { useState } from "react";

export default function ChatPage() {
  const { farm, chat } = useOutletContext<FarmStreamContext>();
  const [selected, setSelected] = useState(farm.layers[0].id);

  const selectedLayer = farm.layers.find(l => l.id === selected) || farm.layers[0];

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-ink">Chat-to-Farm Assistant</h2>
      <div className="flex gap-2">
        {farm.layers.map(l => (
          <button 
            key={l.id} 
            onClick={() => setSelected(l.id)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={selected === l.id
              ? { backgroundColor: "#228B22", color: "#FFFFFF" }
              : { backgroundColor: "#EAF5EA", color: "#000000", border: "1px solid #B3D4B3" }
            }
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="max-w-2xl">
        <ChatPanel layer={selectedLayer} chat={chat} />
      </div>
    </div>
  );
}
