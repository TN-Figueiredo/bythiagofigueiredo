-- Clean slate: delete all existing blog posts for fresh start
-- post_hashtags and blog_translations cascade via ON DELETE CASCADE

DELETE FROM blog_posts;
