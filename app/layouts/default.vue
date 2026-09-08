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
  { label: 'Projets', to: '/projets' },
  { label: 'Actualités', to: '/actualites' },
  { label: 'Partenaires', to: '/partenaires' },
  { label: 'Innovation & R&D', to: '/innovation' },
  { label: 'Ressources', to: '/logiciels' },
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
          <span class="brand-symbol">
            <img v-if="logoAvailable" :src="publicLogoUrl" alt="" @error="logoAvailable = false">
            <span v-else class="brand-mark" aria-hidden="true">I</span>
          </span>
          <span class="brand-copy">
            <strong>IFICS</strong>
            <small>Institut de formation, d'insertion, de culture et de sport</small>
          </span>
        </NuxtLink>

        <button class="menu-button" type="button" :aria-expanded="menuOpen" aria-controls="public-navigation" @click="menuOpen = !menuOpen">
          <span aria-hidden="true">☰</span> Menu
        </button>

        <nav id="public-navigation" class="public-nav" :class="{ open: menuOpen }" aria-label="Navigation principale">
          <div class="nav-links">
            <NuxtLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: route.path === link.to }">{{ link.label }}</NuxtLink>
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
          <div class="footer-brand-line"><span class="brand-symbol small"><img v-if="logoAvailable" :src="publicLogoUrl" alt=""><span v-else class="brand-mark small" aria-hidden="true">I</span></span><strong>IFICS</strong></div>
          <p>Des projets utiles pour apprendre, s'insérer, créer, coopérer et agir durablement sur les territoires.</p>
        </div>
        <div class="footer-col"><strong>Découvrir</strong><NuxtLink to="/association">L'association</NuxtLink><NuxtLink to="/actions">Nos actions</NuxtLink><NuxtLink to="/projets">Nos projets</NuxtLink><NuxtLink to="/actualites">Actualités</NuxtLink></div>
        <div class="footer-col"><strong>Agir avec nous</strong><NuxtLink to="/proposer-un-projet">Proposer un projet</NuxtLink><NuxtLink to="/partenaires">Devenir partenaire</NuxtLink><NuxtLink to="/rejoindre">Nous rejoindre</NuxtLink><NuxtLink to="/contact">Contact</NuxtLink></div>
        <div class="footer-col"><strong>Accès</strong><NuxtLink :to="spaceTarget">{{ spaceLabel }}</NuxtLink><NuxtLink to="/innovation">Innovation & R&D</NuxtLink><NuxtLink to="/logiciels">Logiciels & ressources</NuxtLink><span>Association IFICS · France</span></div>
      </div>
      <div class="container footer-bottom"><span>© {{ new Date().getFullYear() }} IFICS</span><span>Éducation · Sport · Culture · Numérique · Insertion · Innovation</span></div>
    </footer>
  </div>
</template>

