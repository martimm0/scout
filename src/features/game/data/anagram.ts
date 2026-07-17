/**
 * The anagram game's rules, in one place.
 *
 * Shared by the generator script and the game itself, so the threshold that
 * decides "this name cannot support the game" is the same number in both. Split
 * out from `anagram-words.ts` because that file is generated and this one is not.
 */

/** Shorter than this and it is not a word, it is a fragment. */
export const ANAGRAM_MIN_LENGTH = 4;

/** Words you must find to score 1.0. */
export const ANAGRAM_TARGET = 3;

/**
 * A name needs at least this many makeable words to be worth playing.
 *
 * The target plus margin. A name that can make exactly three words means there is
 * one solution and you either see it or you do not, which is a quiz with no
 * partial credit rather than a game.
 */
export const ANAGRAM_MIN_WORDS = 8;
