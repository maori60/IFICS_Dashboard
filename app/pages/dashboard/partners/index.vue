<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Partenaires' })

type Partner = {
  id: string
  name: string
  type: string
  stage: string
  publicEnabled: boolean
  website: string | null
  contacts: { id: string; firstName: string; lastName: string; email: string | null; isPrimary: boolean }[]
  interactions: { id: string; kind: string; summary: string; occurredAt: string }[]
  _count: { messages: number }
}

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Partner[]>>('/api/partners')
const partners = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('partner:write'))
const created = computed(() => route.query.created === '1')

function typeLabel(value: string) {
  return ({ INSTITUTIONAL: 'Institutionnel', COLLECTIVITY: 'Collectivité', COMPANY: 'Entreprise', PATRON: 'Mécène', OPERATIONAL: 'Opérationnel', TECHNICAL: 'Technique' } as Record<string,string>)[value] || value
}
function stageLabel(value: string) {
  return ({ IDENTIFIED: 'Identifié', CONTACTED: 'Contacté', MEETING: 'Rendez-vous', PROPOSAL: 'Proposition', NEGOTIATION: 'Négociation', WON: 'Partenaire actif', LOST: 'Perdu' } as Record<string,string>)[value] || value
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Partenaires & CRM</h1><p>Relations institutionnelles, opérationnelles et mécénat.</p></div>
      <div class="actions">
        <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/partners/create">Nouveau partenaire</NuxtLink>
        <button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button>
      </div>
    </div>
    <div v-if="created" class="alert alert-success" style="margin-bottom:18px">Partenaire créé avec succès.</div>
    <div v-if="error" class="alert alert-error">Impossible de charger les partenaires.</div>
    <div v-else-if="!partners.length" class="empty-state">
      <p>Aucun partenaire enregistré.</p>
      <NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/partners/create">Créer le premier partenaire</NuxtLink>
    </div>
    <div v-else class="grid grid-2">
      <article v-for="partner in partners" :key="partner.id" class="card card-pad">
        <div class="actions">
          <span class="badge">{{ typeLabel(partner.type) }}</span>
          <span class="badge badge-muted">{{ stageLabel(partner.stage) }}</span>
          <span v-if="partner.publicEnabled" class="badge">Public</span>
        </div>
        <h2>{{ partner.name }}</h2>
        <p class="muted">
          Contact principal :
          {{ partner.contacts.find(contact => contact.isPrimary)?.firstName || '—' }}
          {{ partner.contacts.find(contact => contact.isPrimary)?.lastName || '' }}
        </p>
        <p>{{ partner.interactions.length }} interaction(s) récente(s) · {{ partner._count.messages }} message(s)</p>
        <NuxtLink class="btn btn-secondary" :to="`/dashboard/partners/${partner.id}`">Ouvrir</NuxtLink>
      </article>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 14px 0 6px; }
.empty-state p { margin-top: 0; }
</style>
