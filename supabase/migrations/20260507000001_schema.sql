-- =============================================================================
-- 0001_schema.sql — Squashed from 196 incremental dev-phase migrations.
-- Generated via `supabase db dump --schema public` on 2026-05-06.
-- Reordered: tables → functions → indexes → policies → views → triggers
-- =============================================================================
-- Extensions
-- =============================================================================
-- 0001_schema.sql — Squashed from 196 incremental dev-phase migrations.
-- Generated via `supabase db dump --schema public` on 2026-05-06.
-- This is the full DDL for the public schema at Sprint 5f completion.
-- OWNER TO / SET / GRANT statements stripped (role-dependent, recreated by Supabase).
-- =============================================================================

-- Supabase local installs citext in 'extensions' schema, but remote has it in 'public'.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    ALTER EXTENSION citext SET SCHEMA public;
  ELSE
    CREATE EXTENSION citext SCHEMA public;
  END IF;
END $$;


-- pg_trgm for trigram indexes (gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;


CREATE SCHEMA IF NOT EXISTS "public";





DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    CREATE OR REPLACE VIEW "public"."v_cron_health" AS
     SELECT "j"."jobname",
        "j"."schedule",
        "d"."status" AS "last_status",
        "d"."start_time" AS "last_run",
        "d"."end_time" AS "last_end",
        (EXTRACT(epoch FROM ("d"."end_time" - "d"."start_time")))::numeric(10,2) AS "duration_secs",
        "d"."return_message",
            CASE
                WHEN ("d"."status" = 'failed'::"text") THEN 'ALERTA'::"text"
                WHEN (("d"."start_time" < ("now"() - '25:00:00'::interval)) AND ("j"."schedule" !~~ '*/%'::"text") AND ("j"."schedule" !~~ '* %'::"text")) THEN 'ATRASADO'::"text"
                ELSE 'OK'::"text"
            END AS "health"
       FROM ("cron"."job" "j"
         LEFT JOIN LATERAL ( SELECT "rd"."status",
                "rd"."start_time",
                "rd"."end_time",
                "rd"."return_message"
               FROM "cron"."job_run_details" "rd"
              WHERE ("rd"."jobid" = "j"."jobid")
              ORDER BY "rd"."start_time" DESC
             LIMIT 1) "d" ON (true))
      ORDER BY "j"."jobname";
    COMMENT ON VIEW "public"."v_cron_health" IS 'Dashboard de saúde dos cron jobs.';
  END IF;
END $$;


-- Enum types



CREATE TYPE "public"."email_provider" AS ENUM (
    'brevo',
    'resend',
    'ses'
);





CREATE TYPE "public"."link_source_type" AS ENUM (
    'manual',
    'campaign',
    'newsletter',
    'blog',
    'social',
    'print'
);





CREATE TYPE "public"."post_status" AS ENUM (
    'idea',
    'draft',
    'ready',
    'queued',
    'scheduled',
    'pending_review',
    'published',
    'archived'
);


-- Tables















































































































































CREATE TABLE IF NOT EXISTS "public"."consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "anonymous_id" "text",
    "category" "text" NOT NULL,
    "site_id" "uuid",
    "consent_text_id" "text" NOT NULL,
    "granted" boolean NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "withdrawn_at" timestamp with time zone,
    "ip" "inet",
    "user_agent" "text",
    CONSTRAINT "consents_anonymous_id_check" CHECK ((("anonymous_id" IS NULL) OR ("anonymous_id" ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'::"text"))),
    CONSTRAINT "consents_category_check" CHECK (("category" = ANY (ARRAY['cookie_functional'::"text", 'cookie_analytics'::"text", 'cookie_marketing'::"text", 'newsletter'::"text", 'privacy_policy'::"text", 'terms_of_service'::"text"]))),
    CONSTRAINT "consents_check" CHECK (((("user_id" IS NOT NULL) AND ("anonymous_id" IS NULL)) OR (("user_id" IS NULL) AND ("anonymous_id" IS NOT NULL))))
);


























































































































































































































































CREATE TABLE IF NOT EXISTS "public"."ad_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "advertiser" "text",
    "format" "text" DEFAULT 'image'::"text" NOT NULL,
    "audience" "jsonb" DEFAULT '[]'::"jsonb",
    "limits" "jsonb" DEFAULT '{}'::"jsonb",
    "priority" integer DEFAULT 0,
    "schedule_start" timestamp with time zone,
    "schedule_end" timestamp with time zone,
    "pricing_model" "text" DEFAULT 'cpm'::"text" NOT NULL,
    "pricing_value" numeric DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "impressions_delivered" integer DEFAULT 0,
    "clicks_delivered" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'house'::"text" NOT NULL,
    "brand_color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "logo_url" "text",
    "app_id" "text" DEFAULT 'bythiagofigueiredo'::"text" NOT NULL,
    "target_categories" "text"[] DEFAULT '{}'::"text"[],
    "impressions_target" integer,
    "clicks_target" integer,
    "budget_cents" integer,
    "spent_cents" integer DEFAULT 0 NOT NULL,
    "pacing_strategy" "text" DEFAULT 'even'::"text" NOT NULL,
    "variant_group" "text",
    "variant_weight" integer DEFAULT 50 NOT NULL,
    CONSTRAINT "ad_campaigns_budget_positive" CHECK ((("budget_cents" IS NULL) OR ("budget_cents" > 0))),
    CONSTRAINT "ad_campaigns_format_check" CHECK (("format" = ANY (ARRAY['image'::"text", 'video'::"text", 'native'::"text", 'house'::"text"]))),
    CONSTRAINT "ad_campaigns_pacing_strategy_check" CHECK (("pacing_strategy" = ANY (ARRAY['even'::"text", 'front_loaded'::"text", 'asap'::"text"]))),
    CONSTRAINT "ad_campaigns_pricing_model_check" CHECK (("pricing_model" = ANY (ARRAY['cpm'::"text", 'cpc'::"text", 'cpa'::"text", 'flat'::"text", 'house_free'::"text"]))),
    CONSTRAINT "ad_campaigns_spent_non_negative" CHECK (("spent_cents" >= 0)),
    CONSTRAINT "ad_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'archived'::"text"]))),
    CONSTRAINT "ad_campaigns_type_check" CHECK (("type" = ANY (ARRAY['house'::"text", 'cpa'::"text"]))),
    CONSTRAINT "ad_campaigns_variant_weight_check" CHECK ((("variant_weight" >= 1) AND ("variant_weight" <= 100)))
);




CREATE TABLE IF NOT EXISTS "public"."ad_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ad_id" "uuid",
    "event_type" "text" NOT NULL,
    "user_hash" "text" NOT NULL,
    "app_id" "text" NOT NULL,
    "slot_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site_id" "uuid",
    CONSTRAINT "ad_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['impression'::"text", 'click'::"text", 'dismiss'::"text", 'interest'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."ad_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" DEFAULT 'bythiagofigueiredo'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "public"."citext" NOT NULL,
    "company" "text",
    "website" "text",
    "message" "text" NOT NULL,
    "budget" "text",
    "preferred_slots" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "ip" "inet",
    "user_agent" "text",
    "consent_processing" boolean DEFAULT true NOT NULL,
    "consent_version" "text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contacted_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    CONSTRAINT "ad_inquiries_admin_notes_length" CHECK ((("admin_notes" IS NULL) OR ("length"("admin_notes") <= 5000))),
    CONSTRAINT "ad_inquiries_budget_check" CHECK ((("budget" IS NULL) OR ("budget" = ANY (ARRAY['under_500'::"text", '500_2000'::"text", '2000_5000'::"text", 'above_5000'::"text", 'not_sure'::"text"])))),
    CONSTRAINT "ad_inquiries_company_check" CHECK ((("company" IS NULL) OR ("length"("company") <= 200))),
    CONSTRAINT "ad_inquiries_email_check" CHECK ((("length"(("email")::"text") >= 5) AND ("length"(("email")::"text") <= 320))),
    CONSTRAINT "ad_inquiries_message_check" CHECK ((("length"("message") >= 10) AND ("length"("message") <= 5000))),
    CONSTRAINT "ad_inquiries_name_check" CHECK ((("length"("name") >= 2) AND ("length"("name") <= 200))),
    CONSTRAINT "ad_inquiries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'contacted'::"text", 'negotiating'::"text", 'converted'::"text", 'archived'::"text"]))),
    CONSTRAINT "ad_inquiries_website_check" CHECK ((("website" IS NULL) OR ("length"("website") <= 500)))
);





CREATE TABLE IF NOT EXISTS "public"."ad_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" DEFAULT 'bythiagofigueiredo'::"text" NOT NULL,
    "public_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "size_bytes" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "storage_path" "text",
    "mime_type" "text"
);





CREATE TABLE IF NOT EXISTS "public"."ad_placeholders" (
    "slot_id" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "headline" "text" DEFAULT 'Anuncie aqui'::"text" NOT NULL,
    "body" "text" DEFAULT 'Alcance nossos leitores.'::"text" NOT NULL,
    "cta_text" "text" DEFAULT 'Saiba mais'::"text" NOT NULL,
    "cta_url" "text" DEFAULT 'https://bythiagofigueiredo.com/anuncie'::"text" NOT NULL,
    "image_url" "text",
    "dismiss_after_ms" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "app_id" "text" DEFAULT 'bythiagofigueiredo'::"text" NOT NULL,
    "brand_color" "text" DEFAULT '#6B7280'::"text" NOT NULL,
    "logo_url" "text"
);





