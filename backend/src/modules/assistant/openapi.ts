import { z } from "zod";
import { commonErrorResponses, registry, successEnvelope } from "../../lib/openapi.js";
import { assistantTurnBodySchema } from "./types.js";

const quickReplySchema = z.object({ title: z.string(), payload: z.string() });
const buttonSchema = z.union([
  z.object({ type: z.literal("web_url"), title: z.string(), url: z.string().url() }),
  z.object({ type: z.literal("postback"), title: z.string(), payload: z.string() }),
]);
const cardSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  image_url: z.string().url().optional(),
  url: z.string().url().optional(),
  buttons: z.array(buttonSchema),
});

const planMessageSchema = z.union([
  z.object({ kind: z.literal("text"), text: z.string(), quick_replies: z.array(quickReplySchema).optional() }),
  z.object({ kind: z.literal("button"), text: z.string(), buttons: z.array(buttonSchema), quick_replies: z.array(quickReplySchema).optional() }),
  z.object({ kind: z.literal("carousel"), cards: z.array(cardSchema) }),
]);

export const replyPlanSchema = z.object({ messages: z.array(planMessageSchema) }).openapi("AssistantReplyPlan");

registry.registerPath({
  tags: ["Internal"],
  servers: [{ url: "/internal/v1" }],
  security: [{ ServiceToken: [] }],
  method: "post",
  path: "/users/{userId}/assistant/turns",
  summary: "Assistant turn",
  description: `Answers one conversational turn for a channel user: free-form text, or a tap on a quick reply or template button. The assistant (an LLM with tools over the user's lists, saved places and recent recognitions) replies in the user's language and returns a plan of channel messages to send in order: carousels and link buttons first, the text with its quick replies last.

Idempotent on the last message's \`external_id\`: a repeated request for a turn already handled returns the stored plan without running the model again. Several messages in one request are quick follow-ups the channel folded into one turn, oldest first.

Shares (a Reel, a post, a link) are not sent here; the channel starts a recognition for them.`,
  request: {
    params: z.object({ userId: z.string().uuid() }),
    body: { required: true, content: { "application/json": { schema: assistantTurnBodySchema.openapi("AssistantTurnBody") } } },
  },
  responses: {
    200: { description: "The reply plan", content: { "application/json": { schema: successEnvelope(replyPlanSchema, "AssistantTurn") } } },
    ...commonErrorResponses,
  },
});
