<script setup lang="ts">
const router = useRouter()

const form = reactive({
  associationId: 'cmnud3fhk0000nhjajr6wpemo',
  type: 'MAIRIE',
  name: '',
  email: '',
  addressLine1: '',
  postalCode: '',
  city: '',
  country: 'France',
})

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function submitForm() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch('/api/clients/create', {
      method: 'POST',
      body: form,
    })

    successMessage.value = 'Client créé avec succès.'

    setTimeout(() => {
      router.push('/clients')
    }, 700)
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Erreur lors de la création du client.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Ajouter un client"
      subtitle="Créez une nouvelle fiche client pour une mairie, un établissement ou une association."
    >
      <NuxtLink to="/clients">
        <BaseButton variant="secondary">Retour</BaseButton>
      </NuxtLink>
    </PageHeader>

    <form class="form-card" @submit.prevent="submitForm">
      <div class="form-grid">
        <div class="field">
          <label class="label">Type</label>
          <select v-model="form.type" class="input">
            <option value="MAIRIE">Mairie</option>
            <option value="SERVICE_MUNICIPAL">Service municipal</option>
            <option value="ETABLISSEMENT_SCOLAIRE">Établissement scolaire</option>
            <option value="ASSOCIATION">Association</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>

        <div class="field">
          <label class="label">Nom</label>
          <input
            v-model="form.name"
            type="text"
            class="input"
            placeholder="Ex: Mairie de Montreuil"
            required
          />
        </div>

        <div class="field">
          <label class="label">Email</label>
          <input
            v-model="form.email"
            type="email"
            class="input"
            placeholder="contact@client.fr"
            required
          />
        </div>

        <div class="field full">
          <label class="label">Adresse</label>
          <input
            v-model="form.addressLine1"
            type="text"
            class="input"
            placeholder="Adresse principale"
            required
          />
        </div>

        <div class="field">
          <label class="label">Code postal</label>
          <input
            v-model="form.postalCode"
            type="text"
            class="input"
            placeholder="93100"
            required
          />
        </div>

        <div class="field">
          <label class="label">Ville</label>
          <input
            v-model="form.city"
            type="text"
            class="input"
            placeholder="Montreuil"
            required
          />
        </div>

        <div class="field">
          <label class="label">Pays</label>
          <input
            v-model="form.country"
            type="text"
            class="input"
            placeholder="France"
            required
          />
        </div>
      </div>

      <div class="form-actions">
        <BaseButton variant="primary">
          {{ loading ? 'Création...' : 'Créer le client' }}
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