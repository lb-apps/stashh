import { describe, expect, it } from "vitest";
import { LIMITS, toGraphMessage } from "../src/meta/graph-client.ts";
import { truncateGraphemes, truncateUtf8 } from "../src/meta/text.ts";
import { composeRecognitionReply, toCard } from "../src/replies/compose.ts";
import { sourceKindOf } from "../src/replies/copy.tr.ts";
import type { Place } from "../src/stashh/client.ts";

const place: Place = {
  google_place_id: "ChIJabc",
  name: "Forno Di Roma",
  address: "Caferağa, Moda Cd. No:4, Kadıköy",
  rating: 3.9,
  thumbnail_url: "https://cdn.example/forno.jpg",
  instagram_username: "fornodiromatr",
  recommendations: [],
};

describe("text truncation", () => {
  it("leaves text within the limit untouched", () => {
    expect(truncateGraphemes("Moda", 4)).toBe("Moda");
  });

  it("never splits a grapheme cluster", () => {
    const family = "👨‍👩‍👧";
    expect(truncateGraphemes(`ab${family}cd`, 4)).toBe(`ab${family}…`);
  });

  it("measures message text in UTF-8 bytes", () => {
    const out = truncateUtf8("ş".repeat(600), 1000);
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(1000);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("toGraphMessage", () => {
  it("enforces every template limit", () => {
    const long = "x".repeat(200);
    const body = toGraphMessage({
      kind: "carousel",
      cards: Array.from({ length: 12 }, () => ({
        title: long,
        subtitle: long,
        url: "https://maps.example",
        buttons: Array.from({ length: 5 }, () => ({ title: long, url: "https://b.example" })),
      })),
    }) as { attachment: { payload: { elements: Array<{ title: string; subtitle: string; buttons: Array<{ title: string }> }> } } };

    const elements = body.attachment.payload.elements;
    expect(elements).toHaveLength(LIMITS.templateElements);
    for (const element of elements) {
      expect([...element.title]).toHaveLength(LIMITS.titleChars);
      expect([...element.subtitle]).toHaveLength(LIMITS.subtitleChars);
      expect(element.buttons).toHaveLength(LIMITS.buttonsPerElement);
      expect([...element.buttons[0]!.title]).toHaveLength(LIMITS.buttonTitleChars);
    }
  });

  it("sends a button message as a button template within its limits", () => {
    const body = toGraphMessage({
      kind: "button",
      text: "x".repeat(700),
      buttons: Array.from({ length: 4 }, () => ({ title: "y".repeat(30), url: "https://stashh.me/app/a/abc" })),
    }) as { attachment: { type: string; payload: { template_type: string; text: string; buttons: Array<{ type: string; title: string; url: string }> } } };

    expect(body.attachment.type).toBe("template");
    expect(body.attachment.payload.template_type).toBe("button");
    expect([...body.attachment.payload.text]).toHaveLength(LIMITS.buttonTemplateTextChars);
    expect(body.attachment.payload.buttons).toHaveLength(LIMITS.buttonsPerElement);
    expect(body.attachment.payload.buttons[0]).toEqual({ type: "web_url", title: "y".repeat(19) + "…", url: "https://stashh.me/app/a/abc" });
  });

  it("omits optional fields a card does not have", () => {
    const body = toGraphMessage({ kind: "carousel", cards: [{ title: "A", buttons: [] }] });
    expect(body).toEqual({
      attachment: { type: "template", payload: { template_type: "generic", elements: [{ title: "A", buttons: [] }] } },
    });
  });
});

describe("composeRecognitionReply", () => {
  it("builds a card with rating, address, image, maps and Instagram links", () => {
    expect(toCard(place)).toEqual({
      title: "Forno Di Roma",
      subtitle: "★ 3,9 · Caferağa, Moda Cd. No:4, Kadıköy",
      imageUrl: "https://cdn.example/forno.jpg",
      url: "https://www.google.com/maps/search/?api=1&query=Forno+Di+Roma&query_place_id=ChIJabc",
      buttons: [
        { title: "Google Maps'te aç", url: "https://www.google.com/maps/search/?api=1&query=Forno+Di+Roma&query_place_id=ChIJabc" },
        { title: "Instagram", url: "https://www.instagram.com/fornodiromatr/" },
      ],
    });
  });

  it("drops what a place does not have", () => {
    const card = toCard({ ...place, rating: null, address: null, thumbnail_url: null, instagram_username: null });
    expect(card).not.toHaveProperty("subtitle");
    expect(card).not.toHaveProperty("imageUrl");
    expect(card.buttons.map((b) => b.title)).toEqual(["Google Maps'te aç"]);
  });

  it("names the source the way the person shared it", () => {
    expect(sourceKindOf({ kind: "url", url: "https://www.instagram.com/reel/X/" })).toBe("reel");
    expect(sourceKindOf({ kind: "url", url: "https://www.instagram.com/p/X/" })).toBe("post");
    expect(sourceKindOf({ kind: "url", url: "https://vm.tiktok.com/X/" })).toBe("video");
    expect(sourceKindOf({ kind: "instagram_media", format: "post", mediaId: "1", mediaUrl: "https://lookaside.fbsbx.com/x", caption: null })).toBe("post");
    expect(sourceKindOf({ kind: "instagram_media", format: "story", mediaId: "1", mediaUrl: "https://lookaside.fbsbx.com/x", caption: null })).toBe("story");
    expect(composeRecognitionReply([place], "post")[0]).toEqual({ kind: "text", text: "Bu gönderide 1 mekân var, hepsini haritana ekledik." });
  });

  it("puts the person's map link under the summary when there is one", () => {
    expect(composeRecognitionReply([place], "reel", "https://stashh.me/app/a/abc")[0]).toEqual({
      kind: "button",
      text: "Bu Reel'de 1 mekân var, hepsini haritana ekledik.",
      buttons: [{ title: "Haritanda aç", url: "https://stashh.me/app/a/abc" }],
    });
  });
});
