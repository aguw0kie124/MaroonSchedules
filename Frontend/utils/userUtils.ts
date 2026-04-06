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
