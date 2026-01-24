-- Create user_funds table for wallet/balance system
CREATE TABLE public.user_funds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_deposited NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Create unique constraint on user_id
CREATE UNIQUE INDEX user_funds_user_id_idx ON public.user_funds(user_id);

-- Create fund_transactions table to track deposits
CREATE TABLE public.fund_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency VARCHAR NOT NULL,
  wallet_address TEXT NOT NULL,
  transaction_hash TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'expired'))
);

-- Enable RLS on both tables
ALTER TABLE public.user_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_transactions ENABLE ROW LEVEL SECURITY;

-- User funds policies
CREATE POLICY "Users can view their own funds"
ON public.user_funds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all funds"
ON public.user_funds FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update funds"
ON public.user_funds FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert funds"
ON public.user_funds FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Fund transactions policies
CREATE POLICY "Users can view their own transactions"
ON public.fund_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
ON public.fund_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.fund_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update transactions"
ON public.fund_transactions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_user_funds_updated_at
BEFORE UPDATE ON public.user_funds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fund_transactions_updated_at
BEFORE UPDATE ON public.fund_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();