CREATE TABLE IF NOT EXISTS "public"."ad_revenue_daily" (
    "site_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "date" "date" NOT NULL,
    "source" "text" NOT NULL,
    "impressions" integer DEFAULT 0 NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "earnings_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "page_views" integer DEFAULT 0 NOT NULL,
    "fill_rate" numeric(5,2),
    "raw_data" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ad_revenue_daily_source_check" CHECK (("source" = ANY (ARRAY['adsense'::"text", 'house'::"text", 'cpa'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."ad_slot_config" (
    "site_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "house_enabled" boolean DEFAULT true NOT NULL,
    "cpa_enabled" boolean DEFAULT false NOT NULL,
    "google_enabled" boolean DEFAULT false NOT NULL,
    "template_enabled" boolean DEFAULT true NOT NULL,
    "network_adapters_order" "text"[] DEFAULT '{adsense}'::"text"[] NOT NULL,
    "network_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "aspect_ratio" "text" DEFAULT '16:9'::"text" NOT NULL,
    "iab_size" "text",
    "mobile_behavior" "text" DEFAULT 'keep'::"text" NOT NULL,
    "max_per_session" integer DEFAULT 1 NOT NULL,
    "max_per_day" integer DEFAULT 3 NOT NULL,
    "cooldown_ms" integer DEFAULT 3600000 NOT NULL,
    "label" "text" NOT NULL,
    "zone" "text" NOT NULL,
    "accepted_types" "text"[] DEFAULT '{house,cpa}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ad_slot_config_mobile_behavior_check" CHECK (("mobile_behavior" = ANY (ARRAY['keep'::"text", 'hide'::"text", 'stack'::"text"]))),
    CONSTRAINT "ad_slot_config_zone_check" CHECK (("zone" = ANY (ARRAY['banner'::"text", 'rail'::"text", 'inline'::"text", 'block'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."ad_slot_creatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "title" "text",
    "body" "text",
    "cta_text" "text",
    "cta_url" "text",
    "image_url" "text",
    "dismiss_seconds" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "locale" "text" DEFAULT 'pt-BR'::"text" NOT NULL,
    "interaction" "text" DEFAULT 'link'::"text" NOT NULL,
    "image_aspect_ratio" "text",
    "image_width" integer,
    "image_height" integer,
    CONSTRAINT "ad_slot_creatives_image_dimensions_positive" CHECK (((("image_width" IS NULL) AND ("image_height" IS NULL)) OR (("image_width" > 0) AND ("image_height" > 0)))),
    CONSTRAINT "ad_slot_creatives_interaction_check" CHECK (("interaction" = ANY (ARRAY['link'::"text", 'form'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."ad_slot_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "slot_key" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "app_id" "text" DEFAULT 'bythiagofigueiredo'::"text" NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "org_id" "uuid",
    "site_id" "uuid",
    "before_data" "jsonb",
    "after_data" "jsonb",
    "ip" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."author_about_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "headline" "text",
    "subtitle" "text",
    "about_md" "text",
    "about_compiled" "text",
    "photo_caption" "text",
    "photo_location" "text",
    "about_cta_links" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "author_about_tx_cta_valid" CHECK ((("about_cta_links" IS NULL) OR (("about_cta_links" ? 'links'::"text") AND ("jsonb_typeof"(("about_cta_links" -> 'links'::"text")) = 'array'::"text"))))
);





CREATE TABLE IF NOT EXISTS "public"."authors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "bio_md" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site_id" "uuid",
    "display_name" "text",
    "bio" "text",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "avatar_color" "text",
    "sort_order" integer DEFAULT 0,
    "is_default" boolean DEFAULT false,
    "about_photo_url" "text",
    CONSTRAINT "authors_about_photo_url_https" CHECK ((("about_photo_url" IS NULL) OR ("about_photo_url" ~ '^https://'::"text")))
);





CREATE TABLE IF NOT EXISTS "public"."blog_cadence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "cadence_days" integer DEFAULT 7 NOT NULL,
    "preferred_send_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "cadence_start_date" "date",
    "cadence_paused" boolean DEFAULT false NOT NULL,
    "last_published_at" timestamp with time zone
);





CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "status" "public"."post_status" DEFAULT 'draft'::"public"."post_status" NOT NULL,
    "published_at" timestamp with time zone,
    "scheduled_for" timestamp with time zone,
    "cover_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "owner_user_id" "uuid",
    "is_featured" boolean DEFAULT false NOT NULL,
    "category" "text",
    "queue_position" integer,
    "slot_date" "date",
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    "link_group_id" "uuid",
    "tag_id" "uuid",
    "view_count" integer DEFAULT 0 NOT NULL,
    "read_complete_count" integer DEFAULT 0 NOT NULL,
    "previous_post_id" "uuid",
    "continues_in_next" boolean DEFAULT false NOT NULL,
    CONSTRAINT "blog_posts_category_check" CHECK (("category" = ANY (ARRAY['tech'::"text", 'vida'::"text", 'viagem'::"text", 'crescimento'::"text", 'code'::"text", 'negocio'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."blog_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "color" "text" DEFAULT '#6366f1'::"text" NOT NULL,
    "color_dark" "text",
    "badge" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linked_newsletter_type_id" "text",
    CONSTRAINT "blog_tags_color_dark_hex" CHECK ((("color_dark" IS NULL) OR ("color_dark" ~ '^#[0-9a-fA-F]{6}$'::"text"))),
    CONSTRAINT "blog_tags_color_hex" CHECK (("color" ~ '^#[0-9a-fA-F]{6}$'::"text"))
);





CREATE TABLE IF NOT EXISTS "public"."blog_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "content_mdx" "text" NOT NULL,
    "cover_image_url" "text",
    "meta_title" "text",
    "meta_description" "text",
    "og_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_compiled" "text",
    "content_toc" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reading_time_min" integer DEFAULT 0 NOT NULL,
    "seo_extras" "jsonb",
    "content_json" "jsonb",
    "content_html" "text",
    "colophon" "text",
    "notes" "text"[],
    "pull_quote" "text",
    "key_points" "text"[],
    CONSTRAINT "blog_translations_seo_extras_shape_chk" CHECK ((("seo_extras" IS NULL) OR (("jsonb_typeof"("seo_extras") = 'object'::"text") AND ((NOT ("seo_extras" ? 'faq'::"text")) OR ("jsonb_typeof"(("seo_extras" -> 'faq'::"text")) = 'array'::"text")) AND ((NOT ("seo_extras" ? 'howTo'::"text")) OR ("jsonb_typeof"(("seo_extras" -> 'howTo'::"text")) = 'object'::"text")) AND ((NOT ("seo_extras" ? 'video'::"text")) OR ("jsonb_typeof"(("seo_extras" -> 'video'::"text")) = 'object'::"text")) AND ((NOT ("seo_extras" ? 'og_image_url'::"text")) OR ("jsonb_typeof"(("seo_extras" -> 'og_image_url'::"text")) = 'string'::"text")))))
);




CREATE TABLE IF NOT EXISTS "public"."campaign_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "email" "public"."citext" NOT NULL,
    "name" "text",
    "locale" "text" NOT NULL,
    "interest" "text",
    "consent_marketing" boolean NOT NULL,
    "consent_text_version" "text" NOT NULL,
    "ip" "inet",
    "user_agent" "text",
    "downloaded_at" timestamp with time zone,
    "download_count" integer DEFAULT 0 NOT NULL,
    "anonymized_at" timestamp with time zone,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."campaign_translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "locale" "text" NOT NULL,
    "meta_title" "text",
    "meta_description" "text",
    "og_image_url" "text",
    "slug" "text" NOT NULL,
    "main_hook_md" "text" NOT NULL,
    "supporting_argument_md" "text",
    "introductory_block_md" "text",
    "body_content_md" "text",
    "form_intro_md" "text",
    "form_button_label" "text" DEFAULT 'Enviar'::"text" NOT NULL,
    "form_button_loading_label" "text" DEFAULT 'Enviando...'::"text" NOT NULL,
    "context_tag" "text" NOT NULL,
    "success_headline" "text" NOT NULL,
    "success_headline_duplicate" "text" NOT NULL,
    "success_subheadline" "text" NOT NULL,
    "success_subheadline_duplicate" "text" NOT NULL,
    "check_mail_text" "text" NOT NULL,
    "download_button_label" "text" NOT NULL,
    "extras" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid",
    "interest" "text" NOT NULL,
    "status" "public"."post_status" DEFAULT 'draft'::"public"."post_status" NOT NULL,
    "pdf_storage_path" "text",
    "form_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "scheduled_for" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "owner_user_id" "uuid",
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    "link_group_id" "uuid",
    CONSTRAINT "campaigns_interest_vocab" CHECK (("interest" = ANY (ARRAY['creator'::"text", 'fitness'::"text", 'style'::"text", 'career'::"text", 'finance'::"text", 'wellness'::"text", 'other'::"text"]))),
    CONSTRAINT "campaigns_published_requires_published_at" CHECK ((("status" <> 'published'::"public"."post_status") OR ("published_at" IS NOT NULL))),
    CONSTRAINT "campaigns_scheduled_requires_scheduled_for" CHECK ((("status" <> 'scheduled'::"public"."post_status") OR ("scheduled_for" IS NOT NULL)))
);





CREATE TABLE IF NOT EXISTS "public"."consent_texts" (
    "id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "locale" "text" DEFAULT 'pt-BR'::"text" NOT NULL,
    "version" "text" NOT NULL,
    "text_md" "text" NOT NULL,
    "effective_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "superseded_at" timestamp with time zone
);





CREATE TABLE IF NOT EXISTS "public"."contact_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "public"."citext" NOT NULL,
    "message" "text" NOT NULL,
    "consent_processing" boolean NOT NULL,
    "consent_processing_text_version" "text" NOT NULL,
    "consent_marketing" boolean DEFAULT false NOT NULL,
    "consent_marketing_text_version" "text",
    "ip" "inet",
    "user_agent" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "replied_at" timestamp with time zone,
    "anonymized_at" timestamp with time zone,
    CONSTRAINT "contact_submissions_check" CHECK ((("consent_marketing" = false) OR ("consent_marketing_text_version" IS NOT NULL))),
    CONSTRAINT "contact_submissions_email_check" CHECK ((("length"(("email")::"text") >= 5) AND ("length"(("email")::"text") <= 320))),
    CONSTRAINT "contact_submissions_message_check" CHECK ((("length"("message") >= 10) AND ("length"("message") <= 5000))),
    CONSTRAINT "contact_submissions_name_check" CHECK ((("length"("name") >= 2) AND ("length"("name") <= 200)))
);





CREATE TABLE IF NOT EXISTS "public"."content_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "anonymous_id" "text" NOT NULL,
    "locale" "text",
    "referrer_src" "text",
    "read_depth" smallint,
    "time_on_page" smallint,
    "has_consent" boolean DEFAULT false NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['view'::"text", 'read_progress'::"text", 'read_complete'::"text"]))),
    CONSTRAINT "content_events_read_depth_check" CHECK ((("read_depth" IS NULL) OR (("read_depth" >= 0) AND ("read_depth" <= 100)))),
    CONSTRAINT "content_events_referrer_src_check" CHECK ((("referrer_src" IS NULL) OR ("referrer_src" = ANY (ARRAY['direct'::"text", 'google'::"text", 'newsletter'::"text", 'social'::"text", 'other'::"text"])))),
    CONSTRAINT "content_events_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['blog'::"text", 'campaign'::"text", 'newsletter_archive'::"text"]))),
    CONSTRAINT "content_events_time_on_page_check" CHECK ((("time_on_page" IS NULL) OR (("time_on_page" >= 0) AND ("time_on_page" <= 3600))))
);





CREATE TABLE IF NOT EXISTS "public"."content_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "unique_views" integer DEFAULT 0 NOT NULL,
    "reads_complete" integer DEFAULT 0 NOT NULL,
    "avg_read_depth" smallint DEFAULT 0 NOT NULL,
    "avg_time_sec" smallint DEFAULT 0 NOT NULL,
    "referrer_direct" integer DEFAULT 0 NOT NULL,
    "referrer_google" integer DEFAULT 0 NOT NULL,
    "referrer_newsletter" integer DEFAULT 0 NOT NULL,
    "referrer_social" integer DEFAULT 0 NOT NULL,
    "referrer_other" integer DEFAULT 0 NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."cron_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."cron_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job" "text" NOT NULL,
    "ran_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "duration_ms" integer,
    "items_processed" integer,
    "error" "text",
    CONSTRAINT "cron_runs_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'error'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."hashtags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "public"."citext" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "accepted_by_user_id" "uuid",
    "revoked_at" timestamp with time zone,
    "revoked_by_user_id" "uuid",
    "last_sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resend_count" integer DEFAULT 0 NOT NULL,
    "resent_at" timestamp with time zone,
    "site_id" "uuid",
    "role_scope" "text" DEFAULT 'org'::"text" NOT NULL,
    CONSTRAINT "inv_scope_check" CHECK (((("role_scope" = 'org'::"text") AND ("site_id" IS NULL) AND ("role" = 'org_admin'::"text")) OR (("role_scope" = 'site'::"text") AND ("site_id" IS NOT NULL) AND ("role" = ANY (ARRAY['editor'::"text", 'reporter'::"text"]))))),
    CONSTRAINT "invitations_role_check" CHECK (("role" = ANY (ARRAY['org_admin'::"text", 'editor'::"text", 'reporter'::"text"]))),
    CONSTRAINT "invitations_role_scope_check" CHECK (("role_scope" = ANY (ARRAY['org'::"text", 'site'::"text"]))),
    CONSTRAINT "invitations_token_check" CHECK (("token" ~ '^[a-f0-9]{64}$'::"text"))
);





CREATE TABLE IF NOT EXISTS "public"."kill_switches" (
    "id" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);





CREATE TABLE IF NOT EXISTS "public"."lgpd_migration_backup_v1" (
    "table_name" "text" NOT NULL,
    "row_snapshot" "jsonb" NOT NULL,
    "backed_up_at" timestamp with time zone DEFAULT "now"()
);





CREATE TABLE IF NOT EXISTS "public"."lgpd_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "phase" integer,
    "confirmation_token_hash" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    "scheduled_purge_at" timestamp with time zone,
    "phase_1_completed_at" timestamp with time zone,
    "phase_3_completed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "blob_path" "text",
    "blob_uploaded_at" timestamp with time zone,
    "blob_deleted_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "lgpd_requests_phase_check" CHECK ((("phase" >= 1) AND ("phase" <= 3))),
    CONSTRAINT "lgpd_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'completed_soft'::"text", 'cancelled'::"text", 'failed'::"text"]))),
    CONSTRAINT "lgpd_requests_type_check" CHECK (("type" = ANY (ARRAY['data_export'::"text", 'account_deletion'::"text", 'consent_revocation'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."link_aggregation_watermark" (
    "id" "text" NOT NULL,
    "last_processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."link_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "alert_type" "text" NOT NULL,
    "metric" "text" NOT NULL,
    "condition" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "last_triggered_at" timestamp with time zone,
    "notify_channels" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['threshold'::"text", 'anomaly'::"text", 'goal_reached'::"text", 'expiry'::"text"]))),
    CONSTRAINT "link_alerts_metric_check" CHECK (("metric" = ANY (ARRAY['clicks'::"text", 'unique_visitors'::"text", 'conversions'::"text", 'conversion_value'::"text", 'bounce_rate'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."link_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text",
    "color" "text",
    "annotated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."link_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "visitor_id" "text",
    "is_unique" boolean DEFAULT false NOT NULL,
    "is_bot" boolean DEFAULT false NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "user_agent" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "ip" "text",
    "referrer_url" "text",
    "referrer_domain" "text",
    "referrer_source" "text",
    "language" "text",
    "converted_at" timestamp with time zone,
    "conversion_type" "text",
    "conversion_value" numeric(12,4),
    "conversion_id" "text",
    "clicked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_clicks_device_type_check" CHECK ((("device_type" IS NULL) OR ("device_type" = ANY (ARRAY['mobile'::"text", 'desktop'::"text", 'tablet'::"text", 'other'::"text"])))),
    CONSTRAINT "link_clicks_referrer_source_check" CHECK ((("referrer_source" IS NULL) OR ("referrer_source" = ANY (ARRAY['direct'::"text", 'search'::"text", 'social'::"text", 'email'::"text", 'referral'::"text", 'other'::"text"]))))
)
PARTITION BY RANGE ("clicked_at");





CREATE TABLE IF NOT EXISTS "public"."link_clicks_2026_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "visitor_id" "text",
    "is_unique" boolean DEFAULT false NOT NULL,
    "is_bot" boolean DEFAULT false NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "user_agent" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "ip" "text",
    "referrer_url" "text",
    "referrer_domain" "text",
    "referrer_source" "text",
    "language" "text",
    "converted_at" timestamp with time zone,
    "conversion_type" "text",
    "conversion_value" numeric(12,4),
    "conversion_id" "text",
    "clicked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_clicks_device_type_check" CHECK ((("device_type" IS NULL) OR ("device_type" = ANY (ARRAY['mobile'::"text", 'desktop'::"text", 'tablet'::"text", 'other'::"text"])))),
    CONSTRAINT "link_clicks_referrer_source_check" CHECK ((("referrer_source" IS NULL) OR ("referrer_source" = ANY (ARRAY['direct'::"text", 'search'::"text", 'social'::"text", 'email'::"text", 'referral'::"text", 'other'::"text"]))))
);





CREATE TABLE IF NOT EXISTS "public"."link_clicks_2026_06" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "visitor_id" "text",
    "is_unique" boolean DEFAULT false NOT NULL,
    "is_bot" boolean DEFAULT false NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "user_agent" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "ip" "text",
    "referrer_url" "text",
    "referrer_domain" "text",
    "referrer_source" "text",
    "language" "text",
    "converted_at" timestamp with time zone,
    "conversion_type" "text",
    "conversion_value" numeric(12,4),
    "conversion_id" "text",
    "clicked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_clicks_device_type_check" CHECK ((("device_type" IS NULL) OR ("device_type" = ANY (ARRAY['mobile'::"text", 'desktop'::"text", 'tablet'::"text", 'other'::"text"])))),
    CONSTRAINT "link_clicks_referrer_source_check" CHECK ((("referrer_source" IS NULL) OR ("referrer_source" = ANY (ARRAY['direct'::"text", 'search'::"text", 'social'::"text", 'email'::"text", 'referral'::"text", 'other'::"text"]))))
);





CREATE TABLE IF NOT EXISTS "public"."link_clicks_2026_07" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "visitor_id" "text",
    "is_unique" boolean DEFAULT false NOT NULL,
    "is_bot" boolean DEFAULT false NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "user_agent" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "ip" "text",
    "referrer_url" "text",
    "referrer_domain" "text",
    "referrer_source" "text",
    "language" "text",
    "converted_at" timestamp with time zone,
    "conversion_type" "text",
    "conversion_value" numeric(12,4),
    "conversion_id" "text",
    "clicked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_clicks_device_type_check" CHECK ((("device_type" IS NULL) OR ("device_type" = ANY (ARRAY['mobile'::"text", 'desktop'::"text", 'tablet'::"text", 'other'::"text"])))),
    CONSTRAINT "link_clicks_referrer_source_check" CHECK ((("referrer_source" IS NULL) OR ("referrer_source" = ANY (ARRAY['direct'::"text", 'search'::"text", 'social'::"text", 'email'::"text", 'referral'::"text", 'other'::"text"]))))
);





CREATE TABLE IF NOT EXISTS "public"."link_clicks_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "visitor_id" "text",
    "is_unique" boolean DEFAULT false NOT NULL,
    "is_bot" boolean DEFAULT false NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "user_agent" "text",
    "country" "text",
    "region" "text",
    "city" "text",
    "ip" "text",
    "referrer_url" "text",
    "referrer_domain" "text",
    "referrer_source" "text",
    "language" "text",
    "converted_at" timestamp with time zone,
    "conversion_type" "text",
    "conversion_value" numeric(12,4),
    "conversion_id" "text",
    "clicked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_clicks_device_type_check" CHECK ((("device_type" IS NULL) OR ("device_type" = ANY (ARRAY['mobile'::"text", 'desktop'::"text", 'tablet'::"text", 'other'::"text"])))),
    CONSTRAINT "link_clicks_referrer_source_check" CHECK ((("referrer_source" IS NULL) OR ("referrer_source" = ANY (ARRAY['direct'::"text", 'search'::"text", 'social'::"text", 'email'::"text", 'referral'::"text", 'other'::"text"]))))
);





CREATE TABLE IF NOT EXISTS "public"."link_daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "weekday" smallint NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "unique_visitors" integer DEFAULT 0 NOT NULL,
    "conversions" integer DEFAULT 0 NOT NULL,
    "bot_clicks" integer DEFAULT 0 NOT NULL,
    "conversion_value" numeric(14,4) DEFAULT 0 NOT NULL,
    "mobile_clicks" integer DEFAULT 0 NOT NULL,
    "desktop_clicks" integer DEFAULT 0 NOT NULL,
    "tablet_clicks" integer DEFAULT 0 NOT NULL,
    "ref_direct" integer DEFAULT 0 NOT NULL,
    "ref_search" integer DEFAULT 0 NOT NULL,
    "ref_social" integer DEFAULT 0 NOT NULL,
    "ref_email" integer DEFAULT 0 NOT NULL,
    "ref_referral" integer DEFAULT 0 NOT NULL,
    "ref_other" integer DEFAULT 0 NOT NULL,
    "countries" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cities" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hourly_clicks" "jsonb" DEFAULT '[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]'::"jsonb" NOT NULL,
    CONSTRAINT "link_daily_metrics_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);





CREATE TABLE IF NOT EXISTS "public"."link_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "link_id" "uuid" NOT NULL,
    "site_id" "uuid" NOT NULL,
    "metric" "text" NOT NULL,
    "target_value" numeric(14,4) NOT NULL,
    "deadline" "date",
    "reached_at" timestamp with time zone,
    "notify_channels" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_goals_metric_check" CHECK (("metric" = ANY (ARRAY['clicks'::"text", 'unique_visitors'::"text", 'conversions'::"text", 'conversion_value'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."link_qr_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "thumbnail_path" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."link_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "default_redirect_type" smallint DEFAULT 302 NOT NULL,
    "default_code_length" smallint DEFAULT 6 NOT NULL,
    "auto_qr" boolean DEFAULT false NOT NULL,
    "bot_filtering" boolean DEFAULT true NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "link_settings_default_code_length_check" CHECK ((("default_code_length" >= 4) AND ("default_code_length" <= 16))),
    CONSTRAINT "link_settings_default_redirect_type_check" CHECK (("default_redirect_type" = ANY (ARRAY[301, 302])))
);





CREATE TABLE IF NOT EXISTS "public"."link_utm_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."newsletter_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "edition_id" "uuid" NOT NULL,
    "subscriber_email" "public"."citext" NOT NULL,
    "provider_message_id" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "delivered_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "open_ip" "inet",
    "open_user_agent" "text",
    "clicked_at" timestamp with time zone,
    "bounce_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link_id" "uuid",
    "link_rewrite_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "newsletter_sends_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'opened'::"text", 'clicked'::"text", 'bounced'::"text", 'complained'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."tracked_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "slug" "text",
    "destination_url" "text" NOT NULL,
    "title" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "source_type" "public"."link_source_type" DEFAULT 'manual'::"public"."link_source_type" NOT NULL,
    "source_id" "uuid",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "has_qr" boolean DEFAULT false NOT NULL,
    "qr_storage_path" "text",
    "qr_config" "jsonb",
    "redirect_type" smallint DEFAULT 302 NOT NULL,
    "expired_url" "text",
    "click_limit" integer,
    "password_hash" "text",
    "active" boolean DEFAULT true NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "expires_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "total_clicks" integer DEFAULT 0 NOT NULL,
    "unique_visitors" integer DEFAULT 0 NOT NULL,
    "last_clicked_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tracked_links_redirect_type_check" CHECK (("redirect_type" = ANY (ARRAY[301, 302])))
);





CREATE TABLE IF NOT EXISTS "public"."newsletter_editions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "newsletter_type_id" "text",
    "paired_edition_id" "uuid",
    "source_blog_post_id" "uuid",
    "subject" "text" NOT NULL,
    "preheader" "text",
    "content_mdx" "text",
    "content_html" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "segment" "text" DEFAULT 'all'::"text" NOT NULL,
    "queue_position" integer,
    "slot_date" "date",
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "send_count" integer DEFAULT 0 NOT NULL,
    "stats_delivered" integer DEFAULT 0 NOT NULL,
    "stats_opens" integer DEFAULT 0 NOT NULL,
    "stats_clicks" integer DEFAULT 0 NOT NULL,
    "stats_bounces" integer DEFAULT 0 NOT NULL,
    "stats_complaints" integer DEFAULT 0 NOT NULL,
    "stats_unsubs" integer DEFAULT 0 NOT NULL,
    "stats_stale" boolean DEFAULT false NOT NULL,
    "ab_variant" "text",
    "ab_parent_id" "uuid",
    "ab_sample_pct" integer DEFAULT 10 NOT NULL,
    "ab_wait_hours" integer DEFAULT 4 NOT NULL,
    "ab_winner_decided_at" timestamp with time zone,
    "test_sent_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "content_json" "jsonb",
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 3 NOT NULL,
    "total_subscribers" integer DEFAULT 0 NOT NULL,
    "web_archive_enabled" boolean DEFAULT true NOT NULL,
    "idea_notes" "text",
    "idea_created_at" timestamp with time zone,
    "review_entered_at" timestamp with time zone,
    "edition_kind" "text" DEFAULT 'cadence'::"text" NOT NULL,
    CONSTRAINT "newsletter_editions_ab_variant_check" CHECK (("ab_variant" = ANY (ARRAY['a'::"text", 'b'::"text"]))),
    CONSTRAINT "newsletter_editions_edition_kind_check" CHECK (("edition_kind" = ANY (ARRAY['cadence'::"text", 'special'::"text"]))),
    CONSTRAINT "newsletter_editions_segment_check" CHECK (("segment" = ANY (ARRAY['all'::"text", 'high_engagement'::"text", 're_engagement'::"text", 'new_subscribers'::"text"]))),
    CONSTRAINT "newsletter_editions_status_check" CHECK (("status" = ANY (ARRAY['idea'::"text", 'draft'::"text", 'ready'::"text", 'queued'::"text", 'scheduled'::"text", 'sending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."newsletter_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "email" "public"."citext" NOT NULL,
    "status" "text" NOT NULL,
    "confirmation_expires_at" timestamp with time zone,
    "consent_text_version" "text" NOT NULL,
    "ip" "inet",
    "user_agent" "text",
    "subscribed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    "unsubscribed_at" timestamp with time zone,
    "confirmation_token_hash" "text",
    "locale" "text",
    "newsletter_id" "text" NOT NULL,
    "welcome_sent" boolean DEFAULT false NOT NULL,
    "tracking_consent" boolean DEFAULT true NOT NULL,
    CONSTRAINT "newsletter_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['pending_confirmation'::"text", 'confirmed'::"text", 'unsubscribed'::"text", 'bounced'::"text", 'complained'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."newsletter_types" (
    "id" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "name" "text" NOT NULL,
    "tagline" "text",
    "color" "text" DEFAULT '#C14513'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cadence_days" integer DEFAULT 7 NOT NULL,
    "preferred_send_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "cadence_start_date" "date",
    "cadence_paused" boolean DEFAULT false NOT NULL,
    "last_sent_at" timestamp with time zone,
    "sender_name" "text" DEFAULT 'Thiago Figueiredo'::"text",
    "sender_email" "text" DEFAULT 'newsletter@bythiagofigueiredo.com'::"text",
    "reply_to" "text",
    "max_bounce_rate_pct" integer DEFAULT 5 NOT NULL,
    "site_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "og_image_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color_dark" "text",
    "badge" "text",
    "cadence_label" "text",
    "landing_content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "cadence_pattern" "jsonb",
    "author_id" "uuid",
    "linked_tag_id" "uuid",
    CONSTRAINT "newsletter_types_color_dark_hex" CHECK ((("color_dark" IS NULL) OR ("color_dark" ~ '^#[0-9a-fA-F]{6}$'::"text"))),
    CONSTRAINT "newsletter_types_landing_content_shape" CHECK ((("landing_content" IS NULL) OR (("jsonb_typeof"("landing_content") = 'object'::"text") AND ((("landing_content" -> 'promise'::"text") IS NULL) OR ("jsonb_typeof"(("landing_content" -> 'promise'::"text")) = 'array'::"text"))))),
    CONSTRAINT "newsletter_types_locale_check" CHECK (("locale" = ANY (ARRAY['en'::"text", 'pt-BR'::"text"]))),
    CONSTRAINT "newsletter_types_og_image_url_https" CHECK ((("og_image_url" IS NULL) OR ("og_image_url" ~ '^https://'::"text"))),
    CONSTRAINT "newsletter_types_slug_format" CHECK (("slug" ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'::"text")),
    CONSTRAINT "newsletter_types_slug_length" CHECK ((("char_length"("slug") >= 3) AND ("char_length"("slug") <= 80))),
    CONSTRAINT "newsletter_types_slug_reserved" CHECK (("slug" !~ '^(archive|subscribe|new|settings|edit|confirm|api|admin|hub|rss|feed)$'::"text"))
);





CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = 'org_admin'::"text"))
);





CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "parent_org_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "adsense_publisher_id" "text",
    "adsense_refresh_token_enc" "text",
    "adsense_connected_at" timestamp with time zone,
    "adsense_last_sync_at" timestamp with time zone,
    "adsense_sync_status" "text" DEFAULT 'disconnected'::"text" NOT NULL,
    CONSTRAINT "organizations_adsense_publisher_id_format" CHECK ((("adsense_publisher_id" IS NULL) OR ("adsense_publisher_id" ~ '^ca-pub-[0-9]+$'::"text"))),
    CONSTRAINT "organizations_adsense_sync_status_check" CHECK (("adsense_sync_status" = ANY (ARRAY['ok'::"text", 'error'::"text", 'pending'::"text", 'disconnected'::"text"]))),
    CONSTRAINT "organizations_check" CHECK ((("parent_org_id" IS NULL) OR ("parent_org_id" <> "id")))
);





CREATE TABLE IF NOT EXISTS "public"."password_reset_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "ip" "inet",
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."post_hashtags" (
    "post_id" "uuid" NOT NULL,
    "hashtag_id" "uuid" NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."sent_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "template_name" "text" NOT NULL,
    "to_email" "public"."citext" NOT NULL,
    "subject" "text" NOT NULL,
    "provider" "public"."email_provider" NOT NULL,
    "provider_message_id" "text",
    "status" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivered_at" timestamp with time zone,
    "error" "text",
    "metadata" "jsonb",
    CONSTRAINT "sent_emails_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'bounced'::"text", 'complained'::"text", 'failed'::"text"]))),
    CONSTRAINT "sent_emails_template_name_len" CHECK (("char_length"("template_name") <= 80))
);




CREATE TABLE IF NOT EXISTS "public"."site_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "site_memberships_role_check" CHECK (("role" = ANY (ARRAY['editor'::"text", 'reporter'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "domains" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "default_locale" "text" DEFAULT 'pt-BR'::"text" NOT NULL,
    "supported_locales" "text"[] DEFAULT '{pt-BR}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_notification_email" "public"."citext",
    "primary_domain" "text" NOT NULL,
    "cms_enabled" boolean DEFAULT true NOT NULL,
    "logo_url" "text",
    "primary_color" "text",
    "identity_type" "text" DEFAULT 'person'::"text" NOT NULL,
    "twitter_handle" "text",
    "seo_default_og_image" "text",
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "short_domain" "text",
    CONSTRAINT "sites_contact_email_len" CHECK ((("contact_notification_email" IS NULL) OR ("char_length"(("contact_notification_email")::"text") <= 320))),
    CONSTRAINT "sites_identity_type_chk" CHECK (("identity_type" = ANY (ARRAY['person'::"text", 'organization'::"text"]))),
    CONSTRAINT "sites_seo_default_og_image_chk" CHECK ((("seo_default_og_image" IS NULL) OR ("seo_default_og_image" ~ '^https://'::"text"))),
    CONSTRAINT "sites_short_domain_check" CHECK ((("short_domain" IS NULL) OR ("short_domain" ~ '^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$'::"text"))),
    CONSTRAINT "sites_twitter_handle_chk" CHECK ((("twitter_handle" IS NULL) OR ("twitter_handle" ~ '^[A-Za-z0-9_]{1,15}$'::"text")))
);




