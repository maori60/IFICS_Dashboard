<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Partenaire' })

type PartnerContact = { id:string; firstName:string; lastName:string; jobTitle:string|null; email:string|null; phone:string|null; isPrimary:boolean; notes:string|null }
type PartnerInteraction = { id:string; occurredAt:string; kind:string; summary:string; nextAction:string|null; nextActionAt:string|null }
type Partner = {
  id:string; name:string; type:string; stage:string; website:string|null; logoUrl:string|null; descriptionFr:string|null; descriptionEn:string|null; publicEnabled:boolean; notes:string|null;
  contacts:PartnerContact[]; interactions:PartnerInteraction[]; _count:{messages:number}
}

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data, error, refresh } = await useFetch<ApiSuccess<Partner>>(() => `/api/partners/${id.value}`)
const partner = computed(() => data.value?.data ?? null)
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('partner:write'))
const created = computed(() => route.query.created === '1')

const form = reactive({ name:'', type:'INSTITUTIONAL', stage:'IDENTIFIED', website:'', logoUrl:'', descriptionFr:'', descriptionEn:'', publicEnabled:false, notes:'' })
const contact = reactive({ firstName:'', lastName:'', jobTitle:'', email:'', phone:'', isPrimary:false, notes:'' })
const interaction = reactive({ occurredAt:'', kind:'MEETING', summary:'', nextAction:'', nextActionAt:'' })
const saving = ref(false)
const addingContact = ref(false)
const addingInteraction = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

watch(partner, (value) => {
  if (!value) return
  form.name=value.name;form.type=value.type;form.stage=value.stage;form.website=value.website||'';form.logoUrl=value.logoUrl||'';form.descriptionFr=value.descriptionFr||'';form.descriptionEn=value.descriptionEn||'';form.publicEnabled=value.publicEnabled;form.notes=value.notes||''
}, { immediate:true })

const fmt = (value:string|null) => value ? new Date(value).toLocaleString('fr-FR') : '—'

async function save() {
  if (!canWrite.value || saving.value) return
  saving.value=true;errorMessage.value='';successMessage.value=''
  try { await $fetch(`/api/partners/${id.value}`,{method:'PUT',body:form});await refresh();successMessage.value='Partenaire mis à jour.' }
  catch(error){errorMessage.value=apiErrorMessage(error,'Le partenaire n’a pas pu être mis à jour.')}
  finally{saving.value=false}
}

async function addContact() {
  if (!canWrite.value || addingContact.value) return
  addingContact.value=true;errorMessage.value='';successMessage.value=''
  try { await $fetch(`/api/partners/${id.value}/contacts`,{method:'POST',body:contact});Object.assign(contact,{firstName:'',lastName:'',jobTitle:'',email:'',phone:'',isPrimary:false,notes:''});await refresh();successMessage.value='Contact ajouté.' }
  catch(error){errorMessage.value=apiErrorMessage(error,'Le contact n’a pas pu être ajouté.')}
  finally{addingContact.value=false}
}

async function addInteraction() {
  if (!canWrite.value || addingInteraction.value) return
  addingInteraction.value=true;errorMessage.value='';successMessage.value=''
  try { await $fetch(`/api/partners/${id.value}/interactions`,{method:'POST',body:{...interaction,occurredAt:interaction.occurredAt||undefined,nextActionAt:interaction.nextActionAt||undefined}});Object.assign(interaction,{occurredAt:'',kind:'MEETING',summary:'',nextAction:'',nextActionAt:''});await refresh();successMessage.value='Interaction ajoutée.' }
  catch(error){errorMessage.value=apiErrorMessage(error,'L’interaction n’a pas pu être ajoutée.')}
  finally{addingInteraction.value=false}
}
</script>

