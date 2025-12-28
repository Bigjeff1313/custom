import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, Link2, ShieldCheck, CheckCircle2, MousePointerClick } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type RedirectState = "loading" | "verification" | "verifying" | "redirecting" | "error";

const Redirect = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [state, setState] = useState<RedirectState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [isHuman, setIsHuman] = useState(false);
  const [clickCount, setClickCount] = useState<number>(0);

  // Fetch link data on mount
  useEffect(() => {
    const fetchLink = async () => {
      if (!shortCode) {
        setError("Invalid link");
        setState("error");
        return;
      }

      try {
        console.log(`Fetching link for: ${shortCode}`);
        
        // First, just get the link data without incrementing clicks
        const { data: link, error: linkError } = await supabase
          .from("links")
          .select("*")
          .eq("short_code", shortCode)
          .eq("status", "active")
          .maybeSingle();

        if (linkError || !link) {
          console.error("Link not found:", linkError);
          setError("Link not found or expired");
          setState("error");
          return;
        }

        setOriginalUrl(link.original_url);
        setClickCount(link.click_count || 0);
        setState("verification");
      } catch (err) {
        console.error("Fetch error:", err);
        setError("An error occurred while loading the link");
        setState("error");
      }
    };

    fetchLink();
  }, [shortCode]);

  const handleVerification = useCallback(async () => {
    if (!isHuman || !shortCode || !originalUrl) return;

    setState("verifying");

    try {
      // Call the redirect function to increment click and get URL with device info
      const { data, error: fnError } = await supabase.functions.invoke('redirect', {
        body: { 
          shortCode,
          domain: window.location.hostname,
          userAgent: navigator.userAgent,
        }
      });

      if (fnError) {
        console.error('Redirect function error:', fnError);
        setError("Failed to process redirect");
        setState("error");
        return;
      }

      if (data?.success && data?.originalUrl) {
        setState("redirecting");
        setClickCount(data.clickCount || clickCount + 1);
        
        // Small delay to show the redirecting state
        setTimeout(() => {
          console.log(`Redirecting to: ${data.originalUrl}`);
          window.location.href = data.originalUrl;
        }, 500);
      } else {
        console.error('Invalid response:', data);
        setError(data?.error || "Link not found or expired");
        setState("error");
      }
    } catch (err) {
      console.error('Redirect error:', err);
      setError("An error occurred while processing the redirect");
      setState("error");
    }
  }, [isHuman, shortCode, originalUrl, clickCount]);

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center glass rounded-2xl p-8 max-w-md">
          <div className="w-16 h-16 mx-auto bg-destructive/20 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
            Link Not Found
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <a 
            href="/" 
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
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
          <h1 className="font-heading text-xl font-bold text-foreground mb-2">
            Verified!
          </h1>
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-muted-foreground">Redirecting you now...</span>
          </div>
        </div>
      </div>
    );
  }

  // Verification state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-primary/20 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground mb-2">
            Security Verification
          </h1>
          <p className="text-muted-foreground text-sm">
            Please verify you're human to continue
          </p>
        </div>

        {/* Link Preview */}
        <div className="bg-muted/50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Destination</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {originalUrl}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <MousePointerClick className="w-3 h-3" />
            <span>{clickCount} clicks</span>
          </div>
        </div>

        {/* Verification Checkbox */}
        <div className="border-2 border-border rounded-xl p-4 mb-6 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-4">
            <Checkbox
              id="human-check"
              checked={isHuman}
              onCheckedChange={(checked) => setIsHuman(checked === true)}
              className="h-6 w-6 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label
              htmlFor="human-check"
              className="text-sm font-medium text-foreground cursor-pointer flex-1"
            >
              I'm not a robot
            </label>
            <div className="flex flex-col items-center">
              <ShieldCheck className="w-8 h-8 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">reCAPTCHA</span>
            </div>
          </div>
        </div>

        {/* Continue Button */}
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
            <>
              Continue to Website
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Protected by CustomTextX security
        </p>
      </div>
    </div>
  );
};

export default Redirect;
