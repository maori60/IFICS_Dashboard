<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Vue générale' })

const { data: me } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me')
const permissions = computed(() => new Set(me.value?.data.user.permissions ?? []))
const can = (permission: string) => permissions.value.has('*') || permissions.value.has(permission)
const modules = computed(() => [
  { title: 'Projets', text: 'Planification, équipes, documents et bilans.', to: '/dashboard/projects', permission: 'project:read' },
  { title: 'Clients', text: 'Collectivités, structures et contacts opérationnels.', to: '/dashboard/clients', permission: 'client:read' },
  { title: 'Intervenants', text: 'Missions, conformité documentaire et activité.', to: '/dashboard/intervenors', permission: 'intervenor:read' },
  { title: 'Facturation', text: 'Devis, factures, statuts et échéances.', to: '/dashboard/billing', permission: 'billing:read' },
  { title: 'Support', text: 'Incidents, demandes, priorités et suivi.', to: '/dashboard/tickets', permission: 'ticket:read' },
  { title: 'Partenariats', text: 'CRM, contacts et historique des échanges.', to: '/dashboard/partners', permission: 'partner:read' },
  { title: 'Communication', text: 'Contenus publics et workflow de publication.', to: '/dashboard/content', permission: 'content:read' },
  { title: 'Innovation & R&D', text: 'Idées, prototypes, pilotes et documentation.', to: '/dashboard/rnd', permission: 'rnd:read' },
  { title: 'Parc IT', text: 'Matériels, affectations, garanties et états.', to: '/dashboard/assets', permission: 'it:read' },
  { title: 'Ressources humaines', text: 'Profils, absences, formations et évaluations.', to: '/dashboard/hr', permission: 'hr:read' },
].filter(item => can(item.permission)))
</script>

<template><div><div class="page-head"><div><p class="eyebrow">Espace IFICS</p><h1>Bonjour {{ me?.data.user.firstName }}</h1><p>Voici les modules accessibles avec votre rôle {{ me?.data.user.roleName }}.</p></div></div><div class="grid grid-3"><NuxtLink v-for="module in modules" :key="module.to" :to="module.to" class="card card-pad module-card"><span class="badge">Module</span><h2>{{ module.title }}</h2><p>{{ module.text }}</p><strong>Ouvrir →</strong></NuxtLink></div></div></template>
<style scoped>.module-card{text-decoration:none;transition:transform .18s ease,box-shadow .18s ease}.module-card:hover{transform:translateY(-2px);box-shadow:var(--ifics-shadow)}.module-card h2{font-size:1.2rem;margin:14px 0 6px}.module-card p{color:var(--ifics-muted);min-height:52px}.module-card strong{color:var(--ifics-green-700)}</style>
