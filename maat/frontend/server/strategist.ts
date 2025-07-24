// strategist.ts

import axios from 'axios';

export async function askStrategist({
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
      model: 'mixtral',
      prompt: `Respond in ${language}. ${input}`,
      stream: false,
    });
    return response.data.response || 'No response from strategist.';
  } catch (err) {
    console.error('Strategist failed:', err.message);
    return 'Strategist unavailable.';
  }
}
