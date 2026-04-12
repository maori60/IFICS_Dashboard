<script setup lang="ts">
const search = ref('')
const selectedType = ref('ALL')

const { data, pending, error, refresh } = useFetch('/api/clients', {
  server: false,
})

const clients = computed(() => data.value?.data || [])

const clientTypes = computed(() => {
  const types = clients.value
    .map((client: any) => client.type)
    .filter(Boolean)

  return ['ALL', ...new Set(types)]
})

const filteredClients = computed(() => {
  return clients.value.filter((client: any) => {
    const matchesType =
      selectedType.value === 'ALL' || client.type === selectedType.value

    const query = search.value.trim().toLowerCase()

    const matchesSearch =
      !query ||
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.city?.toLowerCase().includes(query) ||
      client.country?.toLowerCase().includes(query) ||
      client.type?.toLowerCase().includes(query)

    return matchesType && matchesSearch
  })
})

const totalClients = computed(() => clients.value.length)

const totalCities = computed(() => {
  const cities = clients.value
    .map((client: any) => client.city)
    .filter(Boolean)

  return new Set(cities).size
})

const totalWithEmail = computed(() =>
  clients.value.filter((client: any) => !!client.email).length,
)

function getTypeLabel(type: string) {
  switch (type) {
    case 'MAIRIE':
      return 'Mairie'
    case 'ASSOCIATION':
      return 'Association'
    case 'ETABLISSEMENT_SCOLAIRE':
      return 'Établissement scolaire'
    case 'SERVICE_MUNICIPAL':
      return 'Service municipal'
    default:
      return type || 'Non défini'
  }
}

function getTypeClass(type: string) {
  switch (type) {
    case 'MAIRIE':
      return 'badge-mairie'
    case 'ASSOCIATION':
      return 'badge-association'
    case 'ETABLISSEMENT_SCOLAIRE':
      return 'badge-school'
    case 'SERVICE_MUNICIPAL':
      return 'badge-service'
    default:
      return 'badge-default'
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Clients"
      subtitle="Gérez vos clients, collectivités et établissements."
    >
      <NuxtLink to="/clients/create">
        <BaseButton variant="primary">+ Ajouter un client</BaseButton>
      </NuxtLink>

      <BaseButton variant="secondary" @click="refresh()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <ClientOnly>
      <div class="page-content">
        <div class="stats-grid">
          <article class="stats-card">
            <span class="stats-label">Nombre de clients</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalClients }}
            </strong>
            <p class="stats-helper">Structures enregistrées</p>
          </article>

          <article class="stats-card">
            <span class="stats-label">Villes couvertes</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalCities }}
            </strong>
            <p class="stats-helper">Présence géographique actuelle</p>
          </article>

          <article class="stats-card">
            <span class="stats-label">Emails renseignés</span>
            <strong class="stats-value">
              {{ pending ? '...' : totalWithEmail }}
            </strong>
            <p class="stats-helper">Fiches avec contact email</p>
          </article>
        </div>

        <section class="toolbar-card">
          <div class="toolbar-grid">
            <div class="field-group field-group-large">
              <label class="field-label" for="client-search">Recherche</label>
              <input
                id="client-search"
                v-model="search"
                type="text"
                class="field-input"
                placeholder="Nom, email, ville, pays..."
              >
            </div>

            <div class="field-group">
              <label class="field-label" for="client-type">Type</label>
              <select
                id="client-type"
                v-model="selectedType"
                class="field-input"
              >
                <option
                  v-for="type in clientTypes"
                  :key="type"
                  :value="type"
                >
                  {{ type === 'ALL' ? 'Tous les types' : getTypeLabel(type) }}
                </option>
              </select>
            </div>
          </div>
        </section>

        <div v-if="pending" class="empty-state">
          Chargement des clients...
        </div>

        <div v-else-if="error" class="empty-state error">
          Erreur lors du chargement des clients.
        </div>

        <div v-else-if="!clients.length" class="empty-state">
          Aucun client pour le moment.
        </div>

        <div v-else-if="!filteredClients.length" class="empty-state">
          Aucun client ne correspond à votre recherche.
        </div>

        <div v-else class="cards">
          <NuxtLink
            v-for="client in filteredClients"
            :key="client.id"
            :to="`/clients/${client.id}`"
            class="card-link"
          >
            <article class="card">
              <div class="card-header">
                <div class="card-title-group">
                  <h2 class="card-title">{{ client.name }}</h2>
                  <p class="card-subtitle">
                    {{ client.city || 'Ville non renseignée' }}
                    <template v-if="client.country">· {{ client.country }}</template>
                  </p>
                </div>

                <span class="badge" :class="getTypeClass(client.type)">
                  {{ getTypeLabel(client.type) }}
                </span>
              </div>

              <div class="card-grid">
                <div class="info-block">
                  <span class="info-label">Email</span>
                  <span class="info-value">{{ client.email || 'Non renseigné' }}</span>
                </div>

                <div class="info-block">
                  <span class="info-label">Code postal</span>
                  <span class="info-value">{{ client.postalCode || 'Non renseigné' }}</span>
                </div>

                <div class="info-block full">
                  <span class="info-label">Adresse</span>
                  <span class="info-value">
                    {{ client.addressLine1 || 'Adresse non renseignée' }}
                    <template v-if="client.addressLine2">
                      , {{ client.addressLine2 }}
                    </template>
                    <template v-if="client.postalCode || client.city || client.country">
                      ,
                      {{ client.postalCode || '' }}
                      {{ client.city || '' }}
                      <template v-if="client.country">, {{ client.country }}</template>
                    </template>
                  </span>
                </div>
              </div>
            </article>
          </NuxtLink>
        </div>
      </div>

      <template #fallback>
        <div class="empty-state">Chargement des clients...</div>
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  cursor: pointer;
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

.badge-mairie {
  background: #eef2ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.badge-association {
  background: #f5f3ff;
  color: #7c3aed;
  border-color: #ddd6fe;
}

.badge-school {
  background: #ecfeff;
  color: #0f766e;
  border-color: #99f6e4;
}

.badge-service {
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