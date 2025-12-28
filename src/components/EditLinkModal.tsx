import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, AlertCircle, Link2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Link = Tables<"links">;

interface EditLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: Link | null;
  onSuccess: () => void;
}

const TELEGRAM_CONTACT = "https://t.me/STORMTOOLS101";

const EditLinkModal = ({ open, onOpenChange, link, onSuccess }: EditLinkModalProps) => {
  const [newShortCode, setNewShortCode] = useState("");
  const [newOriginalUrl, setNewOriginalUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (link && open) {
      setNewShortCode(link.short_code);
      setNewOriginalUrl(link.original_url);
    }
  }, [link, open]);

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

  const generateShortCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSave = async () => {
    if (!link) return;

    const formattedUrl = formatUrl(newOriginalUrl);
    
    // Validate URL for Pro users changing it
    if (link.plan_type === "pro" && newOriginalUrl !== link.original_url) {
      if (!isValidUrl(formattedUrl)) {
        toast.error("Please enter a valid URL");
        return;
      }
    }

    // Validate short code
    if (newShortCode.trim() === "") {
      toast.error("Short code cannot be empty");
      return;
    }

    const shortCodeRegex = /^[a-zA-Z0-9-_]+$/;
    if (!shortCodeRegex.test(newShortCode)) {
      toast.error("Short code can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    setLoading(true);

    try {
      const isShortCodeChanged = newShortCode !== link.short_code;
      const isUrlChanged = link.plan_type === "pro" && formattedUrl !== link.original_url;

      if (!isShortCodeChanged && !isUrlChanged) {
        toast.info("No changes to save");
        onOpenChange(false);
        return;
      }

      // If short code changed, check if it's already taken
      if (isShortCodeChanged) {
        const { data: existingLink } = await supabase
          .from("links")
          .select("id")
          .eq("short_code", newShortCode)
          .neq("id", link.id)
          .maybeSingle();

        if (existingLink) {
          toast.error("This short code is already in use");
          setLoading(false);
          return;
        }
      }

      // Build update object
      const updateData: { short_code?: string; original_url?: string } = {};
      
      if (isShortCodeChanged) {
        updateData.short_code = newShortCode;
      }
      
      if (isUrlChanged) {
        updateData.original_url = formattedUrl;
      }

      // Update the link
      const { error } = await supabase
        .from("links")
        .update(updateData)
        .eq("id", link.id);

      if (error) throw error;

      toast.success("Link updated successfully!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update link");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewShortCode("");
    setNewOriginalUrl("");
    onOpenChange(false);
  };

  if (!link) return null;

  const isPro = link.plan_type === "pro";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Edit Link
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Link Info */}
          <div className="p-3 bg-secondary/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Current Short URL</p>
            <code className="text-primary font-medium">
              {link.custom_domain}/{link.short_code}
            </code>
          </div>

          {/* Short Code */}
          <div className="space-y-2">
            <Label htmlFor="shortcode">Short Code</Label>
            <Input
              id="shortcode"
              value={newShortCode}
              onChange={(e) => setNewShortCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
              className="bg-input border-border"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Only letters, numbers, hyphens, and underscores allowed
            </p>
          </div>

          {/* Original URL - Pro only */}
          {isPro ? (
            <div className="space-y-2">
              <Label htmlFor="originalUrl">Original URL (Pro Feature)</Label>
              <Input
                id="originalUrl"
                value={newOriginalUrl}
                onChange={(e) => setNewOriginalUrl(e.target.value)}
                className="bg-input border-border"
                placeholder="https://example.com/your-url"
              />
            </div>
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>Upgrade to Pro to change the original URL</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1"
              variant="pricing"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {/* Contact Admin */}
          <div className="text-center pt-2 border-t border-border">
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
      </DialogContent>
    </Dialog>
  );
};

export default EditLinkModal;