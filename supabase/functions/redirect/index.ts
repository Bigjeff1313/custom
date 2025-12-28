import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse user agent to extract device info
function parseUserAgent(userAgent: string): { deviceType: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  
  // Device type detection
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    if (/tablet|ipad/i.test(ua)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'mobile';
    }
  }

  // Browser detection
  let browser = 'unknown';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  // OS detection
  let os = 'unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { deviceType, browser, os };
}

// Get location from IP using a free geolocation service
async function getLocationFromIP(ip: string): Promise<{ country: string; city: string; region: string }> {
  try {
    // Skip for local/private IPs
    if (ip === '127.0.0.1' || ip === 'localhost' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return { country: 'Local', city: 'Local', region: 'Local' };
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName`);
    if (response.ok) {
      const data = await response.json();
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.regionName || 'Unknown',
      };
    }
  } catch (error) {
    console.error('Error getting location:', error);
  }
  return { country: 'Unknown', city: 'Unknown', region: 'Unknown' };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shortCode, domain, userAgent, clientIP } = await req.json();
    
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

    // Get IP from request headers or provided clientIP
    const ip = clientIP || 
      req.headers.get('x-forwarded-for')?.split(',')[0] || 
      req.headers.get('cf-connecting-ip') || 
      req.headers.get('x-real-ip') || 
      'Unknown';

    // Parse user agent
    const ua = userAgent || req.headers.get('user-agent') || '';
    const { deviceType, browser, os } = parseUserAgent(ua);

    // Get location from IP
    const { country, city, region } = await getLocationFromIP(ip);

    // Record the click with detailed info
    const { error: clickError } = await supabase
      .from('link_clicks')
      .insert({
        link_id: link.id,
        ip_address: ip,
        user_agent: ua.substring(0, 500), // Limit length
        device_type: deviceType,
        browser: browser,
        os: os,
        country: country,
        city: city,
        region: region,
      });

    if (clickError) {
      console.error('Error recording click:', clickError);
    }

    // Increment click count on link
    await supabase
      .from('links')
      .update({ click_count: (link.click_count || 0) + 1 })
      .eq('id', link.id);

    console.log(`Redirect success: ${shortCode} -> ${link.original_url} (${deviceType}, ${browser}, ${country})`);

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
