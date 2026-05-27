import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  tasks: string[];
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  tasks,
}: RoutePlaceholderProps) {
  return (
    <main className="page-container">
      <section className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lead">{description}</p>
        <div className="actions">
          <Button href="/">Home</Button>
          <Button href="/play" variant="secondary">
            Play route
          </Button>
        </div>
      </section>

      <Card>
        <h2>Planned Foundation</h2>
        <ul className="status-list">
          {tasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
