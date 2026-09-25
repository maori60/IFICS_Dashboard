<script setup lang="ts">
import { publicIllustrations, publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Nos actions' })

const actions = [
  { title: 'Numérique & IT', text: 'Développement logiciel, outils métiers, automatisation, gestion de parc, accompagnement aux usages et formation numérique.', illustration: publicIllustrations.numerique },
  { title: 'Innovation & R&D', text: 'Expérimentation technique et pédagogique, prototypes, recherche appliquée, tests et documentation réutilisable.', illustration: publicIllustrations.innovation },
  { title: 'Éducation & formation', text: 'Ateliers pédagogiques, accompagnement, transmission de méthodes et développement de l’autonomie.', illustration: publicIllustrations.education },
  { title: 'Insertion & compétences', text: 'Compétences, orientation, professionnalisation et projets favorisant l’accès à l’activité et à l’emploi.', illustration: publicIllustrations.insertion },
  { title: 'Culture', text: 'Création, expression, découverte artistique et mise en valeur des parcours et des territoires.', illustration: publicIllustrations.culture },
  { title: 'Sport', text: 'Pratiques sportives comme leviers de santé, de discipline, de confiance et de cohésion.', illustration: publicIllustrations.sport },
  { title: 'Citoyenneté & lien social', text: 'Actions collectives favorisant le partage, la coopération, l’autonomie et la participation.', illustration: publicIllustrations.association },
]
</script>

<template>
  <div>
    <section class="section actions-hero">
      <div class="container split-section">
        <div class="split-copy"><p class="eyebrow">Nos actions</p><h1 class="display-title">Des compétences complémentaires pour agir concrètement.</h1><p class="lead">IFICS associe pratiques de terrain, compétences numériques et ingénierie de projet. Le format dépend du besoin : accompagnement, développement, formation, atelier, stage, expérimentation ou projet long.</p><div class="hero-actions"><NuxtLink to="/proposer-un-projet" class="btn btn-primary">Présenter un besoin</NuxtLink><NuxtLink to="/logiciels" class="btn btn-secondary">Découvrir le pôle numérique</NuxtLink></div></div>
        <div class="split-media"><img :src="publicVisuals.actions" alt="Équipe IFICS travaillant sur un projet pluridisciplinaire"></div>
      </div>
    </section>

    <section class="section action-list-section">
      <div class="container"><div class="section-intro-grid"><div><p class="eyebrow">Domaines d’intervention</p><h2 class="section-title">Des expertises qui se combinent selon le projet.</h2></div><p class="lead">Le numérique et l’IT ne sont pas un service annexe : ils font partie des leviers mobilisés par IFICS au même titre que l’éducation, l’insertion, la culture ou le sport.</p></div><div class="domain-visual-grid action-domain-grid"><article v-for="(action, index) in actions" :key="action.title" class="domain-visual-card"><div class="domain-visual-icon"><img :src="action.illustration" alt="" loading="lazy"></div><div class="domain-visual-copy"><span class="theme-card-index">0{{ index + 1 }}</span><h2>{{ action.title }}</h2><p>{{ action.text }}</p></div></article></div></div>
    </section>

    <section class="section-compact"><div class="container cta-panel"><div><span class="cta-kicker">Votre contexte d’abord</span><h2>Vous avez un besoin sur votre territoire ?</h2><p>Décrivez le public, le contexte et l’objectif. IFICS construira ensuite le format adapté.</p></div><NuxtLink to="/proposer-un-projet" class="btn btn-secondary">Proposer un projet</NuxtLink></div></section>
  </div>
</template>
