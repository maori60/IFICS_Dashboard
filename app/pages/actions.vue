<script setup lang="ts">
import ActionsEnergyField from '~/components/actions/ActionsEnergyField.vue'
usePublicSeo({
  title: 'Nos actions',
  description: 'Découvrez les actions d’IFICS en éducation, inclusion, numérique, sport et culture, conçues pour accompagner les publics et développer des projets utiles aux territoires.',
  path: '/actions',
})

let actionsObserver: IntersectionObserver | undefined

onMounted(() => {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('.actions-v8-reveal'),
  )

  if (
    !('IntersectionObserver' in window)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    cards.forEach(card => card.classList.add('is-visible'))
    return
  }

  actionsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting)
          return

        entry.target.classList.add('is-visible')
        actionsObserver?.unobserve(entry.target)
      })
    },
    {
      threshold: 0.14,
      rootMargin: '0px 0px -6% 0px',
    },
  )

  cards.forEach(card => actionsObserver?.observe(card))
})

onUnmounted(() => {
  actionsObserver?.disconnect()
})
</script>

<template>
  <main class="actions-v8">

    <section class="actions-v8-hero">
      <div class="actions-v8-shell actions-v8-hero-grid">

        <div class="actions-v8-hero-copy">
          <p class="actions-v8-kicker">
            NOS ACTIONS
          </p>

          <h1>
            Trois univers.<br>
            <span>Une même ambition.</span>
          </h1>

          <p class="actions-v8-intro">
            IFICS réunit ingénierie, transmission et pratiques collectives
            autour d'une même idée : transformer un besoin concret en action utile.
          </p>

          <div class="actions-v8-actions">
            <NuxtLink
              to="/proposer-un-projet"
              class="actions-v8-button actions-v8-button-primary"
            >
              Présenter un besoin
              <span aria-hidden="true">→</span>
            </NuxtLink>

            <NuxtLink
              to="/association"
              class="actions-v8-button"
            >
              Découvrir IFICS
            </NuxtLink>
          </div>
        </div>

        <ActionsEnergyField />

      </div>
    </section>

    <section class="actions-v8-universes">
      <div class="actions-v8-shell">

        <header class="actions-v8-section-heading actions-v8-reveal">
          <div>
            <p class="actions-v8-kicker">
              NOS UNIVERS
            </p>

            <h2>
              Des expertises différentes.<br>
              Une logique commune.
            </h2>
          </div>

          <p>
            Chaque pôle répond à son propre terrain d'action.
            Tous partagent la même exigence : construire, transmettre
            et rendre autonome.
          </p>
        </header>

        <div class="actions-v8-grid">

          <article class="actions-v8-card actions-v8-card-tech actions-v8-reveal">
            <header>
              <span>01</span>
              <p>KREATORTECH</p>
            </header>

            <div class="actions-v8-card-icon" aria-hidden="true">
              &lt;/&gt;
            </div>

            <h3>Numérique<br>& ingénierie</h3>

            <p>
              Conseil, support & workplace, développement,
              automatisation, systèmes, réseaux et formation technique.
            </p>

            <div class="actions-v8-tags">
              <span>ITSM</span>
              <span>Full-stack</span>
              <span>Automatisation</span>
            </div>

            <NuxtLink to="/kreatortech">
              Découvrir le pôle <span aria-hidden="true">→</span>
            </NuxtLink>
          </article>

          <article class="actions-v8-card actions-v8-reveal">
            <header>
              <span>02</span>
              <p>ÉDUCATION & INCLUSION</p>
            </header>

            <div class="actions-v8-card-icon" aria-hidden="true">
              +
            </div>

            <h3>Transmettre<br>& accompagner</h3>

            <p>
              Scolarité, développement informatique,
              mathématiques appliquées, méthodologie,
              orientation et montée en compétences.
            </p>

            <div class="actions-v8-tags">
              <span>Scolarité</span>
              <span>Formation</span>
              <span>Insertion</span>
            </div>

            <NuxtLink to="/association">
              Notre approche <span aria-hidden="true">→</span>
            </NuxtLink>
          </article>

          <article class="actions-v8-card actions-v8-reveal">
            <header>
              <span>03</span>
              <p>CULTURE & SPORT</p>
            </header>

            <div class="actions-v8-card-icon" aria-hidden="true">
              ◇
            </div>

            <h3>Créer du lien<br>par la pratique</h3>

            <p>
              Capoeira, culture, sport et projets collectifs
              comme outils de confiance, d'expression,
              de discipline et de cohésion.
            </p>

            <div class="actions-v8-tags">
              <span>Capoeira</span>
              <span>Culture</span>
              <span>Lien social</span>
            </div>

            <NuxtLink to="/contact">
              Échanger avec nous <span aria-hidden="true">→</span>
            </NuxtLink>
          </article>

        </div>
      </div>
    </section>

    <section class="actions-v8-principle">
      <div class="actions-v8-shell actions-v8-principle-grid actions-v8-reveal">

        <div>
          <p class="actions-v8-kicker">
            NOTRE FIL CONDUCTEUR
          </p>

          <h2>
            Comprendre.<br>
            Construire.<br>
            Transmettre.
          </h2>
        </div>

        <div class="actions-v8-principle-flow">
          <div>
            <span>01</span>
            <strong>Comprendre</strong>
            <p>Partir du terrain et du besoin réel.</p>
          </div>

          <i />

          <div>
            <span>02</span>
            <strong>Construire</strong>
            <p>Créer un format adapté au contexte.</p>
          </div>

          <i />

          <div>
            <span>03</span>
            <strong>Transmettre</strong>
            <p>Documenter, accompagner et rendre autonome.</p>
          </div>
        </div>

      </div>
    </section>

    <section class="actions-v8-cta">
      <div class="actions-v8-shell">
        <div class="actions-v8-cta-panel actions-v8-reveal">

          <div>
            <p class="actions-v8-kicker">
              VOTRE CONTEXTE D'ABORD
            </p>

            <h2>Vous avez un besoin à transformer en projet ?</h2>
          </div>

          <p>
            Donnez-nous le contexte, le public et l'objectif.
            Nous construirons ensuite le format adapté.
          </p>

          <NuxtLink
            to="/proposer-un-projet"
            class="actions-v8-button actions-v8-button-primary"
          >
            Proposer un projet
            <span aria-hidden="true">→</span>
          </NuxtLink>

        </div>
      </div>
    </section>

  </main>
</template>