CREATE TABLE IF NOT EXISTS "public"."unsubscribe_tokens" (
    "site_id" "uuid" NOT NULL,
    "email" "public"."citext" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "token_hash" "text" NOT NULL,
    CONSTRAINT "unsubscribe_tokens_hash_check" CHECK (("token_hash" ~ '^[a-f0-9]{64}$'::"text"))
);





CREATE TABLE IF NOT EXISTS "public"."user_app_presence" (
    "email_hash" "text" NOT NULL,
    "app_id" "text" NOT NULL,
    "first_seen" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."youtube_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name_pt" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "description_pt" "text",
    "description_en" "text",
    "color" "text" DEFAULT '#FF8240'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "match_keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "auto_approve" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);





CREATE TABLE IF NOT EXISTS "public"."youtube_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "channel_id" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "uploads_playlist_id" "text" NOT NULL,
    "subscriber_count" integer DEFAULT 0 NOT NULL,
    "video_count" integer DEFAULT 0 NOT NULL,
    "thumbnail_url" "text",
    "banner_url" "text",
    "custom_url" "text",
    "sync_enabled" boolean DEFAULT true NOT NULL,
    "sync_schedules" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "schedule_label" "text",
    CONSTRAINT "youtube_channels_locale_check" CHECK (("locale" = ANY (ARRAY['pt'::"text", 'en'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."youtube_curated_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "video_id" "uuid" NOT NULL,
    "author_handle" "text" NOT NULL,
    "author_avatar_url" "text",
    "text_pt" "text" NOT NULL,
    "text_en" "text" NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "target_locale" "text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "youtube_curated_comments_target_locale_check" CHECK ((("target_locale" IS NULL) OR ("target_locale" = ANY (ARRAY['pt'::"text", 'en'::"text"]))))
);





CREATE TABLE IF NOT EXISTS "public"."youtube_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "channel_id" "uuid",
    "mode" "text" NOT NULL,
    "status" "text" NOT NULL,
    "videos_found" integer DEFAULT 0 NOT NULL,
    "videos_inserted" integer DEFAULT 0 NOT NULL,
    "videos_updated" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "quota_used" integer DEFAULT 0 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "youtube_sync_log_mode_check" CHECK (("mode" = ANY (ARRAY['schedule'::"text", 'catchall'::"text", 'metrics'::"text", 'manual'::"text"]))),
    CONSTRAINT "youtube_sync_log_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"])))
);





CREATE TABLE IF NOT EXISTS "public"."youtube_videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "youtube_video_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "title_translation" "text",
    "description" "text",
    "description_translation" "text",
    "duration" "text" DEFAULT '0:00'::"text" NOT NULL,
    "duration_seconds" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "thumbnail_url" "text",
    "thumbnail_hq_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "category_id" "uuid",
    "auto_suggested_category_id" "uuid",
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "cms_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pinned_until" timestamp with time zone
);


-- Table constraints and defaults




ALTER TABLE ONLY "public"."link_clicks" ATTACH PARTITION "public"."link_clicks_2026_05" FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');




ALTER TABLE ONLY "public"."link_clicks" ATTACH PARTITION "public"."link_clicks_2026_06" FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');




ALTER TABLE ONLY "public"."link_clicks" ATTACH PARTITION "public"."link_clicks_2026_07" FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');




ALTER TABLE ONLY "public"."link_clicks" ATTACH PARTITION "public"."link_clicks_default" DEFAULT;




ALTER TABLE ONLY "public"."ad_campaigns"
    ADD CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."ad_events"
    ADD CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."ad_inquiries"
    ADD CONSTRAINT "ad_inquiries_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."ad_media"
    ADD CONSTRAINT "ad_media_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."ad_placeholders"
    ADD CONSTRAINT "ad_placeholders_pkey" PRIMARY KEY ("slot_id");




ALTER TABLE ONLY "public"."ad_revenue_daily"
    ADD CONSTRAINT "ad_revenue_daily_pkey" PRIMARY KEY ("site_id", "slot_key", "date", "source");




ALTER TABLE ONLY "public"."ad_slot_config"
    ADD CONSTRAINT "ad_slot_config_pkey" PRIMARY KEY ("site_id", "slot_key");




ALTER TABLE ONLY "public"."ad_slot_creatives"
    ADD CONSTRAINT "ad_slot_creatives_campaign_slot_locale_unique" UNIQUE ("campaign_id", "slot_key", "locale");




ALTER TABLE ONLY "public"."ad_slot_creatives"
    ADD CONSTRAINT "ad_slot_creatives_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."ad_slot_metrics"
    ADD CONSTRAINT "ad_slot_metrics_campaign_id_slot_key_date_key" UNIQUE ("campaign_id", "slot_key", "date");




ALTER TABLE ONLY "public"."ad_slot_metrics"
    ADD CONSTRAINT "ad_slot_metrics_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."author_about_translations"
    ADD CONSTRAINT "author_about_translations_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."author_about_translations"
    ADD CONSTRAINT "author_about_tx_author_locale_uniq" UNIQUE ("author_id", "locale");




ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_site_slug_unique" UNIQUE ("site_id", "slug");




ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_user_id_key" UNIQUE ("user_id");




ALTER TABLE ONLY "public"."blog_cadence"
    ADD CONSTRAINT "blog_cadence_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."blog_cadence"
    ADD CONSTRAINT "blog_cadence_site_id_locale_key" UNIQUE ("site_id", "locale");




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_site_name_unique" UNIQUE ("site_id", "name");




ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_site_slug_unique" UNIQUE ("site_id", "slug");




ALTER TABLE ONLY "public"."blog_translations"
    ADD CONSTRAINT "blog_translations_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."campaign_submissions"
    ADD CONSTRAINT "campaign_submissions_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."campaign_translations"
    ADD CONSTRAINT "campaign_translations_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."consent_texts"
    ADD CONSTRAINT "consent_texts_category_locale_version_key" UNIQUE ("category", "locale", "version");




ALTER TABLE ONLY "public"."consent_texts"
    ADD CONSTRAINT "consent_texts_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."content_events"
    ADD CONSTRAINT "content_events_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."content_metrics"
    ADD CONSTRAINT "content_metrics_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."content_metrics"
    ADD CONSTRAINT "content_metrics_resource_type_resource_id_date_key" UNIQUE ("resource_type", "resource_id", "date");




ALTER TABLE ONLY "public"."cron_config"
    ADD CONSTRAINT "cron_config_pkey" PRIMARY KEY ("key");




ALTER TABLE ONLY "public"."cron_runs"
    ADD CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."hashtags"
    ADD CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."hashtags"
    ADD CONSTRAINT "hashtags_site_id_slug_key" UNIQUE ("site_id", "slug");




ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."kill_switches"
    ADD CONSTRAINT "kill_switches_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."lgpd_requests"
    ADD CONSTRAINT "lgpd_requests_confirmation_token_hash_key" UNIQUE ("confirmation_token_hash");




ALTER TABLE ONLY "public"."lgpd_requests"
    ADD CONSTRAINT "lgpd_requests_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_aggregation_watermark"
    ADD CONSTRAINT "link_aggregation_watermark_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_alerts"
    ADD CONSTRAINT "link_alerts_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_annotations"
    ADD CONSTRAINT "link_annotations_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id", "clicked_at");




ALTER TABLE ONLY "public"."link_clicks_2026_05"
    ADD CONSTRAINT "link_clicks_2026_05_pkey" PRIMARY KEY ("id", "clicked_at");




ALTER TABLE ONLY "public"."link_clicks_2026_06"
    ADD CONSTRAINT "link_clicks_2026_06_pkey" PRIMARY KEY ("id", "clicked_at");




ALTER TABLE ONLY "public"."link_clicks_2026_07"
    ADD CONSTRAINT "link_clicks_2026_07_pkey" PRIMARY KEY ("id", "clicked_at");




ALTER TABLE ONLY "public"."link_clicks_default"
    ADD CONSTRAINT "link_clicks_default_pkey" PRIMARY KEY ("id", "clicked_at");




ALTER TABLE ONLY "public"."link_daily_metrics"
    ADD CONSTRAINT "link_daily_metrics_link_id_date_key" UNIQUE ("link_id", "date");




ALTER TABLE ONLY "public"."link_daily_metrics"
    ADD CONSTRAINT "link_daily_metrics_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_goals"
    ADD CONSTRAINT "link_goals_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_qr_templates"
    ADD CONSTRAINT "link_qr_templates_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_settings"
    ADD CONSTRAINT "link_settings_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."link_settings"
    ADD CONSTRAINT "link_settings_site_id_key" UNIQUE ("site_id");




ALTER TABLE ONLY "public"."link_utm_presets"
    ADD CONSTRAINT "link_utm_presets_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."newsletter_sends"
    ADD CONSTRAINT "newsletter_sends_edition_id_subscriber_email_key" UNIQUE ("edition_id", "subscriber_email");




ALTER TABLE ONLY "public"."newsletter_sends"
    ADD CONSTRAINT "newsletter_sends_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."newsletter_types"
    ADD CONSTRAINT "newsletter_types_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."newsletter_types"
    ADD CONSTRAINT "newsletter_types_slug_unique" UNIQUE ("slug");




ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_id_user_id_key" UNIQUE ("org_id", "user_id");




ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");




ALTER TABLE ONLY "public"."password_reset_attempts"
    ADD CONSTRAINT "password_reset_attempts_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."post_hashtags"
    ADD CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id", "hashtag_id");




ALTER TABLE ONLY "public"."sent_emails"
    ADD CONSTRAINT "sent_emails_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."site_memberships"
    ADD CONSTRAINT "site_memberships_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."site_memberships"
    ADD CONSTRAINT "site_memberships_site_id_user_id_key" UNIQUE ("site_id", "user_id");




ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_org_id_slug_key" UNIQUE ("org_id", "slug");




ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_short_domain_unique" UNIQUE ("short_domain");




ALTER TABLE ONLY "public"."tracked_links"
    ADD CONSTRAINT "tracked_links_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."tracked_links"
    ADD CONSTRAINT "tracked_links_site_id_code_key" UNIQUE ("site_id", "code");




ALTER TABLE ONLY "public"."tracked_links"
    ADD CONSTRAINT "tracked_links_site_id_slug_key" UNIQUE ("site_id", "slug");




ALTER TABLE ONLY "public"."unsubscribe_tokens"
    ADD CONSTRAINT "unsubscribe_tokens_pkey" PRIMARY KEY ("token_hash");




ALTER TABLE ONLY "public"."unsubscribe_tokens"
    ADD CONSTRAINT "unsubscribe_tokens_site_id_email_key" UNIQUE ("site_id", "email");




ALTER TABLE ONLY "public"."user_app_presence"
    ADD CONSTRAINT "user_app_presence_pkey" PRIMARY KEY ("email_hash", "app_id");




ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_idempotency_key" UNIQUE ("idempotency_key");




ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."youtube_categories"
    ADD CONSTRAINT "youtube_categories_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."youtube_categories"
    ADD CONSTRAINT "youtube_categories_site_id_slug_key" UNIQUE ("site_id", "slug");




ALTER TABLE ONLY "public"."youtube_channels"
    ADD CONSTRAINT "youtube_channels_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."youtube_channels"
    ADD CONSTRAINT "youtube_channels_site_id_channel_id_key" UNIQUE ("site_id", "channel_id");




ALTER TABLE ONLY "public"."youtube_channels"
    ADD CONSTRAINT "youtube_channels_site_id_locale_key" UNIQUE ("site_id", "locale");




ALTER TABLE ONLY "public"."youtube_curated_comments"
    ADD CONSTRAINT "youtube_curated_comments_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."youtube_sync_log"
    ADD CONSTRAINT "youtube_sync_log_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."youtube_videos"
    ADD CONSTRAINT "youtube_videos_pkey" PRIMARY KEY ("id");




ALTER TABLE ONLY "public"."youtube_videos"
    ADD CONSTRAINT "youtube_videos_site_id_youtube_video_id_key" UNIQUE ("site_id", "youtube_video_id");




ALTER TABLE ONLY "public"."ad_events"
    ADD CONSTRAINT "ad_events_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."ad_events"
    ADD CONSTRAINT "ad_events_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."ad_revenue_daily"
    ADD CONSTRAINT "ad_revenue_daily_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."ad_slot_config"
    ADD CONSTRAINT "ad_slot_config_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."ad_slot_creatives"
    ADD CONSTRAINT "ad_slot_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."ad_slot_metrics"
    ADD CONSTRAINT "ad_slot_metrics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaigns"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");




ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."author_about_translations"
    ADD CONSTRAINT "author_about_translations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."authors"
    ADD CONSTRAINT "authors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."blog_cadence"
    ADD CONSTRAINT "blog_cadence_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_previous_post_id_fkey" FOREIGN KEY ("previous_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");




ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_linked_newsletter_type_id_fkey" FOREIGN KEY ("linked_newsletter_type_id") REFERENCES "public"."newsletter_types"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."blog_translations"
    ADD CONSTRAINT "blog_translations_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."campaign_submissions"
    ADD CONSTRAINT "campaign_submissions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."campaign_translations"
    ADD CONSTRAINT "campaign_translations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");




ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");




ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_consent_text_id_fkey" FOREIGN KEY ("consent_text_id") REFERENCES "public"."consent_texts"("id");




ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."contact_submissions"
    ADD CONSTRAINT "contact_submissions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."content_events"
    ADD CONSTRAINT "content_events_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."content_metrics"
    ADD CONSTRAINT "content_metrics_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."link_alerts"
    ADD CONSTRAINT "fk_link_alerts_link" FOREIGN KEY ("link_id") REFERENCES "public"."tracked_links"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."link_annotations"
    ADD CONSTRAINT "fk_link_annotations_link" FOREIGN KEY ("link_id") REFERENCES "public"."tracked_links"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."link_daily_metrics"
    ADD CONSTRAINT "fk_link_daily_metrics_link" FOREIGN KEY ("link_id") REFERENCES "public"."tracked_links"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."link_goals"
    ADD CONSTRAINT "fk_link_goals_link" FOREIGN KEY ("link_id") REFERENCES "public"."tracked_links"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."hashtags"
    ADD CONSTRAINT "hashtags_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."lgpd_requests"
    ADD CONSTRAINT "lgpd_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."link_alerts"
    ADD CONSTRAINT "link_alerts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."link_alerts"
    ADD CONSTRAINT "link_alerts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."link_annotations"
    ADD CONSTRAINT "link_annotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."link_annotations"
    ADD CONSTRAINT "link_annotations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."link_daily_metrics"
    ADD CONSTRAINT "link_daily_metrics_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."link_goals"
    ADD CONSTRAINT "link_goals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."link_goals"
    ADD CONSTRAINT "link_goals_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."link_qr_templates"
    ADD CONSTRAINT "link_qr_templates_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."link_settings"
    ADD CONSTRAINT "link_settings_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."link_utm_presets"
    ADD CONSTRAINT "link_utm_presets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_ab_parent_id_fkey" FOREIGN KEY ("ab_parent_id") REFERENCES "public"."newsletter_editions"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_newsletter_type_id_fkey" FOREIGN KEY ("newsletter_type_id") REFERENCES "public"."newsletter_types"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_paired_edition_id_fkey" FOREIGN KEY ("paired_edition_id") REFERENCES "public"."newsletter_editions"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."newsletter_editions"
    ADD CONSTRAINT "newsletter_editions_source_blog_post_id_fkey" FOREIGN KEY ("source_blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_sends"
    ADD CONSTRAINT "newsletter_sends_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "public"."newsletter_editions"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."newsletter_sends"
    ADD CONSTRAINT "newsletter_sends_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "public"."tracked_links"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletter_types"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."newsletter_types"
    ADD CONSTRAINT "newsletter_types_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_types"
    ADD CONSTRAINT "newsletter_types_linked_tag_id_fkey" FOREIGN KEY ("linked_tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."newsletter_types"
    ADD CONSTRAINT "newsletter_types_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_parent_org_id_fkey" FOREIGN KEY ("parent_org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."post_hashtags"
    ADD CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "public"."hashtags"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."post_hashtags"
    ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."sent_emails"
    ADD CONSTRAINT "sent_emails_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."site_memberships"
    ADD CONSTRAINT "site_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");




ALTER TABLE ONLY "public"."site_memberships"
    ADD CONSTRAINT "site_memberships_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."site_memberships"
    ADD CONSTRAINT "site_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."tracked_links"
    ADD CONSTRAINT "tracked_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."tracked_links"
    ADD CONSTRAINT "tracked_links_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."unsubscribe_tokens"
    ADD CONSTRAINT "unsubscribe_tokens_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE RESTRICT;




ALTER TABLE ONLY "public"."youtube_categories"
    ADD CONSTRAINT "youtube_categories_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."youtube_channels"
    ADD CONSTRAINT "youtube_channels_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."youtube_curated_comments"
    ADD CONSTRAINT "youtube_curated_comments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."youtube_curated_comments"
    ADD CONSTRAINT "youtube_curated_comments_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."youtube_videos"("id") ON DELETE CASCADE;




ALTER TABLE ONLY "public"."youtube_sync_log"
    ADD CONSTRAINT "youtube_sync_log_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."youtube_channels"("id");




ALTER TABLE ONLY "public"."youtube_sync_log"
    ADD CONSTRAINT "youtube_sync_log_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE ONLY "public"."youtube_videos"
    ADD CONSTRAINT "youtube_videos_auto_suggested_category_id_fkey" FOREIGN KEY ("auto_suggested_category_id") REFERENCES "public"."youtube_categories"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."youtube_videos"
    ADD CONSTRAINT "youtube_videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."youtube_categories"("id") ON DELETE SET NULL;




ALTER TABLE ONLY "public"."youtube_videos"
    ADD CONSTRAINT "youtube_videos_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."youtube_channels"("id");




ALTER TABLE ONLY "public"."youtube_videos"
    ADD CONSTRAINT "youtube_videos_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id");




ALTER TABLE "public"."ad_campaigns" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_events" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_inquiries" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_media" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_placeholders" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_revenue_daily" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_slot_config" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_slot_creatives" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."ad_slot_metrics" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."author_about_translations" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."authors" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."blog_cadence" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."blog_tags" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."blog_translations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."campaign_submissions" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."campaign_translations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."consent_texts" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."consents" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."contact_submissions" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."content_events" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."content_metrics" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."cron_config" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."cron_runs" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."hashtags" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."kill_switches" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."lgpd_migration_backup_v1" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."lgpd_requests" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_aggregation_watermark" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."link_alerts" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_annotations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_clicks" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."link_clicks_2026_05" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."link_clicks_2026_06" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."link_clicks_2026_07" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."link_clicks_default" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_daily_metrics" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_goals" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_qr_templates" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_settings" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."link_utm_presets" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."newsletter_editions" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."newsletter_sends" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."newsletter_subscriptions" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."newsletter_types" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."password_reset_attempts" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."post_hashtags" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."sent_emails" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."site_memberships" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."tracked_links" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."unsubscribe_tokens" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."user_app_presence" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;



ALTER TABLE "public"."youtube_categories" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."youtube_channels" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."youtube_curated_comments" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."youtube_sync_log" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."youtube_videos" ENABLE ROW LEVEL SECURITY;


-- Functions
SET check_function_bodies = false;

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS (moved after tables to resolve %%ROWTYPE dependencies)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "public"."accept_invitation_atomic"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_inv record;
  v_user_email citext;
  v_base_slug text;
  v_slug text;
begin
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- Lock the invitation row
  select id, email, org_id, role, expires_at, accepted_at, revoked_at
    into v_inv
  from public.invitations
  where token = p_token
  for update;

  if v_inv.id is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_inv.accepted_at is not null then
    return json_build_object('ok', false, 'error', 'already_accepted');
  end if;
  if v_inv.revoked_at is not null then
    return json_build_object('ok', false, 'error', 'revoked');
  end if;
  if v_inv.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'expired');
  end if;

  -- Verify caller's email matches invitation email
  select email::citext into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null or lower(v_user_email::text) <> lower(v_inv.email::text) then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Atomic org member insert
  insert into public.organization_members (org_id, user_id, role)
  values (v_inv.org_id, v_user_id, v_inv.role)
  on conflict (org_id, user_id) do nothing;

  -- Fix #6: only insert author row for role='author'
  if v_inv.role = 'author' then
    v_base_slug := split_part(v_inv.email::text, '@', 1) || '-' || substring(v_user_id::text, 1, 8);
    v_slug := v_base_slug;

    -- Try primary slug; on conflict (slug unique) fall back with 4-hex suffix
    begin
      insert into public.authors (user_id, name, slug)
      values (
        v_user_id,
        split_part(v_inv.email::text, '@', 1),
        v_slug
      )
      on conflict (user_id) do nothing;
    exception when unique_violation then
      -- slug conflict: append 4 hex chars from md5(random())
      v_slug := v_base_slug || '-' || substring(md5(random()::text), 1, 4);
      insert into public.authors (user_id, name, slug)
      values (
        v_user_id,
        split_part(v_inv.email::text, '@', 1),
        v_slug
      )
      on conflict (user_id) do nothing;
    end;
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by_user_id = v_user_id
  where id = v_inv.id;

  return json_build_object('ok', true, 'org_id', v_inv.org_id);