<style scoped>
.public-shell { min-height: 100vh; display: flex; flex-direction: column; }
.skip-link { position: fixed; left: 12px; top: -60px; z-index: 9999; background: #fff; padding: 10px 14px; border-radius: 10px; }
.skip-link:focus { top: 12px; }
.public-header { position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,.94); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(219,229,222,.92); }
.header-inner { min-height: 74px; display: flex; align-items: center; gap: 24px; }
.public-brand { display: flex; align-items: center; gap: 11px; text-decoration: none; min-width: 220px; flex: 0 0 auto; }
.brand-symbol { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 auto; }
.brand-symbol img { width: 42px; height: 42px; object-fit: contain; }
.brand-symbol.small, .brand-symbol.small img { width: 34px; height: 34px; }
.brand-copy { display: flex; flex-direction: column; line-height: 1.1; }
.public-brand strong { font-size: 1.12rem; letter-spacing: .045em; }
.public-brand small { color: var(--ifics-muted); font-size: .68rem; max-width: 195px; margin-top: 4px; line-height: 1.25; }
.brand-mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; background: var(--ifics-green-900); color: #fff; font-weight: 900; }
.brand-mark.small { width: 34px; height: 34px; border-radius: 10px; }
.public-nav { min-width: 0; flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 22px; }
.nav-links { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
.nav-links a { position: relative; color: #435149; font-size: .81rem; font-weight: 700; text-decoration: none; white-space: nowrap; padding: 27px 0 24px; }
.nav-links a::after { content: ''; position: absolute; left: 0; right: 100%; bottom: 18px; height: 2px; background: var(--ifics-green-700); transition: right .18s ease; }
.nav-links a:hover, .nav-links a.active { color: var(--ifics-green-800); }
.nav-links a:hover::after, .nav-links a.active::after { right: 0; }
.nav-actions { display: flex; align-items: center; gap: 9px; flex: 0 0 auto; }
.nav-actions .btn { min-height: 40px; padding: 9px 14px; font-size: .82rem; }
.menu-button { display: none; align-items: center; gap: 7px; border: 1px solid var(--ifics-border); background: #fff; color: var(--ifics-green-900); border-radius: 999px; padding: 9px 13px; font-weight: 750; cursor: pointer; }
.public-footer { margin-top: auto; background: var(--ifics-green-950); color: #eef6f1; }
.footer-top { display: grid; grid-template-columns: 1.7fr repeat(3, 1fr); gap: 54px; padding: 56px 0 42px; }
.footer-brand-line { display: flex; align-items: center; gap: 10px; font-size: 1.25rem; letter-spacing: .05em; }
.footer-brand p { margin: 18px 0 0; max-width: 370px; color: #b8cbbf; line-height: 1.65; }
.footer-col { display: flex; flex-direction: column; align-items: flex-start; gap: 9px; }
.footer-col strong { margin-bottom: 5px; color: #fff; }
.footer-col a { color: #d0e0d6; text-decoration: none; font-size: .92rem; }
.footer-col a:hover { color: #fff; text-decoration: underline; }
.footer-col span { color: #9fb6a8; font-size: .88rem; }
.footer-bottom { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid rgba(255,255,255,.1); color: #93aa9c; font-size: .8rem; }
@media (max-width: 1180px) {
  .menu-button { display: inline-flex; margin-left: auto; }
  .public-nav { position: absolute; top: 66px; left: max(16px, calc((100vw - 1240px) / 2)); right: 16px; display: none; flex-direction: column; align-items: stretch; gap: 16px; background: #fff; padding: 18px; border: 1px solid var(--ifics-border); border-radius: 18px; box-shadow: var(--ifics-shadow); }
  .public-nav.open { display: flex; }
  .nav-links { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 2px 14px; align-items: stretch; }
  .nav-links a { padding: 10px 8px; border-radius: 8px; white-space: normal; }
  .nav-links a::after { display: none; }
  .nav-links a:hover, .nav-links a.active { background: var(--ifics-green-50); }
  .nav-actions { border-top: 1px solid var(--ifics-border); padding-top: 14px; }
  .footer-top { grid-template-columns: 1.5fr repeat(2, 1fr); }
  .footer-col:last-child { grid-column: 2 / -1; }
}
@media (max-width: 760px) {
  .header-inner { min-height: 68px; }
  .public-brand { min-width: 0; }
  .public-brand small { display: none; }
  .public-nav { top: 62px; left: 12px; right: 12px; max-height: calc(100vh - 76px); overflow-y: auto; }
  .nav-links { grid-template-columns: 1fr; }
  .nav-actions { flex-direction: column; align-items: stretch; }
  .nav-actions .btn { width: 100%; }
  .footer-top { grid-template-columns: 1fr; gap: 28px; padding: 44px 0 32px; }
  .footer-col:last-child { grid-column: auto; }
  .footer-bottom { align-items: flex-start; flex-direction: column; justify-content: center; padding: 18px 0; }
}
</style>