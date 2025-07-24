// qwen.ts

import axios from 'axios';

export async function askQwen({
  input,
  userId,
  language = 'en',
}: {
  input: string;
  userId: string;
  language?: string;
}): Promise<string> {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'qwen:0.5b',
      prompt: `Respond in ${language}. ${input}`,
      stream: false,
    });
    return response.data.response || 'No response from Qwen.';
  } catch (err) {
    console.error('Qwen failed:', err.message);
    return 'Qwen unavailable.';
  }
}
