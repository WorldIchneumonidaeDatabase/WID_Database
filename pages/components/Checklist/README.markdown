# Checklist — `/checklist?country=Italy`

Country checklists of Ichneumonidae, built live from WID (page: `pages/checklist.vue`;
menu: Taxa & Keys › Country checklists).

For every taxon recorded from the country:

> ***Diadromus collaris*** (Gravenhorst, 1829)
> **Distribution in Italy:** Liguria (Gravenhorst, 1829; Pagliano, 2009; Scaramozzino, 1995), Sicilia (Turrisi et al., 2007).

- **Literature records** come from asserted distributions; each region lists the works that
  report it (short citation, full reference on hover and in "References cited").
- **Page numbers**: the citations of the asserted distributions are loaded after the records
  (`/citations?citation_object_type=AssertedDistribution&citation_object_id[]=…&extend[]=source`,
  150 ids per request) and turn "Cresson, 1864" into "Cresson, 1864: 142–143"
  (from `citation_source_body`; more than two authors → "First et al."). Until they arrive,
  or if a citation has no pages, the work is shown without pages.
- **Specimens** come from collection objects, with their institutions: "Piemonte (2 specimens (MRSN))".
- **Counties**: when records have a county (e.g. the United States), a **By state / By state and
  county** switch appears. By county: "Ohio (Riley & Howard, 1890: 151): Lucas Co. (1 specimen (USNM)),
  Ottawa Co. (Cresson, 1864: 142)" — evidence right after the state is what was recorded for the
  state without a county. Downloads follow the switch.
- A record with no region shows as the country itself: "Italy (Johansson & Cederberg, 2019)".
- Synonyms are already resolved by the Darwin Core index: records entered on a synonym's OTU
  appear under the valid name.

Search (name, genus, place, author) filters on screen. Choosing a **region / state** turns the page
into the checklist of that region: only the taxa recorded there, each with only that region's
records (and its counties), the references cited there, and downloads named and titled for it
("Ichneumonidae of Alabama, United States") — `restrictToRegion` and `rowsInRegion` in `checklist.js`. Downloads always
contain the whole country: **Word (RTF)** and **Text** in the layout above, **CSV** (one row per
record and work cited, Darwin Core columns plus `citation` with pages), **References** (all works cited). File names carry the date.

## Data

One query, paginated: `/dwc_occurrences?country=<Country>&per=500&page=n`
(`basisOfRecord` `MaterialCitation` = asserted distribution, `PreservedSpecimen` = specimen;
`stateProvince` = region; `associatedReferences` = the cited works, separated by " | ").
The **Country** menu lists every country with records in WID and their number of records
(built from all `/dwc_occurrences`, a few seconds; kept in the browser's localStorage for a day
under `wid-checklist-countries`). Choosing a country reloads the page with `?country=…`, so a
checklist can be shared by its link.

## Files

| File | |
|---|---|
| `checklist.js` | pure helpers: `buildChecklist`, `filterChecklist`, `shortCitation`, `regionText`, exports (`toCSV`, `toText`, `toRTF`) |
| `checklist.test.mjs` | `node pages/components/Checklist/checklist.test.mjs` |

Region spellings are unified in `REGION_ALIASES` (e.g. "Sicily" → "Sicilia").

## Completeness depends on the data

A species appears only if it has an asserted distribution or a specimen in that country.
A region appears only if the asserted distribution is entered on the region (not just on the
country) or the specimen's collecting event has the region.

## Map (`ChecklistMap.vue`, `mapData.js`)

Above the list, a map of the country:

- **Places coloured by number of taxa** (5 classes, one hue; grey = no record). With
  **By state and county** (United States) the counties are coloured instead and the states
  outlined. Hover for the numbers; **click a place** to get its checklist (same as the
  Region / State menu; click again to go back to the whole country).
