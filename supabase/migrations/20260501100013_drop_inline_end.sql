-- Migration: drop_inline_end
-- Wrapped in DO blocks to handle tables that may not exist yet
DO $$ BEGIN
  DELETE FROM public.ad_slot_creatives WHERE slot_key = 'inline_end';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM public.ad_slot_metrics WHERE slot_key = 'inline_end';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE public.ad_events SET slot_id = 'inline_end_retired' WHERE slot_id = 'inline_end';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM public.ad_placeholders WHERE slot_id = 'inline_end';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM public.kill_switches WHERE id = 'ads_slot_inline_end';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM public.ad_slot_config WHERE slot_key = 'inline_end';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
