<script setup lang="ts">
const search = ref('')
const selectedStatus = ref('ALL')

const { data, pending, error, refresh } = useFetch('/api/projects', {
  server: false,
})

const projects = computed(() => data.value?.data || [])

const statusOptions = [
  { label: 'Tous les statuts', value: 'ALL' },
  { label: 'Brouillon', value: 'DRAFT' },
  { label: 'Validé', value: 'VALIDATED' },
  { label: 'En cours', value: 'IN_PROGRESS' },
  { label: 'Terminé', value: 'COMPLETED' },
  { label: 'Annulé', value: 'CANCELLED' },
]

const filteredProjects = computed(() => {
  return projects.value.filter((project: any) => {
    const matchesStatus =
      selectedStatus.value === 'ALL' || project.status === selectedStatus.value

    const query = search.value.trim().toLowerCase()

    const mainClient =
      project.projectClients?.find((item: any) => item.isMainClient)?.client?.name || ''

    const matchesSearch =
      !query ||
      project.title?.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      mainClient.toLowerCase().includes(query) ||
      project.status?.toLowerCase().includes(query)

    return matchesStatus && matchesSearch
  })
})

const totalProjects = computed(() => projects.value.length)

const totalDraftProjects = computed(() =>
  projects.value.filter((project: any) => project.status === 'DRAFT').length,
)

const totalInProgressProjects = computed(() =>
  projects.value.filter((project: any) =>
    ['IN_PROGRESS', 'VALIDATED'].includes(project.status),
  ).length,
)

const totalWithoutDescription = computed(() =>
  projects.value.filter((project: any) => !project.description?.trim()).length,
)

