import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log(`Payments API called: action=${action}`);

    // All actions require authentication.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;
    const { data: isAdminData } = await userClient.rpc('has_role', {
      _user_id: userId, _role: 'admin',
    });
    const isAdmin = !!isAdminData;

    const adminActions = new Set(['verify', 'update-status', 'check-expired']);
    if (adminActions.has(action) && !isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let result;

    switch (action) {
      case 'create': {
        if (!data.linkId) throw new Error('Link ID is required');
        if (!data.amount) throw new Error('Amount is required');
        if (!data.currency) throw new Error('Currency is required');
        if (!data.walletAddress) throw new Error('Wallet address is required');

        // Verify the caller owns the link (admins bypass).
        if (!isAdmin) {
          const { data: link } = await supabase
            .from('links').select('user_id').eq('id', data.linkId).single();
          if (!link || link.user_id !== userId) {
            throw new Error('Not authorized to create payment for this link');
          }
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const { data: payment, error } = await supabase
          .from('payments')
          .insert({
            link_id: data.linkId,
            amount: data.amount,
            currency: data.currency,
            wallet_address: data.walletAddress,
            status: 'pending',
            expires_at: expiresAt,
          })
          .select().single();
        if (error) throw error;
        result = payment;
        break;
      }

      case 'verify': {
        if (!data.paymentId) throw new Error('Payment ID is required');
        const { data: payment, error: getError } = await supabase
          .from('payments').select('*, links(*)').eq('id', data.paymentId).single();
        if (getError) throw getError;

        if (new Date(payment.expires_at) < new Date()) {
          await supabase.from('payments').update({ status: 'expired' }).eq('id', data.paymentId);
          throw new Error('Payment has expired');
        }

        const updateData: Record<string, unknown> = { status: 'confirmed' };
        if (data.transactionHash) updateData.transaction_hash = data.transactionHash;

        const { data: updatedPayment, error: updateError } = await supabase
          .from('payments').update(updateData).eq('id', data.paymentId).select().single();
        if (updateError) throw updateError;

        if (payment.link_id) {
          await supabase.from('links').update({ status: 'active' }).eq('id', payment.link_id);
        }
        result = { payment: updatedPayment, verified: true, message: 'Payment verified and link activated' };
        break;
      }

      case 'update-status': {
        if (!data.paymentId) throw new Error('Payment ID is required');
        if (!data.status) throw new Error('Status is required');
        const updateData: Record<string, unknown> = { status: data.status };
        if (data.transactionHash) updateData.transaction_hash = data.transactionHash;
        const { data: payment, error } = await supabase
          .from('payments').update(updateData).eq('id', data.paymentId).select().single();
        if (error) throw error;
        if (data.status === 'confirmed' && payment.link_id) {
          await supabase.from('links').update({ status: 'active' }).eq('id', payment.link_id);
        }
        result = payment;
        break;
      }

      case 'check-expired': {
        const { data: expiredPayments, error: selectError } = await supabase
          .from('payments').select('id, link_id')
          .eq('status', 'pending').lt('expires_at', new Date().toISOString());
        if (selectError) throw selectError;

        if (expiredPayments && expiredPayments.length > 0) {
          const paymentIds = expiredPayments.map(p => p.id);
          const linkIds = expiredPayments.map(p => p.link_id).filter(Boolean);
          await supabase.from('payments').update({ status: 'expired' }).in('id', paymentIds);
          if (linkIds.length > 0) {
            await supabase.from('links').update({ status: 'expired' }).in('id', linkIds);
          }
          result = { expiredCount: expiredPayments.length, message: `${expiredPayments.length} payments marked as expired` };
        } else {
          result = { expiredCount: 0, message: 'No expired payments found' };
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Payments API error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
