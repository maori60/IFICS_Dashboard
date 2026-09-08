<script setup lang="ts">
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Association' })

const values = [
  ['Transmission', 'Partager des méthodes et des repères qui peuvent être réutilisés au-delà d’une action.'],
  ['Inclusion', 'Construire des formats accessibles à des publics et des parcours différents.'],
  ['Coopération', 'Travailler avec les acteurs du territoire plutôt que concevoir les projets à leur place.'],
  ['Exigence', 'Préparer, suivre et documenter les actions pour progresser dans la durée.'],
]
</script>

<template>
  <div>
    <section class="section association-hero">
      <div class="container split-section reverse">
        <div class="split-copy">
          <p class="eyebrow">L'association IFICS</p>
          <h1 class="display-title">Une association qui relie les compétences, les publics et les territoires.</h1>
          <p class="lead">IFICS conçoit et conduit des actions éducatives, sportives, culturelles, numériques, d’insertion et d’innovation. Chaque projet part d’un besoin identifié et se construit avec les partenaires concernés.</p>
        </div>
        <div class="split-media"><img :src="publicVisuals.association" alt="Coopération entre plusieurs acteurs autour d’un projet IFICS" loading="eager"></div>
      </div>
    </section>

    <section class="section-compact principles-section">
      <div class="container grid grid-3">
        <article class="card card-pad"><span class="kicker">01 · Mission</span><h2>Donner des outils pour agir</h2><p>Apprendre, progresser, s’exprimer, coopérer et gagner en autonomie à travers des projets concrets.</p></article>
        <article class="card card-pad"><span class="kicker">02 · Méthode</span><h2>Construire avec le terrain</h2><p>Partir du contexte local, associer les interlocuteurs utiles et adapter le format aux publics concernés.</p></article>
        <article class="card card-pad"><span class="kicker">03 · Responsabilité</span><h2>Suivre ce que nous faisons</h2><p>Définir des objectifs lisibles, documenter les actions et utiliser les retours pour améliorer les projets suivants.</p></article>
      </div>
    </section>

    <section class="section">
      <div class="container split-section">
        <div class="split-copy">
          <p class="eyebrow">Nos valeurs</p>
          <h2 class="section-title">Être utile, exigeant et attentif aux personnes.</h2>
          <div class="values-grid">
            <div v-for="value in values" :key="value[0]" class="value-item"><strong>{{ value[0] }}</strong><p>{{ value[1] }}</p></div>
          </div>
        </div>
        <div class="split-media"><img :src="publicVisuals.education" alt="Transmission de méthodes et accompagnement éducatif" loading="lazy"></div>
      </div>
    </section>

    <section class="section governance-section">
      <div class="container">
        <p class="eyebrow">Notre manière d’agir</p>
        <h2 class="section-title">Un cadre lisible pour les partenaires et les bénéficiaires.</h2>
        <div class="grid grid-2">
          <article class="card card-pad"><h3>Co-construction</h3><p>Objectifs, public, calendrier, ressources et critères de réussite sont définis avec la structure partenaire.</p></article>
          <article class="card card-pad"><h3>Évaluation</h3><p>Les actions sont suivies et améliorées dans le temps. Les informations internes restent séparées des contenus destinés au public.</p></article>
          <article class="card card-pad"><h3>Traçabilité</h3><p>Les décisions importantes, documents, bilans et validations sont organisés dans une plateforme de gestion unique.</p></article>
          <article class="card card-pad"><h3>Protection des données</h3><p>Les informations professionnelles et administratives ne sont accessibles qu'aux personnes autorisées selon leur rôle.</p></article>
        </div>
        <div class="association-cta"><NuxtLink to="/actions" class="btn btn-primary">Découvrir nos actions</NuxtLink><NuxtLink to="/contact" class="btn btn-secondary">Contacter IFICS</NuxtLink></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.association-hero { background: #fff; }
.principles-section { background: #f3f6f4; border-top: 1px solid #e5ece7; border-bottom: 1px solid #e5ece7; }
.principles-section h2 { margin: 9px 0; font-size: 1.12rem; }
.principles-section p, .governance-section p { color: var(--ifics-muted); margin-bottom: 0; }
.values-grid { display: grid; gap: 20px; margin-top: 28px; }
.value-item { padding-bottom: 18px; border-bottom: 1px solid var(--ifics-border); }
.value-item:last-child { border-bottom: 0; }
.value-item strong { font-size: 1rem; }
.value-item p { margin: 5px 0 0; color: var(--ifics-muted); }
.governance-section { background: #fafcfa; }
.association-cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 30px; }
</style>
