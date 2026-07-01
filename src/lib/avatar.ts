// Avatar helpers — initials + a deterministic colour hashed from the name.
// Palette drawn from the Wonde 3.0 brand colour set.

export const AVATAR_PALETTE = [
  "#4368FA", // blue (primary)
  "#27325E", // blazer navy
  "#E05C3F", // apricot
  "#00A5DB", // pinafore / info
  "#47AB7E", // success
  "#F99B07", // warning
  "#8C3C35", // brick
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
