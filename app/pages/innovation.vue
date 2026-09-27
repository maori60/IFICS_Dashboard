<script setup lang="ts">
usePublicSeo({
  title: 'KREATORTECH — Innovation & R&D',
  description: 'KREATORTECH explore, prototype, teste et documente des solutions numériques afin de transformer des besoins métiers en expérimentations concrètes et réutilisables.',
  path: '/innovation',
})

const approach = [
  {
    icon: '⌘',
    title: 'Explorer',
    text: 'Observer les usages',
  },
  {
    icon: '◇',
    title: 'Prototyper',
    text: 'Construire et confronter',
  },
  {
    icon: '□',
    title: 'Tester',
    text: 'Mesurer et ajuster',
  },
  {
    icon: '▣',
    title: 'Transmettre',
    text: 'Documenter et partager',
  },
]

const domains = [
  {
    title: 'Éducation & inclusion',
    text: 'Outils pédagogiques, accessibilité, médiation numérique et accompagnement des usages.',
    image: '/images/innovation/innovation-education.webp',
  },
  {
    title: 'Vie associative',
    text: 'Gestion, collaboration, bénévolat et outils adaptés aux réalités des structures.',
    image: '/images/innovation/innovation-association.webp',
  },
  {
    title: 'Terrain & services',
    text: 'Besoins métiers, outils opérationnels, parcours et simplification des usages.',
    image: '/images/innovation/innovation-terrain.webp',
  },
  {
    title: 'Open source & mutualisation',
    text: 'Partage de ressources, documentation, réutilisation et amélioration collective.',
    image: '/images/innovation/innovation-opensource.webp',
  },
]

const resources = [
  {
    icon: '▤',
    title: 'Guides & tutoriels',
    text: 'Comprendre, reproduire et transmettre.',
    to: '/logiciels',
    image: '/images/innovation/innovation-resource-guides.webp',
  },
  {
    icon: '◫',
    title: 'Retours d’expérience',
    text: 'Capitaliser les enseignements du terrain.',
    to: '/actions',
    image: '/images/innovation/innovation-resource-retours.webp',
  },
  {
    icon: '◇',
    title: 'Outils & modèles',
    text: 'Réutiliser des ressources structurées.',
    to: '/logiciels',
    image: '/images/innovation/innovation-resource-outils.webp',
  },
  {
    icon: '⌁',
    title: 'Veille technologique',
    text: 'Explorer les pratiques et technologies utiles.',
    to: '/kreatortech',
    image: '/images/innovation/innovation-resource-veille.webp',
  },
]
</script>

<template>
  <div class="rnd11-page">

    <section class="rnd11-hero">
      <div class="container rnd11-hero-grid">

        <div class="rnd11-hero-copy">
          <p class="rnd11-eyebrow">
            KREATORTECH · Innovation &amp; R&amp;D
          </p>

          <h1>
            Des expérimentations<br>
            documentées pour<br>
            des <span>usages durables.</span>
          </h1>

          <p class="rnd11-lead">
            Nous concevons, testons et partageons des solutions pour répondre
            à des besoins concrets, avec une documentation complète et une
            volonté de transmission.
          </p>

          <div class="rnd11-actions">
            <NuxtLink to="/actions" class="rnd11-btn rnd11-btn-primary">
              Découvrir nos travaux
              <span aria-hidden="true">→</span>
            </NuxtLink>

            <NuxtLink to="/contact" class="rnd11-btn rnd11-btn-secondary">
              Échanger avec nous
            </NuxtLink>
          </div>
        </div>

        <div class="rnd11-hero-media">
          <img
            src="/images/innovation/innovation-hero.webp"
            alt=""
            width="1600"
            height="290"
          >

          <div class="rnd11-hero-overlay" />


        </div>

      </div>
    </section>


    <section class="rnd11-approach">
      <div class="container">

        <div class="rnd11-approach-head">
          <p class="rnd11-eyebrow">
            Notre approche
          </p>

          <p>
            Une innovation utile part du terrain et produit
            une connaissance transmissible.
          </p>
        </div>

        <div class="rnd11-approach-grid">
          <article
            v-for="item in approach"
            :key="item.title"
            class="rnd11-approach-item"
          >
            <span class="rnd11-approach-icon">
              {{ item.icon }}
            </span>

            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.text }}</small>
            </div>
          </article>
        </div>

      </div>
    </section>


    <section class="rnd11-section rnd11-domains">
      <div class="container">

        <header class="rnd11-section-head">
          <div>
            <p class="rnd11-eyebrow">
              Nos domaines d’expérimentation
            </p>

            <h2>
              Des usages réels.<br>
              Des réponses concrètes.
            </h2>
          </div>

          <p>
            Nos expérimentations croisent besoins de terrain,
            numérique et transmission.
          </p>
        </header>

        <div class="rnd11-domain-grid">
          <article
            v-for="domain in domains"
            :key="domain.title"
            class="rnd11-domain-card"
          >
            <div class="rnd11-domain-image">
              <img
                :src="domain.image"
                :alt="domain.title"
                loading="lazy"
              >

              <div class="rnd11-domain-shade" />
            </div>

            <div class="rnd11-domain-content">
              <div>
                <h3>{{ domain.title }}</h3>
                <p>{{ domain.text }}</p>
              </div>

              <span aria-hidden="true">→</span>
            </div>
          </article>
        </div>

      </div>
    </section>


    <section class="rnd11-section rnd11-resources">
      <div class="container">

        <header class="rnd11-section-head">
          <div>
            <p class="rnd11-eyebrow">
              Ressources &amp; documentation
            </p>

            <h2>
              Documenter pour<br>
              rendre réutilisable.
            </h2>
          </div>

          <p>
            Les expérimentations ont vocation à laisser
            des ressources compréhensibles et transmissibles.
          </p>
        </header>

        <div class="rnd11-resource-grid">
          <NuxtLink
            v-for="resource in resources"
            :key="resource.title"
            :to="resource.to"
            class="rnd11-resource-card"
          >
            <div class="rnd11-resource-visual">
              <img
                :src="resource.image"
                alt=""
                loading="lazy"
                decoding="async"
              >
            </div>

            <span class="rnd11-resource-icon">
              {{ resource.icon }}
            </span>

            <div>
              <h3>{{ resource.title }}</h3>
              <p>{{ resource.text }}</p>
            </div>

            <span class="rnd11-resource-arrow" aria-hidden="true">
              →
            </span>
          </NuxtLink>
        </div>

        <div class="rnd11-resource-action">
          <NuxtLink to="/logiciels" class="rnd11-text-link">
            Voir toutes les ressources
            <span aria-hidden="true">→</span>
          </NuxtLink>
        </div>

      </div>
    </section>


    <section class="rnd11-final">
      <div class="container">

        <div class="rnd11-final-card">

          <div class="rnd11-final-media">
            <img
              src="/images/innovation/innovation-hero.webp"
              alt=""
              loading="lazy"
            >
            <div />
          </div>

          <div class="rnd11-final-copy">
            <p class="rnd11-eyebrow">
              Du prototype au terrain
            </p>

            <h2>
              Une innovation utile doit pouvoir
              <span>vivre après le test.</span>
            </h2>

            <p>
              Chaque expérimentation vise un résultat compréhensible,
              documenté et transmissible.
            </p>

            <NuxtLink to="/logiciels" class="rnd11-btn rnd11-btn-primary">
              Explorer les ressources
              <span aria-hidden="true">→</span>
            </NuxtLink>
          </div>

        </div>

      </div>
    </section>

  </div>
</template>
