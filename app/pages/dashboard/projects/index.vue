<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Projets' })

type Project = {
  id: string
  reference: string | null
  title: string
  status: string
  startDate: string | null
  endDate: string | null
  plannedBudget: string | null
  actualBudget: string | null
  projectClients: { client: { id: string; name: string } }[]
  projectIntervenors: { assignmentStatus: string; intervenor: { id: string; firstName: string; lastName: string } }[]
  _count: { documents: number; reports: number; billingDocuments: number }
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Project[]>>('/api/projects')

const projects = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canCreate = computed(() => permissions.value.includes('*') || permissions.value.includes('project:write'))
const created = computed(() => route.query.created === '1')
const date = (value: string | null) => value ? new Date(value).toLocaleDateString('fr-FR') : '—'
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Projets</h1>
        <p>Suivi opérationnel des actions IFICS.</p>
      </div>
      <div class="actions">
        <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/projects/create">
          Nouveau projet
        </NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">
          Actualiser
        </button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">
      Le projet a été créé avec succès.
    </div>

    <div v-if="error" class="alert alert-error">
      Impossible de charger les projets.
    </div>

    <div v-else-if="!projects.length" class="empty-state">
      <p>Aucun projet accessible.</p>
      <NuxtLink v-if="canCreate" class="btn btn-primary" to="/dashboard/projects/create">
        Créer le premier projet
      </NuxtLink>
    </div>

    <div v-else class="grid grid-2">
      <article v-for="project in projects" :key="project.id" class="card card-pad">
        <div class="actions">
          <span class="badge">{{ project.status }}</span>
          <span v-if="project.reference" class="badge badge-muted">{{ project.reference }}</span>
        </div>
        <h2>{{ project.title }}</h2>
        <p class="muted">{{ date(project.startDate) }} → {{ date(project.endDate) }}</p>
        <p><strong>Client :</strong> {{ project.projectClients[0]?.client.name || 'Non rattaché' }}</p>
        <p>
          <strong>Intervenants :</strong> {{ project.projectIntervenors.length }} ·
          <strong>Documents :</strong> {{ project._count.documents }} ·
          <strong>Bilans :</strong> {{ project._count.reports }}
        </p>
      </article>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 14px 0 6px; }
.empty-state p { margin-top: 0; }
</style>
