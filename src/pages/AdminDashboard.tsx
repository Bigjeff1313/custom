import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Globe,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
  MousePointerClick,
  TrendingUp,
  Home,
  Users,
  Shield,
  UserPlus,
  Eye,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Link = Tables<"links">;
type Payment = Tables<"payments">;
type CryptoWallet = Tables<"crypto_wallets">;
type LinkClick = Tables<"link_clicks">;
type AppRole = Enums<"app_role">;

interface CustomDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

interface DomainWithUser extends CustomDomain {
  user_email?: string;
}

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: AppRole | null;
  links?: Link[];
}

interface LinkWithClicks extends Link {
  clicks?: LinkClick[];
}

const AdminDashboard = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [domains, setDomains] = useState<DomainWithUser[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [allClicks, setAllClicks] = useState<LinkClick[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [clicksDialogOpen, setClicksDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkWithClicks | null>(null);
  const [editingWallet, setEditingWallet] = useState<CryptoWallet | null>(null);
  const [editingDomain, setEditingDomain] = useState<CustomDomain | null>(null);
  const [newWallet, setNewWallet] = useState({ currency: "", wallet_address: "" });
  const [newDomain, setNewDomain] = useState("");
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "user" as AppRole });
  const [newLink, setNewLink] = useState({ original_url: "", custom_domain: "customtextx.com", short_code: "", user_id: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      toast.error("Access denied: Admin role required");
      await supabase.auth.signOut();
      navigate("/");
      return;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [linksData] = await Promise.all([fetchLinks(), fetchPayments(), fetchWallets(), fetchDomains(), fetchAllClicks()]);
    await fetchUsers(linksData || []);
    setLoading(false);
  };

  const fetchLinks = async (): Promise<Link[]> => {
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLinks(data);
    if (error) toast.error("Failed to load links");
    return data || [];
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

  const fetchDomains = async () => {
    const { data, error } = await supabase
      .from("custom_domains")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      // Fetch user emails for domains that have user_id
      const domainsWithUsers: DomainWithUser[] = await Promise.all(
        data.map(async (domain) => {
          if (domain.user_id) {
            // Try to find user email from users list
            const userMatch = users.find(u => u.id === domain.user_id);
            return {
              ...domain,
              user_email: userMatch?.email || `User ${domain.user_id.slice(0, 8)}...`
            } as DomainWithUser;
          }
          return { ...domain, user_email: 'Admin' } as DomainWithUser;
        })
      );
      setDomains(domainsWithUsers);
    }
    if (error) toast.error("Failed to load domains");
  };

  const handleVerifyDomain = async (id: string, verified: boolean) => {
    const { error } = await supabase
      .from("custom_domains")
      .update({ is_verified: verified })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update domain verification");
      return;
    }

    toast.success(verified ? "Domain verified!" : "Domain unverified");
    fetchDomains();
  };

  const handleToggleDomainActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("custom_domains")
      .update({ is_active: active })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update domain status");
      return;
    }

    toast.success(active ? "Domain activated" : "Domain deactivated");
    fetchDomains();
  };

  const fetchUsers = async (linksData: Link[]) => {
    // Call edge function to get users list
    const { data, error } = await supabase.functions.invoke("mysql-api", {
      body: { action: "list-users" },
    });

    // Create a map of user_id to their links
    const userLinksMap = new Map<string, Link[]>();
    linksData.forEach((link) => {
      if (link.user_id) {
        const existing = userLinksMap.get(link.user_id) || [];
        existing.push(link);
        userLinksMap.set(link.user_id, existing);
      }
    });

    if (error) {
      // Fallback: just get roles from user_roles table
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (rolesData) {
        const usersWithRoles: UserWithRole[] = rolesData.map((r) => ({
          id: r.user_id,
          email: `User ${r.user_id.slice(0, 8)}...`,
          created_at: r.created_at,
          role: r.role,
          links: userLinksMap.get(r.user_id) || [],
        }));
        setUsers(usersWithRoles);
      }
      if (rolesError) toast.error("Failed to load users");
    } else if (data?.users) {
      const usersWithLinks = data.users.map((user: UserWithRole) => ({
        ...user,
        links: userLinksMap.get(user.id) || [],
      }));
      setUsers(usersWithLinks);
    }
  };

  const fetchAllClicks = async () => {
    const { data, error } = await supabase
      .from("link_clicks")
      .select("*")
      .order("clicked_at", { ascending: false })
      .limit(100);

    if (data) setAllClicks(data);
    if (error) console.error("Failed to load clicks");
  };

  const fetchClicksForLink = async (linkId: string) => {
    const { data, error } = await supabase
      .from("link_clicks")
      .select("*")
      .eq("link_id", linkId)
      .order("clicked_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load click data");
      return [];
    }
    return data || [];
  };

  const handleViewClicks = async (link: Link) => {
    const clicks = await fetchClicksForLink(link.id);
    setSelectedLink({ ...link, clicks });
    setClicksDialogOpen(true);
  };

  const generateShortCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateLink = async () => {
    if (!newLink.original_url) {
      toast.error("Please enter a URL");
      return;
    }

    let url = newLink.original_url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const shortCode = newLink.short_code || generateShortCode();

    const { error } = await supabase.from("links").insert({
      original_url: url,
      short_code: shortCode,
      custom_domain: newLink.custom_domain,
      status: "active",
      plan_type: "basic",
      user_id: newLink.user_id || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("This short code already exists");
      } else {
        toast.error("Failed to create link");
      }
      return;
    }

    toast.success("Link created successfully!");
    setNewLink({ original_url: "", custom_domain: "customtextx.com", short_code: "", user_id: "" });
    setLinkDialogOpen(false);
    fetchLinks();
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
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

  const handleAddDomain = async () => {
    if (!newDomain) {
      toast.error("Please enter a domain");
      return;
    }

    const cleanDomain = newDomain.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '');

    const { error } = await supabase.from("custom_domains").insert({
      domain: cleanDomain,
      is_verified: false,
      is_active: true,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error("Domain already exists");
      } else {
        toast.error("Failed to add domain");
      }
      return;
    }

    toast.success("Domain added successfully");
    setNewDomain("");
    setDomainDialogOpen(false);
    fetchDomains();
  };

  const handleUpdateDomain = async () => {
    if (!editingDomain) return;

    const { error } = await supabase
      .from("custom_domains")
      .update({
        domain: editingDomain.domain,
        is_verified: editingDomain.is_verified,
        is_active: editingDomain.is_active,
      })
      .eq("id", editingDomain.id);

    if (error) {
      toast.error("Failed to update domain");
      return;
    }

    toast.success("Domain updated successfully");
    setEditingDomain(null);
    fetchDomains();
  };

  const handleDeleteDomain = async (id: string) => {
    const { error } = await supabase.from("custom_domains").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete domain");
      return;
    }

    toast.success("Domain deleted");
    fetchDomains();
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      toast.error("Please fill all fields");
      return;
    }

    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-admin", {
        body: { email: newUser.email, password: newUser.password },
      });

      if (error) throw error;

      // If role is user (not admin), we need to update the role
      if (newUser.role === "user" && data?.userId) {
        await supabase.from("user_roles").update({ role: "user" }).eq("user_id", data.userId);
      }

      toast.success(data?.message || "User created successfully");
      setNewUser({ email: "", password: "", role: "user" });
      setUserDialogOpen(false);
      fetchUsers(links);
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleUpdateUserRole = async (userId: string, role: AppRole) => {
    // Check if user has existing role
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      const { error } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId);

      if (error) {
        toast.error("Failed to update role");
        return;
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (error) {
        toast.error("Failed to assign role");
        return;
      }
    }

    toast.success("Role updated");
    fetchUsers(links);
  };

  const handleDeleteUserRole = async (userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);

    if (error) {
      toast.error("Failed to remove role");
      return;
    }

    toast.success("User role removed");
    fetchUsers(links);
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

  const handleDeleteLink = async (id: string) => {
    const { error } = await supabase.from("links").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete link");
      return;
    }

    toast.success("Link deleted");
    fetchLinks();
  };

  const handleUpdatePaymentStatus = async (id: string, status: Payment["status"]) => {
    const { error } = await supabase.from("payments").update({ status }).eq("id", id);

    if (error) {
      toast.error("Failed to update payment");
      return;
    }

    // If confirming payment, also activate the associated link
    if (status === "confirmed") {
      const payment = payments.find(p => p.id === id);
      if (payment?.link_id) {
        await supabase.from("links").update({ status: "active" }).eq("id", payment.link_id);
      }
    }

    toast.success("Payment updated");
    fetchPayments();
    fetchLinks();
  };

  const handleDeletePayment = async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete payment");
      return;
    }

    toast.success("Payment deleted");
    fetchPayments();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copied!");
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

  // Calculate stats
  const totalClicks = links.reduce((sum, link) => sum + (link.click_count || 0), 0);
  const activeLinks = links.filter(l => l.status === "active").length;
  const totalRevenue = payments.filter(p => p.status === "confirmed").reduce((sum, p) => sum + Number(p.amount), 0);

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
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage your link shortener</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <Home className="w-4 h-4" />
            </Button>
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

      <div className="container mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Link2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Links</p>
                <p className="text-2xl font-bold text-foreground">{links.length}</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Active Links</p>
                <p className="text-2xl font-bold text-foreground">{activeLinks}</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <MousePointerClick className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Clicks</p>
                <p className="text-2xl font-bold text-foreground">{totalClicks}</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Revenue</p>
                <p className="text-2xl font-bold text-foreground">${totalRevenue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="links" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="links" className="gap-2">
              <Link2 className="w-4 h-4" />
              Links
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-2">
              <Globe className="w-4 h-4" />
              Domains
            </TabsTrigger>
            <TabsTrigger value="wallets" className="gap-2">
              <Wallet className="w-4 h-4" />
              Wallets
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* Links Tab */}
          <TabsContent value="links" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-lg font-semibold text-foreground">All Links</h2>
              <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="pricing">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Link
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border">
                  <DialogHeader>
                    <DialogTitle>Create New Link</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Original URL</Label>
                      <Input placeholder="https://example.com/long-url" value={newLink.original_url} onChange={(e) => setNewLink({ ...newLink, original_url: e.target.value })} className="bg-input border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label>Domain</Label>
                      <Select value={newLink.custom_domain} onValueChange={(value) => setNewLink({ ...newLink, custom_domain: value })}>
                        <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {domains.map((d) => <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Short Code (optional)</Label>
                      <Input placeholder="my-link" value={newLink.short_code} onChange={(e) => setNewLink({ ...newLink, short_code: e.target.value })} className="bg-input border-border" />
                    </div>
                    <Button onClick={handleCreateLink} className="w-full" variant="pricing">Create Link</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Short URL</TableHead>
                    <TableHead className="text-muted-foreground">Original URL</TableHead>
                    <TableHead className="text-muted-foreground">Plan</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Clicks</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No links yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    links.map((link) => (
                      <TableRow key={link.id} className="border-border">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-primary font-mono">
                              {link.custom_domain}/{link.short_code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(`https://${link.custom_domain}/${link.short_code}`, link.id)}
                            >
                              {copied === link.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-muted-foreground text-sm">{link.original_url}</span>
                            <a href={link.original_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            link.plan_type === 'pro' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {link.plan_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(link.status)}`}>
                            {link.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-foreground font-medium">{link.click_count}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(link.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewClicks(link)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Select value={link.status} onValueChange={(value) => handleUpdateLinkStatus(link.id, value as Link["status"])}>
                              <SelectTrigger className="w-28 h-8 text-xs bg-input border-border"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending_payment">Pending</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Link</AlertDialogTitle>
                                  <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteLink(link.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">Custom Domains</h2>
                <p className="text-sm text-muted-foreground">Manage your branded short link domains</p>
              </div>
              <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="pricing">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border">
                  <DialogHeader>
                    <DialogTitle>Add Custom Domain</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Domain Name</Label>
                      <Input
                        placeholder="yourdomain.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-2">DNS Configuration:</p>
                      <p>Point your domain to: <code className="text-primary">185.158.133.1</code></p>
                    </div>
                    <Button onClick={handleAddDomain} className="w-full" variant="pricing">
                      Add Domain
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Domain</TableHead>
                    <TableHead className="text-muted-foreground">Added By</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No domains added yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    domains.map((domain) => (
                      <TableRow key={domain.id} className="border-border">
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            <span>{domain.domain}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {domain.user_email || 'Admin'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              domain.is_verified ? "text-green-500 bg-green-500/10" : "text-amber-500 bg-amber-500/10"
                            }`}>
                              {domain.is_verified ? "Verified" : "Pending"}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              domain.is_active ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                            }`}>
                              {domain.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(domain.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* One-Click Verify Button */}
                            {!domain.is_verified ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                onClick={() => handleVerifyDomain(domain.id, true)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Verify
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                onClick={() => handleVerifyDomain(domain.id, false)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Unverify
                              </Button>
                            )}
                            {/* Toggle Active Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleDomainActive(domain.id, !domain.is_active)}
                              title={domain.is_active ? "Deactivate" : "Activate"}
                            >
                              {domain.is_active ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                            </Button>
                            {/* Edit Dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingDomain(domain)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="glass border-border">
                                <DialogHeader>
                                  <DialogTitle>Edit Domain</DialogTitle>
                                </DialogHeader>
                                {editingDomain && (
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Domain Name</Label>
                                      <Input
                                        value={editingDomain.domain}
                                        onChange={(e) => setEditingDomain({ ...editingDomain, domain: e.target.value })}
                                        className="bg-input border-border"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor="verified">Verified</Label>
                                      <Switch
                                        id="verified"
                                        checked={editingDomain.is_verified}
                                        onCheckedChange={(checked) => setEditingDomain({ ...editingDomain, is_verified: checked })}
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor="active">Active</Label>
                                      <Switch
                                        id="active"
                                        checked={editingDomain.is_active}
                                        onCheckedChange={(checked) => setEditingDomain({ ...editingDomain, is_active: checked })}
                                      />
                                    </div>
                                    <Button onClick={handleUpdateDomain} className="w-full" variant="pricing">
                                      Save Changes
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            {/* Delete Button */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Domain</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this domain? Links using this domain will stop working.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteDomain(domain.id)} className="bg-destructive text-destructive-foreground">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Wallets Tab */}
          <TabsContent value="wallets" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">Crypto Wallets</h2>
                <p className="text-sm text-muted-foreground">Payment receiving addresses</p>
              </div>
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
                        onChange={(e) => setNewWallet({ ...newWallet, currency: e.target.value.toUpperCase() })}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Wallet Address</Label>
                      <Input
                        placeholder="Enter wallet address"
                        value={newWallet.wallet_address}
                        onChange={(e) => setNewWallet({ ...newWallet, wallet_address: e.target.value })}
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
                  {wallets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No wallets added yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallets.map((wallet) => (
                      <TableRow key={wallet.id} className="border-border">
                        <TableCell className="font-bold text-foreground">{wallet.currency}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-muted-foreground max-w-[250px] truncate">
                              {wallet.wallet_address}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(wallet.wallet_address, wallet.id)}
                            >
                              {copied === wallet.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            wallet.is_active ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                          }`}>
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
                                <Button variant="ghost" size="icon" onClick={() => setEditingWallet(wallet)}>
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
                                        onChange={(e) => setEditingWallet({ ...editingWallet, currency: e.target.value.toUpperCase() })}
                                        className="bg-input border-border"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Wallet Address</Label>
                                      <Input
                                        value={editingWallet.wallet_address}
                                        onChange={(e) => setEditingWallet({ ...editingWallet, wallet_address: e.target.value })}
                                        className="bg-input border-border"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor="wallet-active">Active</Label>
                                      <Switch
                                        id="wallet-active"
                                        checked={editingWallet.is_active ?? false}
                                        onCheckedChange={(checked) => setEditingWallet({ ...editingWallet, is_active: checked })}
                                      />
                                    </div>
                                    <Button onClick={handleUpdateWallet} className="w-full" variant="pricing">
                                      Save Changes
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this wallet?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteWallet(wallet.id)} className="bg-destructive text-destructive-foreground">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">Payment History</h2>
                <p className="text-sm text-muted-foreground">
                  {payments.filter(p => p.status === "confirmed").length} confirmed, {payments.filter(p => p.status === "pending").length} pending
                </p>
              </div>
            </div>
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
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payments yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id} className="border-border">
                        <TableCell className="font-bold text-foreground">${payment.amount}</TableCell>
                        <TableCell className="text-foreground">{payment.currency}</TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground max-w-[120px] truncate block">
                            {payment.wallet_address}
                          </code>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(payment.status)}`}>
                            {payment.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(payment.expires_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(payment.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={payment.status}
                              onValueChange={(value) => handleUpdatePaymentStatus(payment.id, value as Payment["status"])}
                            >
                              <SelectTrigger className="w-28 h-8 text-xs bg-input border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Payment</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this payment record?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePayment(payment.id)} className="bg-destructive text-destructive-foreground">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-heading text-lg font-semibold text-foreground">User Management</h2>
                <p className="text-sm text-muted-foreground">Create and manage user accounts</p>
              </div>
              <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="pricing">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create User
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        className="bg-input border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value) => setNewUser({ ...newUser, role: value as AppRole })}
                      >
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateUser} className="w-full" variant="pricing">
                      Create User
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="glass rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">User ID</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">Links</TableHead>
                    <TableHead className="text-muted-foreground">Total Clicks</TableHead>
                    <TableHead className="text-muted-foreground">Created</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No users with roles found
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => {
                      const userLinks = user.links || [];
                      const totalClicks = userLinks.reduce((sum, link) => sum + (link.click_count || 0), 0);
                      
                      return (
                        <TableRow key={user.id} className="border-border align-top">
                          <TableCell>
                            <code className="text-xs text-muted-foreground">
                              {user.id.slice(0, 8)}...
                            </code>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 w-fit ${
                              user.role === "admin" 
                                ? "text-amber-500 bg-amber-500/10" 
                                : "text-blue-500 bg-blue-500/10"
                            }`}>
                              {user.role === "admin" && <Shield className="w-3 h-3" />}
                              {user.role || "No role"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {userLinks.length === 0 ? (
                              <span className="text-muted-foreground text-sm">No links</span>
                            ) : (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {userLinks.map((link) => (
                                  <div key={link.id} className="flex items-center gap-2">
                                    <code className="text-xs text-primary">
                                      {link.custom_domain}/{link.short_code}
                                    </code>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${getStatusColor(link.status)}`}>
                                      {link.status.replace("_", " ")}
                                    </span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MousePointerClick className="w-3 h-3" />
                                      {link.click_count || 0}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-foreground font-medium">
                            <div className="flex items-center gap-1">
                              <MousePointerClick className="w-4 h-4 text-blue-500" />
                              {totalClicks}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Select
                                value={user.role || "user"}
                                onValueChange={(value) => handleUpdateUserRole(user.id, value as AppRole)}
                              >
                                <SelectTrigger className="w-24 h-8 text-xs bg-input border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="glass border-border">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove User Role</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove the user's role. They will no longer have access.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUserRole(user.id)} className="bg-destructive text-destructive-foreground">
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
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
