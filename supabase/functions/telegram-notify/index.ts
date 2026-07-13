import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  type: 'domain_added' | 'payment_confirmed' | 'payment_submitted' | 'fund_deposit';
  domain?: string;
  userEmail?: string;
  amount?: number;
  currency?: string;
  linkId?: string;
  shortCode?: string;
  transactionHash?: string;
  paymentId?: string;
  transactionId?: string;
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    if (!botToken || !chatId) {
      console.error('Missing Telegram configuration');
      return new Response(
        JSON.stringify({ error: 'Telegram configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let message = '';
    let inlineKeyboard = null;

    if (payload.type === 'domain_added') {
      message = `🌐 *New Custom Domain Added*\n\n` +
        `📍 Domain: \`${payload.domain}\`\n` +
        `👤 User: ${payload.userEmail || 'Unknown'}\n\n` +
        `Please verify this domain.`;
    } else if (payload.type === 'payment_submitted' || payload.type === 'payment_confirmed') {
      message = `💰 *Payment Submitted - Awaiting Confirmation*\n\n` +
        `💵 Amount: ${payload.amount} ${payload.currency}\n` +
        `👤 User: ${payload.userEmail || 'Unknown'}\n` +
        `🔗 Link ID: \`${payload.linkId || 'N/A'}\`\n` +
        `📎 Short Code: \`${payload.shortCode || 'N/A'}\`\n` +
        `🔐 TX Hash: \`${payload.transactionHash || 'Pending'}\`\n\n` +
        `⚠️ *Click the button below to confirm and activate the link*`;
      
      // Add inline keyboard with confirm button
      if (payload.paymentId) {
        inlineKeyboard = {
          inline_keyboard: [[
            {
              text: '✅ Confirm Payment & Activate Link',
              callback_data: `confirm_payment_${payload.paymentId}`
            }
          ]]
        };
      }
    } else if (payload.type === 'fund_deposit') {
      message = `💳 *New Fund Deposit Request*\n\n` +
        `👤 *Deposited by:* ${payload.userEmail || 'Unknown user'}\n` +
        `💵 *Amount:* $${payload.amount} (${payload.currency})\n` +
        `📝 *Transaction ID:* \`${payload.transactionId || 'N/A'}\`\n\n` +
        `⚠️ *Click the button below to confirm this deposit and credit the user's balance*`;
      
      // Add inline keyboard for fund deposits
      if (payload.transactionId) {
        inlineKeyboard = {
          inline_keyboard: [[
            {
              text: '✅ Confirm Deposit',
              callback_data: `confirm_deposit_${payload.transactionId}`
            }
          ]]
        };
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid notification type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending Telegram notification: ${payload.type}`);

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const telegramPayload: any = {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    };

    if (inlineKeyboard) {
      telegramPayload.reply_markup = inlineKeyboard;
    }

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telegramPayload),
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