<script setup lang="ts">
import type { ApiSuccess, PublicPartner } from '~/types/api'

usePublicSeo({
  title: 'IFICS — Compétences, innovation et impact local',
  description: 'IFICS développe des projets, des formations et des solutions concrètes à travers le sport, la culture, l’éducation et le numérique. KREATORTECH porte le pôle IT et ingénierie.',
  path: '/',
})

const { data: partnersResponse } = await useFetch<ApiSuccess<PublicPartner[]>>('/api/public/partners')

const partners = computed(() => (partnersResponse.value?.data ?? []).slice(0, 10))

const pillars = [
  {
    number: '01',
    title: 'KREATORTECH',
    subtitle: 'Numérique & ingénierie',
    description: 'Conseil · Ingénierie · Développement',
    to: '/kreatortech',
    image: '/images/site/resources.webp',
    tone: 'tech',
  },
  {
    number: '02',
    title: 'Éducation & inclusion',
    subtitle: 'Transmettre & accompagner',
    description: 'Formation · Accompagnement · Insertion',
    to: '/actions#education',
    image: '/images/site/projects.webp',
    tone: 'education',
  },
  {
    number: '03',
    title: 'Culture & sport',
    subtitle: 'Créer du lien par la pratique',
    description: 'Pratique · Projets · Territoires',
    to: '/actions#culture-sport',
    image: '/images/site/actions.webp',
    tone: 'culture',
  },
]
</script>

<template>
  <div class="home-v3">
    <section class="home-v3-stage">
      <div class="home-v3-hero">
        <div class="home-v3-copy">
          <p class="home-v3-kicker">
            Institut français · Sport · Culture · Éducation · Numérique
          </p>

          <h1>
            Faire grandir<br>
            les compétences.
            <span>
              Construire des solutions<br>
              utiles aux territoires.
            </span>
          </h1>

          <p class="home-v3-manifesto">
            Apprendre, créer, transmettre…
            <em>et rendre utile.</em>
          </p>

          <div class="home-v3-actions">
            <NuxtLink
              to="/association"
              class="home-v3-primary-link"
            >
              Découvrir IFICS
              <span aria-hidden="true">→</span>
            </NuxtLink>

            <NuxtLink
              to="/proposer-un-projet"
              class="home-v3-secondary-link"
            >
              Nous confier un projet
            </NuxtLink>
          </div>
        </div>

        <div
          class="home-v3-photo"
          aria-label="Équipe réunie autour d’un projet"
        >
          <img
            src="/images/site/home.webp"
            alt="Équipe réunie autour d’un projet IFICS"
            fetchpriority="high"
          >
          <div class="home-v3-photo-shade" />
          <p class="home-v3-photo-caption">
            <span>IFICS</span>
            Agir · transmettre · construire
          </p>
        </div>
      </div>

      <div
        class="home-v3-pillars"
        aria-label="Les trois univers IFICS"
      >
        <NuxtLink
          v-for="pillar in pillars"
          :key="pillar.title"
          :to="pillar.to"
          class="home-v3-pillar"
          :class="`is-${pillar.tone}`"
        >
          <img
            :src="pillar.image"
            alt=""
            class="home-v3-pillar-image"
          >

          <div class="home-v3-pillar-overlay" />

          <div class="home-v3-pillar-top">
            <span>{{ pillar.number }}</span>
            <span class="home-v3-pillar-line" />
          </div>

          <div class="home-v3-pillar-content">
            <p>{{ pillar.subtitle }}</p>
            <h2>{{ pillar.title }}</h2>
            <span class="home-v3-pillar-description">
              {{ pillar.description }}
            </span>
          </div>

          <span
            class="home-v3-card-arrow"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24">
              <path d="M5 12h13" />
              <path d="m13 7 5 5-5 5" />
            </svg>
          </span>
        </NuxtLink>
      </div>

      <div
        class="home-v3-metrics"
        aria-label="Repères IFICS"
      >
        <div class="home-v3-metric">
          <strong>2021</strong>
          <span>Création d’IFICS</span>
        </div>

        <div class="home-v3-metric">
          <strong>Des centaines</strong>
          <span>de bénéficiaires accompagnés</span>
        </div>

        <div class="home-v3-metric">
          <strong>42</strong>
          <span>Écosystème & talents IT</span>
        </div>

        <div class="home-v3-metric">
          <strong>B2B</strong>
          <span>Prestations aux organisations</span>
        </div>
      </div>
    </section>

    <section class="section v3-kreator-feature">
      <div class="container v3-kreator-grid">
        <div class="v3-brand-block">
          <img src="/brand/v2/kreatortech-wordmark-light.png?v=20260926-complet" alt="KREATORTECH — Pôle IT, numérique et innovation">
          <p>Le pôle informatique & ingénierie d’IFICS, pensé pour les besoins opérationnels des organisations.</p>
          <NuxtLink to="/kreatortech" class="btn btn-glow">Découvrir KREATORTECH →</NuxtLink>
        </div>
        <div class="v3-services">
          <span>Conseil IT & ITSM</span><span>Support & workplace</span><span>Développement full-stack</span><span>Automatisation & data</span><span>Systèmes & réseaux</span><span>Formation & transfert</span>
        </div>
      </div>
    </section>

    <section v-if="partners.length" class="section v3-proof-content">
      <div class="container">
        <div v-if="partners.length" class="published-partner-row">
          <p class="eyebrow teal">Écosystème</p>
          <div class="partner-list">
            <a v-for="partner in partners" :key="partner.id" :href="partner.websiteUrl || undefined" class="partner-chip">
              <img v-if="partner.logoUrl" :src="partner.logoUrl" alt=""><span>{{ partner.name }}</span>
            </a>
          </div>
        </div>
      </div>
    </section>

    <section class="section-compact v3-final-cta">
      <div class="container final-cta">
        <div><p class="eyebrow teal">Construisons la suite</p><h2>Un besoin, une idée ou un défi à traiter ?</h2></div>
        <div><p>Présentez-nous le contexte. Nous qualifierons la demande avant de proposer le bon format.</p><div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-glow">Proposer un projet</NuxtLink><NuxtLink to="/contact" class="btn btn-ghost-dark">Nous contacter</NuxtLink></div></div>
      </div>
    </section>
  </div>
</template>
