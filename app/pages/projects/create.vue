<script setup lang="ts">
const router = useRouter()

type ClientItem = {
  id: string
  associationId: string
  name: string
}

const { data: clientsData, refresh: refreshClients } = useFetch('/api/clients', {
  server: false,
  default: () => ({ data: [] }),
})

const clients = computed<ClientItem[]>(() => clientsData.value?.data || [])

const form = reactive({
  clientId: '',
  title: '',
  description: '',
  status: 'DRAFT',
})

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

onMounted(() => {
  refreshClients()
})

async function submitForm() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch('/api/projects/create', {
      method: 'POST',
      body: {
        clientId: form.clientId,
        title: form.title,
        description: form.description,
        status: form.status,
      },
    })

    successMessage.value = 'Projet créé avec succès.'

    setTimeout(() => {
      router.push('/projects')
    }, 700)
  }
  catch (error) {
    console.error(error)
    errorMessage.value = 'Erreur lors de la création du projet.'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Ajouter un projet"
      subtitle="Créez un nouveau projet et rattachez-le à un client existant."
    >
      <NuxtLink to="/projects">
        <BaseButton variant="secondary">Retour</BaseButton>
      </NuxtLink>
    </PageHeader>

    <form class="form-card" @submit.prevent="submitForm">
      <div class="form-grid">
        <div class="field full">
          <label class="label">Client</label>
          <select v-model="form.clientId" class="input" required>
            <option value="" disabled>-- Choisir un client --</option>
            <option
              v-for="client in clients"
              :key="client.id"
              :value="client.id"
            >
              {{ client.name }}
            </option>
          </select>
        </div>

        <div class="field full">
          <label class="label">Titre</label>
          <input
            v-model="form.title"
            type="text"
            class="input"
            placeholder="Ex: Ateliers Capoeira PRE 2026"
            required
          />
        </div>

        <div class="field full">
          <label class="label">Description</label>
          <textarea
            v-model="form.description"
            class="input textarea"
            placeholder="Décrivez le projet..."
          />
        </div>

        <div class="field">
          <label class="label">Statut</label>
          <select v-model="form.status" class="input">
            <option value="DRAFT">Brouillon</option>
            <option value="VALIDATED">Validé</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="COMPLETED">Terminé</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <BaseButton variant="primary">
          {{ loading ? 'Création...' : 'Créer le projet' }}
        </BaseButton>
      </div>

      <p v-if="successMessage" class="success-message">
        {{ successMessage }}
      </p>

      <p v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </p>
    </form>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field.full {
  grid-column: 1 / -1;
}

.label {
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  color: #111827;
  font-size: 14px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.input:focus {
  outline: none;
  border-color: #818cf8;
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
}

.textarea {
  min-height: 120px;
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
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

@media (max-width: 768px) {
  .form-card {
    padding: 18px;
    border-radius: 16px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .form-actions {
    justify-content: stretch;
  }

  .form-actions :deep(button) {
    width: 100%;
  }
}
</style>