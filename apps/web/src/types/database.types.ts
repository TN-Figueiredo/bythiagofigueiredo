export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ab_test_cycles: {
        Row: {
          applied_metadata: Json | null
          avd_seconds: number | null
          backfill_attempts: number | null
          backfill_status: string | null
          clicks: number | null
          created_at: string
          ctr: number | null
          cycle_number: number
          ended_at: string | null
          estimated_clicks: number | null
          estimated_ctr: number | null
          estimated_impressions: number | null
          estimated_revenue: number | null
          id: string
          impressions: number | null
          likes: number | null
          started_at: string
          subscribers_gained: number | null
          test_id: string
          variant_id: string
          views: number | null
        }
        Insert: {
          applied_metadata?: Json | null
          avd_seconds?: number | null
          backfill_attempts?: number | null
          backfill_status?: string | null
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          cycle_number: number
          ended_at?: string | null
          estimated_clicks?: number | null
          estimated_ctr?: number | null
          estimated_impressions?: number | null
          estimated_revenue?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          started_at?: string
          subscribers_gained?: number | null
          test_id: string
          variant_id: string
          views?: number | null
        }
        Update: {
          applied_metadata?: Json | null
          avd_seconds?: number | null
          backfill_attempts?: number | null
          backfill_status?: string | null
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          cycle_number?: number
          ended_at?: string | null
          estimated_clicks?: number | null
          estimated_ctr?: number | null
          estimated_impressions?: number | null
          estimated_revenue?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          started_at?: string
          subscribers_gained?: number | null
          test_id?: string
          variant_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_cycles_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_cycles_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_test_polls: {
        Row: {
          id: string
          likes: number
          polled_at: string
          source: string
          test_id: string
          variant_id: string
          views: number
        }
        Insert: {
          id?: string
          likes?: number
          polled_at?: string
          source?: string
          test_id: string
          variant_id: string
          views?: number
        }
        Update: {
          id?: string
          likes?: number
          polled_at?: string
          source?: string
          test_id?: string
          variant_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_polls_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_polls_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_test_tracked_links: {
        Row: {
          ab_test_id: string
          created_at: string
          id: string
          link_id: string
          short_code: string
          template_name: string
          variant_id: string
        }
        Insert: {
          ab_test_id: string
          created_at?: string
          id?: string
          link_id: string
          short_code: string
          template_name: string
          variant_id: string
        }
        Update: {
          ab_test_id?: string
          created_at?: string
          id?: string
          link_id?: string
          short_code?: string
          template_name?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_tracked_links_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_tracked_links_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_tracked_links_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_tracked_links_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_test_variants: {
        Row: {
          blob_key: string | null
          blob_url: string | null
          created_at: string
          description_text: string | null
          dimensions: string | null
          file_size_bytes: number | null
          id: string
          is_original: boolean
          label: string
          metadata: Json | null
          sort_order: number
          source_variant_id: string | null
          test_id: string
          title_text: string | null
        }
        Insert: {
          blob_key?: string | null
          blob_url?: string | null
          created_at?: string
          description_text?: string | null
          dimensions?: string | null
          file_size_bytes?: number | null
          id?: string
          is_original?: boolean
          label: string
          metadata?: Json | null
          sort_order?: number
          source_variant_id?: string | null
          test_id: string
          title_text?: string | null
        }
        Update: {
          blob_key?: string | null
          blob_url?: string | null
          created_at?: string
          description_text?: string | null
          dimensions?: string | null
          file_size_bytes?: number | null
          id?: string
          is_original?: boolean
          label?: string
          metadata?: Json | null
          sort_order?: number
          source_variant_id?: string | null
          test_id?: string
          title_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_test_variants_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_test_variants_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ab_tests: {
        Row: {
          applied_by: string | null
          apply_attempts: number | null
          completed_at: string | null
          completed_reason: string | null
          confidence_at_completion: number | null
          config: Json
          consecutive_confident_evals: number
          created_at: string
          drift_acknowledged_at: string | null
          grace_expires_at: string | null
          id: string
          last_applied_variant_id: string | null
          last_apply_error: string | null
          name: string
          original_description: string | null
          original_thumbnail_url: string
          original_title: string | null
          parent_test_id: string | null
          paused_at: string | null
          playoff_start_after: string | null
          playoff_test_id: string | null
          queue_start_after: string | null
          result_metadata: Json | null
          revert_expires_at: string | null
          round_number: number
          site_id: string
          source_pipeline_id: string | null
          started_at: string | null
          status: string
          status_note: string | null
          test_type: string
          updated_at: string
          winner_applied_at: string | null
          winner_variant_id: string | null
          youtube_video_id: string
        }
        Insert: {
          applied_by?: string | null
          apply_attempts?: number | null
          completed_at?: string | null
          completed_reason?: string | null
          confidence_at_completion?: number | null
          config?: Json
          consecutive_confident_evals?: number
          created_at?: string
          drift_acknowledged_at?: string | null
          grace_expires_at?: string | null
          id?: string
          last_applied_variant_id?: string | null
          last_apply_error?: string | null
          name: string
          original_description?: string | null
          original_thumbnail_url: string
          original_title?: string | null
          parent_test_id?: string | null
          paused_at?: string | null
          playoff_start_after?: string | null
          playoff_test_id?: string | null
          queue_start_after?: string | null
          result_metadata?: Json | null
          revert_expires_at?: string | null
          round_number?: number
          site_id: string
          source_pipeline_id?: string | null
          started_at?: string | null
          status?: string
          status_note?: string | null
          test_type?: string
          updated_at?: string
          winner_applied_at?: string | null
          winner_variant_id?: string | null
          youtube_video_id: string
        }
        Update: {
          applied_by?: string | null
          apply_attempts?: number | null
          completed_at?: string | null
          completed_reason?: string | null
          confidence_at_completion?: number | null
          config?: Json
          consecutive_confident_evals?: number
          created_at?: string
          drift_acknowledged_at?: string | null
          grace_expires_at?: string | null
          id?: string
          last_applied_variant_id?: string | null
          last_apply_error?: string | null
          name?: string
          original_description?: string | null
          original_thumbnail_url?: string
          original_title?: string | null
          parent_test_id?: string | null
          paused_at?: string | null
          playoff_start_after?: string | null
          playoff_test_id?: string | null
          queue_start_after?: string | null
          result_metadata?: Json | null
          revert_expires_at?: string | null
          round_number?: number
          site_id?: string
          source_pipeline_id?: string | null
          started_at?: string | null
          status?: string
          status_note?: string | null
          test_type?: string
          updated_at?: string
          winner_applied_at?: string | null
          winner_variant_id?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ab_tests_parent_test_id_fkey"
            columns: ["parent_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_tests_playoff_test_id_fkey"
            columns: ["playoff_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_tests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_tests_source_pipeline_id_fkey"
            columns: ["source_pipeline_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_tests_winner_variant_fk"
            columns: ["winner_variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ab_tests_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          advertiser: string | null
          app_id: string
          audience: Json | null
          brand_color: string
          budget_cents: number | null
          clicks_delivered: number | null
          clicks_target: number | null
          created_at: string | null
          format: string
          id: string
          impressions_delivered: number | null
          impressions_target: number | null
          limits: Json | null
          logo_url: string | null
          name: string
          pacing_strategy: string
          pricing_model: string
          pricing_value: number | null
          priority: number | null
          schedule_end: string | null
          schedule_start: string | null
          spent_cents: number
          status: string
          target_categories: string[] | null
          type: string
          updated_at: string | null
          variant_group: string | null
          variant_weight: number
        }
        Insert: {
          advertiser?: string | null
          app_id?: string
          audience?: Json | null
          brand_color?: string
          budget_cents?: number | null
          clicks_delivered?: number | null
          clicks_target?: number | null
          created_at?: string | null
          format?: string
          id?: string
          impressions_delivered?: number | null
          impressions_target?: number | null
          limits?: Json | null
          logo_url?: string | null
          name: string
          pacing_strategy?: string
          pricing_model?: string
          pricing_value?: number | null
          priority?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          spent_cents?: number
          status?: string
          target_categories?: string[] | null
          type?: string
          updated_at?: string | null
          variant_group?: string | null
          variant_weight?: number
        }
        Update: {
          advertiser?: string | null
          app_id?: string
          audience?: Json | null
          brand_color?: string
          budget_cents?: number | null
          clicks_delivered?: number | null
          clicks_target?: number | null
          created_at?: string | null
          format?: string
          id?: string
          impressions_delivered?: number | null
          impressions_target?: number | null
          limits?: Json | null
          logo_url?: string | null
          name?: string
          pacing_strategy?: string
          pricing_model?: string
          pricing_value?: number | null
          priority?: number | null
          schedule_end?: string | null
          schedule_start?: string | null
          spent_cents?: number
          status?: string
          target_categories?: string[] | null
          type?: string
          updated_at?: string | null
          variant_group?: string | null
          variant_weight?: number
        }
        Relationships: []
      }
      ad_events: {
        Row: {
          ad_id: string | null
          app_id: string
          created_at: string
          event_type: string
          id: string
          site_id: string | null
          slot_id: string
          user_hash: string
        }
        Insert: {
          ad_id?: string | null
          app_id: string
          created_at?: string
          event_type: string
          id?: string
          site_id?: string | null
          slot_id: string
          user_hash: string
        }
        Update: {
          ad_id?: string | null
          app_id?: string
          created_at?: string
          event_type?: string
          id?: string
          site_id?: string | null
          slot_id?: string
          user_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_inquiries: {
        Row: {
          admin_notes: string | null
          app_id: string
          budget: string | null
          company: string | null
          consent_processing: boolean
          consent_version: string
          contacted_at: string | null
          converted_at: string | null
          email: string
          id: string
          ip: unknown
          message: string
          name: string
          preferred_slots: string[] | null
          status: string
          submitted_at: string
          user_agent: string | null
          website: string | null
        }
        Insert: {
          admin_notes?: string | null
          app_id?: string
          budget?: string | null
          company?: string | null
          consent_processing?: boolean
          consent_version: string
          contacted_at?: string | null
          converted_at?: string | null
          email: string
          id?: string
          ip?: unknown
          message: string
          name: string
          preferred_slots?: string[] | null
          status?: string
          submitted_at?: string
          user_agent?: string | null
          website?: string | null
        }
        Update: {
          admin_notes?: string | null
          app_id?: string
          budget?: string | null
          company?: string | null
          consent_processing?: boolean
          consent_version?: string
          contacted_at?: string | null
          converted_at?: string | null
          email?: string
          id?: string
          ip?: unknown
          message?: string
          name?: string
          preferred_slots?: string[] | null
          status?: string
          submitted_at?: string
          user_agent?: string | null
          website?: string | null
        }
        Relationships: []
      }
      ad_media: {
        Row: {
          app_id: string
          created_at: string | null
          file_name: string
          id: string
          mime_type: string | null
          public_url: string
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          app_id?: string
          created_at?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          public_url: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          public_url?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: []
      }
      ad_placeholders: {
        Row: {
          app_id: string
          body: string
          brand_color: string
          cta_text: string
          cta_url: string
          dismiss_after_ms: number
          headline: string
          image_url: string | null
          is_enabled: boolean
          logo_url: string | null
          slot_id: string
          updated_at: string | null
        }
        Insert: {
          app_id?: string
          body?: string
          brand_color?: string
          cta_text?: string
          cta_url?: string
          dismiss_after_ms?: number
          headline?: string
          image_url?: string | null
          is_enabled?: boolean
          logo_url?: string | null
          slot_id: string
          updated_at?: string | null
        }
        Update: {
          app_id?: string
          body?: string
          brand_color?: string
          cta_text?: string
          cta_url?: string
          dismiss_after_ms?: number
          headline?: string
          image_url?: string | null
          is_enabled?: boolean
          logo_url?: string | null
          slot_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ad_revenue_daily: {
        Row: {
          clicks: number
          currency: string
          date: string
          earnings_cents: number
          fill_rate: number | null
          impressions: number
          page_views: number
          raw_data: Json | null
          site_id: string
          slot_key: string
          source: string
          synced_at: string
        }
        Insert: {
          clicks?: number
          currency?: string
          date: string
          earnings_cents?: number
          fill_rate?: number | null
          impressions?: number
          page_views?: number
          raw_data?: Json | null
          site_id: string
          slot_key: string
          source: string
          synced_at?: string
        }
        Update: {
          clicks?: number
          currency?: string
          date?: string
          earnings_cents?: number
          fill_rate?: number | null
          impressions?: number
          page_views?: number
          raw_data?: Json | null
          site_id?: string
          slot_key?: string
          source?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_revenue_daily_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_slot_config: {
        Row: {
          accepted_types: string[]
          aspect_ratio: string
          cooldown_ms: number
          cpa_enabled: boolean
          created_at: string
          google_enabled: boolean
          house_enabled: boolean
          iab_size: string | null
          label: string
          max_per_day: number
          max_per_session: number
          mobile_behavior: string
          network_adapters_order: string[]
          network_config: Json
          site_id: string
          slot_key: string
          template_enabled: boolean
          updated_at: string
          zone: string
        }
        Insert: {
          accepted_types?: string[]
          aspect_ratio?: string
          cooldown_ms?: number
          cpa_enabled?: boolean
          created_at?: string
          google_enabled?: boolean
          house_enabled?: boolean
          iab_size?: string | null
          label: string
          max_per_day?: number
          max_per_session?: number
          mobile_behavior?: string
          network_adapters_order?: string[]
          network_config?: Json
          site_id: string
          slot_key: string
          template_enabled?: boolean
          updated_at?: string
          zone: string
        }
        Update: {
          accepted_types?: string[]
          aspect_ratio?: string
          cooldown_ms?: number
          cpa_enabled?: boolean
          created_at?: string
          google_enabled?: boolean
          house_enabled?: boolean
          iab_size?: string | null
          label?: string
          max_per_day?: number
          max_per_session?: number
          mobile_behavior?: string
          network_adapters_order?: string[]
          network_config?: Json
          site_id?: string
          slot_key?: string
          template_enabled?: boolean
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_slot_config_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_slot_creatives: {
        Row: {
          body: string | null
          campaign_id: string
          created_at: string | null
          cta_text: string | null
          cta_url: string | null
          dismiss_seconds: number | null
          id: string
          image_aspect_ratio: string | null
          image_height: number | null
          image_url: string | null
          image_width: number | null
          interaction: string
          locale: string
          slot_key: string
          title: string | null
        }
        Insert: {
          body?: string | null
          campaign_id: string
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          dismiss_seconds?: number | null
          id?: string
          image_aspect_ratio?: string | null
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          interaction?: string
          locale?: string
          slot_key: string
          title?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: string
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          dismiss_seconds?: number | null
          id?: string
          image_aspect_ratio?: string | null
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          interaction?: string
          locale?: string
          slot_key?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_slot_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_slot_metrics: {
        Row: {
          app_id: string
          campaign_id: string
          clicks: number | null
          date: string
          id: string
          impressions: number | null
          slot_key: string
        }
        Insert: {
          app_id?: string
          campaign_id: string
          clicks?: number | null
          date?: string
          id?: string
          impressions?: number | null
          slot_key: string
        }
        Update: {
          app_id?: string
          campaign_id?: string
          clicks?: number | null
          date?: string
          id?: string
          impressions?: number | null
          slot_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_slot_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_asset_usage: {
        Row: {
          audio_asset_id: string
          created_at: string
          id: string
          notes: string | null
          pipeline_item_id: string
          scene_number: number | null
          site_id: string
          usage_type: string
        }
        Insert: {
          audio_asset_id: string
          created_at?: string
          id?: string
          notes?: string | null
          pipeline_item_id: string
          scene_number?: number | null
          site_id: string
          usage_type?: string
        }
        Update: {
          audio_asset_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          pipeline_item_id?: string
          scene_number?: number | null
          site_id?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_asset_usage_audio_asset_id_fkey"
            columns: ["audio_asset_id"]
            isOneToOne: false
            referencedRelation: "audio_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_asset_usage_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_asset_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_assets: {
        Row: {
          artist: string | null
          artlist_url: string | null
          asset_id: string
          bpm: number | null
          category: string | null
          created_at: string
          duration_seconds: number | null
          energy: number | null
          genre: string | null
          id: string
          instruments: string[]
          metadata: Json
          mood: string[]
          music_key: string | null
          original_filename: string
          priority: string | null
          renamed_to: string | null
          reusable: boolean
          reuse_scenarios: string[]
          search_vector: unknown
          sha256: string | null
          site_id: string
          source: string
          status: string
          subcategory: string | null
          tags: string[]
          tempo_feel: string | null
          time_signature: string | null
          track_name: string | null
          type: string
          updated_at: string
          use_cases: string[]
          version: number
        }
        Insert: {
          artist?: string | null
          artlist_url?: string | null
          asset_id: string
          bpm?: number | null
          category?: string | null
          created_at?: string
          duration_seconds?: number | null
          energy?: number | null
          genre?: string | null
          id?: string
          instruments?: string[]
          metadata?: Json
          mood?: string[]
          music_key?: string | null
          original_filename: string
          priority?: string | null
          renamed_to?: string | null
          reusable?: boolean
          reuse_scenarios?: string[]
          search_vector?: unknown
          sha256?: string | null
          site_id: string
          source?: string
          status?: string
          subcategory?: string | null
          tags?: string[]
          tempo_feel?: string | null
          time_signature?: string | null
          track_name?: string | null
          type: string
          updated_at?: string
          use_cases?: string[]
          version?: number
        }
        Update: {
          artist?: string | null
          artlist_url?: string | null
          asset_id?: string
          bpm?: number | null
          category?: string | null
          created_at?: string
          duration_seconds?: number | null
          energy?: number | null
          genre?: string | null
          id?: string
          instruments?: string[]
          metadata?: Json
          mood?: string[]
          music_key?: string | null
          original_filename?: string
          priority?: string | null
          renamed_to?: string | null
          reusable?: boolean
          reuse_scenarios?: string[]
          search_vector?: unknown
          sha256?: string | null
          site_id?: string
          source?: string
          status?: string
          subcategory?: string | null
          tags?: string[]
          tempo_feel?: string | null
          time_signature?: string | null
          track_name?: string | null
          type?: string
          updated_at?: string
          use_cases?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audio_assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_import_log: {
        Row: {
          created_at: string
          created_count: number
          diff_log: Json | null
          error_count: number
          errors: Json | null
          id: string
          imported_by: string | null
          schema_version: string | null
          site_id: string
          skipped_count: number
          source: string
          status: string
          total_items: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          diff_log?: Json | null
          error_count?: number
          errors?: Json | null
          id?: string
          imported_by?: string | null
          schema_version?: string | null
          site_id: string
          skipped_count?: number
          source: string
          status: string
          total_items: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          diff_log?: Json | null
          error_count?: number
          errors?: Json | null
          id?: string
          imported_by?: string | null
          schema_version?: string | null
          site_id?: string
          skipped_count?: number
          source?: string
          status?: string
          total_items?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "audio_import_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          ip: unknown
          org_id: string | null
          resource_id: string | null
          resource_type: string
          site_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          org_id?: string | null
          resource_id?: string | null
          resource_type: string
          site_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          ip?: unknown
          org_id?: string | null
          resource_id?: string | null
          resource_type?: string
          site_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      author_about_translations: {
        Row: {
          about_compiled: string | null
          about_cta_links: Json | null
          about_md: string | null
          author_id: string
          bio: string | null
          created_at: string
          headline: string | null
          id: string
          locale: string
          photo_caption: string | null
          photo_location: string | null
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          about_compiled?: string | null
          about_cta_links?: Json | null
          about_md?: string | null
          author_id: string
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          locale: string
          photo_caption?: string | null
          photo_location?: string | null
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          about_compiled?: string | null
          about_cta_links?: Json | null
          about_md?: string | null
          author_id?: string
          bio?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          locale?: string
          photo_caption?: string | null
          photo_location?: string | null
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "author_about_translations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          about_photo_url: string | null
          avatar_color: string | null
          avatar_url: string | null
          bio: string | null
          bio_md: string | null
          created_at: string
          display_name: string | null
          id: string
          is_default: boolean | null
          name: string
          site_id: string | null
          slug: string
          social_links: Json | null
          sort_order: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          about_photo_url?: string | null
          avatar_color?: string | null
          avatar_url?: string | null
          bio?: string | null
          bio_md?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          site_id?: string | null
          slug: string
          social_links?: Json | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          about_photo_url?: string | null
          avatar_color?: string | null
          avatar_url?: string | null
          bio?: string | null
          bio_md?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          site_id?: string | null
          slug?: string
          social_links?: Json | null
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authors_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_cadence: {
        Row: {
          cadence_days: number
          cadence_paused: boolean
          cadence_start_date: string | null
          id: string
          last_published_at: string | null
          locale: string
          preferred_send_time: string
          site_id: string
        }
        Insert: {
          cadence_days?: number
          cadence_paused?: boolean
          cadence_start_date?: string | null
          id?: string
          last_published_at?: string | null
          locale: string
          preferred_send_time?: string
          site_id: string
        }
        Update: {
          cadence_days?: number
          cadence_paused?: boolean
          cadence_start_date?: string | null
          id?: string
          last_published_at?: string | null
          locale?: string
          preferred_send_time?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_cadence_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          canonical_url: string | null
          category: string | null
          continues_in_next: boolean
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          distribution_plan: Json
          id: string
          include_in_newsletter: boolean
          is_featured: boolean
          link_group_id: string | null
          locale: string
          owner_user_id: string | null
          previous_post_id: string | null
          published_at: string | null
          queue_position: number | null
          read_complete_count: number
          rss_included: boolean
          scheduled_at: string | null
          scheduled_for: string | null
          search_indexable: boolean
          site_id: string | null
          slot_date: string | null
          social_config: Json | null
          status: Database["public"]["Enums"]["post_status"]
          tag_id: string | null
          updated_at: string
          updated_by: string | null
          view_count: number
        }
        Insert: {
          author_id: string
          canonical_url?: string | null
          category?: string | null
          continues_in_next?: boolean
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          distribution_plan?: Json
          id?: string
          include_in_newsletter?: boolean
          is_featured?: boolean
          link_group_id?: string | null
          locale?: string
          owner_user_id?: string | null
          previous_post_id?: string | null
          published_at?: string | null
          queue_position?: number | null
          read_complete_count?: number
          rss_included?: boolean
          scheduled_at?: string | null
          scheduled_for?: string | null
          search_indexable?: boolean
          site_id?: string | null
          slot_date?: string | null
          social_config?: Json | null
          status?: Database["public"]["Enums"]["post_status"]
          tag_id?: string | null
          updated_at?: string
          updated_by?: string | null
          view_count?: number
        }
        Update: {
          author_id?: string
          canonical_url?: string | null
          category?: string | null
          continues_in_next?: boolean
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          distribution_plan?: Json
          id?: string
          include_in_newsletter?: boolean
          is_featured?: boolean
          link_group_id?: string | null
          locale?: string
          owner_user_id?: string | null
          previous_post_id?: string | null
          published_at?: string | null
          queue_position?: number | null
          read_complete_count?: number
          rss_included?: boolean
          scheduled_at?: string | null
          scheduled_for?: string | null
          search_indexable?: boolean
          site_id?: string | null
          slot_date?: string | null
          social_config?: Json | null
          status?: Database["public"]["Enums"]["post_status"]
          tag_id?: string | null
          updated_at?: string
          updated_by?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_previous_post_id_fkey"
            columns: ["previous_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          badge: string | null
          color: string
          color_dark: string | null
          created_at: string
          id: string
          name: string
          name_translations: Json
          site_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          badge?: string | null
          color?: string
          color_dark?: string | null
          created_at?: string
          id?: string
          name: string
          name_translations?: Json
          site_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          badge?: string | null
          color?: string
          color_dark?: string | null
          created_at?: string
          id?: string
          name?: string
          name_translations?: Json
          site_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_tags_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_translations: {
        Row: {
          colophon: string | null
          content_compiled: string | null
          content_html: string | null
          content_json: Json | null
          content_mdx: string | null
          content_toc: Json
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          key_points: string[] | null
          locale: string
          meta_description: string | null
          meta_title: string | null
          notes: string[] | null
          og_image_url: string | null
          post_id: string
          pull_quote: string | null
          reading_time_min: number
          seo_extras: Json | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          colophon?: string | null
          content_compiled?: string | null
          content_html?: string | null
          content_json?: Json | null
          content_mdx?: string | null
          content_toc?: Json
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          key_points?: string[] | null
          locale: string
          meta_description?: string | null
          meta_title?: string | null
          notes?: string[] | null
          og_image_url?: string | null
          post_id: string
          pull_quote?: string | null
          reading_time_min?: number
          seo_extras?: Json | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          colophon?: string | null
          content_compiled?: string | null
          content_html?: string | null
          content_json?: Json | null
          content_mdx?: string | null
          content_toc?: Json
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          key_points?: string[] | null
          locale?: string
          meta_description?: string | null
          meta_title?: string | null
          notes?: string[] | null
          og_image_url?: string | null
          post_id?: string
          pull_quote?: string | null
          reading_time_min?: number
          seo_extras?: Json | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      broll_import_log: {
        Row: {
          created_at: string
          created_count: number
          diff_log: Json | null
          error_count: number
          errors: Json | null
          id: string
          imported_by: string | null
          schema_version: string | null
          site_id: string
          skipped_count: number
          source: string
          status: string
          total_items: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          diff_log?: Json | null
          error_count?: number
          errors?: Json | null
          id?: string
          imported_by?: string | null
          schema_version?: string | null
          site_id: string
          skipped_count?: number
          source: string
          status: string
          total_items: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          diff_log?: Json | null
          error_count?: number
          errors?: Json | null
          id?: string
          imported_by?: string | null
          schema_version?: string | null
          site_id?: string
          skipped_count?: number
          source?: string
          status?: string
          total_items?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "broll_import_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      broll_library: {
        Row: {
          asset_id: string
          bitrate_kbps: number | null
          captured_at: string | null
          category: string | null
          codec: string | null
          color_profile: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          fps: number | null
          has_audio: boolean
          height: number | null
          id: string
          location: string | null
          metadata: Json
          original_filename: string
          proxy_url: string | null
          renamed_to: string | null
          resolution: string
          reusable: boolean
          search_vector: unknown
          sha256: string | null
          site_id: string
          source: string
          source_type: string
          status: string
          storage_url: string | null
          subcategory: string | null
          tags: string[]
          thumbnail_url: string | null
          type: string
          updated_at: string
          version: number
          width: number | null
        }
        Insert: {
          asset_id: string
          bitrate_kbps?: number | null
          captured_at?: string | null
          category?: string | null
          codec?: string | null
          color_profile?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          fps?: number | null
          has_audio?: boolean
          height?: number | null
          id?: string
          location?: string | null
          metadata?: Json
          original_filename: string
          proxy_url?: string | null
          renamed_to?: string | null
          resolution?: string
          reusable?: boolean
          search_vector?: unknown
          sha256?: string | null
          site_id: string
          source?: string
          source_type?: string
          status?: string
          storage_url?: string | null
          subcategory?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          version?: number
          width?: number | null
        }
        Update: {
          asset_id?: string
          bitrate_kbps?: number | null
          captured_at?: string | null
          category?: string | null
          codec?: string | null
          color_profile?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          fps?: number | null
          has_audio?: boolean
          height?: number | null
          id?: string
          location?: string | null
          metadata?: Json
          original_filename?: string
          proxy_url?: string | null
          renamed_to?: string | null
          resolution?: string
          reusable?: boolean
          search_vector?: unknown
          sha256?: string | null
          site_id?: string
          source?: string
          source_type?: string
          status?: string
          storage_url?: string | null
          subcategory?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "broll_library_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      broll_library_usage: {
        Row: {
          beat_index: number | null
          broll_asset_id: string
          created_at: string
          id: string
          notes: string | null
          pipeline_item_id: string
          site_id: string
          timecode_in: string | null
          timecode_out: string | null
          usage_type: string
        }
        Insert: {
          beat_index?: number | null
          broll_asset_id: string
          created_at?: string
          id?: string
          notes?: string | null
          pipeline_item_id: string
          site_id: string
          timecode_in?: string | null
          timecode_out?: string | null
          usage_type?: string
        }
        Update: {
          beat_index?: number | null
          broll_asset_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          pipeline_item_id?: string
          site_id?: string
          timecode_in?: string | null
          timecode_out?: string | null
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "broll_library_usage_broll_asset_id_fkey"
            columns: ["broll_asset_id"]
            isOneToOne: false
            referencedRelation: "broll_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broll_library_usage_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broll_library_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_submissions: {
        Row: {
          anonymized_at: string | null
          campaign_id: string
          consent_marketing: boolean
          consent_text_version: string
          download_count: number
          downloaded_at: string | null
          email: string
          id: string
          interest: string | null
          ip: unknown
          locale: string
          name: string | null
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          anonymized_at?: string | null
          campaign_id: string
          consent_marketing: boolean
          consent_text_version: string
          download_count?: number
          downloaded_at?: string | null
          email: string
          id?: string
          interest?: string | null
          ip?: unknown
          locale: string
          name?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          anonymized_at?: string | null
          campaign_id?: string
          consent_marketing?: boolean
          consent_text_version?: string
          download_count?: number
          downloaded_at?: string | null
          email?: string
          id?: string
          interest?: string | null
          ip?: unknown
          locale?: string
          name?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_translations: {
        Row: {
          body_content_md: string | null
          campaign_id: string
          check_mail_text: string
          context_tag: string
          created_at: string
          download_button_label: string
          extras: Json | null
          form_button_label: string
          form_button_loading_label: string
          form_intro_md: string | null
          id: string
          introductory_block_md: string | null
          locale: string
          main_hook_md: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          slug: string
          success_headline: string
          success_headline_duplicate: string
          success_subheadline: string
          success_subheadline_duplicate: string
          supporting_argument_md: string | null
          updated_at: string
        }
        Insert: {
          body_content_md?: string | null
          campaign_id: string
          check_mail_text: string
          context_tag: string
          created_at?: string
          download_button_label: string
          extras?: Json | null
          form_button_label?: string
          form_button_loading_label?: string
          form_intro_md?: string | null
          id?: string
          introductory_block_md?: string | null
          locale: string
          main_hook_md: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          slug: string
          success_headline: string
          success_headline_duplicate: string
          success_subheadline: string
          success_subheadline_duplicate: string
          supporting_argument_md?: string | null
          updated_at?: string
        }
        Update: {
          body_content_md?: string | null
          campaign_id?: string
          check_mail_text?: string
          context_tag?: string
          created_at?: string
          download_button_label?: string
          extras?: Json | null
          form_button_label?: string
          form_button_loading_label?: string
          form_intro_md?: string | null
          id?: string
          introductory_block_md?: string | null
          locale?: string
          main_hook_md?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          slug?: string
          success_headline?: string
          success_headline_duplicate?: string
          success_subheadline?: string
          success_subheadline_duplicate?: string
          supporting_argument_md?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_translations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          form_fields: Json
          id: string
          interest: string
          link_group_id: string | null
          locale: string
          owner_user_id: string | null
          pdf_storage_path: string | null
          published_at: string | null
          scheduled_for: string | null
          site_id: string | null
          social_config: Json | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_fields?: Json
          id?: string
          interest: string
          link_group_id?: string | null
          locale?: string
          owner_user_id?: string | null
          pdf_storage_path?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          site_id?: string | null
          social_config?: Json | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_fields?: Json
          id?: string
          interest?: string
          link_group_id?: string | null
          locale?: string
          owner_user_id?: string | null
          pdf_storage_path?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          site_id?: string | null
          social_config?: Json | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_format_presets: {
        Row: {
          context: string
          created_at: string
          height: number
          id: string
          name: string
          site_id: string
          sort_order: number
          width: number
        }
        Insert: {
          context?: string
          created_at?: string
          height: number
          id?: string
          name: string
          site_id: string
          sort_order?: number
          width: number
        }
        Update: {
          context?: string
          created_at?: string
          height?: number
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_format_presets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_changes: {
        Row: {
          bookmarked: boolean | null
          change_type: string
          detected_at: string | null
          id: string
          new_thumbnail_url: string | null
          new_title: string | null
          old_thumbnail_url: string | null
          old_title: string | null
          site_id: string
          video_id: string
          view_count_at_change: number | null
        }
        Insert: {
          bookmarked?: boolean | null
          change_type: string
          detected_at?: string | null
          id?: string
          new_thumbnail_url?: string | null
          new_title?: string | null
          old_thumbnail_url?: string | null
          old_title?: string | null
          site_id: string
          video_id: string
          view_count_at_change?: number | null
        }
        Update: {
          bookmarked?: boolean | null
          change_type?: string
          detected_at?: string | null
          id?: string
          new_thumbnail_url?: string | null
          new_title?: string | null
          old_thumbnail_url?: string | null
          old_title?: string | null
          site_id?: string
          video_id?: string
          view_count_at_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_changes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_changes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "competitor_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_channel_snapshots: {
        Row: {
          competitor_channel_id: string
          id: string
          snapshot_date: string
          subscriber_count: number | null
          video_count: number | null
          view_count: number | null
        }
        Insert: {
          competitor_channel_id: string
          id?: string
          snapshot_date: string
          subscriber_count?: number | null
          video_count?: number | null
          view_count?: number | null
        }
        Update: {
          competitor_channel_id?: string
          id?: string
          snapshot_date?: string
          subscriber_count?: number | null
          video_count?: number | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_channel_snapshots_competitor_channel_id_fkey"
            columns: ["competitor_channel_id"]
            isOneToOne: false
            referencedRelation: "competitor_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_channels: {
        Row: {
          added_at: string | null
          channel_id: string
          channel_name: string
          full_sync_completed_at: string | null
          id: string
          last_synced_at: string | null
          site_id: string
          subscriber_count: number | null
          sync_error: string | null
          sync_mode: string
          sync_progress: number
          sync_started_at: string | null
          sync_status: string
          thumbnail_url: string | null
          video_limit: number
          youtube_video_count: number | null
        }
        Insert: {
          added_at?: string | null
          channel_id: string
          channel_name?: string
          full_sync_completed_at?: string | null
          id?: string
          last_synced_at?: string | null
          site_id: string
          subscriber_count?: number | null
          sync_error?: string | null
          sync_mode?: string
          sync_progress?: number
          sync_started_at?: string | null
          sync_status?: string
          thumbnail_url?: string | null
          video_limit?: number
          youtube_video_count?: number | null
        }
        Update: {
          added_at?: string | null
          channel_id?: string
          channel_name?: string
          full_sync_completed_at?: string | null
          id?: string
          last_synced_at?: string | null
          site_id?: string
          subscriber_count?: number | null
          sync_error?: string | null
          sync_mode?: string
          sync_progress?: number
          sync_started_at?: string | null
          sync_status?: string
          thumbnail_url?: string | null
          video_limit?: number
          youtube_video_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_channels_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_videos: {
        Row: {
          category_id: string | null
          comment_count: number | null
          competitor_channel_id: string
          description_hash: string | null
          duration_seconds: number | null
          id: string
          is_short: boolean | null
          last_checked_at: string | null
          like_count: number | null
          original_thumbnail_url: string | null
          published_at: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string | null
          video_id: string
          view_count: number | null
        }
        Insert: {
          category_id?: string | null
          comment_count?: number | null
          competitor_channel_id: string
          description_hash?: string | null
          duration_seconds?: number | null
          id?: string
          is_short?: boolean | null
          last_checked_at?: string | null
          like_count?: number | null
          original_thumbnail_url?: string | null
          published_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          video_id: string
          view_count?: number | null
        }
        Update: {
          category_id?: string | null
          comment_count?: number | null
          competitor_channel_id?: string
          description_hash?: string | null
          duration_seconds?: number | null
          id?: string
          is_short?: boolean | null
          last_checked_at?: string | null
          like_count?: number | null
          original_thumbnail_url?: string | null
          published_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_videos_competitor_channel_id_fkey"
            columns: ["competitor_channel_id"]
            isOneToOne: false
            referencedRelation: "competitor_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_texts: {
        Row: {
          category: string
          effective_at: string
          id: string
          locale: string
          superseded_at: string | null
          text_md: string
          version: string
        }
        Insert: {
          category: string
          effective_at?: string
          id: string
          locale?: string
          superseded_at?: string | null
          text_md: string
          version: string
        }
        Update: {
          category?: string
          effective_at?: string
          id?: string
          locale?: string
          superseded_at?: string | null
          text_md?: string
          version?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          anonymous_id: string | null
          category: string
          consent_text_id: string
          granted: boolean
          granted_at: string
          id: string
          ip: unknown
          site_id: string | null
          user_agent: string | null
          user_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          anonymous_id?: string | null
          category: string
          consent_text_id: string
          granted: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          site_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          anonymous_id?: string | null
          category?: string
          consent_text_id?: string
          granted?: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          site_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_consent_text_id_fkey"
            columns: ["consent_text_id"]
            isOneToOne: false
            referencedRelation: "consent_texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_page_settings: {
        Row: {
          auto_reply_text: string | null
          created_at: string
          faq_items: Json | null
          form_title: string | null
          hero_subtitle: string | null
          hero_title: string
          id: string
          locale: string
          response_time_text: string | null
          site_id: string
          subject_options: Json | null
          updated_at: string
        }
        Insert: {
          auto_reply_text?: string | null
          created_at?: string
          faq_items?: Json | null
          form_title?: string | null
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          locale: string
          response_time_text?: string | null
          site_id: string
          subject_options?: Json | null
          updated_at?: string
        }
        Update: {
          auto_reply_text?: string | null
          created_at?: string
          faq_items?: Json | null
          form_title?: string | null
          hero_subtitle?: string | null
          hero_title?: string
          id?: string
          locale?: string
          response_time_text?: string | null
          site_id?: string
          subject_options?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_page_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_page_visibility: {
        Row: {
          created_at: string
          email_highlight: boolean | null
          handwritten_note: boolean | null
          id: string
          show_avatar: boolean | null
          show_bio: boolean | null
          show_contact_form: boolean | null
          show_faq: boolean | null
          show_hero: boolean | null
          show_marketing_consent: boolean | null
          show_response_badge: boolean | null
          show_social_links: boolean | null
          show_subject_selector: boolean | null
          site_id: string
          social_order: Json | null
          social_visible: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_highlight?: boolean | null
          handwritten_note?: boolean | null
          id?: string
          show_avatar?: boolean | null
          show_bio?: boolean | null
          show_contact_form?: boolean | null
          show_faq?: boolean | null
          show_hero?: boolean | null
          show_marketing_consent?: boolean | null
          show_response_badge?: boolean | null
          show_social_links?: boolean | null
          show_subject_selector?: boolean | null
          site_id: string
          social_order?: Json | null
          social_visible?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_highlight?: boolean | null
          handwritten_note?: boolean | null
          id?: string
          show_avatar?: boolean | null
          show_bio?: boolean | null
          show_contact_form?: boolean | null
          show_faq?: boolean | null
          show_hero?: boolean | null
          show_marketing_consent?: boolean | null
          show_response_badge?: boolean | null
          show_social_links?: boolean | null
          show_subject_selector?: boolean | null
          site_id?: string
          social_order?: Json | null
          social_visible?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_page_visibility_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          anonymized_at: string | null
          consent_marketing: boolean
          consent_marketing_text_version: string | null
          consent_processing: boolean
          consent_processing_text_version: string
          email: string
          id: string
          ip: unknown
          message: string
          name: string
          replied_at: string | null
          site_id: string
          subject: string | null
          submitted_at: string
          user_agent: string | null
        }
        Insert: {
          anonymized_at?: string | null
          consent_marketing?: boolean
          consent_marketing_text_version?: string | null
          consent_processing: boolean
          consent_processing_text_version: string
          email: string
          id?: string
          ip?: unknown
          message: string
          name: string
          replied_at?: string | null
          site_id: string
          subject?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Update: {
          anonymized_at?: string | null
          consent_marketing?: boolean
          consent_marketing_text_version?: string | null
          consent_processing?: boolean
          consent_processing_text_version?: string
          email?: string
          id?: string
          ip?: unknown
          message?: string
          name?: string
          replied_at?: string | null
          site_id?: string
          subject?: string | null
          submitted_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_events: {
        Row: {
          anonymous_id: string
          city: string | null
          country: string | null
          created_at: string
          dest_url: string | null
          device_type: string | null
          event_type: string
          has_consent: boolean
          id: string
          link_type: string | null
          locale: string | null
          read_depth: number | null
          referrer_src: string | null
          region: string | null
          resource_id: string
          resource_type: string
          session_id: string
          site_id: string
          time_on_page: number | null
          user_agent: string | null
        }
        Insert: {
          anonymous_id: string
          city?: string | null
          country?: string | null
          created_at?: string
          dest_url?: string | null
          device_type?: string | null
          event_type: string
          has_consent?: boolean
          id?: string
          link_type?: string | null
          locale?: string | null
          read_depth?: number | null
          referrer_src?: string | null
          region?: string | null
          resource_id: string
          resource_type: string
          session_id: string
          site_id: string
          time_on_page?: number | null
          user_agent?: string | null
        }
        Update: {
          anonymous_id?: string
          city?: string | null
          country?: string | null
          created_at?: string
          dest_url?: string | null
          device_type?: string | null
          event_type?: string
          has_consent?: boolean
          id?: string
          link_type?: string | null
          locale?: string | null
          read_depth?: number | null
          referrer_src?: string | null
          region?: string | null
          resource_id?: string
          resource_type?: string
          session_id?: string
          site_id?: string
          time_on_page?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_metrics: {
        Row: {
          avg_read_depth: number
          avg_time_sec: number
          date: string
          id: string
          reads_complete: number
          referrer_direct: number
          referrer_google: number
          referrer_newsletter: number
          referrer_other: number
          referrer_social: number
          resource_id: string
          resource_type: string
          site_id: string
          unique_views: number
          views: number
        }
        Insert: {
          avg_read_depth?: number
          avg_time_sec?: number
          date: string
          id?: string
          reads_complete?: number
          referrer_direct?: number
          referrer_google?: number
          referrer_newsletter?: number
          referrer_other?: number
          referrer_social?: number
          resource_id: string
          resource_type: string
          site_id: string
          unique_views?: number
          views?: number
        }
        Update: {
          avg_read_depth?: number
          avg_time_sec?: number
          date?: string
          id?: string
          reads_complete?: number
          referrer_direct?: number
          referrer_google?: number
          referrer_newsletter?: number
          referrer_other?: number
          referrer_social?: number
          resource_id?: string
          resource_type?: string
          site_id?: string
          unique_views?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pipeline: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          assigned_to: string | null
          blog_post_id: string | null
          body_compiled: string | null
          body_content: string | null
          campaign_id: string | null
          category: string | null
          code: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          duration_target: number | null
          format: string
          format_metadata: Json
          hook: string | null
          id: string
          is_archived: boolean
          language: string
          materialized_rev_en: number | null
          materialized_rev_pt: number | null
          newsletter_edition_id: string | null
          parent_id: string | null
          priority: number
          production_checklist: Json
          scheduled_at: string | null
          search_vector: unknown
          sections: Json | null
          site_id: string
          social_config: Json | null
          social_post_id: string | null
          sort_order: number
          stage: string
          synopsis: string | null
          tags: string[]
          title_en: string | null
          title_pt: string | null
          updated_at: string
          validation_score: Json
          version: number
          workflow_context: Json | null
          youtube_channel_id: string | null
          youtube_video_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          blog_post_id?: string | null
          body_compiled?: string | null
          body_content?: string | null
          campaign_id?: string | null
          category?: string | null
          code: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_target?: number | null
          format: string
          format_metadata?: Json
          hook?: string | null
          id?: string
          is_archived?: boolean
          language?: string
          materialized_rev_en?: number | null
          materialized_rev_pt?: number | null
          newsletter_edition_id?: string | null
          parent_id?: string | null
          priority?: number
          production_checklist?: Json
          scheduled_at?: string | null
          search_vector?: unknown
          sections?: Json | null
          site_id: string
          social_config?: Json | null
          social_post_id?: string | null
          sort_order?: number
          stage: string
          synopsis?: string | null
          tags?: string[]
          title_en?: string | null
          title_pt?: string | null
          updated_at?: string
          validation_score?: Json
          version?: number
          workflow_context?: Json | null
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          blog_post_id?: string | null
          body_compiled?: string | null
          body_content?: string | null
          campaign_id?: string | null
          category?: string | null
          code?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          duration_target?: number | null
          format?: string
          format_metadata?: Json
          hook?: string | null
          id?: string
          is_archived?: boolean
          language?: string
          materialized_rev_en?: number | null
          materialized_rev_pt?: number | null
          newsletter_edition_id?: string | null
          parent_id?: string | null
          priority?: number
          production_checklist?: Json
          scheduled_at?: string | null
          search_vector?: unknown
          sections?: Json | null
          site_id?: string
          social_config?: Json | null
          social_post_id?: string | null
          sort_order?: number
          stage?: string
          synopsis?: string | null
          tags?: string[]
          title_en?: string | null
          title_pt?: string | null
          updated_at?: string
          validation_score?: Json
          version?: number
          workflow_context?: Json | null
          youtube_channel_id?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pipeline_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_newsletter_edition_id_fkey"
            columns: ["newsletter_edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_social_post_id_fkey"
            columns: ["social_post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_workflow_fk"
            columns: ["format", "stage"]
            isOneToOne: false
            referencedRelation: "pipeline_workflows"
            referencedColumns: ["format", "stage"]
          },
          {
            foreignKeyName: "content_pipeline_youtube_channel_id_fkey"
            columns: ["youtube_channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pipeline_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pipeline_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          event_type: string
          from_value: string | null
          id: string
          pipeline_id: string
          to_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          pipeline_id: string
          to_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          pipeline_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pipeline_history_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cron_health: {
        Row: {
          consecutive_failures: number
          cron_name: string
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          cron_name: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          cron_name?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          duration_ms: number | null
          error: string | null
          id: string
          items_processed: number | null
          job: string
          ran_at: string
          status: string
        }
        Insert: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          items_processed?: number | null
          job: string
          ran_at?: string
          status: string
        }
        Update: {
          duration_ms?: number | null
          error?: string | null
          id?: string
          items_processed?: number | null
          job?: string
          ran_at?: string
          status?: string
        }
        Relationships: []
      }
      fan_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_type: string
          link_id: string | null
          platform: string
          post_id: string | null
          raw: Json | null
          site_id: string
          visitor_hash: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_type: string
          link_id?: string | null
          platform: string
          post_id?: string | null
          raw?: Json | null
          site_id: string
          visitor_hash: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_type?: string
          link_id?: string | null
          platform?: string
          post_id?: string | null
          raw?: Json | null
          site_id?: string
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_interactions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_interactions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_interactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_interactions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          name: string
          site_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          site_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "hashtags_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          display_slots: number
          handle: string
          id: string
          ig_user_id: string | null
          last_synced_at: string | null
          layout_type: string
          locale: string
          section_subtitle_en: string | null
          section_subtitle_pt: string | null
          section_title_en: string | null
          section_title_pt: string | null
          site_id: string
          sync_enabled: boolean
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          display_slots?: number
          handle: string
          id?: string
          ig_user_id?: string | null
          last_synced_at?: string | null
          layout_type?: string
          locale?: string
          section_subtitle_en?: string | null
          section_subtitle_pt?: string | null
          section_title_en?: string | null
          section_title_pt?: string | null
          site_id: string
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          display_slots?: number
          handle?: string
          id?: string
          ig_user_id?: string | null
          last_synced_at?: string | null
          layout_type?: string
          locale?: string
          section_subtitle_en?: string | null
          section_subtitle_pt?: string | null
          section_title_en?: string | null
          section_title_pt?: string | null
          site_id?: string
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_feed_slots: {
        Row: {
          account_id: string
          created_at: string
          id: string
          position: number
          post_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          position: number
          post_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          position?: number
          post_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_feed_slots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_feed_slots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_feed_slots_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "instagram_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          account_id: string
          cached_image_url: string | null
          caption: string | null
          comments_count: number
          created_at: string
          id: string
          ig_media_id: string
          ig_timestamp: string
          like_count: number
          media_type: string
          media_url: string | null
          permalink: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          cached_image_url?: string | null
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          ig_media_id: string
          ig_timestamp: string
          like_count?: number
          media_type: string
          media_url?: string | null
          permalink: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          cached_image_url?: string | null
          caption?: string | null
          comments_count?: number
          created_at?: string
          id?: string
          ig_media_id?: string
          ig_timestamp?: string
          like_count?: number
          media_type?: string
          media_url?: string | null
          permalink?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_posts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts_public"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_sync_log: {
        Row: {
          account_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          media_cached: number
          mode: string
          posts_found: number
          posts_inserted: number
          posts_updated: number
          site_id: string
          started_at: string
          status: string
        }
        Insert: {
          account_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          media_cached?: number
          mode: string
          posts_found?: number
          posts_inserted?: number
          posts_updated?: number
          site_id: string
          started_at?: string
          status: string
        }
        Update: {
          account_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          media_cached?: number
          mode?: string
          posts_found?: number
          posts_inserted?: number
          posts_updated?: number
          site_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_sync_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_sync_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "instagram_accounts_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_sync_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          last_sent_at: string
          org_id: string
          resend_count: number
          resent_at: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          role: string
          role_scope: string
          site_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          org_id: string
          resend_count?: number
          resent_at?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role: string
          role_scope?: string
          site_id?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          org_id?: string
          resend_count?: number
          resent_at?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role?: string
          role_scope?: string
          site_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      kill_switches: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lgpd_migration_backup_v1: {
        Row: {
          backed_up_at: string | null
          row_snapshot: Json
          table_name: string
        }
        Insert: {
          backed_up_at?: string | null
          row_snapshot: Json
          table_name: string
        }
        Update: {
          backed_up_at?: string | null
          row_snapshot?: Json
          table_name?: string
        }
        Relationships: []
      }
      lgpd_requests: {
        Row: {
          blob_deleted_at: string | null
          blob_path: string | null
          blob_uploaded_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmation_token_hash: string | null
          confirmed_at: string | null
          id: string
          metadata: Json
          phase: number | null
          phase_1_completed_at: string | null
          phase_3_completed_at: string | null
          requested_at: string
          scheduled_purge_at: string | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          blob_deleted_at?: string | null
          blob_path?: string | null
          blob_uploaded_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          id?: string
          metadata?: Json
          phase?: number | null
          phase_1_completed_at?: string | null
          phase_3_completed_at?: string | null
          requested_at?: string
          scheduled_purge_at?: string | null
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          blob_deleted_at?: string | null
          blob_path?: string | null
          blob_uploaded_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          id?: string
          metadata?: Json
          phase?: number | null
          phase_1_completed_at?: string | null
          phase_3_completed_at?: string | null
          requested_at?: string
          scheduled_purge_at?: string | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      link_aggregation_watermark: {
        Row: {
          id: string
          last_processed_at: string
        }
        Insert: {
          id: string
          last_processed_at?: string
        }
        Update: {
          id?: string
          last_processed_at?: string
        }
        Relationships: []
      }
      link_alerts: {
        Row: {
          active: boolean
          alert_type: string
          condition: Json
          created_at: string
          created_by: string | null
          id: string
          last_triggered_at: string | null
          link_id: string
          metric: string
          notify_channels: Json
          site_id: string
        }
        Insert: {
          active?: boolean
          alert_type: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          last_triggered_at?: string | null
          link_id: string
          metric: string
          notify_channels?: Json
          site_id: string
        }
        Update: {
          active?: boolean
          alert_type?: string
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          last_triggered_at?: string | null
          link_id?: string
          metric?: string
          notify_channels?: Json
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_link_alerts_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_link_alerts_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_alerts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_annotations: {
        Row: {
          annotated_at: string
          color: string | null
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          label: string
          link_id: string
          site_id: string
        }
        Insert: {
          annotated_at?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          label: string
          link_id: string
          site_id: string
        }
        Update: {
          annotated_at?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          label?: string
          link_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_link_annotations_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_link_annotations_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_annotations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          ad_click_ids: Json | null
          browser: string | null
          city: string | null
          clicked_at: string
          conversion_id: string | null
          conversion_type: string | null
          conversion_value: number | null
          converted_at: string | null
          country: string | null
          device_type: string | null
          id: string
          ip: string | null
          is_bot: boolean
          is_returning: boolean
          is_unique: boolean
          language: string | null
          link_id: string
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id?: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks_2026_05: {
        Row: {
          ad_click_ids: Json | null
          browser: string | null
          city: string | null
          clicked_at: string
          conversion_id: string | null
          conversion_type: string | null
          conversion_value: number | null
          converted_at: string | null
          country: string | null
          device_type: string | null
          id: string
          ip: string | null
          is_bot: boolean
          is_returning: boolean
          is_unique: boolean
          language: string | null
          link_id: string
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id?: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      link_clicks_2026_06: {
        Row: {
          ad_click_ids: Json | null
          browser: string | null
          city: string | null
          clicked_at: string
          conversion_id: string | null
          conversion_type: string | null
          conversion_value: number | null
          converted_at: string | null
          country: string | null
          device_type: string | null
          id: string
          ip: string | null
          is_bot: boolean
          is_returning: boolean
          is_unique: boolean
          language: string | null
          link_id: string
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id?: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      link_clicks_2026_07: {
        Row: {
          ad_click_ids: Json | null
          browser: string | null
          city: string | null
          clicked_at: string
          conversion_id: string | null
          conversion_type: string | null
          conversion_value: number | null
          converted_at: string | null
          country: string | null
          device_type: string | null
          id: string
          ip: string | null
          is_bot: boolean
          is_returning: boolean
          is_unique: boolean
          language: string | null
          link_id: string
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id?: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      link_clicks_default: {
        Row: {
          ad_click_ids: Json | null
          browser: string | null
          city: string | null
          clicked_at: string
          conversion_id: string | null
          conversion_type: string | null
          conversion_value: number | null
          converted_at: string | null
          country: string | null
          device_type: string | null
          id: string
          ip: string | null
          is_bot: boolean
          is_returning: boolean
          is_unique: boolean
          language: string | null
          link_id: string
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          ad_click_ids?: Json | null
          browser?: string | null
          city?: string | null
          clicked_at?: string
          conversion_id?: string | null
          conversion_type?: string | null
          conversion_value?: number | null
          converted_at?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_returning?: boolean
          is_unique?: boolean
          language?: string | null
          link_id?: string
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      link_daily_metrics: {
        Row: {
          bot_clicks: number
          cities: Json
          clicks: number
          conversion_value: number
          conversions: number
          countries: Json
          date: string
          desktop_clicks: number
          hourly_clicks: Json
          id: string
          link_id: string
          mobile_clicks: number
          ref_direct: number
          ref_email: number
          ref_other: number
          ref_referral: number
          ref_search: number
          ref_social: number
          site_id: string
          tablet_clicks: number
          unique_visitors: number
          weekday: number
        }
        Insert: {
          bot_clicks?: number
          cities?: Json
          clicks?: number
          conversion_value?: number
          conversions?: number
          countries?: Json
          date: string
          desktop_clicks?: number
          hourly_clicks?: Json
          id?: string
          link_id: string
          mobile_clicks?: number
          ref_direct?: number
          ref_email?: number
          ref_other?: number
          ref_referral?: number
          ref_search?: number
          ref_social?: number
          site_id: string
          tablet_clicks?: number
          unique_visitors?: number
          weekday: number
        }
        Update: {
          bot_clicks?: number
          cities?: Json
          clicks?: number
          conversion_value?: number
          conversions?: number
          countries?: Json
          date?: string
          desktop_clicks?: number
          hourly_clicks?: Json
          id?: string
          link_id?: string
          mobile_clicks?: number
          ref_direct?: number
          ref_email?: number
          ref_other?: number
          ref_referral?: number
          ref_search?: number
          ref_social?: number
          site_id?: string
          tablet_clicks?: number
          unique_visitors?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_link_daily_metrics_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_link_daily_metrics_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_daily_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_goals: {
        Row: {
          created_at: string
          created_by: string | null
          deadline: string | null
          id: string
          link_id: string
          metric: string
          notify_channels: Json
          reached_at: string | null
          site_id: string
          target_value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          link_id: string
          metric: string
          notify_channels?: Json
          reached_at?: string | null
          site_id: string
          target_value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          id?: string
          link_id?: string
          metric?: string
          notify_channels?: Json
          reached_at?: string | null
          site_id?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_link_goals_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_link_goals_link"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_goals_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_in_bio_entries: {
        Row: {
          created_at: string | null
          id: string
          link_id: string
          position: number
          post_id: string
          site_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link_id: string
          position: number
          post_id: string
          site_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link_id?: string
          position?: number
          post_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_in_bio_entries_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_in_bio_entries_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_in_bio_entries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_in_bio_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_qr_cards: {
        Row: {
          composition: Json | null
          config: Json
          created_at: string
          id: string
          link_id: string
          name: string
          preview_url: string | null
          site_id: string
          sort_order: number
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          composition?: Json | null
          config?: Json
          created_at?: string
          id?: string
          link_id: string
          name?: string
          preview_url?: string | null
          site_id: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          composition?: Json | null
          config?: Json
          created_at?: string
          id?: string
          link_id?: string
          name?: string
          preview_url?: string | null
          site_id?: string
          sort_order?: number
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_qr_cards_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_qr_cards_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_qr_cards_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_qr_templates: {
        Row: {
          composition: Json | null
          config: Json
          created_at: string
          id: string
          name: string
          site_id: string
          sort_order: number
          thumbnail_path: string | null
          thumbnail_url: string | null
        }
        Insert: {
          composition?: Json | null
          config?: Json
          created_at?: string
          id?: string
          name: string
          site_id: string
          sort_order?: number
          thumbnail_path?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          composition?: Json | null
          config?: Json
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          thumbnail_path?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_qr_templates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_settings: {
        Row: {
          auto_qr: boolean
          bot_filtering: boolean
          config: Json
          created_at: string
          default_code_length: number
          default_redirect_type: number
          id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          auto_qr?: boolean
          bot_filtering?: boolean
          config?: Json
          created_at?: string
          default_code_length?: number
          default_redirect_type?: number
          id?: string
          site_id: string
          updated_at?: string
        }
        Update: {
          auto_qr?: boolean
          bot_filtering?: boolean
          config?: Json
          created_at?: string
          default_code_length?: number
          default_redirect_type?: number
          id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_utm_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          site_id: string
          sort_order: number
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          site_id: string
          sort_order?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_utm_presets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      linktree_block_metrics: {
        Row: {
          block_id: string
          clicks: number
          created_at: string
          date: string
          id: string
          site_id: string
          unique_visitors: number
        }
        Insert: {
          block_id: string
          clicks?: number
          created_at?: string
          date: string
          id?: string
          site_id: string
          unique_visitors?: number
        }
        Update: {
          block_id?: string
          clicks?: number
          created_at?: string
          date?: string
          id?: string
          site_id?: string
          unique_visitors?: number
        }
        Relationships: [
          {
            foreignKeyName: "linktree_block_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      linktree_daily_metrics: {
        Row: {
          bot_views: number
          countries: Json
          date: string
          desktop_views: number
          hourly_views: Json
          id: string
          link_clicks: number
          link_clicks_by_key: Json
          mobile_views: number
          pageviews: number
          ref_direct: number
          ref_email: number
          ref_other: number
          ref_referral: number
          ref_search: number
          ref_social: number
          site_id: string
          tablet_views: number
          unique_visitors: number
          weekday: number
        }
        Insert: {
          bot_views?: number
          countries?: Json
          date: string
          desktop_views?: number
          hourly_views?: Json
          id?: string
          link_clicks?: number
          link_clicks_by_key?: Json
          mobile_views?: number
          pageviews?: number
          ref_direct?: number
          ref_email?: number
          ref_other?: number
          ref_referral?: number
          ref_search?: number
          ref_social?: number
          site_id: string
          tablet_views?: number
          unique_visitors?: number
          weekday: number
        }
        Update: {
          bot_views?: number
          countries?: Json
          date?: string
          desktop_views?: number
          hourly_views?: Json
          id?: string
          link_clicks?: number
          link_clicks_by_key?: Json
          mobile_views?: number
          pageviews?: number
          ref_direct?: number
          ref_email?: number
          ref_other?: number
          ref_referral?: number
          ref_search?: number
          ref_social?: number
          site_id?: string
          tablet_views?: number
          unique_visitors?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "linktree_daily_metrics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      linktree_events: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip: string | null
          is_bot: boolean
          is_unique: boolean
          language: string | null
          link_key: string | null
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linktree_events_site_fk"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      linktree_events_2026_05: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip: string | null
          is_bot: boolean
          is_unique: boolean
          language: string | null
          link_key: string | null
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      linktree_events_2026_06: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip: string | null
          is_bot: boolean
          is_unique: boolean
          language: string | null
          link_key: string | null
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      linktree_events_2026_07: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip: string | null
          is_bot: boolean
          is_unique: boolean
          language: string | null
          link_key: string | null
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      linktree_events_default: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          ip: string | null
          is_bot: boolean
          is_unique: boolean
          language: string | null
          link_key: string | null
          os: string | null
          referrer_domain: string | null
          referrer_source: string | null
          referrer_url: string | null
          region: string | null
          site_id: string
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          is_bot?: boolean
          is_unique?: boolean
          language?: string | null
          link_key?: string | null
          os?: string | null
          referrer_domain?: string | null
          referrer_source?: string | null
          referrer_url?: string | null
          region?: string | null
          site_id?: string
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      media_asset_usage: {
        Row: {
          asset_id: string
          created_at: string
          field_name: string
          id: string
          resource_id: string
          resource_type: Database["public"]["Enums"]["media_usage_resource"]
        }
        Insert: {
          asset_id: string
          created_at?: string
          field_name: string
          id?: string
          resource_id: string
          resource_type: Database["public"]["Enums"]["media_usage_resource"]
        }
        Update: {
          asset_id?: string
          created_at?: string
          field_name?: string
          id?: string
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["media_usage_resource"]
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_usage_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          blob_pathname: string
          blob_url: string
          content_hash: string
          created_at: string
          deleted_at: string | null
          file_size: number
          filename: string
          folder: string
          height: number | null
          id: string
          mime_type: string
          site_id: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          blob_pathname: string
          blob_url: string
          content_hash: string
          created_at?: string
          deleted_at?: string | null
          file_size: number
          filename: string
          folder?: string
          height?: number | null
          id?: string
          mime_type: string
          site_id: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          blob_pathname?: string
          blob_url?: string
          content_hash?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number
          filename?: string
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string
          site_id?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_editions: {
        Row: {
          ab_parent_id: string | null
          ab_sample_pct: number
          ab_variant: string | null
          ab_wait_hours: number
          ab_winner_decided_at: string | null
          content_html: string | null
          content_json: Json | null
          content_mdx: string | null
          created_at: string
          created_by: string | null
          delivery_alerted: boolean
          edition_kind: string
          error_message: string | null
          id: string
          idea_created_at: string | null
          idea_notes: string | null
          max_retries: number
          newsletter_type_id: string | null
          notes: string | null
          paired_edition_id: string | null
          preheader: string | null
          queue_position: number | null
          retry_count: number
          review_entered_at: string | null
          scheduled_at: string | null
          segment: string
          send_count: number
          sent_at: string | null
          site_id: string
          slot_date: string | null
          social_config: Json | null
          source_blog_post_id: string | null
          stats_bounces: number
          stats_clicks: number
          stats_complaints: number
          stats_delivered: number
          stats_opens: number
          stats_stale: boolean
          stats_unsubs: number
          status: string
          subject: string
          test_sent_at: string | null
          total_subscribers: number
          updated_at: string
          web_archive_enabled: boolean
        }
        Insert: {
          ab_parent_id?: string | null
          ab_sample_pct?: number
          ab_variant?: string | null
          ab_wait_hours?: number
          ab_winner_decided_at?: string | null
          content_html?: string | null
          content_json?: Json | null
          content_mdx?: string | null
          created_at?: string
          created_by?: string | null
          delivery_alerted?: boolean
          edition_kind?: string
          error_message?: string | null
          id?: string
          idea_created_at?: string | null
          idea_notes?: string | null
          max_retries?: number
          newsletter_type_id?: string | null
          notes?: string | null
          paired_edition_id?: string | null
          preheader?: string | null
          queue_position?: number | null
          retry_count?: number
          review_entered_at?: string | null
          scheduled_at?: string | null
          segment?: string
          send_count?: number
          sent_at?: string | null
          site_id: string
          slot_date?: string | null
          social_config?: Json | null
          source_blog_post_id?: string | null
          stats_bounces?: number
          stats_clicks?: number
          stats_complaints?: number
          stats_delivered?: number
          stats_opens?: number
          stats_stale?: boolean
          stats_unsubs?: number
          status?: string
          subject: string
          test_sent_at?: string | null
          total_subscribers?: number
          updated_at?: string
          web_archive_enabled?: boolean
        }
        Update: {
          ab_parent_id?: string | null
          ab_sample_pct?: number
          ab_variant?: string | null
          ab_wait_hours?: number
          ab_winner_decided_at?: string | null
          content_html?: string | null
          content_json?: Json | null
          content_mdx?: string | null
          created_at?: string
          created_by?: string | null
          delivery_alerted?: boolean
          edition_kind?: string
          error_message?: string | null
          id?: string
          idea_created_at?: string | null
          idea_notes?: string | null
          max_retries?: number
          newsletter_type_id?: string | null
          notes?: string | null
          paired_edition_id?: string | null
          preheader?: string | null
          queue_position?: number | null
          retry_count?: number
          review_entered_at?: string | null
          scheduled_at?: string | null
          segment?: string
          send_count?: number
          sent_at?: string | null
          site_id?: string
          slot_date?: string | null
          social_config?: Json | null
          source_blog_post_id?: string | null
          stats_bounces?: number
          stats_clicks?: number
          stats_complaints?: number
          stats_delivered?: number
          stats_opens?: number
          stats_stale?: boolean
          stats_unsubs?: number
          status?: string
          subject?: string
          test_sent_at?: string | null
          total_subscribers?: number
          updated_at?: string
          web_archive_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_editions_ab_parent_id_fkey"
            columns: ["ab_parent_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_editions_newsletter_type_id_fkey"
            columns: ["newsletter_type_id"]
            isOneToOne: false
            referencedRelation: "newsletter_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_editions_paired_edition_id_fkey"
            columns: ["paired_edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_editions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_editions_source_blog_post_id_fkey"
            columns: ["source_blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_sends: {
        Row: {
          bounce_type: string | null
          clicked_at: string | null
          created_at: string
          delivered_at: string | null
          edition_id: string
          id: string
          last_attempt_at: string | null
          link_id: string | null
          link_rewrite_enabled: boolean
          open_ip: unknown
          open_user_agent: string | null
          opened_at: string | null
          provider_message_id: string | null
          status: string
          subscriber_email: string
        }
        Insert: {
          bounce_type?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          edition_id: string
          id?: string
          last_attempt_at?: string | null
          link_id?: string | null
          link_rewrite_enabled?: boolean
          open_ip?: unknown
          open_user_agent?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          status?: string
          subscriber_email: string
        }
        Update: {
          bounce_type?: string | null
          clicked_at?: string | null
          created_at?: string
          delivered_at?: string | null
          edition_id?: string
          id?: string
          last_attempt_at?: string | null
          link_id?: string | null
          link_rewrite_enabled?: boolean
          open_ip?: unknown
          open_user_agent?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          status?: string
          subscriber_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_sends_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscriptions: {
        Row: {
          confirmation_expires_at: string | null
          confirmation_token_hash: string | null
          confirmed_at: string | null
          consent_text_version: string
          email: string
          id: string
          ip: unknown
          locale: string | null
          newsletter_id: string
          referrer: string | null
          site_id: string
          source: string | null
          status: string
          subscribed_at: string
          tracking_consent: boolean
          unsubscribed_at: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          welcome_sent: boolean
        }
        Insert: {
          confirmation_expires_at?: string | null
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          consent_text_version: string
          email: string
          id?: string
          ip?: unknown
          locale?: string | null
          newsletter_id: string
          referrer?: string | null
          site_id: string
          source?: string | null
          status: string
          subscribed_at?: string
          tracking_consent?: boolean
          unsubscribed_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          welcome_sent?: boolean
        }
        Update: {
          confirmation_expires_at?: string | null
          confirmation_token_hash?: string | null
          confirmed_at?: string | null
          consent_text_version?: string
          email?: string
          id?: string
          ip?: unknown
          locale?: string | null
          newsletter_id?: string
          referrer?: string | null
          site_id?: string
          source?: string | null
          status?: string
          subscribed_at?: string
          tracking_consent?: boolean
          unsubscribed_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          welcome_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscriptions_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletter_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_subscriptions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_types: {
        Row: {
          active: boolean
          author_id: string | null
          badge: string | null
          cadence_days: number
          cadence_label: string | null
          cadence_pattern: Json | null
          cadence_paused: boolean
          cadence_start_date: string | null
          color: string
          color_dark: string | null
          created_at: string
          description: string | null
          id: string
          landing_content: Json
          last_sent_at: string | null
          linked_tag_id: string | null
          locale: string
          max_bounce_rate_pct: number
          name: string
          og_image_url: string | null
          preferred_send_time: string
          reply_to: string | null
          sender_email: string | null
          sender_name: string | null
          site_id: string
          slug: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          author_id?: string | null
          badge?: string | null
          cadence_days?: number
          cadence_label?: string | null
          cadence_pattern?: Json | null
          cadence_paused?: boolean
          cadence_start_date?: string | null
          color?: string
          color_dark?: string | null
          created_at?: string
          description?: string | null
          id: string
          landing_content?: Json
          last_sent_at?: string | null
          linked_tag_id?: string | null
          locale: string
          max_bounce_rate_pct?: number
          name: string
          og_image_url?: string | null
          preferred_send_time?: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          site_id: string
          slug: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          author_id?: string | null
          badge?: string | null
          cadence_days?: number
          cadence_label?: string | null
          cadence_pattern?: Json | null
          cadence_paused?: boolean
          cadence_start_date?: string | null
          color?: string
          color_dark?: string | null
          created_at?: string
          description?: string | null
          id?: string
          landing_content?: Json
          last_sent_at?: string | null
          linked_tag_id?: string | null
          locale?: string
          max_bounce_rate_pct?: number
          name?: string
          og_image_url?: string | null
          preferred_send_time?: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          site_id?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_types_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_types_linked_tag_id_fkey"
            columns: ["linked_tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_types_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          id: string
          last_error: string | null
          next_retry_at: string | null
          notification_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          notification_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          notification_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string | null
          channel_email: boolean
          channel_in_app: boolean
          channel_push: boolean
          channel_telegram: boolean
          email_consent_at: string | null
          frequency_mode: string
          id: string
          push_consent_at: string | null
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          quiet_hours_timezone: string
          site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          channel_email?: boolean
          channel_in_app?: boolean
          channel_push?: boolean
          channel_telegram?: boolean
          email_consent_at?: string | null
          frequency_mode?: string
          id?: string
          push_consent_at?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          quiet_hours_timezone?: string
          site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          channel_email?: boolean
          channel_in_app?: boolean
          channel_push?: boolean
          channel_telegram?: boolean
          email_consent_at?: string | null
          frequency_mode?: string
          id?: string
          push_consent_at?: string | null
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          quiet_hours_timezone?: string
          site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_types: {
        Row: {
          cooldown_secs: number | null
          dedup_key: string | null
          description: string | null
          domain: string
          group_key: string | null
          min_role: string
          phase: number
          priority: number
          title_template: string
          type: string
        }
        Insert: {
          cooldown_secs?: number | null
          dedup_key?: string | null
          description?: string | null
          domain: string
          group_key?: string | null
          min_role?: string
          phase?: number
          priority: number
          title_template: string
          type: string
        }
        Update: {
          cooldown_secs?: number | null
          dedup_key?: string | null
          description?: string | null
          domain?: string
          group_key?: string | null
          min_role?: string
          phase?: number
          priority?: number
          title_template?: string
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_href: string | null
          created_at: string
          dedup_key: string | null
          dismissed_at: string | null
          domain: string
          expired_at: string | null
          group_key: string | null
          id: string
          message: string | null
          payload: Json | null
          priority: number
          read_at: string | null
          site_id: string
          snoozed_until: string | null
          suggested_action: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_href?: string | null
          created_at?: string
          dedup_key?: string | null
          dismissed_at?: string | null
          domain: string
          expired_at?: string | null
          group_key?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          priority: number
          read_at?: string | null
          site_id: string
          snoozed_until?: string | null
          suggested_action?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          action_href?: string | null
          created_at?: string
          dedup_key?: string | null
          dismissed_at?: string | null
          domain?: string
          expired_at?: string | null
          group_key?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          priority?: number
          read_at?: string | null
          site_id?: string
          snoozed_until?: string | null
          suggested_action?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_cycles: {
        Row: {
          ab_test_id: string | null
          cooldown_until: string | null
          created_at: string
          cycle_number: number
          diagnosed_at: string | null
          diagnosis_summary: string | null
          flagged_at: string | null
          id: string
          monitoring_day14_at: string | null
          monitoring_day14_result: Json | null
          monitoring_day30_at: string | null
          monitoring_day30_result: Json | null
          monitoring_day7_at: string | null
          monitoring_day7_result: Json | null
          resolved_at: string | null
          resolved_reason: string | null
          site_id: string
          state: string
          test_completed_at: string | null
          test_suggested_at: string | null
          test_suggestion: Json | null
          test_winner_applied_at: string | null
          testing_started_at: string | null
          updated_at: string
          youtube_video_id: string
        }
        Insert: {
          ab_test_id?: string | null
          cooldown_until?: string | null
          created_at?: string
          cycle_number?: number
          diagnosed_at?: string | null
          diagnosis_summary?: string | null
          flagged_at?: string | null
          id?: string
          monitoring_day14_at?: string | null
          monitoring_day14_result?: Json | null
          monitoring_day30_at?: string | null
          monitoring_day30_result?: Json | null
          monitoring_day7_at?: string | null
          monitoring_day7_result?: Json | null
          resolved_at?: string | null
          resolved_reason?: string | null
          site_id: string
          state?: string
          test_completed_at?: string | null
          test_suggested_at?: string | null
          test_suggestion?: Json | null
          test_winner_applied_at?: string | null
          testing_started_at?: string | null
          updated_at?: string
          youtube_video_id: string
        }
        Update: {
          ab_test_id?: string | null
          cooldown_until?: string | null
          created_at?: string
          cycle_number?: number
          diagnosed_at?: string | null
          diagnosis_summary?: string | null
          flagged_at?: string | null
          id?: string
          monitoring_day14_at?: string | null
          monitoring_day14_result?: Json | null
          monitoring_day30_at?: string | null
          monitoring_day30_result?: Json | null
          monitoring_day7_at?: string | null
          monitoring_day7_result?: Json | null
          resolved_at?: string | null
          resolved_reason?: string | null
          site_id?: string
          state?: string
          test_completed_at?: string | null
          test_suggested_at?: string | null
          test_suggestion?: Json | null
          test_winner_applied_at?: string | null
          testing_started_at?: string | null
          updated_at?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "optimization_cycles_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_cycles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optimization_cycles_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          adsense_connected_at: string | null
          adsense_last_sync_at: string | null
          adsense_publisher_id: string | null
          adsense_refresh_token_enc: string | null
          adsense_sync_status: string
          created_at: string
          id: string
          name: string
          parent_org_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          adsense_connected_at?: string | null
          adsense_last_sync_at?: string | null
          adsense_publisher_id?: string | null
          adsense_refresh_token_enc?: string | null
          adsense_sync_status?: string
          created_at?: string
          id?: string
          name: string
          parent_org_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          adsense_connected_at?: string | null
          adsense_last_sync_at?: string | null
          adsense_publisher_id?: string | null
          adsense_refresh_token_enc?: string | null
          adsense_sync_status?: string
          created_at?: string
          id?: string
          name?: string
          parent_org_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      page_content: {
        Row: {
          content: Json
          id: string
          locale: string
          page: string
          site_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          locale: string
          page: string
          site_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          locale?: string
          page?: string
          site_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_content_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip: unknown
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip?: unknown
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip?: unknown
        }
        Relationships: []
      }
      pipeline_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          permissions: string[]
          revoked_at: string | null
          site_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          permissions?: string[]
          revoked_at?: string | null
          site_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          revoked_at?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_api_keys_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_dependencies: {
        Row: {
          blocked_id: string
          blocker_id: string
          dependency_type: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          dependency_type?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          dependency_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_dependencies_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_dependencies_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_workflows: {
        Row: {
          format: string
          label_en: string
          label_pt: string
          position: number
          stage: string
        }
        Insert: {
          format: string
          label_en: string
          label_pt: string
          position: number
          stage: string
        }
        Update: {
          format?: string
          label_en?: string
          label_pt?: string
          position?: number
          stage?: string
        }
        Relationships: []
      }
      playlist_edges: {
        Row: {
          created_at: string
          edge_type: string
          id: string
          label: string | null
          playlist_id: string
          source_item_id: string
          target_item_id: string
        }
        Insert: {
          created_at?: string
          edge_type?: string
          id?: string
          label?: string | null
          playlist_id: string
          source_item_id: string
          target_item_id: string
        }
        Update: {
          created_at?: string
          edge_type?: string
          id?: string
          label?: string | null
          playlist_id?: string
          source_item_id?: string
          target_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_edges_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_edges_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "playlist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_edges_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "playlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          blog_post_id: string | null
          created_at: string
          id: string
          newsletter_edition_id: string | null
          pipeline_id: string | null
          playlist_id: string
          position_x: number
          position_y: number
          sort_order: number
        }
        Insert: {
          blog_post_id?: string | null
          created_at?: string
          id?: string
          newsletter_edition_id?: string | null
          pipeline_id?: string | null
          playlist_id: string
          position_x?: number
          position_y?: number
          sort_order?: number
        }
        Update: {
          blog_post_id?: string | null
          created_at?: string
          id?: string
          newsletter_edition_id?: string | null
          pipeline_id?: string | null
          playlist_id?: string
          position_x?: number
          position_y?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_newsletter_edition_id_fkey"
            columns: ["newsletter_edition_id"]
            isOneToOne: false
            referencedRelation: "newsletter_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_snapshots: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          graph_data: Json
          id: string
          label: string | null
          playlist_id: string
          site_id: string
          stats: Json
          type: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          graph_data: Json
          id?: string
          label?: string | null
          playlist_id: string
          site_id: string
          stats?: Json
          type: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          graph_data?: Json
          id?: string
          label?: string | null
          playlist_id?: string
          site_id?: string
          stats?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_snapshots_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_snapshots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          category: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description_en: string | null
          description_pt: string | null
          id: string
          name_en: string
          name_pt: string
          notes: Json | null
          site_id: string
          slug: string
          status: string
          updated_at: string
          viewport_state: Json | null
        }
        Insert: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_pt?: string | null
          id?: string
          name_en?: string
          name_pt: string
          notes?: Json | null
          site_id: string
          slug: string
          status?: string
          updated_at?: string
          viewport_state?: Json | null
        }
        Update: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_pt?: string | null
          id?: string
          name_en?: string
          name_pt?: string
          notes?: Json | null
          site_id?: string
          slug?: string
          status?: string
          updated_at?: string
          viewport_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          hashtag_id: string
          post_id: string
        }
        Insert: {
          hashtag_id: string
          post_id: string
        }
        Update: {
          hashtag_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          comments: number
          created_at: string | null
          data: Json
          delivery_id: string | null
          fetched_at: string
          id: string
          impressions: number | null
          likes: number
          link_clicks: number | null
          platform: string
          polled_at: string | null
          post_id: string
          provider: string | null
          raw: Json | null
          reach: number | null
          shares: number
          slide_index: number | null
        }
        Insert: {
          comments?: number
          created_at?: string | null
          data: Json
          delivery_id?: string | null
          fetched_at: string
          id?: string
          impressions?: number | null
          likes?: number
          link_clicks?: number | null
          platform: string
          polled_at?: string | null
          post_id: string
          provider?: string | null
          raw?: Json | null
          reach?: number | null
          shares?: number
          slide_index?: number | null
        }
        Update: {
          comments?: number
          created_at?: string | null
          data?: Json
          delivery_id?: string | null
          fetched_at?: string
          id?: string
          impressions?: number | null
          likes?: number
          link_clicks?: number | null
          platform?: string
          polled_at?: string | null
          post_id?: string
          provider?: string | null
          raw?: Json | null
          reach?: number | null
          shares?: number
          slide_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "social_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          failure_count: number
          id: string
          p256dh: string
          site_id: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          p256dh: string
          site_id: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          p256dh?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_content: {
        Row: {
          content_compact: Json
          content_md: string | null
          created_at: string
          id: string
          key: string
          ref_group: string
          site_id: string
          sort_order: number
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          content_compact?: Json
          content_md?: string | null
          created_at?: string
          id?: string
          key: string
          ref_group?: string
          site_id: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          content_compact?: Json
          content_md?: string | null
          created_at?: string
          id?: string
          key?: string
          ref_group?: string
          site_id?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reference_content_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      research_decision_sources: {
        Row: {
          created_at: string
          decision_id: string
          id: string
          note: string | null
          research_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          id?: string
          note?: string | null
          research_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          id?: string
          note?: string | null
          research_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_decision_sources_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "research_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_decision_sources_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_decisions: {
        Row: {
          consequences: Json
          context: string | null
          created_at: string
          date_label: string | null
          drives: Json
          history: Json
          horizon: string
          id: string
          metric: string | null
          rationale: string | null
          revisit: string | null
          site_id: string
          status: string
          theme_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          consequences?: Json
          context?: string | null
          created_at?: string
          date_label?: string | null
          drives?: Json
          history?: Json
          horizon?: string
          id?: string
          metric?: string | null
          rationale?: string | null
          revisit?: string | null
          site_id: string
          status?: string
          theme_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          consequences?: Json
          context?: string | null
          created_at?: string
          date_label?: string | null
          drives?: Json
          history?: Json
          horizon?: string
          id?: string
          metric?: string | null
          rationale?: string | null
          revisit?: string | null
          site_id?: string
          status?: string
          theme_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_decisions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_decisions_theme_id_fk"
            columns: ["theme_id", "site_id"]
            isOneToOne: false
            referencedRelation: "research_themes"
            referencedColumns: ["id", "site_id"]
          },
        ]
      }
      research_foco_sources: {
        Row: {
          created_at: string
          foco_id: string
          item_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          foco_id: string
          item_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          foco_id?: string
          item_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_foco_sources_foco_id_fkey"
            columns: ["foco_id"]
            isOneToOne: false
            referencedRelation: "research_focos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_foco_sources_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_foco_themes: {
        Row: {
          created_at: string
          foco_id: string
          site_id: string
          theme_id: string
        }
        Insert: {
          created_at?: string
          foco_id: string
          site_id: string
          theme_id: string
        }
        Update: {
          created_at?: string
          foco_id?: string
          site_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_foco_themes_foco_id_fkey"
            columns: ["foco_id"]
            isOneToOne: false
            referencedRelation: "research_focos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_foco_themes_theme_id_site_id_fkey"
            columns: ["theme_id", "site_id"]
            isOneToOne: false
            referencedRelation: "research_themes"
            referencedColumns: ["id", "site_id"]
          },
        ]
      }
      research_focos: {
        Row: {
          active: boolean
          author: string
          created_at: string
          description: string | null
          ended_at: string | null
          horizon: string
          id: string
          metric: string | null
          rationale: string | null
          site_id: string
          started_at: string | null
          state: string
          title: string
          updated_at: string
          window_label: string | null
        }
        Insert: {
          active?: boolean
          author?: string
          created_at?: string
          description?: string | null
          ended_at?: string | null
          horizon?: string
          id?: string
          metric?: string | null
          rationale?: string | null
          site_id: string
          started_at?: string | null
          state?: string
          title: string
          updated_at?: string
          window_label?: string | null
        }
        Update: {
          active?: boolean
          author?: string
          created_at?: string
          description?: string | null
          ended_at?: string | null
          horizon?: string
          id?: string
          metric?: string | null
          rationale?: string | null
          site_id?: string
          started_at?: string | null
          state?: string
          title?: string
          updated_at?: string
          window_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_focos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      research_items: {
        Row: {
          content_html: string | null
          content_json: Json | null
          content_md: string | null
          created_at: string
          id: string
          pinned: boolean
          read_min: number
          search_vector: unknown
          site_id: string
          source: string
          sources: Json
          status: string
          summary: string | null
          takeaways: Json
          theme_id: string
          title: string
          topic_id: string | null
          updated_at: string
          version: number
          word_count: number
        }
        Insert: {
          content_html?: string | null
          content_json?: Json | null
          content_md?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          read_min?: number
          search_vector?: unknown
          site_id: string
          source?: string
          sources?: Json
          status?: string
          summary?: string | null
          takeaways?: Json
          theme_id: string
          title: string
          topic_id?: string | null
          updated_at?: string
          version?: number
          word_count?: number
        }
        Update: {
          content_html?: string | null
          content_json?: Json | null
          content_md?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          read_min?: number
          search_vector?: unknown
          site_id?: string
          source?: string
          sources?: Json
          status?: string
          summary?: string | null
          takeaways?: Json
          theme_id?: string
          title?: string
          topic_id?: string | null
          updated_at?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_items_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_items_theme_id_fk"
            columns: ["theme_id", "site_id"]
            isOneToOne: false
            referencedRelation: "research_themes"
            referencedColumns: ["id", "site_id"]
          },
          {
            foreignKeyName: "research_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      research_links: {
        Row: {
          created_at: string
          id: string
          note: string | null
          pipeline_item_id: string
          research_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          pipeline_item_id: string
          research_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          pipeline_item_id?: string
          research_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_links_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_links_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research_items"
            referencedColumns: ["id"]
          },
        ]
      }
      research_themes: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          label: string
          short: string
          site_id: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id: string
          label: string
          short: string
          site_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          label?: string
          short?: string
          site_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_themes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      research_topics: {
        Row: {
          color: string
          created_at: string
          depth: number
          icon: string
          id: string
          name: string
          parent_id: string | null
          path: string
          site_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          depth?: number
          icon?: string
          id?: string
          name: string
          parent_id?: string | null
          path: string
          site_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          depth?: number
          icon?: string
          id?: string
          name?: string
          parent_id?: string | null
          path?: string
          site_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "research_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_topics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          delivered_at: string | null
          error: string | null
          id: string
          metadata: Json | null
          provider: Database["public"]["Enums"]["email_provider"]
          provider_message_id: string | null
          sent_at: string
          site_id: string
          status: string
          subject: string
          template_name: string
          to_email: string
        }
        Insert: {
          delivered_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          provider: Database["public"]["Enums"]["email_provider"]
          provider_message_id?: string | null
          sent_at?: string
          site_id: string
          status: string
          subject: string
          template_name: string
          to_email: string
        }
        Update: {
          delivered_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          provider?: Database["public"]["Enums"]["email_provider"]
          provider_message_id?: string | null
          sent_at?: string
          site_id?: string
          status?: string
          subject?: string
          template_name?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_memberships_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          cms_enabled: boolean
          contact_notification_email: string | null
          created_at: string
          default_locale: string
          domains: string[]
          id: string
          identity_type: string
          linktree_config: Json | null
          logo_url: string | null
          name: string
          org_id: string
          primary_color: string | null
          primary_domain: string
          seo_default_og_image: string | null
          settings: Json | null
          short_domain: string | null
          slug: string
          social_defaults: Json | null
          supported_locales: string[]
          timezone: string
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          cms_enabled?: boolean
          contact_notification_email?: string | null
          created_at?: string
          default_locale?: string
          domains?: string[]
          id?: string
          identity_type?: string
          linktree_config?: Json | null
          logo_url?: string | null
          name: string
          org_id: string
          primary_color?: string | null
          primary_domain: string
          seo_default_og_image?: string | null
          settings?: Json | null
          short_domain?: string | null
          slug: string
          social_defaults?: Json | null
          supported_locales?: string[]
          timezone?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          cms_enabled?: boolean
          contact_notification_email?: string | null
          created_at?: string
          default_locale?: string
          domains?: string[]
          id?: string
          identity_type?: string
          linktree_config?: Json | null
          logo_url?: string | null
          name?: string
          org_id?: string
          primary_color?: string | null
          primary_domain?: string
          seo_default_og_image?: string | null
          settings?: Json | null
          short_domain?: string | null
          slug?: string
          social_defaults?: Json | null
          supported_locales?: string[]
          timezone?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          access_token_enc: string
          account_id: string
          account_name: string | null
          account_type: string | null
          bluesky_access_jwt_enc: string | null
          bluesky_did: string | null
          bluesky_jwt_expires_at: string | null
          bluesky_refresh_jwt_enc: string | null
          circuit_open_until: string | null
          connected_at: string | null
          id: string
          metadata: Json | null
          page_token_enc: string | null
          provider: string
          rate_window_count: number | null
          rate_window_start: string | null
          refresh_token_enc: string | null
          revoked_at: string | null
          scopes: string[] | null
          site_id: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token_enc: string
          account_id: string
          account_name?: string | null
          account_type?: string | null
          bluesky_access_jwt_enc?: string | null
          bluesky_did?: string | null
          bluesky_jwt_expires_at?: string | null
          bluesky_refresh_jwt_enc?: string | null
          circuit_open_until?: string | null
          connected_at?: string | null
          id?: string
          metadata?: Json | null
          page_token_enc?: string | null
          provider: string
          rate_window_count?: number | null
          rate_window_start?: string | null
          refresh_token_enc?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          site_id: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token_enc?: string
          account_id?: string
          account_name?: string | null
          account_type?: string | null
          bluesky_access_jwt_enc?: string | null
          bluesky_did?: string | null
          bluesky_jwt_expires_at?: string | null
          bluesky_refresh_jwt_enc?: string | null
          circuit_open_until?: string | null
          connected_at?: string | null
          id?: string
          metadata?: Json | null
          page_token_enc?: string | null
          provider?: string
          rate_window_count?: number | null
          rate_window_start?: string | null
          refresh_token_enc?: string | null
          revoked_at?: string | null
          scopes?: string[] | null
          site_id?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      social_deliveries: {
        Row: {
          attempt: number | null
          connection_id: string
          content_override: Json | null
          created_at: string | null
          error_type: string | null
          format: string | null
          id: string
          last_error: string | null
          max_attempts: number | null
          platform_post_id: string | null
          platform_url: string | null
          post_id: string
          provider: string
          published_at: string | null
          status: string
          template_config: Json | null
        }
        Insert: {
          attempt?: number | null
          connection_id: string
          content_override?: Json | null
          created_at?: string | null
          error_type?: string | null
          format?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          platform_post_id?: string | null
          platform_url?: string | null
          post_id: string
          provider: string
          published_at?: string | null
          status?: string
          template_config?: Json | null
        }
        Update: {
          attempt?: number | null
          connection_id?: string
          content_override?: Json | null
          created_at?: string | null
          error_type?: string | null
          format?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          platform_post_id?: string | null
          platform_url?: string | null
          post_id?: string
          provider?: string
          published_at?: string | null
          status?: string
          template_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "social_deliveries_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "social_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_deliveries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          caption_overrides: Json | null
          caption_template: string | null
          content: Json
          created_at: string | null
          created_by: string | null
          graduated_at: string | null
          id: string
          idempotency_key: string | null
          link_in_bio_updated: boolean | null
          origin: string
          pipeline_snapshot: Json | null
          pipeline_steps: Json
          published_at: string | null
          queue_position: number | null
          scheduled_at: string | null
          short_link_id: string | null
          site_id: string
          source_content_id: string | null
          source_content_type: string | null
          source_locale: string | null
          source_pipeline_id: string | null
          status: string
          story_slides: Json | null
          template_id: string | null
          type: string
          updated_at: string | null
          user_timezone: string
        }
        Insert: {
          caption_overrides?: Json | null
          caption_template?: string | null
          content: Json
          created_at?: string | null
          created_by?: string | null
          graduated_at?: string | null
          id?: string
          idempotency_key?: string | null
          link_in_bio_updated?: boolean | null
          origin?: string
          pipeline_snapshot?: Json | null
          pipeline_steps?: Json
          published_at?: string | null
          queue_position?: number | null
          scheduled_at?: string | null
          short_link_id?: string | null
          site_id: string
          source_content_id?: string | null
          source_content_type?: string | null
          source_locale?: string | null
          source_pipeline_id?: string | null
          status?: string
          story_slides?: Json | null
          template_id?: string | null
          type: string
          updated_at?: string | null
          user_timezone?: string
        }
        Update: {
          caption_overrides?: Json | null
          caption_template?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          graduated_at?: string | null
          id?: string
          idempotency_key?: string | null
          link_in_bio_updated?: boolean | null
          origin?: string
          pipeline_snapshot?: Json | null
          pipeline_steps?: Json
          published_at?: string | null
          queue_position?: number | null
          scheduled_at?: string | null
          short_link_id?: string | null
          site_id?: string
          source_content_id?: string | null
          source_content_type?: string | null
          source_locale?: string | null
          source_pipeline_id?: string | null
          status?: string
          story_slides?: Json | null
          template_id?: string | null
          type?: string
          updated_at?: string | null
          user_timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_social_posts_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "social_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "link_summary_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_source_pipeline_id_fkey"
            columns: ["source_pipeline_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      social_templates: {
        Row: {
          aspect_ratio: string
          composition: Json
          content_type: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          site_id: string | null
          slides: Json | null
          slug: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          aspect_ratio: string
          composition: Json
          content_type?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          site_id?: string | null
          slides?: Json | null
          slug?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          aspect_ratio?: string
          composition?: Json
          content_type?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          site_id?: string | null
          slides?: Json | null
          slug?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_templates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_connection_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          site_id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          site_id: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          site_id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_connection_tokens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      thumbnail_library: {
        Row: {
          blob_url: string
          created_at: string | null
          ctr_at_win: number | null
          id: string
          lift_at_win: number | null
          site_id: string
          source_test_id: string | null
          source_type: string
          source_variant_id: string | null
          tags: string[] | null
          title: string | null
          video_title: string | null
          youtube_video_id: string | null
        }
        Insert: {
          blob_url: string
          created_at?: string | null
          ctr_at_win?: number | null
          id?: string
          lift_at_win?: number | null
          site_id: string
          source_test_id?: string | null
          source_type?: string
          source_variant_id?: string | null
          tags?: string[] | null
          title?: string | null
          video_title?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          blob_url?: string
          created_at?: string | null
          ctr_at_win?: number | null
          id?: string
          lift_at_win?: number | null
          site_id?: string
          source_test_id?: string | null
          source_type?: string
          source_variant_id?: string | null
          tags?: string[] | null
          title?: string | null
          video_title?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thumbnail_library_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thumbnail_library_source_test_id_fkey"
            columns: ["source_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thumbnail_library_source_variant_id_fkey"
            columns: ["source_variant_id"]
            isOneToOne: false
            referencedRelation: "ab_test_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      thumbnail_longevity: {
        Row: {
          change_percent: number | null
          checked_at: string | null
          checkpoint_days: number
          ctr_at_checkpoint: number | null
          ctr_at_win: number | null
          id: string
          library_id: string
          status: string
        }
        Insert: {
          change_percent?: number | null
          checked_at?: string | null
          checkpoint_days: number
          ctr_at_checkpoint?: number | null
          ctr_at_win?: number | null
          id?: string
          library_id: string
          status: string
        }
        Update: {
          change_percent?: number | null
          checked_at?: string | null
          checkpoint_days?: number
          ctr_at_checkpoint?: number | null
          ctr_at_win?: number | null
          id?: string
          library_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "thumbnail_longevity_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "thumbnail_library"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_links: {
        Row: {
          _utm_backup: Json | null
          activates_at: string | null
          active: boolean
          click_limit: number | null
          code: string
          created_at: string
          created_by: string | null
          custom_params: Json | null
          deleted_at: string | null
          destination_url: string
          expired_url: string | null
          expires_at: string | null
          has_qr: boolean
          health_checked_at: string | null
          health_status: string
          id: string
          is_internal: boolean
          last_clicked_at: string | null
          launched_at: string | null
          pass_click_ids: boolean
          password_hash: string | null
          qr_card_composition: Json | null
          qr_config: Json | null
          qr_storage_path: string | null
          redirect_type: number
          site_id: string
          slug: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["link_source_type"]
          tags: string[]
          title: string | null
          total_clicks: number
          unique_visitors: number
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_id: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          _utm_backup?: Json | null
          activates_at?: string | null
          active?: boolean
          click_limit?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          custom_params?: Json | null
          deleted_at?: string | null
          destination_url: string
          expired_url?: string | null
          expires_at?: string | null
          has_qr?: boolean
          health_checked_at?: string | null
          health_status?: string
          id?: string
          is_internal?: boolean
          last_clicked_at?: string | null
          launched_at?: string | null
          pass_click_ids?: boolean
          password_hash?: string | null
          qr_card_composition?: Json | null
          qr_config?: Json | null
          qr_storage_path?: string | null
          redirect_type?: number
          site_id: string
          slug?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["link_source_type"]
          tags?: string[]
          title?: string | null
          total_clicks?: number
          unique_visitors?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          _utm_backup?: Json | null
          activates_at?: string | null
          active?: boolean
          click_limit?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          custom_params?: Json | null
          deleted_at?: string | null
          destination_url?: string
          expired_url?: string | null
          expires_at?: string | null
          has_qr?: boolean
          health_checked_at?: string | null
          health_status?: string
          id?: string
          is_internal?: boolean
          last_clicked_at?: string | null
          launched_at?: string | null
          pass_click_ids?: boolean
          password_hash?: string | null
          qr_card_composition?: Json | null
          qr_config?: Json | null
          qr_storage_path?: string | null
          redirect_type?: number
          site_id?: string
          slug?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["link_source_type"]
          tags?: string[]
          title?: string | null
          total_clicks?: number
          unique_visitors?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracked_links_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          site_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          site_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          site_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribe_tokens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_app_presence: {
        Row: {
          app_id: string
          email_hash: string
          first_seen: string
        }
        Insert: {
          app_id: string
          email_hash: string
          first_seen?: string
        }
        Update: {
          app_id?: string
          email_hash?: string
          first_seen?: string
        }
        Relationships: []
      }
      video_grade_history: {
        Row: {
          ctr: number | null
          engagement: number | null
          grade: string
          growth: number | null
          id: string
          reach: number | null
          recorded_at: string
          retention: number | null
          score: number
          site_id: string
          sub_impact: number | null
          view_count: number | null
          week_iso: string
          youtube_video_id: string
        }
        Insert: {
          ctr?: number | null
          engagement?: number | null
          grade: string
          growth?: number | null
          id?: string
          reach?: number | null
          recorded_at?: string
          retention?: number | null
          score: number
          site_id: string
          sub_impact?: number | null
          view_count?: number | null
          week_iso: string
          youtube_video_id: string
        }
        Update: {
          ctr?: number | null
          engagement?: number | null
          grade?: string
          growth?: number | null
          id?: string
          reach?: number | null
          recorded_at?: string
          retention?: number | null
          score?: number
          site_id?: string
          sub_impact?: number | null
          view_count?: number | null
          week_iso?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_grade_history_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_grade_history_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_recording_status: {
        Row: {
          beat_id: string
          beat_name: string | null
          content_hash: string | null
          id: string
          lang: string
          modified_by: string | null
          pipeline_id: string
          retake_note: string | null
          site_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          beat_id: string
          beat_name?: string | null
          content_hash?: string | null
          id?: string
          lang: string
          modified_by?: string | null
          pipeline_id: string
          retake_note?: string | null
          site_id: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          beat_id?: string
          beat_name?: string | null
          content_hash?: string | null
          id?: string
          lang?: string
          modified_by?: string | null
          pipeline_id?: string
          retake_note?: string | null
          site_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_recording_status_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_recording_status_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_dsar_tokens: {
        Row: {
          created_at: string
          email: string
          site_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          site_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          site_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_dsar_tokens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          anonymized_at: string | null
          consent_grant_at: string
          consent_launch_notification: boolean
          consent_text_version: string
          created_at: string
          email: string
          id: string
          ip: unknown
          locale: string | null
          site_id: string
          source_surface: string | null
          status: string
          suppressed_at: string | null
          suppression_reason: string | null
          user_agent: string | null
          waitlist_id: string
        }
        Insert: {
          anonymized_at?: string | null
          consent_grant_at?: string
          consent_launch_notification: boolean
          consent_text_version: string
          created_at?: string
          email: string
          id?: string
          ip?: unknown
          locale?: string | null
          site_id: string
          source_surface?: string | null
          status?: string
          suppressed_at?: string | null
          suppression_reason?: string | null
          user_agent?: string | null
          waitlist_id: string
        }
        Update: {
          anonymized_at?: string | null
          consent_grant_at?: string
          consent_launch_notification?: boolean
          consent_text_version?: string
          created_at?: string
          email?: string
          id?: string
          ip?: unknown
          locale?: string | null
          site_id?: string
          source_surface?: string | null
          status?: string
          suppressed_at?: string | null
          suppression_reason?: string | null
          user_agent?: string | null
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_signups_parent_fk"
            columns: ["waitlist_id", "site_id"]
            isOneToOne: false
            referencedRelation: "waitlists"
            referencedColumns: ["id", "site_id"]
          },
        ]
      }
      waitlist_translations: {
        Row: {
          button_label: string | null
          button_loading_label: string | null
          closed_message: string | null
          consent_label: string
          duplicate_body: string | null
          duplicate_headline: string | null
          headline: string | null
          id: string
          launched_message: string | null
          locale: string
          subheadline: string | null
          success_body: string | null
          success_headline: string | null
          waitlist_id: string
        }
        Insert: {
          button_label?: string | null
          button_loading_label?: string | null
          closed_message?: string | null
          consent_label?: string
          duplicate_body?: string | null
          duplicate_headline?: string | null
          headline?: string | null
          id?: string
          launched_message?: string | null
          locale: string
          subheadline?: string | null
          success_body?: string | null
          success_headline?: string | null
          waitlist_id: string
        }
        Update: {
          button_label?: string | null
          button_loading_label?: string | null
          closed_message?: string | null
          consent_label?: string
          duplicate_body?: string | null
          duplicate_headline?: string | null
          headline?: string | null
          id?: string
          launched_message?: string | null
          locale?: string
          subheadline?: string | null
          success_body?: string | null
          success_headline?: string | null
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_translations_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlists"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlists: {
        Row: {
          campaign_id: string | null
          created_at: string
          description: string | null
          id: string
          intro_mdx: string | null
          launched_at: string | null
          name: string
          reply_to: string | null
          sender_email: string | null
          sender_name: string | null
          site_id: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_mdx?: string | null
          launched_at?: string | null
          name: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          site_id: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_mdx?: string | null
          launched_at?: string | null
          name?: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          site_id?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlists_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlists_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_type: string
          id: string
          idempotency_key: string
          processed_at: string
        }
        Insert: {
          event_type: string
          id?: string
          idempotency_key: string
          processed_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          idempotency_key?: string
          processed_at?: string
        }
        Relationships: []
      }
      working_today: {
        Row: {
          pinned_at: string
          pipeline_item_id: string
          user_id: string
        }
        Insert: {
          pinned_at?: string
          pipeline_item_id: string
          user_id: string
        }
        Update: {
          pinned_at?: string
          pipeline_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_today_pipeline_item_id_fkey"
            columns: ["pipeline_item_id"]
            isOneToOne: false
            referencedRelation: "content_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_categories: {
        Row: {
          auto_approve: boolean
          color: string
          created_at: string
          description_en: string | null
          description_pt: string | null
          id: string
          match_keywords: string[]
          name_en: string
          name_pt: string
          site_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_approve?: boolean
          color?: string
          created_at?: string
          description_en?: string | null
          description_pt?: string | null
          id?: string
          match_keywords?: string[]
          name_en: string
          name_pt: string
          site_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_approve?: boolean
          color?: string
          created_at?: string
          description_en?: string | null
          description_pt?: string | null
          id?: string
          match_keywords?: string[]
          name_en?: string
          name_pt?: string
          site_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_categories_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_channels: {
        Row: {
          banner_url: string | null
          channel_id: string
          created_at: string
          custom_url: string | null
          description: string | null
          handle: string
          id: string
          last_synced_at: string | null
          locale: string
          name: string
          schedule_label: string | null
          site_id: string
          subscriber_count: number
          sync_enabled: boolean
          sync_schedules: Json
          thumbnail_url: string | null
          updated_at: string
          uploads_playlist_id: string
          video_count: number
        }
        Insert: {
          banner_url?: string | null
          channel_id: string
          created_at?: string
          custom_url?: string | null
          description?: string | null
          handle: string
          id?: string
          last_synced_at?: string | null
          locale: string
          name: string
          schedule_label?: string | null
          site_id: string
          subscriber_count?: number
          sync_enabled?: boolean
          sync_schedules?: Json
          thumbnail_url?: string | null
          updated_at?: string
          uploads_playlist_id: string
          video_count?: number
        }
        Update: {
          banner_url?: string | null
          channel_id?: string
          created_at?: string
          custom_url?: string | null
          description?: string | null
          handle?: string
          id?: string
          last_synced_at?: string | null
          locale?: string
          name?: string
          schedule_label?: string | null
          site_id?: string
          subscriber_count?: number
          sync_enabled?: boolean
          sync_schedules?: Json
          thumbnail_url?: string | null
          updated_at?: string
          uploads_playlist_id?: string
          video_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "youtube_channels_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_curated_comments: {
        Row: {
          author_avatar_url: string | null
          author_handle: string
          created_at: string
          display_order: number
          id: string
          like_count: number
          published_at: string | null
          site_id: string
          target_locale: string | null
          text_en: string
          text_pt: string
          updated_at: string
          video_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_handle: string
          created_at?: string
          display_order?: number
          id?: string
          like_count?: number
          published_at?: string | null
          site_id: string
          target_locale?: string | null
          text_en: string
          text_pt: string
          updated_at?: string
          video_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_handle?: string
          created_at?: string
          display_order?: number
          id?: string
          like_count?: number
          published_at?: string | null
          site_id?: string
          target_locale?: string | null
          text_en?: string
          text_pt?: string
          updated_at?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_curated_comments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_curated_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_fatigue_alerts: {
        Row: {
          actual_ctr: number | null
          created_at: string | null
          detected_at: string | null
          expected_ctr: number | null
          id: string
          resolved_by_test_id: string | null
          site_id: string
          status: string | null
          video_id: string
          z_score: number
        }
        Insert: {
          actual_ctr?: number | null
          created_at?: string | null
          detected_at?: string | null
          expected_ctr?: number | null
          id?: string
          resolved_by_test_id?: string | null
          site_id: string
          status?: string | null
          video_id: string
          z_score: number
        }
        Update: {
          actual_ctr?: number | null
          created_at?: string | null
          detected_at?: string | null
          expected_ctr?: number | null
          id?: string
          resolved_by_test_id?: string | null
          site_id?: string
          status?: string | null
          video_id?: string
          z_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "youtube_fatigue_alerts_resolved_by_test_id_fkey"
            columns: ["resolved_by_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_fatigue_alerts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_fatigue_alerts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_intelligence: {
        Row: {
          analysis_text: string | null
          channel_id: string
          coaching: Json | null
          created_at: string
          expires_at: string | null
          generated_at: string
          id: string
          patterns_detected: Json | null
          recommendations: Json | null
          site_id: string
          source: string
          type: string
          updated_at: string
          video_id: string | null
        }
        Insert: {
          analysis_text?: string | null
          channel_id: string
          coaching?: Json | null
          created_at?: string
          expires_at?: string | null
          generated_at?: string
          id?: string
          patterns_detected?: Json | null
          recommendations?: Json | null
          site_id: string
          source?: string
          type: string
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          analysis_text?: string | null
          channel_id?: string
          coaching?: Json | null
          created_at?: string
          expires_at?: string | null
          generated_at?: string
          id?: string
          patterns_detected?: Json | null
          recommendations?: Json | null
          site_id?: string
          source?: string
          type?: string
          updated_at?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_intelligence_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_intelligence_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_intelligence_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_intelligence_tasks: {
        Row: {
          channel_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          requested_at: string
          requested_by: string | null
          result_summary: Json | null
          retry_count: number
          site_id: string
          started_at: string | null
          status: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          requested_at?: string
          requested_by?: string | null
          result_summary?: Json | null
          retry_count?: number
          site_id: string
          started_at?: string | null
          status?: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          requested_at?: string
          requested_by?: string | null
          result_summary?: Json | null
          retry_count?: number
          site_id?: string
          started_at?: string | null
          status?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_intelligence_tasks_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_intelligence_tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_notes: {
        Row: {
          author_id: string | null
          author_name: string
          channel_id: string
          created_at: string
          id: string
          is_bot: boolean
          site_id: string
          source: string | null
          text: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          channel_id: string
          created_at?: string
          id?: string
          is_bot?: boolean
          site_id: string
          source?: string | null
          text: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          channel_id?: string
          created_at?: string
          id?: string
          is_bot?: boolean
          site_id?: string
          source?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_notes_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_notes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_quota_usage: {
        Row: {
          date: string
          operations: Json | null
          site_id: string
          units_used: number
          updated_at: string | null
        }
        Insert: {
          date: string
          operations?: Json | null
          site_id: string
          units_used?: number
          updated_at?: string | null
        }
        Update: {
          date?: string
          operations?: Json | null
          site_id?: string
          units_used?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_quota_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_sync_log: {
        Row: {
          channel_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          mode: string
          quota_used: number
          site_id: string
          started_at: string
          status: string
          videos_found: number
          videos_inserted: number
          videos_updated: number
        }
        Insert: {
          channel_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mode: string
          quota_used?: number
          site_id: string
          started_at?: string
          status: string
          videos_found?: number
          videos_inserted?: number
          videos_updated?: number
        }
        Update: {
          channel_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          mode?: string
          quota_used?: number
          site_id?: string
          started_at?: string
          status?: string
          videos_found?: number
          videos_inserted?: number
          videos_updated?: number
        }
        Relationships: [
          {
            foreignKeyName: "youtube_sync_log_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_sync_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_video_analytics: {
        Row: {
          avg_view_duration_seconds: number
          comments: number
          created_at: string
          ctr: number
          date: string
          id: string
          impressions: number
          likes: number
          shares: number
          site_id: string
          subscribers_gained: number
          views: number
          views_at_24h: number | null
          views_at_30d: number | null
          views_at_48h: number | null
          views_at_7d: number | null
          youtube_video_id: string
        }
        Insert: {
          avg_view_duration_seconds?: number
          comments?: number
          created_at?: string
          ctr?: number
          date: string
          id?: string
          impressions?: number
          likes?: number
          shares?: number
          site_id: string
          subscribers_gained?: number
          views?: number
          views_at_24h?: number | null
          views_at_30d?: number | null
          views_at_48h?: number | null
          views_at_7d?: number | null
          youtube_video_id: string
        }
        Update: {
          avg_view_duration_seconds?: number
          comments?: number
          created_at?: string
          ctr?: number
          date?: string
          id?: string
          impressions?: number
          likes?: number
          shares?: number
          site_id?: string
          subscribers_gained?: number
          views?: number
          views_at_24h?: number | null
          views_at_30d?: number | null
          views_at_48h?: number | null
          views_at_7d?: number | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_video_analytics_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_video_analytics_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_videos: {
        Row: {
          auto_suggested_category_id: string | null
          avg_view_duration_seconds: number | null
          avg_view_percentage: number | null
          category_id: string | null
          channel_id: string
          cms_notes: string | null
          comment_count: number
          created_at: string
          ctr: number | null
          description: string | null
          description_translation: string | null
          duration: string
          duration_seconds: number
          id: string
          impressions: number | null
          is_featured: boolean
          is_hidden: boolean
          last_analytics_sync_at: string | null
          like_count: number
          pinned_until: string | null
          published_at: string
          retention_curve: Json | null
          site_id: string
          tags: string[]
          thumbnail_hq_url: string | null
          thumbnail_url: string | null
          title: string
          title_translation: string | null
          traffic_sources: Json | null
          updated_at: string
          version: number
          view_count: number
          view_count_delta_today: number | null
          view_count_yesterday: number | null
          youtube_video_id: string
        }
        Insert: {
          auto_suggested_category_id?: string | null
          avg_view_duration_seconds?: number | null
          avg_view_percentage?: number | null
          category_id?: string | null
          channel_id: string
          cms_notes?: string | null
          comment_count?: number
          created_at?: string
          ctr?: number | null
          description?: string | null
          description_translation?: string | null
          duration?: string
          duration_seconds?: number
          id?: string
          impressions?: number | null
          is_featured?: boolean
          is_hidden?: boolean
          last_analytics_sync_at?: string | null
          like_count?: number
          pinned_until?: string | null
          published_at: string
          retention_curve?: Json | null
          site_id: string
          tags?: string[]
          thumbnail_hq_url?: string | null
          thumbnail_url?: string | null
          title: string
          title_translation?: string | null
          traffic_sources?: Json | null
          updated_at?: string
          version?: number
          view_count?: number
          view_count_delta_today?: number | null
          view_count_yesterday?: number | null
          youtube_video_id: string
        }
        Update: {
          auto_suggested_category_id?: string | null
          avg_view_duration_seconds?: number | null
          avg_view_percentage?: number | null
          category_id?: string | null
          channel_id?: string
          cms_notes?: string | null
          comment_count?: number
          created_at?: string
          ctr?: number | null
          description?: string | null
          description_translation?: string | null
          duration?: string
          duration_seconds?: number
          id?: string
          impressions?: number | null
          is_featured?: boolean
          is_hidden?: boolean
          last_analytics_sync_at?: string | null
          like_count?: number
          pinned_until?: string | null
          published_at?: string
          retention_curve?: Json | null
          site_id?: string
          tags?: string[]
          thumbnail_hq_url?: string | null
          thumbnail_url?: string | null
          title?: string
          title_translation?: string | null
          traffic_sources?: Json | null
          updated_at?: string
          version?: number
          view_count?: number
          view_count_delta_today?: number | null
          view_count_yesterday?: number | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_videos_auto_suggested_category_id_fkey"
            columns: ["auto_suggested_category_id"]
            isOneToOne: false
            referencedRelation: "youtube_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "youtube_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      yt_notifications: {
        Row: {
          ab_test_id: string | null
          action_href: string | null
          created_at: string
          dedup_key: string
          dismissed: boolean
          expired_at: string | null
          id: string
          message: string
          optimization_cycle_id: string | null
          priority: number
          read: boolean
          site_id: string
          suggested_action: string | null
          title: string
          type: string
          youtube_video_id: string | null
        }
        Insert: {
          ab_test_id?: string | null
          action_href?: string | null
          created_at?: string
          dedup_key: string
          dismissed?: boolean
          expired_at?: string | null
          id?: string
          message: string
          optimization_cycle_id?: string | null
          priority: number
          read?: boolean
          site_id: string
          suggested_action?: string | null
          title: string
          type: string
          youtube_video_id?: string | null
        }
        Update: {
          ab_test_id?: string | null
          action_href?: string | null
          created_at?: string
          dedup_key?: string
          dismissed?: boolean
          expired_at?: string | null
          id?: string
          message?: string
          optimization_cycle_id?: string | null
          priority?: number
          read?: boolean
          site_id?: string
          suggested_action?: string | null
          title?: string
          type?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "yt_notifications_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yt_notifications_optimization_cycle_id_fkey"
            columns: ["optimization_cycle_id"]
            isOneToOne: false
            referencedRelation: "optimization_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yt_notifications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yt_notifications_youtube_video_id_fkey"
            columns: ["youtube_video_id"]
            isOneToOne: false
            referencedRelation: "youtube_videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fan_scores: {
        Row: {
          active_days: number | null
          first_seen: string | null
          last_seen: string | null
          platform_count: number | null
          score: number | null
          site_id: string | null
          total_interactions: number | null
          visitor_hash: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fan_interactions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_accounts_public: {
        Row: {
          created_at: string | null
          display_slots: number | null
          handle: string | null
          id: string | null
          ig_user_id: string | null
          last_synced_at: string | null
          layout_type: string | null
          locale: string | null
          section_subtitle_en: string | null
          section_subtitle_pt: string | null
          section_title_en: string | null
          section_title_pt: string | null
          site_id: string | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_slots?: number | null
          handle?: string | null
          id?: string | null
          ig_user_id?: string | null
          last_synced_at?: string | null
          layout_type?: string | null
          locale?: string | null
          section_subtitle_en?: string | null
          section_subtitle_pt?: string | null
          section_title_en?: string | null
          section_title_pt?: string | null
          site_id?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_slots?: number | null
          handle?: string | null
          id?: string | null
          ig_user_id?: string | null
          last_synced_at?: string | null
          layout_type?: string | null
          locale?: string | null
          section_subtitle_en?: string | null
          section_subtitle_pt?: string | null
          section_title_en?: string | null
          section_title_pt?: string | null
          site_id?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_accounts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      link_summary_v2: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          destination_url: string | null
          expires_at: string | null
          has_qr: boolean | null
          health_status: string | null
          id: string | null
          last30_clicks: number | null
          last30_unique: number | null
          pass_click_ids: boolean | null
          qr_scans: number | null
          redirect_type: number | null
          site_id: string | null
          slug: string | null
          source_type: Database["public"]["Enums"]["link_source_type"] | null
          spark_14d: Json | null
          title: string | null
          total_clicks: number | null
          unique_visitors: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracked_links_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      linktree_daily_geo: {
        Row: {
          city: string | null
          country: string | null
          device_type: string | null
          event_count: number | null
          event_date: string | null
          hour: number | null
          site_id: string | null
          weekday: number | null
        }
        Relationships: [
          {
            foreignKeyName: "linktree_events_site_fk"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      linktree_device_stats: {
        Row: {
          browser: string | null
          device_type: string | null
          event_count: number | null
          os: string | null
          referrer_source: string | null
          site_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linktree_events_site_fk"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_click_events: {
        Row: {
          clicked_at: string | null
          id: string | null
          ip: string | null
          send_id: string | null
          url: string | null
          user_agent: string | null
        }
        Relationships: []
      }
      newsletter_click_events_unified: {
        Row: {
          clicked_at: string | null
          ip: string | null
          send_id: string | null
          url: string | null
          user_agent: string | null
        }
        Relationships: []
      }
      youtube_channel_stats: {
        Row: {
          channel_id: string | null
          featured_count: number | null
          hidden_count: number | null
          latest_video_at: string | null
          site_id: string | null
          total_likes: number | null
          total_video_count: number | null
          total_views: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_videos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_videos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation_atomic:
        | { Args: { p_token: string }; Returns: Json }
        | { Args: { p_token_hash: string; p_user_id: string }; Returns: Json }
      activate_research_foco: {
        Args: { p_foco_id: string; p_site_id: string }
        Returns: {
          active: boolean
          author: string
          created_at: string
          description: string | null
          ended_at: string | null
          horizon: string
          id: string
          metric: string | null
          rationale: string | null
          site_id: string
          started_at: string | null
          state: string
          title: string
          updated_at: string
          window_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "research_focos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      activate_research_foco_service: {
        Args: { p_foco_id: string; p_site_id: string }
        Returns: {
          active: boolean
          author: string
          created_at: string
          description: string | null
          ended_at: string | null
          horizon: string
          id: string
          metric: string | null
          rationale: string | null
          site_id: string
          started_at: string | null
          state: string
          title: string
          updated_at: string
          window_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "research_focos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aggregate_ad_events_yesterday: { Args: never; Returns: number }
      aggregate_content_events: { Args: { p_date?: string }; Returns: Json }
      anonymize_contact_submission: {
        Args: { p_id: string }
        Returns: undefined
      }
      anonymize_old_link_clicks: {
        Args: { p_older_than_days?: number }
        Returns: Json
      }
      assign_week_slot: {
        Args: { p_item_id: string; p_slot_day: string; p_slot_hour?: string }
        Returns: Json
      }
      batch_extend_link_expiry: {
        Args: {
          p_campaign?: string
          p_hours?: number
          p_site_id: string
          p_tags?: string[]
        }
        Returns: number
      }
      can_admin_site: { Args: { p_site_id: string }; Returns: boolean }
      can_admin_site_for_user: {
        Args: { p_site_id: string; p_user_id: string }
        Returns: boolean
      }
      can_admin_site_users: { Args: { p_site_id: string }; Returns: boolean }
      can_edit_site: { Args: { p_site_id: string }; Returns: boolean }
      can_publish_site: { Args: { p_site_id: string }; Returns: boolean }
      can_view_site: { Args: { p_site_id: string }; Returns: boolean }
      cancel_account_deletion_in_grace: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      check_deletion_safety: { Args: { p_user_id: string }; Returns: Json }
      cleanup_excess_auto_snapshots: {
        Args: { p_max_per_playlist?: number }
        Returns: number
      }
      confirm_newsletter_subscription: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      contact_rate_check: {
        Args: { p_email: string; p_ip: string; p_site_id: string }
        Returns: boolean
      }
      count_orphan_media_assets: {
        Args: { p_site_id: string }
        Returns: number
      }
      create_link_clicks_partition: {
        Args: {
          p_end_date: string
          p_partition_name: string
          p_start_date: string
        }
        Returns: string
      }
      create_linktree_events_partition: {
        Args: {
          p_end_date: string
          p_partition_name: string
          p_start_date: string
        }
        Returns: string
      }
      create_monthly_partitions: {
        Args: { p_months_ahead?: number }
        Returns: undefined
      }
      create_playoff_test: {
        Args: {
          p_cooldown_hours?: number
          p_parent_test_id: string
          p_variant_ids: string[]
        }
        Returns: string
      }
      create_waitlist_with_translation: {
        Args: {
          p_campaign_id: string
          p_description: string
          p_headline: string
          p_intro_mdx: string
          p_locale: string
          p_name: string
          p_reply_to: string
          p_sender_email: string
          p_sender_name: string
          p_site_id: string
          p_slug: string
        }
        Returns: Json
      }
      create_yt_notification: {
        Args: {
          p_ab_test_id?: string
          p_action_href?: string
          p_cycle_id?: string
          p_dedup_key: string
          p_message: string
          p_priority: number
          p_site_id: string
          p_suggested_action?: string
          p_title: string
          p_type: string
          p_video_id?: string
        }
        Returns: string
      }
      cron_http_post_web: {
        Args: { p_path: string; p_timeout_ms?: number }
        Returns: number
      }
      cron_purge_old_contact_submissions: { Args: never; Returns: undefined }
      cron_purge_sent_emails: { Args: never; Returns: undefined }
      cron_try_lock: { Args: { p_job: string }; Returns: boolean }
      cron_unlock: { Args: { p_job: string }; Returns: boolean }
      expire_old_yt_notifications: { Args: never; Returns: number }
      find_orphan_media_assets: {
        Args: { p_grace_days?: number }
        Returns: string[]
      }
      generate_link_code: { Args: { p_site_id: string }; Returns: string }
      get_anonymous_consents: {
        Args: { p_anonymous_id: string }
        Returns: {
          anonymous_id: string | null
          category: string
          consent_text_id: string
          granted: boolean
          granted_at: string
          id: string
          ip: unknown
          site_id: string | null
          user_agent: string | null
          user_id: string | null
          withdrawn_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "consents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_audience_countries: {
        Args: { p_end: string; p_site_id: string; p_start: string }
        Returns: {
          country: string
          percentage: number
        }[]
      }
      get_audience_devices: {
        Args: { p_end: string; p_site_id: string; p_start: string }
        Returns: {
          device_type: string
          percentage: number
        }[]
      }
      get_audience_sources: {
        Args: { p_end: string; p_site_id: string; p_start: string }
        Returns: {
          percentage: number
          referrer_src: string
        }[]
      }
      get_invitation_by_token: { Args: { p_token_hash: string }; Returns: Json }
      get_site_branding: { Args: { p_site_id: string }; Returns: Json }
      get_top_links_analytics: {
        Args: {
          p_end: string
          p_limit?: number
          p_site_id: string
          p_start: string
        }
        Returns: {
          clicks: number
          code: string
          conversions: number
          id: string
          source: string
          top_country: string
          top_device: string
          unique_clicks: number
        }[]
      }
      get_top_posts_analytics: {
        Args: {
          p_end: string
          p_limit?: number
          p_site_id: string
          p_start: string
        }
        Returns: {
          avg_depth: number
          avg_time: number
          id: string
          reads_complete: number
          status: string
          title: string
          unique_views: number
          views: number
        }[]
      }
      get_top_referrers: {
        Args: {
          p_end: string
          p_limit?: number
          p_site_id: string
          p_start: string
        }
        Returns: {
          clicks: number
          domain: string
        }[]
      }
      get_utm_campaigns: {
        Args: { p_end: string; p_site_id: string; p_start: string }
        Returns: {
          campaign: string
          clicks: number
          conversions: number
          medium: string
          rate: number
        }[]
      }
      increment_invitation_resend: {
        Args: { p_id: string }
        Returns: undefined
      }
      increment_link_clicks: {
        Args: { p_is_unique?: boolean; p_link_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_member_staff: { Args: never; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_staff: { Args: { p_org_id: string }; Returns: boolean }
      is_org_staff_for_user: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      lgpd_phase1_cleanup: {
        Args: { p_pre_capture: Json; p_user_id: string }
        Returns: undefined
      }
      lgpd_phase3_prenullify_fks: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      merge_anonymous_consents: {
        Args: { p_anonymous_id: string }
        Returns: Json
      }
      newsletter_rate_check: {
        Args: { p_email: string; p_ip: string; p_site_id: string }
        Returns: boolean
      }
      newsletter_sends_funnel: {
        Args: { p_edition_ids: string[] }
        Returns: {
          clicked_count: number
          delivered_count: number
          opened_count: number
          total_sends: number
        }[]
      }
      newsletter_sends_recent_activity: {
        Args: { p_edition_ids: string[]; p_limit?: number }
        Returns: {
          clicked_at: string
          edition_id: string
          opened_at: string
          subscriber_email: string
        }[]
      }
      normalize_utm_value: {
        Args: { field_name: string; raw_value: string }
        Returns: string
      }
      org_role: { Args: { p_org_id: string }; Returns: string }
      org_role_for_user: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      pg_typeof_citext_probe: { Args: never; Returns: string }
      pin_weekly_pick: {
        Args: {
          p_channel_id: string
          p_duration_days: number
          p_site_id: string
          p_video_id: string
        }
        Returns: undefined
      }
      pin_working_today: {
        Args: { p_item_id: string; p_user_id: string }
        Returns: Json
      }
      purge_content_events: {
        Args: { p_older_than_days?: number }
        Returns: Json
      }
      purge_deleted_user_audit: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      purge_old_contact_submissions: {
        Args: { p_older_than_days?: number }
        Returns: number
      }
      purge_sent_emails: {
        Args: { p_older_than_days?: number }
        Returns: number
      }
      reassign_authors: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      reassign_content: {
        Args: { p_from_user: string; p_site_id: string; p_to_user: string }
        Returns: number
      }
      record_password_reset_attempt: {
        Args: { p_email: string; p_ip?: string }
        Returns: boolean
      }
      refresh_fan_scores: { Args: never; Returns: undefined }
      refresh_newsletter_stats: { Args: never; Returns: number }
      restore_playlist_snapshot: {
        Args: { p_mode?: string; p_playlist_id: string; p_snapshot_id: string }
        Returns: undefined
      }
      rotate_cycle: {
        Args: {
          p_applied_metadata?: Json
          p_cycle_number: number
          p_new_variant_id: string
          p_test_id: string
        }
        Returns: string
      }
      save_research_foco_full: {
        Args: {
          p_activate?: boolean
          p_description: string
          p_foco_id: string
          p_horizon?: string
          p_item_ids?: string[]
          p_item_notes?: Json
          p_metric?: string
          p_rationale?: string
          p_site_id: string
          p_state?: string
          p_theme_ids?: string[]
          p_title: string
          p_window_label?: string
        }
        Returns: {
          active: boolean
          author: string
          created_at: string
          description: string | null
          ended_at: string | null
          horizon: string
          id: string
          metric: string | null
          rationale: string | null
          site_id: string
          started_at: string | null
          state: string
          title: string
          updated_at: string
          window_label: string | null
        }
        SetofOptions: {
          from: "*"
          to: "research_focos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_audit_context: {
        Args: { p_ip: string; p_user_agent: string }
        Returns: undefined
      }
      shift_link_in_bio_positions: {
        Args: { p_min_position?: number; p_site_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      site_visible: { Args: { p_site_id: string }; Returns: boolean }
      social_publish_fair_batch: {
        Args: { batch_size?: number; window_end: string }
        Returns: {
          caption_overrides: Json | null
          caption_template: string | null
          content: Json
          created_at: string | null
          created_by: string | null
          graduated_at: string | null
          id: string
          idempotency_key: string | null
          link_in_bio_updated: boolean | null
          origin: string
          pipeline_snapshot: Json | null
          pipeline_steps: Json
          published_at: string | null
          queue_position: number | null
          scheduled_at: string | null
          short_link_id: string | null
          site_id: string
          source_content_id: string | null
          source_content_type: string | null
          source_locale: string | null
          source_pipeline_id: string | null
          status: string
          story_slides: Json | null
          template_id: string | null
          type: string
          updated_at: string | null
          user_timezone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "social_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      swap_slot_edition: {
        Args: {
          p_new_edition_id: string
          p_slot_date: string
          p_type_id: string
        }
        Returns: Json
      }
      unpin_weekly_pick: {
        Args: { p_channel_id: string; p_site_id: string }
        Returns: undefined
      }
      unpin_working_today: {
        Args: { p_item_id: string; p_user_id: string }
        Returns: Json
      }
      unsubscribe_via_token: { Args: { p_token_hash: string }; Returns: Json }
      update_campaign_atomic: {
        Args: { p_campaign_id: string; p_patch: Json; p_translations: Json }
        Returns: {
          created_at: string
          created_by: string | null
          form_fields: Json
          id: string
          interest: string
          link_group_id: string | null
          locale: string
          owner_user_id: string | null
          pdf_storage_path: string | null
          published_at: string | null
          scheduled_for: string | null
          site_id: string | null
          social_config: Json | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_pipeline_step: {
        Args: { p_patch: Json; p_post_id: string; p_step_name: string }
        Returns: undefined
      }
      upsert_linktree_daily_metrics: {
        Args: { p_rows: Json }
        Returns: undefined
      }
      user_accessible_sites: {
        Args: never
        Returns: {
          is_master_ring: boolean
          org_id: string
          org_name: string
          primary_domain: string
          site_id: string
          site_name: string
          site_slug: string
          user_role: string
        }[]
      }
      user_exists_by_email: { Args: { p_email: string }; Returns: boolean }
      user_role: { Args: never; Returns: string }
      utc_date: { Args: { ts: string }; Returns: string }
      waitlist_detail_counts: {
        Args: { p_site_id: string; p_waitlist_id: string }
        Returns: Json
      }
      waitlist_erase_by_email:
        | { Args: { p_email: string; p_site_id: string }; Returns: number }
        | {
            Args: {
              p_email: string
              p_ip: unknown
              p_site_id: string
              p_user_agent: string
            }
            Returns: number
          }
      waitlist_rate_check: {
        Args: { p_email: string; p_ip: string; p_site_id: string }
        Returns: boolean
      }
      waitlist_retention_sweep: { Args: { p_site_id: string }; Returns: number }
      waitlist_signup: {
        Args: {
          p_consent_text_snapshot: string
          p_consent_version: string
          p_email: string
          p_ip: unknown
          p_locale: string
          p_site_id: string
          p_slug: string
          p_source_surface: string
          p_user_agent: string
        }
        Returns: Json
      }
      waitlist_signup_counts: {
        Args: { p_site_id: string }
        Returns: {
          pending: number
          suppressed: number
          waitlist_id: string
        }[]
      }
    }
    Enums: {
      email_provider: "brevo" | "resend" | "ses"
      link_source_type:
        | "manual"
        | "campaign"
        | "newsletter"
        | "blog"
        | "social"
        | "print"
        | "ab_test"
      media_usage_resource:
        | "blog_post"
        | "blog_translation"
        | "newsletter_type"
        | "newsletter_edition"
        | "campaign_translation"
        | "author"
        | "site"
        | "ad_campaign"
        | "ad_placeholder"
        | "ad_slot_creative"
        | "tracked_link"
      post_status:
        | "idea"
        | "draft"
        | "ready"
        | "queued"
        | "scheduled"
        | "pending_review"
        | "published"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      email_provider: ["brevo", "resend", "ses"],
      link_source_type: [
        "manual",
        "campaign",
        "newsletter",
        "blog",
        "social",
        "print",
        "ab_test",
      ],
      media_usage_resource: [
        "blog_post",
        "blog_translation",
        "newsletter_type",
        "newsletter_edition",
        "campaign_translation",
        "author",
        "site",
        "ad_campaign",
        "ad_placeholder",
        "ad_slot_creative",
        "tracked_link",
      ],
      post_status: [
        "idea",
        "draft",
        "ready",
        "queued",
        "scheduled",
        "pending_review",
        "published",
        "archived",
      ],
    },
  },
} as const