end $$;;


CREATE OR REPLACE FUNCTION "public"."accept_invitation_atomic"("p_token_hash" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_redirect_url text;
BEGIN
  SELECT * INTO v_inv FROM invitations
  WHERE token = p_token_hash
    AND accepted_at IS NULL AND revoked_at IS NULL
    AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_invalid' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.role_scope = 'org' THEN
    INSERT INTO organization_members (org_id, user_id, role)
    VALUES (v_inv.org_id, p_user_id, v_inv.role)
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    v_redirect_url := 'https://bythiagofigueiredo.com/cms/login';
  ELSIF v_inv.role_scope = 'site' THEN
    INSERT INTO site_memberships (site_id, user_id, role, created_by)
    VALUES (v_inv.site_id, p_user_id, v_inv.role, v_inv.invited_by)
    ON CONFLICT (site_id, user_id) DO UPDATE SET role = EXCLUDED.role;
    SELECT 'https://' || s.primary_domain || '/cms/login'
    INTO v_redirect_url FROM sites s WHERE s.id = v_inv.site_id;
  END IF;
  UPDATE invitations SET accepted_at = now() WHERE id = v_inv.id;
  RETURN jsonb_build_object(
    'redirect_url', v_redirect_url,
    'role_scope', v_inv.role_scope,
    'role', v_inv.role,
    'org_id', v_inv.org_id,
    'site_id', v_inv.site_id
  );
END $$;;


CREATE OR REPLACE FUNCTION "public"."aggregate_ad_events_yesterday"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _yesterday date := (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1;
  _rows_upserted integer := 0;
BEGIN
  WITH agg AS (
    SELECT
      ad_id                                              AS campaign_id,
      slot_id                                            AS slot_key,
      _yesterday                                         AS date,
      COUNT(*) FILTER (WHERE event_type = 'impression')  AS imp,
      COUNT(*) FILTER (WHERE event_type = 'click')       AS clk
    FROM public.ad_events
    WHERE ad_id IS NOT NULL
      AND created_at >= _yesterday::timestamptz
      AND created_at <  (_yesterday + 1)::timestamptz
    GROUP BY ad_id, slot_id
  )
  INSERT INTO public.ad_slot_metrics (campaign_id, slot_key, date, impressions, clicks)
  SELECT campaign_id, slot_key, date, imp, clk
  FROM agg
  ON CONFLICT (campaign_id, slot_key, date)
  DO UPDATE SET
    impressions = ad_slot_metrics.impressions + EXCLUDED.impressions,
    clicks      = ad_slot_metrics.clicks      + EXCLUDED.clicks;

  GET DIAGNOSTICS _rows_upserted = ROW_COUNT;
  RETURN _rows_upserted;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."aggregate_content_events"("p_date" "date" DEFAULT (CURRENT_DATE - 1)) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_aggregated int;
  v_updated int;
BEGIN
  INSERT INTO content_metrics (
    site_id, resource_type, resource_id, date,
    views, unique_views, reads_complete,
    avg_read_depth, avg_time_sec,
    referrer_direct, referrer_google, referrer_newsletter, referrer_social, referrer_other
  )
  SELECT
    site_id, resource_type, resource_id, p_date,
    count(*) FILTER (WHERE event_type = 'view'),
    count(DISTINCT anonymous_id) FILTER (WHERE event_type = 'view'),
    count(*) FILTER (WHERE event_type = 'read_complete'),
    coalesce(avg(read_depth) FILTER (WHERE event_type = 'read_progress' AND read_depth IS NOT NULL), 0)::smallint,
    coalesce(avg(time_on_page) FILTER (WHERE event_type = 'read_progress' AND time_on_page IS NOT NULL), 0)::smallint,
    count(*) FILTER (WHERE referrer_src = 'direct' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'google' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'newsletter' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'social' AND event_type = 'view'),
    count(*) FILTER (WHERE referrer_src = 'other' AND event_type = 'view')
  FROM content_events
  WHERE created_at >= p_date::timestamptz
    AND created_at < (p_date + interval '1 day')::timestamptz
    AND (user_agent IS NULL OR user_agent NOT SIMILAR TO '%(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot)%')
  GROUP BY site_id, resource_type, resource_id
  ON CONFLICT (resource_type, resource_id, date) DO UPDATE SET
    views = EXCLUDED.views,
    unique_views = EXCLUDED.unique_views,
    reads_complete = EXCLUDED.reads_complete,
    avg_read_depth = EXCLUDED.avg_read_depth,
    avg_time_sec = EXCLUDED.avg_time_sec,
    referrer_direct = EXCLUDED.referrer_direct,
    referrer_google = EXCLUDED.referrer_google,
    referrer_newsletter = EXCLUDED.referrer_newsletter,
    referrer_social = EXCLUDED.referrer_social,
    referrer_other = EXCLUDED.referrer_other;

  GET DIAGNOSTICS v_aggregated = ROW_COUNT;

  UPDATE blog_posts bp SET
    view_count = coalesce(agg.total_views, 0),
    read_complete_count = coalesce(agg.total_reads, 0)
  FROM (
    SELECT resource_id,
           sum(views) AS total_views,
           sum(reads_complete) AS total_reads
    FROM content_metrics
    WHERE resource_type = 'blog'
    GROUP BY resource_id
  ) agg
  WHERE bp.id = agg.resource_id
    AND (bp.view_count IS DISTINCT FROM coalesce(agg.total_views, 0)
      OR bp.read_complete_count IS DISTINCT FROM coalesce(agg.total_reads, 0));

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'date', p_date,
    'metrics_upserted', v_aggregated,
    'posts_updated', v_updated
  );
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."anonymize_contact_submission"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_sub record; v_site_id uuid; v_hash text;
begin
  if p_id is null then
    raise exception 'invalid_id';
  end if;

  -- Lock the row up-front and fetch every field we'll need. Single query so the
  -- authz check and the update see the same committed state — no TOCTOU.
  select id, site_id, email, anonymized_at
    into v_sub
  from public.contact_submissions
  where id = p_id
  for update;

  if v_sub.id is null then
    -- Fail-closed on missing row WITHOUT revealing existence to non-staff.
    -- Global staff get an explicit 'not_found'; anyone else gets 'forbidden'.
    if public.is_staff() or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' then
      raise exception 'not_found';
    end if;
    raise exception 'forbidden';
  end if;

  v_site_id := v_sub.site_id;

  -- Access control: staff of the submission's site/org, service_role, or
  -- site-scoped admin via can_admin_site against the resolved site_id.
  if not (public.is_staff()
          or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
          or (v_site_id is not null and public.can_admin_site(v_site_id))) then
    raise exception 'forbidden';
  end if;

  if v_sub.anonymized_at is not null then
    return; -- idempotent no-op
  end if;

  v_hash := encode(sha256(v_sub.email::bytea), 'hex');

  update public.contact_submissions
  set name = 'Anonymous',
      email = v_hash,
      ip = null,
      user_agent = null,
      message = '[anonymized per LGPD request]',
      anonymized_at = now()
  where id = p_id;
end $$;;


CREATE OR REPLACE FUNCTION "public"."anonymize_old_link_clicks"("p_older_than_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_anonymized int;
BEGIN
  UPDATE link_clicks
  SET
    ip          = NULL,
    user_agent  = NULL,
    city        = NULL,
    region      = NULL
  WHERE
    clicked_at < now() - (p_older_than_days || ' days')::interval
    AND ip IS NOT NULL;

  GET DIAGNOSTICS v_anonymized = ROW_COUNT;

  RETURN jsonb_build_object(
    'anonymized', v_anonymized,
    'older_than_days', p_older_than_days
  );
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."can_admin_site"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_org_id uuid;
  v_parent_org_id uuid;
begin
  select s.org_id, o.parent_org_id
    into v_org_id, v_parent_org_id
  from public.sites s
  join public.organizations o on o.id = s.org_id
  where s.id = p_site_id;

  if v_org_id is null then return false; end if;

  if public.is_org_staff(v_org_id) then return true; end if;

  if v_parent_org_id is not null and public.is_org_staff(v_parent_org_id) then
    return true;
  end if;

  return false;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."can_admin_site_for_user"("p_site_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
  v_parent_org_id uuid;
BEGIN
  SELECT s.org_id, o.parent_org_id INTO v_org_id, v_parent_org_id
  FROM public.sites s
  JOIN public.organizations o ON o.id = s.org_id
  WHERE s.id = p_site_id;

  IF v_org_id IS NULL THEN RETURN FALSE; END IF;

  -- Check org_admin (RBAC v3) of the site's direct org or its parent (cascade-up).
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = p_user_id
      AND role = 'org_admin'
      AND org_id IN (v_org_id, v_parent_org_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check site_memberships: editors have site-level edit access.
  IF EXISTS (
    SELECT 1 FROM site_memberships
    WHERE site_id = p_site_id AND user_id = p_user_id AND role = 'editor'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;;


CREATE OR REPLACE FUNCTION "public"."can_admin_site_users"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id));
$$;;


CREATE OR REPLACE FUNCTION "public"."can_edit_site"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid() AND role = 'editor');
$$;;


CREATE OR REPLACE FUNCTION "public"."can_publish_site"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.can_edit_site(p_site_id);
$$;;


CREATE OR REPLACE FUNCTION "public"."can_view_site"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM sites s WHERE s.id = p_site_id AND public.is_org_admin(s.org_id))
  OR EXISTS (SELECT 1 FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid());
$$;;


CREATE OR REPLACE FUNCTION "public"."cancel_account_deletion_in_grace"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row lgpd_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM lgpd_requests
  WHERE confirmation_token_hash = p_token_hash
    AND type = 'account_deletion'
    AND status = 'processing'
    AND phase = 1
    AND scheduled_purge_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('cancelled', false);
  END IF;

  UPDATE lgpd_requests
  SET status = 'cancelled', cancelled_at = now()
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'cancelled', true,
    'user_id', v_row.user_id,
    'scheduled_purge_at', v_row.scheduled_purge_at
  );
END $$;;


CREATE OR REPLACE FUNCTION "public"."check_deletion_safety"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_blockers text[] := ARRAY[]::text[];
  v_details jsonb := '{}'::jsonb;
  v_master_ring_id uuid;
  v_master_admin_count int;
  v_child_sole_orgs uuid[];
  v_sole_editor_sites uuid[];
BEGIN
  -- Identify master ring (unique: parent_org_id IS NULL).
  SELECT id INTO v_master_ring_id
  FROM organizations WHERE parent_org_id IS NULL LIMIT 1;

  -- Blocker 1: master ring sole admin.
  IF v_master_ring_id IS NOT NULL THEN
    SELECT count(*) INTO v_master_admin_count
    FROM organization_members
    WHERE org_id = v_master_ring_id AND role = 'org_admin';

    IF v_master_admin_count = 1 AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = v_master_ring_id AND role = 'org_admin' AND user_id = p_user_id
    ) THEN
      v_blockers := array_append(v_blockers, 'master_ring_sole_admin');
      v_details := v_details || jsonb_build_object('master_ring_org_id', v_master_ring_id);
    END IF;
  END IF;

  -- Blocker 2: child org sole admin.
  SELECT COALESCE(array_agg(org_id), ARRAY[]::uuid[])
  INTO v_child_sole_orgs
  FROM (
    SELECT om.org_id
    FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = p_user_id
      AND om.role = 'org_admin'
      AND o.parent_org_id IS NOT NULL
      AND (
        SELECT count(*) FROM organization_members om2
        WHERE om2.org_id = om.org_id AND om2.role = 'org_admin'
      ) = 1
  ) t;

  IF array_length(v_child_sole_orgs, 1) IS NOT NULL THEN
    v_blockers := array_append(v_blockers, 'child_org_sole_admin');
    v_details := v_details || jsonb_build_object('child_org_ids', to_jsonb(v_child_sole_orgs));
  END IF;

  -- Blocker 3: sole editor on sites with published content.
  SELECT COALESCE(array_agg(site_id), ARRAY[]::uuid[])
  INTO v_sole_editor_sites
  FROM (
    SELECT sm.site_id
    FROM site_memberships sm
    WHERE sm.user_id = p_user_id
      AND sm.role = 'editor'
      AND (
        SELECT count(*) FROM site_memberships sm2
        WHERE sm2.site_id = sm.site_id AND sm2.role = 'editor'
      ) = 1
      AND EXISTS (
        SELECT 1 FROM blog_posts bp
        WHERE bp.site_id = sm.site_id AND bp.status = 'published'
      )
  ) t;

  IF array_length(v_sole_editor_sites, 1) IS NOT NULL THEN
    v_blockers := array_append(v_blockers, 'sole_editor_on_sites');
    v_details := v_details || jsonb_build_object('sole_editor_site_ids', to_jsonb(v_sole_editor_sites));
  END IF;

  RETURN jsonb_build_object(
    'can_delete', (array_length(v_blockers, 1) IS NULL),
    'blockers', to_jsonb(v_blockers),
    'details', v_details
  );
END $$;;


