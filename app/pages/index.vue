<script setup lang="ts">
const { data: clientsData, pending: clientsPending, refresh: refreshClients } = useFetch('/api/clients', {
  server: false,
})

const { data: projectsData, pending: projectsPending, refresh: refreshProjects } = useFetch('/api/projects', {
  server: false,
})

const clients = computed(() => clientsData.value?.data || [])
const projects = computed(() => projectsData.value?.data || [])

const totalClients = computed(() => clients.value.length)
const totalProjects = computed(() => projects.value.length)

const draftProjects = computed(() =>
  projects.value.filter((project: any) => project.status === 'DRAFT').length,
)

const inProgressProjects = computed(() =>
  projects.value.filter((project: any) =>
    ['IN_PROGRESS', 'VALIDATED'].includes(project.status),
  ).length,
)

const projectsWithoutDescription = computed(() =>
  projects.value.filter((project: any) => !project.description?.trim()).length,
)

const recentProjects = computed(() => projects.value.slice(0, 5))

function getMainClient(project: any) {
  const mainClient = project.projectClients?.find((item: any) => item.isMainClient)
  return mainClient?.client?.name || 'Client non renseigné'
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon'
    case 'VALIDATED':
      return 'Validé'
    case 'IN_PROGRESS':
      return 'En cours'
    case 'COMPLETED':
      return 'Terminé'
    case 'CANCELLED':
      return 'Annulé'
    default:
      return status || 'Non défini'
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'badge-draft'
    case 'VALIDATED':
      return 'badge-validated'
    case 'IN_PROGRESS':
      return 'badge-progress'
    case 'COMPLETED':
      return 'badge-completed'
    case 'CANCELLED':
      return 'badge-cancelled'
    default:
      return 'badge-default'
  }
}

async function refreshAll() {
  await Promise.all([refreshClients(), refreshProjects()])
}
</script>

