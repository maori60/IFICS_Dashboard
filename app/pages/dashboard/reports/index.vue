<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Bilans' })

type Report = {
  id: string
  title: string | null
  sessionDate: string
  studentsCount: number | null
  status: string
  currentVersion: number
  submittedAt: string | null
  validatedAt: string | null
  project: { id: string; title: string; reference: string | null }
  intervenor: { id: string; firstName: string; lastName: string } | null
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Report[]>>('/api/reports')

const reports = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('report:write'))
const created = computed(() => route.query.created === '1')
const fmt = (value: string) => new Date(value).toLocaleDateString('fr-FR')

function statusLabel(status: string) {
  return ({
    NOT_STARTED: 'À démarrer',
    IN_PROGRESS: 'En cours',
    SUBMITTED: 'Soumis',
    VALIDATED: 'Validé',
    REFUSED: 'Refusé',
  } as Record<string, string>)[status] || status
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Bilans</h1>
        <p>Bilans d’intervention, soumission et validation.</p>
      </div>
      <div class="actions">
        <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/reports/create">
          Nouveau bilan
        </NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">
          Actualiser
        </button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom: 18px">
      Le bilan a été créé. Vous pouvez maintenant saisir son contenu.
    </div>

    <div v-if="error" class="alert alert-error">
      Impossible de charger les bilans.
    </div>

    <div v-else-if="!reports.length" class="empty-state">
      <p>Aucun bilan accessible.</p>
      <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/reports/create">
        Créer le premier bilan
      </NuxtLink>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Projet</th>
            <th>Intervenant</th>
            <th>Participants</th>
            <th>Version</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in reports" :key="report.id">
            <td>{{ fmt(report.sessionDate) }}</td>
            <td>
              <strong>{{ report.title || report.project.title }}</strong><br>
              <small>{{ report.project.reference || report.project.title }}</small>
            </td>
            <td>{{ report.intervenor ? `${report.intervenor.firstName} ${report.intervenor.lastName}` : '—' }}</td>
            <td>{{ report.studentsCount ?? '—' }}</td>
            <td>v{{ report.currentVersion }}</td>
            <td><span class="badge">{{ statusLabel(report.status) }}</span></td>
            <td>
              <NuxtLink class="btn btn-secondary" :to="`/dashboard/reports/${report.id}`">
                Ouvrir
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.empty-state p { margin-top: 0; }
</style>
