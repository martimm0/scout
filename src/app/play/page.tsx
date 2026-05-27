import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata = {
  title: "Play",
};

export default function PlayPage() {
  return (
    <RoutePlaceholder
      eyebrow="Milestone 2 target"
      title="Saved Game"
      description="The signed-in Frick Park game scene will live here once the 3D canvas, camera, and pollinator foundation are built."
      tasks={[
        "Load player progress",
        "Render React Three Fiber scene",
        "Follow the selected pollinator",
      ]}
    />
  );
}
