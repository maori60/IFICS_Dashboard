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
      <div class="header-container header-inner">
        <NuxtLink to="/" class="public-brand" aria-label="IFICS — accueil">
          <span class="brand-symbol">
            <img v-if="logoAvailable" :src="publicLogoUrl" alt="" @error="logoAvailable = false">
            <span v-else class="brand-mark" aria-hidden="true">I</span>
          </span>
          <span class="brand-copy">
            <strong>IFICS</strong>
            <small>Institut Français pour l'intégration par la culture et le sport</small>
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
.skip-link { position: fixed; left: 12px; top: -60px; z-index: 9999; background: #fff; padding: 10px 14px; border-radius: 8px; }
.skip-link:focus { top: 12px; }
.public-header { position: sticky; top: 0; z-index: 100; background: #fff; border-bottom: 1px solid #e2e9e4; }
.header-container { width: min(1380px, calc(100% - 40px)); margin: 0 auto; }
.header-inner { min-height: 70px; display: flex; align-items: center; gap: 18px; }
.public-brand { display: flex; align-items: center; gap: 9px; text-decoration: none; min-width: 218px; flex: 0 0 auto; }
.brand-symbol { width: 36px; height: 36px; display: grid; place-items: center; flex: 0 0 auto; }
.brand-symbol img { width: 36px; height: 36px; object-fit: contain; }
.brand-symbol.small, .brand-symbol.small img { width: 32px; height: 32px; }
.brand-copy { display: flex; flex-direction: column; line-height: 1.1; }
.public-brand strong { font-size: 1rem; font-weight: 600; letter-spacing: .02em; }
.public-brand small { color: var(--ifics-muted); font-size: .62rem; max-width: 200px; margin-top: 3px; line-height: 1.2; }
.brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: var(--ifics-green-900); color: #fff; font-weight: 700; }
.brand-mark.small { width: 32px; height: 32px; border-radius: 8px; }
.public-nav { min-width: 0; flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
.nav-links { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 13px; }
.nav-links a { position: relative; color: #435149; font-size: .79rem; font-weight: 600; text-decoration: none; white-space: nowrap; padding: 25px 0 23px; }
.nav-links a::after { content: ''; position: absolute; left: 0; right: 100%; bottom: 17px; height: 2px; background: var(--ifics-green-700); transition: right .16s ease; }
.nav-links a:hover, .nav-links a.active { color: var(--ifics-green-800); }
.nav-links a:hover::after, .nav-links a.active::after { right: 0; }
.nav-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.nav-actions .btn { min-height: 38px; padding: 8px 12px; font-size: .78rem; border-radius: 8px; }
.menu-button { display: none; align-items: center; gap: 7px; border: 1px solid var(--ifics-border); background: #fff; color: var(--ifics-green-900); border-radius: 8px; padding: 9px 12px; font-weight: 600; cursor: pointer; }
.public-footer { margin-top: auto; background: var(--ifics-green-950); color: #eef6f1; }
.footer-top { display: grid; grid-template-columns: 1.7fr repeat(3, 1fr); gap: 50px; padding: 50px 0 38px; }
.footer-brand-line { display: flex; align-items: center; gap: 10px; font-size: 1.12rem; letter-spacing: .03em; }
.footer-brand p { margin: 16px 0 0; max-width: 370px; color: #b8cbbf; line-height: 1.65; }
.footer-col { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.footer-col strong { margin-bottom: 5px; color: #fff; font-weight: 600; }
.footer-col a { color: #d0e0d6; text-decoration: none; font-size: .9rem; }
.footer-col a:hover { color: #fff; text-decoration: underline; }
.footer-col span { color: #9fb6a8; font-size: .86rem; }
.footer-bottom { min-height: 60px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-top: 1px solid rgba(255,255,255,.1); color: #93aa9c; font-size: .78rem; }
@media (max-width: 1360px) {
  .menu-button { display: inline-flex; margin-left: auto; }
  .public-nav { position: absolute; top: 64px; left: 18px; right: 18px; display: none; flex-direction: column; align-items: stretch; gap: 14px; background: #fff; padding: 16px; border: 1px solid var(--ifics-border); border-radius: 12px; box-shadow: var(--ifics-shadow); }
  .public-nav.open { display: flex; }
  .nav-links { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 3px 12px; align-items: stretch; }
  .nav-links a { padding: 9px 8px; border-radius: 7px; white-space: normal; }
  .nav-links a::after { display: none; }
  .nav-links a:hover, .nav-links a.active { background: var(--ifics-green-50); }
  .nav-actions { border-top: 1px solid var(--ifics-border); padding-top: 12px; }
}
@media (max-width: 760px) {
  .header-container { width: min(100% - 20px, 1380px); }
  .header-inner { min-height: 64px; }
  .public-brand { min-width: 0; }
  .public-brand small { display: none; }
  .public-nav { top: 60px; left: 10px; right: 10px; max-height: calc(100vh - 72px); overflow-y: auto; }
  .nav-links { grid-template-columns: 1fr; }
  .nav-actions { flex-direction: column; align-items: stretch; }
  .nav-actions .btn { width: 100%; }
  .footer-top { grid-template-columns: 1fr; gap: 26px; padding: 42px 0 30px; }
  .footer-col:last-child { grid-column: auto; }
  .footer-bottom { align-items: flex-start; flex-direction: column; justify-content: center; padding: 16px 0; }
}
</style>