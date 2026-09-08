<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un bilan' })

type Project = {
  id: string
  reference: string | null
  title: string
  status: string
  projectIntervenors: {
    assignmentStatus: string
    intervenor: { id: string; firstName: string; lastName: string }
  }[]
}

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data: projectsData, error: projectsError } = await useFetch<ApiSuccess<Project[]>>('/api/projects')

const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('report:write'))
const roleCode = computed(() => session.value?.data.user.roleCode || '')
const projects = computed(() => projectsData.value?.data ?? [])

const form = reactive({
  projectId: '',
  intervenorId: '',
  title: 'Bilan de séance',
  sessionDate: '',
  studentsCount: '',
})

const selectedProject = computed(() => projects.value.find(project => project.id === form.projectId) || null)
const assignedIntervenors = computed(() => selectedProject.value?.projectIntervenors ?? [])
const saving = ref(false)
const errorMessage = ref('')

watch(() => form.projectId, () => {
  form.intervenorId = ''
})

async function submit() {
  if (!canWrite.value || saving.value) return
  saving.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<ApiSuccess<{ id: string }>>('/api/reports/create', {
      method: 'POST',
      body: {
        projectId: form.projectId,
        intervenorId: roleCode.value === 'INTERVENOR' ? undefined : form.intervenorId || undefined,
        title: form.title,
        sessionDate: form.sessionDate,
        studentsCount: form.studentsCount,
      },
    })

    await navigateTo(`/dashboard/reports/${response.data.id}?created=1`)
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le bilan n’a pas pu être créé.')
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
        <h1>Créer un bilan</h1>
        <p>Préparez le bilan d’une séance réalisée dans le cadre d’un projet IFICS.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/reports">
        Retour aux bilans
      </NuxtLink>
    </div>

    <div v-if="!canWrite" class="alert alert-error">
      Votre rôle ne permet pas de créer un bilan.
    </div>

    <div v-else-if="projectsError" class="alert alert-error">
      Impossible de charger les projets accessibles.
    </div>

    <div v-else-if="!projects.length" class="card card-pad">
      <h2>Aucun projet disponible</h2>
      <p class="muted">Un bilan doit être rattaché à un projet accessible.</p>
      <NuxtLink class="btn btn-primary" to="/dashboard/projects">
        Voir les projets
      </NuxtLink>
    </div>

    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom: 18px">
        {{ errorMessage }}
      </div>

      <div class="form-grid">
        <div class="field field-full">
          <label for="report-project">Projet *</label>
          <select id="report-project" v-model="form.projectId" class="select" required>
            <option value="" disabled>Sélectionner un projet</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.reference ? `${project.reference} — ` : '' }}{{ project.title }}
            </option>
          </select>
        </div>

        <div v-if="roleCode !== 'INTERVENOR'" class="field field-full">
          <label for="report-intervenor">Intervenant affecté</label>
          <select id="report-intervenor" v-model="form.intervenorId" class="select" :disabled="!form.projectId">
            <option value="">Bilan projet sans intervenant</option>
            <option v-for="link in assignedIntervenors" :key="link.intervenor.id" :value="link.intervenor.id">
              {{ link.intervenor.firstName }} {{ link.intervenor.lastName }} — {{ link.assignmentStatus }}
            </option>
          </select>
          <span v-if="form.projectId && !assignedIntervenors.length" class="help">
            Aucun intervenant n’est encore affecté à ce projet. Vous pouvez créer un bilan projet ou affecter d’abord un intervenant.
          </span>
        </div>

        <div class="field">
          <label for="report-title">Titre</label>
          <input id="report-title" v-model="form.title" class="input" maxlength="255">
        </div>

        <div class="field">
          <label for="report-date">Date de séance *</label>
          <input id="report-date" v-model="form.sessionDate" class="input" type="date" required>
        </div>

        <div class="field">
          <label for="report-students">Nombre de participants</label>
          <input id="report-students" v-model="form.studentsCount" class="input" type="number" min="0" step="1" inputmode="numeric">
        </div>
      </div>

      <div class="actions" style="margin-top: 22px">
        <button class="btn btn-primary" type="submit" :disabled="saving || !form.projectId || !form.sessionDate">
          {{ saving ? 'Création…' : 'Créer et rédiger le bilan' }}
        </button>
        <NuxtLink class="btn btn-secondary" to="/dashboard/reports">
          Annuler
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
