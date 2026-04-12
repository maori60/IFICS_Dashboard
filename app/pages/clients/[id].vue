<script setup lang="ts">
const route = useRoute()
const router = useRouter()

type ClientDetail = {
  id: string
  name: string
  type: string
  email: string | null
  addressLine1: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  archivedAt?: string | null
}

const {
  data: client,
  pending,
  error,
  refresh,
} = useFetch<ClientDetail>(`/api/clients/${route.params.id}`, {
  server: false,
})

const isArchiving = ref(false)
const archiveError = ref('')
const archiveSuccess = ref('')

async function archiveClient() {
  if (!client.value?.id || isArchiving.value) {
    return
  }

  const confirmed = window.confirm(
    'Voulez-vous vraiment archiver ce client ? Il disparaîtra des listes actives mais restera dans l’historique.'
  )

  if (!confirmed) {
    return
  }

  isArchiving.value = true
  archiveError.value = ''
  archiveSuccess.value = ''

  try {
    await $fetch('/api/clients/archive', {
      method: 'POST',
      body: {
        id: client.value.id,
      },
    })

    archiveSuccess.value = 'Client archivé avec succès.'

    setTimeout(() => {
      router.push('/clients')
    }, 800)
  } catch (err) {
    console.error(err)
    archiveError.value = 'Erreur lors de l’archivage du client.'
  } finally {
    isArchiving.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Détail du client"
      subtitle="Consultez les informations complètes du client."
    >
      <NuxtLink to="/clients">
        <BaseButton variant="secondary">Retour</BaseButton>
      </NuxtLink>

      <BaseButton variant="secondary" @click="refresh()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <div v-if="pending" class="empty-state">
      Chargement du client...
    </div>

    <div v-else-if="error" class="empty-state error">
      Erreur lors du chargement du client.
    </div>

    <div v-else-if="!client" class="empty-state">
      Client introuvable.
    </div>

    <div v-else class="detail-card">
      <div class="detail-header">
        <div>
          <h2 class="detail-title">{{ client.name }}</h2>
          <p class="detail-subtitle">
            {{ client.email || 'Email non renseigné' }}
          </p>
        </div>

        <span class="badge badge-type">
          {{ client.type }}
        </span>
      </div>

      <div class="detail-grid">
        <div class="info-block">
          <span class="info-label">Nom</span>
          <span class="info-value">{{ client.name }}</span>
        </div>

        <div class="info-block">
          <span class="info-label">Type</span>
          <span class="info-value">{{ client.type }}</span>
        </div>

        <div class="info-block">
          <span class="info-label">Email</span>
          <span class="info-value">{{ client.email || 'Non renseigné' }}</span>
        </div>

        <div class="info-block">
          <span class="info-label">Ville</span>
          <span class="info-value">{{ client.city || 'Non renseignée' }}</span>
        </div>

        <div class="info-block full">
          <span class="info-label">Adresse</span>
          <span class="info-value">
            {{ client.addressLine1 || 'Adresse non renseignée' }}
            <template v-if="client.postalCode || client.city || client.country">
              ,
              {{ client.postalCode || '' }}
              {{ client.city || '' }}
              <template v-if="client.country">, {{ client.country }}</template>
            </template>
          </span>
        </div>
      </div>

      <div class="actions-bar">
        <BaseButton variant="secondary" @click="refresh()">
          Rafraîchir la fiche
        </BaseButton>

        <button
          type="button"
          class="archive-button"
          :disabled="isArchiving"
          @click="archiveClient"
        >
          {{ isArchiving ? 'Archivage...' : 'Archiver le client' }}
        </button>
      </div>

      <p v-if="archiveSuccess" class="success-message">
        {{ archiveSuccess }}
      </p>

      <p v-if="archiveError" class="error-message">
        {{ archiveError }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.detail-title {
  margin: 0;
  font-size: 28px;
  color: #111827;
}

.detail-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 15px;
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

.badge-type {
  background: #eef2ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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
  line-height: 1.5;
}

.actions-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  flex-wrap: wrap;
}

.archive-button {
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.archive-button:hover:not(:disabled) {
  background: #fee2e2;
}

.archive-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.success-message {
  margin-top: 16px;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 12px 14px;
  border-radius: 12px;
}

.error-message {
  margin-top: 16px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 12px 14px;
  border-radius: 12px;
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

@media (max-width: 768px) {
  .detail-card {
    padding: 18px;
    border-radius: 16px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .actions-bar {
    justify-content: stretch;
    flex-direction: column;
  }

  .archive-button {
    width: 100%;
  }
}
</style>