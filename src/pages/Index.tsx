import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import CustomDomainSection from "@/components/CustomDomainSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>CustomsLinks - Professional Link Shortener with Crypto Payments</title>
        <meta
          name="description"
          content="Shorten your links professionally with CustomsLinks. Pay with cryptocurrency, use custom domains, and get advanced analytics. Starting at $5 per link."
        />
        <meta name="keywords" content="link shortener, crypto payments, custom domain, URL shortener, bitcoin, ethereum" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <HeroSection />
          <FeaturesSection />
          <PricingSection />
          <CustomDomainSection />
          <FAQSection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
