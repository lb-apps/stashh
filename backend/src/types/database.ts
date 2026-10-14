/**
 * Generated shape for @supabase/supabase-js.
 * Refresh with: `npm run db:types` (requires SUPABASE_PROJECT_REF and Supabase CLI).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      channel_identities: {
        Row: {
          provider: string;
          external_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          provider: string;
          external_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          provider?: string;
          external_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_lists: {
        Row: {
          id: string;
          owner_user_id: string;
          title: string;
          description: string | null;
          emoji: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          title: string;
          description?: string | null;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          title?: string;
          description?: string | null;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      list_places: {
        Row: {
          id: string;
          list_id: string;
          owner_user_id: string;
          saved_place_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          owner_user_id: string;
          saved_place_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          owner_user_id?: string;
          saved_place_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          google_place_id: string | null;
          name: string;
          address: string | null;
          city: string | null;
          district: string | null;
          country: string | null;
          location: Json | null;
          category: string | null;
          rating: number | null;
          price_level: number | null;
          thumbnail_url: string | null;
          website_url: string | null;
          phone_number: string | null;
          rating_count: number | null;
          business_status: string | null;
          google_maps_uri: string | null;
          types: Json | null;
          opening_hours: Json | null;
          short_formatted_address: string | null;
          instagram_username: string | null;
          recommendations: Json;
          geo_location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          google_place_id?: string | null;
          name: string;
          address?: string | null;
          city?: string | null;
          district?: string | null;
          country?: string | null;
          location?: Json | null;
          category?: string | null;
          rating?: number | null;
          price_level?: number | null;
          thumbnail_url?: string | null;
          website_url?: string | null;
          phone_number?: string | null;
          rating_count?: number | null;
          business_status?: string | null;
          google_maps_uri?: string | null;
          types?: Json | null;
          opening_hours?: Json | null;
          short_formatted_address?: string | null;
          instagram_username?: string | null;
          recommendations?: Json;
          geo_location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          google_place_id?: string | null;
          name?: string;
          address?: string | null;
          city?: string | null;
          district?: string | null;
          country?: string | null;
          location?: Json | null;
          category?: string | null;
          rating?: number | null;
          price_level?: number | null;
          thumbnail_url?: string | null;
          website_url?: string | null;
          phone_number?: string | null;
          rating_count?: number | null;
          business_status?: string | null;
          google_maps_uri?: string | null;
          types?: Json | null;
          opening_hours?: Json | null;
          short_formatted_address?: string | null;
          instagram_username?: string | null;
          recommendations?: Json;
          geo_location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recognition_results: {
        Row: {
          id: string;
          source_url: string;
          places: Json;
          video_url: string | null;
          caption: string | null;
          source_type: "reel" | "post" | "story" | "tiktok" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_url: string;
          places?: Json;
          video_url?: string | null;
          caption?: string | null;
          source_type?: "reel" | "post" | "story" | "tiktok" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_url?: string;
          places?: Json;
          video_url?: string | null;
          caption?: string | null;
          source_type?: "reel" | "post" | "story" | "tiktok" | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recognition_tasks: {
        Row: {
          id: string;
          owner_user_id: string;
          source_url: string;
          result_id: string | null;
          status: string;
          options: Json;
          started_at: string | null;
          finished_at: string | null;
          error_message: string | null;
          retry_count: number;
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          source_url: string;
          result_id?: string | null;
          status?: string;
          options?: Json;
          started_at?: string | null;
          finished_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          source_url?: string;
          result_id?: string | null;
          status?: string;
          options?: Json;
          started_at?: string | null;
          finished_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_places: {
        Row: {
          id: string;
          owner_user_id: string;
          place_id: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          place_id: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          place_id?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_visits: {
        Row: {
          id: string;
          owner_user_id: string;
          saved_place_id: string;
          visited_at: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          saved_place_id: string;
          visited_at: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          saved_place_id?: string;
          visited_at?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          username: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_recognitions: {
        Args: {
          p_worker_identifier: string;
          p_claim_limit?: number;
        };
        Returns: Database["public"]["Tables"]["recognition_tasks"]["Row"][];
      };
      recover_stale_recognitions: {
        Args: {
          p_stale_after_milliseconds: number;
          p_claim_limit?: number;
        };
        Returns: Database["public"]["Tables"]["recognition_tasks"]["Row"][];
      };
      get_library_district_counts: {
        Args: { p_user_id: string };
        Returns: Array<{ district: string; city: string | null; place_count: number }>;
      };
      get_library_category_counts: {
        Args: { p_user_id: string };
        Returns: Array<{ category: string; place_count: number }>;
      };
      get_nearby_saved_places: {
        Args: {
          p_user_id: string;
          p_lng: number;
          p_lat: number;
          p_radius_m?: number;
          p_category?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Array<{
          saved_place_id: string;
          notes: string | null;
          saved_at: string;
          id: string;
          google_place_id: string | null;
          name: string;
          address: string | null;
          short_formatted_address: string | null;
          city: string | null;
          district: string | null;
          country: string | null;
          location: Json | null;
          category: string | null;
          rating: number | null;
          rating_count: number | null;
          price_level: number | null;
          thumbnail_url: string | null;
          website_url: string | null;
          phone_number: string | null;
          google_maps_uri: string | null;
          business_status: string | null;
          types: Json | null;
          opening_hours: Json | null;
          instagram_username: string | null;
          recommendations: Json;
          distance_m: number;
        }>;
      };
      count_nearby_saved_places: {
        Args: {
          p_user_id: string;
          p_lng: number;
          p_lat: number;
          p_radius_m?: number;
          p_category?: string | null;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
