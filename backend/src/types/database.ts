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
      user_lists: {
        Row: {
          id: string;
          owner_user_id: string;
          title: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          title?: string;
          description?: string | null;
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
          user_place_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          owner_user_id: string;
          user_place_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          owner_user_id?: string;
          user_place_id?: string;
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
          source_updated_at: string | null;
          user_rating_count: number | null;
          business_status: string | null;
          google_maps_uri: string | null;
          types: Json | null;
          regular_opening_hours: Json | null;
          short_formatted_address: string | null;
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
          source_updated_at?: string | null;
          user_rating_count?: number | null;
          business_status?: string | null;
          google_maps_uri?: string | null;
          types?: Json | null;
          regular_opening_hours?: Json | null;
          short_formatted_address?: string | null;
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
          source_updated_at?: string | null;
          user_rating_count?: number | null;
          business_status?: string | null;
          google_maps_uri?: string | null;
          types?: Json | null;
          regular_opening_hours?: Json | null;
          short_formatted_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recognition_results: {
        Row: {
          id: string;
          normalized_source_url: string;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          normalized_source_url: string;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          normalized_source_url?: string;
          items?: Json;
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
          normalized_source_url: string;
          result_id: string | null;
          status: string;
          started_at: string | null;
          finished_at: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          source_url: string;
          normalized_source_url: string;
          result_id?: string | null;
          status?: string;
          started_at?: string | null;
          finished_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          source_url?: string;
          normalized_source_url?: string;
          result_id?: string | null;
          status?: string;
          started_at?: string | null;
          finished_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_places: {
        Row: {
          id: string;
          owner_user_id: string;
          place_id: string;
          personal_note: string | null;
          recommendations: Json;
          saved_from_source_url: string | null;
          source_instagram_username: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          place_id: string;
          personal_note?: string | null;
          recommendations?: Json;
          saved_from_source_url?: string | null;
          source_instagram_username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          place_id?: string;
          personal_note?: string | null;
          recommendations?: Json;
          saved_from_source_url?: string | null;
          source_instagram_username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_visits: {
        Row: {
          id: string;
          owner_user_id: string;
          user_place_id: string;
          visited_at: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          user_place_id: string;
          visited_at: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          user_place_id?: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