<template>
  <div>
    <div class="page-head"><div><h1>{{ partner?.name || 'Partenaire' }}</h1><p>Fiche CRM, contacts et historique des échanges.</p></div><NuxtLink class="btn btn-secondary" to="/dashboard/partners">Retour aux partenaires</NuxtLink></div>
    <div v-if="created" class="alert alert-success" style="margin-bottom:18px">Partenaire créé. Complétez les contacts et interactions.</div>
    <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div><div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div><div v-if="error" class="alert alert-error">Impossible de charger ce partenaire.</div>
    <template v-else-if="partner">
      <form v-if="canWrite" class="card card-pad" style="margin-bottom:18px" @submit.prevent="save">
        <h2>Organisation</h2>
        <div class="form-grid">
          <div class="field field-full"><label for="partner-name">Nom *</label><input id="partner-name" v-model="form.name" class="input" maxlength="200" required></div>
          <div class="field"><label for="partner-type">Type</label><select id="partner-type" v-model="form.type" class="select"><option value="INSTITUTIONAL">Institutionnel</option><option value="COLLECTIVITY">Collectivité</option><option value="COMPANY">Entreprise</option><option value="PATRON">Mécène</option><option value="OPERATIONAL">Opérationnel</option><option value="TECHNICAL">Technique</option></select></div>
          <div class="field"><label for="partner-stage">Étape</label><select id="partner-stage" v-model="form.stage" class="select"><option value="IDENTIFIED">Identifié</option><option value="CONTACTED">Contacté</option><option value="MEETING">Rendez-vous</option><option value="PROPOSAL">Proposition</option><option value="NEGOTIATION">Négociation</option><option value="WON">Partenaire actif</option><option value="LOST">Perdu</option></select></div>
          <div class="field"><label for="partner-website">Site web</label><input id="partner-website" v-model="form.website" class="input" maxlength="500"></div>
          <div class="field"><label for="partner-logo">URL logo</label><input id="partner-logo" v-model="form.logoUrl" class="input" maxlength="500"></div>
          <div class="field field-full"><label for="partner-description-fr">Description FR</label><textarea id="partner-description-fr" v-model="form.descriptionFr" class="textarea" rows="4" /></div>
          <div class="field field-full"><label for="partner-description-en">Description EN</label><textarea id="partner-description-en" v-model="form.descriptionEn" class="textarea" rows="3" /></div>
          <div class="field field-full"><label for="partner-notes">Notes internes</label><textarea id="partner-notes" v-model="form.notes" class="textarea" rows="4" /></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:14px"><input v-model="form.publicEnabled" type="checkbox"> Affichage public autorisé</label>
        <button class="btn btn-primary" type="submit" style="margin-top:18px" :disabled="saving">{{ saving?'Enregistrement…':'Enregistrer' }}</button>
      </form>

      <div class="grid grid-2">
        <section class="card card-pad"><h2>Contacts</h2><div v-if="!partner.contacts.length" class="empty-state">Aucun contact.</div><div v-else style="display:grid;gap:10px"><article v-for="item in partner.contacts" :key="item.id" class="card card-pad"><div class="actions"><strong>{{ item.firstName }} {{ item.lastName }}</strong><span v-if="item.isPrimary" class="badge">Principal</span></div><p class="muted">{{ item.jobTitle || 'Fonction non renseignée' }}</p><p>{{ item.email || '—' }} · {{ item.phone || '—' }}</p></article></div></section>
        <section v-if="canWrite" class="card card-pad"><h2>Ajouter un contact</h2><form @submit.prevent="addContact"><div class="form-grid"><div class="field"><label for="contact-first">Prénom *</label><input id="contact-first" v-model="contact.firstName" class="input" required maxlength="100"></div><div class="field"><label for="contact-last">Nom *</label><input id="contact-last" v-model="contact.lastName" class="input" required maxlength="100"></div><div class="field"><label for="contact-job">Fonction</label><input id="contact-job" v-model="contact.jobTitle" class="input" maxlength="150"></div><div class="field"><label for="contact-email">E-mail</label><input id="contact-email" v-model="contact.email" class="input" type="email"></div><div class="field"><label for="contact-phone">Téléphone</label><input id="contact-phone" v-model="contact.phone" class="input" maxlength="30"></div></div><label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input v-model="contact.isPrimary" type="checkbox"> Contact principal</label><button class="btn btn-primary" type="submit" style="margin-top:16px" :disabled="addingContact">Ajouter</button></form></section>
      </div>

      <section class="card card-pad" style="margin-top:18px"><h2>Interactions</h2><div v-if="!partner.interactions.length" class="empty-state">Aucune interaction.</div><div v-else class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Résumé</th><th>Prochaine action</th></tr></thead><tbody><tr v-for="item in partner.interactions" :key="item.id"><td>{{ fmt(item.occurredAt) }}</td><td>{{ item.kind }}</td><td>{{ item.summary }}</td><td>{{ item.nextAction || '—' }}<br><small v-if="item.nextActionAt">{{ fmt(item.nextActionAt) }}</small></td></tr></tbody></table></div></section>

      <form v-if="canWrite" class="card card-pad" style="margin-top:18px" @submit.prevent="addInteraction"><h2>Ajouter une interaction</h2><div class="form-grid"><div class="field"><label for="interaction-kind">Type *</label><input id="interaction-kind" v-model="interaction.kind" class="input" maxlength="80" required placeholder="MEETING, EMAIL, CALL…"></div><div class="field"><label for="interaction-date">Date</label><input id="interaction-date" v-model="interaction.occurredAt" class="input" type="datetime-local"></div><div class="field field-full"><label for="interaction-summary">Résumé *</label><textarea id="interaction-summary" v-model="interaction.summary" class="textarea" rows="5" required maxlength="20000" /></div><div class="field"><label for="interaction-next">Prochaine action</label><input id="interaction-next" v-model="interaction.nextAction" class="input"></div><div class="field"><label for="interaction-next-date">Échéance</label><input id="interaction-next-date" v-model="interaction.nextActionAt" class="input" type="datetime-local"></div></div><button class="btn btn-primary" type="submit" style="margin-top:16px" :disabled="addingInteraction">Ajouter l’interaction</button></form>
    </template>
  </div>
</template>

<style scoped>h2{margin-top:0}</style>