- **One county** (county view, United States): choose a state, then a county in the **County**
  menu, or click a county on the map (click again to go back to the state). The list, the
  references and the downloads become those of that county ("Ichneumonidae of Lucas Co., Ohio,
  United States"); `restrictToRegion(cl, region, county)`, `rowsInRegion(…, county)`, `countiesIn`.
- **Colours**: a palette (Blue, Green, Orange, Red, Purple, Grey for print, Viridis —
  colour-blind safe) or **Custom…** (one colour → 5 steps from `rampFromColor`), and the colour of
  the specimen points. Remembered in the browser (`wid-checklist-map-colors`) and used by the
  SVG / PNG downloads.
- **One taxon**: the **Map** button next to each name shows only where that taxon is
  recorded; "Show all taxa" goes back.
- **Specimens with coordinates** as orange points (checkbox to hide them).
- **Downloads**: **SVG** (vector, with title, legend and source — for papers), **PNG** (3×),
  **GeoJSON** (specimen points + the places with their number of taxa, for QGIS),
  **KML** (specimen points, for Google Earth). They follow what is on screen (country or place,
  all taxa or one, regions or counties).

Places named in WID but not found in the boundaries are listed under the map
("Not on the map: …") — add their spelling to `EXTRA` in `mapData.js`.

### Boundary files — `public/checklist-maps/`

Static, loaded only for the country shown:

| File | |
|---|---|
| `index.json` | country name (normalised) → file, e.g. `unitedstates` → `USA` |
| `<ISO3>.json` | `{ admin1: [features], regions: [features] \| null }` — Natural Earth 10m admin-1 (public domain), simplified with mapshaper; `regions` = admin-1 dissolved by their `region` (e.g. Italian provinces → the 20 regions). Each feature has `name` and `keys` (normalised name variants). The map uses whichever level matches more of the WID place names. |
| `USA-counties.json` | US counties (us-atlas, US Census; `name`, `state`) |

To rebuild: download `ne_10m_admin_1_states_provinces.geojson` (Natural Earth), split by
`adm0_a3`, `mapshaper -simplify 3–12% keep-shapes` (and `-dissolve region`), keep
`name` + `keys`; counties from `us-atlas/counties-10m.json` with `topojson-client`.

Tests: `node pages/components/Checklist/mapData.test.mjs`.

## Gazetteers (custom areas, e.g. "North Italy" sensu Scaramozzino 1995)

Asserted distributions on a **gazetteer** (TaxonWorks → Gazetteer task) have no country or region
in the Darwin Core index, only the gazetteer's name as `locality` — so `/dwc_occurrences?country=Italy`
misses them. `GAZETTEER_PLACES` in `checklist.js` lists, per country, each gazetteer's exact name
and the label to show; the page also loads `/dwc_occurrences?locality=<name>` for each and adds those
records to the country with that label as region:

> *Allophroides boops* (Gravenhorst, 1829) — Distribution in Italy: North Italy (Scaramozzino, 1995: 36).

When you create a new gazetteer, add an entry there (the name must match TaxonWorks exactly),
with its `source` and `members` (the regions it includes). The definition is shown:
in the Region menu ("North Italy (sensu Scaramozzino, 1995)"), in a note under the filters
("North Italy (sensu Scaramozzino, 1995): Friuli-Venezia Giulia, Veneto, …" — only the chosen
area, or all areas used in the checklist), on hover over the name in the list, and as "Areas:"
at the top of the Word / Text downloads (`areaNote`, `areaNotes`).
These areas are not drawn on the map (listed under "Not on the map").


### Literature areas in the filter and the inset map

- Choosing **North Italy** (or South Italy) in the Region menu lists every taxon recorded from
  the area **or from any of its regions** (`regionsOf` → `restrictToRegion` / `rowsInRegion`);
  the matching places are highlighted in each line. Downloads follow.
- **Inset map** (`AreaInset.vue`, next to the filters, only for countries with areas): the areas
  of `insetAreas()` — the gazetteers of `GAZETTEER_PLACES` plus `INSET_EXTRA` (Sicily, Sardinia) —
  each in a light colour with its name. Hover an area (or choose it in the filter) to highlight it
  and read its definition underneath; click it to filter.

## Insights (`ChecklistInsights.vue`, `insights.js`)

A tabbed panel under the map, computed from the same rows and citations as the list
(and restricted to the selected region / county):

- **Subfamilies** — species per subfamily; click a bar to jump to that subfamily in the list.
- **Species × region** — one row per species, one column per region (grouped North Italy /
  South Italy / Sicily / Sardinia for Italy). ○ literature · ● specimens · ◉ both; hatched cells
  = recorded only for a wider literature area (e.g. "North Italy"). Downloadable as CSV.
- **Discovery curve** — cumulative species by year of first record (publication year or
  collecting year).
- **Literature** — records per decade of publication, and the works contributing most records.
- **Literature vs specimens** — per region, species known only from literature, from both,
  or only from specimens.

Colours: literature #2a78d6, both #1baf7a, specimens #eb6834.

### Data gaps on the map

The map's **Colour by** select (state level, not in county view) switches between number of
taxa, number of works citing records, and year of the latest record (literature or specimen),
so poorly studied regions stand out.

### Region dropdown

Gazetteer literature areas (e.g. North / South Italy, labelled "sensu source") are listed in
their own group, "Areas of the literature", separated from the ordinary regions.
