<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout:'dashboard', middleware:'auth' })
useHead({ title:'Ticket support' })

type TicketComment={id:string;authorUserId:string|null;body:string;internal:boolean;createdAt:string}
type Ticket={id:string;number:string;category:string;priority:string;status:string;subject:string;description:string;requesterUserId:string|null;requesterEmail:string|null;projectId:string|null;assigneeUserId:string|null;createdAt:string;updatedAt:string;resolvedAt:string|null;closedAt:string|null;comments:TicketComment[]}
type Assignee={id:string;firstName:string;lastName:string;email:string;role:{code:string;name:string}}

const route=useRoute();const id=computed(()=>String(route.params.id))
const {data:session}=await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me',{key:'session-me'})
const {data,error,refresh}=await useFetch<ApiSuccess<Ticket>>(()=>`/api/tickets/${id.value}`)
const ticket=computed(()=>data.value?.data??null)
const permissions=computed(()=>session.value?.data.user.permissions??[])
const canWrite=computed(()=>permissions.value.includes('*')||permissions.value.includes('ticket:write'))
const canManage=computed(()=>permissions.value.includes('*')||permissions.value.includes('ticket:manage'))
const {data:assigneesData}=await useFetch<ApiSuccess<Assignee[]>>('/api/tickets/assignees',{immediate:canManage.value})
const assignees=computed(()=>assigneesData.value?.data??[])

const comment=ref('');const internal=ref(false);const posting=ref(false);const managing=ref(false);const errorMessage=ref('');const successMessage=ref('')
const manageForm=reactive({status:'',priority:'',assigneeUserId:''})
watch(ticket,(value)=>{if(!value)return;manageForm.status=value.status;manageForm.priority=value.priority;manageForm.assigneeUserId=value.assigneeUserId||''},{immediate:true})
const fmt=(value:string|null)=>value?new Date(value).toLocaleString('fr-FR'):'—'

async function addComment(){if(!canWrite.value||posting.value||!comment.value.trim())return;posting.value=true;errorMessage.value='';successMessage.value='';try{await $fetch(`/api/tickets/${id.value}/comment`,{method:'POST',body:{body:comment.value,internal:internal.value}});comment.value='';internal.value=false;await refresh();successMessage.value='Commentaire ajouté.'}catch(error){errorMessage.value=apiErrorMessage(error,'Le commentaire n’a pas pu être ajouté.')}finally{posting.value=false}}
async function manage(){if(!canManage.value||managing.value)return;managing.value=true;errorMessage.value='';successMessage.value='';try{await $fetch(`/api/tickets/${id.value}/manage`,{method:'POST',body:{status:manageForm.status,priority:manageForm.priority,assigneeUserId:manageForm.assigneeUserId||null}});await refresh();successMessage.value='Ticket mis à jour.'}catch(error){errorMessage.value=apiErrorMessage(error,'Le ticket n’a pas pu être mis à jour.')}finally{managing.value=false}}
</script>

<template>
  <div>
    <div class="page-head"><div><h1>{{ ticket?.number || 'Ticket' }}</h1><p>{{ ticket?.subject || 'Support IFICS' }}</p></div><NuxtLink class="btn btn-secondary" to="/dashboard/tickets">Retour aux tickets</NuxtLink></div>
    <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div><div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div><div v-if="error" class="alert alert-error">Impossible de charger ce ticket.</div>
    <template v-else-if="ticket">
      <section class="card card-pad" style="margin-bottom:18px"><div class="actions"><span class="badge">{{ ticket.status }}</span><span class="badge" :class="ticket.priority==='URGENT'?'badge-danger':ticket.priority==='HIGH'?'badge-warning':''">{{ ticket.priority }}</span><span class="badge badge-muted">{{ ticket.category }}</span></div><h2>{{ ticket.subject }}</h2><p style="white-space:pre-wrap">{{ ticket.description }}</p><p class="muted">Créé le {{ fmt(ticket.createdAt) }} · Dernière mise à jour {{ fmt(ticket.updatedAt) }}</p></section>

      <section v-if="canManage" class="card card-pad" style="margin-bottom:18px"><h2>Gestion du ticket</h2><div class="form-grid"><div class="field"><label for="ticket-status">Statut</label><select id="ticket-status" v-model="manageForm.status" class="select"><option value="NEW">Nouveau</option><option value="IN_PROGRESS">En cours</option><option value="WAITING_REQUESTER">En attente du demandeur</option><option value="RESOLVED">Résolu</option><option value="CLOSED">Fermé</option></select></div><div class="field"><label for="ticket-priority">Priorité</label><select id="ticket-priority" v-model="manageForm.priority" class="select"><option value="LOW">Basse</option><option value="NORMAL">Normale</option><option value="HIGH">Haute</option><option value="URGENT">Urgente</option></select></div><div class="field field-full"><label for="ticket-assignee">Assigné à</label><select id="ticket-assignee" v-model="manageForm.assigneeUserId" class="select"><option value="">Non assigné</option><option v-for="user in assignees" :key="user.id" :value="user.id">{{ user.firstName }} {{ user.lastName }} — {{ user.role.name }}</option></select></div></div><button class="btn btn-primary" type="button" :disabled="managing" @click="manage">{{ managing?'Enregistrement…':'Enregistrer la gestion' }}</button></section>

      <section class="card card-pad" style="margin-bottom:18px"><h2>Conversation</h2><div v-if="!ticket.comments.length" class="empty-state">Aucun commentaire.</div><div v-else style="display:grid;gap:12px"><article v-for="item in ticket.comments" :key="item.id" class="card card-pad"><div class="actions"><span v-if="item.internal" class="badge badge-warning">Interne</span><small class="muted">{{ fmt(item.createdAt) }}</small></div><p style="white-space:pre-wrap;margin-bottom:0">{{ item.body }}</p></article></div></section>

      <form v-if="canWrite" class="card card-pad" @submit.prevent="addComment"><h2>Ajouter un commentaire</h2><div class="field"><label for="ticket-comment">Message *</label><textarea id="ticket-comment" v-model="comment" class="textarea" rows="5" required maxlength="20000" /></div><label v-if="canManage" style="display:flex;gap:8px;align-items:center;margin-top:12px"><input v-model="internal" type="checkbox"> Commentaire interne (invisible au demandeur externe)</label><div class="actions" style="margin-top:18px"><button class="btn btn-primary" type="submit" :disabled="posting||!comment.trim()">{{ posting?'Envoi…':'Ajouter le commentaire' }}</button></div></form>
    </template>
  </div>
</template>

<style scoped>h2{margin-top:0}</style>
