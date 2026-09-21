const KEY = "reserivo:current-salon";

/**
 * Which salon this browser was last working in, so signing in returns you to
 * the schedule you were looking at. A convenience only — every read is
 * validated against the salons the API says you belong to, and storage can be
 * unavailable (private windows, blocked site data), so it always fails soft.
 */
export function readCurrentSalon(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeCurrentSalon(salonId: string): void {
  try {
    window.localStorage.setItem(KEY, salonId);
  } catch {
    // Nothing to do: the fallback is simply the first salon in the list.
  }
}
