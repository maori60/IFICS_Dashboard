<script setup lang="ts">
import type { ApiSuccess, PublicPartner } from '~/types/api'
import { publicVisuals } from '~/utils/publicVisuals'

useHead({ title: 'Partenaires & mécénat' })
const { data } = await useFetch<ApiSuccess<PublicPartner[]>>('/api/public/partners')
const partners = computed(() => data.value?.data ?? [])
</script>

<template>
  <div>
    <section class="section partner-hero">
      <div class="container split-section reverse">
        <div class="split-copy">
          <p class="eyebrow">Partenariats & mécénat</p>
          <h1 class="display-title">Construire des coopérations utiles et durables.</h1>
          <p class="lead">IFICS travaille avec des collectivités, institutions, associations, entreprises, mécènes et partenaires techniques. Chaque coopération est construite autour d’un objectif clair, d’un public et d’un territoire.</p>
          <div class="hero-actions"><NuxtLink to="/contact" class="btn btn-primary">Nous proposer un partenariat</NuxtLink><NuxtLink to="/proposer-un-projet" class="btn btn-secondary">Proposer un projet</NuxtLink></div>
        </div>
        <div class="split-media"><img :src="publicVisuals.partners" alt="Coopération entre partenaires autour d’un projet IFICS"></div>
      </div>
    </section>

    <section class="section-compact partner-modes">
      <div class="container grid grid-4">
        <article class="card card-pad"><span class="kicker">Compétences</span><h2>Mobiliser une expertise</h2><p>Mettre à disposition des compétences utiles à un projet ou à un public.</p></article>
        <article class="card card-pad"><span class="kicker">Matériel</span><h2>Apporter des ressources</h2><p>Contribuer par du matériel, des équipements ou des moyens logistiques.</p></article>
        <article class="card card-pad"><span class="kicker">Financement</span><h2>Soutenir une action</h2><p>Participer au financement d’un programme clairement identifié et suivi.</p></article>
        <article class="card card-pad"><span class="kicker">Coopération</span><h2>Construire dans la durée</h2><p>Associer plusieurs acteurs autour d’un objectif commun sur le territoire.</p></article>
      </div>
    </section>

    <section class="section published-partners">
      <div class="container">
        <p class="eyebrow">Ils agissent avec nous</p>
        <h2 class="section-title">Partenaires publiés</h2>
        <div v-if="partners.length" class="grid grid-3">
          <article v-for="partner in partners" :key="partner.id" class="card card-pad partner-card">
            <div class="partner-logo"><img v-if="partner.logoUrl" :src="partner.logoUrl" :alt="`Logo ${partner.name}`"><span v-else>{{ partner.name.slice(0, 1) }}</span></div>
            <span v-if="partner.category" class="badge">{{ partner.category }}</span>
            <h3>{{ partner.name }}</h3>
            <p>{{ partner.description }}</p>
            <a v-if="partner.websiteUrl" class="media-card-link" :href="partner.websiteUrl" target="_blank" rel="noopener noreferrer">Site du partenaire</a>
          </article>
        </div>
        <div v-else class="empty-state">Les partenaires ayant autorisé leur affichage apparaîtront ici.</div>
      </div>
    </section>

    <section class="section-compact">
      <div class="container cta-panel">
        <div><h2>Vous souhaitez soutenir ou co-construire une action ?</h2><p>Présentez votre structure, le type de contribution envisagé et le domaine dans lequel vous souhaitez vous engager.</p></div>
        <NuxtLink to="/contact" class="btn btn-secondary">Contacter IFICS</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.partner-hero { background: #fff; }
.partner-modes { background: #f3f6f4; border-block: 1px solid #e5ece7; }
.partner-modes h2 { margin: 9px 0; font-size: 1.05rem; }
.partner-modes p, .partner-card p { color: var(--ifics-muted); margin-bottom: 0; }
.published-partners { background: #fafcfa; }
.partner-card { min-height: 100%; }
.partner-logo { width: 82px; height: 58px; display: grid; place-items: center; margin-bottom: 16px; border-radius: 10px; background: #f5f8f6; border: 1px solid var(--ifics-border); color: var(--ifics-green-800); font-size: 1.4rem; font-weight: 700; }
.partner-logo img { max-width: 70px; max-height: 46px; object-fit: contain; }
.partner-card h3 { margin: 12px 0 7px; }
</style>
