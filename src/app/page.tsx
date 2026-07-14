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
          <p className="eyebrow">Frick Park, Pittsburgh</p>
          <h1>You are a bee.</h1>
          <p className="lead">
            About a centimetre long, in a park that runs to six hundred acres.
            The grass comes up past your head, an oak is a mountain, and the Blue
            Slide is a hillside you could spend an afternoon climbing. Go and
            find out what grows here.
          </p>
          <div className="actions">
            <Button href="/play">Fly</Button>
            <Button href="/offline" variant="secondary">
              Ten-minute run
            </Button>
          </div>
        </div>

        <Image
          alt="Scout, a bee, over Frick Park"
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
        <h2>A real park</h2>
        <div className="grid">
          <Card title="The Blue Slide">
            The most recognisable thing in Frick Park, and from your height, a
            concrete mountainside.
          </Card>
          <Card title="Nine Mile Run">
            Buried under slag for most of the twentieth century, then dug back
            out in one of the largest urban stream restorations ever attempted.
          </Card>
          <Card title="Falls Ravine and Fern Hollow">
            Hemlock slopes too steep to hold soil, and shade deep enough that
            ferns become trees.
          </Card>
        </div>
      </section>
    </main>
  );
}
