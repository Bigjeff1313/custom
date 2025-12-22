import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { action, data } = await req.json();
    
    console.log(`Payments API called: action=${action}`);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let result;

    switch (action) {
      case 'create': {
        // Validate required fields
        if (!data.linkId) {
          throw new Error('Link ID is required');
        }
        if (!data.amount) {
          throw new Error('Amount is required');
        }
        if (!data.currency) {
          throw new Error('Currency is required');
        }
        if (!data.walletAddress) {
          throw new Error('Wallet address is required');
        }

        // Set expiration to 15 minutes from now
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
          .select()
          .single();

        if (error) throw error;
        result = payment;
        break;
      }

      case 'verify': {
        if (!data.paymentId) {
          throw new Error('Payment ID is required');
        }

        // Get the payment
        const { data: payment, error: getError } = await supabase
          .from('payments')
          .select('*, links(*)')
          .eq('id', data.paymentId)
          .single();

        if (getError) throw getError;

        // Check if payment is expired
        if (new Date(payment.expires_at) < new Date()) {
          // Mark as expired
          await supabase
            .from('payments')
            .update({ status: 'expired' })
            .eq('id', data.paymentId);

          throw new Error('Payment has expired');
        }

        // In production, you would verify the transaction on the blockchain here
        // For now, we'll check if a transaction hash was provided
        if (data.transactionHash) {
          // Update payment with transaction hash and confirm
          const { data: updatedPayment, error: updateError } = await supabase
            .from('payments')
            .update({ 
              status: 'confirmed',
              transaction_hash: data.transactionHash
            })
            .eq('id', data.paymentId)
            .select()
            .single();

          if (updateError) throw updateError;

          // Activate the associated link
          if (payment.link_id) {
            await supabase
              .from('links')
              .update({ status: 'active' })
              .eq('id', payment.link_id);
          }

          result = { 
            payment: updatedPayment, 
            verified: true,
            message: 'Payment verified and link activated'
          };
        } else {
          // Manual confirmation without transaction hash
          const { data: updatedPayment, error: updateError } = await supabase
            .from('payments')
            .update({ status: 'confirmed' })
            .eq('id', data.paymentId)
            .select()
            .single();

          if (updateError) throw updateError;

          // Activate the associated link
          if (payment.link_id) {
            await supabase
              .from('links')
              .update({ status: 'active' })
              .eq('id', payment.link_id);
          }

          result = { 
            payment: updatedPayment, 
            verified: true,
            message: 'Payment confirmed and link activated'
          };
        }
        break;
      }

      case 'get': {
        if (!data.paymentId) {
          throw new Error('Payment ID is required');
        }

        const { data: payment, error } = await supabase
          .from('payments')
          .select('*, links(*)')
          .eq('id', data.paymentId)
          .single();

        if (error) throw error;
        result = payment;
        break;
      }

      case 'list': {
        const query = supabase
          .from('payments')
          .select('*, links(*)')
          .order('created_at', { ascending: false });

        if (data?.status) {
          query.eq('status', data.status);
        }

        if (data?.limit) {
          query.limit(data.limit);
        }

        const { data: payments, error } = await query;

        if (error) throw error;
        result = payments;
        break;
      }

      case 'update-status': {
        if (!data.paymentId) {
          throw new Error('Payment ID is required');
        }
        if (!data.status) {
          throw new Error('Status is required');
        }

        const updateData: Record<string, unknown> = { status: data.status };
        if (data.transactionHash) {
          updateData.transaction_hash = data.transactionHash;
        }

        const { data: payment, error } = await supabase
          .from('payments')
          .update(updateData)
          .eq('id', data.paymentId)
          .select()
          .single();

        if (error) throw error;

        // If payment is confirmed, activate the link
        if (data.status === 'confirmed' && payment.link_id) {
          await supabase
            .from('links')
            .update({ status: 'active' })
            .eq('id', payment.link_id);
        }

        result = payment;
        break;
      }

      case 'check-expired': {
        // Find and update expired payments
        const { data: expiredPayments, error: selectError } = await supabase
          .from('payments')
          .select('id, link_id')
          .eq('status', 'pending')
          .lt('expires_at', new Date().toISOString());

        if (selectError) throw selectError;

        if (expiredPayments && expiredPayments.length > 0) {
          const paymentIds = expiredPayments.map(p => p.id);
          const linkIds = expiredPayments.map(p => p.link_id).filter(Boolean);

          // Update payments to expired
          await supabase
            .from('payments')
            .update({ status: 'expired' })
            .in('id', paymentIds);

          // Update links to expired
          if (linkIds.length > 0) {
            await supabase
              .from('links')
              .update({ status: 'expired' })
              .in('id', linkIds);
          }

          result = { 
            expiredCount: expiredPayments.length,
            message: `${expiredPayments.length} payments marked as expired`
          };
        } else {
          result = { 
            expiredCount: 0,
            message: 'No expired payments found'
          };
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Payments API success: action=${action}`);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Payments API error:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
