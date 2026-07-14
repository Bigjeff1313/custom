
CREATE POLICY "Users can delete their own links" ON public.links FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.links REPLICA IDENTITY FULL;
ALTER TABLE public.link_clicks REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.link_clicks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
