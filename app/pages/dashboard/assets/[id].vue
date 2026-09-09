<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Matériel IT' })

type AssetDocument = {
  id: string
  type: string
  title: string | null
  originalName: string
  fileSize: string
  sha256: string | null
  createdAt: string
}

type Asset = {
  id: string
  inventoryTag: string
  type: string
  brand: string | null
  model: string | null
  serialNumber: string | null
  status: string
  assignedUserId: string | null
  location: string | null
  purchaseDate: string | null
  warrantyUntil: string | null
  notes: string | null
  updatedAt: string
  documents: AssetDocument[]
  documentLimits: { maxCount: number; maxMb: number }
}

type UserOption = { id: string; firstName: string; lastName: string; email: string }

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key: 'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('it:write'))
const { data, error, refresh } = await useFetch<ApiSuccess<Asset>>(() => `/api/assets/${id.value}`)
const asset = computed(() => data.value?.data ?? null)
const { data: usersData } = await useFetch<ApiSuccess<UserOption[]>>('/api/assets/users', { immediate: canWrite.value })
const users = computed(() => usersData.value?.data ?? [])

const form = reactive({ inventoryTag: '', type: '', brand: '', model: '', serialNumber: '', status: 'STOCK', assignedUserId: '', location: '', purchaseDate: '', warrantyUntil: '', notes: '' })
const saving = ref(false)
const uploading = ref(false)
const archivingDocumentId = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const documentForm = reactive({ type: 'PURCHASE_INVOICE', title: '' })
const documentFile = ref<File | null>(null)

watch(asset, (value) => {
  if (!value) return
  form.inventoryTag = value.inventoryTag
  form.type = value.type
  form.brand = value.brand || ''
  form.model = value.model || ''
  form.serialNumber = value.serialNumber || ''
  form.status = value.status
  form.assignedUserId = value.assignedUserId || ''
  form.location = value.location || ''
  form.purchaseDate = value.purchaseDate ? value.purchaseDate.slice(0, 10) : ''
  form.warrantyUntil = value.warrantyUntil ? value.warrantyUntil.slice(0, 10) : ''
  form.notes = value.notes || ''
}, { immediate: true })

const documentTypeLabel = (value: string) => ({
  PURCHASE_INVOICE: 'Facture d’achat',
  WARRANTY: 'Garantie',
  RECEIPT: 'Reçu / ticket',
  MANUAL: 'Manuel',
  CERTIFICATE: 'Certificat',
  PHOTO: 'Photo / scan',
  OTHER: 'Autre',
} as Record<string, string>)[value] || value

const formatSize = (value: string) => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

function selectDocument(event: Event) {
  const input = event.target as HTMLInputElement
  documentFile.value = input.files?.[0] ?? null
}

