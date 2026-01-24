import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken || !supabaseUrl || !supabaseKey) {
      console.error('Missing configuration');
      return new Response(
        JSON.stringify({ error: 'Configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();

    // Handle Telegram webhook callback
    if (body.callback_query) {
      const callbackData = body.callback_query.data;
      const chatId = body.callback_query.message.chat.id;
      const messageId = body.callback_query.message.message_id;

      if (callbackData.startsWith('confirm_payment_')) {
        const paymentId = callbackData.replace('confirm_payment_', '');

        // Get payment and update status
        const { data: payment, error: getError } = await supabase
          .from('payments')
          .select('*, links(id, short_code)')
          .eq('id', paymentId)
          .single();

        if (getError || !payment) {
          await answerCallback(botToken, body.callback_query.id, '❌ Payment not found');
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (payment.status === 'confirmed') {
          await answerCallback(botToken, body.callback_query.id, '✅ Already confirmed');
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Confirm payment
        const { error: updateError } = await supabase
          .from('payments')
          .update({ status: 'confirmed' })
          .eq('id', paymentId);

        if (updateError) {
          console.error('Update error:', updateError);
          await answerCallback(botToken, body.callback_query.id, '❌ Failed to confirm');
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Activate the link
        if (payment.link_id) {
          await supabase
            .from('links')
            .update({ status: 'active' })
            .eq('id', payment.link_id);
        }

        // Update the Telegram message
        const updatedText = body.callback_query.message.text + '\n\n✅ *CONFIRMED* by admin';
        await editMessage(botToken, chatId, messageId, updatedText);
        await answerCallback(botToken, body.callback_query.id, '✅ Payment confirmed! Link activated.');
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle regular API call to confirm payment
    if (body.action === 'confirm_payment' && body.paymentId) {
      const { data: payment, error: getError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', body.paymentId)
        .single();

      if (getError || !payment) {
        return new Response(
          JSON.stringify({ error: 'Payment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Confirm payment
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: 'confirmed' })
        .eq('id', body.paymentId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to confirm payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Activate the link
      if (payment.link_id) {
        await supabase
          .from('links')
          .update({ status: 'active' })
          .eq('id', payment.link_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Payment confirmed and link activated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function answerCallback(botToken: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: true,
    }),
  });
}

async function editMessage(botToken: string, chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
}
