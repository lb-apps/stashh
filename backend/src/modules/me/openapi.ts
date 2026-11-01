import { z } from "zod";
import { commonErrorResponses, registry, successEnvelope } from "../../lib/openapi.js";

const meSchema = z
  .object({
    user_id: z.string().uuid(),
    display_name: z.string().nullable().describe("Name on the person's Instagram profile; null when they have none or it is not known yet"),
    instagram_username: z.string().nullable().describe("Instagram username, without @; null for an account not linked to Instagram"),
    created_at: z.string().datetime().describe("When the account was created"),
    saved_count: z.number().int().describe("Places in the library"),
  })
  .openapi("Me");

registry.registerPath({
  method: "get",
  path: "/me",
  tags: ["Me"],
  summary: "Get profile",
  description:
    "The signed-in account for the profile screen: the Instagram name and username it is linked to (refreshed daily by the DM service), when it joined and how many places it has saved.",
  responses: {
    200: { description: "Profile", content: { "application/json": { schema: successEnvelope(meSchema, "GetMe") } } },
    ...commonErrorResponses,
  },
});
