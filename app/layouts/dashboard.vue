<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

useHead({
  meta: [
    {
      name: 'robots',
      content: 'noindex, nofollow, noarchive',
    },
  ],
})

const route = useRoute()
const menuOpen = ref(false)
const brandingLogoUrl = '/api/public/branding/logo'
const { data: sessionResponse } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me')
const session = computed(() => sessionResponse.value?.data ?? null)
const permissions = computed(() => new Set(session.value?.user.permissions ?? []))
const can = (permission: string) => permissions.value.has('*') || permissions.value.has(permission)

type NavigationItem = {
  label: string
  to: string
  visible: boolean
}

type NavigationSection = {
  label: string
  items: NavigationItem[]
}

const navigationSections = computed<NavigationSection[]>(() => [
  {
    label: 'ACTIVITÉ',
    items: [
      { label: 'Clients', to: '/dashboard/clients', visible: can('client:read') },
      { label: 'Projets', to: '/dashboard/projects', visible: can('project:read') },
      { label: 'Bilans', to: '/dashboard/reports', visible: can('report:read') },
      {
        label: 'CRA',
        to: '/dashboard/cra',
        visible:
          can('cra:read:all')
          || (
            can('cra:read:own')
            && Boolean(session.value?.user.intervenorId)
          ),
      },
      { label: 'Support', to: '/dashboard/tickets', visible: can('ticket:read') },
    ].filter(item => item.visible),
  },
  {
    label: 'FINANCES & COMPTABILITÉ',
    items: [
      {
        label: 'Facturation',
        to: '/dashboard/billing',
        visible: can('billing:read'),
      },
      {
        label: 'Dépenses',
        to: '/dashboard/expenses',
        visible:
          can('expense:read:all')
          || can('expense:read:own')
          || can('expense:review')
          || can('expense:manage'),
      },
      {
        label: 'Périodes & clôture',
        to: '/dashboard/accounting/periods',
        visible: can('accounting:read'),
      },
    ].filter(item => item.visible),
  },
  {
    label: 'ÉQUIPE INTERNE',
    items: [
      { label: 'RH', to: '/dashboard/hr', visible: can('hr:read') },
    ].filter(item => item.visible),
  },
  {
    label: 'ÉQUIPE EXTERNE',
    items: [
      {
        label: 'Intervenants',
        to: '/dashboard/intervenors',
        visible: can('intervenor:read'),
      },
      {
        label: 'Partenaires',
        to: '/dashboard/partners',
        visible: can('partner:read'),
      },
    ].filter(item => item.visible),
  },
  {
    label: 'RESSOURCES',
    items: [
      {
        label: 'Communication',
        to: '/dashboard/content',
        visible: can('content:read'),
      },
      { label: 'R&D', to: '/dashboard/rnd', visible: can('rnd:read') },
      { label: 'Parc IT', to: '/dashboard/assets', visible: can('it:read') },
    ].filter(item => item.visible),
  },
  {
    label: 'SYSTÈME',
    items: [
      { label: 'Système', to: '/dashboard/system', visible: can('audit:read') },
      {
        label: 'Administration',
        to: '/dashboard/admin',
        visible: can('user:manage') || can('audit:read'),
      },
      {
        label: 'Paramètres',
        to: '/dashboard/settings',
        visible: can('settings:manage'),
      },
    ].filter(item => item.visible),
  },
].filter(section => section.items.length > 0))

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
    <div class="dash-mobile-bar"><NuxtLink to="/dashboard" class="dash-mobile-brand"><img :src="brandingLogoUrl" alt=""><strong>IFICS</strong></NuxtLink><button class="dash-menu" type="button" :aria-expanded="menuOpen" aria-controls="dash-sidebar" @click="menuOpen = !menuOpen">☰ Menu</button></div>
    <aside id="dash-sidebar" class="dash-sidebar" :class="{ open: menuOpen }">
      <NuxtLink to="/dashboard" class="dash-brand"><span class="dash-logo"><img :src="brandingLogoUrl" alt=""></span><div><strong>IFICS</strong><small>Platform</small></div></NuxtLink>
      <div class="workspace"><small>Organisation</small><strong>{{ session?.association?.name || 'IFICS' }}</strong><span>{{ session?.user.roleName || 'Compte' }}</span></div>
      <nav aria-label="Navigation espace IFICS">
        <NuxtLink
          to="/dashboard"
          :class="{ active: active('/dashboard') }"
        >
          Vue générale
        </NuxtLink>

        <section
          v-for="section in navigationSections"
          :key="section.label"
          class="nav-section"
        >
          <p class="nav-section-label">
            {{ section.label }}
          </p>

          <div class="nav-section-links">
            <NuxtLink
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              :class="{ active: active(item.to) }"
            >
              {{ item.label }}
            </NuxtLink>
          </div>
        </section>
      </nav>
      <div class="sidebar-bottom">
        <div class="identity"><strong>{{ session?.user.firstName }} {{ session?.user.lastName }}</strong><span>{{ session?.user.email }}</span></div>
        <button type="button" class="logout" @click="logout">Se déconnecter</button>
        <a href="/" target="_blank" rel="noopener" class="site-link">Voir le site public</a>
      </div>
    </aside>
    <div class="dash-main">
      <header class="dash-top"><div><small>Plateforme de gestion</small><strong>IFICS Platform</strong></div><span class="secure-pill">Session sécurisée</span></header>
      <main class="dash-content"><slot /></main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-shell { min-height:100vh; display:flex; background:#f5f7f6; }
.dash-sidebar { width:252px; position:fixed; inset:0 auto 0 0; z-index:50; display:flex; flex-direction:column; padding:18px 14px; background:#082d20; color:#e9f4ed; overflow-y:auto; border-right:1px solid #174331; }
.dash-brand { display:flex; align-items:center; gap:11px; color:#fff; text-decoration:none; padding:4px 6px 18px; }
.dash-logo { width:42px; height:42px; display:grid; place-items:center; background:#fff; border-radius:11px; overflow:hidden; }
.dash-logo img { width:38px; height:38px; object-fit:contain; }
.dash-brand div { display:flex; flex-direction:column; line-height:1.08; }
.dash-brand strong { font-size:1.03rem; letter-spacing:-.02em; }
.dash-brand small { margin-top:3px; color:#89a798; font-size:.69rem; letter-spacing:.05em; text-transform:uppercase; }
.workspace { display:flex; flex-direction:column; gap:3px; padding:12px 13px; border:1px solid #28523d; border-radius:11px; background:#0d3627; margin-bottom:14px; }
.workspace small,.workspace span { color:#91aa9d; font-size:.71rem; }
.workspace strong { font-size:.9rem; }
.dash-sidebar nav { display:flex; flex-direction:column; gap:2px; }
.nav-section { margin-top:14px; }
.nav-section-label { margin:0 0 5px; padding:0 11px; color:#67907a; font-size:.62rem; font-weight:900; letter-spacing:.1em; }
.nav-section-links { display:flex; flex-direction:column; gap:2px; }
.dash-sidebar nav a { color:#bdd0c4; text-decoration:none; padding:9px 11px; border-radius:8px; font-size:.88rem; font-weight:690; }
.dash-sidebar nav a:hover,.dash-sidebar nav a.active { color:#fff; background:#145039; }
.sidebar-bottom { margin-top:auto; padding-top:15px; display:flex; flex-direction:column; gap:8px; border-top:1px solid #28503b; }
.identity { display:flex; flex-direction:column; padding:0 5px; }
.identity strong { font-size:.88rem; }
.identity span { color:#91aa9d; font-size:.7rem; overflow-wrap:anywhere; }
.logout,.site-link { width:100%; text-align:left; padding:9px 10px; border-radius:8px; border:1px solid #315940; background:transparent; color:#dbe9df; text-decoration:none; cursor:pointer; font-size:.82rem; }
.logout:hover,.site-link:hover { background:#113d2d; }
.dash-main { margin-left:252px; width:calc(100% - 252px); min-height:100vh; }
.dash-top { min-height:66px; padding:12px 28px; display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,.95); border-bottom:1px solid var(--ifics-border); position:sticky; top:0; z-index:30; backdrop-filter:blur(10px); }
.dash-top div { display:flex; flex-direction:column; }
.dash-top small { color:var(--ifics-muted); font-size:.72rem; }
.dash-top strong { font-size:.94rem; }
.secure-pill { font-size:.7rem; color:#1c6042; background:#edf8f1; border:1px solid #c9e5d4; padding:6px 9px; border-radius:999px; font-weight:800; }
.dash-content { width:min(1520px,100%); margin:0 auto; padding:30px; }
.dash-mobile-bar { display:none; }
.dash-menu { border:1px solid var(--ifics-border); background:#fff; border-radius:9px; padding:9px 11px; color:#113d2d; font-weight:800; }
@media (max-width:900px) {
  .dash-mobile-bar { position:fixed; inset:0 0 auto 0; z-index:65; height:62px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,.97); border-bottom:1px solid var(--ifics-border); backdrop-filter:blur(10px); }
  .dash-mobile-brand { display:flex; align-items:center; gap:8px; color:var(--ifics-ink); text-decoration:none; }
  .dash-mobile-brand img { width:36px; height:36px; object-fit:contain; }
  .dash-sidebar { width:278px; max-width:88vw; padding-top:72px; transform:translateX(-100%); transition:transform .2s ease; }
  .dash-sidebar.open { transform:translateX(0); box-shadow:0 0 0 100vmax rgba(0,0,0,.32); }
  .dash-main { margin-left:0; width:100%; }
  .dash-content { padding:82px 14px 24px; }
  .dash-top { display:none; }
}
</style>