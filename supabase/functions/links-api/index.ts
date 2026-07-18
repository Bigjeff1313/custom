import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

function isValidUrl(urlString: string): boolean {
  try { new URL(urlString); return true; } catch { return false; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log(`Links API called: action=${action}`);

    // Public actions (used by unauthenticated visitors on the redirect page).
    const publicActions = new Set(['get']);
    const isPublic = publicActions.has(action);

    let userId: string | null = null;
    let isAdmin = false;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (!isPublic) {
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
      userId = userData.user.id;
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      isAdmin = !!adminRole;

      // Admin-only actions
      const adminActions = new Set(['list', 'update', 'delete', 'activate']);
      if (adminActions.has(action) && !isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let result;

    switch (action) {
      case 'create': {
        if (!data.originalUrl) throw new Error('Original URL is required');
        if (!isValidUrl(data.originalUrl)) throw new Error('Invalid URL format');

        let shortCode = data.customCode || generateShortCode();
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          const { data: existing } = await supabase
            .from('links').select('id').eq('short_code', shortCode).single();
          if (!existing) break;
          shortCode = generateShortCode();
          attempts++;
        }
        if (attempts >= maxAttempts) throw new Error('Could not generate unique short code');

        const { data: link, error } = await supabase
          .from('links')
          .insert({
            user_id: userId,
            original_url: data.originalUrl,
            short_code: shortCode,
            custom_domain: data.customDomain || 'customslinksurl.com',
            plan_type: data.planType || 'basic',
            status: 'pending_payment',
          })
          .select().single();
        if (error) throw error;
        result = { link, shortUrl: `${link.custom_domain}/${link.short_code}` };
        break;
      }
      case 'get': {
        if (!data.shortCode) throw new Error('Short code is required');
        const { data: link, error } = await supabase
          .from('links').select('*').eq('short_code', data.shortCode).single();
        if (error) throw error;
        result = link;
        break;
      }
      case 'list': {
        const query = supabase.from('links').select('*').order('created_at', { ascending: false });
        if (data?.status) query.eq('status', data.status);
        if (data?.limit) query.limit(data.limit);
        const { data: links, error } = await query;
        if (error) throw error;
        result = links;
        break;
      }
      case 'update': {
        if (!data.id) throw new Error('Link ID is required');
        const updateData: Record<string, unknown> = {};
        if (data.status) updateData.status = data.status;
        if (data.customDomain) updateData.custom_domain = data.customDomain;
        if (data.originalUrl) updateData.original_url = data.originalUrl;
        const { data: link, error } = await supabase
          .from('links').update(updateData).eq('id', data.id).select().single();
        if (error) throw error;
        result = link;
        break;
      }
      case 'delete': {
        if (!data.id) throw new Error('Link ID is required');
        const { error } = await supabase.from('links').delete().eq('id', data.id);
        if (error) throw error;
        result = { deleted: true };
        break;
      }
      case 'activate': {
        if (!data.shortCode) throw new Error('Short code is required');
        const { data: link, error } = await supabase
          .from('links').update({ status: 'active' }).eq('short_code', data.shortCode).select().single();
        if (error) throw error;
        result = link;
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
    console.error('Links API error:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
