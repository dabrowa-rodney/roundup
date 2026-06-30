// Avatar helpers — initials + a deterministic colour hashed from the name.
// Palette is shared across themes (see design tokens in the handoff README).

export const AVATAR_PALETTE = [
  "#2E6B4E",
  "#2D54EB",
  "#CC5333",
  "#7A4FB5",
  "#1F8A8A",
  "#B5762E",
  "#C0455B",
] as const;

/** Two-letter uppercase initials from a person's name. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Stable avatar background colour, hashed from the name. */
export function avatarColor(name: string): string {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}
