import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";

export type PlaceRow = Database["public"]["Tables"]["places"]["Row"];
export type PlaceInsert = Database["public"]["Tables"]["places"]["Insert"];
export type SavedPlaceRow = Database["public"]["Tables"]["saved_places"]["Row"];
export type SavedPlaceInsert = Database["public"]["Tables"]["saved_places"]["Insert"];
export type SavedPlaceUpdate = Database["public"]["Tables"]["saved_places"]["Update"];

/**
 * A saved place with everything its DTO shows: the canonical place, the owner's lists and
 * visits, and the recognition it was saved from. Every read of a saved place uses this one
 * select, so the list, detail, nearby and list-detail endpoints return the same shape.
 */
export const SAVED_PLACE_SELECT = `
  *,
  places!inner (*),
  list_places!list_places_user_place_id_fkey (list_id),
  user_visits (visited_at),
  recognition_tasks!saved_places_source_recognition_task_id_fkey (
    source_url,
    recognition_results (source_type, source_thumbnail_url, author_username)
  )
`;

type SourceResult = { source_type: string | null; source_thumbnail_url: string | null; author_username: string | null };

export interface SavedPlaceRecord {
  saved_place: SavedPlaceRow;
  place: PlaceRow;
  list_ids: string[];
  /** `visited_at` of every visit, in no particular order. */
  visits: string[];
  /** The recognition the place was saved from: its task's source and the result's details. */
  source: null | { source_url: string; result: SourceResult | null };
}

type SavedPlaceSelectRow = SavedPlaceRow & {
  places: PlaceRow | null;
  list_places: Array<{ list_id: string }> | null;
  user_visits: Array<{ visited_at: string }> | null;
  recognition_tasks: null | { source_url: string; recognition_results: SourceResult | null };
};

/** Splits a {@link SAVED_PLACE_SELECT} row into its parts; null when the place embed is missing. */
export function toSavedPlaceRecord(raw: unknown): SavedPlaceRecord | null {
  const { places: place, list_places, user_visits, recognition_tasks, ...saved_place } = raw as SavedPlaceSelectRow;
  if (!place) return null;
  return {
    saved_place,
    place,
    list_ids: (list_places ?? []).map((row) => row.list_id),
    visits: (user_visits ?? []).map((row) => row.visited_at),
    source: recognition_tasks
      ? { source_url: recognition_tasks.source_url, result: recognition_tasks.recognition_results ?? null }
      : null,
  };
}

function requireSavedPlaceRecord(raw: unknown): SavedPlaceRecord {
  const record = toSavedPlaceRecord(raw);
  if (!record) throw new Error("places embed missing for saved_place");
  return record;
}

