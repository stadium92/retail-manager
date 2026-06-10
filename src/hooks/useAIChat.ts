import { useState } from 'react';
import { AIService } from '@/services/AIService';

type Message = { role: "user" | "assistant"; content: string; timestamp: Date };

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (input: string, contextData?: any) => {
    const userMsg: Message = { role: "user", content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantContent = "";
    const upsertAssistant = (nextChunk: string) => {
      assistantContent += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: "assistant", content: assistantContent, timestamp: new Date() }];
      });
    };

    try {
      // Prepare messages with context if provided
      const messagesToSend = contextData 
        ? [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: `${input}\n\nContext Data: ${JSON.stringify(contextData)}` }
          ]
        : [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user" as const, content: input }];

      await AIService.streamChat({
        messages: messagesToSend,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      setMessages(prev => prev.filter(m => m !== userMsg));
    }
  };

  const clearMessages = () => setMessages([]);

  return { messages, sendMessage, isLoading, clearMessages };
}
