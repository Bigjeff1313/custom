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
    // One-time setup: GET ?setup=1 registers this function as the bot webhook
    const url = new URL(req.url);
    if (req.method === 'GET' && url.searchParams.get('setup') === '1') {
      const tok = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
      const hook = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-webhook`;
      const r = await fetch(`https://api.telegram.org/bot${tok}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: hook, secret_token: await webhookSecret(tok), allowed_updates: ['message', 'callback_query'] }),
      });
      const info = await (await fetch(`https://api.telegram.org/bot${tok}/getWebhookInfo`)).json();
      return new Response(JSON.stringify({ set: await r.json(), url: info?.result?.url, pending: info?.result?.pending_update_count, last_error: info?.result?.last_error_message ?? null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
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

    if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== await webhookSecret(botToken)) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
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

      // Handle user approval / rejection
      if (callbackData.startsWith('approve_user_') || callbackData.startsWith('reject_user_')) {
        const approve = callbackData.startsWith('approve_user_');
        const uid = callbackData.replace(approve ? 'approve_user_' : 'reject_user_', '');
        const { error } = await supabase.from('user_approvals')
          .update({ status: approve ? 'approved' : 'rejected', updated_at: new Date().toISOString() })
          .eq('user_id', uid);
        if (error) {
          await answerCallback(botToken, callbackId, '❌ Failed to update user', true);
        } else {
          await editMessage(botToken, chatId, messageId,
            (update.callback_query.message.text || 'User') + (approve ? '\n\n✅ Approved by admin' : '\n\n❌ Rejected by admin'));
          await answerCallback(botToken, callbackId, approve ? '✅ User approved' : '❌ User rejected', false);
        }
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

      const handled = await handleAdminCommand(supabase, botToken, chatId, text);
      if (handled) {
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (text === '/start') {
        await sendMessage(botToken, chatId, 
          '🤖 *Link Shortener Admin Bot*\n\n' +
          'Commands:\n' +
          '/stats - View dashboard stats\n' +
          '/pending - View pending payments\n' +
          '/deposits - View pending deposits\n' +
          '/users - Approve new users\n' +
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
      } else if (text === '/users') {
        const { data: users } = await supabase.from('user_approvals')
          .select('user_id, email').eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
        if (!users || users.length === 0) {
          await sendMessage(botToken, chatId, '✅ No users awaiting approval');
        } else {
          await sendMessage(botToken, chatId, '🆕 Users awaiting approval:', undefined, {
            inline_keyboard: users.map(u => [
              { text: `✅ ${u.email}`, callback_data: `approve_user_${u.user_id}` },
              { text: '❌', callback_data: `reject_user_${u.user_id}` },
            ]),
          });
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

async function webhookSecret(token: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`telegram-webhook:${token}`));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

const HELP_TEXT =
  '🤖 Leo — Admin Control\n\n' +
  'READ\n' +
  '/stats · /users · /pending · /deposits · /links · /domains\n' +
  '/user <email> · /balance <email> · /link <code>\n\n' +
  'CONTROL\n' +
  '/approve <email> · /reject <email>\n' +
  '/confirm <payment id> · /confirmdeposit <id>\n' +
  '/activate <code> · /disable <code> · /delete <code>\n' +
  '/credit <email> <amount> · /debit <email> <amount>\n' +
  '/verifydomain <domain>';

// deno-lint-ignore no-explicit-any
async function findUser(sb: any, email: string) {
  const { data } = await sb.from('user_approvals').select('user_id, email, status').ilike('email', email.trim()).maybeSingle();
  return data as { user_id: string; email: string; status: string } | null;
}

// deno-lint-ignore no-explicit-any
async function handleAdminCommand(sb: any, tok: string, chatId: number, text: string): Promise<boolean> {
  const [rawCmd, ...args] = text.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase().split('@')[0];
  const reply = (m: string) => sendMessage(tok, chatId, m);
  const need = async (n: number, usage: string) => { if (args.length < n) { await reply(`Usage: ${usage}`); return false; } return true; };

  switch (cmd) {
    case '/start': case '/help': await reply(HELP_TEXT); return true;

    case '/approve': case '/reject': {
      if (!await need(1, `${cmd} <email>`)) return true;
      const u = await findUser(sb, args[0]);
      if (!u) { await reply('❌ User not found'); return true; }
      const status = cmd === '/approve' ? 'approved' : 'rejected';
      const { error } = await sb.from('user_approvals').update({ status, updated_at: new Date().toISOString() }).eq('user_id', u.user_id);
      await reply(error ? `❌ ${error.message}` : `✅ ${u.email} is now ${status}`); return true;
    }

    case '/user': case '/balance': {
      if (!await need(1, `${cmd} <email>`)) return true;
      const u = await findUser(sb, args[0]);
      if (!u) { await reply('❌ User not found'); return true; }
      const { data: f } = await sb.from('user_funds').select('balance, total_deposited').eq('user_id', u.user_id).maybeSingle();
      if (cmd === '/balance') { await reply(`💰 ${u.email}: $${Number(f?.balance ?? 0).toFixed(2)}`); return true; }
      const { data: links } = await sb.from('links').select('short_code, status, plan_type, click_count').eq('user_id', u.user_id).order('created_at', { ascending: false }).limit(10);
      let m = `👤 ${u.email}\nStatus: ${u.status}\nBalance: $${Number(f?.balance ?? 0).toFixed(2)} (deposited $${Number(f?.total_deposited ?? 0).toFixed(2)})\nLinks: ${links?.length ?? 0}\n`;
      for (const l of links ?? []) m += `• ${l.short_code} — ${l.status}, ${l.plan_type}, ${l.click_count ?? 0} clicks\n`;
      await reply(m); return true;
    }

    case '/credit': case '/debit': {
      if (!await need(2, `${cmd} <email> <amount>`)) return true;
      const amt = Number(args[1]);
      if (!isFinite(amt) || amt <= 0) { await reply('❌ Amount must be a positive number'); return true; }
      const u = await findUser(sb, args[0]);
      if (!u) { await reply('❌ User not found'); return true; }
      const { data: f } = await sb.from('user_funds').select('balance, total_deposited').eq('user_id', u.user_id).maybeSingle();
      const bal = Number(f?.balance ?? 0);
      if (cmd === '/debit' && bal < amt) { await reply(`❌ Insufficient balance ($${bal.toFixed(2)})`); return true; }
      const newBal = cmd === '/credit' ? bal + amt : bal - amt;
      const res = f
        ? await sb.from('user_funds').update({ balance: newBal, total_deposited: Number(f.total_deposited) + (cmd === '/credit' ? amt : 0), updated_at: new Date().toISOString() }).eq('user_id', u.user_id)
        : await sb.from('user_funds').insert({ user_id: u.user_id, balance: newBal, total_deposited: amt });
      await reply(res.error ? `❌ ${res.error.message}` : `✅ ${u.email} balance: $${newBal.toFixed(2)}`); return true;
    }

    case '/link': case '/activate': case '/disable': case '/delete': {
      if (!await need(1, `${cmd} <code>`)) return true;
      const { data: l } = await sb.from('links').select('id, short_code, original_url, status, plan_type, click_count').eq('short_code', args[0]).maybeSingle();
      if (!l) { await reply('❌ Link not found'); return true; }
      if (cmd === '/link') { await reply(`🔗 ${l.short_code}\n→ ${l.original_url}\nStatus: ${l.status}\nPlan: ${l.plan_type}\nClicks: ${l.click_count ?? 0}`); return true; }
      if (cmd === '/delete') {
        await sb.from('link_clicks').delete().eq('link_id', l.id);
        await sb.from('payments').delete().eq('link_id', l.id);
        const { error } = await sb.from('links').delete().eq('id', l.id);
        await reply(error ? `❌ ${error.message}` : `🗑 Deleted ${l.short_code}`); return true;
      }
      const status = cmd === '/activate' ? 'active' : 'disabled';
      const { error } = await sb.from('links').update({ status, updated_at: new Date().toISOString() }).eq('id', l.id);
      await reply(error ? `❌ ${error.message}` : `✅ ${l.short_code} is now ${status}`); return true;
    }

    case '/confirm': {
      if (!await need(1, '/confirm <payment id>')) return true;
      const { data: p } = await sb.from('payments').select('id, link_id, status').eq('id', args[0]).maybeSingle();
      if (!p) { await reply('❌ Payment not found'); return true; }
      if (p.status === 'confirmed') { await reply('⚠️ Already confirmed'); return true; }
      await sb.from('payments').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', p.id);
      if (p.link_id) await sb.from('links').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', p.link_id);
      await reply('✅ Payment confirmed & link activated'); return true;
    }

    case '/confirmdeposit': {
      if (!await need(1, '/confirmdeposit <id>')) return true;
      const { data: t } = await sb.from('fund_transactions').select('*').eq('id', args[0]).maybeSingle();
      if (!t) { await reply('❌ Deposit not found'); return true; }
      if (t.status === 'confirmed') { await reply('⚠️ Already confirmed'); return true; }
      await sb.from('fund_transactions').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', t.id);
      const { data: f } = await sb.from('user_funds').select('*').eq('user_id', t.user_id).maybeSingle();
      if (f) await sb.from('user_funds').update({ balance: Number(f.balance) + Number(t.amount), total_deposited: Number(f.total_deposited) + Number(t.amount), updated_at: new Date().toISOString() }).eq('user_id', t.user_id);
      else await sb.from('user_funds').insert({ user_id: t.user_id, balance: t.amount, total_deposited: t.amount });
      await reply(`✅ Deposit of $${t.amount} confirmed`); return true;
    }

    case '/domains': {
      const { data } = await sb.from('custom_domains').select('domain, is_verified, is_active').order('created_at', { ascending: false }).limit(25);
      await reply(data?.length ? '🌐 Domains\n' + data.map((d: { domain: string; is_verified: boolean; is_active: boolean }) => `• ${d.domain} — ${d.is_verified ? 'verified' : 'unverified'}, ${d.is_active ? 'active' : 'inactive'}`).join('\n') : 'No domains'); return true;
    }

    case '/verifydomain': {
      if (!await need(1, '/verifydomain <domain>')) return true;
      const { data, error } = await sb.from('custom_domains').update({ is_verified: true, is_active: true, updated_at: new Date().toISOString() }).eq('domain', args[0].toLowerCase()).select('id');
      await reply(error ? `❌ ${error.message}` : data?.length ? `✅ ${args[0]} verified` : '❌ Domain not found'); return true;
    }
  }
  return false;
}
