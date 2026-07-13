import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Check, Wallet, Clock, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Wallet {
  id: string;
  currency: string;
  wallet_address: string;
  is_active: boolean;
}

interface AddFundsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TELEGRAM_CONTACT = "https://t.me/STORMTOOLS101";

const AddFundsModal = ({ open, onOpenChange, onSuccess }: AddFundsModalProps) => {
  const [step, setStep] = useState<"amount" | "payment" | "submitted">("amount");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      fetchWallets();
    }
  }, [open]);

  const fetchWallets = async () => {
    const { data, error } = await supabase
      .from("crypto_wallets")
      .select("*")
      .eq("is_active", true);

    if (data) setWallets(data);
    if (error) toast.error("Failed to load payment options");
  };

  const handleCryptoSelect = (currency: string) => {
    setSelectedCrypto(currency);
    const wallet = wallets.find((w) => w.currency === currency);
    setSelectedWallet(wallet || null);
  };

  const handleProceedToPayment = async () => {
    if (!amount || parseFloat(amount) < 25) {
      toast.error("Minimum deposit amount is $25");
      return;
    }

    if (!selectedCrypto || !selectedWallet) {
      toast.error("Please select a payment method");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create fund transaction record
      const { data, error } = await supabase
        .from("fund_transactions")
        .insert({
          user_id: user.id,
          amount: parseFloat(amount),
          currency: selectedCrypto,
          wallet_address: selectedWallet.wallet_address,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      setTransactionId(data.id);
      setStep("payment");
    } catch (error: any) {
      toast.error(error.message || "Failed to create deposit request");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    setLoading(true);
    try {
      // Notify admin via Telegram about pending deposit
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke('telegram-notify', {
        body: {
          type: 'fund_deposit',
          amount: parseFloat(amount),
          currency: selectedCrypto,
          userEmail: user?.email || 'Unknown',
          transactionId: transactionId,
        }
      });

      setStep("submitted");
      toast.success("Deposit submitted! Awaiting admin confirmation.");
    } catch (error) {
      console.error('Failed to send notification:', error);
      setStep("submitted");
      toast.success("Deposit submitted! Awaiting admin confirmation.");
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

  const resetModal = () => {
    setStep("amount");
    setAmount("");
    setSelectedCrypto("");
    setSelectedWallet(null);
    setTransactionId(null);
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      resetModal();
      onSuccess?.();
    }
    onOpenChange(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {step === "amount" && "Add Funds"}
            {step === "payment" && "Complete Deposit"}
            {step === "submitted" && "Deposit Submitted"}
          </DialogTitle>
        </DialogHeader>

        {step === "amount" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Minimum $25"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-input border-border"
                min="25"
                step="1"
              />
              <p className="text-xs text-muted-foreground">Minimum deposit: $25</p>
            </div>

            <div className="space-y-2">
              <Label>Select Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      selectedCrypto === wallet.currency
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                    onClick={() => handleCryptoSelect(wallet.currency)}
                  >
                    <span className="font-medium">{wallet.currency}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleProceedToPayment}
              className="w-full"
              variant="pricing"
              disabled={loading || !amount || parseFloat(amount) < 25 || !selectedCrypto}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Continue to Payment
            </Button>
          </div>
        )}

        {step === "payment" && selectedWallet && (
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Send exactly</p>
              <p className="text-2xl font-bold text-primary">
                ${amount} in {selectedCrypto}
              </p>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG value={selectedWallet.wallet_address} size={150} />
            </div>

            <div className="space-y-2">
              <Label>Wallet Address</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
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

            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <p className="text-sm text-amber-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                After sending, click "I've Sent Payment" below
              </p>
            </div>

            <Button
              onClick={handleSubmitPayment}
              className="w-full"
              variant="pricing"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              I've Sent Payment
            </Button>
          </div>
        )}

        {step === "submitted" && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground">Awaiting Confirmation</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Your deposit of ${amount} {selectedCrypto} is being reviewed. 
                Funds will be added to your balance once confirmed by admin.
              </p>
            </div>
            <a
              href={TELEGRAM_CONTACT}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Send className="w-4 h-4" />
              Contact support on Telegram
            </a>
            <Button
              onClick={() => handleClose(false)}
              className="w-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddFundsModal;
