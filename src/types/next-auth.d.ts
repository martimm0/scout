import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Google's stable subject id. This is what a save file is keyed on. */
      id: string;
    } & DefaultSession["user"];
  }
}
