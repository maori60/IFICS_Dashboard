<script setup lang="ts">
import type { ApiSuccess, PublicContent } from '~/types/api'
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Actualités' })
const { data } = await useFetch<ApiSuccess<PublicContent[]>>('/api/public/content')
const items = computed(() => (data.value?.data ?? []).filter(item => ['NEWS', 'ARTICLE', 'RND'].includes(item.kind)))
</script>

<template>
  <div>
    <section class="section news-hero">
      <div class="container split-section reverse">
        <div class="split-copy">
          <p class="eyebrow">Actualités & publications</p>
          <h1 class="display-title">Suivre les projets, les idées et les ressources IFICS.</h1>
          <p class="lead">Retrouvez les contenus que l’équipe choisit de rendre publics : actualités de terrain, retours d’expérience, publications R&D et ressources utiles.</p>
        </div>
        <div class="split-media"><img :src="publicVisuals.culture" alt="Atelier collectif illustrant les actualités de terrain IFICS"></div>
      </div>
    </section>

    <section class="section publication-list">
      <div class="container">
        <p class="eyebrow">À lire</p>
        <h2 class="section-title">Publications récentes</h2>
        <div v-if="items.length" class="grid grid-3 list">
          <article v-for="item in items" :key="item.id" class="card card-pad publication-card">
            <div class="actions"><span class="badge">{{ item.kind === 'RND' ? 'R&D' : item.kind === 'NEWS' ? 'Actualité' : 'Article' }}</span></div>
            <h2>{{ item.title }}</h2>
            <p>{{ item.excerpt }}</p>
            <NuxtLink class="media-card-link" :to="`/actualites/${item.slug}`">Lire la publication →</NuxtLink>
          </article>
        </div>
        <div v-else class="empty-state">Aucune publication n’est actuellement disponible. Les contenus apparaîtront ici après validation éditoriale.</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.news-hero { background: #fff; }
.publication-list { background: #f1f5f2; border-block: 1px solid #e5ece7; }
.publication-card { min-height: 100%; }
.publication-card h2 { margin: 14px 0 8px; font-size: 1.22rem; line-height: 1.25; }
.publication-card p { margin: 0; color: var(--ifics-muted); }
</style>
