import { Shield, Globe, BarChart3, Zap, Lock, Wallet } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant Shortening",
    description: "Get your shortened link in milliseconds. No waiting, no delays.",
  },
  {
    icon: Globe,
    title: "Custom Domains",
    description: "Use your own domain for branded links that build trust and recognition.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Track clicks, locations, devices, and referrers in real-time.",
  },
  {
    icon: Wallet,
    title: "Crypto Payments",
    description: "Pay securely with Bitcoin, Ethereum, USDT, and more cryptocurrencies.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SSL encryption, malware scanning, and 99.9% uptime guarantee.",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description: "No personal data required. Your privacy is our priority.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="gradient-text">Shorten Smarter</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Professional-grade link shortening with features that help you track, manage, and optimize your links.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass rounded-2xl p-6 hover:scale-[1.02] transition-all duration-300 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-xl font-semibold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
