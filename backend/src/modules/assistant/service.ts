import type { ChatMessage } from "../../lib/openrouter.js";
import type { Json } from "../../types/database.js";
import type { Logger } from "../../lib/logger.js";
import type { ChannelIdentityRepository } from "../identities/repository.js";
import { toSavedPlaceDto } from "../places/service.js";
import { buildContextBlock } from "./context.js";
import type { AssistantMessageRow, AssistantRepository } from "./repository.js";
import { renderReply } from "./render.js";
import { runTurn, type TurnModel } from "./run-turn.js";
import { executeTool, recentRecognitions, toolDefinitions, type ReplyInput, type ToolServices } from "./tools.js";
import type { AssistantChannel, InboundTurnMessage, ReplyPlan } from "./types.js";

/** How much of the conversation the model sees again. */
const HISTORY_LIMIT = 20;
const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CAP_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Recent shares named in the account block; the tool goes further back. */
const RECENT_SHARES = 3;

/** Said when the sender hit the daily cap; Turkish, the channel's default language. */
export const CAPPED_REPLY: ReplyInput = { text: "Bugünlük sohbet hakkın doldu, yarın devam edelim. Reel ve gönderi paylaşmaya devam edebilirsin." };

export interface AssistantServiceDeps {
  repo: AssistantRepository;
  model: TurnModel;
  modelId: string;
  systemPrompt: string;
  tools: ToolServices;
  identities: Pick<ChannelIdentityRepository, "findProfileByUserId">;
  maxSteps: number;
  dailyTurnCap: number;
  log: Logger;
  now?: () => Date;
}

export interface TurnInput {
  userId: string;
  channel: AssistantChannel;
  messages: InboundTurnMessage[];
}

/**
 * One conversational turn for a channel user: replays a turn already handled, applies the
 * daily cap, builds the model's view (cached prompt, live account block, recent history),
 * runs the tool loop, renders the reply into a plan and records everything.
 */
export class AssistantService {
  private readonly now: () => Date;

