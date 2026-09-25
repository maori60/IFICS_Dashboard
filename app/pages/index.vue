<script setup lang="ts">
import type { ApiSuccess, PublicContent, PublicPartner, PublicProject } from '~/types/api'
import { publicIllustrations, publicVisuals, visualForDomain } from '~/utils/publicVisuals'

useHead({
  title: 'Solutions utiles pour les territoires',
  meta: [
    { name: 'description', content: 'IFICS conçoit des projets éducatifs, numériques et IT, d’insertion, culturels, sportifs et d’innovation avec les territoires.' },
  ],
})

const { data: projectsResponse } = await useFetch<ApiSuccess<PublicProject[]>>('/api/public/projects')
const { data: newsResponse } = await useFetch<ApiSuccess<PublicContent[]>>('/api/public/content', { query: { kind: 'NEWS' } })
const { data: partnersResponse } = await useFetch<ApiSuccess<PublicPartner[]>>('/api/public/partners')

const projects = computed(() => (projectsResponse.value?.data ?? []).slice(0, 3))
const news = computed(() => (newsResponse.value?.data ?? []).slice(0, 3))
const partners = computed(() => (partnersResponse.value?.data ?? []).slice(0, 8))

const domains = [
  { key: 'numerique', title: 'Numérique & IT', short: 'Concevoir, équiper, transmettre', text: 'Développement logiciel, outils métiers, accompagnement numérique, gestion IT et transmission de compétences.', illustration: publicIllustrations.numerique },
  { key: 'innovation', title: 'Innovation & R&D', short: 'Explorer et prototyper', text: 'Transformer des besoins concrets en méthodes, prototypes et ressources documentées et réutilisables.', illustration: publicIllustrations.innovation },
  { key: 'education', title: 'Éducation & formation', short: 'Apprendre et progresser', text: 'Des actions pédagogiques qui développent l’autonomie, la confiance et les compétences utiles.', illustration: publicIllustrations.education },
  { key: 'insertion', title: 'Insertion & compétences', short: 'Construire son parcours', text: 'Orientation, professionnalisation, accompagnement et passerelles vers l’activité et l’emploi.', illustration: publicIllustrations.insertion },
  { key: 'culture', title: 'Culture', short: 'Créer et partager', text: 'Expression, découverte, transmission et projets culturels ancrés dans les territoires.', illustration: publicIllustrations.culture },
  { key: 'sport', title: 'Sport', short: 'Bouger et se construire', text: 'Le mouvement comme levier de santé, de discipline, de confiance et de lien social.', illustration: publicIllustrations.sport },
]

const capabilities = [
  ['01', 'Comprendre', 'Qualifier le besoin, le public et les contraintes avant de proposer une solution.'],
  ['02', 'Concevoir', 'Assembler les compétences, le numérique, les partenaires et les ressources utiles.'],
  ['03', 'Déployer', 'Mettre en œuvre sur le terrain avec un cadre, des responsabilités et des échéances claires.'],
  ['04', 'Mesurer', 'Documenter les résultats, capitaliser et améliorer les prochaines itérations.'],
]
</script>