<template>
  <div class="dashboard-page">
    <PageHeader
      title="Dashboard"
      subtitle="Vue d’ensemble de l’activité associative et des projets en cours."
    >
      <BaseButton variant="secondary" @click="refreshAll()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <ClientOnly>
      <div class="dashboard-content">
        <div class="stats-grid">
          <article class="stat-card">
            <span class="stat-label">Clients</span>
            <strong class="stat-value">
              {{ clientsPending ? '...' : totalClients }}
            </strong>
            <p class="stat-helper">Structures suivies dans l’application</p>
          </article>

          <article class="stat-card">
            <span class="stat-label">Projets</span>
            <strong class="stat-value">
              {{ projectsPending ? '...' : totalProjects }}
            </strong>
            <p class="stat-helper">Projets enregistrés</p>
          </article>

          <article class="stat-card">
            <span class="stat-label">Projets en brouillon</span>
            <strong class="stat-value">
              {{ projectsPending ? '...' : draftProjects }}
            </strong>
            <p class="stat-helper">À compléter ou valider</p>
          </article>

          <article class="stat-card">
            <span class="stat-label">Projets en cours</span>
            <strong class="stat-value">
              {{ projectsPending ? '...' : inProgressProjects }}
            </strong>
            <p class="stat-helper">Projets actifs ou prêts à démarrer</p>
          </article>
        </div>

        <div class="dashboard-grid">
          <section class="panel panel-large">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Projets récents</h2>
                <p class="panel-subtitle">Les derniers projets créés dans l’outil</p>
              </div>
            </div>

            <div v-if="projectsPending" class="empty-state">
              Chargement des projets...
            </div>

            <div v-else-if="!recentProjects.length" class="empty-state">
              Aucun projet disponible pour le moment.
            </div>

            <div v-else class="project-list">
              <article
                v-for="project in recentProjects"
                :key="project.id"
                class="project-row"
              >
                <div class="project-row-main">
                  <div class="project-row-top">
                    <h3 class="project-title">{{ project.title }}</h3>
                    <span class="badge" :class="getStatusClass(project.status)">
                      {{ getStatusLabel(project.status) }}
                    </span>
                  </div>

                  <p class="project-meta">
                    Client principal : <strong>{{ getMainClient(project) }}</strong>
                  </p>

                  <p class="project-description">
                    {{ project.description || 'Description non renseignée.' }}
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">À compléter</h2>
                <p class="panel-subtitle">Éléments qui méritent ton attention</p>
              </div>
            </div>

            <div class="attention-list">
              <div class="attention-item">
                <span class="attention-label">Projets sans description</span>
                <strong class="attention-value">
                  {{ projectsPending ? '...' : projectsWithoutDescription }}
                </strong>
              </div>

              <div class="attention-item">
                <span class="attention-label">Projets en brouillon</span>
                <strong class="attention-value">
                  {{ projectsPending ? '...' : draftProjects }}
                </strong>
              </div>

              <div class="attention-item">
                <span class="attention-label">Clients enregistrés</span>
                <strong class="attention-value">
                  {{ clientsPending ? '...' : totalClients }}
                </strong>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <h2 class="panel-title">Vue métier rapide</h2>
                <p class="panel-subtitle">Lecture synthétique de la situation</p>
              </div>
            </div>

            <div class="summary-box">
              <p>
                Tu as actuellement
                <strong>{{ totalProjects }}</strong>
                projet<span v-if="totalProjects > 1">s</span>
                enregistré<span v-if="totalProjects > 1">s</span>,
                dont
                <strong>{{ inProgressProjects }}</strong>
                en activité potentielle et
                <strong>{{ draftProjects }}</strong>
                encore à finaliser.
              </p>

              <p>
                La base client contient
                <strong>{{ totalClients }}</strong>
                structure<span v-if="totalClients > 1">s</span>.
              </p>

              <p>
                Cette vue sera ensuite enrichie avec les intervenants, les séances,
                les documents, les bilans et les échéances.
              </p>
            </div>
          </section>
        </div>
      </div>

      <template #fallback>
        <div class="dashboard-content">
          <div class="stats-grid">
            <article class="stat-card">
              <span class="stat-label">Clients</span>
              <strong class="stat-value">...</strong>
              <p class="stat-helper">Chargement en cours</p>
            </article>

            <article class="stat-card">
              <span class="stat-label">Projets</span>
              <strong class="stat-value">...</strong>
              <p class="stat-helper">Chargement en cours</p>
            </article>

            <article class="stat-card">
              <span class="stat-label">Projets en brouillon</span>
              <strong class="stat-value">...</strong>
              <p class="stat-helper">Chargement en cours</p>
            </article>

            <article class="stat-card">
              <span class="stat-label">Projets en cours</span>
              <strong class="stat-value">...</strong>
              <p class="stat-helper">Chargement en cours</p>
            </article>
          </div>

          <div class="dashboard-grid">
            <section class="panel panel-large">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">Projets récents</h2>
                  <p class="panel-subtitle">Chargement des données...</p>
                </div>
              </div>

              <div class="empty-state">
                Chargement du dashboard...
              </div>
            </section>

            <section class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">À compléter</h2>
                  <p class="panel-subtitle">Chargement des données...</p>
                </div>
              </div>

              <div class="empty-state">
                Chargement...
              </div>
            </section>

            <section class="panel">
              <div class="panel-header">
                <div>
                  <h2 class="panel-title">Vue métier rapide</h2>
                  <p class="panel-subtitle">Chargement des données...</p>
                </div>
              </div>

              <div class="empty-state">
                Chargement...
              </div>
            </section>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stat-value {
  font-size: 32px;
  line-height: 1;
  color: #111827;
}

.stat-helper {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.4;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 16px;
}

.panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-large {
  grid-row: span 2;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  margin: 0;
  font-size: 20px;
  color: #111827;
}

.panel-subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.project-row {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
  background: #fbfdff;
}

.project-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.project-title {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.project-meta {
  margin: 0 0 8px;
  color: #4b5563;
  font-size: 14px;
}

.project-description {
  margin: 0;
  color: #6b7280;
  line-height: 1.5;
  font-size: 14px;
}

.badge {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
  white-space: nowrap;
  border: 1px solid transparent;
}

.badge-draft {
  background: #f3f4f6;
  color: #4b5563;
  border-color: #e5e7eb;
}

.badge-validated {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.badge-progress {
  background: #ecfeff;
  color: #0f766e;
  border-color: #99f6e4;
}

.badge-completed {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

.badge-cancelled {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}

.badge-default {
  background: #f9fafb;
  color: #6b7280;
  border-color: #e5e7eb;
}

.attention-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attention-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.attention-label {
  color: #4b5563;
  font-weight: 600;
}

.attention-value {
  color: #111827;
  font-size: 18px;
}

.summary-box {
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fbff 0%, #ffffff 100%);
  border: 1px solid #e5e7eb;
  padding: 18px;
}

.summary-box p {
  margin: 0 0 12px;
  color: #4b5563;
  line-height: 1.6;
}

.summary-box p:last-child {
  margin-bottom: 0;
}

.empty-state {
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .panel-large {
    grid-row: auto;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .project-row-top {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>