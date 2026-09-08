<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un document de facturation' })

type Client = { id: string; name: string; status: string }
type Project = { id: string; reference: string | null; title: string; projectClients: { client: { id: string; name: string } }[] }
type Line = { description: string; quantity: string; unitPrice: string }

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const { data: clientsData } = await useFetch<ApiSuccess<Client[]>>('/api/clients')
const { data: projectsData } = await useFetch<ApiSuccess<Project[]>>('/api/projects')

const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('billing:write'))
const clients = computed(() => (clientsData.value?.data ?? []).filter(client => client.status === 'ACTIVE'))
const projects = computed(() => projectsData.value?.data ?? [])

const today = new Date().toISOString().slice(0, 10)
const form = reactive({
  kind: 'QUOTE',
  clientId: '',
  projectId: '',
  issueDate: today,
  dueDate: '',
  subject: '',
  notes: '',
  taxRate: '0',
  lines: [{ description: '', quantity: '1', unitPrice: '0' }] as Line[],
})

const availableProjects = computed(() => projects.value.filter(project => project.projectClients.some(link => link.client.id === form.clientId)))
const saving = ref(false)
const errorMessage = ref('')

watch(() => form.clientId, () => {
  if (!availableProjects.value.some(project => project.id === form.projectId)) form.projectId = ''
})

const previewSubtotal = computed(() => form.lines.reduce((total, line) => total + Math.max(0, Number(line.quantity || 0)) * Math.max(0, Number(line.unitPrice || 0)), 0))
const previewTax = computed(() => previewSubtotal.value * Math.max(0, Number(form.taxRate || 0)) / 100)
const previewTotal = computed(() => previewSubtotal.value + previewTax.value)
const money = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)

function addLine() {
  if (form.lines.length >= 100) return
  form.lines.push({ description: '', quantity: '1', unitPrice: '0' })
}

function removeLine(index: number) {
  if (form.lines.length === 1) return
  form.lines.splice(index, 1)
}

async function submit() {
  if (!canWrite.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<ApiSuccess<{ id: string }>>('/api/billing/create', {
      method: 'POST',
      body: {
        kind: form.kind,
        clientId: form.clientId,
        projectId: form.projectId || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate || undefined,
        subject: form.subject,
        notes: form.notes,
        taxRate: form.taxRate,
        lines: form.lines,
      },
    })
    await navigateTo(`/dashboard/billing/${response.data.id}?created=1`)
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Le document n’a pas pu être créé.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Nouveau document de facturation</h1>
        <p>Créez un devis ou une facture. Les montants définitifs sont recalculés côté serveur.</p>
      </div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/billing">Retour</NuxtLink>
    </div>

    <div v-if="!canWrite" class="alert alert-error">Votre rôle ne permet pas de créer des documents de facturation.</div>
    <div v-else-if="!clients.length" class="card card-pad">
      <h2>Aucun client disponible</h2>
      <p class="muted">Créez d’abord un client actif.</p>
      <NuxtLink class="btn btn-primary" to="/dashboard/clients/create">Créer un client</NuxtLink>
    </div>

    <form v-else class="card card-pad" @submit.prevent="submit">
      <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>

      <div class="form-grid">
        <div class="field">
          <label for="billing-kind">Type *</label>
          <select id="billing-kind" v-model="form.kind" class="select" required>
            <option value="QUOTE">Devis</option>
            <option value="INVOICE">Facture</option>
          </select>
        </div>
        <div class="field">
          <label for="billing-client">Client *</label>
          <select id="billing-client" v-model="form.clientId" class="select" required>
            <option value="" disabled>Sélectionner un client</option>
            <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option>
          </select>
        </div>
        <div class="field field-full">
          <label for="billing-project">Projet</label>
          <select id="billing-project" v-model="form.projectId" class="select" :disabled="!form.clientId">
            <option value="">Sans projet</option>
            <option v-for="project in availableProjects" :key="project.id" :value="project.id">{{ project.reference ? `${project.reference} — ` : '' }}{{ project.title }}</option>
          </select>
        </div>
        <div class="field">
          <label for="billing-issue">Date d’émission *</label>
          <input id="billing-issue" v-model="form.issueDate" class="input" type="date" required>
        </div>
        <div class="field">
          <label for="billing-due">Échéance</label>
          <input id="billing-due" v-model="form.dueDate" class="input" type="date">
        </div>
        <div class="field field-full">
          <label for="billing-subject">Objet</label>
          <input id="billing-subject" v-model="form.subject" class="input" maxlength="255" placeholder="Ex. Stage PRE Compiègne — septembre 2026">
        </div>
        <div class="field">
          <label for="billing-tax">TVA (%)</label>
          <input id="billing-tax" v-model="form.taxRate" class="input" type="number" min="0" max="100" step="0.01">
        </div>
      </div>

      <h2 style="margin-top:28px">Lignes</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Description</th><th>Quantité</th><th>Prix unitaire (€)</th><th>Total indicatif</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(line,index) in form.lines" :key="index">
              <td><input v-model="line.description" class="input" maxlength="500" required placeholder="Prestation"></td>
              <td><input v-model="line.quantity" class="input" type="number" min="0.01" step="0.01" required></td>
              <td><input v-model="line.unitPrice" class="input" type="number" min="0" step="0.01" required></td>
              <td>{{ money(Math.max(0,Number(line.quantity||0))*Math.max(0,Number(line.unitPrice||0))) }}</td>
              <td><button class="btn btn-secondary" type="button" :disabled="form.lines.length===1" @click="removeLine(index)">Retirer</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="btn btn-secondary" type="button" style="margin-top:12px" @click="addLine">Ajouter une ligne</button>

      <div class="card card-pad" style="margin-top:22px;background:var(--surface-muted,#f7f9f7)">
        <p><strong>Sous-total indicatif :</strong> {{ money(previewSubtotal) }}</p>
        <p><strong>TVA :</strong> {{ money(previewTax) }}</p>
        <p style="margin-bottom:0"><strong>Total indicatif :</strong> {{ money(previewTotal) }}</p>
      </div>

      <div class="field" style="margin-top:22px">
        <label for="billing-notes">Notes</label>
        <textarea id="billing-notes" v-model="form.notes" class="textarea" rows="4" placeholder="Conditions ou informations complémentaires." />
      </div>

      <div class="actions" style="margin-top:22px">
        <button class="btn btn-primary" type="submit" :disabled="saving || !form.clientId || form.lines.some(line=>!line.description.trim())">{{ saving ? 'Création…' : 'Créer le document' }}</button>
        <NuxtLink class="btn btn-secondary" to="/dashboard/billing">Annuler</NuxtLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
h2 { margin-bottom:14px; }
</style>