CREATE OR REPLACE FUNCTION "public"."confirm_newsletter_subscription"("p_token_hash" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_first  record;
  v_count  int;
BEGIN
  -- Lock all matching rows
  SELECT id, site_id, email, status, confirmation_expires_at
    INTO v_first
    FROM public.newsletter_subscriptions
   WHERE confirmation_token_hash = p_token_hash
   LIMIT 1
     FOR UPDATE;

  IF v_first.id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- If already confirmed, return idempotent success
  IF v_first.status = 'confirmed' THEN
    RETURN json_build_object('ok', true, 'email', v_first.email,
                             'site_id', v_first.site_id, 'already', true);
  END IF;

  -- Check expiry on the first row (all rows in the batch share the same expiry)
  IF v_first.confirmation_expires_at IS NULL
     OR v_first.confirmation_expires_at <= now() THEN
    RETURN json_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Confirm ALL rows sharing this token hash
  UPDATE public.newsletter_subscriptions
     SET status = 'confirmed',
         confirmed_at = now(),
         confirmation_token_hash = NULL,
         confirmation_expires_at = NULL
   WHERE confirmation_token_hash = p_token_hash
     AND status = 'pending_confirmation';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('ok', true, 'email', v_first.email,
                           'site_id', v_first.site_id, 'confirmed_count', v_count);
END $$;;


CREATE OR REPLACE FUNCTION "public"."contact_rate_check"("p_site_id" "uuid", "p_ip" "text", "p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ip_inet inet;
  v_count int;
begin
  if p_site_id is null then return false; end if;

  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then
    v_ip_inet := null;
  end;

  select count(*) into v_count
  from contact_submissions
  where site_id = p_site_id
    and submitted_at > now() - interval '10 minutes'
    and (
      (p_email is not null and email = p_email::citext)
      or (v_ip_inet is not null and ip = v_ip_inet)
    );

  return v_count < 5;
end;
$$;;


CREATE OR REPLACE FUNCTION "public"."create_link_clicks_partition"("p_partition_name" "text", "p_start_date" "text", "p_end_date" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF link_clicks FOR VALUES FROM (%L) TO (%L)',
    p_partition_name,
    p_start_date,
    p_end_date
  );
  RETURN p_partition_name;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."create_monthly_partitions"("p_months_ahead" integer DEFAULT 3) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_month      date;
  v_start      date;
  v_end        date;
  v_suffix     text;
  v_tbl        text;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_month  := date_trunc('month', now()) + (i || ' months')::interval;
    v_start  := v_month;
    v_end    := v_month + interval '1 month';
    v_suffix := to_char(v_month, 'YYYY_MM');

    -- link_clicks partition
    v_tbl := 'link_clicks_' || v_suffix;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_tbl AND n.nspname = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.link_clicks
           FOR VALUES FROM (%L) TO (%L)',
        v_tbl, v_start, v_end
      );
    END IF;
  END LOOP;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."cron_http_post_web"("p_path" "text", "p_timeout_ms" integer DEFAULT 30000) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      v_url text;
      v_secret text;
    BEGIN
      SELECT value INTO v_url FROM public.cron_config WHERE key = 'web_url';
      SELECT value INTO v_secret FROM public.cron_config WHERE key = 'cron_secret';

      IF v_url IS NULL OR v_secret IS NULL OR v_secret = 'CHANGE_ME_AFTER_APPLY' THEN
        RAISE LOG '[cron_http_post_web] cron_config incompleto — pulando % (web_url=%, secret_ok=%)',
          p_path, (v_url IS NOT NULL), (v_secret IS NOT NULL AND v_secret != 'CHANGE_ME_AFTER_APPLY');
        RETURN NULL;
      END IF;

      RETURN net.http_post(
        url := v_url || p_path,
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_secret,
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := p_timeout_ms
      );
    END $$;;


CREATE OR REPLACE FUNCTION "public"."cron_purge_old_contact_submissions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _anonymized int;
BEGIN
  SELECT public.purge_old_contact_submissions(730) INTO _anonymized;
  RAISE LOG '[pg_cron] purge-old-contact-submissions: % rows', _anonymized;
END $$;;


CREATE OR REPLACE FUNCTION "public"."cron_purge_sent_emails"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _deleted int;
BEGIN
  SELECT public.purge_sent_emails(90) INTO _deleted;
  RAISE LOG '[pg_cron] purge-sent-emails: % rows', _deleted;
END $$;;


CREATE OR REPLACE FUNCTION "public"."cron_try_lock"("p_job" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select pg_try_advisory_lock(hashtextextended(p_job, 0));
$$;;


CREATE OR REPLACE FUNCTION "public"."cron_unlock"("p_job" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select pg_advisory_unlock(hashtextextended(p_job, 0));
$$;;


CREATE OR REPLACE FUNCTION "public"."enforce_publish_permission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status IN ('published','scheduled')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT public.can_publish_site(NEW.site_id) THEN
      RAISE EXCEPTION 'insufficient_access: cannot publish on site %', NEW.site_id
        USING ERRCODE = 'P0001', HINT = 'requires_editor_role';
    END IF;
  END IF;
  RETURN NEW;
END $$;;


CREATE OR REPLACE FUNCTION "public"."generate_link_code"("p_site_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_alphabet text  := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_length   int   := 6;
  v_code     text;
  v_attempt  int   := 0;
  v_exists   boolean;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      v_length := 8;  -- widen the space after repeated collisions
    END IF;
    IF v_attempt > 40 THEN
      RAISE EXCEPTION 'generate_link_code: too many collisions for site %', p_site_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Build a random code by sampling characters from the alphabet.
    v_code := '';
    FOR i IN 1..v_length LOOP
      v_code := v_code || substr(
        v_alphabet,
        1 + (floor(random() * length(v_alphabet)))::int,
        1
      );
    END LOOP;

    -- Check uniqueness within the site.
    SELECT EXISTS (
      SELECT 1 FROM tracked_links
      WHERE site_id = p_site_id AND code = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."get_anonymous_consents"("p_anonymous_id" "text") RETURNS SETOF "public"."consents"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT * FROM consents
  WHERE anonymous_id = p_anonymous_id
    AND user_id IS NULL;
$$;;


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("p_token_hash" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'inviter_email', au.email,
    'inviter_name', COALESCE(au.raw_user_meta_data->>'name', split_part(au.email,'@',1)),
    'org_id', i.org_id,
    'org_name', o.name,
    'site_id', i.site_id,
    'site_name', s.name,
    'primary_domain', s.primary_domain,
    'role', i.role,
    'role_scope', i.role_scope,
    'email', i.email,
    'expires_at', i.expires_at
  ) FROM invitations i
  LEFT JOIN auth.users au ON au.id = i.invited_by
  LEFT JOIN organizations o ON o.id = i.org_id
  LEFT JOIN sites s ON s.id = i.site_id
  WHERE i.token = p_token_hash
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now();
$$;;


CREATE OR REPLACE FUNCTION "public"."get_site_branding"("p_site_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'name', s.name,
    'logo_url', s.logo_url,
    'primary_color', s.primary_color,
    'primary_domain', s.primary_domain,
    'default_locale', s.default_locale
  ) FROM sites s WHERE s.id = p_site_id;
$$;;


CREATE OR REPLACE FUNCTION "public"."increment_invitation_resend"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_inv invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM invitations WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.role_scope = 'org' THEN
    IF NOT public.is_org_admin(v_inv.org_id) THEN
      RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_inv.role_scope = 'site' THEN
    IF NOT public.can_admin_site_users(v_inv.site_id) THEN
      RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF v_inv.last_sent_at > now() - interval '30 seconds' THEN
    RAISE EXCEPTION 'resend_cooldown' USING ERRCODE = 'P0001', HINT = 'cooldown';
  END IF;
  UPDATE invitations SET resend_count = resend_count + 1, last_sent_at = now() WHERE id = p_id;
END $$;;


CREATE OR REPLACE FUNCTION "public"."increment_link_clicks"("p_link_id" "uuid", "p_is_unique" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE tracked_links
  SET
    total_clicks = total_clicks + 1,
    unique_visitors = CASE WHEN p_is_unique THEN unique_visitors + 1 ELSE unique_visitors END,
    last_clicked_at = now()
  WHERE id = p_link_id;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."invitations_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM invitations
  WHERE org_id = NEW.org_id AND created_at > now() - interval '1 hour';
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'invitation rate limit exceeded (20/hour/org)'
      USING ERRCODE = 'P0001', HINT = 'rate_limit';
  END IF;
  RETURN NEW;
END $$;;


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select public.user_role() in ('admin','super_admin')
$$;;


CREATE OR REPLACE FUNCTION "public"."is_member_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_super_admin()
  OR EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND role = 'org_admin')
  OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = auth.uid() AND role IN ('editor','reporter'));
$$;;


CREATE OR REPLACE FUNCTION "public"."is_org_admin"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND org_id = p_org_id AND role = 'org_admin'
  );
$$;;


CREATE OR REPLACE FUNCTION "public"."is_org_staff"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(public.org_role(p_org_id) in ('owner','admin','editor'), false)
$$;;


CREATE OR REPLACE FUNCTION "public"."is_org_staff_for_user"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'org_admin'
  );
$$;;


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select public.user_role() in ('editor','admin','super_admin')
$$;;


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'org_admin'
      AND o.parent_org_id IS NULL
  );
$$;;


CREATE OR REPLACE FUNCTION "public"."lgpd_phase1_cleanup"("p_user_id" "uuid", "p_pre_capture" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_master_admin uuid;
  v_master_ring uuid;
  v_email text;
  v_email_hash text;
BEGIN
  -- Caller identity guard.
  -- Only service_role / supabase_admin can wipe ANY user.
  -- Other roles (e.g. `authenticated`) can only target themselves — so
  -- even if a future migration mis-grants EXECUTE to authenticated,
  -- they can't wipe a stranger's account.
  -- NOTE: uses auth.role() (JWT claim), NOT current_user — in SECURITY DEFINER
  -- functions current_user returns the function owner ('postgres'), not the caller.
  IF auth.role() NOT IN ('service_role','supabase_admin')
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden: can only clean up own account'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.skip_cascade_audit', '1', true);

  -- Resolve master admin (for content reassignment). Pick any org_admin of master ring.
  SELECT id INTO v_master_ring FROM organizations WHERE parent_org_id IS NULL LIMIT 1;
  IF v_master_ring IS NOT NULL THEN
    SELECT user_id INTO v_master_admin
    FROM organization_members
    WHERE org_id = v_master_ring AND role = 'org_admin' AND user_id <> p_user_id
    LIMIT 1;
  END IF;

  -- 1. Newsletter anonymize via pre-captured emails.
  IF p_pre_capture ? 'newsletter_emails' THEN
    FOR v_email IN SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    LOOP
      v_email_hash := encode(sha256(v_email::bytea), 'hex');
      UPDATE newsletter_subscriptions
      SET email = v_email_hash,
          ip = NULL,
          user_agent = NULL,
          status = 'unsubscribed',
          unsubscribed_at = COALESCE(unsubscribed_at, now())
      WHERE email = v_email AND status <> 'unsubscribed';
    END LOOP;
  END IF;

  -- 2. Contact submissions anonymize — by email matches from pre-capture.
  IF p_pre_capture ? 'newsletter_emails' THEN
    UPDATE contact_submissions
    SET name = '[REDACTED]',
        email = '[REDACTED]@redacted.invalid',
        message = '[REDACTED]',
        ip = NULL,
        user_agent = NULL
    WHERE email::text = ANY (
      SELECT jsonb_array_elements_text(p_pre_capture->'newsletter_emails')
    );
  END IF;

  -- 3 + 4. Reassign content ownership to master_admin (NULL if no master_admin exists).
  UPDATE blog_posts SET owner_user_id = v_master_admin
    WHERE owner_user_id = p_user_id;
  UPDATE campaigns SET owner_user_id = v_master_admin
    WHERE owner_user_id = p_user_id;

  -- 5. Nullify authors.user_id for this user — keeps author row for historical byline.
  UPDATE authors SET user_id = NULL WHERE user_id = p_user_id;

  -- 6. Delete pending invitations this user sent out.
  DELETE FROM invitations
  WHERE invited_by = p_user_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  -- 7. Null actor_user_id in audit_log (structural preservation per LGPD accountability).
  UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;
END $$;;


CREATE OR REPLACE FUNCTION "public"."lgpd_phase3_prenullify_fks"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.authors SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.blog_posts SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.campaigns SET owner_user_id = NULL WHERE owner_user_id = p_user_id;
  UPDATE public.audit_log SET actor_user_id = NULL WHERE actor_user_id = p_user_id;
  UPDATE public.invitations SET invited_by = NULL WHERE invited_by = p_user_id AND accepted_at IS NULL;
  UPDATE public.invitations SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_user_id;
END $$;;


CREATE OR REPLACE FUNCTION "public"."merge_anonymous_consents"("p_anonymous_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_merged int := 0;
  v_rec record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Lock anonymous rows first to avoid races with another tab's merge.
  FOR v_rec IN
    SELECT id, category, site_id, consent_text_id, granted, granted_at, ip, user_agent
    FROM consents
    WHERE anonymous_id = p_anonymous_id AND user_id IS NULL
    FOR UPDATE
  LOOP
    -- Skip if user already has a current consent for (category, site_id).
    IF EXISTS (
      SELECT 1 FROM consents
      WHERE user_id = v_user
        AND category = v_rec.category
        AND site_id IS NOT DISTINCT FROM v_rec.site_id
        AND withdrawn_at IS NULL
    ) THEN
      DELETE FROM consents WHERE id = v_rec.id;
      CONTINUE;
    END IF;

    INSERT INTO consents (user_id, anonymous_id, category, site_id, consent_text_id, granted, granted_at, ip, user_agent)
    VALUES (v_user, NULL, v_rec.category, v_rec.site_id, v_rec.consent_text_id, v_rec.granted, v_rec.granted_at, v_rec.ip, v_rec.user_agent);

    DELETE FROM consents WHERE id = v_rec.id;
    v_merged := v_merged + 1;
  END LOOP;

  RETURN jsonb_build_object('merged_count', v_merged);
END $$;;


CREATE OR REPLACE FUNCTION "public"."newsletter_rate_check"("p_site_id" "uuid", "p_ip" "text", "p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ip_inet inet;
  v_count int;
begin
  if p_site_id is null then return false; end if;

  begin
    v_ip_inet := case when p_ip is null or p_ip = '' then null else p_ip::inet end;
  exception when others then
    v_ip_inet := null;
  end;

  select count(*) into v_count
  from newsletter_subscriptions
  where site_id = p_site_id
    and subscribed_at > now() - interval '1 hour'
    and (
      email = p_email
      or (v_ip_inet is not null and ip = v_ip_inet)
    );

  return v_count < 5;
end;
$$;;


CREATE OR REPLACE FUNCTION "public"."org_role"("p_org_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select role from public.organization_members
  where org_id = p_org_id and user_id = auth.uid()
  limit 1
$$;;


CREATE OR REPLACE FUNCTION "public"."org_role_for_user"("p_org_id" "uuid", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select role from public.organization_members
  where org_id = p_org_id and user_id = p_user_id
  limit 1
$$;;


CREATE OR REPLACE FUNCTION "public"."pg_typeof_citext_probe"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select pg_typeof('a'::citext)::text
$$;;


CREATE OR REPLACE FUNCTION "public"."pin_weekly_pick"("p_video_id" "uuid", "p_channel_id" "uuid", "p_site_id" "uuid", "p_duration_days" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Clear any existing pin for this channel+site (including expired)
  -- so the UNIQUE partial index (WHERE pinned_until IS NOT NULL) stays satisfied.
  update youtube_videos
     set pinned_until = null,
         updated_at = now()
   where channel_id = p_channel_id
     and site_id = p_site_id
     and pinned_until is not null;

  -- Set new pin
  update youtube_videos
     set pinned_until = now() + (p_duration_days || ' days')::interval,
         updated_at = now()
   where id = p_video_id
     and channel_id = p_channel_id
     and site_id = p_site_id;
end;
$$;;


CREATE OR REPLACE FUNCTION "public"."purge_content_events"("p_older_than_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM content_events
  WHERE created_at < now() - (p_older_than_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('purged', v_deleted);
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."purge_deleted_user_audit"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE audit_log
  SET
    before_data = CASE
      WHEN before_data IS NULL THEN NULL
      ELSE before_data
        - 'email'
        - 'name'
        - 'ip'
        - 'user_agent'
        - 'message'
    END,
    after_data = CASE
      WHEN after_data IS NULL THEN NULL
      ELSE after_data
        - 'email'
        - 'name'
        - 'ip'
        - 'user_agent'
        - 'message'
    END
  WHERE (
    actor_user_id = p_user_id
    OR (before_data->>'user_id') = p_user_id::text
    OR (after_data->>'user_id') = p_user_id::text
  );
END $$;;


CREATE OR REPLACE FUNCTION "public"."purge_old_contact_submissions"("p_older_than_days" integer DEFAULT 730) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count int := 0;
  v_id uuid;
begin
  for v_id in
    select id
    from public.contact_submissions
    where submitted_at < now() - (p_older_than_days || ' days')::interval
      and anonymized_at is null
  loop
    perform public.anonymize_contact_submission(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."purge_sent_emails"("p_older_than_days" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_days int; v_deleted int;
begin
  v_days := greatest(coalesce(p_older_than_days, 90), 1);

  with del as (
    delete from public.sent_emails
    where sent_at < now() - (v_days || ' days')::interval
    returning id
  )
  select count(*) into v_deleted from del;

  return v_deleted;
end $$;;


CREATE OR REPLACE FUNCTION "public"."reassign_authors"("p_from" "uuid", "p_to" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_site_id uuid;
BEGIN
  -- Permission check: caller must be able to admin site users for every site
  -- that has blog_posts/campaigns authored by rows linked to p_from's author_id.
  FOR v_site_id IN
    SELECT DISTINCT bp.site_id
    FROM blog_posts bp
    JOIN authors a ON a.id = bp.author_id
    WHERE a.user_id = p_from
    UNION
    SELECT DISTINCT c.site_id
    FROM campaigns c
    WHERE c.owner_user_id = p_from
  LOOP
    IF NOT public.can_admin_site_users(v_site_id) THEN
      RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  UPDATE authors SET user_id = p_to WHERE user_id = p_from;
END $$;;


CREATE OR REPLACE FUNCTION "public"."reassign_content"("p_from_user" "uuid", "p_to_user" "uuid", "p_site_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_count integer := 0; v_tmp integer;
BEGIN
  IF NOT public.can_admin_site_users(p_site_id) THEN
    RAISE EXCEPTION 'insufficient_access' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (public.is_super_admin()
    OR public.is_org_admin((SELECT org_id FROM sites WHERE id = p_site_id))
    OR EXISTS (SELECT 1 FROM site_memberships WHERE user_id = p_to_user AND site_id = p_site_id AND role = 'editor')) THEN
    RAISE EXCEPTION 'target_user_not_eligible' USING ERRCODE = 'P0003';
  END IF;
  UPDATE blog_posts SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_count := v_count + v_tmp;
  UPDATE campaigns SET owner_user_id = p_to_user
    WHERE site_id = p_site_id AND owner_user_id = p_from_user;
  GET DIAGNOSTICS v_tmp = ROW_COUNT;
  v_count := v_count + v_tmp;
  RETURN v_count;
END $$;;


CREATE OR REPLACE FUNCTION "public"."record_password_reset_attempt"("p_email" "text", "p_ip" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_email, 1));
  select count(*) into v_count
    from public.password_reset_attempts
    where email = p_email
      and attempted_at > now() - interval '1 hour';
  if v_count >= 5 then
    return false;
  end if;
  insert into public.password_reset_attempts(email, ip)
    values (p_email, nullif(p_ip, '')::inet);
  return true;
end;
$$;;


CREATE OR REPLACE FUNCTION "public"."refresh_newsletter_stats"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE newsletter_editions e
  SET
    stats_delivered = COALESCE(s.delivered, 0),
    stats_opens = COALESCE(s.opens, 0),
    stats_clicks = COALESCE(s.clicks, 0),
    stats_bounces = COALESCE(s.bounces, 0),
    stats_complaints = COALESCE(s.complaints, 0),
    stats_stale = false
  FROM (
    SELECT edition_id,
      COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked')) as delivered,
      COUNT(*) FILTER (WHERE status IN ('opened','clicked')) as opens,
      COUNT(*) FILTER (WHERE status = 'clicked') as clicks,
      COUNT(*) FILTER (WHERE status = 'bounced') as bounces,
      COUNT(*) FILTER (WHERE status = 'complained') as complaints
    FROM newsletter_sends
    WHERE edition_id IN (SELECT id FROM newsletter_editions WHERE stats_stale = true)
    GROUP BY edition_id
  ) s
  WHERE e.id = s.edition_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."set_audit_context"("p_ip" "text", "p_user_agent" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    set_config('app.client_ip', COALESCE(p_ip, ''), true),
    set_config('app.user_agent', COALESCE(p_user_agent, ''), true);
  SELECT;
$$;;


CREATE OR REPLACE FUNCTION "public"."set_owner_user_id_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;;


CREATE OR REPLACE FUNCTION "public"."site_visible"("p_site_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  v_raw text := nullif(current_setting('app.site_id', true), '');
  v_ctx uuid;
begin
  if p_site_id is null then
    return true;
  end if;
  if v_raw is null then
    return true;
  end if;
  begin
    v_ctx := v_raw::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return p_site_id = v_ctx;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."swap_slot_edition"("p_new_edition_id" "uuid", "p_slot_date" "date", "p_type_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_occupant_id uuid;
  v_occupant_status text;
  v_type_row record;
  v_site_row record;
  v_send_time text;
  v_timezone text;
  v_scheduled_at timestamptz;
begin
  -- Find current occupant
  select id, status into v_occupant_id, v_occupant_status
  from newsletter_editions
  where newsletter_type_id = p_type_id
    and edition_kind = 'cadence'
    and slot_date = p_slot_date
    and status not in ('cancelled', 'archived')
  for update;

  if v_occupant_id is null then
    return jsonb_build_object('ok', false, 'error', 'slot_not_occupied');
  end if;

  if v_occupant_status in ('sending', 'sent') then
    return jsonb_build_object('ok', false, 'error', 'occupant_locked');
  end if;

  -- Verify new edition is in 'ready' status
  perform 1 from newsletter_editions
  where id = p_new_edition_id and status = 'ready'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'edition_not_ready');
  end if;

  -- Get send time and timezone
  select preferred_send_time, site_id into v_type_row
  from newsletter_types where id = p_type_id;

  if v_type_row is null then
    return jsonb_build_object('ok', false, 'error', 'type_not_found');
  end if;

  select timezone into v_timezone
  from sites where id = v_type_row.site_id;

  v_send_time := coalesce(v_type_row.preferred_send_time::text, '09:00:00');
  v_timezone := coalesce(v_timezone, 'America/Sao_Paulo');

  -- Compute scheduled_at from slot_date + send_time in site timezone
  v_scheduled_at := (p_slot_date::text || ' ' || v_send_time)::timestamp at time zone v_timezone;

  -- Step 1: Clear old edition's slot
  update newsletter_editions set
    status = 'ready',
    slot_date = null,
    scheduled_at = null,
    edition_kind = null,
    updated_at = now()
  where id = v_occupant_id;

  -- Step 2: Schedule new edition to the slot
  update newsletter_editions set
    status = 'scheduled',
    slot_date = p_slot_date,
    scheduled_at = v_scheduled_at,
    edition_kind = 'cadence',
    newsletter_type_id = p_type_id,
    updated_at = now()
  where id = p_new_edition_id;

  return jsonb_build_object('ok', true, 'displaced_edition_id', v_occupant_id);
end;
$$;;


CREATE OR REPLACE FUNCTION "public"."sync_tag_newsletter_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_other_site_id uuid;
BEGIN
  -- Recursion guard: skip if we're already inside a cross-table update
  IF current_setting('app.skip_link_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  SET LOCAL app.skip_link_sync = '1';

  -- ── blog_tags side ──
  IF TG_TABLE_NAME = 'blog_tags' THEN

    -- Link changed?
    IF TG_OP = 'INSERT' THEN
      IF NEW.linked_newsletter_type_id IS NOT NULL THEN
        -- Cross-site validation
        SELECT site_id INTO v_other_site_id
          FROM newsletter_types WHERE id = NEW.linked_newsletter_type_id;
        IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
          RAISE EXCEPTION 'cross-site link forbidden'
            USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
        END IF;

        UPDATE newsletter_types
          SET linked_tag_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_newsletter_type_id;
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- linked_newsletter_type_id changed
      IF OLD.linked_newsletter_type_id IS DISTINCT FROM NEW.linked_newsletter_type_id THEN

        -- Clear old counterpart
        IF OLD.linked_newsletter_type_id IS NOT NULL THEN
          UPDATE newsletter_types SET linked_tag_id = NULL
            WHERE id = OLD.linked_newsletter_type_id;
        END IF;

        -- Set new counterpart
        IF NEW.linked_newsletter_type_id IS NOT NULL THEN
          SELECT site_id INTO v_other_site_id
            FROM newsletter_types WHERE id = NEW.linked_newsletter_type_id;
          IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
            RAISE EXCEPTION 'cross-site link forbidden'
              USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
          END IF;

          UPDATE newsletter_types
            SET linked_tag_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
            WHERE id = NEW.linked_newsletter_type_id;
        END IF;

      -- Color changed while linked (no FK change)
      ELSIF NEW.linked_newsletter_type_id IS NOT NULL
        AND (OLD.color IS DISTINCT FROM NEW.color OR OLD.color_dark IS DISTINCT FROM NEW.color_dark)
      THEN
        UPDATE newsletter_types
          SET color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_newsletter_type_id;
      END IF;
    END IF;

  -- ── newsletter_types side ──
  ELSIF TG_TABLE_NAME = 'newsletter_types' THEN

    IF TG_OP = 'INSERT' THEN
      IF NEW.linked_tag_id IS NOT NULL THEN
        SELECT site_id INTO v_other_site_id
          FROM blog_tags WHERE id = NEW.linked_tag_id;
        IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
          RAISE EXCEPTION 'cross-site link forbidden'
            USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
        END IF;

        UPDATE blog_tags
          SET linked_newsletter_type_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_tag_id;
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.linked_tag_id IS DISTINCT FROM NEW.linked_tag_id THEN

        IF OLD.linked_tag_id IS NOT NULL THEN
          UPDATE blog_tags SET linked_newsletter_type_id = NULL
            WHERE id = OLD.linked_tag_id;
        END IF;

        IF NEW.linked_tag_id IS NOT NULL THEN
          SELECT site_id INTO v_other_site_id
            FROM blog_tags WHERE id = NEW.linked_tag_id;
          IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
            RAISE EXCEPTION 'cross-site link forbidden'
              USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
          END IF;

          UPDATE blog_tags
            SET linked_newsletter_type_id = NEW.id, color = NEW.color, color_dark = NEW.color_dark
            WHERE id = NEW.linked_tag_id;
        END IF;

      ELSIF NEW.linked_tag_id IS NOT NULL
        AND (OLD.color IS DISTINCT FROM NEW.color OR OLD.color_dark IS DISTINCT FROM NEW.color_dark)
      THEN
        UPDATE blog_tags
          SET color = NEW.color, color_dark = NEW.color_dark
          WHERE id = NEW.linked_tag_id;
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."tg_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_before jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_org_id uuid;
  v_site_id uuid;
  v_resource_id uuid;
  v_ip inet;
  v_ua text;
  v_ip_raw text;
BEGIN
  -- Sprint 5a: skip during LGPD phase 1 cascade ops
  IF COALESCE(current_setting('app.skip_cascade_audit', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_resource_id := COALESCE((NEW).id, (OLD).id);

  IF TG_TABLE_NAME = 'organization_members' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME = 'site_memberships' THEN
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
    SELECT org_id INTO v_org_id FROM sites WHERE id = v_site_id;
  ELSIF TG_TABLE_NAME = 'invitations' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
  END IF;

  v_ip_raw := nullif(current_setting('app.client_ip', true), '');
  IF v_ip_raw IS NOT NULL THEN
    BEGIN v_ip := v_ip_raw::inet;
    EXCEPTION WHEN invalid_text_representation THEN v_ip := NULL;
    END;
  END IF;
  IF v_ip IS NULL THEN v_ip := inet_client_addr(); END IF;
  v_ua := nullif(current_setting('app.user_agent', true), '');

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data, ip, user_agent)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_resource_id, v_org_id, v_site_id, v_before, v_after, v_ip, v_ua);
  RETURN COALESCE(NEW, OLD);
END $$;;


CREATE OR REPLACE FUNCTION "public"."tg_campaigns_scheduled_for_future"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.status = 'scheduled' and new.scheduled_for is not null and new.scheduled_for < now() then
    raise exception 'campaigns.scheduled_for must be in the future when status=scheduled (got %)',
      new.scheduled_for
      using errcode = '22023';
  end if;
  return new;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."unpin_weekly_pick"("p_channel_id" "uuid", "p_site_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update youtube_videos
     set pinned_until = null,
         updated_at = now()
   where channel_id = p_channel_id
     and site_id = p_site_id
     and pinned_until is not null;
end;
$$;;


CREATE OR REPLACE FUNCTION "public"."unsubscribe_via_token"("p_token_hash" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare v_tok record; v_sub record; v_email_hash text;
begin
  select token_hash, site_id, email, used_at into v_tok
  from public.unsubscribe_tokens where token_hash = p_token_hash for update;

  if v_tok.token_hash is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_tok.used_at is not null then
    return json_build_object('ok', true, 'already', true, 'site_id', v_tok.site_id);
  end if;

  select id, status, email into v_sub from public.newsletter_subscriptions
  where site_id = v_tok.site_id and email = v_tok.email for update;

  if v_sub.id is not null and v_sub.status <> 'unsubscribed' then
    v_email_hash := encode(sha256(v_sub.email::bytea), 'hex');
    update public.newsletter_subscriptions
    set status = 'unsubscribed',
        unsubscribed_at = now(),
        email = v_email_hash,
        ip = null,
        user_agent = null,
        locale = null
    where id = v_sub.id;
  end if;

  update public.unsubscribe_tokens set used_at = now() where token_hash = p_token_hash;

  return json_build_object('ok', true, 'site_id', v_tok.site_id, 'sub_id', v_sub.id);
end $$;;


CREATE OR REPLACE FUNCTION "public"."update_campaign_atomic"("p_campaign_id" "uuid", "p_patch" "jsonb" DEFAULT '{}'::"jsonb", "p_translations" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_campaign record;
  v_result jsonb;
  v_key text;
  v_allowed_keys text[] := ARRAY[
    'interest', 'status', 'pdf_storage_path',
    'form_fields', 'scheduled_for', 'published_at',
    'owner_user_id'
  ];
  v_set_parts text[] := '{}';
  v_trans jsonb;
  v_trans_allowed text[] := ARRAY[
    'locale','slug','meta_title','meta_description',
    'content_mdx','content_compiled','cover_image_url',
    'pdf_storage_path','seo_extras'
  ];
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key = ANY(v_allowed_keys) THEN
      v_set_parts := array_append(v_set_parts,
        format('%I = %L', v_key, p_patch->>v_key));
    END IF;
  END LOOP;

  IF array_length(v_set_parts, 1) > 0 THEN
    EXECUTE format(
      'UPDATE campaigns SET %s, updated_at = now() WHERE id = %L',
      array_to_string(v_set_parts, ', '), p_campaign_id
    );
  END IF;

  FOR v_trans IN SELECT * FROM jsonb_array_elements(p_translations)
  LOOP
    INSERT INTO campaign_translations (campaign_id, locale, slug, meta_title, meta_description,
      content_mdx, content_compiled, cover_image_url, pdf_storage_path, seo_extras)
    VALUES (
      p_campaign_id,
      v_trans->>'locale',
      v_trans->>'slug',
      v_trans->>'meta_title',
      v_trans->>'meta_description',
      v_trans->>'content_mdx',
      v_trans->>'content_compiled',
      v_trans->>'cover_image_url',
      v_trans->>'pdf_storage_path',
      CASE WHEN v_trans ? 'seo_extras' THEN v_trans->'seo_extras' ELSE NULL END
    )
    ON CONFLICT (campaign_id, locale) DO UPDATE SET
      slug = EXCLUDED.slug,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      content_mdx = EXCLUDED.content_mdx,
      content_compiled = EXCLUDED.content_compiled,
      cover_image_url = EXCLUDED.cover_image_url,
      pdf_storage_path = EXCLUDED.pdf_storage_path,
      seo_extras = COALESCE(EXCLUDED.seo_extras, campaign_translations.seo_extras);
  END LOOP;

  SELECT row_to_json(c.*) INTO v_result FROM campaigns c WHERE c.id = p_campaign_id;
  RETURN jsonb_build_object('ok', true, 'campaign', v_result);
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."update_tracked_links_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;;


CREATE OR REPLACE FUNCTION "public"."user_accessible_sites"() RETURNS TABLE("site_id" "uuid", "site_name" "text", "site_slug" "text", "primary_domain" "text", "org_id" "uuid", "org_name" "text", "user_role" "text", "is_master_ring" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id, s.name, s.slug, s.primary_domain, s.org_id, o.name,
    CASE
      WHEN public.is_super_admin() THEN 'super_admin'
      WHEN public.is_org_admin(s.org_id) THEN 'org_admin'
      ELSE (SELECT role FROM site_memberships WHERE site_id = s.id AND user_id = auth.uid())
    END AS user_role,
    (o.parent_org_id IS NULL) AS is_master_ring
  FROM sites s JOIN organizations o ON o.id = s.org_id
  WHERE public.can_view_site(s.id)
  ORDER BY (CASE WHEN o.parent_org_id IS NULL THEN 0 ELSE 1 END), o.name, s.name;
$$;;


CREATE OR REPLACE FUNCTION "public"."user_exists_by_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists(select 1 from auth.users where email = p_email);
$$;;


CREATE OR REPLACE FUNCTION "public"."user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role',
    'anon'
  )
$$;;


CREATE OR REPLACE FUNCTION "public"."validate_campaign_translation_slug_unique_per_site"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_site_id uuid;
  v_conflict int;
begin
  select site_id into v_site_id from public.campaigns where id = new.campaign_id;

  select 1 into v_conflict
  from public.campaign_translations ct
  join public.campaigns c on c.id = ct.campaign_id
  where ct.locale = new.locale
    and ct.slug = new.slug
    and ct.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and c.site_id is not distinct from v_site_id
  limit 1;

  if v_conflict is not null then
    raise exception 'duplicate slug % for locale % on site %', new.slug, new.locale, v_site_id
      using errcode = '23505';
  end if;

  return new;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."validate_submission_consent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.consent_marketing is not true then
    raise exception 'consent_marketing must be true (LGPD)'
      using errcode = 'check_violation';
  end if;
  if new.consent_text_version is null or length(new.consent_text_version) = 0 then
    raise exception 'consent_text_version is required';
  end if;
  return new;
end
$$;;


CREATE OR REPLACE FUNCTION "public"."validate_translation_slug_unique_per_site"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_site_id uuid;
  v_conflict int;
begin
  select site_id into v_site_id from public.blog_posts where id = new.post_id;

  select 1 into v_conflict
  from public.blog_translations bt
  join public.blog_posts bp on bp.id = bt.post_id
  where bt.locale = new.locale
    and bt.slug = new.slug
    and bt.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and bp.site_id is not distinct from v_site_id
  limit 1;

  if v_conflict is not null then
    raise exception 'duplicate slug % for locale % on site %', new.slug, new.locale, v_site_id
      using errcode = '23505';
  end if;

  return new;
end
$$;;


-- Indexes



CREATE INDEX "audit_log_actor" ON "public"."audit_log" USING "btree" ("actor_user_id", "created_at" DESC);




CREATE INDEX "audit_log_org_created" ON "public"."audit_log" USING "btree" ("org_id", "created_at" DESC);




CREATE INDEX "audit_log_site_created" ON "public"."audit_log" USING "btree" ("site_id", "created_at" DESC);




CREATE UNIQUE INDEX "authors_one_default_per_site" ON "public"."authors" USING "btree" ("site_id") WHERE ("is_default" = true);




CREATE INDEX "authors_user_id_idx" ON "public"."authors" USING "btree" ("user_id");




CREATE INDEX "blog_posts_is_featured_idx" ON "public"."blog_posts" USING "btree" ("site_id", "is_featured") WHERE ("is_featured" = true);




CREATE UNIQUE INDEX "blog_posts_link_group_locale" ON "public"."blog_posts" USING "btree" ("link_group_id", "locale") WHERE ("link_group_id" IS NOT NULL);




CREATE INDEX "blog_posts_previous_post_idx" ON "public"."blog_posts" USING "btree" ("previous_post_id") WHERE ("previous_post_id" IS NOT NULL);




CREATE INDEX "blog_posts_scheduled_idx" ON "public"."blog_posts" USING "btree" ("status", "scheduled_for") WHERE ("status" = 'scheduled'::"public"."post_status");




CREATE INDEX "blog_posts_site_status_idx" ON "public"."blog_posts" USING "btree" ("site_id", "status");




CREATE INDEX "blog_posts_status_published_at_idx" ON "public"."blog_posts" USING "btree" ("status", "published_at" DESC);




CREATE INDEX "blog_posts_tag_id_idx" ON "public"."blog_posts" USING "btree" ("tag_id");




CREATE UNIQUE INDEX "blog_tags_linked_nl_unique" ON "public"."blog_tags" USING "btree" ("linked_newsletter_type_id") WHERE ("linked_newsletter_type_id" IS NOT NULL);




CREATE INDEX "blog_translations_locale_slug_idx" ON "public"."blog_translations" USING "btree" ("locale", "slug");




CREATE UNIQUE INDEX "blog_translations_post_locale_uniq" ON "public"."blog_translations" USING "btree" ("post_id", "locale");




CREATE INDEX "blog_translations_title_trgm" ON "public"."blog_translations" USING "gin" ("title" "public"."gin_trgm_ops");




CREATE UNIQUE INDEX "campaign_submissions_email_unique" ON "public"."campaign_submissions" USING "btree" ("campaign_id", "email") WHERE ("anonymized_at" IS NULL);




CREATE UNIQUE INDEX "campaign_translations_campaign_id_locale_idx" ON "public"."campaign_translations" USING "btree" ("campaign_id", "locale");




CREATE UNIQUE INDEX "campaigns_link_group_locale" ON "public"."campaigns" USING "btree" ("link_group_id", "locale") WHERE ("link_group_id" IS NOT NULL);




CREATE INDEX "campaigns_status_published_at_idx" ON "public"."campaigns" USING "btree" ("status", "published_at" DESC);




CREATE INDEX "campaigns_status_scheduled_for_idx" ON "public"."campaigns" USING "btree" ("status", "scheduled_for") WHERE ("status" = 'scheduled'::"public"."post_status");




CREATE UNIQUE INDEX "consents_anon_current" ON "public"."consents" USING "btree" ("anonymous_id", "category", "site_id") WHERE (("anonymous_id" IS NOT NULL) AND ("withdrawn_at" IS NULL));




CREATE INDEX "consents_anon_lookup" ON "public"."consents" USING "btree" ("anonymous_id") WHERE ("anonymous_id" IS NOT NULL);




CREATE UNIQUE INDEX "consents_auth_current" ON "public"."consents" USING "btree" ("user_id", "category", "site_id") WHERE (("user_id" IS NOT NULL) AND ("withdrawn_at" IS NULL));




CREATE INDEX "consents_user_lookup" ON "public"."consents" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);




CREATE INDEX "contact_submissions_email_idx" ON "public"."contact_submissions" USING "btree" ("email");




CREATE INDEX "contact_submissions_pending_anonymize" ON "public"."contact_submissions" USING "btree" ("site_id", "submitted_at" DESC) WHERE ("anonymized_at" IS NULL);




CREATE INDEX "contact_submissions_site_id_submitted_at_idx" ON "public"."contact_submissions" USING "btree" ("site_id", "submitted_at" DESC);




CREATE INDEX "cron_runs_job_ran_at_idx" ON "public"."cron_runs" USING "btree" ("job", "ran_at" DESC);




CREATE INDEX "idx_ad_campaigns_app_id" ON "public"."ad_campaigns" USING "btree" ("app_id");




CREATE INDEX "idx_ad_campaigns_status" ON "public"."ad_campaigns" USING "btree" ("status");




CREATE INDEX "idx_ad_campaigns_target_categories" ON "public"."ad_campaigns" USING "gin" ("target_categories");




CREATE INDEX "idx_ad_events_created_at" ON "public"."ad_events" USING "btree" ("created_at");




CREATE INDEX "idx_ad_events_event_type" ON "public"."ad_events" USING "btree" ("event_type");




CREATE INDEX "idx_ad_events_site_id_created" ON "public"."ad_events" USING "btree" ("site_id", "created_at" DESC);




CREATE INDEX "idx_ad_events_site_slot" ON "public"."ad_events" USING "btree" ("site_id", "slot_id", "event_type", "created_at" DESC);




CREATE INDEX "idx_ad_events_user_hash" ON "public"."ad_events" USING "btree" ("user_hash");




CREATE INDEX "idx_ad_inquiries_app_id" ON "public"."ad_inquiries" USING "btree" ("app_id");




CREATE INDEX "idx_ad_inquiries_status" ON "public"."ad_inquiries" USING "btree" ("app_id", "status");




CREATE INDEX "idx_ad_inquiries_submitted" ON "public"."ad_inquiries" USING "btree" ("app_id", "submitted_at" DESC);




CREATE INDEX "idx_ad_media_app_id" ON "public"."ad_media" USING "btree" ("app_id");




CREATE INDEX "idx_ad_placeholders_app_id" ON "public"."ad_placeholders" USING "btree" ("app_id");




CREATE INDEX "idx_ad_revenue_daily_site_date" ON "public"."ad_revenue_daily" USING "btree" ("site_id", "date" DESC);




CREATE INDEX "idx_ad_revenue_daily_source" ON "public"."ad_revenue_daily" USING "btree" ("site_id", "source", "date" DESC);




CREATE INDEX "idx_ad_slot_config_site" ON "public"."ad_slot_config" USING "btree" ("site_id");




CREATE INDEX "idx_ad_slot_creatives_campaign" ON "public"."ad_slot_creatives" USING "btree" ("campaign_id");




CREATE INDEX "idx_ad_slot_metrics_campaign" ON "public"."ad_slot_metrics" USING "btree" ("campaign_id", "date");




CREATE INDEX "idx_blog_posts_view_count" ON "public"."blog_posts" USING "btree" ("view_count" DESC) WHERE ("status" = 'published'::"public"."post_status");




CREATE INDEX "idx_content_events_anon" ON "public"."content_events" USING "btree" ("anonymous_id", "resource_id");




CREATE INDEX "idx_content_events_resource" ON "public"."content_events" USING "btree" ("resource_type", "resource_id", "created_at");




CREATE INDEX "idx_content_events_site_date" ON "public"."content_events" USING "btree" ("site_id", "created_at");




CREATE INDEX "idx_content_metrics_resource" ON "public"."content_metrics" USING "btree" ("resource_type", "resource_id", "date");




CREATE INDEX "idx_content_metrics_site" ON "public"."content_metrics" USING "btree" ("site_id", "date");




CREATE INDEX "idx_curated_comments_locale" ON "public"."youtube_curated_comments" USING "btree" ("site_id", "target_locale");




CREATE INDEX "idx_link_alerts_active" ON "public"."link_alerts" USING "btree" ("link_id", "created_at") WHERE ("active" = true);




CREATE INDEX "idx_link_annotations_range" ON "public"."link_annotations" USING "btree" ("link_id", "annotated_at" DESC);




CREATE INDEX "idx_link_clicks_conversion" ON ONLY "public"."link_clicks" USING "btree" ("link_id", "converted_at") WHERE ("converted_at" IS NOT NULL);




CREATE INDEX "idx_link_clicks_link_time" ON ONLY "public"."link_clicks" USING "btree" ("link_id", "clicked_at" DESC);




CREATE INDEX "idx_link_clicks_referrer" ON ONLY "public"."link_clicks" USING "btree" ("link_id", "referrer_domain") WHERE ("referrer_domain" IS NOT NULL);




CREATE INDEX "idx_link_clicks_site_time" ON ONLY "public"."link_clicks" USING "btree" ("site_id", "clicked_at" DESC);




CREATE INDEX "idx_link_clicks_visitor_dedup" ON ONLY "public"."link_clicks" USING "btree" ("link_id", "visitor_id", "clicked_at") WHERE ("visitor_id" IS NOT NULL);




CREATE INDEX "idx_link_daily_metrics_link_range" ON "public"."link_daily_metrics" USING "btree" ("link_id", "date" DESC);




CREATE INDEX "idx_link_daily_metrics_site_date" ON "public"."link_daily_metrics" USING "btree" ("site_id", "date" DESC);




CREATE INDEX "idx_link_goals_pending" ON "public"."link_goals" USING "btree" ("link_id", "deadline") WHERE ("reached_at" IS NULL);




CREATE INDEX "idx_newsletter_sends_link_id" ON "public"."newsletter_sends" USING "btree" ("link_id") WHERE ("link_id" IS NOT NULL);




CREATE INDEX "idx_sync_log_recent" ON "public"."youtube_sync_log" USING "btree" ("site_id", "created_at" DESC);




CREATE INDEX "idx_tracked_links_active" ON "public"."tracked_links" USING "btree" ("site_id", "created_at" DESC) WHERE (("active" = true) AND ("deleted_at" IS NULL));




CREATE INDEX "idx_tracked_links_code_lookup" ON "public"."tracked_links" USING "btree" ("site_id", "code") WHERE ("deleted_at" IS NULL);




CREATE INDEX "idx_tracked_links_slug_lookup" ON "public"."tracked_links" USING "btree" ("site_id", "slug") WHERE (("slug" IS NOT NULL) AND ("deleted_at" IS NULL));




CREATE INDEX "idx_tracked_links_source" ON "public"."tracked_links" USING "btree" ("site_id", "source_type", "source_id") WHERE ("source_id" IS NOT NULL);




CREATE INDEX "idx_tracked_links_tags" ON "public"."tracked_links" USING "gin" ("tags") WHERE ("deleted_at" IS NULL);




CREATE INDEX "idx_user_app_presence_hash" ON "public"."user_app_presence" USING "btree" ("email_hash");




CREATE INDEX "idx_youtube_videos_category" ON "public"."youtube_videos" USING "btree" ("category_id");




CREATE INDEX "idx_youtube_videos_channel" ON "public"."youtube_videos" USING "btree" ("channel_id");




CREATE INDEX "idx_youtube_videos_featured" ON "public"."youtube_videos" USING "btree" ("site_id", "is_featured") WHERE ("is_featured" = true);




CREATE INDEX "idx_youtube_videos_pinned" ON "public"."youtube_videos" USING "btree" ("site_id", "pinned_until" DESC) WHERE ("pinned_until" IS NOT NULL);




CREATE INDEX "idx_youtube_videos_published" ON "public"."youtube_videos" USING "btree" ("site_id", "published_at" DESC);




CREATE INDEX "invitations_invited_by_recent_idx" ON "public"."invitations" USING "btree" ("invited_by", "created_at" DESC);




CREATE INDEX "invitations_org_id_accepted_at_idx" ON "public"."invitations" USING "btree" ("org_id", "accepted_at") WHERE ("accepted_at" IS NULL);




CREATE UNIQUE INDEX "invitations_pending_unique" ON "public"."invitations" USING "btree" ("org_id", "email") WHERE (("accepted_at" IS NULL) AND ("revoked_at" IS NULL));




CREATE UNIQUE INDEX "invitations_token_unique" ON "public"."invitations" USING "btree" ("token");




CREATE INDEX "lgpd_requests_blob_cleanup" ON "public"."lgpd_requests" USING "btree" ("blob_uploaded_at") WHERE (("blob_deleted_at" IS NULL) AND ("blob_path" IS NOT NULL));




CREATE UNIQUE INDEX "lgpd_requests_one_pending" ON "public"."lgpd_requests" USING "btree" ("user_id", "type") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));




CREATE INDEX "lgpd_requests_scheduled_purge" ON "public"."lgpd_requests" USING "btree" ("scheduled_purge_at") WHERE ("status" = 'processing'::"text");




CREATE INDEX "link_clicks_2026_05_link_id_clicked_at_idx" ON "public"."link_clicks_2026_05" USING "btree" ("link_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_2026_05_link_id_converted_at_idx" ON "public"."link_clicks_2026_05" USING "btree" ("link_id", "converted_at") WHERE ("converted_at" IS NOT NULL);




CREATE INDEX "link_clicks_2026_05_link_id_referrer_domain_idx" ON "public"."link_clicks_2026_05" USING "btree" ("link_id", "referrer_domain") WHERE ("referrer_domain" IS NOT NULL);




CREATE INDEX "link_clicks_2026_05_link_id_visitor_id_clicked_at_idx" ON "public"."link_clicks_2026_05" USING "btree" ("link_id", "visitor_id", "clicked_at") WHERE ("visitor_id" IS NOT NULL);




CREATE INDEX "link_clicks_2026_05_site_id_clicked_at_idx" ON "public"."link_clicks_2026_05" USING "btree" ("site_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_2026_06_link_id_clicked_at_idx" ON "public"."link_clicks_2026_06" USING "btree" ("link_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_2026_06_link_id_converted_at_idx" ON "public"."link_clicks_2026_06" USING "btree" ("link_id", "converted_at") WHERE ("converted_at" IS NOT NULL);




CREATE INDEX "link_clicks_2026_06_link_id_referrer_domain_idx" ON "public"."link_clicks_2026_06" USING "btree" ("link_id", "referrer_domain") WHERE ("referrer_domain" IS NOT NULL);




CREATE INDEX "link_clicks_2026_06_link_id_visitor_id_clicked_at_idx" ON "public"."link_clicks_2026_06" USING "btree" ("link_id", "visitor_id", "clicked_at") WHERE ("visitor_id" IS NOT NULL);




CREATE INDEX "link_clicks_2026_06_site_id_clicked_at_idx" ON "public"."link_clicks_2026_06" USING "btree" ("site_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_2026_07_link_id_clicked_at_idx" ON "public"."link_clicks_2026_07" USING "btree" ("link_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_2026_07_link_id_converted_at_idx" ON "public"."link_clicks_2026_07" USING "btree" ("link_id", "converted_at") WHERE ("converted_at" IS NOT NULL);




CREATE INDEX "link_clicks_2026_07_link_id_referrer_domain_idx" ON "public"."link_clicks_2026_07" USING "btree" ("link_id", "referrer_domain") WHERE ("referrer_domain" IS NOT NULL);




CREATE INDEX "link_clicks_2026_07_link_id_visitor_id_clicked_at_idx" ON "public"."link_clicks_2026_07" USING "btree" ("link_id", "visitor_id", "clicked_at") WHERE ("visitor_id" IS NOT NULL);




CREATE INDEX "link_clicks_2026_07_site_id_clicked_at_idx" ON "public"."link_clicks_2026_07" USING "btree" ("site_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_default_link_id_clicked_at_idx" ON "public"."link_clicks_default" USING "btree" ("link_id", "clicked_at" DESC);




CREATE INDEX "link_clicks_default_link_id_converted_at_idx" ON "public"."link_clicks_default" USING "btree" ("link_id", "converted_at") WHERE ("converted_at" IS NOT NULL);




CREATE INDEX "link_clicks_default_link_id_referrer_domain_idx" ON "public"."link_clicks_default" USING "btree" ("link_id", "referrer_domain") WHERE ("referrer_domain" IS NOT NULL);




CREATE INDEX "link_clicks_default_link_id_visitor_id_clicked_at_idx" ON "public"."link_clicks_default" USING "btree" ("link_id", "visitor_id", "clicked_at") WHERE ("visitor_id" IS NOT NULL);




CREATE INDEX "link_clicks_default_site_id_clicked_at_idx" ON "public"."link_clicks_default" USING "btree" ("site_id", "clicked_at" DESC);




CREATE UNIQUE INDEX "newsletter_editions_cadence_slot_unique" ON "public"."newsletter_editions" USING "btree" ("newsletter_type_id", "slot_date") WHERE (("edition_kind" = 'cadence'::"text") AND ("status" <> ALL (ARRAY['cancelled'::"text", 'archived'::"text"])));




CREATE INDEX "newsletter_editions_scheduled" ON "public"."newsletter_editions" USING "btree" ("status", "scheduled_at") WHERE ("status" = 'scheduled'::"text");




CREATE INDEX "newsletter_editions_site_type_status" ON "public"."newsletter_editions" USING "btree" ("site_id", "newsletter_type_id", "status");




CREATE INDEX "newsletter_editions_slot" ON "public"."newsletter_editions" USING "btree" ("newsletter_type_id", "slot_date") WHERE ("slot_date" IS NOT NULL);




CREATE INDEX "newsletter_pending_token_hash" ON "public"."newsletter_subscriptions" USING "btree" ("confirmation_token_hash") WHERE (("status" = 'pending_confirmation'::"text") AND ("confirmation_token_hash" IS NOT NULL));




CREATE INDEX "newsletter_pending_welcome" ON "public"."newsletter_subscriptions" USING "btree" ("site_id") WHERE (("status" = 'confirmed'::"text") AND ("welcome_sent" = false));




CREATE INDEX "newsletter_sends_edition_status" ON "public"."newsletter_sends" USING "btree" ("edition_id", "status");




CREATE UNIQUE INDEX "newsletter_sends_provider_msg" ON "public"."newsletter_sends" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);




CREATE UNIQUE INDEX "newsletter_subscriptions_site_email_type" ON "public"."newsletter_subscriptions" USING "btree" ("site_id", "email", "newsletter_id") WHERE ("status" <> 'unsubscribed'::"text");




CREATE INDEX "newsletter_subscriptions_site_id_status_idx" ON "public"."newsletter_subscriptions" USING "btree" ("site_id", "status");




CREATE UNIQUE INDEX "newsletter_types_linked_tag_unique" ON "public"."newsletter_types" USING "btree" ("linked_tag_id") WHERE ("linked_tag_id" IS NOT NULL);




CREATE INDEX "organization_members_user_id_idx" ON "public"."organization_members" USING "btree" ("user_id");




CREATE INDEX "organizations_parent_org_id_idx" ON "public"."organizations" USING "btree" ("parent_org_id") WHERE ("parent_org_id" IS NOT NULL);




CREATE UNIQUE INDEX "organizations_single_master" ON "public"."organizations" USING "btree" ((("parent_org_id" IS NULL))) WHERE ("parent_org_id" IS NULL);




CREATE INDEX "password_reset_attempts_email_recent_idx" ON "public"."password_reset_attempts" USING "btree" ("email", "attempted_at" DESC);




CREATE INDEX "post_hashtags_hashtag_idx" ON "public"."post_hashtags" USING "btree" ("hashtag_id");




CREATE UNIQUE INDEX "sent_emails_admin_alert_unique" ON "public"."sent_emails" USING "btree" ("site_id", "template_name", (("metadata" ->> 'submission_id'::"text"))) WHERE ("template_name" = 'contact-admin-alert'::"text");




CREATE UNIQUE INDEX "sent_emails_contact_autoreply_daily" ON "public"."sent_emails" USING "btree" ("site_id", "to_email", "template_name", ((("sent_at" AT TIME ZONE 'UTC'::"text"))::"date")) WHERE ("template_name" = 'contact-received'::"text");




CREATE INDEX "sent_emails_provider_message_id_idx" ON "public"."sent_emails" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);




CREATE INDEX "sent_emails_site_id_template_name_sent_at_idx" ON "public"."sent_emails" USING "btree" ("site_id", "template_name", "sent_at" DESC);




CREATE INDEX "sent_emails_to_email_sent_at_idx" ON "public"."sent_emails" USING "btree" ("to_email", "sent_at" DESC);




CREATE UNIQUE INDEX "sent_emails_welcome_unique" ON "public"."sent_emails" USING "btree" ("site_id", "to_email") WHERE ("template_name" = 'welcome'::"text");




CREATE INDEX "site_memberships_site" ON "public"."site_memberships" USING "btree" ("site_id");




CREATE INDEX "site_memberships_user" ON "public"."site_memberships" USING "btree" ("user_id");




CREATE INDEX "sites_domains_idx" ON "public"."sites" USING "gin" ("domains");




CREATE INDEX "sites_org_id_idx" ON "public"."sites" USING "btree" ("org_id");




CREATE INDEX "unsubscribe_tokens_email_idx" ON "public"."unsubscribe_tokens" USING "btree" ("email");




CREATE UNIQUE INDEX "youtube_videos_pinned_per_channel" ON "public"."youtube_videos" USING "btree" ("channel_id") WHERE ("pinned_until" IS NOT NULL);




ALTER INDEX "public"."idx_link_clicks_link_time" ATTACH PARTITION "public"."link_clicks_2026_05_link_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_conversion" ATTACH PARTITION "public"."link_clicks_2026_05_link_id_converted_at_idx";




ALTER INDEX "public"."idx_link_clicks_referrer" ATTACH PARTITION "public"."link_clicks_2026_05_link_id_referrer_domain_idx";




ALTER INDEX "public"."idx_link_clicks_visitor_dedup" ATTACH PARTITION "public"."link_clicks_2026_05_link_id_visitor_id_clicked_at_idx";




ALTER INDEX "public"."link_clicks_pkey" ATTACH PARTITION "public"."link_clicks_2026_05_pkey";




ALTER INDEX "public"."idx_link_clicks_site_time" ATTACH PARTITION "public"."link_clicks_2026_05_site_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_link_time" ATTACH PARTITION "public"."link_clicks_2026_06_link_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_conversion" ATTACH PARTITION "public"."link_clicks_2026_06_link_id_converted_at_idx";




ALTER INDEX "public"."idx_link_clicks_referrer" ATTACH PARTITION "public"."link_clicks_2026_06_link_id_referrer_domain_idx";




ALTER INDEX "public"."idx_link_clicks_visitor_dedup" ATTACH PARTITION "public"."link_clicks_2026_06_link_id_visitor_id_clicked_at_idx";




ALTER INDEX "public"."link_clicks_pkey" ATTACH PARTITION "public"."link_clicks_2026_06_pkey";




ALTER INDEX "public"."idx_link_clicks_site_time" ATTACH PARTITION "public"."link_clicks_2026_06_site_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_link_time" ATTACH PARTITION "public"."link_clicks_2026_07_link_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_conversion" ATTACH PARTITION "public"."link_clicks_2026_07_link_id_converted_at_idx";




ALTER INDEX "public"."idx_link_clicks_referrer" ATTACH PARTITION "public"."link_clicks_2026_07_link_id_referrer_domain_idx";




ALTER INDEX "public"."idx_link_clicks_visitor_dedup" ATTACH PARTITION "public"."link_clicks_2026_07_link_id_visitor_id_clicked_at_idx";




ALTER INDEX "public"."link_clicks_pkey" ATTACH PARTITION "public"."link_clicks_2026_07_pkey";




ALTER INDEX "public"."idx_link_clicks_site_time" ATTACH PARTITION "public"."link_clicks_2026_07_site_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_link_time" ATTACH PARTITION "public"."link_clicks_default_link_id_clicked_at_idx";




ALTER INDEX "public"."idx_link_clicks_conversion" ATTACH PARTITION "public"."link_clicks_default_link_id_converted_at_idx";




ALTER INDEX "public"."idx_link_clicks_referrer" ATTACH PARTITION "public"."link_clicks_default_link_id_referrer_domain_idx";




ALTER INDEX "public"."idx_link_clicks_visitor_dedup" ATTACH PARTITION "public"."link_clicks_default_link_id_visitor_id_clicked_at_idx";




ALTER INDEX "public"."link_clicks_pkey" ATTACH PARTITION "public"."link_clicks_default_pkey";




ALTER INDEX "public"."idx_link_clicks_site_time" ATTACH PARTITION "public"."link_clicks_default_site_id_clicked_at_idx";


-- Row Level Security policies



CREATE POLICY "_deny_all" ON "public"."password_reset_attempts" USING (false) WITH CHECK (false);




CREATE POLICY "_deny_all" ON "public"."unsubscribe_tokens" USING (false) WITH CHECK (false);




CREATE POLICY "about_tx_public_read" ON "public"."author_about_translations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."authors" "a"
  WHERE (("a"."id" = "author_about_translations"."author_id") AND "public"."site_visible"("a"."site_id")))));




CREATE POLICY "about_tx_staff_write" ON "public"."author_about_translations" USING ((EXISTS ( SELECT 1
   FROM "public"."authors" "a"
  WHERE (("a"."id" = "author_about_translations"."author_id") AND "public"."can_edit_site"("a"."site_id")))));



CREATE POLICY "ad_campaigns_select_auth" ON "public"."ad_campaigns" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ad_events_all_service_role" ON "public"."ad_events" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "ad_events_insert_authenticated" ON "public"."ad_events" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "ad_inquiries_insert_anon" ON "public"."ad_inquiries" FOR INSERT TO "anon" WITH CHECK (true);




CREATE POLICY "ad_inquiries_insert_auth" ON "public"."ad_inquiries" FOR INSERT TO "authenticated" WITH CHECK (true);




CREATE POLICY "ad_inquiries_select_auth" ON "public"."ad_inquiries" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ad_media_select_auth" ON "public"."ad_media" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ad_placeholders_all_service_role" ON "public"."ad_placeholders" TO "service_role" USING (true);




CREATE POLICY "ad_placeholders_select_authenticated" ON "public"."ad_placeholders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ad_revenue_daily_all_service_role" ON "public"."ad_revenue_daily" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "ad_revenue_daily_select_auth" ON "public"."ad_revenue_daily" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ad_slot_config_all_service_role" ON "public"."ad_slot_config" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "ad_slot_config_select_anon" ON "public"."ad_slot_config" FOR SELECT TO "anon" USING (true);




CREATE POLICY "ad_slot_config_select_auth" ON "public"."ad_slot_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "ad_slot_creatives_select_auth" ON "public"."ad_slot_creatives" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "audit_log_read" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR (("org_id" IS NOT NULL) AND "public"."is_org_admin"("org_id"))));




CREATE POLICY "audit_log_self_as_actor" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("actor_user_id" = "auth"."uid"()));




CREATE POLICY "audit_log_self_lifecycle_target" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((("resource_type" = 'auth_user'::"text") AND ("resource_id" = "auth"."uid"())));



CREATE POLICY "authors_public_read" ON "public"."authors" FOR SELECT USING (true);




CREATE POLICY "authors_staff_write" ON "public"."authors" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "blog_cadence_staff_rw" ON "public"."blog_cadence" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "blog_posts_delete" ON "public"."blog_posts" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_org_admin"(( SELECT "sites"."org_id"
   FROM "public"."sites"
  WHERE ("sites"."id" = "blog_posts"."site_id"))) OR ("public"."can_edit_site"("site_id") AND ("status" <> 'published'::"public"."post_status")) OR (("owner_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."post_status", 'pending_review'::"public"."post_status"])))));




CREATE POLICY "blog_posts_insert" ON "public"."blog_posts" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_edit_site"("site_id") OR (("owner_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."site_memberships"
  WHERE (("site_memberships"."site_id" = "blog_posts"."site_id") AND ("site_memberships"."user_id" = "auth"."uid"()) AND ("site_memberships"."role" = 'reporter'::"text")))) AND ("status" = ANY (ARRAY['draft'::"public"."post_status", 'pending_review'::"public"."post_status"])))));




CREATE POLICY "blog_posts_public_read_published" ON "public"."blog_posts" FOR SELECT USING ((("status" = 'published'::"public"."post_status") AND ("published_at" IS NOT NULL) AND ("published_at" <= "now"()) AND "public"."site_visible"("site_id")));




CREATE POLICY "blog_posts_select" ON "public"."blog_posts" FOR SELECT TO "authenticated" USING (("public"."can_edit_site"("site_id") OR (("owner_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."site_memberships"
  WHERE (("site_memberships"."site_id" = "blog_posts"."site_id") AND ("site_memberships"."user_id" = "auth"."uid"()) AND ("site_memberships"."role" = 'reporter'::"text"))))) OR (("status" = 'published'::"public"."post_status") AND "public"."site_visible"("site_id"))));




CREATE POLICY "blog_posts_update" ON "public"."blog_posts" FOR UPDATE TO "authenticated" USING (("public"."can_edit_site"("site_id") OR (("owner_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."post_status", 'pending_review'::"public"."post_status"]))))) WITH CHECK (("public"."can_edit_site"("site_id") OR (("owner_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"public"."post_status", 'pending_review'::"public"."post_status"])))));



CREATE POLICY "blog_tags_public_read" ON "public"."blog_tags" FOR SELECT USING ("public"."site_visible"("site_id"));




CREATE POLICY "blog_tags_staff_all" ON "public"."blog_tags" USING ("public"."can_edit_site"("site_id"));



CREATE POLICY "blog_translations_public_read" ON "public"."blog_translations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."blog_posts" "p"
  WHERE (("p"."id" = "blog_translations"."post_id") AND ("p"."status" = 'published'::"public"."post_status") AND ("p"."published_at" IS NOT NULL) AND ("p"."published_at" <= "now"()) AND "public"."site_visible"("p"."site_id")))));




CREATE POLICY "blog_translations_staff_read_all" ON "public"."blog_translations" FOR SELECT USING ("public"."is_staff"());




CREATE POLICY "blog_translations_staff_write" ON "public"."blog_translations" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "campaign_translations public read published" ON "public"."campaign_translations" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_translations"."campaign_id") AND ("c"."status" = 'published'::"public"."post_status") AND ("c"."published_at" <= "now"()) AND "public"."site_visible"("c"."site_id")))));




CREATE POLICY "campaign_translations staff read all" ON "public"."campaign_translations" FOR SELECT TO "authenticated" USING ("public"."is_staff"());




CREATE POLICY "campaign_translations staff write" ON "public"."campaign_translations" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "campaigns public read published" ON "public"."campaigns" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"public"."post_status") AND ("published_at" <= "now"()) AND "public"."site_visible"("site_id")));




