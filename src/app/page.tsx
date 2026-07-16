import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IMAGE_ASSETS } from "@/lib/assets";

/**
 * The landing page.
 *
 * It used to advertise the build status — "Next.js App Router", "Route
 * placeholders" — which is a thing nobody has ever wanted to read. It sells the
 * game now.
 */
export default function HomePage() {
  return (
    <main className="page-container">
      <section className="home-hero">
        <div className="page-header">
          <p className="eyebrow">Pittsburgh, Pennsylvania</p>
          <h1>You are a bee.</h1>
          <p className="lead">
            About a centimetre long, loose in the real parks of Pittsburgh. The
            grass comes up past your head, an oak is a mountain, and the Blue
            Slide is a hillside you could spend an afternoon climbing. Three
            parks, and every plant in them is a real species that really grows
            there. Go and find out what.
          </p>
          <div className="actions">
            <Button href="/play">Fly</Button>
            <Button href="/offline" variant="secondary">
              Ten-minute run
            </Button>
          </div>
        </div>

        <Image
          alt="Scout, a bee, over Pittsburgh"
          height={320}
          priority
          src={IMAGE_ASSETS.characterAndBanner}
          width={480}
        />
      </section>

      <section>
        <h2>What you do</h2>
        <div className="grid">
          <Card title="Find twenty-six native plants">
            Milkweed, wild bergamot, trout lily, cardinal flower, pickerelweed.
            Real species, in the habitats where they actually grow: spring
            ephemerals under the ravine, jewelweed down by the creek, goldenrod in
            the rough. Twelve fungi too, and you cannot pollinate any of them.
          </Card>
          <Card title="Pollinate them, mostly">
            About one flower visit in five comes to nothing. Wind, timing, or
            somebody got there first. That isn&apos;t you failing. It is the
            arithmetic the whole system runs on.
          </Card>
          <Card title="Learn why it matters">
            Goldenrod doesn&apos;t cause your hay fever. Milkweed hands you pollen
            like luggage. A trillium takes seven years to reach its first flower.
            The journal fills as you go.
          </Card>
        </div>
      </section>

      <section>
        <h2>Real parks</h2>
        <div className="grid">
          <Card title="Frick Park">
            Six hundred acres with a creek at the bottom of it. The Blue Slide,
            Nine Mile Run dug back out from under a century of slag, and hemlock
            ravines too steep to hold their own soil.
          </Card>
          <Card title="Schenley Park">
            Glass and mown lawns on top, Phipps Conservatory on the plateau, and
            then the ground opens into Panther Hollow: a hundred feet deep, with
            four bronze panthers on the bridge above it.
          </Card>
          <Card title="Highland Park">
            Water on a hilltop. Two enormous walled reservoirs, the fountain at
            Lake Carnegie, and the wooded slope falling away to the Allegheny.
          </Card>
        </div>
      </section>
    </main>
  );
}
