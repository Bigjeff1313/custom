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
    
    console.log(`Wallets API called: action=${action}`);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let result;

    switch (action) {
      case 'create': {
        if (!data.currency) {
          throw new Error('Currency is required');
        }
        if (!data.walletAddress) {
          throw new Error('Wallet address is required');
        }

        // Validate wallet address format (basic check)
        if (data.walletAddress.length < 20) {
          throw new Error('Invalid wallet address format');
        }

        const { data: wallet, error } = await supabase
          .from('crypto_wallets')
          .insert({
            currency: data.currency.toUpperCase(),
            wallet_address: data.walletAddress,
            is_active: data.isActive !== undefined ? data.isActive : true,
          })
          .select()
          .single();

        if (error) throw error;
        result = wallet;
        break;
      }

      case 'get': {
        if (!data.id) {
          throw new Error('Wallet ID is required');
        }

        const { data: wallet, error } = await supabase
          .from('crypto_wallets')
          .select('*')
          .eq('id', data.id)
          .single();

        if (error) throw error;
        result = wallet;
        break;
      }

      case 'list': {
        const query = supabase
          .from('crypto_wallets')
          .select('*')
          .order('created_at', { ascending: false });

        // Filter by active status if specified
        if (data?.activeOnly) {
          query.eq('is_active', true);
        }

        const { data: wallets, error } = await query;

        if (error) throw error;
        result = wallets;
        break;
      }

      case 'update': {
        if (!data.id) {
          throw new Error('Wallet ID is required');
        }

        const updateData: Record<string, unknown> = {};
        if (data.currency) updateData.currency = data.currency.toUpperCase();
        if (data.walletAddress) updateData.wallet_address = data.walletAddress;
        if (data.isActive !== undefined) updateData.is_active = data.isActive;

        const { data: wallet, error } = await supabase
          .from('crypto_wallets')
          .update(updateData)
          .eq('id', data.id)
          .select()
          .single();

        if (error) throw error;
        result = wallet;
        break;
      }

      case 'delete': {
        if (!data.id) {
          throw new Error('Wallet ID is required');
        }

        const { error } = await supabase
          .from('crypto_wallets')
          .delete()
          .eq('id', data.id);

        if (error) throw error;
        result = { deleted: true };
        break;
      }

      case 'toggle-active': {
        if (!data.id) {
          throw new Error('Wallet ID is required');
        }

        // Get current status
        const { data: current, error: getError } = await supabase
          .from('crypto_wallets')
          .select('is_active')
          .eq('id', data.id)
          .single();

        if (getError) throw getError;

        // Toggle status
        const { data: wallet, error } = await supabase
          .from('crypto_wallets')
          .update({ is_active: !current.is_active })
          .eq('id', data.id)
          .select()
          .single();

        if (error) throw error;
        result = wallet;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Wallets API success: action=${action}`);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Wallets API error:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
