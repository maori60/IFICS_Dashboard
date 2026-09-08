<script setup lang="ts">
import type { ApiSuccess, PublicContent, PublicPartner, PublicProject } from '~/types/api'
import { publicVisuals, visualForDomain } from '~/utils/publicVisuals'

useHead({
  title: 'Agir, transmettre, inclure et innover',
  meta: [
    { name: 'description', content: 'IFICS conçoit avec les territoires des projets éducatifs, sportifs, culturels, numériques, d’insertion et d’innovation.' },
  ],
})

const { data: projectsResponse } = await useFetch<ApiSuccess<PublicProject[]>>('/api/public/projects')
const { data: newsResponse } = await useFetch<ApiSuccess<PublicContent[]>>('/api/public/content', { query: { kind: 'NEWS' } })
const { data: partnersResponse } = await useFetch<ApiSuccess<PublicPartner[]>>('/api/public/partners')

const projects = computed(() => (projectsResponse.value?.data ?? []).slice(0, 3))
const news = computed(() => (newsResponse.value?.data ?? []).slice(0, 3))
const partners = computed(() => (partnersResponse.value?.data ?? []).slice(0, 8))

const domains = [
  { key: 'education', title: 'Éducation', short: 'Apprendre et progresser', text: 'Des actions pédagogiques qui renforcent la confiance, l’autonomie et l’envie d’apprendre.', image: publicVisuals.education },
  { key: 'sport', title: 'Sport', short: 'Bouger et se construire', text: 'Le mouvement comme levier de santé, de transmission, de discipline et de lien social.', image: publicVisuals.sport },
  { key: 'culture', title: 'Culture', short: 'Créer et partager', text: 'Des espaces d’expression, de découverte et de rencontre entre les publics et les territoires.', image: publicVisuals.culture },
  { key: 'numerique', title: 'Numérique', short: 'Comprendre les outils', text: 'Rendre les usages numériques plus simples, plus utiles et accessibles au plus grand nombre.', image: publicVisuals.numerique },
  { key: 'insertion', title: 'Insertion', short: 'Construire son parcours', text: 'Renforcer les compétences, l’orientation et les passerelles vers l’activité et l’emploi.', image: publicVisuals.insertion },
  { key: 'innovation', title: 'Innovation & R&D', short: 'Tester et documenter', text: 'Transformer des besoins concrets en méthodes, prototypes et ressources réutilisables.', image: publicVisuals.innovation },
]
</script>

