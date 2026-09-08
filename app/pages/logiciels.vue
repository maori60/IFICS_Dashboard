<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Logiciels & ressources' })

type Software = {
  id: string
  slug: string
  name: string
  description: string | null
  audience: string | null
  platforms: string[]
  license: string | null
  openSource: boolean
  repoUrl: string | null
  docsUrl: string | null
  videoUrl: string | null
  status: string
  category: { id: string; name: string; kind: string } | null
  latestVersion: { version: string; downloadUrl: string | null; sha256: string | null; fileSize: string | null; publishedAt: string | null } | null
  downloadCount: number
}

const { data } = await useFetch<ApiSuccess<Software[]>>('/api/public/software')
const items = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <section class="section software-hero">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Logiciels & ressources</p>
          <h1 class="display-title">Des outils utiles, accessibles et documentés.</h1>
          <p class="lead">IFICS peut publier ses propres outils ou recommander des ressources pertinentes. Chaque fiche distingue clairement l’origine, la version, la licence et les informations utiles avant téléchargement.</p>
          <ul class="feature-list"><li><span>Des ressources gratuites ou ouvertes clairement identifiées.</span></li><li><span>Des versions et changements documentés.</span></li><li><span>Des téléchargements accompagnés des informations techniques utiles.</span></li></ul>
        </div>
        <div class="split-media"><img :src="publicVisuals.numerique" alt="Atelier d'accompagnement aux usages numériques"></div>
      </div>
    </section>

    <section class="section catalog-section">
      <div class="container">
        <p class="eyebrow">Catalogue public</p>
        <h2 class="section-title">Logiciels et outils disponibles</h2>
        <div v-if="items.length" class="grid grid-3 software-grid">
          <article v-for="item in items" :key="item.id" class="card card-pad software-card">
            <div class="actions"><span class="badge">{{ item.status }}</span><span v-if="item.category" class="badge badge-muted">{{ item.category.name }}</span></div>
            <h2>{{ item.name }}</h2>
            <p>{{ item.description }}</p>
            <dl class="software-meta"><div><dt>Plateformes</dt><dd>{{ item.platforms.join(' · ') || 'Non précisées' }}</dd></div><div><dt>Licence</dt><dd>{{ item.license || 'Non renseignée' }}</dd></div><div v-if="item.latestVersion"><dt>Version</dt><dd>{{ item.latestVersion.version }}</dd></div></dl>
            <details v-if="item.latestVersion?.sha256" class="checksum"><summary>Empreinte du fichier</summary><code>{{ item.latestVersion.sha256 }}</code></details>
            <div class="actions software-actions"><a v-if="item.latestVersion?.downloadUrl" :href="item.latestVersion.downloadUrl" class="btn btn-primary">Télécharger</a><a v-if="item.repoUrl" :href="item.repoUrl" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">Code source</a><a v-if="item.docsUrl" :href="item.docsUrl" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">Documentation</a></div>
          </article>
        </div>
        <div v-else class="empty-state">Le catalogue sera alimenté à mesure que les premières ressources auront terminé leur validation technique et éditoriale.</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.software-hero { background: #fff; }
.catalog-section { background: #f1f5f2; }
.software-card { display: flex; flex-direction: column; }
.software-card h2 { margin: 14px 0 8px; font-size: 1.28rem; }
.software-card > p { margin: 0; color: var(--ifics-muted); }
.software-meta { display: grid; gap: 10px; margin: 22px 0; }
.software-meta div { display: grid; grid-template-columns: 96px 1fr; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid #edf1ee; }
.software-meta dt { color: var(--ifics-muted); font-size: .78rem; font-weight: 750; }
.software-meta dd { margin: 0; font-size: .86rem; }
.checksum { margin: 0 0 20px; color: var(--ifics-muted); font-size: .8rem; }
.checksum code { display: block; margin-top: 8px; word-break: break-all; font-size: .7rem; }
.software-actions { margin-top: auto; }
</style>
