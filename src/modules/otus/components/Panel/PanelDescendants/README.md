# PanelDescendants (`panel:descendants`)

Overview tab. The taxa directly below this one (a tree that opens level by level) and the
synonyms of each name, from `/otus/:id/inventory/taxonomy` (`max_descendants_depth: 1`).

- The header shows how many taxa are below and how many synonyms.
- Synonyms (`DescendantsSynonymList.vue`) are sorted oldest first and open **their own page**
  (invalid names have one): the name is looked up with `/otus/autocomplete`; if no page is found,
  "no page" is shown next to it.
