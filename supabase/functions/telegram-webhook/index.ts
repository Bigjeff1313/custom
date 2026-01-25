import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message: { message_id: number; chat: { id: number }; text?: string };
    data: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const update: TelegramUpdate = await req.json();

    console.log('Received Telegram update:', JSON.stringify(update));

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const callbackId = update.callback_query.id;

      // Verify admin
      if (chatId.toString() !== adminChatId) {
        await answerCallback(botToken, callbackId, '❌ Unauthorized', true);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle payment confirmation
      if (callbackData.startsWith('confirm_payment_')) {
        const paymentId = callbackData.replace('confirm_payment_', '');
        
        // Get payment details
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .select('*, links(short_code, original_url)')
          .eq('id', paymentId)
          .single();

        if (paymentError || !payment) {
          await answerCallback(botToken, callbackId, '❌ Payment not found', true);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (payment.status === 'confirmed') {
          await answerCallback(botToken, callbackId, '⚠️ Already confirmed', true);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update payment status
        const { error: updatePaymentError } = await supabase
          .from('payments')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', paymentId);

        if (updatePaymentError) {
          await answerCallback(botToken, callbackId, '❌ Failed to confirm payment', true);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Activate the link
        if (payment.link_id) {
          await supabase
            .from('links')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', payment.link_id);
        }

        // Update the message
        const newText = update.callback_query.message.text?.replace(
          '⚠️ *Click the button below to confirm and activate the link*',
          '✅ *Payment Confirmed & Link Activated*'
        ) || '✅ Payment Confirmed';

        await editMessage(botToken, chatId, messageId, newText + '\n\n✅ Confirmed by admin');
        await answerCallback(botToken, callbackId, '✅ Payment confirmed & link activated!', false);
      }

      // Handle fund deposit confirmation
      if (callbackData.startsWith('confirm_deposit_')) {
        const transactionId = callbackData.replace('confirm_deposit_', '');
        
        const { data: transaction, error: txError } = await supabase
          .from('fund_transactions')
          .select('*')
          .eq('id', transactionId)
          .single();

        if (txError || !transaction) {
          await answerCallback(botToken, callbackId, '❌ Transaction not found', true);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (transaction.status === 'confirmed') {
          await answerCallback(botToken, callbackId, '⚠️ Already confirmed', true);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update transaction status
        await supabase
          .from('fund_transactions')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', transactionId);

        // Update user funds
        const { data: existingFunds } = await supabase
          .from('user_funds')
          .select('*')
          .eq('user_id', transaction.user_id)
          .single();

        if (existingFunds) {
          await supabase
            .from('user_funds')
            .update({
              balance: existingFunds.balance + transaction.amount,
              total_deposited: existingFunds.total_deposited + transaction.amount,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', transaction.user_id);
        } else {
          await supabase
            .from('user_funds')
            .insert({
              user_id: transaction.user_id,
              balance: transaction.amount,
              total_deposited: transaction.amount
            });
        }

        const newText = update.callback_query.message.text?.replace(
          '⚠️ *Please verify payment and confirm in admin dashboard*',
          '✅ *Deposit Confirmed & Balance Updated*'
        ) || '✅ Deposit Confirmed';

        await editMessage(botToken, chatId, messageId, newText + '\n\n✅ Confirmed by admin');
        await answerCallback(botToken, callbackId, '✅ Deposit confirmed!', false);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle text commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      // Verify admin for commands
      if (chatId.toString() !== adminChatId) {
        await sendMessage(botToken, chatId, '❌ Unauthorized. This bot is for admin use only.');
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (text === '/start') {
        await sendMessage(botToken, chatId, 
          '🤖 *Link Shortener Admin Bot*\n\n' +
          'Commands:\n' +
          '/stats - View dashboard stats\n' +
          '/pending - View pending payments\n' +
          '/deposits - View pending deposits\n' +
          '/links - View recent links\n' +
          '/help - Show this message',
          'Markdown'
        );
      } else if (text === '/stats') {
        const { data: links } = await supabase.from('links').select('id, status');
        const { data: payments } = await supabase.from('payments').select('id, status, amount');
        const { data: deposits } = await supabase.from('fund_transactions').select('id, status, amount');

        const totalLinks = links?.length || 0;
        const activeLinks = links?.filter(l => l.status === 'active').length || 0;
        const pendingPayments = payments?.filter(p => p.status === 'pending').length || 0;
        const confirmedPayments = payments?.filter(p => p.status === 'confirmed').length || 0;
        const pendingDeposits = deposits?.filter(d => d.status === 'pending').length || 0;

        await sendMessage(botToken, chatId,
          '📊 *Dashboard Stats*\n\n' +
          `🔗 Total Links: ${totalLinks}\n` +
          `✅ Active Links: ${activeLinks}\n` +
          `⏳ Pending Payments: ${pendingPayments}\n` +
          `💰 Confirmed Payments: ${confirmedPayments}\n` +
          `💳 Pending Deposits: ${pendingDeposits}`,
          'Markdown'
        );
      } else if (text === '/pending') {
        const { data: payments } = await supabase
          .from('payments')
          .select('*, links(short_code)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!payments || payments.length === 0) {
          await sendMessage(botToken, chatId, '✅ No pending payments');
        } else {
          let msg = '⏳ *Pending Payments*\n\n';
          for (const p of payments) {
            msg += `💵 ${p.amount} ${p.currency}\n`;
            msg += `📎 Code: \`${p.links?.short_code || 'N/A'}\`\n`;
            msg += `🔐 TX: \`${p.transaction_hash || 'None'}\`\n\n`;
          }
          
          const keyboard = {
            inline_keyboard: payments.map(p => [{
              text: `✅ Confirm ${p.amount} ${p.currency}`,
              callback_data: `confirm_payment_${p.id}`
            }])
          };

          await sendMessage(botToken, chatId, msg, 'Markdown', keyboard);
        }
      } else if (text === '/deposits') {
        const { data: deposits } = await supabase
          .from('fund_transactions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!deposits || deposits.length === 0) {
          await sendMessage(botToken, chatId, '✅ No pending deposits');
        } else {
          let msg = '💳 *Pending Deposits*\n\n';
          for (const d of deposits) {
            msg += `💵 $${d.amount} (${d.currency})\n`;
            msg += `📝 ID: \`${d.id.slice(0, 8)}...\`\n\n`;
          }
          
          const keyboard = {
            inline_keyboard: deposits.map(d => [{
              text: `✅ Confirm $${d.amount}`,
              callback_data: `confirm_deposit_${d.id}`
            }])
          };

          await sendMessage(botToken, chatId, msg, 'Markdown', keyboard);
        }
      } else if (text === '/links') {
        const { data: links } = await supabase
          .from('links')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!links || links.length === 0) {
          await sendMessage(botToken, chatId, '📭 No links yet');
        } else {
          let msg = '🔗 *Recent Links*\n\n';
          for (const l of links) {
            const statusEmoji = l.status === 'active' ? '✅' : l.status === 'pending_payment' ? '⏳' : '❌';
            msg += `${statusEmoji} \`${l.short_code}\`\n`;
            msg += `🌐 ${l.original_url.slice(0, 40)}...\n`;
            msg += `👆 Clicks: ${l.click_count || 0}\n\n`;
          }
          await sendMessage(botToken, chatId, msg, 'Markdown');
        }
      } else if (text === '/help') {
        await sendMessage(botToken, chatId,
          '🆘 *Help*\n\n' +
          '/stats - Dashboard statistics\n' +
          '/pending - Pending payments with confirm buttons\n' +
          '/deposits - Pending fund deposits\n' +
          '/links - Recent links\n\n' +
          'Click inline buttons to confirm payments/deposits.',
          'Markdown'
        );
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendMessage(
  botToken: string, 
  chatId: number, 
  text: string, 
  parseMode?: string,
  replyMarkup?: any
) {
  const payload: any = { chat_id: chatId, text };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function editMessage(botToken: string, chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown'
    })
  });
}

async function answerCallback(botToken: string, callbackId: string, text: string, showAlert: boolean) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackId,
      text,
      show_alert: showAlert
    })
  });
}
