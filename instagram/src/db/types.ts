/**
 * Schema of the tables this service owns (`supabase/migrations/20261014130000_instagram_channel.sql`).
 * Hand-written on purpose: the channel must not depend on the backend's tables, so it
 * types only its own. Keep in step with the migration. Rows are `type` aliases, not
 * interfaces: supabase-js needs them assignable to `Record<string, unknown>`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type InstagramMessageRow = {
  mid: string;
  account_id: string;
  sender_id: string;
  sent_at: string;
  text: string | null;
  attachments: Json;
  payload: Json;
  status: "received" | "submitted" | "replied" | "failed" | "expired";
  user_id: string | null;
  recognition_id: string | null;
  submitted_at: string | null;
  replies_sent: number;
  attempts: number;
  next_attempt_at: string;
  locked_until: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramAccountRow = {
  account_id: string;
  access_token: string;
  expires_at: string | null;
  refreshed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      instagram_messages: Table<InstagramMessageRow, "mid" | "account_id" | "sender_id" | "sent_at" | "payload">;
      instagram_accounts: Table<InstagramAccountRow, "account_id" | "access_token">;
    };
    Views: { [_ in never]: never };
    Functions: {
      claim_instagram_messages: {
        Args: { p_limit: number; p_lease_seconds: number };
        Returns: InstagramMessageRow[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
