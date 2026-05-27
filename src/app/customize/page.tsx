import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata = {
  title: "Customize",
};

export default function CustomizePage() {
  return (
    <RoutePlaceholder
      eyebrow="Milestone 6 target"
      title="Pollinator Customization"
      description="Signed-in players will customize their starter pollinator and save it to their profile."
      tasks={[
        "Name the pollinator",
        "Pick body and wing colors",
        "Preview the selected style",
      ]}
    />
  );
}