  constructor(private readonly deps: AssistantServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async turn(input: TurnInput): Promise<ReplyPlan> {
    const { repo, log } = this.deps;
    const last = input.messages[input.messages.length - 1]!;

    const earlier = await repo.findTurnByExternalId(input.channel, last.external_id);
    if (earlier?.plan && earlier.status !== "failed") {
      log.info({ userId: input.userId, turnId: earlier.id }, "assistant turn replayed");
      return earlier.plan as unknown as ReplyPlan;
    }

    const startedAt = this.now();
    const ctx = { userId: input.userId, services: this.deps.tools };
    const userRows = input.messages.map((message) => ({
      user_id: input.userId,
      channel: input.channel,
      role: "user",
      content: formatInbound(message),
      external_message_id: message.external_id,
    }));

    const turnsToday = await repo.countTurnsSince(input.userId, input.channel, new Date(startedAt.getTime() - CAP_WINDOW_MS));
    if (turnsToday >= this.deps.dailyTurnCap) {
      const plan = renderReply({ reply: CAPPED_REPLY, places: [], lists: [], mapUrl: null });
      const turn = await repo.insertTurn({ user_id: input.userId, channel: input.channel, status: "capped", plan });
      await repo.insertMessages(userRows.map((row) => ({ ...row, turn_id: turn.id })));
      log.warn({ userId: input.userId, turnsToday }, "assistant daily cap reached");
      return plan;
    }

    const [profile, savedCount, lists, recent, history] = await Promise.all([
      this.deps.identities.findProfileByUserId(input.channel, input.userId),
      this.deps.tools.placesRepo.countSavedPlaces(input.userId),
      this.deps.tools.lists.listLists(input.userId),
      recentRecognitions(ctx, RECENT_SHARES),
      repo.listRecentMessages(input.userId, input.channel, { limit: HISTORY_LIMIT, since: new Date(startedAt.getTime() - HISTORY_WINDOW_MS) }),
    ]);
    const contextBlock = buildContextBlock({ profile, savedCount, lists, recentRecognitions: recent, now: startedAt });
    const externalIds = new Set(input.messages.map((message) => message.external_id));

    try {
      const result = await runTurn({
        model: this.deps.model,
        modelId: this.deps.modelId,
        systemPrompt: this.deps.systemPrompt,
        contextBlock,
        // A retried turn may already hold this turn's user rows; they are the turn, not history.
        history: history.filter((row) => !(row.external_message_id && externalIds.has(row.external_message_id))).map(toChatMessage),
        userMessage: userRows.map((row) => row.content).join("\n"),
        tools: toolDefinitions(),
        execute: (name, args) => executeTool(ctx, name, args),
        maxSteps: this.deps.maxSteps,
        log,
      });

      const plan = await this.render(input.userId, result.reply, lists);
      const turn = await repo.insertTurn({
        user_id: input.userId,
        channel: input.channel,
        model: result.model,
        provider: result.provider,
        status: result.status,
        steps: result.steps,
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        cached_tokens: result.usage.cached_tokens,
        cost_usd: result.usage.cost_usd,
        duration_ms: this.now().getTime() - startedAt.getTime(),
        tool_names: result.toolNames,
        plan,
      });
      await repo.insertMessages([
        ...userRows.map((row) => ({ ...row, turn_id: turn.id })),
        { user_id: input.userId, channel: input.channel, role: "assistant", content: result.reply.text, rich: richNote(result.reply, plan), turn_id: turn.id },
      ]);
      log.info(
        { userId: input.userId, turnId: turn.id, status: result.status, steps: result.steps, tools: result.toolNames, cost: result.usage.cost_usd, cached: result.usage.cached_tokens },
        "assistant turn done",
      );
      return plan;
    } catch (error) {
      const turn = await repo
        .insertTurn({
          user_id: input.userId,
          channel: input.channel,
          model: this.deps.modelId,
          status: "failed",
          duration_ms: this.now().getTime() - startedAt.getTime(),
          error: errorMessage(error),
          plan: null,
        })
        .catch((recordError: unknown) => {
          log.error({ err: recordError }, "failed assistant turn not recorded");
          return null;
        });
      if (turn) await repo.insertMessages(userRows.map((row) => ({ ...row, turn_id: turn.id }))).catch(() => undefined);
      throw error;
    }
  }

  /** Resolves the reply's card ids and map link into what the channel can draw. */
  private async render(userId: string, reply: ReplyInput, listsBefore: Array<{ id: string }>): Promise<ReplyPlan> {
    const { tools, log } = this.deps;
    let places: Awaited<ReturnType<typeof toSavedPlaceDto>>[] = [];
    let lists: Awaited<ReturnType<typeof tools.lists.listLists>> = [];

    if (reply.cards?.kind === "places") {
      const byId = new Map((await tools.placesRepo.getSavedPlacesByPlaceIds(reply.cards.place_ids, userId)).map((record) => [record.place.id, toSavedPlaceDto(record)]));
      places = reply.cards.place_ids.flatMap((id) => byId.get(id) ?? []);
      if (places.length < reply.cards.place_ids.length) log.warn({ asked: reply.cards.place_ids.length, found: places.length }, "reply named places the person has not saved");
    } else if (reply.cards?.kind === "lists") {
      const ids = reply.cards.list_ids;
      // The turn may have created or renamed lists; a fresh read draws them as they are now.
      const current = ids.every((id) => listsBefore.some((list) => list.id === id)) ? await tools.lists.listLists(userId) : await tools.lists.listLists(userId);
      const byId = new Map(current.map((list) => [list.id, list]));
      lists = ids.flatMap((id) => byId.get(id) ?? []);
    }

    let mapUrl: string | null = null;
    if (reply.map_link) {
      try {
        mapUrl = (await tools.signInLinks.mint(userId)).url;
      } catch (error) {
        log.warn({ err: error, userId }, "sign-in link not minted; replying without the map button");
      }
    }

    return renderReply({ reply, places, lists, mapUrl });
  }
}

/** The message of an Error, or of a PostgREST error object, which is not an Error instance. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  return typeof error === "string" ? error : JSON.stringify(error);
}

/** A user message as the model reads it: the text, plus what was tapped when it was a tap. */
export function formatInbound(message: InboundTurnMessage): string {
  if (!message.tapped) return message.text;
  return `${message.text}\n[tapped "${message.tapped.title}" · payload ${message.tapped.payload}]`;
}

/** The non-text parts of a reply, kept so the next turn's history says what was shown. */
function richNote(reply: ReplyInput, plan: ReplyPlan): Json | null {
  const note: Record<string, Json> = {};
  const carousel = plan.messages.find((message) => message.kind === "carousel");
  if (carousel && carousel.kind === "carousel") note["cards"] = carousel.cards.map((card) => card.title);
  if (reply.quick_replies?.length) note["quick_replies"] = reply.quick_replies.map((item) => item.title);
  if (plan.messages.some((message) => message.kind === "button")) note["map_link"] = true;
  return Object.keys(note).length > 0 ? note : null;
}

function toChatMessage(row: AssistantMessageRow): ChatMessage {
  if (row.role === "user") return { role: "user", content: row.content };
  const rich = (row.rich ?? null) as null | { cards?: string[]; quick_replies?: string[]; map_link?: boolean };
  const notes: string[] = [];
  if (rich?.cards?.length) notes.push(`you sent cards: ${rich.cards.join(", ")}`);
  if (rich?.quick_replies?.length) notes.push(`with quick replies: ${rich.quick_replies.join(" · ")}`);
  if (rich?.map_link) notes.push("with the map link button");
  return { role: "assistant", content: notes.length > 0 ? `${row.content}\n[${notes.join("; ")}]` : row.content };
}