CREATE POLICY "campaigns staff read all" ON "public"."campaigns" FOR SELECT TO "authenticated" USING ("public"."is_staff"());




CREATE POLICY "campaigns_delete" ON "public"."campaigns" FOR DELETE TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_org_admin"(( SELECT "sites"."org_id"
   FROM "public"."sites"
  WHERE ("sites"."id" = "campaigns"."site_id"))) OR ("public"."can_edit_site"("site_id") AND ("status" <> 'published'::"public"."post_status"))));




CREATE POLICY "campaigns_insert" ON "public"."campaigns" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_edit_site"("site_id"));




CREATE POLICY "campaigns_select" ON "public"."campaigns" FOR SELECT TO "authenticated" USING (("public"."can_edit_site"("site_id") OR (("status" = 'published'::"public"."post_status") AND "public"."site_visible"("site_id"))));




CREATE POLICY "campaigns_update" ON "public"."campaigns" FOR UPDATE TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "consent_texts_public_read" ON "public"."consent_texts" FOR SELECT USING (true);



CREATE POLICY "consents_anon_by_id_read" ON "public"."consents" FOR SELECT TO "anon" USING ((("anonymous_id" IS NOT NULL) AND ("user_id" IS NULL)));




CREATE POLICY "consents_self_insert" ON "public"."consents" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));




