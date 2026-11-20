# PanelContent (`panel:content`)

Overview tab. The text topics written for the taxon in TaxonWorks (e.g. "Male", "Biology"),
from `/otus/:id/inventory/content`; one section per topic (`PanelContentTopic.vue`).

TaxonWorks writes the citations in the text as links to `/sources/<id>`, which do not exist on the
website. They are styled like the citations in Nomenclature and, when clicked, open the **full
reference** under the text, with Request PDF and Copy (the row of Nomenclature references,
`PanelReferenceRow.vue`). "References cited" at the end lists every reference of the topic
(loaded when opened).
