<script setup lang="ts">
type Intervenor = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  specialty: string | null
  status: string
  createdAt: string
}

const {
  data: response,
  pending,
  error,
  refresh,
} = useFetch<{ ok: boolean; data: Intervenor[] }>('/api/intervenors', {
  server: false,
  default: () => ({ ok: true, data: [] }),
})

const intervenors = computed(() => response.value?.data || [])

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specialty: '',
})

const isSubmitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')

const canSubmit = computed(() => {
  return (
    !isSubmitting.value &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.trim().length > 0
  )
})

function getStatusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Actif'
    case 'INACTIVE':
      return 'Inactif'
    case 'SUSPENDED':
      return 'Suspendu'
    default:
      return status || 'Non défini'
  }
}

async function createIntervenor() {
  if (isSubmitting.value) {
    return
  }

  submitError.value = ''
  submitSuccess.value = ''

  const firstName = form.firstName.trim()
  const lastName = form.lastName.trim()
  const email = form.email.trim()

  if (!firstName || !lastName || !email) {
    submitError.value = 'Tous les champs obligatoires doivent être remplis.'
    return
  }

  if (!email.includes('@')) {
    submitError.value = 'Email invalide.'
    return
  }

  isSubmitting.value = true

  try {
    await $fetch('/api/intervenors/create', {
      method: 'POST',
      body: {
        firstName,
        lastName,
        email,
        phone: form.phone.trim(),
        specialty: form.specialty.trim(),
      },
    })

    submitSuccess.value = 'Intervenant créé avec succès.'

    form.firstName = ''
    form.lastName = ''
    form.email = ''
    form.phone = ''
    form.specialty = ''

    await refresh()
  } catch (err: any) {
    console.error(err)
    submitError.value =
      err?.data?.statusMessage || 'Erreur lors de la création de l’intervenant.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Intervenants"
      subtitle="Gérez les intervenants et leurs informations principales."
    >
      <BaseButton variant="secondary" @click="refresh()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <div class="create-card">
      <h2 class="section-title">Ajouter un intervenant</h2>

      <div class="form-grid">
        <div class="field-group">
          <label class="field-label" for="firstName">Prénom</label>
          <input
            id="firstName"
            v-model="form.firstName"
            type="text"
            class="field-input"
            placeholder="Ex : Sofia"
          >
        </div>

        <div class="field-group">
          <label class="field-label" for="lastName">Nom</label>
          <input
            id="lastName"
            v-model="form.lastName"
            type="text"
            class="field-input"
            placeholder="Ex : Martin"
          >
        </div>

        <div class="field-group">
          <label class="field-label" for="email">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="field-input"
            placeholder="Ex : sofia@email.com"
          >
        </div>

        <div class="field-group">
          <label class="field-label" for="phone">Téléphone</label>
          <input
            id="phone"
            v-model="form.phone"
            type="text"
            class="field-input"
            placeholder="Ex : 06 00 00 00 00"
          >
        </div>

        <div class="field-group full">
          <label class="field-label" for="specialty">Spécialité</label>
          <input
            id="specialty"
            v-model="form.specialty"
            type="text"
            class="field-input"
            placeholder="Ex : Capoeira, Sophrologie, Théâtre..."
          >
        </div>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="primary-button"
          :disabled="!canSubmit"
          @click="createIntervenor"
        >
          {{ isSubmitting ? 'Création...' : 'Créer l’intervenant' }}
        </button>
      </div>

      <p v-if="submitSuccess" class="success-message">
        {{ submitSuccess }}
      </p>

      <p v-if="submitError" class="error-message">
        {{ submitError }}
      </p>
    </div>

    <div class="list-section">
      <div v-if="pending" class="empty-state">
        Chargement des intervenants...
      </div>

      <div v-else-if="error" class="empty-state error">
        Erreur lors du chargement des intervenants.
      </div>

      <div v-else-if="!intervenors.length" class="empty-state">
        Aucun intervenant enregistré pour le moment.
      </div>

      <div v-else class="intervenor-list">
        <NuxtLink
          v-for="intervenor in intervenors"
          :key="intervenor.id"
          :to="`/intervenors/${intervenor.id}`"
          class="intervenor-link"
        >
          <div class="intervenor-card">
            <div class="intervenor-header">
              <div>
                <h3 class="intervenor-name">
                  {{ intervenor.firstName }} {{ intervenor.lastName }}
                </h3>
                <p class="intervenor-email">{{ intervenor.email }}</p>
              </div>

              <span class="status-badge">
                {{ getStatusLabel(intervenor.status) }}
              </span>
            </div>

            <div class="intervenor-meta">
              <span>{{ intervenor.phone || 'Téléphone non renseigné' }}</span>
              <span>•</span>
              <span>{{ intervenor.specialty || 'Spécialité non renseignée' }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.create-card,
.intervenor-card,
.empty-state {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.create-card {
  padding: 24px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 20px;
  color: #111827;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-group.full {
  grid-column: 1 / -1;
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
  box-sizing: border-box;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.primary-button {
  min-height: 42px;
  padding: 0 16px;
  border: none;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.list-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intervenor-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intervenor-link {
  text-decoration: none;
}

.intervenor-card {
  padding: 18px;
  transition: all 0.2s ease;
}

.intervenor-card:hover {
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.intervenor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.intervenor-name {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.intervenor-email {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.intervenor-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  color: #4b5563;
  font-size: 14px;
}

.status-badge {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  background: #ecfdf5;
  color: #15803d;
  border: 1px solid #86efac;
  white-space: nowrap;
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
  .create-card {
    padding: 18px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions {
    justify-content: stretch;
  }

  .primary-button {
    width: 100%;
  }
}
</style>