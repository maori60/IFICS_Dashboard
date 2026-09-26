<script setup lang="ts">
usePublicSeo({
  title: 'KREATORTECH — Prestations IT & ingénierie',
  description: 'KREATORTECH accompagne les entreprises sur leurs besoins IT : support & workplace, ITSM, systèmes & réseaux, développement, automatisation, data et transfert de compétences.',
  path: '/kreatortech',
})

const serviceHealth = ref('99.8')
const workflowCount = ref(12)
const automationState = ref('Active')

let liveTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  const healthValues = ['99.8', '99.9', '99.7', '100', '99.9', '99.8']
  const workflowValues = [12, 13, 14, 13, 15, 14]

  let tick = 0

  liveTimer = setInterval(() => {
    tick = (tick + 1) % healthValues.length

    serviceHealth.value = healthValues[tick] ?? '99.8'
    workflowCount.value = workflowValues[tick] ?? 12
    automationState.value = tick === 3 ? 'Syncing' : 'Active'
  }, 2200)
})

onUnmounted(() => {
  if (liveTimer) {
    clearInterval(liveTimer)
  }
})

const expertises = [
  {
    number: '01',
    title: 'Support & Workplace',
    short: 'Parc · Support · Onboarding · Comptes',
    description:
      'Accompagnement des environnements utilisateurs, support N1/N2, postes de travail, comptes, logiciels, périphériques et intégration.',
    size: 'wide',
  },
  {
    number: '02',
    title: 'Systèmes & réseaux',
    short: 'Infrastructure · Réseau · Incidents',
    description:
      'Diagnostic, configuration, exploitation de services et investigation d’incidents.',
    size: 'compact',
  },
  {
    number: '03',
    title: 'ITSM',
    short: 'Services · Process · Pilotage',
    description:
      'Qualification des besoins, organisation du support, documentation, suivi d’activité et amélioration continue.',
    size: 'compact',
  },
  {
    number: '04',
    title: 'Développement',
    short: 'Web · API · Applications · Outils métiers',
    description:
      'Développement full-stack, applications internes, API, intégrations et maintenance évolutive.',
    size: 'wide',
  },
  {
    number: '05',
    title: 'Automatisation & data',
    short: 'Scripts · Contrôles · Reporting',
    description:
      'Automatisation des tâches récurrentes, traitement de données, contrôles et industrialisation.',
    size: 'wide',
  },
  {
    number: '06',
    title: 'Formation & transfert',
    short: 'Documentation · Tutoriels · Accompagnement',
    description:
      'Transmission des connaissances, documentation, ateliers et accompagnement de la montée en compétence.',
    size: 'compact',
  },
]

const method = [
  {
    number: '01',
    title: 'Comprendre',
    description: 'Contexte, objectifs, contraintes et niveau de service attendu.',
  },
  {
    number: '02',
    title: 'Cadrer',
    description: 'Périmètre, responsabilités, priorités et critères de réussite.',
  },
  {
    number: '03',
    title: 'Délivrer',
    description: 'Intervention, développement, support, tests et coordination.',
  },
  {
    number: '04',
    title: 'Suivre',
    description: 'Points réguliers, reporting, indicateurs et gestion des écarts.',
  },
  {
    number: '05',
    title: 'Transmettre',
    description: 'Documentation, restitution et transfert de connaissances.',
  },
]

const delivery = [
  {
    number: '01',
    title: 'Régie encadrée',
    description:
      'Un renfort opérationnel intégré à votre environnement, avec objectifs, gouvernance et suivi définis.',
    featured: true,
  },
  {
    number: '02',
    title: 'Forfait',
    description:
      'Un périmètre, des livrables, un planning et des critères de réussite convenus.',
    featured: false,
  },
  {
    number: '03',
    title: 'Mission ciblée',
    description:
      'Audit, développement, automatisation, support ou intervention technique ponctuelle.',
    featured: false,
  },
]
</script>

