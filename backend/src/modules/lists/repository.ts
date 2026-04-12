import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

export type ListRecord = Database["public"]["Tables"]["user_lists"]["Row"];
export type ListInsert = Database["public"]["Tables"]["user_lists"]["Insert"];
export type ListUpdate = Database["public"]["Tables"]["user_lists"]["Update"];
export type ListPlaceRow = Database["public"]["Tables"]["list_places"]["Row"];
export type ListPlaceInsert = Database["public"]["Tables"]["list_places"]["Insert"];

export class ListsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listListsForOwner(ownerUserId: string): Promise<ListRecord[]> {
    const { data, error } = await this.supabase
      .from("user_lists")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async countListPlacesByListIds(ownerUserId: string, listIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (listIds.length === 0) return counts;

    const { data, error } = await this.supabase
      .from("list_places")
      .select("list_id")
      .eq("owner_user_id", ownerUserId)
      .in("list_id", listIds);

    if (error) throw error;
    for (const row of data ?? []) {
      const id = row.list_id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  async countListPlacesForList(ownerUserId: string, listId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("list_places")
      .select("*", { count: "exact", head: true })
      .eq("owner_user_id", ownerUserId)
      .eq("list_id", listId);

    if (error) throw error;
    return count ?? 0;
  }

  async getListForOwner(listId: string, ownerUserId: string): Promise<ListRecord | null> {
    const { data, error } = await this.supabase
      .from("user_lists")
      .select("*")
      .eq("id", listId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async insertList(row: ListInsert): Promise<ListRecord> {
    const { data, error } = await this.supabase.from("user_lists").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async updateList(listId: string, ownerUserId: string, patch: ListUpdate): Promise<ListRecord | null> {
    const { data, error } = await this.supabase
      .from("user_lists")
      .update(patch)
      .eq("id", listId)
      .eq("owner_user_id", ownerUserId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async deleteList(listId: string, ownerUserId: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from("user_lists")
      .delete({ count: "exact" })
      .eq("id", listId)
      .eq("owner_user_id", ownerUserId);

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async getUserPlaceForOwner(
    userPlaceId: string,
    ownerUserId: string,
  ): Promise<{ id: string; place_id: string } | null> {
    const { data, error } = await this.supabase
      .from("user_places")
      .select("id, place_id")
      .eq("id", userPlaceId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async insertListPlace(row: ListPlaceInsert): Promise<ListPlaceRow> {
    const { data, error } = await this.supabase.from("list_places").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async deleteListPlace(listPlaceId: string, listId: string, ownerUserId: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from("list_places")
      .delete({ count: "exact" })
      .eq("id", listPlaceId)
      .eq("list_id", listId)
      .eq("owner_user_id", ownerUserId);

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  /**
   * Fetches up to `limit` rows starting at `offset`, ordered by created_at, id.
   * Caller requests `limit + 1` to detect `has_more`.
   */
  async listPlacesPage(
    listId: string,
    ownerUserId: string,
    offset: number,
    fetchSize: number,
  ): Promise<ListPlaceWithPlace[]> {
    const { data, error } = await this.supabase
      .from("list_places")
      .select(
        `
        id,
        list_id,
        user_place_id,
        created_at,
        user_places (
          id,
          place_id,
          places (
            id,
            name,
            thumbnail_url,
            address
          )
        )
      `,
      )
      .eq("list_id", listId)
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + fetchSize - 1);

    if (error) throw error;
    return (data ?? []) as unknown as ListPlaceWithPlace[];
  }
}

/** Shape returned by Supabase embed resolver (best-effort). */
export interface ListPlaceWithPlace {
  id: string;
  list_id: string;
  user_place_id: string;
  created_at: string;
  user_places: null | {
    id: string;
    place_id: string;
    places: null | {
      id: string;
      name: string;
      thumbnail_url: string | null;
      address: string | null;
    };
  };
}
