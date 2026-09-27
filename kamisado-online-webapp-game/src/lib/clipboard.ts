/** Best-effort clipboard write: never throws or rejects unhandled - some
 * browsers/contexts deny clipboard permission, which should just mean the
 * "Copied!" confirmation doesn't show, not an uncaught error. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
}
