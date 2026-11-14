// Where to send someone after signing in (?next=…), when it's safe: a path
// on this site. Anything else (another site, "//evil.example", "/\\evil")
// could send them away after they trusted our sign-in page.
export const safeNextPath = (value: string | null | undefined) => {
  if (!value || value.length > 512) {
    return null;
  }
  const isPath = value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
  // No control characters (a tab or newline can turn into "//" in a browser).
  // biome-ignore lint/suspicious/noControlCharactersInRegex: that's what it checks for
  return isPath && !/[\u0000-\u001f\\]/.test(value) ? value : null;
};