/** A row returned by the get_nearby_saved_places RPC. */
export interface NearbyPlaceRow {
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
}

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

  async countSavedPlaces(
    ownerUserId: string,
    options: { district?: string; category?: string } = {},
  ): Promise<number> {
    let query = this.userSupabase
      .from("saved_places")
      .select("*, places!inner(*)", { count: "exact", head: true })
      .eq("owner_user_id", ownerUserId);

    if (options.district) {
      query = query.eq("places.district", options.district);
    }
    if (options.category) {
      query = query.eq("places.category", options.category);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async listSavedPlacesPage(
    ownerUserId: string,
    offset: number,
    limit: number,
    options: {
      sort?: "recent" | "rating" | "category";
      district?: string;
      category?: string;
    } = {},
  ): Promise<SavedPlaceRecord[]> {
    let query = this.userSupabase
      .from("saved_places")
      .select(SAVED_PLACE_SELECT)
      .eq("owner_user_id", ownerUserId);

    if (options.district) {
      query = query.eq("places.district", options.district);
    }

    if (options.category) {
      query = query.eq("places.category", options.category);
    }

    const sort = options.sort ?? "recent";
    if (sort === "recent") {
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    } else if (sort === "rating") {
      query = query
        .order("rating", { ascending: false, nullsFirst: false, referencedTable: "places" })
        .order("id", { ascending: false });
    } else if (sort === "category") {
      query = query
        .order("category", { ascending: true, nullsFirst: false, referencedTable: "places" })
        .order("name", { ascending: true, referencedTable: "places" });
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;
    return (data ?? []).map(requireSavedPlaceRecord);
  }

  /** Saved places by canonical `places.id`, in no particular order; ids the owner has not saved are left out. */
  async getSavedPlacesByPlaceIds(placeIds: string[], ownerUserId: string): Promise<SavedPlaceRecord[]> {
    if (placeIds.length === 0) return [];
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select(SAVED_PLACE_SELECT)
      .eq("owner_user_id", ownerUserId)
      .in("place_id", placeIds);
    if (error) throw error;
    return (data ?? []).map(requireSavedPlaceRecord);
  }

  /**
   * The owner's saved places whose name, address, district or city contains `query`
   * (case-insensitive), newest save first. Characters PostgREST reserves in a filter are
   * dropped from the query, so a stray comma or bracket cannot change the filter.
   */
  async searchSavedPlaces(ownerUserId: string, query: string, limit: number): Promise<SavedPlaceRecord[]> {
    const needle = query.replace(/[,()*%\\"]/g, " ").trim();
    if (!needle) return [];
    const pattern = `*${needle}*`;
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select(SAVED_PLACE_SELECT)
      .eq("owner_user_id", ownerUserId)
      // The `places!inner` embed drops saved places whose place fails the filter.
      .or(`name.ilike.${pattern},address.ilike.${pattern},district.ilike.${pattern},city.ilike.${pattern}`, { referencedTable: "places" })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(requireSavedPlaceRecord);
  }

  /** Canonical places by Google place id, in no particular order. */
  async getPlacesByGoogleIds(googlePlaceIds: string[]): Promise<PlaceRow[]> {
    if (googlePlaceIds.length === 0) return [];
    const { data, error } = await this.userSupabase.from("places").select("*").in("google_place_id", googlePlaceIds);
    if (error) throw error;
    return data ?? [];
  }

  /** Saved places by their `saved_places.id`, in no particular order. */
  async getSavedPlacesByIds(savedPlaceIds: string[], ownerUserId: string): Promise<SavedPlaceRecord[]> {
    if (savedPlaceIds.length === 0) return [];
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select(SAVED_PLACE_SELECT)
      .eq("owner_user_id", ownerUserId)
      .in("id", savedPlaceIds);
    if (error) throw error;
    return (data ?? []).map(requireSavedPlaceRecord);
  }

  async getSavedPlaceForOwner(
    savedPlaceId: string,
    ownerUserId: string,
  ): Promise<{ saved_place: SavedPlaceRow; place: PlaceRow } | null> {
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select("*, places (*)")
      .eq("id", savedPlaceId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as SavedPlaceRow & { places: PlaceRow | null };
    const { places: place, ...saved_place } = row;
    if (!place) return null;
    return { saved_place, place };
  }

  /**
   * Lookup saved_place by canonical places.id + owner (for the canonical ID API).
   */
  async getSavedPlaceByCanonicalId(placeId: string, ownerUserId: string): Promise<SavedPlaceRecord | null> {
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select(SAVED_PLACE_SELECT)
      .eq("place_id", placeId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    return data ? toSavedPlaceRecord(data) : null;
  }

  async userOwnsPlace(ownerUserId: string, placeId: string): Promise<boolean> {
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .eq("place_id", placeId)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async insertSavedPlace(row: SavedPlaceInsert): Promise<SavedPlaceRow> {
    const { data, error } = await this.userSupabase.from("saved_places").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async tryInsertSavedPlace(row: SavedPlaceInsert): Promise<{ row: SavedPlaceRow; created: boolean }> {
    const { data, error } = await this.userSupabase.from("saved_places").insert(row).select("*").single();
    if (!error && data) {
      return { row: data, created: true };
    }
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      const existing = await this.getSavedPlaceByOwnerAndPlaceId(row.owner_user_id, row.place_id);
      if (!existing) throw error;
      return { row: existing, created: false };
    }
    throw error;
  }

  async getSavedPlaceByOwnerAndPlaceId(
    ownerUserId: string,
    placeId: string,
  ): Promise<SavedPlaceRow | null> {
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .eq("place_id", placeId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateSavedPlace(
    savedPlaceId: string,
    ownerUserId: string,
    patch: SavedPlaceUpdate,
  ): Promise<SavedPlaceRow | null> {
    const { data, error } = await this.userSupabase
      .from("saved_places")
      .update(patch)
      .eq("id", savedPlaceId)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async deleteSavedPlace(savedPlaceId: string, ownerUserId: string): Promise<boolean> {
    const { error, count } = await this.userSupabase
      .from("saved_places")
      .delete({ count: "exact" })
      .eq("id", savedPlaceId)
      .eq("owner_user_id", ownerUserId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  /** Records a visit unless the saved place already has one, so marking twice is a no-op. */
  async markVisited(savedPlaceId: string, ownerUserId: string, visitedAt: Date): Promise<void> {
    const { data, error } = await this.userSupabase
      .from("user_visits")
      .select("id")
      .eq("saved_place_id", savedPlaceId)
      .eq("owner_user_id", ownerUserId)
      .limit(1);
    if (error) throw error;
    if (data.length > 0) return;

    const { error: insertError } = await this.userSupabase
      .from("user_visits")
      .insert({ saved_place_id: savedPlaceId, owner_user_id: ownerUserId, visited_at: visitedAt.toISOString() });
    if (insertError) throw insertError;
  }

  /** Forgets every visit to the saved place. */
  async clearVisits(savedPlaceId: string, ownerUserId: string): Promise<void> {
    const { error } = await this.userSupabase
      .from("user_visits")
      .delete()
      .eq("saved_place_id", savedPlaceId)
      .eq("owner_user_id", ownerUserId);
    if (error) throw error;
  }

  /**
   * Calls the PostGIS-backed RPC to list nearby saved places ordered by distance.
   * Returns at most `limit` rows from the given offset.
   */
  async listNearbyPlaces(params: {
    ownerUserId: string;
    longitude: number;
    latitude: number;
    radiusM: number;
    limit: number;
    offset: number;
    category?: string;
  }): Promise<NearbyPlaceRow[]> {
    const { data, error } = await this.userSupabase.rpc("get_nearby_saved_places", {
      p_user_id: params.ownerUserId,
      p_lng: params.longitude,
      p_lat: params.latitude,
      p_radius_m: params.radiusM,
      p_category: params.category,
      p_limit: params.limit,
      p_offset: params.offset,
    });
    if (error) throw error;
    return (data ?? []) as unknown as NearbyPlaceRow[];
  }

  /**
   * Calls the PostGIS-backed RPC to count total nearby saved places (for pagination).
   */
  async countNearbyPlaces(params: {
    ownerUserId: string;
    longitude: number;
    latitude: number;
    radiusM: number;
    category?: string;
  }): Promise<number> {
    const { data, error } = await this.userSupabase.rpc("count_nearby_saved_places", {
      p_user_id: params.ownerUserId,
      p_lng: params.longitude,
      p_lat: params.latitude,
      p_radius_m: params.radiusM,
      p_category: params.category,
    });
    if (error) throw error;
    return Number(data ?? 0);
  }

}
