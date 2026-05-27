import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata = {
  title: "Journal",
};

export default function JournalPage() {
  return (
    <RoutePlaceholder
      eyebrow="Milestone 11 target"
      title="Pollinator Journal"
      description="The journal will collect unlocked plant, pollinator, map area, and ecology concept entries."
      tasks={[
        "Display locked and unlocked entries",
        "Support journal tabs",
        "Reflect discovery progress",
      ]}
    />
  );
}
