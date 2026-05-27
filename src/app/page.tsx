import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IMAGE_ASSETS } from "@/lib/assets";

const foundationItems = [
  "Next.js App Router",
  "TypeScript",
  "Shared app shell",
  "Reusable UI primitives",
  "Route placeholders",
  "Environment scaffold",
];

export default function HomePage() {
  return (
    <main className="page-container">
      <section className="home-hero">
        <div className="page-header">
          <p className="eyebrow">Frick Park MVP</p>
          <h1>Scout</h1>
          <p className="lead">
            A desktop-first pollinator RPG where players explore a simplified
            Frick Park, discover native plants, pollinate flowers, and build a
            journal of local ecology.
          </p>
          <div className="actions">
            <Button href="/play">Enter saved mode</Button>
            <Button href="/offline" variant="secondary">
              Start offline run
            </Button>
          </div>
        </div>

        <Image
          alt="Scout pollinator character with the Scout banner"
          className="home-hero__image"
          height={440}
          priority
          src={IMAGE_ASSETS.characterAndBanner}
          width={440}
        />
      </section>

      <section className="grid" aria-label="Foundation status">
        {foundationItems.map((item) => (
          <Card key={item}>
            <h2>{item}</h2>
            <p>Foundation checkpoint ready for the next game milestone.</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
