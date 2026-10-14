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
      "micro-label": ["micro-label"],
    },
    // `micro-label` sets its own size, weight, tracking, case and colour: it must replace a
    // component's default text classes (e.g. ItemDescription's text-caption), not lose to them.
    conflictingClassGroups: {
      "micro-label": ["font-size", "font-weight", "leading", "tracking", "text-color", "text-transform"],
    },
  },
});