async function save() {
  if (!canWrite.value || saving.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/assets/${id.value}`, {
      method: 'PUT',
      body: { ...form, assignedUserId: form.assignedUserId || null, purchaseDate: form.purchaseDate || null, warrantyUntil: form.warrantyUntil || null },
    })
    await refresh()
    successMessage.value = 'Matériel mis à jour.'
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le matériel n’a pas pu être mis à jour.') }
  finally { saving.value = false }
}

async function uploadDocument() {
  if (!canWrite.value || !documentFile.value || uploading.value) return
  uploading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const body = new FormData()
    body.append('file', documentFile.value)
    body.append('type', documentForm.type)
    body.append('title', documentForm.title)
    await $fetch(`/api/assets/${id.value}/documents/upload`, { method: 'POST', body })
    documentFile.value = null
    documentForm.title = ''
    await refresh()
    successMessage.value = 'Document ajouté au matériel.'
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le document n’a pas pu être ajouté.') }
  finally { uploading.value = false }
}

async function archiveDocument(documentId: string) {
  if (!canWrite.value || archivingDocumentId.value) return
  if (!confirm('Archiver ce document ? Il restera traçable dans l’historique.')) return
  archivingDocumentId.value = documentId
  errorMessage.value = ''
  try {
    await $fetch(`/api/assets/${id.value}/documents/${documentId}/archive`, { method: 'POST' })
    await refresh()
    successMessage.value = 'Document archivé.'
  }
  catch (err) { errorMessage.value = apiErrorMessage(err, 'Le document n’a pas pu être archivé.') }
  finally { archivingDocumentId.value = '' }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>{{ asset?.inventoryTag || 'Matériel' }}</h1><p v-if="asset">{{ [asset.brand, asset.model].filter(Boolean).join(' ') || asset.type }}</p></div>
      <NuxtLink class="btn btn-secondary" to="/dashboard/assets">Retour au parc</NuxtLink>
    </div>

    <div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div>
    <div v-if="successMessage" class="alert alert-success" style="margin-bottom:18px">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">Impossible de charger ce matériel.</div>

    <template v-else-if="asset">
      <form v-if="canWrite" class="card card-pad asset-section" @submit.prevent="save">
        <h2>Informations du matériel</h2>
        <div class="form-grid">
          <div class="field"><label for="asset-tag">Référence *</label><input id="asset-tag" v-model="form.inventoryTag" class="input" required maxlength="100"></div>
          <div class="field"><label for="asset-type">Type *</label><input id="asset-type" v-model="form.type" class="input" required maxlength="100"></div>
          <div class="field"><label for="asset-brand">Marque</label><input id="asset-brand" v-model="form.brand" class="input" maxlength="100"></div>
          <div class="field"><label for="asset-model">Modèle</label><input id="asset-model" v-model="form.model" class="input" maxlength="150"></div>
          <div class="field"><label for="asset-serial">Numéro de série</label><input id="asset-serial" v-model="form.serialNumber" class="input" maxlength="150"></div>
          <div class="field"><label for="asset-status">Statut</label><select id="asset-status" v-model="form.status" class="select"><option value="STOCK">En stock</option><option value="ASSIGNED">Affecté</option><option value="MAINTENANCE">Maintenance</option><option value="RETIRED">Retiré</option><option value="LOST">Perdu</option></select></div>
          <div class="field"><label for="asset-user">Affecté à</label><select id="asset-user" v-model="form.assignedUserId" class="select"><option value="">Personne</option><option v-for="user in users" :key="user.id" :value="user.id">{{ user.firstName }} {{ user.lastName }} — {{ user.email }}</option></select></div>
          <div class="field"><label for="asset-location">Localisation</label><input id="asset-location" v-model="form.location" class="input" maxlength="200"></div>
          <div class="field"><label for="asset-purchase">Achat</label><input id="asset-purchase" v-model="form.purchaseDate" class="input" type="date"></div>
          <div class="field"><label for="asset-warranty">Garantie</label><input id="asset-warranty" v-model="form.warrantyUntil" class="input" type="date"></div>
          <div class="field field-full"><label for="asset-notes">Notes</label><textarea id="asset-notes" v-model="form.notes" class="textarea" rows="5" /></div>
        </div>
        <button class="btn btn-primary" type="submit" style="margin-top:18px" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
      </form>

      <section v-else class="card card-pad asset-section">
        <span class="badge">{{ asset.status }}</span><h2>{{ asset.inventoryTag }}</h2><p>{{ [asset.brand, asset.model].filter(Boolean).join(' ') || asset.type }}</p><p>{{ asset.location || 'Localisation non renseignée' }}</p>
      </section>

      <section class="card card-pad asset-section">
        <div class="documents-heading"><div><h2>Documents</h2><p class="muted">Facture, garantie, reçu, manuel ou justificatif lié à ce matériel.</p></div><strong>{{ asset.documents.length }} / {{ asset.documentLimits.maxCount }}</strong></div>
        <div v-if="!asset.documents.length" class="empty-state">Aucun document enregistré.</div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Document</th><th>Taille</th><th>Ajout</th><th>Action</th></tr></thead>
            <tbody>
              <tr v-for="document in asset.documents" :key="document.id">
                <td><span class="badge badge-muted">{{ documentTypeLabel(document.type) }}</span></td>
                <td><strong>{{ document.title || document.originalName }}</strong><br><small v-if="document.sha256" class="muted mono">SHA-256 {{ document.sha256.slice(0, 16) }}…</small></td>
                <td>{{ formatSize(document.fileSize) }}</td>
                <td>{{ new Date(document.createdAt).toLocaleDateString('fr-FR') }}</td>
                <td><div class="actions"><a class="btn btn-secondary" :href="`/api/assets/${asset.id}/documents/${document.id}/view`" target="_blank" rel="noopener">Ouvrir</a><button v-if="canWrite" class="btn btn-secondary" type="button" :disabled="archivingDocumentId === document.id" @click="archiveDocument(document.id)">Archiver</button></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <form v-if="canWrite" class="card card-pad asset-section" @submit.prevent="uploadDocument">
        <h2>Ajouter un document</h2>
        <p class="muted">PDF uniquement · {{ asset.documentLimits.maxMb }} Mo maximum par fichier · {{ asset.documentLimits.maxCount }} documents actifs maximum par matériel.</p>
        <div class="form-grid">
          <div class="field"><label for="asset-doc-type">Type</label><select id="asset-doc-type" v-model="documentForm.type" class="select"><option value="PURCHASE_INVOICE">Facture d’achat</option><option value="WARRANTY">Garantie</option><option value="RECEIPT">Reçu / ticket</option><option value="MANUAL">Manuel</option><option value="CERTIFICATE">Certificat</option><option value="PHOTO">Photo / scan PDF</option><option value="OTHER">Autre</option></select></div>
          <div class="field"><label for="asset-doc-title">Titre</label><input id="asset-doc-title" v-model="documentForm.title" class="input" maxlength="255" placeholder="Ex. Facture Lenovo septembre 2026"></div>
          <div class="field field-full"><label for="asset-doc-file">Fichier PDF *</label><input id="asset-doc-file" class="input" type="file" accept="application/pdf,.pdf" required @change="selectDocument"></div>
        </div>
        <button class="btn btn-primary" type="submit" style="margin-top:18px" :disabled="uploading || !documentFile || asset.documents.length >= asset.documentLimits.maxCount">{{ uploading ? 'Envoi…' : 'Ajouter le document' }}</button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.asset-section{margin-bottom:18px}.asset-section h2{margin-top:0}.documents-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.documents-heading p{margin-bottom:0}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}@media(max-width:700px){.documents-heading{flex-direction:column}}
</style>