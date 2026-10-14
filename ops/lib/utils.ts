import { createCn } from "cn/config";

/**
 * Class merging that knows Discovery's scales (app/globals.css). Without them the
 * merger reads `text-display` as a colour and drops it beside `text-foreground`, and
 * cannot tell that `rounded-card` replaces `rounded-lg`.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: ["display", "title", "headline", "body", "caption", "nano"],
      radius: ["tile", "button", "field", "card", "sheet"],
    },
    classGroups: {
      shadow: [{ depth: ["card", "float", "thumb", "inset"] }, "gloss"],
      "font-family": [{ font: ["numeric"] }],
    },
  },
});
