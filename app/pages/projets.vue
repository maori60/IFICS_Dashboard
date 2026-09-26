<script setup lang="ts">
import type { ApiSuccess, PublicProject } from '~/types/api'

useHead({ title: 'Nos projets' })
const { data } = await useFetch<ApiSuccess<PublicProject[]>>('/api/public/projects')
const projects = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <section class="editorial-hero projects-v2-hero"><div class="container editorial-hero-grid"><div><p class="eyebrow">Nos projets</p><h1>Le terrain comme preuve.</h1></div><div><p class="lead">Nous préférons montrer des réalisations concrètes plutôt qu’empiler les promesses. Seuls les projets autorisés à la publication apparaissent ici.</p><div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet</NuxtLink></div></div></div></section>
    <section class="section projects-v2-list"><div class="container"><template v-if="projects.length"><PublicProjectSlider :projects="projects" /><div class="project-index-grid"><article v-for="(project,index) in projects" :key="project.id"><span>{{ String(index + 1).padStart(2,'0') }}</span><div><p>{{ project.territory || 'Projet IFICS' }}</p><h2>{{ project.title }}</h2><p v-if="project.summary">{{ project.summary }}</p><NuxtLink :to="`/projects/${project.projectId}`">Voir le projet →</NuxtLink></div></article></div></template><div v-else class="quiet-empty"><strong>Les projets publics arrivent bientôt.</strong><p>Les projets restent protégés tant que leur publication n’a pas été explicitement autorisée.</p></div></div></section>
    <section class="section-compact final-cta-section"><div class="container final-cta"><div><p class="eyebrow light">Votre projet</p><h2>Un contexte à comprendre avant une solution à proposer.</h2></div><div><p>Expliquez-nous le besoin, le public et le résultat attendu.</p><div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-ivory">Présenter le besoin</NuxtLink></div></div></div></section>
  </div>
</template>
