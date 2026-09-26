<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

const route = useRoute()
const menuOpen = ref(false)
const sessionState = ref<'loading' | 'authenticated' | 'anonymous'>('loading')

const links = [
  { label: 'Accueil', to: '/' },
  { label: 'L’Institut', to: '/association' },
  { label: 'Nos actions', to: '/actions' },
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
  <div class="public-shell public-v3">
    <a class="skip-link" href="#main-content">Aller au contenu</a>

    <header class="public-header">
      <div class="header-container header-inner">
        <div class="brand-lockup" aria-label="Identités IFICS et KREATORTECH">
          <NuxtLink to="/" class="public-brand ifics-brand" aria-label="IFICS — accueil">
            <img src="/brand/v2/ifics-wordmark-light.png" alt="IFICS — Institut Français Sport & Culture" class="public-brand-wordmark">
          </NuxtLink>
          <span class="brand-divider" aria-hidden="true" />
          <NuxtLink to="/kreatortech" class="public-brand kreator-brand" aria-label="KREATORTECH — pôle IT">
            <img src="/brand/v2/kreatortech-wordmark-light.png" alt="KREATORTECH — Pôle IT, numérique et innovation" class="public-brand-wordmark">
          </NuxtLink>
        </div>

        <button class="menu-button" type="button" :aria-expanded="menuOpen" aria-controls="public-navigation" @click="menuOpen = !menuOpen">
          <span class="menu-lines" aria-hidden="true"><i /><i /><i /></span>
          <span class="menu-label">Menu</span>
        </button>

        <nav id="public-navigation" class="public-nav" :class="{ open: menuOpen }" aria-label="Navigation principale">
          <div class="nav-links">
            <NuxtLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: route.path === link.to }">{{ link.label }}</NuxtLink>
          </div>
          <div class="nav-actions">
            <NuxtLink to="/proposer-un-projet" class="btn btn-glow">Proposer un projet <span aria-hidden="true">→</span></NuxtLink>
            <NuxtLink :to="spaceTarget" class="btn btn-ghost-dark">{{ spaceLabel }}</NuxtLink>
          </div>
        </nav>
      </div>
    </header>

    <main id="main-content"><slot /></main>

    <footer class="public-footer">
      <div class="container footer-brand-lockup footer-dual-brand">
        <img src="/brand/v2/ifics-wordmark-light.png" alt="IFICS">
        <span />
        <img src="/brand/v2/kreatortech-wordmark-light.png" alt="KREATORTECH">
      </div>
      <div class="container footer-top">
        <div class="footer-brand">
          <p class="footer-manifesto">Apprendre. Créer. Transmettre.<br>Construire des solutions utiles.</p>
          <p>IFICS réunit projets de terrain, transmission et ingénierie. KREATORTECH porte l’offre informatique et numérique de l’association.</p>
        </div>
        <div class="footer-col"><strong>IFICS</strong><NuxtLink to="/association">L’Institut</NuxtLink><NuxtLink to="/actions">Nos actions</NuxtLink></div>
        <div class="footer-col"><strong>KREATORTECH</strong><NuxtLink to="/kreatortech">Le pôle IT</NuxtLink><NuxtLink to="/logiciels">Logiciels & ressources</NuxtLink><NuxtLink to="/innovation">Innovation & R&D</NuxtLink><NuxtLink to="/rejoindre">Nous rejoindre</NuxtLink></div>
        <div class="footer-col"><strong>Échanger</strong><NuxtLink to="/proposer-un-projet">Proposer un projet</NuxtLink><NuxtLink to="/partenaires">Partenariats</NuxtLink><NuxtLink to="/contact">Contact</NuxtLink><NuxtLink :to="spaceTarget">{{ spaceLabel }}</NuxtLink></div>
      </div>
      <div class="container footer-bottom"><span>© {{ new Date().getFullYear() }} IFICS France</span><span>Éducation · Inclusion · Culture · Sport · Numérique & ingénierie</span></div>
    </footer>
  </div>
</template>
