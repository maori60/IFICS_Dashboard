<script setup lang="ts">
useHead({ title: 'Nous rejoindre' })

const profiles = [
  {
    number: '01',
    icon: '⌘',
    title: 'Ingénierie & développement',
    text: 'Développement, support, infrastructure, automatisation, data et outils métiers.',
  },
  {
    number: '02',
    icon: '◇',
    title: 'Formation & pédagogie',
    text: 'Développement informatique, mathématiques appliquées, accompagnement et transmission.',
  },
  {
    number: '03',
    icon: '↗',
    title: 'Terrain & projets',
    text: 'Coordination, sport, culture, accompagnement éducatif et actions de territoire.',
  },
  {
    number: '04',
    icon: '＋',
    title: 'Stages & alternance',
    text: 'Apprendre sur des missions concrètes avec un cadre et un suivi identifiés.',
  },
]
</script>

<template>
  <div class="v9-page v9-join">
    <section class="v9-hero">
      <div class="container v9-hero-grid">
        <div class="v9-hero-copy">
          <p class="v9-eyebrow">Nous rejoindre</p>

          <h1>
            Apporter une compétence.<br>
            Apprendre en faisant.
          </h1>

          <p class="v9-lead">
            IFICS mobilise des profils différents selon ses projets.
            Nous recherchons avant tout une compétence utile, un cadre clair
            et une volonté de construire.
          </p>

          <div class="v9-actions">
            <NuxtLink to="/contact" class="v9-btn v9-btn-primary">
              Présenter votre parcours
              <span>→</span>
            </NuxtLink>
          </div>
        </div>

        <div class="v9-join-visual" aria-hidden="true">
          <div class="v9-join-window">
            <div class="v9-window-top">
              <span />
              <span />
              <span />
              <small>IFICS · compétences</small>
            </div>

            <div class="v9-window-body">
              <div class="v9-person-symbol">+</div>

              <div class="v9-person-copy">
                <strong>Une compétence</strong>
                <span>Un projet concret</span>
              </div>

              <div class="v9-skill-bars">
                <span style="--w: 84%" />
                <span style="--w: 62%" />
                <span style="--w: 74%" />
              </div>
            </div>
          </div>

          <div class="v9-floating-pill v9-floating-pill-1">
            Développement
          </div>
          <div class="v9-floating-pill v9-floating-pill-2">
            Transmission
          </div>
          <div class="v9-floating-pill v9-floating-pill-3">
            Terrain
          </div>
        </div>
      </div>
    </section>

    <section class="v9-section">
      <div class="container">
        <div class="v9-section-heading">
          <div>
            <p class="v9-eyebrow">Profils &amp; contributions</p>
            <h2>Plusieurs façons de contribuer.</h2>
          </div>

          <p>
            Les candidatures sont étudiées à partir des besoins réels,
            du niveau d’autonomie et du cadre d’accompagnement disponible.
          </p>
        </div>

        <div class="v9-feature-grid v9-feature-grid-4">
          <article
            v-for="profile in profiles"
            :key="profile.number"
            class="v9-feature-card"
          >
            <div class="v9-card-top">
              <span class="v9-feature-icon">{{ profile.icon }}</span>
              <span class="v9-card-number">{{ profile.number }}</span>
            </div>

            <h2>{{ profile.title }}</h2>
            <p>{{ profile.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="v9-bottom-shell">
      <div class="container">
        <div class="v9-bottom-card">
          <div>
            <p class="v9-eyebrow">Ce qui compte</p>
            <h2>Un rôle clair, un cadre clair, un objectif utile.</h2>
          </div>

          <div class="v9-bottom-copy">
            <p>
              Présentez votre parcours, vos compétences, votre disponibilité
              et le domaine dans lequel vous souhaitez contribuer.
            </p>

            <NuxtLink to="/contact" class="v9-btn v9-btn-primary">
              Nous contacter
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
