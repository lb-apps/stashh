import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";
import type { LibrarySummaryCategory, LibrarySummaryDistrict } from "./types.js";

export class LibraryRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Returns district + city + place count for all saved places belonging to this user.
   * Delegates GROUP BY to Postgres via RPC so the partial index on places.district
   * can be used directly — avoids shipping all rows to Node.js for aggregation.
   */
  async getDistrictCounts(ownerUserId: string): Promise<LibrarySummaryDistrict[]> {
    const { data, error } = await this.supabase.rpc("get_library_district_counts", {
      p_user_id: ownerUserId,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      district: row.district,
      city: row.city,
      place_count: Number(row.place_count),
    }));
  }

  /**
   * Returns category + place count for all saved places belonging to this user.
   * Delegates GROUP BY to Postgres via RPC — see getDistrictCounts for rationale.
   */
  async getCategoryCounts(ownerUserId: string): Promise<LibrarySummaryCategory[]> {
    const { data, error } = await this.supabase.rpc("get_library_category_counts", {
      p_user_id: ownerUserId,
    });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      category: row.category,
      place_count: Number(row.place_count),
    }));
  }
}
