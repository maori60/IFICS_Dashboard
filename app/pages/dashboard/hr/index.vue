<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'

definePageMeta({ layout:'dashboard', middleware:'auth' })
useHead({ title:'Ressources humaines' })

type HrUser={id:string;firstName:string;lastName:string;email:string;status:string}
type Hr={id:string;userId:string;employmentType:string;startDate:string|null;endDate:string|null;skills:string[];notes:string|null;user:HrUser|null;manager:HrUser|null;absences:{id:string;type:string;status:string;startDate:string;endDate:string}[];trainings:{id:string;title:string;provider:string|null;completedAt:string|null;expiresAt:string|null}[];reviews:{id:string;reviewDate:string;summary:string}[]}
const route=useRoute()
const {data:session}=await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me',{key:'session-me'})
const {data,error,refresh}=await useFetch<ApiSuccess<Hr[]>>('/api/hr')
const profiles=computed(()=>data.value?.data??[])
const permissions=computed(()=>session.value?.data.user.permissions??[])
const canWrite=computed(()=>permissions.value.includes('*')||permissions.value.includes('hr:write'))
const created=computed(()=>route.query.created==='1')
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('fr-FR'):'—'
function typeLabel(value:string){return({EMPLOYEE:'Salarié',VOLUNTEER:'Bénévole',INTERN:'Stagiaire',APPRENTICE:'Alternant',EXTERNAL:'Externe'} as Record<string,string>)[value]||value}
</script>
<template><div><div class="page-head"><div><h1>Ressources humaines</h1><p>Profils internes, compétences, absences, formations et évaluations.</p></div><div class="actions"><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/hr/create">Nouveau profil RH</NuxtLink><button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button></div></div><div v-if="created" class="alert alert-success" style="margin-bottom:18px">Profil RH enregistré.</div><div v-if="error" class="alert alert-error">Impossible de charger les données RH.</div><div v-else-if="!profiles.length" class="empty-state"><p>Aucun profil RH enregistré.</p><NuxtLink v-if="canWrite" class="btn btn-primary" to="/dashboard/hr/create">Créer le premier profil RH</NuxtLink></div><div v-else class="table-wrap"><table><thead><tr><th>Profil</th><th>Type</th><th>Période</th><th>Manager</th><th>Compétences</th><th>Absences</th><th>Formations</th><th>Évaluations</th><th>Action</th></tr></thead><tbody><tr v-for="profile in profiles" :key="profile.id"><td><strong>{{ profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : profile.userId }}</strong><br><small v-if="profile.user">{{ profile.user.email }}</small></td><td>{{ typeLabel(profile.employmentType) }}</td><td>{{ date(profile.startDate) }} → {{ date(profile.endDate) }}</td><td>{{ profile.manager ? `${profile.manager.firstName} ${profile.manager.lastName}` : '—' }}</td><td>{{ profile.skills.slice(0,3).join(', ') || '—' }}</td><td>{{ profile.absences.length }}</td><td>{{ profile.trainings.length }}</td><td>{{ profile.reviews.length }}</td><td><NuxtLink class="btn btn-secondary" :to="`/dashboard/hr/${profile.id}`">Ouvrir</NuxtLink></td></tr></tbody></table></div></div></template>
<style scoped>.empty-state p{margin-top:0}</style>
