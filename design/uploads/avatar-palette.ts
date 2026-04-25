/**
 * Deterministic avatar color palette.
 *
 * Used to assign a consistent bg/text color pair to user avatars
 * based on their ID. Shared across referral screens and widgets.
 */

export const AVATAR_PALETTE = [
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#E0E7FF', text: '#4338CA' },
  { bg: '#D1FAE5', text: '#064D31' },
  { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#FEF9C3', text: '#854D0E' },
] as const;

export type AvatarColor = (typeof AVATAR_PALETTE)[number];

export function pickAvatarColor(id: string): AvatarColor {
  const code = id.charCodeAt(0) ?? 0;
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}
