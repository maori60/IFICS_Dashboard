<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un ticket' })

type ProjectOption = { id:string; reference:string|null; title:string; status:string }

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key:'session-me' })
const { data: projectsData } = await useFetch<ApiSuccess<ProjectOption[]>>('/api/projects/options')
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('ticket:write'))
const projects = computed(() => projectsData.value?.data ?? [])

const form = reactive({ projectId:'', category:'OTHER', priority:'NORMAL', subject:'', description:'' })
const saving = ref(false)
const errorMessage = ref('')

async function submit() {
  if (!canWrite.value || saving.value) return
  saving.value=true; errorMessage.value=''
  try {
    await $fetch('/api/tickets/create',{ method:'POST', body:{ ...form, projectId: form.projectId || undefined } })
    await navigateTo('/dashboard/tickets?created=1')
  } catch(error) { errorMessage.value=apiErrorMessage(error,'Le ticket n’a pas pu être créé.') }
  finally { saving.value=false }
}
</script>

<template>
  <div>
    <div class="page-head"><div><h1>Nouveau ticket</h1><p>Décrivez l’incident ou la demande pour assurer son suivi.</p></div><NuxtLink class="btn btn-secondary" to="/dashboard/tickets">Retour</NuxtLink></div>
    <div v-if="!canWrite" class="alert alert-error">Votre rôle ne permet pas de créer un ticket.</div>
    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>
      <div class="form-grid">
        <div class="field"><label for="ticket-category">Catégorie *</label><select id="ticket-category" v-model="form.category" class="select" required><option value="ADMIN">Administration</option><option value="BILLING">Facturation</option><option value="CONTRACT">Contrat</option><option value="PROJECT">Projet / mission</option><option value="PLATFORM">Plateforme</option><option value="DOCUMENT">Document</option><option value="IT">IT</option><option value="HR">RH</option><option value="SECURITY">Sécurité</option><option value="OTHER">Autre</option></select></div>
        <div class="field"><label for="ticket-priority">Priorité *</label><select id="ticket-priority" v-model="form.priority" class="select" required><option value="LOW">Basse</option><option value="NORMAL">Normale</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option></select></div>
        <div class="field field-full"><label for="ticket-project">Projet concerné</label><select id="ticket-project" v-model="form.projectId" class="select"><option value="">Aucun projet</option><option v-for="project in projects" :key="project.id" :value="project.id">{{ project.reference ? `${project.reference} — ` : '' }}{{ project.title }}</option></select></div>
        <div class="field field-full"><label for="ticket-subject">Objet *</label><input id="ticket-subject" v-model="form.subject" class="input" maxlength="255" required placeholder="Résumé du besoin"></div>
        <div class="field field-full"><label for="ticket-description">Description *</label><textarea id="ticket-description" v-model="form.description" class="textarea" rows="8" required minlength="5" maxlength="20000" placeholder="Contexte, problème rencontré, impact et résultat attendu." /></div>
      </div>
      <div class="actions" style="margin-top:22px"><button class="btn btn-primary" type="submit" :disabled="saving">{{ saving?'Création…':'Créer le ticket' }}</button><NuxtLink class="btn btn-secondary" to="/dashboard/tickets">Annuler</NuxtLink></div>
    </form>
  </div>
</template>
