import { describe, expect, it } from "vitest";
import { autoSavePlaces } from "../src/modules/recognitions/auto-save.js";
import type { RecognitionResultPlace } from "../src/modules/recognitions/service.js";

const place = (id: string): RecognitionResultPlace => ({
  google_place_id: id,
  name: id,
  address: "",
  location: null,
  rating: null,
  thumbnail_url: null,
  instagram_username: null,
  recommendations: [],
});

class FakePlaces {
  calls: Array<{ owner: string; ids: string[]; taskId: string }> = [];
  saved = new Set<string>();
  async saveRecognitionPlaces(owner: string, items: RecognitionResultPlace[], taskId: string) {
    this.calls.push({ owner, ids: items.map((i) => i.google_place_id), taskId });
    return items.map((item) => {
      const key = `${owner}:${item.google_place_id}`;
      const created = !this.saved.has(key);
      this.saved.add(key);
      return { google_place_id: item.google_place_id, place_id: `p-${item.google_place_id}`, created };
    });
  }
}

const task = (options: unknown) => ({ id: "task-1", owner_user_id: "user-1", options: options as never });

describe("autoSavePlaces", () => {
  it("saves a channel recognition's places to its owner, sourced to the task", async () => {
    const places = new FakePlaces();
    expect(await autoSavePlaces(places, task({ auto_save: true }), [place("a"), place("b")])).toBe(2);
    expect(places.calls).toEqual([{ owner: "user-1", ids: ["a", "b"], taskId: "task-1" }]);
  });

  it("is idempotent: a retry saves nothing new", async () => {
    const places = new FakePlaces();
    await autoSavePlaces(places, task({ auto_save: true }), [place("a")]);
    expect(await autoSavePlaces(places, task({ auto_save: true }), [place("a")])).toBe(0);
  });

  it("leaves app recognitions to the person's own Add places step", async () => {
    const places = new FakePlaces();
    expect(await autoSavePlaces(places, task({}), [place("a")])).toBe(0);
    expect(await autoSavePlaces(places, task(null), [place("a")])).toBe(0);
    expect(await autoSavePlaces(places, task({ auto_save: true }), [])).toBe(0);
    expect(places.calls).toEqual([]);
  });
});
