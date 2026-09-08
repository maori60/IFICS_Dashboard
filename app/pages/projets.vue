<script setup lang="ts">
import type { ApiSuccess, PublicProject } from '~/types/api'
import { publicVisuals, visualForDomain } from '~/utils/publicVisuals'

useHead({ title: 'Projets' })
const { data } = await useFetch<ApiSuccess<PublicProject[]>>('/api/public/projects')
const projects = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <section class="section projects-hero">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Projets IFICS</p>
          <h1 class="display-title">Des projets construits avec les territoires.</h1>
          <p class="lead">Cette page présente uniquement les projets autorisés à la publication. Chaque fiche publique se concentre sur l’objectif, le public et l’impact, sans afficher les informations administratives ou financières internes.</p>
          <div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet</NuxtLink><NuxtLink to="/contact" class="btn btn-secondary">Échanger avec IFICS</NuxtLink></div>
        </div>
        <div class="split-media"><img :src="publicVisuals.education" alt="Projet éducatif accompagné par IFICS"></div>
      </div>
    </section>

    <section class="section project-list-section">
      <div class="container">
        <div class="project-intro"><div><p class="eyebrow">Réalisations publiques</p><h2 class="section-title">Voir ce que nous construisons concrètement.</h2></div><p class="lead">Les projets sont publiés après validation et peuvent être enrichis au fur et à mesure de leur déroulement.</p></div>
        <div v-if="projects.length" class="grid grid-3 project-grid">
          <article v-for="project in projects" :key="project.id" class="card media-card project-card">
            <img class="media-card-image" :src="project.imageUrl || visualForDomain(`${project.title} ${project.summary}`)" :alt="project.title" loading="lazy">
            <div class="media-card-body">
              <div class="actions"><span class="badge">{{ project.status || 'Projet' }}</span><span v-if="project.territory" class="badge badge-muted">{{ project.territory }}</span></div>
              <h2>{{ project.title }}</h2>
              <p>{{ project.summary }}</p>
            </div>
          </article>
        </div>
        <div v-else class="empty-state projects-empty"><strong>Les premiers projets publics seront bientôt présentés ici.</strong><span>Leur absence ne signifie pas qu’aucune action n’est en cours : seules les publications validées sont visibles.</span></div>
      </div>
    </section>

    <section class="section-compact"><div class="container cta-panel"><div><h2>Vous avez une problématique à traiter ?</h2><p>Décrivez le besoin et le public concerné. IFICS pourra ensuite qualifier la demande et étudier un projet avec vous.</p></div><NuxtLink to="/proposer-un-projet" class="btn btn-secondary">Présenter le besoin</NuxtLink></div></section>
  </div>
</template>

<style scoped>
.projects-hero { background: #fff; }
.project-list-section { background: #f1f5f2; border-block: 1px solid #e5ece7; }
.project-intro { display: grid; grid-template-columns: 1fr .8fr; gap: 50px; align-items: end; margin-bottom: 32px; }
.project-intro .lead { font-size: 1rem; }
.project-card h2 { font-size: 1.25rem; }
.projects-empty { display: flex; flex-direction: column; gap: 7px; }
.projects-empty strong { color: var(--ifics-ink); }
@media (max-width: 800px) { .project-intro { grid-template-columns: 1fr; gap: 8px; align-items: start; } }
</style>
