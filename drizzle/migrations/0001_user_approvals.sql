CREATE TABLE public.user_approvals (
  user_id uuid PRIMARY KEY,
  email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_approvals TO authenticated;
GRANT ALL ON public.user_approvals TO service_role;
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own approval" ON public.user_approvals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view approvals" ON public.user_approvals FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update approvals" ON public.user_approvals FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
GRANT UPDATE ON public.user_approvals TO authenticated;

INSERT INTO public.user_approvals (user_id, email, status)
SELECT id, email, 'approved' FROM auth.users ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_approvals (user_id, email, status) VALUES (NEW.id, NEW.email, 'pending')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_approval AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

ALTER TABLE public.user_approvals REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_approvals;