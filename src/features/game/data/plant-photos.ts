// Photo credits for the native plants in the game.
// Sourced from Wikimedia Commons; every image is Public Domain, CC0, CC BY, or CC BY-SA.
// Human-readable attribution table: public/images/plants/CREDITS.md
// Generated from the Wikimedia Commons API - edit with care.

import { FUNGUS_PHOTOS } from "./fungus-photos";
import { PARTY_PHOTOS } from "./party-photos";
import { HIGHLAND_PHOTOS } from "./highland-photos";
import { SCHENLEY_PHOTOS } from "./schenley-photos";

export type PlantPhoto = {
  src: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
};

export const PLANT_PHOTOS: Record<string, PlantPhoto> = {
  "common-milkweed": {
    src: "/images/plants/common-milkweed.jpg",
    title: "Asclepias syriaca - 2024-06-22.jpg",
    author: "Jeangagnon",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Asclepias_syriaca_-_2024-06-22.jpg",
  },
  "wild-bergamot": {
    src: "/images/plants/wild-bergamot.jpg",
    title: "Scioto Audubon - Monarda fistulosa 1.jpg",
    author: "Sixflashphoto",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Scioto_Audubon_-_Monarda_fistulosa_1.jpg",
  },
  "purple-coneflower": {
    src: "/images/plants/purple-coneflower.jpg",
    title: "Echinacea purpurea, Jardín Botánico, Múnich, Alemania, 2013-09-08, DD 01.jpg",
    author: "Diego Delso",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Echinacea_purpurea,_Jard%C3%ADn_Bot%C3%A1nico,_M%C3%BAnich,_Alemania,_2013-09-08,_DD_01.jpg",
  },
  "canada-goldenrod": {
    src: "/images/plants/canada-goldenrod.jpg",
    title: "Solidago canadensis 20050815 248.jpg",
    author: "Georg Slickers",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Solidago_canadensis_20050815_248.jpg",
  },
  "new-england-aster": {
    src: "/images/plants/new-england-aster.jpg",
    title: "Symphyotrichum novae-angliae3.jpg",
    author: "The Cosmonaut",
    license: "CC BY-SA 2.5 ca",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/ca/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Symphyotrichum_novae-angliae3.jpg",
  },
  "black-eyed-susan": {
    src: "/images/plants/black-eyed-susan.jpg",
    title: "Rudbeckia hirta kz02.jpg",
    author: "Krzysztof Ziarnek, Kenraiz",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rudbeckia_hirta_kz02.jpg",
  },
  "virginia-bluebell": {
    src: "/images/plants/virginia-bluebell.jpg",
    title: "Mertensia virginica.bbg.jpg",
    author: "Khan \"Sadh\" N. Mostafa",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Mertensia_virginica.bbg.jpg",
  },
  "joe-pye-weed": {
    src: "/images/plants/joe-pye-weed.jpg",
    title: "Eutrochium purpureum kz02.jpg",
    author: "Krzysztof Ziarnek, Kenraiz",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Eutrochium_purpureum_kz02.jpg",
  },
  "jewelweed": {
    src: "/images/plants/jewelweed.jpg",
    title: "Impatiens capensis RF.jpg",
    author: "Robert Flogaus-Faust",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Impatiens_capensis_RF.jpg",
  },
  "cardinal-flower": {
    src: "/images/plants/cardinal-flower.jpg",
    title: "Lobelia cardinalis - Cardinal Flower.jpg",
    author: "Barnes, Dr. Thomas G.",
    license: "Public domain",
    licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Lobelia_cardinalis_-_Cardinal_Flower.jpg",
  },
  "mayapple": {
    src: "/images/plants/mayapple.jpg",
    title: "Podophyllum peltatum flower.jpg",
    author: "Willthomas",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Podophyllum_peltatum_flower.jpg",
  },
  "trout-lily": {
    src: "/images/plants/trout-lily.jpg",
    title: "Erythronium americanum - lateral.jpg",
    author: "The Cosmonaut",
    license: "CC BY-SA 2.5 ca",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/ca/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Erythronium_americanum_-_lateral.jpg",
  },
  "wild-geranium": {
    src: "/images/plants/wild-geranium.jpg",
    title: "Geranium maculatum Leatherwood Lake.jpg",
    author: "Eric in SF",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Geranium_maculatum_Leatherwood_Lake.jpg",
  },
  "white-trillium": {
    src: "/images/plants/white-trillium.jpg",
    title: "Trillium grandiflorum at Backus Woods.jpg",
    author: "СССР",
    license: "CC BY-SA 2.5 ca",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/ca/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Trillium_grandiflorum_at_Backus_Woods.jpg",
  },
  "spicebush": {
    src: "/images/plants/spicebush.jpg",
    title: "Lindera benzoin kz01.jpg",
    author: "Krzysztof Ziarnek, Kenraiz",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Lindera_benzoin_kz01.jpg",
  },
  "eastern-redbud": {
    src: "/images/plants/eastern-redbud.jpg",
    title: "Cercis canadensis, 2021-04-24, Fox Chapel, 01.jpg",
    author: "Cbaile19",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Cercis_canadensis,_2021-04-24,_Fox_Chapel,_01.jpg",
  },

  /**
   * The night shift.
   *
   * Sourced with `scripts/source-photo.mjs`, which is in the repository now
   * rather than being a thing somebody once ran: it asks the Commons API for
   * the credit, refuses any licence this project may not use, and writes the
   * file at the width the rest of the set is.
   */
  "evening-primrose": {
    src: "/images/plants/evening-primrose.jpg",
    title: "Oenothera biennis, Vic-la-Gardiole 01.jpg",
    author: "Christian Ferrer",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Oenothera_biennis,_Vic-la-Gardiole_01.jpg",
  },
  jimsonweed: {
    src: "/images/plants/jimsonweed.jpg",
    title: "Datura stramonium 2 (2005 07 07).jpg",
    author: "Taka",
    license: "CC BY-SA 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Datura_stramonium_2_(2005_07_07).jpg",
  },
  "night-flowering-catchfly": {
    src: "/images/plants/night-flowering-catchfly.jpg",
    title: "Silene noctiflora kz01.jpg",
    author: "Krzysztof Ziarnek, Kenraiz",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Silene_noctiflora_kz01.jpg",
  },
};

/**
 * The photograph for any species, from either park.
 *
 * One place to ask, so no component has to know that Schenley's images live in a
 * different folder. A shared species (goldenrod, spicebush) resolves to the
 * original Frick photograph, which is correct: it is the same organism.
 */
export function photoFor(id: string): PlantPhoto | undefined {
  return (
    PLANT_PHOTOS[id] ??
    FUNGUS_PHOTOS[id] ??
    PARTY_PHOTOS[id] ??
    SCHENLEY_PHOTOS[id] ??
    HIGHLAND_PHOTOS[id]
  );
}
