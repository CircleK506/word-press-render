import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { bot_id, user_id } = req.body;

  const { data: bot } = await supabase.from('bots').select('*').eq('id', bot_id).single();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: bot.title,
          description: bot.description,
        },
        unit_amount: bot.price * 100,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `https://zapscout.io/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://zapscout.io/cancel`,
    metadata: { bot_id, user_id }
  });

  res.json({ id: session.id });
}
