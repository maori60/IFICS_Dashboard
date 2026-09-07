<script setup lang="ts">
import type { ApiSuccess, PublicContent, PublicPartner, PublicProject } from '~/types/api'

useHead({ title: 'Agir, transmettre, inclure et innover' })

const { data: projectsResponse } = await useFetch<ApiSuccess<PublicProject[]>>('/api/public/projects')
const { data: newsResponse } = await useFetch<ApiSuccess<PublicContent[]>>('/api/public/content', { query: { kind: 'NEWS' } })
const { data: partnersResponse } = await useFetch<ApiSuccess<PublicPartner[]>>('/api/public/partners')

const projects = computed(() => (projectsResponse.value?.data ?? []).slice(0, 3))
const news = computed(() => (newsResponse.value?.data ?? []).slice(0, 3))
const partners = computed(() => (partnersResponse.value?.data ?? []).slice(0, 8))

const domains = [
  ['Éducation', 'Concevoir des actions pédagogiques qui donnent confiance et développent l’autonomie.'],
  ['Sport', 'Faire du mouvement un outil de santé, de transmission, de discipline et de lien social.'],
  ['Culture', 'Créer des espaces d’expression, de découverte et de rencontre entre les publics.'],
  ['Numérique', 'Rendre les outils numériques compréhensibles, utiles et accessibles au plus grand nombre.'],
  ['Insertion', 'Renforcer les compétences et les passerelles vers l’emploi et la participation citoyenne.'],
  ['Innovation & R&D', 'Expérimenter, documenter et transformer des idées en solutions réutilisables.'],
]
</script>

<template>
  <div>
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <p class="eyebrow">Association IFICS · France</p>
          <h1 class="display-title">Agir sur le terrain. Transmettre durablement.</h1>
          <p class="lead">IFICS développe des projets d’éducation, de sport, de culture, de numérique, d’insertion et d’innovation avec les collectivités, les partenaires et les acteurs de terrain.</p>
          <div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet</NuxtLink><NuxtLink to="/actions" class="btn btn-secondary">Découvrir nos actions</NuxtLink></div>
        </div>
        <div class="hero-panel" aria-label="Domaines d'intervention IFICS"><span>Éducation</span><span>Sport</span><span>Culture</span><span>Numérique</span><span>Insertion</span><span>Innovation</span><strong>Des projets conçus avec les territoires.</strong></div>
      </div>
    </section>

    <section class="section"><div class="container"><p class="eyebrow">Nos domaines</p><h2 class="section-title">Une approche transversale, du besoin à l’impact.</h2><div class="grid grid-3 domain-grid"><article v-for="(domain, index) in domains" :key="domain[0]" class="card card-pad"><span class="domain-number">0{{ index + 1 }}</span><h3>{{ domain[0] }}</h3><p>{{ domain[1] }}</p></article></div></div></section>

    <section class="section project-section"><div class="container"><div class="section-row"><div><p class="eyebrow">Projets</p><h2 class="section-title">Ce que nous construisons avec nos partenaires.</h2></div><NuxtLink to="/projets" class="btn btn-secondary">Voir les projets</NuxtLink></div><div v-if="projects.length" class="grid grid-3"><article v-for="project in projects" :key="project.id" class="card project-card"><div class="project-image" :style="project.imageUrl ? { backgroundImage: `url(${project.imageUrl})` } : undefined"/><div class="card-pad"><span class="badge">{{ project.status || 'Projet IFICS' }}</span><h3>{{ project.title }}</h3><p>{{ project.summary }}</p><small>{{ project.territory }}</small></div></article></div><div v-else class="empty-state">Les projets publics validés par IFICS apparaîtront ici.</div></div></section>

    <section class="section"><div class="container"><div class="section-row"><div><p class="eyebrow">Actualités</p><h2 class="section-title">Suivre les actions et les publications.</h2></div><NuxtLink to="/actualites" class="btn btn-secondary">Toutes les actualités</NuxtLink></div><div v-if="news.length" class="grid grid-3"><article v-for="item in news" :key="item.id" class="card card-pad"><span class="badge badge-muted">Actualité</span><h3>{{ item.title }}</h3><p>{{ item.excerpt }}</p><NuxtLink :to="`/actualites/${item.slug}`">Lire la publication →</NuxtLink></article></div><div v-else class="empty-state">Les actualités publiées par l’équipe communication apparaîtront ici.</div></div></section>

    <section class="section partner-section"><div class="container"><p class="eyebrow">Partenaires</p><h2 class="section-title">La coopération est au cœur de notre méthode.</h2><div v-if="partners.length" class="partner-list"><a v-for="partner in partners" :key="partner.id" :href="partner.websiteUrl || undefined" class="partner-chip" :aria-label="partner.websiteUrl ? `Site de ${partner.name}` : partner.name"><img v-if="partner.logoUrl" :src="partner.logoUrl" alt=""><span>{{ partner.name }}</span></a></div><p v-else class="lead">Collectivités, associations, entreprises, mécènes et partenaires opérationnels peuvent construire une action avec IFICS.</p><div class="hero-actions"><NuxtLink to="/partenaires" class="btn btn-primary">Devenir partenaire</NuxtLink><NuxtLink to="/contact" class="btn btn-secondary">Nous contacter</NuxtLink></div></div></section>
  </div>
</template>

<style scoped>
.hero { padding: 90px 0 72px; overflow: hidden; background: radial-gradient(circle at 85% 15%, #d9eee0 0, transparent 35%), linear-gradient(180deg, #f8fbf8 0, #eef5f0 100%); }
.hero-grid { display: grid; grid-template-columns: 1.45fr .55fr; gap: 60px; align-items: center; }
.hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
.hero-panel { min-height: 390px; border-radius: 32px; padding: 28px; background: var(--ifics-green-900); color: #fff; box-shadow: var(--ifics-shadow); display: flex; align-content: flex-start; flex-wrap: wrap; gap: 10px; position: relative; }
.hero-panel span { border: 1px solid #3f6c55; background: #183f2d; border-radius: 999px; padding: 8px 11px; font-size: .82rem; }
.hero-panel strong { align-self: flex-end; width: 100%; margin-top: auto; font-size: 2rem; line-height: 1.05; letter-spacing: -.035em; }
.domain-grid h3 { margin: 8px 0 6px; font-size: 1.35rem; }
.domain-grid p { color: var(--ifics-muted); margin: 0; }
.domain-number { color: var(--ifics-gold); font-weight: 900; }
.project-section { background: #eef3ef; }
.section-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
.project-card { overflow: hidden; }
.project-image { height: 180px; background: linear-gradient(135deg, #b8d6c2, #214f39); background-size: cover; background-position: center; }
.project-card h3 { margin-bottom: 6px; }
.project-card p, .project-card small { color: var(--ifics-muted); }
.partner-section { background: #fff; }
.partner-list { display: flex; flex-wrap: wrap; gap: 12px; margin: 26px 0; }
.partner-chip { min-height: 62px; padding: 10px 16px; border: 1px solid var(--ifics-border); border-radius: 14px; display: flex; align-items: center; gap: 10px; text-decoration: none; background: #fff; }
.partner-chip img { width: 42px; height: 42px; object-fit: contain; }
@media (max-width: 900px) { .hero-grid { grid-template-columns: 1fr; } .hero-panel { min-height: 260px; } .section-row { align-items: flex-start; flex-direction: column; } }
</style>
