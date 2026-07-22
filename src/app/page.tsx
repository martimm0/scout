import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { ParkForecast } from "./park-forecast";

/**
 * The landing page.
 *
 * It used to advertise the build status ("Next.js App Router", "Route
 * placeholders"), a thing nobody has ever wanted to read. It sells the game
 * now: one line, two buttons, and real frames from the game rotating through
 * the parks, the weather and the clock.
 */
export default function HomePage() {
  return (
    <main className="page-container">
      <section className="home-hero">
        <div className="page-header">
          <p className="eyebrow">Pittsburgh, Pennsylvania</p>
          <h1>You are a bee.</h1>
          <p className="lead">
            A centimetre long, loose in the real parks of Pittsburgh. Every
            plant is a real species that really grows there. Go and find out
            what.
          </p>
          <div className="actions">
            <Button href="/play">Fly</Button>
            <Button href="/offline" variant="secondary">
              Ten-minute run
            </Button>
          </div>
        </div>

        <ParkForecast />
      </section>

      <section>
        <h2>What you do</h2>
        <div className="grid">
          <Card title="Fly, and look">
            Get close and a plant introduces itself. Land, and pollinate it,
            take its quiz, or photograph it.
          </Card>
          <Card title="Pollinate, mostly">
            One flower visit in five comes to nothing. That is the arithmetic
            the whole system runs on, not you failing.
          </Card>
          <Card title="Learn why">
            Milkweed hands you pollen like luggage. Goldenrod is innocent of
            your hay fever. The journal fills as you go.
          </Card>
        </div>
      </section>

      <section>
        <h2>Three real parks</h2>
        <div className="grid">
          <Card title="Frick">
            A wood with a creek at the bottom of it. You start here.
          </Card>
          <Card title="Schenley">
            Mown lawns on top, then the ground tears open into Panther Hollow, a
            hundred feet deep.
          </Card>
          <Card title="Highland">
            A lake on top of a hill: two walled reservoirs holding the city&apos;s
            drinking water.
          </Card>
        </div>
      </section>
    </main>
  );
}