CREATE POLICY "consents_self_read" ON "public"."consents" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"()));




CREATE POLICY "consents_self_update" ON "public"."consents" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "contact_submissions anon insert" ON "public"."contact_submissions" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sites" "s"
  WHERE (("s"."id" = "contact_submissions"."site_id") AND ((COALESCE(NULLIF("current_setting"('app.site_id'::"text", true), ''::"text"), ''::"text") = ''::"text") OR ("s"."id" = (NULLIF("current_setting"('app.site_id'::"text", true), ''::"text"))::"uuid"))))));




CREATE POLICY "contact_submissions_read" ON "public"."contact_submissions" FOR SELECT TO "authenticated" USING ("public"."can_edit_site"("site_id"));




CREATE POLICY "contact_submissions_update" ON "public"."contact_submissions" FOR UPDATE TO "authenticated" USING ("public"."can_admin_site_users"("site_id")) WITH CHECK ("public"."can_admin_site_users"("site_id"));



CREATE POLICY "content_events_anon_insert" ON "public"."content_events" FOR INSERT TO "anon" WITH CHECK ("public"."site_visible"("site_id"));




CREATE POLICY "content_events_staff_read" ON "public"."content_events" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "content_metrics_staff_read" ON "public"."content_metrics" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "cron_config_deny_all" ON "public"."cron_config" USING (false) WITH CHECK (false);



