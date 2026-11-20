# PanelCatalogueOfLife (`panel:catalogue-of-life`)

Overview tab, genus and species pages. How the **Catalogue of Life** (COL, latest release,
dataset `3LR` on ChecklistBank) treats the name of the page, compared with WID.

- A pill **agrees with WID** / **differs from WID** and the COL treatment: accepted as, or synonym
  of. When they differ, a box lists what differs: status, valid name or authorship (a subgenus
  written by COL, e.g. *Ichneumon (Ichneumon) …*, does not count).
- COL's classification (subfamily › tribe › genus), its source dataset (for Ichneumonidae
  usually Taxapad Ichneumonoidea) and a link to the record on catalogueoflife.org.
- Species: the **synonyms** compared: only in COL, only in WID, and "same name, different year".
  Synonyms are matched on the epithet without its gender ending plus the year, so different
  combinations of the same name count once (*olitoria* = *olitorius*).
- If COL lacks the name, the original combination is tried ("Found in COL under the original
  combination"). A match only at a higher rank (COL falls back to the genus) is "not in COL".

Data: `api.checklistbank.org` (match, sector → source dataset, synonyms) and TaxonWorks
`/taxon_names?taxon_name_id[]=…&synonymify=true`. English text; other languages through the
site translator (`src/i18n/locales`). The same panel, restyled, is on Syrphidae of Italy.
