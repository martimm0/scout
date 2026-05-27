import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="page-container">
      <Card>
        <p className="eyebrow">Lost trail</p>
        <h1>Page not found</h1>
        <p>The route you requested is not part of the Scout MVP map yet.</p>
        <Button href="/">Return home</Button>
      </Card>
    </main>
  );
}
