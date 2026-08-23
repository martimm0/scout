/**
 * Types for the sourcing script, so the suite can test the licence gate.
 *
 * The script is plain JavaScript on purpose: it is a maintenance tool run by
 * hand, not part of the app, and giving it a build step would be the tail
 * wagging the dog. But the licence gate is the one piece of it worth a test,
 * and importing an untyped module from the TypeScript suite is an error rather
 * than a warning. One declaration is cheaper than either alternative.
 */
export declare function mayUse(licence: string | null | undefined): boolean;
