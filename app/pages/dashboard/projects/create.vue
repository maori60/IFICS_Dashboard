<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un projet' })

type ClientOption = {
  id: string
  name: string
  status: string
}

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data: clientsData, error: clientsError } = await useFetch<ApiSuccess<ClientOption[]>>('/api/clients')

const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canCreate = computed(() => permissions.value.includes('*') || permissions.value.includes('project:write'))
const clients = computed(() => (clientsData.value?.data ?? []).filter(client => client.status === 'ACTIVE'))

const form = reactive({
  clientId: '',
  reference: '',
  title: '',
  description: '',
  status: 'DRAFT',
  classification: 'INTERNAL',
  startDate: '',
  endDate: '',
  plannedBudget: '',
  totalSessions: '',
  sessionUnitPrice: '',
  internalComments: '',
})

const saving = ref(false)
const errorMessage = ref('')

async function submit() {
  if (!canCreate.value || saving.value) return
  saving.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/projects/create', {
      method: 'POST',
      body: {
        clientId: form.clientId,
        reference: form.reference,
        title: form.title,
        description: form.description,
        status: form.status,
        classification: form.classification,
        startDate: form.startDate,
        endDate: form.endDate,
        plannedBudget: form.plannedBudget,
        totalSessions: form.totalSessions,
        sessionUnitPrice: form.sessionUnitPrice,
        internalComments: form.internalComments,
      },
    })

    await navigateTo('/dashboard/projects?created=1')
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le projet n’a pas pu être créé.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Créer un projet</h1>
        <p>Créez l’action interne puis complétez ensuite les affectations, documents et bilans.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/projects">
        Retour aux projets
      </NuxtLink>
    </div>

    <div v-if="!canCreate" class="alert alert-error">
      Votre rôle ne permet pas de créer un projet.
    </div>

    <div v-else-if="clientsError" class="alert alert-error">
      Impossible de charger les clients disponibles.
    </div>

    <div v-else-if="!clients.length" class="card card-pad">
      <h2>Aucun client disponible</h2>
      <p class="muted">Un projet IFICS doit être rattaché à un client principal.</p>
      <NuxtLink class="btn btn-primary" to="/dashboard/clients/create">
        Créer un client
      </NuxtLink>
    </div>

    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom: 18px">
        {{ errorMessage }}
      </div>

      <div class="form-grid">
        <div class="field field-full">
          <label for="project-client">Client principal *</label>
          <select id="project-client" v-model="form.clientId" class="select" required>
            <option value="" disabled>Sélectionner un client</option>
            <option v-for="client in clients" :key="client.id" :value="client.id">
              {{ client.name }}
            </option>
          </select>
        </div>

        <div class="field">
          <label for="project-reference">Référence</label>
          <input id="project-reference" v-model="form.reference" class="input" maxlength="50" placeholder="Ex. IFICS-2026-001">
        </div>

        <div class="field">
          <label for="project-title">Titre *</label>
          <input id="project-title" v-model="form.title" class="input" maxlength="255" required placeholder="Nom du projet">
        </div>

        <div class="field">
          <label for="project-status">Statut *</label>
          <select id="project-status" v-model="form.status" class="select" required>
            <option value="DRAFT">Brouillon</option>
            <option value="VALIDATED">Validé</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="COMPLETED">Terminé</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>

        <div class="field">
          <label for="project-classification">Classification *</label>
          <select id="project-classification" v-model="form.classification" class="select" required>
            <option value="PUBLIC">Public</option>
            <option value="INTERNAL">Interne</option>
            <option value="CONFIDENTIAL">Confidentiel</option>
            <option value="RESTRICTED">Restreint</option>
          </select>
          <span class="help">La classification contrôle la visibilité interne ; la publication publique reste un workflow distinct.</span>
        </div>

        <div class="field">
          <label for="project-start">Date de début</label>
          <input id="project-start" v-model="form.startDate" class="input" type="date">
        </div>

        <div class="field">
          <label for="project-end">Date de fin</label>
          <input id="project-end" v-model="form.endDate" class="input" type="date">
        </div>

        <div class="field">
          <label for="project-budget">Budget prévisionnel (€)</label>
          <input id="project-budget" v-model="form.plannedBudget" class="input" type="number" min="0" step="0.01" inputmode="decimal">
        </div>

        <div class="field">
          <label for="project-sessions">Nombre de séances</label>
          <input id="project-sessions" v-model="form.totalSessions" class="input" type="number" min="0" step="1" inputmode="numeric">
        </div>

        <div class="field">
          <label for="project-unit-price">Prix unitaire séance (€)</label>
          <input id="project-unit-price" v-model="form.sessionUnitPrice" class="input" type="number" min="0" step="0.01" inputmode="decimal">
        </div>

        <div class="field field-full">
          <label for="project-description">Description</label>
          <textarea id="project-description" v-model="form.description" class="textarea" placeholder="Objectifs, public, contexte et résultats attendus." />
        </div>

        <div class="field field-full">
          <label for="project-comments">Commentaires internes</label>
          <textarea id="project-comments" v-model="form.internalComments" class="textarea" placeholder="Informations réservées à l’équipe IFICS." />
        </div>
      </div>

      <div class="actions" style="margin-top: 22px">
        <button class="btn btn-primary" type="submit" :disabled="saving">
          {{ saving ? 'Création…' : 'Créer le projet' }}
        </button>
        <NuxtLink class="btn btn-secondary" to="/dashboard/projects">
          Annuler
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
