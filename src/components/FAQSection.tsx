import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does the payment process work?",
    answer:
      "After shortening your link, you'll receive a crypto payment address. Send the payment ($5-10 depending on your plan) and your link will be activated within minutes of blockchain confirmation.",
  },
  {
    question: "Which cryptocurrencies do you accept?",
    answer:
      "We accept Bitcoin (BTC), Ethereum (ETH), USDT, USDC, Litecoin (LTC), and several other major cryptocurrencies. All payments are processed securely through our payment gateway.",
  },
  {
    question: "How do I add my custom domain?",
    answer:
      "Choose the Pro Link plan ($10), then add your domain through your dashboard. You'll need to update your DNS settings to point to our servers. We provide step-by-step instructions and support throughout the process.",
  },
  {
    question: "Is there a link expiration?",
    answer:
      "No! Once your link is paid for and activated, it remains active forever. There are no recurring fees or expiration dates.",
  },
  {
    question: "Can I edit my shortened link after creation?",
    answer:
      "Yes, Pro Link plan users can edit the destination URL of their shortened links at any time through the dashboard.",
  },
  {
    question: "What analytics do you provide?",
    answer:
      "Basic plans include click counts and basic stats. Pro plans include detailed analytics: geographic location, device types, referral sources, click timestamps, and more.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Absolutely. We don't require personal information to create links. All links are secured with SSL encryption, and we never sell or share your data.",
  },
  {
    question: "What happens if a link gets too much traffic?",
    answer:
      "Our infrastructure is built to handle high traffic. Your links will continue to work regardless of how many clicks they receive.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-24 relative">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Frequently Asked{" "}
            <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about CustomsLinks
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="glass rounded-xl px-6 border-0"
              >
                <AccordionTrigger className="text-left font-heading text-lg font-medium hover:no-underline py-6 text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
