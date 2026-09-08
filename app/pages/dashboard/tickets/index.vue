<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Support' })

type Ticket = { id:string; number:string; category:string; priority:string; status:string; subject:string; createdAt:string; updatedAt:string; _count:{ comments:number } }

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Ticket[]>>('/api/tickets')
const tickets = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('ticket:write'))
const created = computed(() => route.query.created === '1')
const date = (value:string) => new Date(value).toLocaleString('fr-FR')
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Support & tickets</h1><p>Incidents et demandes adressés aux équipes IFICS.</p></div>
      <div class="actions">
        <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/tickets/create">Nouveau ticket</NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button>
      </div>
    </div>

    <div v-if="created" class="alert alert-success" style="margin-bottom:18px">Le ticket a été créé.</div>
    <div v-if="error" class="alert alert-error">Impossible de charger les tickets.</div>
    <div v-else-if="!tickets.length" class="empty-state">
      <p>Aucun ticket ouvert ou historique accessible.</p>
      <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/tickets/create">Créer un ticket</NuxtLink>
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Ticket</th><th>Objet</th><th>Catégorie</th><th>Priorité</th><th>Commentaires</th><th>Statut</th><th>Mis à jour</th><th>Action</th></tr></thead>
        <tbody>
          <tr v-for="ticket in tickets" :key="ticket.id">
            <td><strong>{{ ticket.number }}</strong></td>
            <td>{{ ticket.subject }}</td>
            <td>{{ ticket.category }}</td>
            <td><span class="badge" :class="ticket.priority==='URGENT'?'badge-danger':ticket.priority==='HIGH'?'badge-warning':''">{{ ticket.priority }}</span></td>
            <td>{{ ticket._count.comments }}</td><td>{{ ticket.status }}</td><td>{{ date(ticket.updatedAt) }}</td>
            <td><NuxtLink class="btn btn-secondary" :to="`/dashboard/tickets/${ticket.id}`">Ouvrir</NuxtLink></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>.empty-state p{margin-top:0}</style>
