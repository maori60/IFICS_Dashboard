<script setup lang="ts">
import type { ApiSuccess, PublicPartner } from '~/types/api'

usePublicSeo({
  title: 'Partenaires',
  description: 'IFICS développe des partenariats fondés sur les compétences, les ressources, le financement et la coopération pour construire des projets concrets et durables.',
  path: '/partenaires',
})

const { data } = await useFetch<ApiSuccess<PublicPartner[]>>('/api/public/partners')
const partners = computed(() => data.value?.data ?? [])

const partnershipModes = [
  {
    number: '01',
    icon: '◎',
    title: 'Compétences',
    text: 'Mobiliser une expertise utile à une mission, un projet ou un public.',
  },
  {
    number: '02',
    icon: '◇',
    title: 'Ressources',
    text: 'Contribuer par du matériel, des équipements ou des moyens logistiques.',
  },
  {
    number: '03',
    icon: '↗',
    title: 'Financement',
    text: 'Soutenir un programme identifié, suivi et documenté.',
  },
  {
    number: '04',
    icon: '∞',
    title: 'Coopération',
    text: 'Construire une action dans la durée avec plusieurs acteurs.',
  },
]
</script>

<template>
  <div class="v9-page v9-partners">
    <section class="v9-hero">
      <div class="container v9-hero-grid">
        <div class="v9-hero-copy">
          <p class="v9-eyebrow">Partenariats</p>

          <h1>
            Construire ensemble,<br>
            utilement.
          </h1>

          <p class="v9-lead">
            Collectivités, établissements, associations, entreprises, mécènes
            et partenaires techniques peuvent contribuer à un projet IFICS
            lorsqu’un objectif, un public et un cadre commun sont clairement définis.
          </p>

          <div class="v9-actions">
            <NuxtLink to="/contact" class="v9-btn v9-btn-primary">
              Nous proposer un partenariat
              <span>→</span>
            </NuxtLink>

            <NuxtLink to="/association" class="v9-btn v9-btn-secondary">
              Découvrir IFICS
            </NuxtLink>
          </div>
        </div>

        <div class="v9-partner-map" aria-hidden="true">
          <div class="v9-map-lines">
            <span class="v9-map-line v9-map-line-a" />
            <span class="v9-map-line v9-map-line-b" />
            <span class="v9-map-line v9-map-line-c" />
          </div>

          <div class="v9-map-center">
            <img
              src="/brand/v2/ifics-wordmark-light.png"
              alt=""
            >
          </div>

          <div class="v9-map-node v9-map-node-1">
            <span>⌂</span>
            <strong>Collectivités</strong>
          </div>

          <div class="v9-map-node v9-map-node-2">
            <span>▣</span>
            <strong>Entreprises</strong>
          </div>

          <div class="v9-map-node v9-map-node-3">
            <span>♧</span>
            <strong>Associations</strong>
          </div>

          <div class="v9-map-node v9-map-node-4">
            <span>♡</span>
            <strong>Mécènes</strong>
          </div>

          <div class="v9-map-node v9-map-node-5">
            <span>⚙</span>
            <strong>Partenaires<br>techniques</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="v9-section">
      <div class="container">
        <p class="v9-eyebrow">Quatre formes de partenariat</p>

        <div class="v9-feature-grid v9-feature-grid-4">
          <article
            v-for="mode in partnershipModes"
            :key="mode.number"
            class="v9-feature-card"
          >
            <div class="v9-card-top">
              <span class="v9-feature-icon">{{ mode.icon }}</span>
              <span class="v9-card-number">{{ mode.number }}</span>
            </div>

            <h2>{{ mode.title }}</h2>
            <p>{{ mode.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section
      v-if="partners.length"
      class="v9-section v9-section-published"
    >
      <div class="container">
        <div class="v9-section-heading">
          <div>
            <p class="v9-eyebrow">Écosystème publié</p>
            <h2>Ils agissent avec nous.</h2>
          </div>

          <p>
            Les structures présentées ici sont publiées depuis l’espace
            d’administration IFICS.
          </p>
        </div>

        <div class="v9-published-grid">
          <article
            v-for="partner in partners"
            :key="partner.id"
            class="v9-published-card"
          >
            <div class="v9-published-logo">
              <img
                v-if="partner.logoUrl"
                :src="partner.logoUrl"
                :alt="`Logo ${partner.name}`"
              >
              <span v-else>{{ partner.name.slice(0, 1) }}</span>
            </div>

            <span class="v9-tag">{{ partner.category }}</span>
            <h3>{{ partner.name }}</h3>
            <p>{{ partner.description }}</p>

            <a
              v-if="partner.websiteUrl"
              :href="partner.websiteUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Site du partenaire ↗
            </a>
          </article>
        </div>
      </div>
    </section>

    <section class="v9-bottom-shell">
      <div class="container">
        <div class="v9-bottom-card">
          <div>
            <p class="v9-eyebrow">Un projet commun ?</p>
            <h2>Construisons quelque chose d’utile.</h2>
          </div>

          <div class="v9-bottom-copy">
            <p>
              Présentez votre structure et la contribution envisagée.
              Nous reviendrons vers vous avec un cadre adapté.
            </p>

            <NuxtLink to="/contact" class="v9-btn v9-btn-primary">
              Proposer un partenariat
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
