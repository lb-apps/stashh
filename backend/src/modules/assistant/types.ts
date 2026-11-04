import { z } from "zod";

/**
 * The DM assistant's wire shapes: what a channel posts for one turn and the reply plan it
 * gets back. The plan is channel-neutral in name but Instagram-shaped in its limits (quick
 * replies, generic-template cards, web_url and postback buttons), since that is the one channel.
 */

export const assistantChannelSchema = z.enum(["instagram"]);
export type AssistantChannel = z.infer<typeof assistantChannelSchema>;

/** The quick reply or button the person tapped, as the channel saw it. */
export const tappedSchema = z.object({
  title: z.string().trim().min(1).max(200),
  payload: z.string().trim().min(1).max(1000),
});
export type Tapped = z.infer<typeof tappedSchema>;

export const inboundTurnMessageSchema = z.object({
  /** The channel's id of the message (the Instagram mid); a repeat replays the stored plan. */
  external_id: z.string().trim().min(1).max(512),
  text: z.string().max(4000),
  tapped: tappedSchema.nullish(),
});
export type InboundTurnMessage = z.infer<typeof inboundTurnMessageSchema>;

export const assistantTurnBodySchema = z.object({
  channel: assistantChannelSchema,
  /** The person's messages this turn, oldest first; several when quick follow-ups were folded in. */
  messages: z.array(inboundTurnMessageSchema).min(1).max(20),
});
export type AssistantTurnBody = z.infer<typeof assistantTurnBodySchema>;

export interface PlanQuickReply {
  title: string;
  payload: string;
}

export type PlanButton = { type: "web_url"; title: string; url: string } | { type: "postback"; title: string; payload: string };

export interface PlanCard {
  title: string;
  subtitle?: string;
  image_url?: string;
  /** Opened when the card itself is tapped. */
  url?: string;
  buttons: PlanButton[];
}

export type PlanMessage =
  | { kind: "text"; text: string; quick_replies?: PlanQuickReply[] }
  | { kind: "button"; text: string; buttons: PlanButton[]; quick_replies?: PlanQuickReply[] }
  | { kind: "carousel"; cards: PlanCard[] };

/** What the channel sends, in order. Quick replies go on the last message: Instagram shows them only there. */
export interface ReplyPlan {
  messages: PlanMessage[];
}
