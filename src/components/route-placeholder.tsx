import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IMAGE_ASSETS } from "@/lib/assets";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  imageAlt?: string;
  imageSrc?: string;
  tasks: string[];
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  imageAlt = "Scout placeholder image",
  imageSrc = IMAGE_ASSETS.placeholder,
  tasks,
}: RoutePlaceholderProps) {
  return (
    <main className="page-container">
      <section className="placeholder-hero">
        <div className="page-header">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lead">{description}</p>
          <div className="actions">
            <Button href="/">Home</Button>
            <Button href="/play" variant="secondary">
              Play route
            </Button>
          </div>
        </div>

        <Image
          alt={imageAlt}
          className="placeholder-hero__image"
          height={320}
          src={imageSrc}
          width={360}
        />
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
