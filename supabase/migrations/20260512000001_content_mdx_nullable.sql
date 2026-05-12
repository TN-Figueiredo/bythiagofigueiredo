-- Allow blog_translations.content_mdx to be NULL for TipTap-only posts
ALTER TABLE blog_translations ALTER COLUMN content_mdx DROP NOT NULL;
