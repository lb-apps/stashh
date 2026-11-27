import { afterEach, describe, expect, it, vi } from "vitest";
import { rootLogger } from "../src/lib/logger.js";
import { transcribeVideo, WhisperUnavailableError } from "../src/modules/recognitions/whisper.js";

const speech = {
  text: "İlk durak Scald Coffee",
  language: "turkish",
  segments: [
    { start: 0, end: 2.5, text: " İlk durak", no_speech_prob: 0.05 },
    { start: 2.5, end: 4, text: " Scald Coffee", no_speech_prob: 0.1 },
    { start: 4, end: 9, text: " ♪ la la la ♪", no_speech_prob: 0.9 },
  ],
};

const opts = { apiKey: "test", model: "openai/whisper-large-v3-turbo", log: rootLogger };
const audio = Buffer.from("not really audio");

function respond(...answers: Array<Response | Error>) {
  const fetchMock = vi.fn(async () => {
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transcribeVideo", () => {
  it("keeps speech segments with the model and language, and drops music", async () => {
    respond(new Response(JSON.stringify(speech), { status: 200 }));
    const transcript = await transcribeVideo(audio, opts);

    expect(transcript).toEqual({
      full_text: "İlk durak Scald Coffee",
      segments: [
        { start_s: 0, end_s: 2.5, text: "İlk durak" },
        { start_s: 2.5, end_s: 4, text: "Scald Coffee" },
      ],
      model: "openai/whisper-large-v3-turbo",
      language: "turkish",
    });
  });

  it("is null when the audio holds no speech", async () => {
    respond(new Response(JSON.stringify({ text: "", segments: [{ start: 0, end: 9, text: "♪", no_speech_prob: 0.95 }] }), { status: 200 }));
    expect(await transcribeVideo(audio, opts)).toBeNull();
  });

  it("tries once more after a dropped connection", async () => {
    const fetchMock = respond(new TypeError("fetch failed"), new Response(JSON.stringify(speech), { status: 200 }));
    const transcript = await transcribeVideo(audio, opts);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(transcript?.segments).toHaveLength(2);
  });

  it("throws, rather than reporting no speech, when Whisper stays down", async () => {
    const fetchMock = respond(new Response("busy", { status: 503 }), new Response("busy", { status: 503 }));

    await expect(transcribeVideo(audio, opts)).rejects.toBeInstanceOf(WhisperUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a request Whisper refuses", async () => {
    const fetchMock = respond(new Response("bad audio", { status: 400 }));

    await expect(transcribeVideo(audio, opts)).rejects.toThrow(/HTTP 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
