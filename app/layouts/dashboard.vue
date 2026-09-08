<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

const route = useRoute()
const menuOpen = ref(false)
const { data: sessionResponse } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me')
const session = computed(() => sessionResponse.value?.data ?? null)
const permissions = computed(() => new Set(session.value?.user.permissions ?? []))
const can = (permission: string) => permissions.value.has('*') || permissions.value.has(permission)

const navigation = computed(() => [
  { label: 'Vue générale', to: '/dashboard', visible: true },
  { label: 'Clients', to: '/dashboard/clients', visible: can('client:read') },
  { label: 'Projets', to: '/dashboard/projects', visible: can('project:read') },
  { label: 'Intervenants', to: '/dashboard/intervenors', visible: can('intervenor:read') },
  { label: 'Bilans', to: '/dashboard/reports', visible: can('report:read') },
  { label: 'Facturation', to: '/dashboard/billing', visible: can('billing:read') },
  { label: 'Support', to: '/dashboard/tickets', visible: can('ticket:read') },
  { label: 'Partenaires', to: '/dashboard/partners', visible: can('partner:read') },
  { label: 'Communication', to: '/dashboard/content', visible: can('content:read') },
  { label: 'R&D', to: '/dashboard/rnd', visible: can('rnd:read') },
  { label: 'Parc IT', to: '/dashboard/assets', visible: can('it:read') },
  { label: 'RH', to: '/dashboard/hr', visible: can('hr:read') },
  { label: 'Système', to: '/dashboard/system', visible: can('audit:read') },
  { label: 'Administration', to: '/dashboard/admin', visible: can('user:manage') || can('settings:manage') || can('audit:read') },
].filter(item => item.visible))

function active(to: string) {
  return to === '/dashboard' ? route.path === to : route.path.startsWith(to)
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}

watch(() => route.fullPath, () => { menuOpen.value = false })
</script>

<template>
  <div class="dashboard-shell">
    <button class="dash-menu" type="button" :aria-expanded="menuOpen" aria-controls="dash-sidebar" @click="menuOpen = !menuOpen">Menu</button>
    <aside id="dash-sidebar" class="dash-sidebar" :class="{ open: menuOpen }">
      <NuxtLink to="/dashboard" class="dash-brand"><span>I</span><div><strong>IFICS</strong><small>Espace sécurisé</small></div></NuxtLink>
      <div class="workspace"><small>Organisation</small><strong>{{ session?.association?.name || 'IFICS' }}</strong><span>{{ session?.user.roleName || 'Compte' }}</span></div>
      <nav aria-label="Navigation espace IFICS">
        <NuxtLink v-for="item in navigation" :key="item.to" :to="item.to" :class="{ active: active(item.to) }">{{ item.label }}</NuxtLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="identity"><strong>{{ session?.user.firstName }} {{ session?.user.lastName }}</strong><span>{{ session?.user.email }}</span></div>
        <button type="button" class="logout" @click="logout">Se déconnecter</button>
        <NuxtLink to="/" class="site-link">Voir le site public</NuxtLink>
      </div>
    </aside>
    <div class="dash-main">
      <header class="dash-top"><div><small>Plateforme de gestion</small><strong>IFICS Platform</strong></div><span class="secure-pill">Session sécurisée</span></header>
      <main class="dash-content"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-shell { min-height: 100vh; display: flex; background: #f4f7f5; }
.dash-sidebar { width: 264px; position: fixed; inset: 0 auto 0 0; z-index: 50; display: flex; flex-direction: column; padding: 20px 16px; background: #102c20; color: #e9f4ed; overflow-y: auto; }
.dash-brand { display: flex; align-items: center; gap: 11px; color: #fff; text-decoration: none; padding: 5px 5px 20px; }
.dash-brand > span { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: #e7f2ea; color: #123b2a; font-weight: 900; }
.dash-brand div { display: flex; flex-direction: column; }
.dash-brand small { color: #9eb5a7; }
.workspace { display: flex; flex-direction: column; gap: 3px; padding: 14px; border: 1px solid #28503b; border-radius: 14px; background: #153526; margin-bottom: 18px; }
.workspace small, .workspace span { color: #98b0a1; font-size: .75rem; }
.dash-sidebar nav { display: flex; flex-direction: column; gap: 4px; }
.dash-sidebar nav a { color: #bdd0c4; text-decoration: none; padding: 10px 12px; border-radius: 10px; font-weight: 680; }
.dash-sidebar nav a:hover, .dash-sidebar nav a.active { color: #fff; background: #1d4933; }
.sidebar-bottom { margin-top: auto; padding-top: 18px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #28503b; }
.identity { display: flex; flex-direction: column; padding: 0 6px; }
.identity span { color: #98b0a1; font-size: .75rem; overflow-wrap: anywhere; }
.logout, .site-link { width: 100%; text-align: left; padding: 9px 11px; border-radius: 9px; border: 1px solid #315940; background: transparent; color: #dbe9df; text-decoration: none; cursor: pointer; }
.dash-main { margin-left: 264px; width: calc(100% - 264px); min-height: 100vh; }
.dash-top { min-height: 70px; padding: 14px 26px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.92); border-bottom: 1px solid var(--ifics-border); position: sticky; top: 0; z-index: 30; }
.dash-top div { display: flex; flex-direction: column; }
.dash-top small { color: var(--ifics-muted); }
.secure-pill { font-size: .75rem; color: #1c6042; background: #edf8f1; border: 1px solid #c9e5d4; padding: 6px 9px; border-radius: 999px; font-weight: 800; }
.dash-content { padding: 30px; }
.dash-menu { display: none; }
@media (max-width: 900px) {
  .dash-sidebar { transform: translateX(-100%); transition: transform .2s ease; width: 278px; max-width: 88vw; }
  .dash-sidebar.open { transform: translateX(0); box-shadow: 0 0 0 100vmax rgba(0,0,0,.28); }
  .dash-main { margin-left: 0; width: 100%; }
  .dash-content { padding: 82px 16px 22px; }
  .dash-top { display: none; }
  .dash-menu { display: inline-flex; position: fixed; z-index: 70; top: 14px; left: 14px; border: 1px solid var(--ifics-border); background: #fff; border-radius: 10px; padding: 9px 12px; font-weight: 800; box-shadow: 0 7px 20px rgba(0,0,0,.08); }
}
</style>
