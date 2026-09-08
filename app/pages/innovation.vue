<script setup lang="ts">
import type { ApiSuccess, PublicContent } from '~/types/api'
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Innovation & R&D' })
const { data } = await useFetch<ApiSuccess<PublicContent[]>>('/api/public/content', { query: { kind: 'RND' } })
const items = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <section class="section innovation-hero">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Innovation & R&D</p>
          <h1 class="display-title">Expérimenter, mesurer, documenter et partager.</h1>
          <p class="lead">Le pôle Innovation & R&D part de problèmes concrets pour tester des méthodes pédagogiques, des outils numériques et des prototypes utiles. Les résultats sont documentés avant toute diffusion publique.</p>
          <div class="hero-actions"><NuxtLink to="/contact" class="btn btn-primary">Échanger avec IFICS</NuxtLink><NuxtLink to="/logiciels" class="btn btn-secondary">Voir les ressources</NuxtLink></div>
        </div>
        <div class="split-media"><img :src="publicVisuals.innovation" alt="Atelier de prototypage et d'innovation mené avec différents publics"></div>
      </div>
    </section>

    <section class="section-compact process-section">
      <div class="container grid grid-3">
        <article class="card card-pad"><span class="kicker">01 · Explorer</span><h2>Comprendre le problème</h2><p>Observer les usages, écouter les personnes concernées et formuler des hypothèses testables.</p></article>
        <article class="card card-pad"><span class="kicker">02 · Prototyper</span><h2>Tester rapidement</h2><p>Construire un outil ou un format simple, le confronter au terrain puis corriger ce qui doit l’être.</p></article>
        <article class="card card-pad"><span class="kicker">03 · Transmettre</span><h2>Capitaliser</h2><p>Documenter les enseignements et publier les ressources lorsque leur diffusion est pertinente et validée.</p></article>
      </div>
    </section>

    <section class="section">
      <div class="container split-section reverse">
        <div class="split-copy">
          <p class="eyebrow">Recherche appliquée</p>
          <h2 class="section-title">L’innovation n’a de valeur que si elle améliore réellement un usage.</h2>
          <p class="lead">IFICS privilégie les expérimentations mesurables, compréhensibles et transférables. Le but n’est pas de multiplier les outils mais d’identifier ceux qui répondent vraiment au besoin.</p>
          <ul class="feature-list"><li><span>Des hypothèses explicites avant l’expérimentation.</span></li><li><span>Des retours du terrain pendant le test.</span></li><li><span>Une documentation suffisante pour comprendre les résultats.</span></li></ul>
        </div>
        <div class="split-media"><img :src="publicVisuals.numerique" alt="Atelier d'accompagnement numérique et de transmission de compétences" loading="lazy"></div>
      </div>
    </section>

    <section class="section publications-section">
      <div class="container">
        <p class="eyebrow">Publications R&D</p>
        <h2 class="section-title">Partager ce qui peut être utile à d'autres.</h2>
        <div v-if="items.length" class="grid grid-3">
          <article v-for="item in items" :key="item.id" class="card card-pad publication-card"><span class="badge">R&D</span><h3>{{ item.title }}</h3><p>{{ item.excerpt }}</p><NuxtLink class="media-card-link" :to="`/actualites/${item.slug}`">Lire la publication →</NuxtLink></article>
        </div>
        <div v-else class="empty-state">Aucune publication R&D n’est ouverte au public pour le moment.</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.innovation-hero { background: linear-gradient(180deg, #f7faf8 0, #fff 100%); }
.process-section { background: #eff4f0; border-block: 1px solid #e5ece7; }
.process-section h2 { margin: 9px 0; font-size: 1.22rem; }
.process-section p, .publication-card p { color: var(--ifics-muted); margin-bottom: 0; }
.publications-section { background: #f9fbf9; }
.publication-card h3 { margin: 14px 0 8px; }
</style>
