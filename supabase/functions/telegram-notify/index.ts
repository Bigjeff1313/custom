import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: 'domain_added' | 'payment_confirmed';
  domain?: string;
  userEmail?: string;
  amount?: number;
  currency?: string;
  linkId?: string;
  shortCode?: string;
  transactionHash?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
    
    if (!botToken || !chatId) {
      console.error('Missing Telegram configuration');
      return new Response(
        JSON.stringify({ error: 'Telegram configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let message = '';

    if (payload.type === 'domain_added') {
      message = `🌐 *New Custom Domain Added*\n\n` +
        `📍 Domain: \`${payload.domain}\`\n` +
        `👤 User: ${payload.userEmail || 'Unknown'}\n\n` +
        `Please verify this domain.`;
    } else if (payload.type === 'payment_confirmed') {
      message = `💰 *Payment Notification*\n\n` +
        `💵 Amount: ${payload.amount} ${payload.currency}\n` +
        `👤 User: ${payload.userEmail || 'Unknown'}\n` +
        `🔗 Link ID: \`${payload.linkId || 'N/A'}\`\n` +
        `📎 Short Code: \`${payload.shortCode || 'N/A'}\`\n` +
        `🔐 TX Hash: \`${payload.transactionHash || 'Pending'}\``;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid notification type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending Telegram notification: ${payload.type}`);

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Telegram API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification', details: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Telegram notification sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
