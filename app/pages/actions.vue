<script setup lang="ts">
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Nos actions' })

const actions = [
  { title: 'Éducation', text: 'Ateliers pédagogiques, accompagnement, transmission de méthodes et développement de l’autonomie.', image: publicVisuals.education },
  { title: 'Sport', text: 'Pratiques sportives comme leviers de santé, de discipline, de confiance et de cohésion.', image: publicVisuals.sport },
  { title: 'Culture', text: 'Création, expression, découverte artistique et mise en valeur des parcours et des territoires.', image: publicVisuals.culture },
  { title: 'Numérique', text: 'Inclusion numérique, compréhension des outils, développement logiciel et accompagnement aux usages.', image: publicVisuals.numerique },
  { title: 'Insertion', text: 'Compétences, orientation, professionnalisation et projets favorisant l’accès à l’activité.', image: publicVisuals.insertion },
  { title: 'Citoyenneté & lien social', text: 'Actions collectives favorisant le partage, la coopération et la participation.', image: publicVisuals.citoyennete },
  { title: 'Innovation & R&D', text: 'Expérimentation pédagogique et technique, prototypes, recherche appliquée et ressources ouvertes.', image: publicVisuals.innovation },
]
</script>

<template>
  <div>
    <section class="section actions-hero">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Nos actions</p>
          <h1 class="display-title">Des disciplines complémentaires pour répondre aux besoins du terrain.</h1>
          <p class="lead">IFICS mobilise différents leviers selon le public, le territoire et l’objectif : apprendre, bouger, créer, comprendre, s’insérer, coopérer et expérimenter.</p>
          <ul class="feature-list">
            <li><span><strong>Des formats adaptables</strong><br>Atelier ponctuel, cycle régulier, stage ou projet long.</span></li>
            <li><span><strong>Un cadre co-construit</strong><br>Le public, les objectifs et les contraintes du territoire guident le dispositif.</span></li>
            <li><span><strong>Un suivi utile</strong><br>Chaque action peut être documentée et évaluée avec le partenaire.</span></li>
          </ul>
        </div>
        <div class="split-media"><img :src="publicVisuals.actions" alt="Plusieurs domaines d’intervention réunis dans une même démarche"></div>
      </div>
    </section>

    <section class="section action-list-section">
      <div class="container">
        <p class="eyebrow">Domaines d’intervention</p>
        <h2 class="section-title">Des expertises qui peuvent se combiner dans un même projet.</h2>
        <div class="grid grid-3 theme-grid">
          <article v-for="(action, index) in actions" :key="action.title" class="card theme-card">
            <img :src="action.image" :alt="`Illustration ${action.title}`" loading="lazy">
            <div class="theme-card-content">
              <span class="theme-card-index">0{{ index + 1 }}</span>
              <h2>{{ action.title }}</h2>
              <p>{{ action.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="section-compact">
      <div class="container cta-panel">
        <div><h2>Vous avez un besoin sur votre territoire ?</h2><p>Décrivez le contexte, le public et l’objectif. L’équipe IFICS qualifiera la demande avec vous avant de construire la solution.</p></div>
        <NuxtLink to="/proposer-un-projet" class="btn btn-secondary">Proposer un projet</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.actions-hero { background: #fff; }
.action-list-section { background: #f3f6f4; }
@media (max-width: 640px) { .actions-hero { padding-top: 44px; } }
</style>