function getMainClient(project: any) {
  const mainClient = project.projectClients?.find((item: any) => item.isMainClient)
  return mainClient?.client?.name || 'Non défini'
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
      return 'badge-done'
    case 'CANCELLED':
      return 'badge-cancel'
    default:
      return 'badge-default'
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Projets"
      subtitle="Suivez vos projets éducatifs et leurs clients associés."
    >
      <NuxtLink to="/projects/create">
        <BaseButton variant="primary">+ Ajouter un projet</BaseButton>
      </NuxtLink>

      <BaseButton variant="secondary" @click="refresh()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <ClientOnly>
      <div class="page-content">
        <div class="stats-grid">
          <article class="stats-card">
            <span class="stats-label">Nombre de projets</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalProjects }}
            </strong>
            <p class="stats-helper">Projets enregistrés</p>
          </article>

          <article class="stats-card">
            <span class="stats-label">En activité</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalInProgressProjects }}
            </strong>
            <p class="stats-helper">Validés ou en cours</p>
          </article>

          <article class="stats-card">
            <span class="stats-label">En brouillon</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalDraftProjects }}
            </strong>
            <p class="stats-helper">À compléter ou confirmer</p>
          </article>

          <article class="stats-card">
            <span class="stats-label">Sans description</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalWithoutDescription }}
            </strong>
            <p class="stats-helper">Projets incomplets</p>
          </article>
        </div>

        <section class="toolbar-card">
          <div class="toolbar-grid">
            <div class="field-group field-group-large">
              <label class="field-label" for="project-search">Recherche</label>
              <input
                id="project-search"
                v-model="search"
                type="text"
                class="field-input"
                placeholder="Titre, description, client principal, statut..."
              >
            </div>

            <div class="field-group">
              <label class="field-label" for="project-status">Statut</label>
              <select
                id="project-status"
                v-model="selectedStatus"
                class="field-input"
              >
                <option
                  v-for="status in statusOptions"
                  :key="status.value"
                  :value="status.value"
                >
                  {{ status.label }}
                </option>
              </select>
            </div>
          </div>
        </section>

        <div v-if="pending" class="empty-state">
          Chargement des projets...
        </div>

        <div v-else-if="error" class="empty-state error">
          Erreur lors du chargement des projets.
        </div>

        <div v-else-if="!projects.length" class="empty-state">
          Aucun projet pour le moment.
        </div>

        <div v-else-if="!filteredProjects.length" class="empty-state">
          Aucun projet ne correspond à votre recherche.
        </div>

        <div v-else class="cards">
          <div
            v-for="project in filteredProjects"
            :key="project.id"
            class="card-wrapper"
          >
            <p class="test-link-line">
              <NuxtLink :to="`/projects/${project.id}`" class="test-link">
                Ouvrir ce projet test
              </NuxtLink>
            </p>

            <NuxtLink
              :to="`/projects/${project.id}`"
              class="card-link"
            >
              <article class="card">
                <div class="card-header">
                  <div class="card-title-group">
                    <h2 class="card-title">{{ project.title }}</h2>

                    <p class="card-subtitle">
                      ID : {{ project.id }}
                    </p>

                    <p class="card-subtitle">
                      Client principal : {{ getMainClient(project) }}
                    </p>
                  </div>

                  <span class="badge" :class="getStatusClass(project.status)">
                    {{ getStatusLabel(project.status) }}
                  </span>
                </div>

                <div class="card-grid">
                  <div class="info-block full">
                    <span class="info-label">Description</span>
                    <span class="info-value">
                      {{ project.description || 'Description non renseignée.' }}
                    </span>
                  </div>

                  <div class="info-block">
                    <span class="info-label">Client principal</span>
                    <span class="info-value">{{ getMainClient(project) }}</span>
                  </div>

                  <div class="info-block">
                    <span class="info-label">Clients liés</span>
                    <span class="info-value">{{ (project.projectClients || []).length }}</span>
                  </div>

                  <div class="info-block">
                    <span class="info-label">Intervenants liés</span>
                    <span class="info-value">0</span>
                  </div>

                  <div class="info-block">
                    <span class="info-label">Statut métier</span>
                    <span class="info-value">{{ getStatusLabel(project.status) }}</span>
                  </div>
                </div>
              </article>
            </NuxtLink>
          </div>
        </div>
      </div>

      <template #fallback>
        <div class="empty-state">Chargement des projets...</div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stats-card {
  background: linear-gradient(135deg, #ffffff, #f9fafb);
  border-radius: 18px;
  padding: 18px 20px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-label {
  color: #6b7280;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.stats-value {
  font-size: 30px;
  color: #111827;
  line-height: 1;
}

.stats-helper {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.toolbar-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.toolbar-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-group-large {
  min-width: 0;
}

.field-label {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
}

.field-input {
  width: 100%;
  min-height: 46px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 14px;
  color: #111827;
  background: white;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.field-input:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.10);
}

.cards {
  display: grid;
  gap: 16px;
}

.card-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-link-line {
  margin: 0;
}

.test-link {
  color: #2563eb;
  text-decoration: underline;
  font-weight: 600;
}

.card-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.card {
  background: white;
  border-radius: 18px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  transition: all 0.2s ease;
}

.card-link:hover .card {
  transform: translateY(-3px);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10);
  border-color: #dbe3f0;
}

.card-link:focus-visible {
  outline: none;
}

.card-link:focus-visible .card {
  box-shadow:
    0 0 0 4px rgba(99, 102, 241, 0.12),
    0 16px 40px rgba(15, 23, 42, 0.10);
  border-color: #818cf8;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.card-title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-title {
  margin: 0;
  font-size: 22px;
  color: #111827;
}

.card-subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.badge {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.badge-draft {
  background: #eef2ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.badge-progress {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fdba74;
}

.badge-done {
  background: #ecfdf5;
  color: #15803d;
  border-color: #86efac;
}

.badge-cancel {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}

.badge-validated {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.badge-default {
  background: #f3f4f6;
  color: #4b5563;
  border-color: #e5e7eb;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.info-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-block.full {
  grid-column: 1 / -1;
}

.info-label {
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.info-value {
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

.empty-state {
  background: white;
  border: 1px dashed #d1d5db;
  border-radius: 18px;
  padding: 24px;
  color: #6b7280;
  text-align: center;
}

.empty-state.error {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .card-grid {
    grid-template-columns: 1fr;
  }

  .card-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>