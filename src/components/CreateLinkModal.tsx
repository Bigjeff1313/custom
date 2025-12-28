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
import { Copy, Check, Loader2, Clock, Wallet, Globe, AlertCircle, Plus, Settings, QrCode, Download, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
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
  user_id: string | null;
}

const DEFAULT_DOMAIN = "customtextx.com";
const SERVER_IP = "72.60.119.80";
const TELEGRAM_CONTACT = "https://t.me/STORMTOOLS101";

const CreateLinkModal = ({ open, onOpenChange, initialUrl = "" }: CreateLinkModalProps) => {
  const [step, setStep] = useState<"input" | "payment" | "success" | "domain-setup">("input");
  const [originalUrl, setOriginalUrl] = useState(initialUrl);
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "pro">("basic");
  const [selectedDomain, setSelectedDomain] = useState<string>(DEFAULT_DOMAIN);
  const [customShortCode, setCustomShortCode] = useState("");
  const [selectedCrypto, setSelectedCrypto] = useState<string>("");
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkData, setLinkData] = useState<{ shortCode: string; paymentId: string } | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<CryptoWallet | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  const [showDomainInstructions, setShowDomainInstructions] = useState(false);
  const [newCustomDomain, setNewCustomDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);

  const price = selectedPlan === "basic" ? 5 : 10;

  useEffect(() => {
    if (open) {
      fetchWallets();
      fetchDomains();
      if (initialUrl) {
        setOriginalUrl(initialUrl);
      }
    }
  }, [open, initialUrl]);

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
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch user's own domains
    const { data, error } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("is_active", true);

    if (data && data.length > 0) {
      // Filter to show only user's domains (or admin can see all)
      const userDomains = user ? data.filter(d => d.user_id === user.id || d.user_id === null) : [];
      setDomains(userDomains as CustomDomain[]);
      if (userDomains.length > 0) {
        setSelectedDomain(userDomains[0].domain);
      }
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

  const handleAddDomain = async () => {
    if (!newCustomDomain.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newCustomDomain.trim())) {
      toast.error("Please enter a valid domain (e.g., example.com)");
      return;
    }

    setAddingDomain(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please login to add a custom domain");
        return;
      }

      const { data, error } = await supabase
        .from("custom_domains")
        .insert({
          domain: newCustomDomain.trim().toLowerCase(),
          user_id: user.id,
          is_active: true,
          is_verified: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error("This domain is already registered");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Domain added! Contact admin to verify it.");
      setNewCustomDomain("");
      setDomains([...domains, data as CustomDomain]);
      setSelectedDomain(data.domain);
      setShowDomainInstructions(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add domain");
    } finally {
      setAddingDomain(false);
    }
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
      const shortCode = customShortCode.trim() || generateShortCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Get user id
      const { data: { user } } = await supabase.auth.getUser();

      // Create the link
      const { data: link, error: linkError } = await supabase
        .from("links")
        .insert({
          original_url: formattedUrl,
          short_code: shortCode,
          custom_domain: selectedDomain,
          plan_type: selectedPlan,
          status: "pending_payment",
          user_id: user?.id || null,
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
    setSelectedPlan("basic");
    setSelectedDomain(DEFAULT_DOMAIN);
    setCustomShortCode("");
    setSelectedCrypto("");
    setSelectedWallet(null);
    setLinkData(null);
    setTimeLeft(900);
    setShowDomainInstructions(false);
    setNewCustomDomain("");
  };

  const handleClose = (open: boolean) => {
    if (!open) resetModal();
    onOpenChange(open);
  };

  const copyIpToClipboard = () => {
    navigator.clipboard.writeText(SERVER_IP);
    toast.success("IP address copied!");
  };

  const shortUrl = linkData
    ? `${selectedDomain}/${linkData.shortCode}`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {step === "input" && "Create New Link"}
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

            {/* Plan Selection */}
            <div className="space-y-2">
              <Label>Select Plan</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setSelectedPlan("basic");
                    setSelectedDomain(DEFAULT_DOMAIN);
                    setCustomShortCode("");
                  }}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectedPlan === "basic"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/50 hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-foreground">Basic</div>
                  <div className="text-2xl font-bold gradient-text">$5</div>
                  <div className="text-xs text-muted-foreground mt-1">Default domain</div>
                </button>
                <button
                  onClick={() => setSelectedPlan("pro")}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectedPlan === "pro"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/50 hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-foreground">Pro</div>
                  <div className="text-2xl font-bold gradient-text">$10</div>
                  <div className="text-xs text-muted-foreground mt-1">Custom domain + short code</div>
                </button>
              </div>
            </div>

            {/* Domain Selection */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              {selectedPlan === "basic" ? (
                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <Globe className="w-4 h-4 text-primary" />
                  <span className="text-foreground">{DEFAULT_DOMAIN}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {domains.length > 0 && (
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
                              {!domain.is_verified && (
                                <span className="text-xs text-amber-500">(pending verification)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDomainInstructions(!showDomainInstructions)}
                    className="w-full flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Custom Domain
                  </Button>
                  
                  {showDomainInstructions && (
                    <div className="p-4 bg-secondary/50 rounded-lg border border-border space-y-3">
                      {/* Domain Input */}
                      <div className="space-y-2">
                        <Label htmlFor="newDomain">Enter Your Domain</Label>
                        <div className="flex gap-2">
                          <Input
                            id="newDomain"
                            placeholder="example.com"
                            value={newCustomDomain}
                            onChange={(e) => setNewCustomDomain(e.target.value)}
                            className="bg-input border-border flex-1"
                          />
                          <Button
                            onClick={handleAddDomain}
                            disabled={addingDomain || !newCustomDomain.trim()}
                            size="sm"
                          >
                            {addingDomain ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Add"
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Settings className="w-4 h-4 text-primary" />
                        DNS Configuration Instructions
                      </div>
                      <p className="text-xs text-muted-foreground">
                        To connect your custom domain, add the following DNS records at your domain registrar:
                      </p>
                      <div className="space-y-2">
                        <div className="p-2 bg-background rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">A Record (Root Domain)</div>
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-foreground">@ → {SERVER_IP}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyIpToClipboard}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-2 bg-background rounded border border-border">
                          <div className="text-xs text-muted-foreground mb-1">A Record (WWW Subdomain)</div>
                          <div className="flex items-center justify-between">
                            <code className="text-sm text-foreground">www → {SERVER_IP}</code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyIpToClipboard}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 bg-primary/10 rounded text-xs text-muted-foreground">
                        <strong className="text-foreground">Note:</strong> After adding your domain, contact admin on{" "}
                        <a href={TELEGRAM_CONTACT} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Telegram
                        </a>{" "}
                        to verify and activate it.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Short Code - Pro only */}
            {selectedPlan === "pro" && (
              <div className="space-y-2">
                <Label htmlFor="shortcode">Custom Short Code (optional)</Label>
                <Input
                  id="shortcode"
                  placeholder="Leave empty for auto-generated code"
                  value={customShortCode}
                  onChange={(e) => setCustomShortCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                  className="bg-input border-border"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  Only letters, numbers, hyphens, and underscores allowed
                </p>
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

            {/* Contact Admin */}
            <div className="text-center pt-2">
              <a
                href={TELEGRAM_CONTACT}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Send className="w-4 h-4" />
                Need help? Contact Admin
              </a>
            </div>
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

            {/* Contact Admin */}
            <div className="text-center">
              <a
                href={TELEGRAM_CONTACT}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Send className="w-4 h-4" />
                Need help? Contact Admin
              </a>
            </div>
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

            {/* QR Code for Pro users */}
            {selectedPlan === "pro" && (
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <QrCode className="w-4 h-4" />
                  <span>QR Code (Pro Feature)</span>
                </div>
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl">
                    <QRCodeSVG 
                      value={`https://${shortUrl}`}
                      size={150}
                      level="H"
                      id="qr-code"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mx-auto flex items-center gap-2"
                  onClick={() => {
                    const svg = document.getElementById("qr-code");
                    if (svg) {
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const canvas = document.createElement("canvas");
                      const ctx = canvas.getContext("2d");
                      const img = new Image();
                      img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx?.drawImage(img, 0, 0);
                        const pngFile = canvas.toDataURL("image/png");
                        const downloadLink = document.createElement("a");
                        downloadLink.download = `qr-${linkData?.shortCode}.png`;
                        downloadLink.href = pngFile;
                        downloadLink.click();
                      };
                      img.src = "data:image/svg+xml;base64," + btoa(svgData);
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download QR Code
                </Button>
              </div>
            )}

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