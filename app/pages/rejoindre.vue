<script setup lang="ts">
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Nous rejoindre' })

const profiles = [
  ['Salariés', 'Contribuer durablement au pilotage ou à la réalisation des actions.'],
  ['Stagiaires', 'Découvrir un métier en participant à des missions encadrées et concrètes.'],
  ['Alternants', 'Développer ses compétences dans un environnement mêlant terrain et projets.'],
  ['Bénévoles', 'Apporter du temps, une expertise ou une énergie à une action utile.'],
  ['Développeurs', 'Concevoir des outils numériques responsables et réellement utilisables.'],
  ['Formateurs', 'Transmettre des compétences avec une pédagogie adaptée aux publics.'],
  ['Contributeurs R&D', 'Explorer, prototyper et documenter des solutions nouvelles.'],
  ['Chefs de projet', 'Coordonner partenaires, intervenants, calendrier et résultats.'],
]
</script>

<template>
  <div>
    <section class="section join-hero">
      <div class="container split-section reverse">
        <div class="split-copy">
          <p class="eyebrow">Nous rejoindre</p>
          <h1 class="display-title">Mettre ses compétences au service de projets utiles.</h1>
          <p class="lead">IFICS accueille différents profils selon les besoins de ses actions. Les candidatures sont étudiées au regard des missions en cours, des compétences recherchées et du cadre d’accompagnement disponible.</p>
          <div class="hero-actions"><NuxtLink to="/contact" class="btn btn-primary">Présenter votre candidature</NuxtLink><NuxtLink to="/actions" class="btn btn-secondary">Découvrir nos actions</NuxtLink></div>
        </div>
        <div class="split-media"><img :src="publicVisuals.join" alt="Équipe de profils complémentaires réunie autour d’un projet"></div>
      </div>
    </section>

    <section class="section profile-section">
      <div class="container">
        <p class="eyebrow">Profils</p>
        <h2 class="section-title">Différentes façons de contribuer à IFICS.</h2>
        <div class="grid grid-4 profile-grid">
          <article v-for="(profile, index) in profiles" :key="profile[0]" class="card card-pad profile-card"><span class="theme-card-index">0{{ index + 1 }}</span><h2>{{ profile[0] }}</h2><p>{{ profile[1] }}</p></article>
        </div>
      </div>
    </section>

    <section class="section-compact">
      <div class="container split-section">
        <div class="split-copy"><p class="eyebrow">Ce qui compte</p><h2 class="section-title">Un rôle clair, un cadre clair, un objectif utile.</h2><p class="lead">Une candidature n’est pas étudiée uniquement à partir d’un intitulé. Nous regardons le parcours, les compétences, les disponibilités et la manière dont elles peuvent répondre à un besoin concret.</p><ul class="feature-list"><li><span>Une mission comprise avant de commencer.</span></li><li><span>Des responsabilités adaptées au niveau d’autonomie.</span></li><li><span>Un suivi pour capitaliser sur l’expérience.</span></li></ul></div>
        <div class="split-media"><img :src="publicVisuals.numerique" alt="Transmission de compétences dans un environnement numérique" loading="lazy"></div>
      </div>
    </section>

    <section class="section-compact"><div class="container cta-panel"><div><h2>Vous souhaitez contribuer ?</h2><p>Présentez votre parcours, vos compétences, votre disponibilité et le domaine dans lequel vous souhaitez vous engager.</p></div><NuxtLink to="/contact" class="btn btn-secondary">Contacter IFICS</NuxtLink></div></section>
  </div>
</template>

<style scoped>
.join-hero { background: #fff; }
.profile-section { background: #f3f6f4; border-block: 1px solid #e5ece7; }
.profile-card h2 { margin: 8px 0 7px; font-size: 1rem; }
.profile-card p { margin: 0; color: var(--ifics-muted); font-size: .88rem; }
</style>
