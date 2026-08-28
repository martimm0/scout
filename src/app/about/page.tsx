import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "About · Scout",
  description:
    "What Scout is, how to play it, and who it was made for.",
};

export default function AboutPage() {
  return (
    <main className="page-container">
      <p className="eyebrow">About</p>
      <h1>A game about being very small</h1>
      <p className="lead">
        Scout is a pollinator RPG set in the real parks of Pittsburgh. You are a
        bee, about a centimetre long, in six hundred acres of Frick Park, and then
        in Schenley, and then in Highland. The grass comes up past your head, an
        oak is a mountain, and the Blue Slide is a hillside you could spend an
        afternoon climbing. Everything that grows here is a real species that
        really grows there.
      </p>

      <section>
        <h2>What you actually do</h2>
        <p>
          You fly, and you look. Native plants and fungi are scattered across
          three Pittsburgh parks, in the habitats where they genuinely occur:
          spring ephemerals under the ravine, jewelweed down by the creek,
          goldenrod out in the rough. Get close enough to one and it introduces
          itself. Land on it and you can pollinate it, or let it test you on what
          you just read.
        </p>
        <p>
          About one flower visit in five comes to nothing. Wind, timing, or
          somebody got there first. That is not you failing, it is the arithmetic
          the whole system runs on, and a honeybee visits thousands of flowers a
          day precisely because so many of them do not take.
        </p>
        <p>
          The park also keeps <strong>Pittsburgh&apos;s weather</strong>. Not a
          simulation and not a random roll: it pulls the real observation for the
          park&apos;s own coordinates, so if it is raining in Squirrel Hill it is
          raining in the game, and the rain is coming in at the angle the wind is
          actually blowing. An overcast day is genuinely dimmer and harder to find
          a flower in. In fog you cannot see the far bank of the creek, and you
          have to fly low and follow the trails, because you cannot navigate by
          landmarks you cannot see.
        </p>
        <p>
          The park keeps <strong>Pittsburgh time</strong>, whatever time it is
          where you are. If it is dusk in Squirrel Hill it is dusk in the game.
          What you can find changes with the hour: the spring ephemerals shut by
          mid-afternoon, most of what flowers is closed after dark, and the fungi
          keep their own hours. Come back at night and it is a different park
          rather than an empty one. Three flowers open as the light goes, one in
          each park, and they are built for moths: pale, because colour is
          useless by starlight, and scented only after dark. The evening primrose
          opens over about a minute, while you watch. The jack-o&apos;-lantern is
          out, and it is glowing.
        </p>
      </section>

      <section>
        <h2>How to play</h2>
        <div className="grid">
          <Card title="Fly">
            <p>
              Move the mouse to look, and the bee turns to follow. What you are
              looking at is forward. Up and Down fly, Left and Right turn, E and Q
              change altitude, Shift boosts. Trees and buildings are solid, so
              mind the oaks.
            </p>
          </Card>
          <Card title="Land">
            <p>
              Space sets you down on whatever you are next to. From there you can
              pollinate it, take its three-question quiz, read the full entry with
              a real photograph, or take off again. Nothing pollinates a mushroom,
              but a mushroom will still test you.
            </p>
            <p>
              A few flowers in every park will not let you pollinate them until
              you have passed their quiz. They are the difficult ones: the
              milkweed that clips its pollen onto your foot, the Dutchman&apos;s
              breeches that only a bumblebee queen can force open. Real bees have
              to learn those. So do you.
            </p>
          </Card>
          <Card title="Keep a record">
            <p>
              Everything you find goes in the journal: the plants, the fungi, the
              places, the ecology, the badges. Press P at any moment and the
              photograph you take is kept there too.
            </p>
          </Card>
          <Card title="Earn the second park">
            <p>
              Find eight of Frick&apos;s flowers and Schenley Park opens: Phipps
              in glass on the plateau, and the ground falling a hundred feet into
              Panther Hollow. Keep going and Highland Park opens too: two walled
              reservoirs on a hilltop and a wooded slope down to the Allegheny.
              Each park has its own flora, and ten species grow in more than one,
              because goldenrod is goldenrod wherever you meet it.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2>Where this is going</h2>
        <p>
          The intent is for Scout to grow into an <strong>MMORPG</strong>: large,
          immersive maps to pollinate together, with other players working the
          same meadow at the same hour of the same day. A single bee in a single
          park is one afternoon. A thousand bees over a whole city, in real time,
          in real weather, is a thing worth building. The three parks here are the
          first three, and Pittsburgh has plenty more.
        </p>
      </section>

      <section>
        <h2>Why</h2>
        <p>
          It is meant to be a fun way to nerd out about plants when it is raining
          outside. That is the whole brief. You cannot go to the park today, so go
          to the park.
        </p>
        <p>
          Everything in it is real and checked: the species, the habitats, the
          bloom windows, the fact that goldenrod does not cause your hay fever and
          that milkweed hands you your pollen in luggage. If you come away knowing
          one more plant by name than you did, it has worked.
        </p>
      </section>

      <section>
        <h2>For Dawn</h2>
        <p className="lead">
          This game was made with love, as a birthday present to{" "}
          <strong>Dawn</strong>.
        </p>
        <p>
          Happy birthday. Go and find the trout lily. It is only open in the
          morning, and a patch of them can be older than the trees above it.
        </p>
      </section>

      <div className="actions">
        <Button href="/play">Fly</Button>
        <Button href="/offline" variant="secondary">
          Ten-minute run
        </Button>
      </div>
    </main>
  );
}
