/**
 * Reliable extraction of display names from Clerk user objects.
 */
export function getPremiumName(user: any): string {
  if (!user) return "Aggie";

  // 1. Try full name
  if (user.fullName && user.fullName.trim()) {
    return user.fullName.trim();
  }

  // 2. Try first and last name separately
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;

  // 3. Try username
  if (user.username && user.username.trim()) {
    return user.username.trim();
  }

  // 4. Try primary email (handle as string or Clerk EmailAddress object)
  const email = user.primaryEmailAddress?.emailAddress || user.primaryEmailAddress || "";
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }

  return "Aggie User";
}

/**
 * Reliable extraction of profile image from Clerk user objects.
 */
export function getPremiumImage(user: any): string {
  if (!user) return "";
  return user.imageUrl || user.profileImageUrl || "";
}

/**
 * Heuristic to check if a string looks like an AES-encrypted base64 payload
 * from our backend (typically length > 40 and not human-readable).
 */
export function isEncryptedString(s: string | null | undefined): boolean {
  if (!s || s.length < 40) return false;
  // If it contains spaces, it's likely human-entered
  if (s.includes(' ')) return false;
  // Common check for base64 with potential padding
  return /^[a-zA-Z0-9+/]+={0,2}$/.test(s);
}

/**
 * Shared logic to resolve a user's display name using current user context,
 * a pre-fetched user directory (map), and string heuristics.
 */
export function resolveDisplayName(
  userId: string | undefined,
  rawName: string | undefined,
  currentUser: any,
  userMap?: Map<string, string>
): string {
  if (userId && currentUser?.id && userId === currentUser.id) {
    return getPremiumName(currentUser);
  }
  if (isEncryptedString(rawName)) {
    return 'Aggie User';
  }
  if (rawName && rawName.includes("@")) {
    return rawName.split("@")[0] || "Aggie User";
  }
  return rawName || 'Aggie User';
}
