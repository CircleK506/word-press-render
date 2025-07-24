// ai-router.ts

import { askQwen } from './qwen';
import { askStrategist } from './strategist';

type AIRequest = {
  userId: string;
  input: string;
  language?: string;
};

export async function routeAIRequest(req: AIRequest): Promise<string> {
  const { userId, input, language } = req;

  // ✅ Fast path: Short questions go to Qwen (UI chat, translation, CRM help)
  if (input.length < 280 && !input.match(/strategy|plan|sequence|long-form|campaign/i)) {
    const quickReply = await askQwen({ input, userId, language });
    return `[Qwen] ${quickReply}`;
  }

  // 🧠 Complex queries go to Mixtral / LLaMA
  const strategicResponse = await askStrategist({ input, userId, language });
  return `[Strategist] ${strategicResponse}`;
}
