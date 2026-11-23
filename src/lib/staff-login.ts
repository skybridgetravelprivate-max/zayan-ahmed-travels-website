export function staffLoginValidationMessage(identifier: string, password: string): string | null {
  if (!identifier.trim() || !password) return "Enter your email or username and password.";
  if (identifier.trim().length > 254) return "Use an email or username of no more than 254 characters.";
  if (new TextEncoder().encode(password).length > 72) {
    return "Your password exceeds the 72 UTF-8 byte limit. Check the entered password; some characters use more than one byte.";
  }
  return null;
}

export function staffLoginFailureMessage(status: number): string {
  if (status === 400) return "Check your sign-in fields. Email or username must be no more than 254 characters and password no more than 72 UTF-8 bytes.";
  if (status === 401) return "Sign-in failed. Check your credentials and choose the portal for your assigned role, or try later if your account is locked.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  return "Staff sign-in is temporarily unavailable. Try again later.";
}
