<script setup lang="ts">
usePublicSeo({
  title: 'KREATORTECH — Innovation & R&D',
  description: 'KREATORTECH explore, prototype, teste et documente des solutions numériques afin de transformer des besoins métiers en expérimentations concrètes et réutilisables.',
  path: '/innovation',
})

const axes = [
  {
    number: '01',
    icon: '⌘',
    title: 'Explorer',
    text: 'Observer les usages, écouter les personnes concernées et formuler des hypothèses testables.',
  },
  {
    number: '02',
    icon: '◇',
    title: 'Prototyper',
    text: 'Construire rapidement, confronter au réel et ajuster.',
  },
  {
    number: '03',
    icon: '□',
    title: 'Tester',
    text: 'Mesurer, documenter les limites et vérifier la valeur apportée.',
  },
  {
    number: '04',
    icon: '▣',
    title: 'Transmettre',
    text: 'Capitaliser les résultats et publier lorsque la diffusion est pertinente.',
  },
]
</script>

<template>
  <div class="v9-page v9-innovation">
    <section class="v9-hero">
      <div class="container v9-hero-grid">
        <div class="v9-hero-copy">
          <p class="v9-eyebrow">KREATORTECH · Innovation &amp; R&amp;D</p>

          <h1>
            Expérimenter pour<br>
            résoudre.<br>
            Documenter pour<br>
            transmettre.
          </h1>

          <p class="v9-lead">
            L’innovation n’a de valeur que si elle améliore un usage réel
            et peut être comprise, testée et améliorée.
          </p>

          <div class="v9-actions">
            <NuxtLink to="/contact" class="v9-btn v9-btn-primary">
              Échanger avec nous
              <span>→</span>
            </NuxtLink>

            <NuxtLink to="/logiciels" class="v9-btn v9-btn-secondary">
              Voir les ressources
            </NuxtLink>
          </div>
        </div>

        <div class="v9-rnd-visual" aria-hidden="true">
          <svg
            class="v9-rnd-path"
            viewBox="0 0 600 440"
            fill="none"
          >
            <path
              d="M110 180C110 92 233 58 303 130C366 195 286 232 355 286C416 334 506 291 507 208"
            />
            <path
              d="M94 295C149 366 244 356 284 293C327 225 388 206 485 248"
            />
          </svg>

          <div class="v9-rnd-card v9-rnd-card-1">
            <span>♢</span>
            <div>
              <strong>Recherche</strong>
              <small>Exploration d’idées et veille technologique.</small>
            </div>
          </div>

          <div class="v9-rnd-card v9-rnd-card-2">
            <span>△</span>
            <div>
              <strong>Prototypage</strong>
              <small>Tests rapides et itérations sur le terrain.</small>
            </div>
          </div>

          <div class="v9-rnd-card v9-rnd-card-3">
            <span>↗</span>
            <div>
              <strong>Usages réels</strong>
              <small>Confrontation aux besoins et aux contraintes.</small>
            </div>
          </div>

          <div class="v9-rnd-card v9-rnd-card-4">
            <span>▤</span>
            <div>
              <strong>Transmission</strong>
              <small>Documentation et partage des résultats.</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="v9-section">
      <div class="container">
        <p class="v9-eyebrow">Quatre axes d’innovation</p>

        <div class="v9-feature-grid v9-feature-grid-4">
          <article
            v-for="axis in axes"
            :key="axis.number"
            class="v9-feature-card"
          >
            <div class="v9-card-top">
              <span class="v9-feature-icon">{{ axis.icon }}</span>
              <span class="v9-card-number">{{ axis.number }}</span>
            </div>

            <h2>{{ axis.title }}</h2>
            <p>{{ axis.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="v9-bottom-shell">
      <div class="container">
        <div class="v9-bottom-card">
          <div>
            <p class="v9-eyebrow">Du prototype au terrain</p>
            <h2>Une innovation utile doit pouvoir vivre après le test.</h2>
          </div>

          <div class="v9-bottom-copy">
            <p>
              Chaque expérimentation vise un résultat compréhensible,
              documenté et transmissible.
            </p>

            <NuxtLink to="/logiciels" class="v9-btn v9-btn-primary">
              Explorer les ressources
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
