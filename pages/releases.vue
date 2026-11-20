<template>
  <div class="wid-home bg-base-background">
    <PageHeader
      eyebrow="Data releases"
      title="WID releases"
      subtitle="WID grows continuously. Every few months we freeze a citable release: a snapshot of the whole database with its own DOI, its coverage and the list of what changed."
    />

    <div class="container mx-auto px-4 py-12 box-border">
      <p
        v-if="releases === null"
        class="opacity-70"
      >
        Loading…
      </p>

      <div
        v-else-if="!releases.length"
        class="rounded-2xl p-6 ring-1 ring-base-border"
      >
        <p class="font-semibold">The first release is coming soon.</p>
        <p class="mt-1 text-sm opacity-80">
          Until then, please cite the database as shown on
          <RouterLink
            to="/cite"
            class="underline"
            >How to cite</RouterLink
          >.
        </p>
      </div>

      <template v-else>
        <!-- Latest release -->
        <section class="rounded-2xl p-6 sm:p-8 ring-1 ring-base-border">
          <div class="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider opacity-70">Latest release</p>
              <h2 class="text-3xl font-bold mt-1">WID {{ latest.version }}</h2>
              <p class="opacity-80">{{ fmtDate(latest.date) }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <a
                v-if="latest.doi"
                :href="doiUrl(latest.doi)"
                target="_blank"
                rel="noopener"
                class="wid-btn"
                >DOI {{ latest.doi }}</a
              >
              <a
                :href="`${RELEASES_URL}/tag/${latest.version}`"
                target="_blank"
                rel="noopener"
                class="wid-btn"
                >Download (ColDP)</a
              >
            </div>
          </div>

          <dl class="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div
              v-for="s in totals(latest)"
              :key="s.label"
            >
              <dt class="text-xs uppercase tracking-wider opacity-70">{{ s.label }}</dt>
              <dd class="text-2xl font-bold">{{ fmtNum(s.value) }}</dd>
            </div>
          </dl>

          <p class="mt-6 text-sm">
            <b>Cite as:</b> Dal Pos D. ({{ latest.date.slice(0, 4) }}) World Ichneumonidae Database (WID), release
            {{ latest.version }}. Zenodo.
            <a
              v-if="latest.doi"
              :href="doiUrl(latest.doi)"
              class="underline"
              >{{ doiUrl(latest.doi) }}</a
            >
          </p>
        </section>

        <!-- What changed -->
        <section
          v-if="stats?.changes"
          class="mt-10"
        >
          <h2 class="text-2xl font-bold">What's new since {{ stats.changes.since }}</h2>
          <ul class="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-1">
            <li><b>{{ fmtNum(stats.changes.counts.addedSpecies) }}</b> species added, {{ fmtNum(stats.changes.counts.described) }} recently described</li>
            <li><b>{{ fmtNum(stats.changes.counts.addedGenera) }}</b> genera added</li>
            <li><b>{{ fmtNum(stats.changes.counts.addedSynonyms) }}</b> synonyms and other names added</li>
            <li><b>{{ fmtNum(stats.changes.counts.status) }}</b> changes of status</li>
            <li><b>{{ fmtNum(stats.changes.counts.renamed) }}</b> new combinations or spellings</li>
            <li><b>{{ fmtNum(stats.changes.counts.corrected) }}</b> corrections of author or year</li>
          </ul>

          <div
            v-if="stats.changes.described?.length"
            class="mt-6"
          >
            <h3 class="font-semibold">Newly described species</h3>
            <ul class="mt-2 columns-1 sm:columns-2 gap-8 text-sm">
              <li
                v-for="t in stats.changes.described"
                :key="t.id"
                class="py-0.5"
              >
                <i>{{ t.name }}</i> {{ t.authorship }}
                <span class="opacity-60">· {{ t.subfamily }}</span>
              </li>
            </ul>
          </div>

          <div
            v-if="stats.changes.addedGenera?.length"
            class="mt-6"
          >
            <h3 class="font-semibold">Genera added</h3>
            <ul class="mt-2 columns-1 sm:columns-2 gap-8 text-sm">
              <li
                v-for="t in stats.changes.addedGenera"
                :key="t.id"
                class="py-0.5"
              >
                <i>{{ t.name }}</i> {{ t.authorship }}
                <span class="opacity-60">· {{ t.subfamily }}</span>
              </li>
            </ul>
          </div>
          <p class="mt-4 text-sm opacity-80">
            Full list of changes:
            <a
              :href="`${RELEASES_URL}/tag/${latest.version}`"
              target="_blank"
              rel="noopener"
              class="underline"
              >release notes</a
            >.
          </p>
        </section>

        <!-- Coverage -->
        <section
          v-if="stats?.subfamilies?.length"
          class="mt-10"
        >
          <h2 class="text-2xl font-bold">Coverage by subfamily</h2>
          <p class="mt-1 text-sm opacity-80">
            Valid genera and species in this release. WID is a work in progress: see the
            <RouterLink
              to="/subfamilies"
              class="underline"
              >subfamily status table</RouterLink
            >
            for which groups are complete.
          </p>
          <table class="mt-4 w-full text-sm">
            <thead>
              <tr class="text-left border-b border-base-border">
                <th class="py-2">Subfamily</th>
                <th class="py-2 text-right">Genera</th>
                <th class="py-2 text-right">Species</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in stats.subfamilies"
                :key="s.subfamily"
                class="border-b border-base-border/50"
              >
                <td class="py-1.5">{{ s.subfamily }}</td>
                <td class="py-1.5 text-right">{{ fmtNum(s.genera) }}</td>
                <td class="py-1.5 text-right">{{ fmtNum(s.species) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Earlier releases -->
        <section
          v-if="releases.length > 1"
          class="mt-10"
        >
          <h2 class="text-2xl font-bold">Earlier releases</h2>
          <ul class="mt-3 divide-y divide-base-border">
            <li
              v-for="r in releases.slice(1)"
              :key="r.version"
              class="py-2 flex flex-wrap gap-x-4 gap-y-1 items-baseline"
            >
              <b>WID {{ r.version }}</b>
              <span class="opacity-70">{{ fmtDate(r.date) }}</span>
              <span class="text-sm">{{ fmtNum(r.totals?.species) }} species · {{ fmtNum(r.totals?.genera) }} genera</span>
              <a
                v-if="r.doi"
                :href="doiUrl(r.doi)"
                class="text-sm underline"
                >doi:{{ r.doi }}</a
              >
              <a
                :href="`${RELEASES_URL}/tag/${r.version}`"
                target="_blank"
                rel="noopener"
                class="text-sm underline"
                >notes</a
              >
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PageHeader from './components/Home/PageHeader.vue'
import { RELEASES_URL, doiUrl, fmtDate, fmtNum, loadStats, useReleases } from './components/Releases/useReleases.js'

const releases = useReleases()
const latest = computed(() => releases.value?.[0] || null)
const stats = ref(null)

watch(
  latest,
  async (r) => {
    stats.value = r ? await loadStats(r.version) : null
  },
  { immediate: true }
)

const totals = (r) => [
  { label: 'Subfamilies', value: r.totals?.subfamilies },
  { label: 'Valid genera', value: r.totals?.genera },
  { label: 'Valid species', value: r.totals?.species },
  { label: 'Synonyms', value: r.totals?.synonyms },
  { label: 'References', value: r.totals?.references }
]
</script>

<style scoped>
.wid-btn {
  display: inline-block;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid currentColor;
}
.wid-btn:hover {
  opacity: 0.8;
}
</style>
