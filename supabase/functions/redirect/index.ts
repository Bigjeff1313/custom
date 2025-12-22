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
    const url = new URL(req.url);
    const { shortCode, domain } = await req.json();
    
    console.log(`Redirect request: shortCode=${shortCode}, domain=${domain}`);

    if (!shortCode) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Short code is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the link by short code
    let query = supabase
      .from('links')
      .select('*')
      .eq('short_code', shortCode)
      .eq('status', 'active');

    // If domain is provided, filter by it
    if (domain) {
      query = query.eq('custom_domain', domain);
    }

    const { data: link, error } = await query.single();

    if (error || !link) {
      console.log(`Link not found: ${shortCode}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Link not found or not active' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment click count
    await supabase
      .from('links')
      .update({ click_count: (link.click_count || 0) + 1 })
      .eq('id', link.id);

    console.log(`Redirect success: ${shortCode} -> ${link.original_url}`);

    return new Response(JSON.stringify({ 
      success: true, 
      originalUrl: link.original_url,
      clickCount: (link.click_count || 0) + 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Redirect error:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
