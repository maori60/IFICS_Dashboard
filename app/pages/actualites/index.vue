<script setup lang="ts">
import type { ApiSuccess, PublicContent } from '~/types/api'

useHead({ title: 'Actualités & publications' })
const { data } = await useFetch<ApiSuccess<PublicContent[]>>('/api/public/content')
const items = computed(() => (data.value?.data ?? []).filter(item => ['NEWS', 'ARTICLE', 'RND'].includes(item.kind)))
</script>

<template>
  <div>
    <section class="editorial-hero publication-v2-hero"><div class="container editorial-hero-grid"><div><p class="eyebrow">Actualités & publications</p><h1>Ce que nous faisons.<br>Ce que nous apprenons.</h1></div><div><p class="lead">Actions de terrain, retours d’expérience, contenus KREATORTECH et publications R&D : uniquement les contenus que l’équipe choisit de rendre publics.</p></div></div></section>
    <section class="section publication-v2-list"><div class="container"><div v-if="items.length" class="publication-v2-grid"><article v-for="item in items" :key="item.id"><span>{{ item.kind === 'RND' ? 'R&D' : item.kind === 'NEWS' ? 'Actualité' : 'Article' }}</span><h2>{{ item.title }}</h2><p>{{ item.excerpt }}</p><NuxtLink :to="`/actualites/${item.slug}`">Lire la publication →</NuxtLink></article></div><div v-else class="quiet-empty"><strong>Aucune publication pour le moment.</strong><p>Les contenus apparaîtront ici après validation éditoriale.</p></div></div></section>
  </div>
</template>
