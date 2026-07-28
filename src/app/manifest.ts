import type { MetadataRoute } from "next";

/**
 * The web app manifest, and it exists for one specific reason.
 *
 * iPhone Safari has never supported the Fullscreen API on anything but a
 * `<video>`, so the fullscreen button in the touch pad has nothing to call there.
 * Add to Home Screen is the way round it: launched from the home screen with
 * `display: "standalone"`, iOS drops Safari's chrome entirely and Scout gets the
 * whole phone, which is what a landscape game wants.
 *
 * Android gets the same thing, plus a genuine install prompt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scout: a pollinator RPG",
    short_name: "Scout",
    description:
      "You are a bee, a centimetre long, in the real parks of Pittsburgh. Every plant is a real species that really grows there.",
    start_url: "/play",
    display: "standalone",
    /**
     * Deliberately NOT `orientation: "landscape"`.
     *
     * Landscape is the right way to play on a phone, and the rotate card asks for
     * it there. But a manifest lock applies to every installed surface, and a
     * tablet held upright is a perfectly good way to play. Locking would have
     * taken that away to solve a problem tablets do not have.
     */
    background_color: "#10140d",
    theme_color: "#3c7d4a",
    categories: ["games", "education"],
    /**
     * The existing mark, which is a vector, so it is sharp at any size Android
     * asks for. NOTE for iOS: Safari will not use an SVG for a home screen icon,
     * and falls back to a screenshot of the page. A rasterised PNG at 180 and 512
     * is still wanted before this is shown to anybody on an iPhone.
     */
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