<template>
  <div>
    <section class="public-hero future-hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Association IFICS · France</p>
          <h1 class="display-title">Des solutions utiles pour les territoires.</h1>
          <p class="lead hero-lead">IFICS réunit <strong>éducation, numérique & IT, insertion, culture, sport et innovation</strong> pour transformer des besoins concrets en projets durables.</p>
          <div class="hero-actions">
            <NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet</NuxtLink>
            <NuxtLink to="/actions" class="btn btn-secondary">Découvrir nos expertises</NuxtLink>
          </div>
          <div class="hero-proof" aria-label="Positionnement IFICS">
            <span>Terrain</span><i aria-hidden="true" />
            <span>Technologie</span><i aria-hidden="true" />
            <span>Transmission</span><i aria-hidden="true" />
            <span>Impact</span>
          </div>
        </div>
        <div class="hero-media hero-media-modern">
          <img class="hero-image" :src="publicVisuals.home" alt="Équipe IFICS construisant un projet pluridisciplinaire">
          <div class="hero-note">
            <span class="hero-note-label">Notre approche</span>
            <strong>Du besoin au déploiement.</strong>
            <span>Des projets lisibles, mesurables et documentés.</span>
          </div>
        </div>
      </div>
    </section>

    <section class="public-band section-compact" aria-labelledby="domains-title">
      <div class="container domain-strip modern-domain-strip">
        <div id="domains-title" class="domain-strip-title">Nos expertises</div>
        <NuxtLink v-for="domain in domains" :key="domain.key" to="/actions" class="domain-chip">
          <strong>{{ domain.title }}</strong>
          <span>{{ domain.short }}</span>
        </NuxtLink>
      </div>
    </section>

    <section class="section expertise-section">
      <div class="container">
        <div class="section-intro-grid">
          <div><p class="eyebrow">Une organisation pluridisciplinaire</p><h2 class="section-title">Le terrain et la technologie dans la même démarche.</h2></div>
          <p class="lead">IFICS ne sépare pas le numérique des enjeux humains. Un même projet peut combiner accompagnement, développement logiciel, formation, activité collective et expérimentation.</p>
        </div>
        <div class="domain-visual-grid">
          <article v-for="(domain, index) in domains" :key="domain.key" class="domain-visual-card">
            <div class="domain-visual-icon"><img :src="domain.illustration" alt="" loading="lazy"></div>
            <div class="domain-visual-copy"><span class="theme-card-index">0{{ index + 1 }}</span><h3>{{ domain.title }}</h3><p>{{ domain.text }}</p></div>
          </article>
        </div>
      </div>
    </section>

    <section class="section digital-section">
      <div class="container digital-grid">
        <div class="digital-copy">
          <p class="eyebrow">Numérique & IT</p>
          <h2 class="section-title">Concevoir des outils qui simplifient vraiment le travail.</h2>
          <p class="lead">Développement d’applications, outils internes, automatisation, gestion de parc, accompagnement aux usages et ressources pédagogiques : le numérique est un pôle à part entière d’IFICS.</p>
          <div class="digital-tags"><span>Logiciels métiers</span><span>Développement web</span><span>Automatisation</span><span>Parc IT</span><span>Formation numérique</span><span>Documentation</span></div>
          <div class="hero-actions"><NuxtLink to="/logiciels" class="btn btn-primary">Logiciels & ressources</NuxtLink><NuxtLink to="/innovation" class="btn btn-secondary">Innovation & R&D</NuxtLink></div>
        </div>
        <div class="technology-panel" aria-label="Cycle numérique IFICS">
          <div class="technology-head"><span>IFICS / DIGITAL</span><strong>BUILD · TEST · DOCUMENT</strong></div>
          <div class="technology-flow"><div><b>01</b><span>Besoin</span></div><div><b>02</b><span>Prototype</span></div><div><b>03</b><span>Déploiement</span></div><div><b>04</b><span>Amélioration</span></div></div>
          <img :src="publicIllustrations.resources" alt="" loading="lazy">
        </div>
      </div>
    </section>

    <section class="section method-section">
      <div class="container">
        <p class="eyebrow">Notre méthode</p>
        <div class="section-intro-grid"><h2 class="section-title">Une méthode simple, du besoin aux résultats.</h2><p class="lead">Une structure claire permet de travailler avec des collectivités, associations, entreprises, établissements et partenaires techniques sans perdre de vue le public final.</p></div>
        <div class="method-grid"><article v-for="item in capabilities" :key="item[0]"><span>{{ item[0] }}</span><h3>{{ item[1] }}</h3><p>{{ item[2] }}</p></article></div>
      </div>
    </section>

    <section v-if="projects.length" class="section project-section">
      <div class="container">
        <div class="section-row"><div><p class="eyebrow">Projets</p><h2 class="section-title">Des réalisations suivies et documentées.</h2></div><NuxtLink to="/projets" class="btn btn-secondary">Voir les projets</NuxtLink></div>
        <div class="grid grid-3"><article v-for="project in projects" :key="project.id" class="card media-card"><img class="media-card-image" :src="project.imageUrl || visualForDomain(`${project.title} ${project.summary}`)" :alt="project.title" loading="lazy"><div class="media-card-body"><span class="badge">{{ project.status || 'Projet IFICS' }}</span><h3>{{ project.title }}</h3><p>{{ project.summary }}</p><small v-if="project.territory" class="muted">{{ project.territory }}</small></div></article></div>
      </div>
    </section>

    <section v-if="news.length" class="section news-section">
      <div class="container"><div class="section-row"><div><p class="eyebrow">Actualités & publications</p><h2 class="section-title">Partager ce qui mérite de l’être.</h2></div><NuxtLink to="/actualites" class="btn btn-secondary">Toutes les actualités</NuxtLink></div><div class="grid grid-3"><article v-for="item in news" :key="item.id" class="card card-pad news-card"><span class="badge badge-muted">Actualité</span><h3>{{ item.title }}</h3><p>{{ item.excerpt }}</p><NuxtLink class="media-card-link" :to="`/actualites/${item.slug}`">Lire la publication</NuxtLink></article></div></div>
    </section>

    <section class="section partner-section">
      <div class="container partner-final-grid">
        <div><p class="eyebrow">Coopérations</p><h2 class="section-title">Construire avec les acteurs du territoire.</h2><p class="lead">Collectivités, associations, établissements, entreprises, mécènes et partenaires techniques peuvent construire une action avec IFICS.</p><div v-if="partners.length" class="partner-list"><a v-for="partner in partners" :key="partner.id" :href="partner.websiteUrl || undefined" class="partner-chip" :aria-label="partner.websiteUrl ? `Site de ${partner.name}` : partner.name"><img v-if="partner.logoUrl" :src="partner.logoUrl" alt=""><span>{{ partner.name }}</span></a></div></div>
        <div class="cta-panel partner-cta"><div><span class="cta-kicker">Construisons la suite</span><h2>Un besoin, une idée ou un défi à traiter ?</h2><p>Présentez-nous le contexte. Nous qualifierons la demande avant de proposer un format.</p></div><div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-secondary">Proposer un projet</NuxtLink><NuxtLink to="/contact" class="btn btn-ghost-light">Nous contacter</NuxtLink></div></div>
      </div>
    </section>
  </div>
</template>
