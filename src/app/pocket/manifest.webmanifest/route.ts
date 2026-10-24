import gameManifest from "../../manifest";

/**
 * Pocket's own manifest, so installing Pocket installs Pocket.
 *
 * Pocket is the part of Scout meant to live on a phone's home screen, and the
 * site had one manifest, starting at /play. Adding Pocket to the home screen and
 * opening it launched the whole 3D park, on a phone, instead of the page that
 * had been installed. Everything else is the game's, so the two cannot drift
 * on icons or colours.
 */
export function GET() {
  return Response.json(
    {
      ...gameManifest(),
      id: "/pocket",
      name: "Scout Pocket",
      short_name: "Pocket",
      start_url: "/pocket",
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
