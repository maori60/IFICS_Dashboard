<script setup lang="ts">
import type { PublicProject } from '~/types/api'
import { publicVisuals } from '~/utils/publicVisuals'

const props = defineProps<{ projects: PublicProject[] }>()
const track = ref<HTMLDivElement | null>(null)

function move(direction: 'previous' | 'next') {
  if (!track.value) return
  const distance = Math.max(track.value.clientWidth * 0.82, 320)
  track.value.scrollBy({ left: direction === 'next' ? distance : -distance, behavior: 'smooth' })
}

function imageFor(project: PublicProject) {
  return project.imageUrl || publicVisuals.projects
}
</script>

<template>
  <div v-if="props.projects.length" class="project-showcase">
    <div ref="track" class="project-showcase-track" tabindex="0" aria-label="Projets IFICS publiés">
      <article v-for="(project, index) in props.projects" :key="project.id" class="project-slide">
        <img :src="imageFor(project)" :alt="project.title" loading="lazy">
        <div class="project-slide-overlay" />
        <div class="project-slide-content">
          <div class="project-slide-meta">
            <span>Projet {{ String(index + 1).padStart(2, '0') }}</span>
            <span v-if="project.territory">{{ project.territory }}</span>
          </div>
          <h3>{{ project.title }}</h3>
          <p v-if="project.summary">{{ project.summary }}</p>
          <NuxtLink :to="`/projects/${project.projectId}`" class="project-slide-link">Découvrir le projet <span aria-hidden="true">↗</span></NuxtLink>
        </div>
      </article>
    </div>
    <div class="project-showcase-controls" aria-label="Navigation du carrousel">
      <button type="button" aria-label="Projet précédent" @click="move('previous')">←</button>
      <button type="button" aria-label="Projet suivant" @click="move('next')">→</button>
    </div>
  </div>
</template>
