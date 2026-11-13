import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModelGallery } from "@/features/game/components/model-gallery";
import { MODEL_SETS, type ModelSet } from "@/features/game/models/catalog";
import { parseQuality } from "@/features/game/models/quality";

export const metadata: Metadata = { title: "Models", robots: { index: false } };

/**
 * Every model in the park, side by side. Development only: in production this
 * address does not exist.
 *
 * `?set=plants|fungi|foliage|pollinators` and `?quality=high|low`. For a closer look,
 * `?only=id,id`, `?cols=3` and `?turn=` (radians).
 */
export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const requested = String(params.set ?? "plants");
  const set =
    requested === "pollinators"
      ? "pollinators"
      : (MODEL_SETS as readonly string[]).includes(requested)
        ? (requested as ModelSet)
        : "plants";
  const quality = parseQuality(String(params.quality ?? "")) ?? "high";

  const only = params.only ? String(params.only).split(",") : undefined;
  const columns = Math.min(8, Math.max(1, Number(params.cols) || 6));
  const turn = Number.isFinite(Number(params.turn)) && params.turn !== undefined ? Number(params.turn) : 0.7;

  return (
    <div style={{ paddingTop: 90 }}>
      <ModelGallery columns={columns} only={only} quality={quality} set={set} turn={turn} />
    </div>
  );
}
