-- Add 'idea' status before 'draft' for blog hub kanban
-- Must be a standalone migration (ALTER TYPE ADD VALUE cannot run in transaction)
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'idea' BEFORE 'draft';
