import sharp from "sharp";
import type { SupabaseClient } from "./supabase.ts";

const BUCKET = "menu-images";

export class ImageStorage {
  private db: SupabaseClient;
  private maxWidth: number;

  constructor(db: SupabaseClient, options: { maxWidth: number }) {
    this.db = db;
    this.maxWidth = options.maxWidth;
  }

  async downloadAndStore(originalUrl: string, placeId: string, itemId: string): Promise<string | null> {
    try {
      const response = await fetch(originalUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      const webp = await sharp(buffer).resize({ width: this.maxWidth, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();

      const path = `${placeId}/${itemId}.webp`;
      const { error } = await this.db.storage.from(BUCKET).upload(path, webp, {
        contentType: "image/webp",
        upsert: true,
      });

      if (error) return null;

      const { data } = this.db.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }
}
