<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

const route = useRoute()
const menuOpen = ref(false)
const logoAvailable = ref(true)
const publicLogoUrl = '/api/public/branding/logo'
const sessionState = ref<'loading' | 'authenticated' | 'anonymous'>('loading')

const links = [
  { label: 'Association', to: '/association' },
  { label: 'Nos actions', to: '/actions' },
  { label: 'Numérique & IT', to: '/logiciels' },
  { label: 'Projets', to: '/projets' },
  { label: 'Innovation & R&D', to: '/innovation' },
  { label: 'Partenaires', to: '/partenaires' },
  { label: 'Actualités', to: '/actualites' },
]

const secondaryLinks = [
  { label: 'Nous rejoindre', to: '/rejoindre' },
  { label: 'Contact', to: '/contact' },
]

const spaceTarget = computed(() => sessionState.value === 'authenticated' ? '/dashboard' : '/login')
const spaceLabel = computed(() => sessionState.value === 'authenticated' ? 'Retour espace IFICS' : 'Espace IFICS')

onMounted(async () => {
  try {
    const response = await $fetch<ApiSuccess<SessionPayload>>('/api/auth/me')
    sessionState.value = response.data.mfa.setupRequired || (response.data.mfa.enabled && !response.data.mfa.verified)
      ? 'anonymous'
      : 'authenticated'
  }
  catch {
    sessionState.value = 'anonymous'
  }
})

watch(() => route.fullPath, () => { menuOpen.value = false })
</script>

<template>
  <div class="public-shell">
    <a class="skip-link" href="#main-content">Aller au contenu</a>

    <header class="public-header">
      <div class="header-container header-inner">
        <NuxtLink to="/" class="public-brand" aria-label="IFICS — accueil">
          <span class="brand-symbol">
            <img v-if="logoAvailable" :src="publicLogoUrl" alt="" @error="logoAvailable = false">
            <span v-else class="brand-mark" aria-hidden="true">I</span>
          </span>
          <span class="brand-copy">
            <strong>IFICS</strong>
            <small>Territoires · Éducation · Numérique · Innovation</small>
          </span>
        </NuxtLink>

        <button class="menu-button" type="button" :aria-expanded="menuOpen" aria-controls="public-navigation" @click="menuOpen = !menuOpen">
          <span class="menu-lines" aria-hidden="true"><i /><i /><i /></span>
          <span>Menu</span>
        </button>

        <nav id="public-navigation" class="public-nav" :class="{ open: menuOpen }" aria-label="Navigation principale">
          <div class="nav-links">
            <NuxtLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: route.path === link.to }">{{ link.label }}</NuxtLink>
          </div>
          <div class="nav-secondary">
            <NuxtLink v-for="link in secondaryLinks" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
          </div>
          <div class="nav-actions">
            <NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet</NuxtLink>
            <NuxtLink :to="spaceTarget" class="btn btn-secondary">{{ spaceLabel }}</NuxtLink>
          </div>
        </nav>
      </div>
    </header>

    <main id="main-content"><slot /></main>

    <footer class="public-footer">
      <div class="container footer-top">
        <div class="footer-brand">
          <div class="footer-brand-line">
            <span class="brand-symbol small"><img v-if="logoAvailable" :src="publicLogoUrl" alt=""><span v-else class="brand-mark small" aria-hidden="true">I</span></span>
            <div><strong>IFICS</strong><small>Institut Français pour l'intégration par la culture et le sport</small></div>
          </div>
          <p>Des projets et des solutions concrètes pour apprendre, créer, s'insérer, se connecter et innover sur les territoires.</p>
        </div>
        <div class="footer-col"><strong>Découvrir</strong><NuxtLink to="/association">L'association</NuxtLink><NuxtLink to="/actions">Nos actions</NuxtLink><NuxtLink to="/projets">Nos projets</NuxtLink><NuxtLink to="/actualites">Actualités</NuxtLink></div>
        <div class="footer-col"><strong>Numérique</strong><NuxtLink to="/logiciels">Logiciels & ressources</NuxtLink><NuxtLink to="/innovation">Innovation & R&D</NuxtLink><NuxtLink to="/rejoindre">Nous rejoindre</NuxtLink><NuxtLink to="/contact">Contact</NuxtLink></div>
        <div class="footer-col"><strong>Agir avec nous</strong><NuxtLink to="/proposer-un-projet">Proposer un projet</NuxtLink><NuxtLink to="/partenaires">Devenir partenaire</NuxtLink><NuxtLink :to="spaceTarget">{{ spaceLabel }}</NuxtLink><span>Association IFICS · France</span></div>
      </div>
      <div class="container footer-bottom"><span>© {{ new Date().getFullYear() }} IFICS</span><span>Éducation · Numérique & IT · Insertion · Culture · Sport · Innovation & R&D</span></div>
    </footer>
  </div>
</template>
