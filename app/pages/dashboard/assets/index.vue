<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout:'dashboard', middleware:'auth' })
useHead({ title:'Parc IT' })

type Asset={id:string;inventoryTag:string;type:string;brand:string|null;model:string|null;serialNumber:string|null;status:string;assignedUserId:string|null;location:string|null;warrantyUntil:string|null}
const route=useRoute()
const {data:session}=await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me',{key:'session-me'})
const {data,error,refresh}=await useFetch<ApiSuccess<Asset[]>>('/api/assets')
const assets=computed(()=>data.value?.data??[])
const permissions=computed(()=>session.value?.data.user.permissions??[])
const canWrite=computed(()=>permissions.value.includes('*')||permissions.value.includes('it:write'))
const created=computed(()=>route.query.created==='1')
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('fr-FR'):'—'
function statusLabel(value:string){return({STOCK:'En stock',ASSIGNED:'Affecté',MAINTENANCE:'Maintenance',RETIRED:'Retiré',LOST:'Perdu'} as Record<string,string>)[value]||value}
</script>

<template><div><div class="page-head"><div><h1>Parc IT</h1><p>Inventaire, affectations, garanties et cycle de vie.</p></div><div class="actions"><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/assets/create">Nouveau matériel</NuxtLink><button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button></div></div><div v-if="created" class="alert alert-success" style="margin-bottom:18px">Matériel créé.</div><div v-if="error" class="alert alert-error">Impossible de charger le parc.</div><div v-else-if="!assets.length" class="empty-state"><p>Aucun matériel enregistré.</p><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/assets/create">Ajouter le premier matériel</NuxtLink></div><div v-else class="table-wrap"><table><thead><tr><th>Référence</th><th>Type</th><th>Matériel</th><th>Localisation</th><th>Garantie</th><th>Statut</th><th>Action</th></tr></thead><tbody><tr v-for="asset in assets" :key="asset.id"><td><strong>{{ asset.inventoryTag }}</strong></td><td>{{ asset.type }}</td><td>{{ [asset.brand,asset.model].filter(Boolean).join(' ') || '—' }}<br><small>{{ asset.serialNumber }}</small></td><td>{{ asset.location || '—' }}</td><td>{{ date(asset.warrantyUntil) }}</td><td><span class="badge">{{ statusLabel(asset.status) }}</span></td><td><NuxtLink class="btn btn-secondary" :to="`/dashboard/assets/${asset.id}`">Ouvrir</NuxtLink></td></tr></tbody></table></div></div></template>
<style scoped>.empty-state p{margin-top:0}</style>
