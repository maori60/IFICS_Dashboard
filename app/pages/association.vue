<script setup lang="ts">
usePublicSeo({
  title: 'À propos d’IFICS',
  description: 'Découvrez IFICS, une association engagée dans l’éducation, l’inclusion, le numérique, le sport et la culture, avec des projets concrets construits sur le terrain.',
  path: '/association',
})

const values = [
  {
    number: '01',
    icon: '↗',
    title: 'Transmission',
    text: 'Rendre les méthodes, les outils et les connaissances réutilisables au-delà d’une seule action.',
  },
  {
    number: '02',
    icon: '◎',
    title: 'Exigence',
    text: 'Cadrer, suivre, documenter et améliorer ce que nous faisons.',
  },
  {
    number: '03',
    icon: '◌',
    title: 'Inclusion',
    text: 'Construire des formats accessibles à des publics et des parcours différents.',
  },
  {
    number: '04',
    icon: '∞',
    title: 'Coopération',
    text: 'Travailler avec les personnes et les acteurs concernés plutôt que concevoir à leur place.',
  },
]

const vanSkills = [
  'Éducation',
  'Sport',
  'Culture',
  'École 42',
  'Ingénierie IT',
  'Transmission',
]

const alexSkills = [
  'Développement',
  'Algorithmique',
  'Mathématiques',
  'Pédagogie',
  'Documentation',
  'Transmission',
]
</script>

<template>
  <div class="about-v8">

    <!-- HERO -->
    <section class="about-v8-hero">
      <div class="about-v8-shell about-v8-hero-grid">

        <div class="about-v8-hero-copy">
          <p class="about-v8-kicker">
            À propos d’IFICS
          </p>

          <h1>
            Une association<br>
            née du terrain.
          </h1>

          <p class="about-v8-domains">
            Éducation
            <i />
            Inclusion
            <i />
            Culture
            <i />
            Sport
            <i />
            Numérique
          </p>

          <p class="about-v8-intro">
            IFICS accompagne les personnes, les territoires et les
            organisations dans la réalisation de projets utiles, en croisant
            les domaines de l’éducation, de la culture, du sport et du numérique.
          </p>

          <div class="about-v8-actions">
            <NuxtLink
              to="/actions"
              class="about-v8-button about-v8-button-primary"
            >
              Découvrir nos actions
              <span>→</span>
            </NuxtLink>

            <a
              href="#mission"
              class="about-v8-button about-v8-button-secondary"
            >
              Notre mission
            </a>
          </div>
        </div>


        <!-- FLUX & POLES IFICS -->
        <AssociationFluxField />

      </div>
    </section>


    <!-- MISSION -->
    <section
      id="mission"
      class="about-v8-mission"
    >
      <div class="about-v8-shell about-v8-mission-grid">

        <div>
          <p class="about-v8-kicker">
            Notre mission
          </p>

          <h2>
            Des projets concrets,<br>
            un impact durable.
          </h2>
        </div>

        <div class="about-v8-mission-copy">
          <i />

          <p>
            Nous mettons la technologie, la pédagogie et la coopération
            au service des personnes et des territoires, pour créer des
            opportunités et renforcer l’autonomie.
          </p>
        </div>

      </div>
    </section>


    <!-- PILOTAGE -->
    <section class="about-v8-people">
      <div class="about-v8-shell">

        <div class="about-v8-people-heading">
          <div>
            <p class="about-v8-kicker">
              Celles et ceux qui pilotent
            </p>

            <h2>
              Deux parcours,<br>
              une même conviction.
            </h2>
          </div>

          <p>
            Des compétences complémentaires pour comprendre les besoins,
            concevoir des solutions adaptées et accompagner leur mise en œuvre.
          </p>
        </div>


        <div class="about-v8-people-grid">

          <!-- VAN -->
          <article class="about-v8-person-card">
            <header>
              <span class="about-v8-person-icon">●</span>

              <div>
                <h3>Van BUI</h3>
                <p>Président · IFICS</p>
              </div>
            </header>

            <div class="about-v8-tags">
              <span
                v-for="skill in vanSkills"
                :key="skill"
              >
                {{ skill }}
              </span>
            </div>

            <p class="about-v8-person-description">
              Une approche construite autour du besoin humain et opérationnel,
              du terrain à l’ingénierie informatique.
            </p>
          </article>


          <!-- CONNEXION -->
          <div
            class="about-v8-connection"
            aria-hidden="true"
          >
            <div class="about-v8-infinity">
              ∞
            </div>

            <span>Terrain</span>
            <span>Expertise</span>
            <span>Transmission</span>
            <span>Impact</span>
          </div>


          <!-- ALEXANDRE -->
          <article class="about-v8-person-card">
            <header>
              <span class="about-v8-person-icon">●</span>

              <div>
                <h3>Alexandre PAYET</h3>
                <p>Pilotage technique · KREATORTECH</p>
              </div>
            </header>

            <div class="about-v8-tags">
              <span
                v-for="skill in alexSkills"
                :key="skill"
              >
                {{ skill }}
              </span>
            </div>

            <p class="about-v8-person-description">
              Une expertise technique et pédagogique pour concevoir des
              solutions utiles, documentées et transmissibles.
            </p>
          </article>

        </div>
      </div>
    </section>


    <!-- VALEURS -->
    <section class="about-v8-values">
      <div class="about-v8-shell">

        <div class="about-v8-values-heading">
          <p class="about-v8-kicker">
            Nos valeurs
          </p>

          <h2>
            Être utile, exigeant<br>
            et attentif aux personnes.
          </h2>
        </div>

        <div class="about-v8-values-grid">
          <article
            v-for="value in values"
            :key="value.title"
            class="about-v8-value"
          >
            <div class="about-v8-value-top">
              <span>{{ value.number }}</span>
              <i>{{ value.icon }}</i>
            </div>

            <h3>{{ value.title }}</h3>

            <p>{{ value.text }}</p>
          </article>
        </div>

      </div>
    </section>


    <!-- CTA -->
    <section class="about-v8-cta">
      <div class="about-v8-shell">
        <div class="about-v8-cta-panel">

          <div>
            <p class="about-v8-kicker">
              Travailler avec IFICS
            </p>

            <h2>
              Un projet doit être compréhensible<br>
              avant d’être ambitieux.
            </h2>
          </div>

          <div class="about-v8-cta-divider" />

          <div class="about-v8-cta-copy">
            <p>
              Nous partons du contexte, du public, des contraintes et des
              résultats attendus. Nous construisons ensuite le format le plus
              adapté.
            </p>

            <div class="about-v8-actions">
              <NuxtLink
                to="/proposer-un-projet"
                class="about-v8-button about-v8-button-primary"
              >
                Proposer un projet
                <span>→</span>
              </NuxtLink>

              <NuxtLink
                to="/contact"
                class="about-v8-button about-v8-button-secondary"
              >
                Nous contacter
              </NuxtLink>
            </div>
          </div>

        </div>
      </div>
    </section>

  </div>
</template>
