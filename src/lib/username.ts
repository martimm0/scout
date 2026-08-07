/**
 * What a username may be.
 *
 * One definition, imported by the form, the API route and the admin tool. The
 * form's job is to tell you before you press the button; the route's job is to
 * refuse regardless of what the form did. Two copies of these rules would
 * eventually disagree, and the one that mattered would be the one nobody was
 * looking at.
 */

export const USERNAME_MAX = 24;
export const USERNAME_MIN = 2;

export type UsernameProblem =
  | "empty"
  | "too-short"
  | "too-long"
  | "has-spaces"
  | "bad-characters"
  | "taken";

/**
 * Why this is not a username, or null if it is one.
 *
 * Deliberately NOT a boolean. A form that can only say "no" makes the player
 * guess which rule they broke, and the rule they broke is usually the one about
 * spaces, which is invisible at the end of a word.
 *
 * "taken" is not decided here. It needs the database, and this module is pure
 * so that both sides can run it.
 */
export function usernameProblem(raw: string): UsernameProblem | null {
  if (raw.length === 0) {
    return "empty";
  }

  // Checked before length, so "a b" is told about the space rather than being
  // told it is too short after the space is stripped.
  if (/\s/.test(raw)) {
    return "has-spaces";
  }

  if (raw.length < USERNAME_MIN) {
    return "too-short";
  }

  if (raw.length > USERNAME_MAX) {
    return "too-long";
  }

  /**
   * Letters, digits, and a few joining marks.
   *
   * Unicode letters rather than A-Z: a name in Cyrillic or with an accent is a
   * name, and refusing it would be refusing people rather than refusing input.
   * What is excluded is punctuation that reads as something else in a chat line
   * (`@`, `#`, `/`) and anything that could be mistaken for markup.
   */
  if (!/^[\p{L}\p{N}_.-]+$/u.test(raw)) {
    return "bad-characters";
  }

  return null;
}

/** Said in words, for a person reading a form. */
export function usernameProblemSays(problem: UsernameProblem): string {
  switch (problem) {
    case "empty":
      return "Pick something to be called.";
    case "too-short":
      return `At least ${USERNAME_MIN} characters.`;
    case "too-long":
      return `No more than ${USERNAME_MAX} characters.`;
    case "has-spaces":
      return "No spaces. Try a dash or an underscore instead.";
    case "bad-characters":
      return "Letters, numbers, dots, dashes and underscores only.";
    case "taken":
      return "Somebody already has that one. Try another.";
  }
}

/**
 * The form the database compares on.
 *
 * Uniqueness is case-insensitive: "Bee" and "bee" are the same person as far as
 * telling two players apart is concerned, and allowing both would make the
 * distinction a trap rather than a feature. The ORIGINAL case is what gets
 * stored and shown, because how you write your own name is yours.
 */
export function usernameKey(raw: string): string {
  return raw.trim().toLowerCase();
}
