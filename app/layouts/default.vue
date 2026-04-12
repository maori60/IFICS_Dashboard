<script setup lang="ts">
const route = useRoute()
const isMobileMenuOpen = ref(false)

type NavigationItem = {
  label: string
  to: string
  disabled?: boolean
}

type NavigationSection = {
  title: string
  items: NavigationItem[]
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

const navigationSections: NavigationSection[] = [
  {
    title: 'Vue générale',
    items: [
      { label: 'Dashboard', to: '/' },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { label: 'Clients', to: '/clients' },
      { label: 'Projets', to: '/projects' },
      { label: 'Intervenants', to: '/intervenors' },
    ],
  },
  {
    title: 'À venir',
    items: [
      { label: 'Documents', to: '/documents', disabled: true },
      { label: 'Bilans', to: '/reports', disabled: true },
      { label: 'Factures', to: '/invoices', disabled: true },
      { label: 'Paramètres', to: '/settings', disabled: true },
    ],
  },
]

function isActiveLink(to: string) {
  if (to === '/') {
    return route.path === '/'
  }

  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="app-layout">
    <button class="mobile-menu-button" @click="isMobileMenuOpen = true">
      ☰
    </button>

    <div
      v-if="isMobileMenuOpen"
      class="mobile-overlay"
      @click="closeMobileMenu"
    />

    <aside
      class="sidebar"
      :class="{ 'sidebar-open': isMobileMenuOpen }"
    >
      <div class="sidebar-top">
        <div class="brand">
          <div class="brand-badge">I</div>

          <div class="brand-text">
            <h2 class="logo">IFICS</h2>
            <p class="logo-subtitle">Dashboard associatif</p>
          </div>
        </div>

        <button class="mobile-close-button" @click="closeMobileMenu">
          ✕
        </button>
      </div>

      <div class="workspace-card">
        <span class="workspace-label">Installation</span>
        <strong class="workspace-name">Association principale</strong>
        <span class="workspace-meta">Version métier V1</span>
      </div>

      <nav class="nav">
        <div
          v-for="section in navigationSections"
          :key="section.title"
          class="nav-section"
        >
          <p class="nav-section-title">{{ section.title }}</p>

          <div class="nav-links">
            <template v-for="item in section.items" :key="item.to">
              <span
                v-if="item.disabled"
                class="nav-link nav-link-disabled"
              >
                {{ item.label }}
                <span class="soon-badge">Bientôt</span>
              </span>

              <NuxtLink
                v-else
                :to="item.to"
                class="nav-link"
                :class="{ 'nav-link-active': isActiveLink(item.to) }"
                @click="closeMobileMenu"
              >
                {{ item.label }}
              </NuxtLink>
            </template>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar">A</div>

          <div class="user-content">
            <strong class="user-name">Administrateur</strong>
            <span class="user-role">Accès complet</span>
          </div>
        </div>
      </div>
    </aside>

    <div class="main-shell">
      <header class="topbar">
        <div>
          <p class="topbar-eyebrow">Plateforme de gestion</p>
          <h1 class="topbar-title">IFICS</h1>
        </div>

        <div class="topbar-actions">
          <span class="status-pill">En ligne</span>
        </div>
      </header>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(96, 165, 250, 0.10), transparent 24%),
    #f5f7fb;
  color: #1f2937;
}

.sidebar {
  width: 280px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border-right: 1px solid #e5e7eb;
  padding: 24px 18px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.sidebar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-text {
  min-width: 0;
}

.brand-badge {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #2563eb 0%, #60a5fa 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
  flex-shrink: 0;
}

.logo {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #111827;
}

.logo-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  color: #6b7280;
}

.workspace-card {
  border: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #f8fbff 0%, #ffffff 100%);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #6b7280;
}

.workspace-name {
  color: #111827;
  font-size: 15px;
}

.workspace-meta {
  color: #6b7280;
  font-size: 13px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nav-section-title {
  margin: 0;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-link {
  text-decoration: none;
  color: #374151;
  padding: 12px 14px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-link:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

.nav-link-active {
  background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
  color: #1d4ed8;
  box-shadow: inset 0 0 0 1px #bfdbfe;
}

.nav-link-disabled {
  color: #9ca3af;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  cursor: not-allowed;
}

.soon-badge {
  font-size: 10px;
  font-weight: 800;
  border-radius: 999px;
  padding: 4px 8px;
  background: #f3f4f6;
  color: #6b7280;
}

.sidebar-footer {
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid #e5e7eb;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  padding: 12px 14px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #111827;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  flex-shrink: 0;
}

.user-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  color: #111827;
  font-size: 14px;
}

.user-role {
  color: #6b7280;
  font-size: 12px;
}

.main-shell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 84px;
  padding: 20px 32px;
  border-bottom: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.topbar-eyebrow {
  margin: 0 0 4px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.topbar-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  border-radius: 999px;
  padding: 8px 12px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid #a7f3d0;
}

.content {
  flex: 1;
  padding: 32px;
  min-width: 0;
}

.mobile-menu-button {
  display: none;
}

.mobile-close-button {
  display: none;
}

.mobile-overlay {
  display: none;
}

@media (max-width: 900px) {
  .mobile-menu-button {
    display: flex;
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 1100;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 12px;
    background: white;
    color: #111827;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    font-size: 20px;
    cursor: pointer;
  }

  .mobile-close-button {
    display: flex;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 10px;
    background: #f3f4f6;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #111827;
    flex-shrink: 0;
  }

  .mobile-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    z-index: 999;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 1000;
    width: 280px;
    max-width: 85vw;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
  }

  .topbar {
    min-height: 84px;
    height: auto;
    padding: 18px 16px 18px 72px;
    align-items: flex-start;
    flex-direction: column;
  }

  .content {
    width: 100%;
    padding: 20px 16px 24px;
  }
}
</style>