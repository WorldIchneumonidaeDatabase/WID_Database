# PanelGBIF (`panel:gbif`)

Overview tab. The taxon on [GBIF](https://www.gbif.org) and its occurrence records.

- The name, linked to its GBIF page. If GBIF treats the name as a **synonym**, an amber pill and
  a line "GBIF treats this name as a synonym of …" (linked) say so.
- Three numbers: **records**, **specimens** (preserved specimens and material samples) and
  **countries**, each linked to the GBIF occurrence search.
- One bar and key with the **kinds of records** (preserved specimens, material samples,
  observations, …).
- **Most records from**: the four countries with most records, each linked.
- Records **with images** and **type specimens**, when there are any.
- Links to the **GBIF tab** of the page (images, map, types) and to GBIF.

Data: `species/match` (Animalia; a match only at a higher rank is no match, and the card is
hidden), then `occurrence/search?taxonKey=…&limit=0` with facets `basisOfRecord`, `country`,
`typeStatus` ("NotAType" ignored) and `mediaType=StillImage`. Numbers and country names follow
the site language (`locale` in `src/i18n`); texts are translated by the site translator.