CREATE POLICY "hashtags_public_read" ON "public"."hashtags" FOR SELECT USING ("public"."site_visible"("site_id"));




CREATE POLICY "hashtags_staff_write" ON "public"."hashtags" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "invitations admin manage" ON "public"."invitations" TO "authenticated" USING (("public"."org_role"("org_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."org_role"("org_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));



CREATE POLICY "kill_switches_all_service_role" ON "public"."kill_switches" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "kill_switches_select_authenticated" ON "public"."kill_switches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lgpd_requests_self_insert" ON "public"."lgpd_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));




CREATE POLICY "lgpd_requests_self_read" ON "public"."lgpd_requests" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"()));



CREATE POLICY "link_alerts_staff_read" ON "public"."link_alerts" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));




CREATE POLICY "link_alerts_staff_write" ON "public"."link_alerts" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "link_annotations_staff_read" ON "public"."link_annotations" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));




CREATE POLICY "link_annotations_staff_write" ON "public"."link_annotations" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "link_clicks_service_insert" ON "public"."link_clicks" FOR INSERT TO "anon" WITH CHECK ("public"."site_visible"("site_id"));




CREATE POLICY "link_clicks_staff_read" ON "public"."link_clicks" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));



CREATE POLICY "link_daily_metrics_staff_read" ON "public"."link_daily_metrics" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));



CREATE POLICY "link_goals_staff_read" ON "public"."link_goals" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));




CREATE POLICY "link_goals_staff_write" ON "public"."link_goals" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "link_qr_templates_staff_read" ON "public"."link_qr_templates" FOR SELECT USING (("public"."can_view_site"("site_id") OR "public"."is_super_admin"()));




CREATE POLICY "link_qr_templates_staff_write" ON "public"."link_qr_templates" USING (("public"."can_edit_site"("site_id") OR "public"."is_super_admin"()));



CREATE POLICY "link_settings_staff_read" ON "public"."link_settings" FOR SELECT USING (("public"."can_view_site"("site_id") OR "public"."is_super_admin"()));




CREATE POLICY "link_settings_staff_write" ON "public"."link_settings" USING (("public"."can_edit_site"("site_id") OR "public"."is_super_admin"()));



CREATE POLICY "link_utm_presets_staff_read" ON "public"."link_utm_presets" FOR SELECT USING (("public"."can_view_site"("site_id") OR "public"."is_super_admin"()));




CREATE POLICY "link_utm_presets_staff_write" ON "public"."link_utm_presets" USING (("public"."can_edit_site"("site_id") OR "public"."is_super_admin"()));




CREATE POLICY "members admin write" ON "public"."organization_members" TO "authenticated" USING (("public"."org_role"("org_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"]))) WITH CHECK (("public"."org_role"("org_id") = ANY (ARRAY['owner'::"text", 'admin'::"text"])));




CREATE POLICY "members self read" ON "public"."organization_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_org_staff"("org_id")));




CREATE POLICY "newsletter anon insert" ON "public"."newsletter_subscriptions" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sites" "s"
  WHERE (("s"."id" = "newsletter_subscriptions"."site_id") AND ((COALESCE(NULLIF("current_setting"('app.site_id'::"text", true), ''::"text"), ''::"text") = ''::"text") OR ("s"."id" = (NULLIF("current_setting"('app.site_id'::"text", true), ''::"text"))::"uuid"))))));



CREATE POLICY "newsletter_editions_public_read" ON "public"."newsletter_editions" FOR SELECT TO "anon" USING (("status" = 'sent'::"text"));




CREATE POLICY "newsletter_editions_staff_read" ON "public"."newsletter_editions" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));




CREATE POLICY "newsletter_editions_staff_write" ON "public"."newsletter_editions" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "newsletter_sends_staff_read" ON "public"."newsletter_sends" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."newsletter_editions" "e"
  WHERE (("e"."id" = "newsletter_sends"."edition_id") AND "public"."can_view_site"("e"."site_id")))));



CREATE POLICY "newsletter_subscriptions_read" ON "public"."newsletter_subscriptions" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_org_admin"(( SELECT "sites"."org_id"
   FROM "public"."sites"
  WHERE ("sites"."id" = "newsletter_subscriptions"."site_id")))));



CREATE POLICY "orgs public read" ON "public"."organizations" FOR SELECT TO "authenticated", "anon" USING (true);




CREATE POLICY "orgs staff write" ON "public"."organizations" TO "authenticated" USING ("public"."is_org_staff"("id")) WITH CHECK ("public"."is_org_staff"("id"));



CREATE POLICY "post_hashtags_public_read" ON "public"."post_hashtags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."blog_posts" "bp"
  WHERE (("bp"."id" = "post_hashtags"."post_id") AND "public"."site_visible"("bp"."site_id")))));




CREATE POLICY "post_hashtags_staff_write" ON "public"."post_hashtags" USING ((EXISTS ( SELECT 1
   FROM "public"."blog_posts" "bp"
  WHERE (("bp"."id" = "post_hashtags"."post_id") AND "public"."can_edit_site"("bp"."site_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."blog_posts" "bp"
  WHERE (("bp"."id" = "post_hashtags"."post_id") AND "public"."can_edit_site"("bp"."site_id")))));




CREATE POLICY "public_read_active_types" ON "public"."newsletter_types" FOR SELECT USING (("active" = true));



CREATE POLICY "sent_emails staff read" ON "public"."sent_emails" FOR SELECT TO "authenticated" USING (("public"."can_admin_site"("site_id") OR "public"."is_staff"()));




CREATE POLICY "service_role_all" ON "public"."ad_campaigns" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "service_role_all" ON "public"."ad_inquiries" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "service_role_all" ON "public"."ad_media" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "service_role_all" ON "public"."ad_slot_creatives" TO "service_role" USING (true) WITH CHECK (true);




CREATE POLICY "service_role_all" ON "public"."ad_slot_metrics" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "site_memberships_read" ON "public"."site_memberships" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."can_admin_site_users"("site_id")));




CREATE POLICY "site_memberships_write" ON "public"."site_memberships" TO "authenticated" USING ("public"."can_admin_site_users"("site_id")) WITH CHECK ("public"."can_admin_site_users"("site_id"));



CREATE POLICY "sites public read" ON "public"."sites" FOR SELECT TO "authenticated", "anon" USING (true);




CREATE POLICY "sites staff write" ON "public"."sites" TO "authenticated" USING ("public"."can_admin_site"("id")) WITH CHECK ("public"."can_admin_site"("id"));




CREATE POLICY "staff_manage_types" ON "public"."newsletter_types" USING ("public"."is_member_staff"()) WITH CHECK ("public"."is_member_staff"());




CREATE POLICY "submissions anon insert" ON "public"."campaign_submissions" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_submissions"."campaign_id") AND ("c"."status" = 'published'::"public"."post_status") AND ("c"."published_at" IS NOT NULL) AND ("c"."published_at" <= "now"())))));




CREATE POLICY "submissions staff read" ON "public"."campaign_submissions" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "tracked_links_public_read" ON "public"."tracked_links" FOR SELECT USING (("public"."site_visible"("site_id") AND ("active" = true) AND ("deleted_at" IS NULL) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())) AND (("click_limit" IS NULL) OR ("total_clicks" < "click_limit"))));




CREATE POLICY "tracked_links_staff_read_all" ON "public"."tracked_links" FOR SELECT TO "authenticated" USING ("public"."can_view_site"("site_id"));




CREATE POLICY "tracked_links_staff_write" ON "public"."tracked_links" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "user_app_presence_all_service_role" ON "public"."user_app_presence" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "youtube_categories_public_read" ON "public"."youtube_categories" FOR SELECT USING ("public"."site_visible"("site_id"));




CREATE POLICY "youtube_categories_staff_write" ON "public"."youtube_categories" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "youtube_channels_public_read" ON "public"."youtube_channels" FOR SELECT USING ("public"."site_visible"("site_id"));




CREATE POLICY "youtube_channels_staff_write" ON "public"."youtube_channels" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "youtube_curated_comments_public_read" ON "public"."youtube_curated_comments" FOR SELECT USING ("public"."site_visible"("site_id"));




CREATE POLICY "youtube_curated_comments_staff_write" ON "public"."youtube_curated_comments" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));



CREATE POLICY "youtube_sync_log_staff_read" ON "public"."youtube_sync_log" FOR SELECT TO "authenticated" USING ("public"."can_edit_site"("site_id"));



CREATE POLICY "youtube_videos_public_read" ON "public"."youtube_videos" FOR SELECT USING (("public"."site_visible"("site_id") AND ("is_hidden" = false)));




CREATE POLICY "youtube_videos_staff_read_all" ON "public"."youtube_videos" FOR SELECT TO "authenticated" USING ("public"."can_edit_site"("site_id"));




CREATE POLICY "youtube_videos_staff_write" ON "public"."youtube_videos" TO "authenticated" USING ("public"."can_edit_site"("site_id")) WITH CHECK ("public"."can_edit_site"("site_id"));


-- Views




CREATE OR REPLACE VIEW "public"."newsletter_click_events" AS
 SELECT "lc"."id",
    "ns"."id" AS "send_id",
    "tl"."destination_url" AS "url",
    "lc"."ip",
    "lc"."user_agent",
    "lc"."clicked_at"
   FROM (("public"."link_clicks" "lc"
     JOIN "public"."tracked_links" "tl" ON (("tl"."id" = "lc"."link_id")))
     JOIN "public"."newsletter_sends" "ns" ON (("ns"."link_id" = "tl"."id")))
  WHERE ("tl"."source_type" = 'newsletter'::"public"."link_source_type");





CREATE OR REPLACE VIEW "public"."newsletter_click_events_unified" AS
 SELECT "nce"."send_id",
    "nce"."url",
    "nce"."ip",
    "nce"."user_agent",
    "nce"."clicked_at"
   FROM "public"."newsletter_click_events" "nce"
UNION ALL
 SELECT "ns"."id" AS "send_id",
    "tl"."destination_url" AS "url",
    "lc"."ip",
    "lc"."user_agent",
    "lc"."clicked_at"
   FROM (("public"."link_clicks" "lc"
     JOIN "public"."tracked_links" "tl" ON (("tl"."id" = "lc"."link_id")))
     JOIN "public"."newsletter_sends" "ns" ON ((("ns"."edition_id" = "tl"."source_id") AND ("ns"."link_rewrite_enabled" = true))))
  WHERE ("tl"."source_type" = 'newsletter'::"public"."link_source_type");


-- Triggers



-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS (moved after functions to resolve dependency order)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE TRIGGER "audit_consents" AFTER INSERT OR DELETE OR UPDATE ON "public"."consents" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_mutation"();


CREATE OR REPLACE TRIGGER "audit_invitations" AFTER INSERT OR DELETE OR UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_mutation"();


CREATE OR REPLACE TRIGGER "audit_organization_members" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_mutation"();


CREATE OR REPLACE TRIGGER "audit_site_memberships" AFTER INSERT OR DELETE OR UPDATE ON "public"."site_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."tg_audit_mutation"();


CREATE OR REPLACE TRIGGER "author_about_tx_set_updated_at" BEFORE UPDATE ON "public"."author_about_translations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "authors_set_updated_at" BEFORE UPDATE ON "public"."authors" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "blog_posts_set_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "blog_tags_set_updated_at" BEFORE UPDATE ON "public"."blog_tags" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "blog_translations_set_updated_at" BEFORE UPDATE ON "public"."blog_translations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "blog_translations_validate_slug" BEFORE INSERT OR UPDATE ON "public"."blog_translations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_translation_slug_unique_per_site"();


CREATE OR REPLACE TRIGGER "campaign_translations_validate_slug" BEFORE INSERT OR UPDATE ON "public"."campaign_translations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_campaign_translation_slug_unique_per_site"();


CREATE OR REPLACE TRIGGER "newsletter_editions_set_updated_at" BEFORE UPDATE ON "public"."newsletter_editions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "set_newsletter_types_updated_at" BEFORE UPDATE ON "public"."newsletter_types" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "tg_campaign_translations_updated_at" BEFORE UPDATE ON "public"."campaign_translations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "tg_campaigns_scheduled_for_future" BEFORE INSERT OR UPDATE OF "status", "scheduled_for" ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."tg_campaigns_scheduled_for_future"();


CREATE OR REPLACE TRIGGER "tg_campaigns_updated_at" BEFORE UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "tg_invitations_rate_limit" BEFORE INSERT ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."invitations_rate_limit"();


CREATE OR REPLACE TRIGGER "tg_organization_members_updated_at" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "tg_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "tg_sites_updated_at" BEFORE UPDATE ON "public"."sites" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();


CREATE OR REPLACE TRIGGER "tg_validate_submission_consent" BEFORE INSERT OR UPDATE ON "public"."campaign_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_submission_consent"();


CREATE OR REPLACE TRIGGER "trg_enforce_publish_blog" BEFORE INSERT OR UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_publish_permission"();


CREATE OR REPLACE TRIGGER "trg_enforce_publish_campaign" BEFORE INSERT OR UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_publish_permission"();


CREATE OR REPLACE TRIGGER "trg_set_owner_blog" BEFORE INSERT ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_user_id_on_insert"();


CREATE OR REPLACE TRIGGER "trg_set_owner_campaign" BEFORE INSERT ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."set_owner_user_id_on_insert"();


CREATE OR REPLACE TRIGGER "trg_sync_newsletter_tag_link" AFTER INSERT OR UPDATE OF "linked_tag_id", "color", "color_dark" ON "public"."newsletter_types" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tag_newsletter_link"();


CREATE OR REPLACE TRIGGER "trg_sync_tag_newsletter_link" AFTER INSERT OR UPDATE OF "linked_newsletter_type_id", "color", "color_dark" ON "public"."blog_tags" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tag_newsletter_link"();


CREATE OR REPLACE TRIGGER "trg_tracked_links_updated_at" BEFORE UPDATE ON "public"."tracked_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_tracked_links_timestamp"();


CREATE OR REPLACE TRIGGER "update_ad_campaigns_updated_at" BEFORE UPDATE ON "public"."ad_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


CREATE OR REPLACE TRIGGER "update_ad_slot_config_updated_at" BEFORE UPDATE ON "public"."ad_slot_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


-- Comments




COMMENT ON SCHEMA "public" IS 'standard public schema';





COMMENT ON COLUMN "public"."ad_campaigns"."target_categories" IS 'Array of target category slugs. Empty array = all categories (no filter).';




COMMENT ON COLUMN "public"."ad_campaigns"."budget_cents" IS 'Total budget in cents (USD). NULL = unlimited.';




COMMENT ON COLUMN "public"."ad_campaigns"."spent_cents" IS 'Accumulated spend in cents. Incremented by tracking endpoint on each billable event.';




COMMENT ON COLUMN "public"."ad_campaigns"."pacing_strategy" IS 'even: uniform daily distribution. front_loaded: 60% in first 40% of flight. asap: no throttle.';




COMMENT ON COLUMN "public"."ad_campaigns"."variant_group" IS 'Campaigns sharing the same variant_group compete for A/B split. NULL = no A/B.';




COMMENT ON COLUMN "public"."ad_campaigns"."variant_weight" IS 'Traffic percentage allocated to this variant (1–100).';





COMMENT ON COLUMN "public"."ad_events"."site_id" IS 'Site UUID (FK → sites.id). Backfilled from app_id on migration. Preferred over app_id for new queries.';





COMMENT ON TABLE "public"."ad_revenue_daily" IS 'Daily revenue metrics aggregated per slot and source. Google data imported via AdSense Management API cron (T-1). House/CPA computed from ad_events.';




COMMENT ON COLUMN "public"."ad_revenue_daily"."fill_rate" IS 'Percentage of page views where the slot was filled (0.00 to 100.00). NULL until page_views > 0.';




COMMENT ON COLUMN "public"."ad_revenue_daily"."raw_data" IS 'Raw provider API response payload. Stored for debug and revenue reconciliation.';





COMMENT ON COLUMN "public"."ad_slot_creatives"."image_aspect_ratio" IS 'Calculated aspect ratio of the uploaded image (e.g. "8:1"). Validated against ad_slot_config.aspect_ratio on save.';




COMMENT ON COLUMN "public"."ad_slot_creatives"."image_width" IS 'Image width in pixels. NULL until image is uploaded or analysed.';




COMMENT ON COLUMN "public"."ad_slot_creatives"."image_height" IS 'Image height in pixels. NULL until image is uploaded or analysed.';





COMMENT ON COLUMN "public"."blog_translations"."content_compiled" IS 'Compiled JS module source from @mdx-js/mdx (NULL = needs compile; runtime fallback applies)';




COMMENT ON COLUMN "public"."blog_translations"."seo_extras" IS 'Sprint 5b — Structured-data extras (FAQ/HowTo/Video) + per-translation OG image override. Populated via MDX frontmatter on save, validated by Zod (SeoExtrasSchema) before insert.';





COMMENT ON TABLE "public"."cron_config" IS 'Config store para pg_cron helpers. Substitui app.settings.* (que requer superuser no Supabase).';





COMMENT ON TABLE "public"."newsletter_subscriptions" IS 'Newsletter subscription state machine:
  pending_confirmation → confirmed   (via public.confirm_newsletter_subscription)
  confirmed            → unsubscribed (via public.unsubscribe_via_token)
  unsubscribed         → pending_confirmation (re-subscribe flow: token rotates,
                                               consent version re-captured)
  pending_confirmation → pending_confirmation (re-subscribe while pending: token
                                               rotates, expires_at resets)
Tokens are stored hashed (sha256 hex). Expiry enforced server-side by the RPCs,
not by a partial index (now() in a predicate is nondeterministic).';





COMMENT ON TABLE "public"."sent_emails" IS 'Audit log of transactional emails sent. Retention: 90 days (purge via cron in Sprint 4).';





COMMENT ON COLUMN "public"."sites"."contact_notification_email" IS 'Per-site email for contact form admin alerts. NULL = fallback to first owner of org.';




COMMENT ON COLUMN "public"."sites"."identity_type" IS 'Sprint 5b — JSON-LD root entity. person=hub site (bythiagofigueiredo), organization=brand site (future ring).';




COMMENT ON COLUMN "public"."sites"."twitter_handle" IS 'Sprint 5b — Twitter/X handle without @, used in twitter:site card meta.';




COMMENT ON COLUMN "public"."sites"."seo_default_og_image" IS 'Sprint 5b — Absolute HTTPS URL fallback OG image when dynamic OG disabled or render fails.';





COMMENT ON COLUMN "public"."youtube_channels"."schedule_label" IS 'Manual override for schedule text on public site. NULL = auto-derive from sync_schedules.';




-- Function comments (moved after function definitions)
COMMENT ON FUNCTION "public"."aggregate_ad_events_yesterday"() IS 'Aggregate yesterday''s ad_events into ad_slot_metrics. Called by cron /api/cron/ad-events-aggregate. Returns number of rows upserted.';

COMMENT ON FUNCTION "public"."cron_http_post_web"("p_path" "text", "p_timeout_ms" integer) IS 'Helper: POST em rota web com Bearer CRON_SECRET via pg_net. Lê config de public.cron_config.';

COMMENT ON FUNCTION "public"."cron_purge_old_contact_submissions"() IS 'pg_cron wrapper: anonimiza contact_submissions > 2 anos. Roda domingo 06:00 UTC.';

COMMENT ON FUNCTION "public"."cron_purge_sent_emails"() IS 'pg_cron wrapper: purga sent_emails > 90d. Roda daily 06:00 UTC. Migrado de Vercel cron.';


-- Other













































































































































































































































































































































































































































ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";







ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";







ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

