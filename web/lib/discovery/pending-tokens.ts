/**
 * Values the generated tokens do not carry yet. Each names the token it stands
 * in for; when that token lands in `tokens/*.css`, switch the callers to
 * `var(--…)` and delete the entry. Nothing here is a new colour: each one is
 * derived from existing tokens, or moved here from a component that inlined it.
 */

/** `--text-secondary-strong`: secondary text that clears 4.5:1 on white, grey-100
 * and grey-200 (≈ #6C6A65). `--text-secondary` (grey-600) is 3.4:1 on white. */
export const TEXT_SECONDARY_STRONG = 'color-mix(in srgb, var(--grey-600), var(--grey-800))';

/** `--text-danger-strong`: destructive text that clears 4.5:1 on white, the grey
 * fills inside a white sheet and the bone dialog buttons (≈ #A9302A).
 * `--text-danger` (red-500) is ~3:1 there. */
export const TEXT_DANGER_STRONG = 'color-mix(in srgb, var(--red-500) 65%, var(--ink))';

/** `--text-open-strong`: OPEN ink that clears 4.5:1 on the open sign face
 * (≈ #0E693F). `--text-open` (green-600) is ~2:1 there. */
export const TEXT_OPEN_STRONG = 'color-mix(in srgb, var(--text-open) 55%, var(--ink))';

/** `--sign-face-open` / `--sign-face-closed`: the candy face of the open/closed
 * sign, shared by `OpenSign` and `OpenChip`. */
export const SIGN_FACE = {
  open: 'linear-gradient(168deg, #E8FFE9 0%, #BEF3C8 52%, #9FE7B0 100%)',
  closed: 'linear-gradient(168deg, #F2F0EC 0%, #E4E0D9 52%, #D6D1C8 100%)',
} as const;

/** `--fs-title-3` / `--lh-title-3`: the home section title, between headline (20) and title-2 (24). */
export const TITLE_3 = { fontSize: '22px', lineHeight: '26px' } as const;
