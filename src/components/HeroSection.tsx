import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Link2, Zap, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const HeroSection = () => {
  const [url, setUrl] = useState("");
  const [shortenedUrl, setShortenedUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }

    setIsLoading(true);
    // Simulate shortening (in production, this would call your API)
    setTimeout(() => {
      const shortCode = Math.random().toString(36).substring(2, 8);
      setShortenedUrl(`customslinks.com/${shortCode}`);
      setIsLoading(false);
      toast.success("Link ready! Complete payment to activate.");
    }, 1000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${shortenedUrl}`);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-[0.02]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/10 via-transparent to-transparent blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Crypto-Powered Link Shortening</span>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            Shorten Links.{" "}
            <span className="gradient-text">Get Paid.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.3s" }}>
            Professional link shortening with crypto payments. Custom domains, analytics, and premium features starting at just $5 per link.
          </p>

          {/* Link Shortener Form */}
          <div className="max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <form onSubmit={handleShorten} className="relative">
              <div className="glass rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="Paste your long URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-12 bg-secondary/50 border-0 h-14 text-base"
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="hero" 
                  size="xl"
                  disabled={isLoading}
                  className="sm:w-auto w-full"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Shortening...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Shorten Link
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </Button>
              </div>
            </form>

            {/* Shortened URL Result */}
            {shortenedUrl && (
              <div className="mt-6 glass rounded-xl p-4 animate-scale-in">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Your shortened link:</p>
                    <p className="text-lg font-medium text-primary truncate">{shortenedUrl}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">
                  💎 Pay $5-10 in crypto to activate this link
                </p>
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.5s" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Instant Activation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Custom Domains</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Crypto Only</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
