<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

const route = useRoute()
const menuOpen = ref(false)
const sessionState = ref<'loading' | 'authenticated' | 'anonymous'>('loading')

const links = [
  { label: 'Association', to: '/association' },
  { label: 'Nos actions', to: '/actions' },
  { label: 'Projets', to: '/projets' },
  { label: 'Actualités', to: '/actualites' },
  { label: 'Partenaires', to: '/partenaires' },
  { label: 'Innovation & R&D', to: '/innovation' },
  { label: 'Logiciels gratuits', to: '/logiciels' },
  { label: 'Nous rejoindre', to: '/rejoindre' },
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
      <div class="container header-inner">
        <NuxtLink to="/" class="public-brand" aria-label="IFICS — accueil">
          <span class="brand-mark" aria-hidden="true">I</span>
          <span><strong>IFICS</strong><small>Institut de formation, d'insertion, de culture et de sport</small></span>
        </NuxtLink>
        <button class="menu-button" type="button" :aria-expanded="menuOpen" aria-controls="public-navigation" @click="menuOpen = !menuOpen">
          Menu
        </button>
        <nav id="public-navigation" class="public-nav" :class="{ open: menuOpen }" aria-label="Navigation principale">
          <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
          <NuxtLink to="/proposer-un-projet" class="btn btn-primary">Proposer un projet</NuxtLink>
          <NuxtLink :to="spaceTarget" class="btn btn-secondary">{{ spaceLabel }}</NuxtLink>
        </nav>
      </div>
    </header>
    <main id="main-content"><slot /></main>
    <footer class="public-footer">
      <div class="container footer-grid">
        <div><strong class="footer-logo">IFICS</strong><p>Éducation · Sport · Culture · Numérique · Insertion · Innovation</p></div>
        <div><strong>Agir avec nous</strong><NuxtLink to="/proposer-un-projet">Proposer un projet</NuxtLink><NuxtLink to="/partenaires">Devenir partenaire</NuxtLink><NuxtLink to="/contact">Contact</NuxtLink></div>
        <div><strong>Accès</strong><NuxtLink :to="spaceTarget">{{ spaceLabel }}</NuxtLink><span>France · Europe/Paris</span></div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.public-shell { min-height: 100vh; display: flex; flex-direction: column; }
.skip-link { position: fixed; left: 12px; top: -60px; z-index: 9999; background: #fff; padding: 10px 14px; border-radius: 10px; }
.skip-link:focus { top: 12px; }
.public-header { position: sticky; top: 0; z-index: 100; background: rgba(246,248,246,.94); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(223,231,226,.85); }
.header-inner { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 22px; }
.public-brand { display: flex; align-items: center; gap: 11px; text-decoration: none; min-width: 225px; }
.public-brand > span:last-child { display: flex; flex-direction: column; line-height: 1.15; }
.public-brand strong { font-size: 1.2rem; letter-spacing: .04em; }
.public-brand small { color: var(--ifics-muted); font-size: .64rem; max-width: 210px; margin-top: 3px; }
.brand-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: var(--ifics-green-900); color: #fff; font-weight: 900; }
.public-nav { display: flex; align-items: center; gap: 17px; }
.public-nav > a:not(.btn) { text-decoration: none; font-size: .86rem; font-weight: 700; color: #425149; }
.public-nav > a:not(.btn):hover { color: var(--ifics-green-700); }
.menu-button { display: none; border: 1px solid var(--ifics-border); background: #fff; border-radius: 10px; padding: 9px 12px; font-weight: 750; }
.public-footer { margin-top: auto; padding: 52px 0; background: var(--ifics-green-950); color: #eaf4ee; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 35px; }
.footer-grid > div { display: flex; flex-direction: column; gap: 9px; }
.footer-grid a { color: #d6e7dc; text-decoration: none; }
.footer-grid p, .footer-grid span { color: #a8bdb0; margin: 0; }
.footer-logo { font-size: 1.5rem; letter-spacing: .06em; }
@media (max-width: 1050px) {
  .menu-button { display: inline-flex; }
  .public-nav { position: absolute; top: 76px; left: 20px; right: 20px; display: none; flex-direction: column; align-items: stretch; background: #fff; padding: 18px; border: 1px solid var(--ifics-border); border-radius: 16px; box-shadow: var(--ifics-shadow); }
  .public-nav.open { display: flex; }
  .footer-grid { grid-template-columns: 1fr; }
}
</style>