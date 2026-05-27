import { LoadingState } from "@/components/ui/loading-state";

export default function Loading() {
  return (
    <main className="page-container">
      <LoadingState label="Loading Scout..." />
    </main>
  );
}
