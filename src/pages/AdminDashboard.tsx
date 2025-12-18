import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Link2,
  Wallet,
  CreditCard,
  LogOut,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Link = Tables<"links">;
type Payment = Tables<"payments">;
type CryptoWallet = Tables<"crypto_wallets">;

const AdminDashboard = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<CryptoWallet | null>(null);
  const [newWallet, setNewWallet] = useState({ currency: "", wallet_address: "" });
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/login");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchLinks(), fetchPayments(), fetchWallets()]);
    setLoading(false);
  };

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLinks(data);
    if (error) toast.error("Failed to load links");
  };

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPayments(data);
    if (error) toast.error("Failed to load payments");
  };

  const fetchWallets = async () => {
    const { data, error } = await supabase
      .from("crypto_wallets")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setWallets(data);
    if (error) toast.error("Failed to load wallets");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const handleAddWallet = async () => {
    if (!newWallet.currency || !newWallet.wallet_address) {
      toast.error("Please fill all fields");
      return;
    }

    const { error } = await supabase.from("crypto_wallets").insert({
      currency: newWallet.currency,
      wallet_address: newWallet.wallet_address,
    });

    if (error) {
      toast.error("Failed to add wallet");
      return;
    }

    toast.success("Wallet added successfully");
    setNewWallet({ currency: "", wallet_address: "" });
    setWalletDialogOpen(false);
    fetchWallets();
  };

  const handleUpdateWallet = async () => {
    if (!editingWallet) return;

    const { error } = await supabase
      .from("crypto_wallets")
      .update({
        currency: editingWallet.currency,
        wallet_address: editingWallet.wallet_address,
        is_active: editingWallet.is_active,
      })
      .eq("id", editingWallet.id);

    if (error) {
      toast.error("Failed to update wallet");
      return;
    }

    toast.success("Wallet updated successfully");
    setEditingWallet(null);
    fetchWallets();
  };

  const handleDeleteWallet = async (id: string) => {
    const { error } = await supabase.from("crypto_wallets").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete wallet");
      return;
    }

    toast.success("Wallet deleted");
    fetchWallets();
  };

  const handleUpdateLinkStatus = async (id: string, status: Link["status"]) => {
    const { error } = await supabase.from("links").update({ status }).eq("id", id);

    if (error) {
      toast.error("Failed to update link");
      return;
    }

    toast.success("Link updated");
    fetchLinks();
  };

  const handleUpdatePaymentStatus = async (id: string, status: Payment["status"]) => {
    const { error } = await supabase.from("payments").update({ status }).eq("id", id);

    if (error) {
      toast.error("Failed to update payment");
      return;
    }

    toast.success("Payment updated");
    fetchPayments();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "confirmed":
        return "text-green-500 bg-green-500/10";
      case "pending":
      case "pending_payment":
        return "text-amber-500 bg-amber-500/10";
      case "expired":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link2 className="w-8 h-8 text-primary" />
            <h1 className="font-heading text-xl font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Link2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Links</p>
                <p className="text-2xl font-bold text-foreground">{links.length}</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Confirmed Payments</p>
                <p className="text-2xl font-bold text-foreground">
                  {payments.filter((p) => p.status === "confirmed").length}
                </p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Active Wallets</p>
                <p className="text-2xl font-bold text-foreground">
                  {wallets.filter((w) => w.is_active).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="wallets" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Crypto Wallets
              </h2>
              <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="pricing">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Wallet
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border">
                  <DialogHeader>
                    <DialogTitle>Add New Wallet</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input
                        placeholder="BTC, ETH, USDT..."
                        value={newWallet.currency}
                        onChange={(e) =>
                          setNewWallet({ ...newWallet, currency: e.target.value.toUpperCase() })
                        }
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Wallet Address</Label>
                      <Input
                        placeholder="Enter wallet address"
                        value={newWallet.wallet_address}
                        onChange={(e) =>
                          setNewWallet({ ...newWallet, wallet_address: e.target.value })
                        }
                        className="bg-input border-border"
                      />
                    </div>
                    <Button onClick={handleAddWallet} className="w-full" variant="pricing">
                      Add Wallet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Currency</TableHead>
                    <TableHead className="text-muted-foreground">Wallet Address</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.map((wallet) => (
                    <TableRow key={wallet.id} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        {wallet.currency}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground max-w-xs truncate">
                        {wallet.wallet_address}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            wallet.is_active ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                          }`}
                        >
                          {wallet.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(wallet.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingWallet(wallet)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="glass border-border">
                              <DialogHeader>
                                <DialogTitle>Edit Wallet</DialogTitle>
                              </DialogHeader>
                              {editingWallet && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Currency</Label>
                                    <Input
                                      value={editingWallet.currency}
                                      onChange={(e) =>
                                        setEditingWallet({
                                          ...editingWallet,
                                          currency: e.target.value.toUpperCase(),
                                        })
                                      }
                                      className="bg-input border-border"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Wallet Address</Label>
                                    <Input
                                      value={editingWallet.wallet_address}
                                      onChange={(e) =>
                                        setEditingWallet({
                                          ...editingWallet,
                                          wallet_address: e.target.value,
                                        })
                                      }
                                      className="bg-input border-border"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id="active"
                                      checked={editingWallet.is_active ?? false}
                                      onChange={(e) =>
                                        setEditingWallet({
                                          ...editingWallet,
                                          is_active: e.target.checked,
                                        })
                                      }
                                      className="rounded border-border"
                                    />
                                    <Label htmlFor="active">Active</Label>
                                  </div>
                                  <Button
                                    onClick={handleUpdateWallet}
                                    className="w-full"
                                    variant="pricing"
                                  >
                                    Save Changes
                                  </Button>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWallet(wallet.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">All Links</h2>
            <div className="glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Short Code</TableHead>
                    <TableHead className="text-muted-foreground">Original URL</TableHead>
                    <TableHead className="text-muted-foreground">Plan</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Clicks</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id} className="border-border">
                      <TableCell className="font-mono text-primary">{link.short_code}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {link.original_url}
                      </TableCell>
                      <TableCell className="capitalize text-foreground">{link.plan_type}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(link.status)}`}>
                          {link.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground">{link.click_count}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(link.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={link.status}
                          onValueChange={(value) =>
                            handleUpdateLinkStatus(link.id, value as Link["status"])
                          }
                        >
                          <SelectTrigger className="w-32 bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending_payment">Pending</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">All Payments</h2>
            <div className="glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Amount</TableHead>
                    <TableHead className="text-muted-foreground">Currency</TableHead>
                    <TableHead className="text-muted-foreground">Wallet</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Expires</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="border-border">
                      <TableCell className="font-bold text-foreground">${payment.amount}</TableCell>
                      <TableCell className="text-foreground">{payment.currency}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate text-muted-foreground">
                        {payment.wallet_address}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payment.expires_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={payment.status}
                          onValueChange={(value) =>
                            handleUpdatePaymentStatus(payment.id, value as Payment["status"])
                          }
                        >
                          <SelectTrigger className="w-32 bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
