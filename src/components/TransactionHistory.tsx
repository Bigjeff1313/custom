import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: "deposit" | "deduction";
  amount: number;
  currency: string;
  status: string;
  description?: string;
  transaction_hash?: string | null;
  created_at: string;
}

interface TransactionHistoryProps {
  userId: string;
}

const TransactionHistory = ({ userId }: TransactionHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchTransactions();
    }
  }, [userId]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Fetch fund deposits from fund_transactions
      const { data: deposits, error: depositsError } = await supabase
        .from("fund_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (depositsError) throw depositsError;

      // Fetch payments made by user (for balance deductions)
      // These are confirmed payments linked to user's links
      const { data: userLinks } = await supabase
        .from("links")
        .select("id")
        .eq("user_id", userId);

      const linkIds = userLinks?.map((l) => l.id) || [];

      let deductions: Transaction[] = [];
      if (linkIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select("*, links!inner(user_id, short_code)")
          .in("link_id", linkIds)
          .eq("status", "confirmed")
          .order("created_at", { ascending: false });

        if (paymentsError) throw paymentsError;

        deductions = (payments || []).map((p) => ({
          id: p.id,
          type: "deduction" as const,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          description: `Link: ${p.links?.short_code || "N/A"}`,
          transaction_hash: p.transaction_hash,
          created_at: p.created_at,
        }));
      }

      // Transform deposits
      const depositTransactions: Transaction[] = (deposits || []).map((d) => ({
        id: d.id,
        type: "deposit" as const,
        amount: Number(d.amount),
        currency: d.currency,
        status: d.status,
        description: "Balance deposit",
        transaction_hash: d.transaction_hash,
        created_at: d.created_at,
      }));

      // Combine and sort by date
      const allTransactions = [...depositTransactions, ...deductions].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(allTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transaction history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "expired":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            Confirmed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Pending
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No transactions yet</p>
        <p className="text-sm mt-1">
          Your deposits and link purchases will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead className="text-muted-foreground">Type</TableHead>
            <TableHead className="text-muted-foreground">Amount</TableHead>
            <TableHead className="text-muted-foreground">Description</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Date</TableHead>
            <TableHead className="text-muted-foreground">TX Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id} className="border-border">
              <TableCell>
                <div className="flex items-center gap-2">
                  {tx.type === "deposit" ? (
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <ArrowDownCircle className="w-4 h-4 text-green-500" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                    </div>
                  )}
                  <span className="font-medium capitalize">{tx.type}</span>
                </div>
              </TableCell>
              <TableCell>
                <span
                  className={`font-bold ${
                    tx.type === "deposit" ? "text-green-500" : "text-blue-500"
                  }`}
                >
                  {tx.type === "deposit" ? "+" : "-"}${tx.amount.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-xs ml-1 uppercase">
                  {tx.currency}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {tx.description}
              </TableCell>
              <TableCell>{getStatusBadge(tx.status)}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDate(tx.created_at)}
              </TableCell>
              <TableCell>
                {tx.transaction_hash ? (
                  <a
                    href={`https://blockscan.com/tx/${tx.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    <span className="truncate max-w-[80px]">
                      {tx.transaction_hash.slice(0, 8)}...
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TransactionHistory;
