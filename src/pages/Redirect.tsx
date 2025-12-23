import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Redirect = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!shortCode) {
        setError("Invalid link");
        return;
      }

      try {
        console.log(`Processing redirect for: ${shortCode}`);
        
        const { data, error: fnError } = await supabase.functions.invoke('redirect', {
          body: { 
            shortCode,
            domain: window.location.hostname 
          }
        });

        if (fnError) {
          console.error('Redirect function error:', fnError);
          setError("Failed to process redirect");
          return;
        }

        if (data?.success && data?.originalUrl) {
          console.log(`Redirecting to: ${data.originalUrl}`);
          window.location.href = data.originalUrl;
        } else {
          console.error('Invalid response:', data);
          setError(data?.error || "Link not found or expired");
        }
      } catch (err) {
        console.error('Redirect error:', err);
        setError("An error occurred while processing the redirect");
      }
    };

    handleRedirect();
  }, [shortCode]);

  if (error) {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto bg-primary/20 rounded-2xl flex items-center justify-center mb-4 animate-pulse">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Redirecting...</span>
        </div>
      </div>
    </div>
  );
};

export default Redirect;
