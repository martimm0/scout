/**
 * `popular-english-words` ships no types. Only the build-time anagram generator
 * uses it, and only this one method, so the declaration is exactly that method.
 */
declare module "popular-english-words" {
  export const words: {
    getMostPopular(count: number): string[];
    getAll(): string[];
  };
}
