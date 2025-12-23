import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Loader2, Clock, Wallet, Globe, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: "basic" | "pro";
}

interface CryptoWallet {
  id: string;
  currency: string;
  wallet_address: string;
}

interface CustomDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  is_active: boolean;
}

const CreateLinkModal = ({ open, onOpenChange, planType }: CreateLinkModalProps) => {
  const [step, setStep] = useState<"input" | "payment" | "success">("input");
  const [originalUrl, setOriginalUrl] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedCrypto, setSelectedCrypto] = useState<string>("");
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkData, setLinkData] = useState<{ shortCode: string; paymentId: string } | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<CryptoWallet | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes

  const price = planType === "basic" ? 5 : 10;

  useEffect(() => {
    if (open) {
      fetchWallets();
      fetchDomains();
    }
  }, [open]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "payment" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const fetchWallets = async () => {
    const { data, error } = await supabase
      .from("crypto_wallets")
      .select("*")
      .eq("is_active", true);

    if (data) setWallets(data);
    if (error) toast.error("Failed to load payment options");
  };

  const fetchDomains = async () => {
    const { data, error } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("is_active", true)
      .eq("is_verified", true);

    if (data && data.length > 0) {
      setDomains(data as CustomDomain[]);
      setSelectedDomain(data[0].domain);
    }
    if (error) toast.error("Failed to load domains");
  };

  const generateShortCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const formatUrl = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  };

  const handleCreateLink = async () => {
    const formattedUrl = formatUrl(originalUrl);
    
    if (!isValidUrl(formattedUrl)) {
      toast.error("Please enter a valid URL");
      return;
    }

    if (!selectedCrypto || !selectedWallet) {
      toast.error("Please select a payment method");
      return;
    }

    if (!selectedDomain) {
      toast.error("No domain available");
      return;
    }

    setLoading(true);

    try {
      const shortCode = generateShortCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Create the link
      const { data: link, error: linkError } = await supabase
        .from("links")
        .insert({
          original_url: formattedUrl,
          short_code: shortCode,
          custom_domain: selectedDomain,
          plan_type: planType,
          status: "pending_payment",
        })
        .select()
        .single();

      if (linkError) throw linkError;

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          link_id: link.id,
          amount: price,
          currency: selectedCrypto,
          wallet_address: selectedWallet.wallet_address,
          status: "pending",
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      setLinkData({ shortCode, paymentId: payment.id });
      setStep("payment");
      setTimeLeft(900);
    } catch (error: any) {
      toast.error(error.message || "Failed to create link");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!linkData) return;

    setLoading(true);
    try {
      // Update payment status
      const { error: paymentError } = await supabase
        .from("payments")
        .update({ status: "confirmed" })
        .eq("id", linkData.paymentId);

      if (paymentError) throw paymentError;

      // Activate the link
      const { error: linkError } = await supabase
        .from("links")
        .update({ status: "active" })
        .eq("short_code", linkData.shortCode);

      if (linkError) throw linkError;

      setStep("success");
      toast.success("Payment confirmed! Your link is now active.");
    } catch (error: any) {
      toast.error(error.message || "Failed to confirm payment");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard!");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetModal = () => {
    setStep("input");
    setOriginalUrl("");
    setSelectedCrypto("");
    setSelectedWallet(null);
    setLinkData(null);
    setTimeLeft(900);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetModal();
    onOpenChange(open);
  };

  const shortUrl = linkData
    ? `${selectedDomain}/${linkData.shortCode}`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {step === "input" && `Create ${planType === "pro" ? "Pro" : "Basic"} Link`}
            {step === "payment" && "Complete Payment"}
            {step === "success" && "Link Created!"}
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Original URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/your-long-url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                className="bg-input border-border"
              />
            </div>

            {planType === "pro" && domains.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="domain">Select Domain</Label>
                <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.domain}>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          {domain.domain}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Select Payment Method</Label>
              {wallets.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  No payment methods available
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => {
                        setSelectedCrypto(wallet.currency);
                        setSelectedWallet(wallet);
                      }}
                      className={`p-3 rounded-lg border transition-all ${
                        selectedCrypto === wallet.currency
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/50 hover:border-primary/50"
                      }`}
                    >
                      <span className="font-medium text-foreground">{wallet.currency}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-muted-foreground">Total:</span>
              <span className="text-2xl font-bold gradient-text">${price}</span>
            </div>

            <Button
              onClick={handleCreateLink}
              disabled={loading || !originalUrl || !selectedCrypto || wallets.length === 0}
              className="w-full"
              variant="pricing"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Proceed to Payment"
              )}
            </Button>
          </div>
        )}

        {step === "payment" && selectedWallet && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-500 bg-amber-500/10 p-3 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Time remaining: {formatTime(timeLeft)}</span>
            </div>

            {timeLeft === 0 && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-4 h-4" />
                Payment expired. Please create a new link.
              </div>
            )}

            <div className="space-y-2">
              <Label>Send exactly</Label>
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                <span className="text-2xl font-bold text-foreground">${price}</span>
                <span className="text-muted-foreground">in {selectedCrypto}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>To this wallet address</Label>
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                <Wallet className="w-4 h-4 text-primary shrink-0" />
                <code className="text-sm break-all flex-1 text-foreground">
                  {selectedWallet.wallet_address}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(selectedWallet.wallet_address)}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              After sending, click the button below to confirm your payment. 
              Your link will be activated once verified by admin.
            </div>

            <Button
              onClick={handleConfirmPayment}
              disabled={loading || timeLeft === 0}
              className="w-full"
              variant="pricing"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "I've Sent the Payment"
              )}
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>

            <p className="text-muted-foreground">
              Your payment is being verified. Your link will be active shortly.
            </p>

            <div className="space-y-2">
              <Label>Your shortened link</Label>
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                <code className="text-sm flex-1 text-primary font-medium">{shortUrl}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(`https://${shortUrl}`)}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button onClick={() => handleClose(false)} className="w-full" variant="pricing">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateLinkModal;