<template>
  <div class="kt6">
    <!-- HERO -->
    <section class="kt6-hero">
      <div class="kt6-shell kt6-hero-grid">
        <div class="kt6-hero-copy">
          <p class="kt6-kicker">
            KREATORTECH / PÔLE NUMÉRIQUE & INGÉNIERIE
          </p>

          <h1>
            Vos opérations IT.
            <span>Plus simples. Plus fiables. Plus efficaces.</span>
          </h1>

          <p class="kt6-intro">
            KREATORTECH conçoit, déploie et améliore les services numériques
            qui font fonctionner vos équipes : workplace, ITSM,
            infrastructure, développement et automatisation.
          </p>

          <div class="kt6-actions">
            <NuxtLink
              to="/proposer-un-projet"
              class="kt6-button kt6-button-primary"
            >
              Présenter un besoin
              <span aria-hidden="true">→</span>
            </NuxtLink>

            <a
              href="#expertises"
              class="kt6-button kt6-button-ghost"
            >
              Explorer nos expertises
            </a>
          </div>
        </div>

        <KreatortechCommandCenter />
      </div>

      <div class="kt6-shell kt6-proofbar">
        <div>
          <strong>6</strong>
          <span>domaines d’expertise</span>
        </div>

        <div>
          <strong>Direct</strong>
          <span>pilotage technique</span>
        </div>

        <div>
          <strong>42</strong>
          <span>écosystème de talents</span>
        </div>

        <div>
          <strong>B2B</strong>
          <span>prestations professionnelles</span>
        </div>
      </div>
    </section>

    <!-- EXPERTISES -->
    <section
      id="expertises"
      class="kt6-section kt6-expertise-section"
    >
      <div class="kt6-shell">
        <header class="kt6-section-heading">
          <div>
            <p class="kt6-kicker">EXPERTISES</p>
            <h2>
              Une couverture IT conçue
              <span>autour des besoins du terrain.</span>
            </h2>
          </div>

          <p>
            Du support utilisateur au développement d’outils métiers,
            KREATORTECH réunit plusieurs disciplines pour construire un
            périmètre cohérent autour de la mission.
          </p>
        </header>

        <div class="kt6-bento">
          <article
            v-for="expertise in expertises"
            :key="expertise.number"
            class="kt6-expertise"
            :class="`is-${expertise.size}`"
          >
            <div class="kt6-expertise-top">
              <span>{{ expertise.number }}</span>
              <span>KT / {{ expertise.number }}</span>
            </div>

            <div>
              <h3>{{ expertise.title }}</h3>
              <strong>{{ expertise.short }}</strong>
              <p>{{ expertise.description }}</p>
            </div>

            <span
              class="kt6-card-arrow"
              aria-hidden="true"
            >
              ↗
            </span>
          </article>
        </div>
      </div>
    </section>

    <!-- METHOD -->
    <section class="kt6-section kt6-method-section">
      <div class="kt6-shell">
        <header class="kt6-section-heading is-compact">
          <div>
            <p class="kt6-kicker">MÉTHODE D’INTERVENTION</p>
            <h2>
              Du besoin
              <span>à la transmission.</span>
            </h2>
          </div>

          <p>
            Une mission lisible, suivie et documentée du cadrage jusqu’à
            la restitution.
          </p>
        </header>

        <div class="kt6-timeline">
          <article
            v-for="item in method"
            :key="item.number"
            class="kt6-step"
          >
            <span class="kt6-step-number">
              {{ item.number }}
            </span>

            <i aria-hidden="true" />

            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- DELIVERY -->
    <section class="kt6-section kt6-delivery-section">
      <div class="kt6-shell">
        <header class="kt6-section-heading">
          <div>
            <p class="kt6-kicker">MODES D’INTERVENTION</p>
            <h2>
              Le bon format
              <span>pour le bon besoin.</span>
            </h2>
          </div>

          <p>
            Renfort opérationnel, périmètre forfaitisé ou intervention
            ponctuelle : le mode d’intervention dépend du contexte,
            des objectifs et des livrables attendus.
          </p>
        </header>

        <div class="kt6-delivery-grid">
          <article
            v-for="item in delivery"
            :key="item.number"
            class="kt6-delivery-card"
            :class="{ 'is-featured': item.featured }"
          >
            <span>{{ item.number }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- GOVERNANCE -->
    <section class="kt6-section kt6-governance">
      <div class="kt6-shell">
        <header class="kt6-governance-heading">
          <p class="kt6-kicker">GOUVERNANCE TECHNIQUE</p>

          <h2>
            Vos projets sont pilotés
            <span>par des profils techniques.</span>
          </h2>

          <p>
            Une implication directe dans le cadrage, les choix techniques,
            le suivi et la transmission.
          </p>
        </header>

        <div class="kt6-people">
          <article class="kt6-person">
            <div class="kt6-person-photo">
              <img
                src="/images/team/van-bui.webp"
                alt="Van BUI"
              >
            </div>

            <div class="kt6-person-copy">
              <span class="kt6-person-role">
                Pilotage IT / Ingénierie
              </span>

              <h3>Van BUI</h3>

              <p class="kt6-person-skills">
                ITSM · Workplace · Systèmes & réseaux · Développement
              </p>

              <p>
                Parcours École 42, expérience support N1/N2,
                environnements utilisateurs, Linux/Unix, réseau,
                automatisation, développement et structuration de services.
              </p>
            </div>
          </article>

          <article class="kt6-person">
            <div class="kt6-person-photo">
              <img
                src="/images/team/alexandre-payet.webp"
                alt="Alexandre PAYET"
              >
            </div>

            <div class="kt6-person-copy">
              <span class="kt6-person-role">
                Ingénierie / Développement
              </span>

              <h3>Alexandre PAYET</h3>

              <p class="kt6-person-skills">
                Développement · Algorithmie · Formation · Mathématiques
                appliquées
              </p>

              <p>
                Développement, accompagnement technique, pédagogie,
                algorithmique, mathématiques appliquées et suivi
                individualisé.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 42 -->
    <section class="kt6-section kt6-ecosystem">
      <div class="kt6-shell kt6-ecosystem-grid">
        <div>
          <p class="kt6-kicker">ÉCOSYSTÈME & TALENTS</p>

          <h2>
            Un accès complémentaire
            <span>à l’écosystème 42.</span>
          </h2>

          <p>
            Cet écosystème renforce notre capacité à identifier des profils
            IT habitués à apprendre par projets, collaborer et résoudre
            des problématiques techniques.
          </p>
        </div>

        <div class="kt6-sourcing">
          <span>01 / Qualification</span>
          <span>02 / Recherche</span>
          <span>03 / Préqualification</span>
          <span>04 / Proposition</span>
          <span>05 / Cadrage</span>
          <span>06 / Suivi</span>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="kt6-conversion">
      <div class="kt6-shell kt6-conversion-inner">
        <div>
          <p class="kt6-kicker">PARLONS DE VOTRE BESOIN</p>

          <h2>
            Un besoin IT
            <span>à couvrir ?</span>
          </h2>

          <p>
            Support, développement, infrastructure, automatisation ou
            renfort de compétences : commençons par qualifier votre
            contexte.
          </p>
        </div>

        <NuxtLink
          to="/proposer-un-projet"
          class="kt6-conversion-action"
        >
          <span>Présenter mon besoin</span>
          <strong aria-hidden="true">→</strong>
        </NuxtLink>
      </div>

      <div class="kt6-shell kt6-secondary-links">
        <NuxtLink to="/logiciels">
          Ressources & logiciels
          <span>↗</span>
        </NuxtLink>

        <NuxtLink to="/innovation">
          Innovation & R&D
          <span>↗</span>
        </NuxtLink>

        <NuxtLink to="/contact">
          Contacter KREATORTECH
          <span>↗</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
