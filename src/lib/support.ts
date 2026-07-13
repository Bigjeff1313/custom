import { supabase } from "@/integrations/supabase/client";

export const TELEGRAM_CONTACT = "https://t.me/samwebber231";

export async function notifySupport(context: string, extra?: Record<string, unknown>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.functions.invoke("telegram-notify", {
      body: {
        type: "support_request",
        userEmail: user?.email || "Anonymous visitor",
        context,
        extra: extra || null,
      },
    });
  } catch (err) {
    console.error("Failed to notify support:", err);
  }
}
