import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
      <section className="page-header">
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
