import { Button } from "@/components/ui/button";
import { Globe, ArrowRight, CheckCircle } from "lucide-react";

const CustomDomainSection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 via-background to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Custom Domains</span>
            </div>
            
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Your Brand,{" "}
              <span className="gradient-text">Your Domain</span>
            </h2>
            
            <p className="text-lg text-muted-foreground mb-8">
              Don't settle for generic short links. Use your own custom domain to create branded, professional links that your audience will trust and remember.
            </p>

            <ul className="space-y-4 mb-8">
              {[
                "Connect any domain you own",
                "Automatic SSL certificate setup",
                "Full DNS management support",
                "Works with all domain providers",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg">
              Add Custom Domain
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="glass rounded-2xl p-8 space-y-4">
              {/* Example domains */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="font-mono text-foreground">customslinks.com/abc123</span>
                  <span className="ml-auto text-xs text-muted-foreground">Default</span>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-primary">go.yourbrand.com/promo</span>
                  <span className="ml-auto text-xs text-primary">Custom</span>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                  <span className="font-mono text-foreground">links.company.io/launch</span>
                  <span className="ml-auto text-xs text-muted-foreground">Custom</span>
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-radial from-primary/20 to-transparent blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-radial from-primary/10 to-transparent blur-3xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CustomDomainSection;
