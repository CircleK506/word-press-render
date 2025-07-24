// server.ts
import express from 'express';
import bodyParser from 'body-parser';
import { routeAIRequest } from './ai-router';

const app = express();
app.use(bodyParser.json());

app.post('/api/ai', async (req, res) => {
  try {
    const response = await routeAIRequest(req.body);
    res.json({ response });
  } catch (err) {
    console.error('Router error:', err);
    res.status(500).json({ error: 'AI routing failed' });
  }
});

app.listen(3000, () => {
  console.log('🚀 AI Router running on http://localhost:3000/api/ai');
});
