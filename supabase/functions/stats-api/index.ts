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
    const { action } = await req.json();
    
    console.log(`Stats API called: action=${action}`);

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let result;

    switch (action) {
      case 'dashboard': {
        // Get all stats for dashboard
        const [linksResult, paymentsResult, walletsResult] = await Promise.all([
          supabase.from('links').select('id, status, click_count, created_at'),
          supabase.from('payments').select('id, status, amount, currency, created_at'),
          supabase.from('crypto_wallets').select('id, is_active'),
        ]);

        const links = linksResult.data || [];
        const payments = paymentsResult.data || [];
        const wallets = walletsResult.data || [];

        // Calculate stats
        const totalLinks = links.length;
        const activeLinks = links.filter(l => l.status === 'active').length;
        const pendingLinks = links.filter(l => l.status === 'pending_payment').length;
        const totalClicks = links.reduce((sum, l) => sum + (l.click_count || 0), 0);

        const totalPayments = payments.length;
        const confirmedPayments = payments.filter(p => p.status === 'confirmed').length;
        const pendingPayments = payments.filter(p => p.status === 'pending').length;
        const totalRevenue = payments
          .filter(p => p.status === 'confirmed')
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const totalWallets = wallets.length;
        const activeWallets = wallets.filter(w => w.is_active).length;

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const recentLinks = links.filter(l => l.created_at >= sevenDaysAgo).length;
        const recentPayments = payments.filter(p => p.created_at >= sevenDaysAgo).length;

        result = {
          links: {
            total: totalLinks,
            active: activeLinks,
            pending: pendingLinks,
            totalClicks,
            recentCreated: recentLinks,
          },
          payments: {
            total: totalPayments,
            confirmed: confirmedPayments,
            pending: pendingPayments,
            totalRevenue,
            recentCreated: recentPayments,
          },
          wallets: {
            total: totalWallets,
            active: activeWallets,
          },
        };
        break;
      }

      case 'link-analytics': {
        // Get detailed link analytics
        const { data: links, error } = await supabase
          .from('links')
          .select('*')
          .eq('status', 'active')
          .order('click_count', { ascending: false })
          .limit(10);

        if (error) throw error;

        result = {
          topLinks: links,
          totalClicks: links?.reduce((sum, l) => sum + (l.click_count || 0), 0) || 0,
        };
        break;
      }

      case 'payment-analytics': {
        // Get payment analytics by currency
        const { data: payments, error } = await supabase
          .from('payments')
          .select('currency, amount, status')
          .eq('status', 'confirmed');

        if (error) throw error;

        // Group by currency
        const byCurrency: Record<string, { count: number; total: number }> = {};
        payments?.forEach(p => {
          if (!byCurrency[p.currency]) {
            byCurrency[p.currency] = { count: 0, total: 0 };
          }
          byCurrency[p.currency].count++;
          byCurrency[p.currency].total += Number(p.amount);
        });

        result = {
          byCurrency,
          totalConfirmed: payments?.length || 0,
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Stats API success: action=${action}`);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stats API error:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
