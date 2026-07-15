import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, Link2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type RedirectState = "loading" | "verification" | "verifying" | "redirecting" | "error";

const Redirect = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [state, setState] = useState<RedirectState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [captchaEnabled, setCaptchaEnabled] = useState(true);
  const [isHuman, setIsHuman] = useState(false);

  // Resolve link via edge function (service role) so anonymous visitors work
  useEffect(() => {
    const check = async () => {
      if (!shortCode) {
        setError("Invalid link");
        setState("error");
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("redirect", {
          body: {
            shortCode,
            domain: window.location.hostname,
            probe: true,
          },
        });
        if (fnError || !data?.success) {
          setError(data?.error || "Link not found or expired");
          setState("error");
          return;
        }
        const cap = data.captchaEnabled !== false;
        setCaptchaEnabled(cap);
        if (!cap) {
          setIsHuman(true);
          setState("verifying");
        } else {
          setState("verification");
        }
      } catch (err) {
        console.error("Redirect probe error:", err);
        setError("An error occurred while loading the link");
        setState("error");
      }
    };
    check();
  }, [shortCode]);

  const handleVerification = useCallback(async () => {
    if (!isHuman || !shortCode) return;
    setState("verifying");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("redirect", {
        body: { shortCode, domain: window.location.hostname },
      });
      if (fnError || !data?.success || !data?.originalUrl) {
        setError(data?.error || "Link not found or expired");
        setState("error");
        return;
      }
      setState("redirecting");
      setTimeout(() => {
        window.location.href = data.originalUrl;
      }, 500);
    } catch (err) {
      console.error("Redirect error:", err);
      setError("An error occurred while processing the redirect");
      setState("error");
    }
  }, [isHuman, shortCode]);

  useEffect(() => {
    if (state === "verifying" && isHuman && !captchaEnabled) {
      handleVerification();
    }
  }, [state, isHuman, captchaEnabled, handleVerification]);

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center glass rounded-2xl p-8 max-w-md">
          <div className="w-16 h-16 mx-auto bg-destructive/20 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Link Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 text-primary hover:underline">
            <Link2 className="w-4 h-4" />
            Create your own short link
          </a>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-primary/20 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
            <Link2 className="w-8 h-8 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (state === "redirecting") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center glass rounded-2xl p-8 max-w-md">
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground mb-2">Verified!</h1>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Redirecting you now...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground mb-2">Security Verification</h1>
          <p className="text-muted-foreground text-sm">Please verify you're human to continue</p>
        </div>

        <div className="border-2 border-border rounded-xl p-4 mb-6 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-4">
            <Checkbox
              id="human-check"
              checked={isHuman}
              onCheckedChange={(checked) => setIsHuman(checked === true)}
              className="h-6 w-6 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label htmlFor="human-check" className="text-sm font-medium text-foreground cursor-pointer flex-1">
              I'm not a robot
            </label>
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-8 h-8 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">reCAPTCHA</span>
            </div>
          </div>
        </div>

        <Button
          onClick={handleVerification}
          disabled={!isHuman || state === "verifying"}
          className="w-full"
          variant="pricing"
          size="lg"
        >
          {state === "verifying" ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>Continue</>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-4">Protected by Cloudflare Security</p>
      </div>
    </div>
  );
};

export default Redirect;
