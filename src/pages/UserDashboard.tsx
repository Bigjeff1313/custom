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
  Link2,
  LogOut,
  Plus,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  MousePointerClick,
  TrendingUp,
  Home,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Eye,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { User as SupabaseUser } from "@supabase/supabase-js";

type Link = Tables<"links">;
type LinkClick = Tables<"link_clicks">;

interface CustomDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  is_active: boolean;
}

interface LinkWithClicks extends Link {
  clicks?: LinkClick[];
}

const UserDashboard = () => {
  const [links, setLinks] = useState<LinkWithClicks[]>([]);
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LinkWithClicks | null>(null);
  const [clicksDialogOpen, setClicksDialogOpen] = useState(false);
  const [newLink, setNewLink] = useState({
    original_url: "",
    custom_domain: "customtextx.com",
    short_code: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    
    // Check if admin, redirect to admin dashboard
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      navigate("/admin");
      return;
    }

    fetchData(session.user.id);
  };

  const fetchData = async (userId: string) => {
    setLoading(true);
    await Promise.all([fetchLinks(userId), fetchDomains()]);
    setLoading(false);
  };

  const fetchLinks = async (userId: string) => {
    // Fetch only links belonging to this user
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) setLinks(data);
    if (error) toast.error("Failed to load links");
  };

  const fetchDomains = async () => {
    const { data, error } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("is_active", true)
      .eq("is_verified", true);

    if (data) setDomains(data as CustomDomain[]);
    if (error) toast.error("Failed to load domains");
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

  const handleViewClicks = async (link: LinkWithClicks) => {
    const clicks = await fetchClicksForLink(link.id);
    setSelectedLink({ ...link, clicks });
    setClicksDialogOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
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

    if (!user) {
      toast.error("You must be logged in");
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
      status: "pending_payment",
      plan_type: "basic",
      user_id: user.id,
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
    setNewLink({ original_url: "", custom_domain: "customtextx.com", short_code: "" });
    setCreateDialogOpen(false);
    if (user) fetchLinks(user.id);
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
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
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
        return "text-green-500 bg-green-500/10";
      case "pending_payment":
        return "text-amber-500 bg-amber-500/10";
      case "expired":
        return "text-red-500 bg-red-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
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

  const totalClicks = links.reduce((sum, link) => sum + (link.click_count || 0), 0);
  const activeLinks = links.filter((l) => l.status === "active").length;

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
              <h1 className="font-heading text-xl font-bold text-foreground">My Dashboard</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <Home className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => user && fetchData(user.id)}>
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Link2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">My Links</p>
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
        </div>

        {/* Links Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-heading text-lg font-semibold text-foreground">My Links</h2>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                    <Input
                      placeholder="https://example.com/your-long-url"
                      value={newLink.original_url}
                      onChange={(e) => setNewLink({ ...newLink, original_url: e.target.value })}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Select
                      value={newLink.custom_domain}
                      onValueChange={(value) => setNewLink({ ...newLink, custom_domain: value })}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {domains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.domain}>
                            {domain.domain}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Short Code (optional)</Label>
                    <Input
                      placeholder="my-link"
                      value={newLink.short_code}
                      onChange={(e) => setNewLink({ ...newLink, short_code: e.target.value })}
                      className="bg-input border-border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for auto-generated code
                    </p>
                  </div>
                  <Button onClick={handleCreateLink} className="w-full" variant="pricing">
                    Create Link
                  </Button>
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
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Clicks</TableHead>
                  <TableHead className="text-muted-foreground">Created</TableHead>
                  <TableHead className="text-muted-foreground">Analytics</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No links yet. Create your first link!
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
                            onClick={() =>
                              copyToClipboard(
                                `https://${link.custom_domain}/${link.short_code}`,
                                link.id
                              )
                            }
                          >
                            {copied === link.id ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-muted-foreground text-sm">
                            {link.original_url}
                          </span>
                          <a href={link.original_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(link.status)}`}>
                          {link.status.replace("_", " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        {link.click_count}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(link.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewClicks(link)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Click Analytics Dialog */}
      <Dialog open={clicksDialogOpen} onOpenChange={setClicksDialogOpen}>
        <DialogContent className="glass border-border max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-primary" />
              Click Analytics
            </DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4">
              {/* Link Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <code className="text-sm text-primary font-mono">
                    {selectedLink.custom_domain}/{selectedLink.short_code}
                  </code>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {selectedLink.original_url}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-foreground font-medium">
                    {selectedLink.click_count} total clicks
                  </span>
                </div>
              </div>

              {/* Clicks Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Time</TableHead>
                      <TableHead className="text-muted-foreground">Device</TableHead>
                      <TableHead className="text-muted-foreground">Browser</TableHead>
                      <TableHead className="text-muted-foreground">OS</TableHead>
                      <TableHead className="text-muted-foreground">Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(!selectedLink.clicks || selectedLink.clicks.length === 0) ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No clicks recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedLink.clicks.map((click) => (
                        <TableRow key={click.id} className="border-border">
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(click.clicked_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              {getDeviceIcon(click.device_type)}
                              <span className="capitalize">{click.device_type || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {click.browser || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {click.os || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-primary" />
                              <span>
                                {click.city && click.city !== 'Unknown' ? `${click.city}, ` : ''}
                                {click.country || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDashboard;
