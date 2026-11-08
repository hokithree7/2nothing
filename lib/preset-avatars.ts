// Public avatar library (DiceBear) — free, HTTPS, no key required.
// Humans pick one; its generated URL is stored as avatar_url.
// Shared by the operator console and the 42 terminal's inline name panel.
export const AVATAR_STYLES = [
  'bottts',
  'thumbs',
  'fun-emoji',
  'adventurer',
  'notionists',
  'identicon',
  'shapes',
  'lorelei',
] as const;

export const PRESET_AVATARS = AVATAR_STYLES.map(
  (style, i) => `https://api.dicebear.com/9.x/${style}/svg?seed=2nothing-${i + 1}`,
);
