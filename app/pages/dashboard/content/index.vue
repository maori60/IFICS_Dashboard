<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Communication' })

type Entry = { id:string; kind:string; slug:string; titleFr:string; titleEn:string|null; status:string; featured:boolean; publishedAt:string|null; scheduledAt:string|null; updatedAt:string }

const route = useRoute()
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key:'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Entry[]>>('/api/content')
const entries = computed(() => data.value?.data ?? [])
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('content:write'))
const created = computed(() => route.query.created === '1')
const date = (value:string|null) => value ? new Date(value).toLocaleString('fr-FR') : '—'

function kindLabel(value:string){return ({PAGE:'Page',ARTICLE:'Article',NEWS:'Actualité',RND:'R&D',ACTIVITY_REPORT:'Rapport d’activité'} as Record<string,string>)[value]||value}
function statusLabel(value:string){return ({DRAFT:'Brouillon',REVIEW:'En revue',APPROVED:'Approuvé',SCHEDULED:'Programmé',PUBLISHED:'Publié',ARCHIVED:'Archivé'} as Record<string,string>)[value]||value}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Communication & CMS</h1><p>Contenus publics soumis au workflow de validation.</p></div>
      <div class="actions"><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/content/create">Nouveau contenu</NuxtLink><button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button></div>
    </div>
    <div v-if="created" class="alert alert-success" style="margin-bottom:18px">Contenu créé avec succès.</div>
    <div v-if="error" class="alert alert-error">Impossible de charger les contenus.</div>
    <div v-else-if="!entries.length" class="empty-state"><p>Aucun contenu enregistré.</p><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/content/create">Créer le premier contenu</NuxtLink></div>
    <div v-else class="table-wrap"><table><thead><tr><th>Titre</th><th>Type</th><th>Slug</th><th>Statut</th><th>Publication</th><th>Action</th></tr></thead><tbody><tr v-for="entry in entries" :key="entry.id"><td><strong>{{ entry.titleFr }}</strong><br><small v-if="entry.titleEn">EN : {{ entry.titleEn }}</small></td><td>{{ kindLabel(entry.kind) }}</td><td>{{ entry.slug }}</td><td><span class="badge">{{ statusLabel(entry.status) }}</span><span v-if="entry.featured" class="badge badge-muted" style="margin-left:6px">À la une</span></td><td>{{ entry.status==='SCHEDULED' ? date(entry.scheduledAt) : date(entry.publishedAt) }}</td><td><NuxtLink class="btn btn-secondary" :to="`/dashboard/content/${entry.id}`">Ouvrir</NuxtLink></td></tr></tbody></table></div>
  </div>
</template>

<style scoped>.empty-state p{margin-top:0}</style>
