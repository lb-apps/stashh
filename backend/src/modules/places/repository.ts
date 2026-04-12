import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

export type PlaceRow = Database["public"]["Tables"]["places"]["Row"];
export type PlaceInsert = Database["public"]["Tables"]["places"]["Insert"];
export type UserPlaceRow = Database["public"]["Tables"]["user_places"]["Row"];
export type UserPlaceInsert = Database["public"]["Tables"]["user_places"]["Insert"];
export type UserPlaceUpdate = Database["public"]["Tables"]["user_places"]["Update"];

export class PlacesRepository {
  constructor(
    private readonly userSupabase: SupabaseClient<Database>,
    private readonly serviceSupabase: SupabaseClient<Database>,
  ) {}

  async getPlaceByGooglePlaceId(googlePlaceId: string): Promise<PlaceRow | null> {
    const { data, error } = await this.serviceSupabase
      .from("places")
      .select("*")
      .eq("google_place_id", googlePlaceId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getPlaceById(placeId: string): Promise<PlaceRow | null> {
    const { data, error } = await this.serviceSupabase
      .from("places")
      .select("*")
      .eq("id", placeId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Upserts canonical place by google_place_id (service role — RLS has no insert for users).
   */
  async upsertPlace(row: PlaceInsert): Promise<PlaceRow> {
    const { data, error } = await this.serviceSupabase
      .from("places")
      .upsert(row, { onConflict: "google_place_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async updatePlaceThumbnailIfEmpty(placeId: string, thumbnailUrl: string): Promise<void> {
    const { error } = await this.serviceSupabase
      .from("places")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", placeId)
      .is("thumbnail_url", null);
    if (error) throw error;
  }

  async updatePlace(placeId: string, patch: Partial<PlaceInsert>): Promise<void> {
    const { error } = await this.serviceSupabase.from("places").update(patch).eq("id", placeId);
    if (error) throw error;
  }

  async countUserPlaces(ownerUserId: string): Promise<number> {
    const { count, error } = await this.userSupabase
      .from("user_places")
      .select("*", { count: "exact", head: true })
      .eq("owner_user_id", ownerUserId);
    if (error) throw error;
    return count ?? 0;
  }

  async listUserPlacesPage(
    ownerUserId: string,
    offset: number,
    limit: number,
  ): Promise<
    Array<{
      user_place: UserPlaceRow;
      place: PlaceRow;
    }>
  > {
    const { data, error } = await this.userSupabase
      .from("user_places")
      .select("*, places (*)")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    const rows = data ?? [];
    return rows.map((r) => {
      const row = r as unknown as UserPlaceRow & { places: PlaceRow | null };
      const { places: place, ...user_place } = row;
      if (!place) {
        throw new Error("places embed missing for user_place");
      }
      return { user_place, place };
    });
  }

  async getUserPlaceForOwner(
    userPlaceId: string,
    ownerUserId: string,
  ): Promise<{ user_place: UserPlaceRow; place: PlaceRow } | null> {
    const { data, error } = await this.userSupabase
      .from("user_places")
      .select("*, places (*)")
      .eq("id", userPlaceId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as UserPlaceRow & { places: PlaceRow | null };
    const { places: place, ...user_place } = row;
    if (!place) return null;
    return { user_place, place };
  }

  async userOwnsPlace(ownerUserId: string, placeId: string): Promise<boolean> {
    const { data, error } = await this.userSupabase
      .from("user_places")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .eq("place_id", placeId)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async insertUserPlace(row: UserPlaceInsert): Promise<UserPlaceRow> {
    const { data, error } = await this.userSupabase.from("user_places").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async tryInsertUserPlace(row: UserPlaceInsert): Promise<{ row: UserPlaceRow; created: boolean }> {
    const { data, error } = await this.userSupabase.from("user_places").insert(row).select("*").single();
    if (!error && data) {
      return { row: data, created: true };
    }
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      const existing = await this.getUserPlaceByOwnerAndPlaceId(row.owner_user_id, row.place_id);
      if (!existing) throw error;
      return { row: existing, created: false };
    }
    throw error;
  }

  async getUserPlaceByOwnerAndPlaceId(
    ownerUserId: string,
    placeId: string,
  ): Promise<UserPlaceRow | null> {
    const { data, error } = await this.userSupabase
      .from("user_places")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .eq("place_id", placeId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateUserPlace(
    userPlaceId: string,
    ownerUserId: string,
    patch: UserPlaceUpdate,
  ): Promise<UserPlaceRow | null> {
    const { data, error } = await this.userSupabase
      .from("user_places")
      .update(patch)
      .eq("id", userPlaceId)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteUserPlace(userPlaceId: string, ownerUserId: string): Promise<boolean> {
    const { error, count } = await this.userSupabase
      .from("user_places")
      .delete({ count: "exact" })
      .eq("id", userPlaceId)
      .eq("owner_user_id", ownerUserId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

}
