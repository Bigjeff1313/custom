import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, Sparkles } from "lucide-react";
import CreateLinkModal from "./CreateLinkModal";

const pricingPlans = [
  {
    name: "Basic Link",
    price: "$5",
    description: "Perfect for single links",
    features: [
      "1 shortened link",
      "Default customslinks.com domain",
      "Basic click analytics",
      "Lifetime link validity",
      "SSL encryption",
    ],
    popular: false,
  },
  {
    name: "Pro Link",
    price: "$10",
    description: "For branded experiences",
    features: [
      "1 shortened link",
      "Custom domain support",
      "Advanced analytics dashboard",
      "Lifetime link validity",
      "Priority support",
      "QR code generation",
      "Link editing",
    ],
    popular: true,
  },
];

const cryptos = [
  { name: "Bitcoin", symbol: "BTC" },
  { name: "Ethereum", symbol: "ETH" },
  { name: "USDT", symbol: "USDT" },
  { name: "USDC", symbol: "USDC" },
  { name: "Litecoin", symbol: "LTC" },
];

const PricingSection = () => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleGetStarted = () => {
    setModalOpen(true);
  };

  return (
    <>
      <CreateLinkModal
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    <section id="pricing" className="py-24 relative">
      {/* Background Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 via-transparent to-transparent blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Simple,{" "}
            <span className="gradient-text">Transparent</span>{" "}
            Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Pay per link with cryptocurrency. No subscriptions, no hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative glass rounded-2xl p-8 ${
                plan.popular
                  ? "border-2 border-primary shadow-[0_0_40px_hsl(174_72%_56%/0.2)]"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground rounded-full text-sm font-medium flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  Most Popular
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="font-heading text-2xl font-bold mb-2 text-foreground">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-heading text-5xl font-bold gradient-text">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">/link</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant="pricing" size="lg" onClick={handleGetStarted}>
                Get Started
              </Button>
            </div>
          ))}
        </div>

        {/* Accepted Cryptocurrencies */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Accepted Cryptocurrencies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {cryptos.map((crypto) => (
              <div
                key={crypto.symbol}
                className="glass rounded-lg px-4 py-2 flex items-center gap-2"
              >
                <span className="font-medium text-foreground">{crypto.symbol}</span>
                <span className="text-sm text-muted-foreground">{crypto.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    </>
  );
};

export default PricingSection;
