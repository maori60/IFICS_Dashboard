<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout:'dashboard', middleware:'auth' })
useHead({ title:'Innovation & R&D' })

type Rnd={id:string;title:string;description:string|null;status:string;budget:string|null;repoUrl:string|null;documentationUrl:string|null;publicEnabled:boolean;updatedAt:string}
const route=useRoute()
const {data:session}=await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me',{key:'session-me'})
const {data,error,refresh}=await useFetch<ApiSuccess<Rnd[]>>('/api/rnd')
const items=computed(()=>data.value?.data??[])
const permissions=computed(()=>session.value?.data.user.permissions??[])
const canWrite=computed(()=>permissions.value.includes('*')||permissions.value.includes('rnd:write'))
const created=computed(()=>route.query.created==='1')
function statusLabel(value:string){return({IDEA:'Idée',EXPLORATION:'Exploration',PROTOTYPE:'Prototype',PILOT:'Pilote',ACTIVE:'Actif',ARCHIVED:'Archivé'} as Record<string,string>)[value]||value}
</script>

<template><div><div class="page-head"><div><h1>Innovation & R&D</h1><p>Idées, expérimentations, prototypes et projets techniques.</p></div><div class="actions"><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/rnd/create">Nouveau projet R&D</NuxtLink><button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button></div></div><div v-if="created" class="alert alert-success" style="margin-bottom:18px">Projet R&D créé.</div><div v-if="error" class="alert alert-error">Impossible de charger la R&D.</div><div v-else-if="!items.length" class="empty-state"><p>Aucun projet R&D enregistré.</p><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/rnd/create">Créer le premier projet R&D</NuxtLink></div><div v-else class="grid grid-2"><article v-for="item in items" :key="item.id" class="card card-pad"><div class="actions"><span class="badge">{{ statusLabel(item.status) }}</span><span v-if="item.publicEnabled" class="badge">Public autorisé</span></div><h2>{{ item.title }}</h2><p class="muted">{{ item.description || 'Aucune description.' }}</p><p v-if="item.budget"><strong>Budget :</strong> {{ new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(item.budget)) }}</p><div class="actions"><NuxtLink class="btn btn-secondary" :to="`/dashboard/rnd/${item.id}`">Ouvrir</NuxtLink><a v-if="item.repoUrl" :href="item.repoUrl" class="btn btn-secondary" target="_blank" rel="noopener">Dépôt</a><a v-if="item.documentationUrl" :href="item.documentationUrl" class="btn btn-secondary" target="_blank" rel="noopener">Documentation</a></div></article></div></div></template>
<style scoped>h2{margin:14px 0 6px}.empty-state p{margin-top:0}</style>
