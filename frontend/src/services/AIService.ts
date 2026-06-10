type Message = { role: "user" | "assistant"; content: string };

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: "inventory" | "sales" | "worker" | "operations";
  priority: "high" | "medium" | "low";
  confidence: number;
  timestamp: Date;
}

export class AIService {
  private static resolveUrl(path: string): string | null {
    const base = import.meta.env.VITE_SUPABASE_URL || "https://fpvrbxmbrotdwlyebqv.supabase.co";
    if (!base) return null;
    return `${base.replace(/\/$/, '')}${path}`;
  }

  static async streamChat({
    messages,
    onDelta,
    onDone,
  }: {
    messages: Message[];
    onDelta: (deltaText: string) => void;
    onDone: () => void;
  }) {
    if (!navigator.onLine) {
      throw new Error('AI chat requires an online connection.');
    }

    const url = this.resolveUrl('/functions/v1/ai-chat');
    if (!url) {
      throw new Error('AI chat endpoint is not configured.');
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdnJieG1icm90b3dkbHllYnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzE1MjMsImV4cCI6MjA5NjY0NzUyM30.8_mjBGr1FpYE20cc22iehEf0Xi9Fix2M0d_SSHIDQuI"}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok) {
      let errorMsg = "Failed to start stream";
      try {
        const errorData = await resp.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        errorMsg = `HTTP Error ${resp.status}`;
      }
      throw new Error(errorMsg);
    }
    
    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore partial leftovers */ }
      }
    }

    onDone();
  }

  static async getSuggestions(salesData: any, inventoryData: any, storeId: string): Promise<Suggestion[]> {
    try {
      if (!navigator.onLine) return [];

      const url = this.resolveUrl('/functions/v1/ai-suggestions');
      if (!url) return [];

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwdnJieG1icm90b3dkbHllYnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzE1MjMsImV4cCI6MjA5NjY0NzUyM30.8_mjBGr1FpYE20cc22iehEf0Xi9Fix2M0d_SSHIDQuI"}`,
        },
        body: JSON.stringify({ salesData, inventoryData, storeId }),
      });

      if (!resp.ok) throw new Error("Failed to get suggestions");
      const data = await resp.json();
      
      return data.suggestions.map((s: any, idx: number) => ({
        ...s,
        id: `suggestion-${Date.now()}-${idx}`,
        timestamp: new Date(),
      }));
    } catch (error) {
      console.error("Error getting suggestions:", error);
      return [];
    }
  }
}
