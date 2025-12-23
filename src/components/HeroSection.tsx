import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Link2, Zap } from "lucide-react";
import { toast } from "sonner";
import CreateLinkModal from "./CreateLinkModal";

const HeroSection = () => {
  const [url, setUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro">("basic");

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }

    // Validate URL
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setSelectedPlan("basic");
    setModalOpen(true);
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
                    type="text"
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
                  className="sm:w-auto w-full"
                >
                  <span className="flex items-center gap-2">
                    Shorten Link
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </Button>
              </div>
            </form>
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

      <CreateLinkModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        planType={selectedPlan}
      />
    </section>
  );
};

export default HeroSection;