<template>
  <div>
    <section class="public-hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Association IFICS · France</p>
          <h1 class="display-title">Agir sur le terrain.<br>Transmettre durablement.</h1>
          <p class="lead">IFICS construit avec les collectivités et les acteurs de terrain des projets utiles en éducation, sport, culture, numérique, insertion et innovation.</p>
          <div class="hero-actions">
            <NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet →</NuxtLink>
            <NuxtLink to="/actions" class="btn btn-secondary">Découvrir nos actions</NuxtLink>
          </div>
          <div class="hero-trust" aria-label="Principes d'intervention">
            <div class="hero-trust-item"><span class="hero-trust-icon" aria-hidden="true">1</span><span><strong>Partir du besoin réel</strong><br>Observer le terrain avant de concevoir l’action.</span></div>
            <div class="hero-trust-item"><span class="hero-trust-icon" aria-hidden="true">2</span><span><strong>Construire ensemble</strong><br>Associer partenaires, intervenants et bénéficiaires.</span></div>
            <div class="hero-trust-item"><span class="hero-trust-icon" aria-hidden="true">3</span><span><strong>Documenter l’impact</strong><br>Suivre, évaluer et améliorer chaque projet.</span></div>
          </div>
        </div>
        <div class="hero-media">
          <img class="hero-image" :src="publicVisuals.education" alt="Atelier éducatif accompagné par une intervenante dans un environnement lumineux">
          <div class="hero-note">
            <strong>Des projets conçus avec les territoires, pas à leur place.</strong>
            <span>Une méthode transversale, du besoin jusqu’au bilan.</span>
          </div>
        </div>
      </div>
    </section>

    <section class="public-band section-compact" aria-labelledby="domains-title">
      <div class="container domain-strip">
        <div id="domains-title" class="domain-strip-title">Nos domaines<br>d’intervention</div>
        <NuxtLink v-for="domain in domains" :key="domain.key" to="/actions" class="domain-chip">
          <strong>{{ domain.title }}</strong>
          <span>{{ domain.short }}</span>
        </NuxtLink>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="eyebrow">Une même méthode, plusieurs disciplines</p>
        <h2 class="section-title">Répondre au besoin avec le bon levier.</h2>
        <p class="lead">Les disciplines ne sont pas des silos : elles peuvent se compléter dans un même projet selon le public, le territoire et les objectifs.</p>
        <div class="grid grid-3 theme-grid">
          <article v-for="(domain, index) in domains" :key="domain.key" class="card theme-card">
            <img :src="domain.image" :alt="`Illustration du domaine ${domain.title}`" loading="lazy">
            <div class="theme-card-content">
              <span class="theme-card-index">0{{ index + 1 }}</span>
              <h3>{{ domain.title }}</h3>
              <p>{{ domain.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section project-section">
      <div class="container">
        <div class="section-row">
          <div><p class="eyebrow">Projets</p><h2 class="section-title">Des actions concrètes construites avec nos partenaires.</h2></div>
          <NuxtLink to="/projets" class="btn btn-secondary">Voir les projets</NuxtLink>
        </div>
        <div v-if="projects.length" class="grid grid-3">
          <article v-for="project in projects" :key="project.id" class="card media-card">
            <img class="media-card-image" :src="project.imageUrl || visualForDomain(`${project.title} ${project.summary}`)" :alt="project.title" loading="lazy">
            <div class="media-card-body">
              <span class="badge">{{ project.status || 'Projet IFICS' }}</span>
              <h3>{{ project.title }}</h3>
              <p>{{ project.summary }}</p>
              <small v-if="project.territory" class="muted">{{ project.territory }}</small>
            </div>
          </article>
        </div>
        <div v-else class="empty-state empty-rich">
          <strong>Les prochaines réalisations publiques seront présentées ici.</strong>
          <span>Seuls les projets validés pour publication apparaissent sur le site.</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Notre manière d’agir</p>
          <h2 class="section-title">Des projets lisibles pour les partenaires et utiles aux bénéficiaires.</h2>
          <p class="lead">Objectifs, calendrier, ressources et critères de réussite sont posés clairement. L’équipe suit ensuite l’action pour pouvoir l’ajuster et en rendre compte.</p>
          <ul class="feature-list">
            <li><span><strong>Co-construction</strong><br>Un cadre défini avec la structure partenaire.</span></li>
            <li><span><strong>Suivi</strong><br>Des informations structurées tout au long du projet.</span></li>
            <li><span><strong>Évaluation</strong><br>Un bilan qui aide à comprendre et améliorer l’action.</span></li>
          </ul>
        </div>
        <div class="split-media"><img :src="publicVisuals.insertion" alt="Accompagnement d’un parcours d’insertion et de formation" loading="lazy"></div>
      </div>
    </section>

    <section class="section news-section">
      <div class="container">
        <div class="section-row">
          <div><p class="eyebrow">Actualités & publications</p><h2 class="section-title">Suivre ce qui avance chez IFICS.</h2></div>
          <NuxtLink to="/actualites" class="btn btn-secondary">Toutes les actualités</NuxtLink>
        </div>
        <div v-if="news.length" class="grid grid-3">
          <article v-for="item in news" :key="item.id" class="card card-pad news-card">
            <span class="badge badge-muted">Actualité</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.excerpt }}</p>
            <NuxtLink class="media-card-link" :to="`/actualites/${item.slug}`">Lire la publication →</NuxtLink>
          </article>
        </div>
        <div v-else class="empty-state">Les publications validées par l’équipe communication apparaîtront ici.</div>
      </div>
    </section>

    <section class="section partner-section">
      <div class="container">
        <p class="eyebrow">Partenaires</p>
        <h2 class="section-title">Construire dans la durée, avec les bonnes compétences autour de la table.</h2>
        <div v-if="partners.length" class="partner-list">
          <a v-for="partner in partners" :key="partner.id" :href="partner.websiteUrl || undefined" class="partner-chip" :aria-label="partner.websiteUrl ? `Site de ${partner.name}` : partner.name">
            <img v-if="partner.logoUrl" :src="partner.logoUrl" alt=""><span>{{ partner.name }}</span>
          </a>
        </div>
        <p v-else class="lead">Collectivités, associations, entreprises, mécènes et partenaires opérationnels peuvent construire une action avec IFICS.</p>
        <div class="cta-panel partner-cta">
          <div><h2>Un besoin sur votre territoire ?</h2><p>Présentez le contexte, le public et l’objectif. L’équipe IFICS qualifiera la demande avant de construire une proposition.</p></div>
          <div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-secondary">Proposer un projet</NuxtLink><NuxtLink to="/contact" class="btn btn-secondary">Nous contacter</NuxtLink></div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.project-section { background: #eff4f0; }
.news-section { background: #fbfcfb; border-top: 1px solid #edf2ee; border-bottom: 1px solid #edf2ee; }
.partner-section { background: #fff; }
.section-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 30px; }
.empty-rich { display: flex; flex-direction: column; gap: 7px; }
.empty-rich strong { color: var(--ifics-ink); }
.news-card h3 { margin: 14px 0 8px; font-size: 1.16rem; }
.news-card p { color: var(--ifics-muted); margin: 0; }
.partner-list { display: flex; flex-wrap: wrap; gap: 12px; margin: 26px 0 32px; }
.partner-chip { min-height: 62px; padding: 10px 16px; border: 1px solid var(--ifics-border); border-radius: 14px; display: flex; align-items: center; gap: 10px; text-decoration: none; background: #fff; }
.partner-chip img { width: 42px; height: 42px; object-fit: contain; }
.partner-cta { margin-top: 32px; }
@media (max-width: 900px) { .section-row { align-items: flex-start; flex-direction: column; } }
</style>