import type { Logger } from "../../lib/logger.js";

export interface IGooglePhotoMediaClient {
  resolvePhotoUri(photoName: string, maxWidth?: number): Promise<string | null>;
}

export class GooglePhotoMediaClient implements IGooglePhotoMediaClient {
  constructor(
    private readonly apiKey: string,
    private readonly log?: Logger,
  ) {}

  async resolvePhotoUri(photoName: string, maxWidth = 400): Promise<string | null> {
    const url = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("maxWidthPx", String(maxWidth));
    url.searchParams.set("skipHttpRedirect", "true");

    const response = await fetch(url);
    if (!response.ok) {
      this.log?.debug({ photoName, status: response.status }, "photo URI resolve failed");
      return null;
    }

    const data = (await response.json()) as { photoUri?: string };
    return data.photoUri ?? null;
  }
}
