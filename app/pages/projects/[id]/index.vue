<script setup lang="ts">
const route = useRoute()
const router = useRouter()

type ProjectClientLink = {
  id: string
  isMainClient: boolean
  client: {
    id: string
    name: string
  }
}

type ProjectIntervenorLink = {
  id: string
  assignmentStatus: string
  intervenor: {
    id: string
    firstName: string
    lastName: string
    email: string | null
  }
}

type ProjectDocument = {
  id: string
  projectId: string
  type: string
  visibility: string
  title: string | null
  originalName: string
  storedName: string
  filePath: string
  mimeType: string
  fileSize: string
  createdAt: string
  updatedAt: string
}

type ProjectDetail = {
  id: string
  title: string
  description: string | null
  status: string
  archivedAt?: string | null
  projectClients?: ProjectClientLink[]
  projectIntervenors?: ProjectIntervenorLink[]
}

type IntervenorOption = {
  id: string
  firstName: string
  lastName: string
  email: string
  status: string
}

const emptyProject: ProjectDetail = {
  id: '',
  title: '',
  description: null,
  status: '',
  archivedAt: null,
  projectClients: [],
  projectIntervenors: [],
}

const projectId = computed(() => String(route.params.id || ''))

const {
  data: projectResponse,
  pending,
  error,
  refresh,
} = useFetch<{ ok: boolean; data: ProjectDetail | null }>(
  `/api/projects/${projectId.value}`,
  {
    server: false,
    default: () => ({ ok: true, data: null }),
  },
)

const {
  data: documentsResponse,
  pending: documentsPending,
  error: documentsError,
  refresh: refreshDocuments,
} = useFetch<{ ok: boolean; data: ProjectDocument[] }>(
  `/api/projects/${projectId.value}/documents`,
  {
    server: false,
    default: () => ({ ok: true, data: [] }),
  },
)

const {
  data: intervenorsOptionsResponse,
  pending: intervenorsOptionsPending,
  refresh: refreshIntervenorOptions,
} = useFetch<{ ok: boolean; data: IntervenorOption[] }>(
  '/api/intervenors/options',
  {
    server: false,
    default: () => ({ ok: true, data: [] }),
  },
)

const hasProject = computed(() => !!projectResponse.value?.data)
const projectData = computed<ProjectDetail>(() => projectResponse.value?.data ?? emptyProject)

const isArchiving = ref(false)
const archiveError = ref('')
const archiveSuccess = ref('')

const selectedFile = ref<File | null>(null)
const uploadTitle = ref('')
const uploadType = ref('CONTRACT')
const isUploading = ref(false)
const uploadError = ref('')
const uploadSuccess = ref('')

const selectedIntervenorId = ref('')
const isLinkingIntervenor = ref(false)
const linkIntervenorError = ref('')
const linkIntervenorSuccess = ref('')
const unlinkIntervenorError = ref('')
const unlinkingIntervenorId = ref('')

const documentTypeOptions = [
  { label: 'Contrat', value: 'CONTRACT' },
  { label: 'Convention', value: 'CONVENTION' },
  { label: 'Devis', value: 'QUOTE' },
  { label: 'Facture', value: 'INVOICE' },
  { label: 'Bilan', value: 'REPORT' },
  { label: 'Annexe', value: 'ANNEX' },
  { label: 'Autre', value: 'OTHER' },
]

function getStatusLabel(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon'
    case 'VALIDATED':
      return 'Validé'
    case 'IN_PROGRESS':
      return 'En cours'
    case 'COMPLETED':
      return 'Terminé'
    case 'CANCELLED':
      return 'Annulé'
    default:
      return status || 'Non défini'
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'badge-draft'
    case 'VALIDATED':
      return 'badge-validated'
    case 'IN_PROGRESS':
      return 'badge-progress'
    case 'COMPLETED':
      return 'badge-done'
    case 'CANCELLED':
      return 'badge-cancel'
    default:
      return 'badge-default'
  }
}

function getAssignmentStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'En attente'
    case 'ACCEPTED':
      return 'Accepté'
    case 'REFUSED':
      return 'Refusé'
    case 'CANCELLED':
      return 'Annulé'
    default:
      return status || 'Non défini'
  }
}

function getDocumentTypeLabel(type: string) {
  switch (type) {
    case 'CONTRACT':
      return 'Contrat'
    case 'CONVENTION':
      return 'Convention'
    case 'QUOTE':
      return 'Devis'
    case 'INVOICE':
      return 'Facture'
    case 'REPORT':
      return 'Bilan'
    case 'ANNEX':
      return 'Annexe'
    case 'OTHER':
      return 'Autre'
    default:
      return type || 'Document'
  }
}

function getVisibilityLabel(visibility: string) {
  switch (visibility) {
    case 'ADMIN_ONLY':
      return 'Admin uniquement'
    case 'INTERNAL':
      return 'Interne'
    case 'CLIENT_VISIBLE':
      return 'Visible client'
    case 'INTERVENOR_VISIBLE':
      return 'Visible intervenant'
    default:
      return visibility || 'Non défini'
  }
}

function formatFileSize(size: string) {
  const value = Number(size)

  if (!Number.isFinite(value) || value < 0) {
    return 'Taille inconnue'
  }

  if (value < 1024) {
    return `${value} o`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} Ko`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR')
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null

  uploadError.value = ''
  uploadSuccess.value = ''

  if (!file) {
    selectedFile.value = null
    return
  }

  if (file.type !== 'application/pdf') {
    selectedFile.value = null
    uploadError.value = 'Seuls les fichiers PDF sont autorisés.'
    target.value = ''
    return
  }

  selectedFile.value = file
}

const mainClient = computed(() => {
  return (
    projectData.value.projectClients?.find((item) => item.isMainClient)?.client?.name ||
    'Non défini'
  )
})

const linkedClientsCount = computed(() => projectData.value.projectClients?.length || 0)
const linkedIntervenorsCount = computed(() => projectData.value.projectIntervenors?.length || 0)
const documents = computed(() => documentsResponse.value?.data || [])
const intervenorOptions = computed(() => intervenorsOptionsResponse.value?.data || [])

const availableIntervenors = computed(() => {
  const linkedIds = new Set(
    (projectData.value.projectIntervenors || []).map((item) => item.intervenor.id),
  )

  return intervenorOptions.value.filter((item) => !linkedIds.has(item.id))
})

async function refreshAll() {
  await Promise.all([
    refresh(),
    refreshDocuments(),
    refreshIntervenorOptions(),
  ])
}

async function uploadDocument() {
  if (!projectData.value.id || !selectedFile.value || isUploading.value) {
    return
  }

  isUploading.value = true
  uploadError.value = ''
  uploadSuccess.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('title', uploadTitle.value.trim())
    formData.append('type', uploadType.value)
    formData.append('visibility', 'ADMIN_ONLY')

    await $fetch(`/api/projects/${projectData.value.id}/documents/upload`, {
      method: 'POST',
      body: formData,
    })

    uploadSuccess.value = 'Document ajouté avec succès.'
    selectedFile.value = null
    uploadTitle.value = ''
    uploadType.value = 'CONTRACT'

    await refreshDocuments()

    const fileInput = document.getElementById(
      'project-document-file',
    ) as HTMLInputElement | null

    if (fileInput) {
      fileInput.value = ''
    }
  } catch (err: any) {
    console.error(err)
    uploadError.value = err?.data?.statusMessage || 'Erreur lors de l’ajout du document.'
  } finally {
    isUploading.value = false
  }
}

async function linkIntervenor() {
  if (!projectData.value.id || !selectedIntervenorId.value || isLinkingIntervenor.value) {
    return
  }

  isLinkingIntervenor.value = true
  linkIntervenorError.value = ''
  linkIntervenorSuccess.value = ''
  unlinkIntervenorError.value = ''

  try {
    await $fetch('/api/projects/link-intervenor', {
      method: 'POST',
      body: {
        projectId: projectData.value.id,
        intervenorId: selectedIntervenorId.value,
      },
    })

    linkIntervenorSuccess.value = 'Intervenant lié au projet avec succès.'
    selectedIntervenorId.value = ''

    await Promise.all([refresh(), refreshIntervenorOptions()])
  } catch (err: any) {
    console.error(err)
    linkIntervenorError.value =
      err?.data?.statusMessage || 'Erreur lors de la liaison de l’intervenant.'
  } finally {
    isLinkingIntervenor.value = false
  }
}

async function unlinkIntervenor(intervenorId: string) {
  if (!projectData.value.id || !intervenorId || unlinkingIntervenorId.value) {
    return
  }

  const confirmed = window.confirm(
    'Voulez-vous vraiment retirer cet intervenant du projet ?',
  )

  if (!confirmed) {
    return
  }

  unlinkingIntervenorId.value = intervenorId
  unlinkIntervenorError.value = ''
  linkIntervenorSuccess.value = ''

  try {
    await $fetch('/api/projects/unlink-intervenor', {
      method: 'POST',
      body: {
        projectId: projectData.value.id,
        intervenorId,
      },
    })

    await Promise.all([refresh(), refreshIntervenorOptions()])
  } catch (err: any) {
    console.error(err)
    unlinkIntervenorError.value =
      err?.data?.statusMessage || 'Erreur lors du retrait de l’intervenant.'
  } finally {
    unlinkingIntervenorId.value = ''
  }
}

async function archiveProject() {
  if (!projectData.value.id || isArchiving.value) {
    return
  }

  const confirmed = window.confirm(
    'Voulez-vous vraiment archiver ce projet ? Il disparaîtra des listes actives mais restera dans l’historique.',
  )

  if (!confirmed) {
    return
  }

  isArchiving.value = true
  archiveError.value = ''
  archiveSuccess.value = ''

  try {
    await $fetch('/api/projects/archive', {
      method: 'POST',
      body: {
        id: projectData.value.id,
      },
    })

    archiveSuccess.value = 'Projet archivé avec succès.'

    setTimeout(() => {
      router.push('/projects')
    }, 800)
  } catch (err) {
    console.error(err)
    archiveError.value = 'Erreur lors de l’archivage du projet.'
  } finally {
    isArchiving.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Détail du projet"
      subtitle="Consultez les informations complètes du projet."
    >
      <NuxtLink to="/projects">
        <BaseButton variant="secondary">Retour</BaseButton>
      </NuxtLink>

      <BaseButton variant="secondary" @click="refreshAll()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <ClientOnly>
      <div v-if="pending" class="empty-state">
        Chargement du projet...
      </div>

      <div v-else-if="error" class="empty-state error">
        Erreur lors du chargement du projet.
      </div>

      <div v-else-if="!hasProject" class="empty-state">
        Projet introuvable.
      </div>

      <div v-else class="detail-card">
        <div class="detail-header">
          <div>
            <h2 class="detail-title">{{ projectData.title }}</h2>
            <p class="detail-subtitle">
              Client principal : {{ mainClient }}
            </p>
          </div>

          <span class="badge" :class="getStatusClass(projectData.status)">
            {{ getStatusLabel(projectData.status) }}
          </span>
        </div>

        <div class="detail-grid">
          <div class="info-block full">
            <span class="info-label">Description</span>
            <span class="info-value">
              {{ projectData.description || 'Description non renseignée.' }}
            </span>
          </div>

          <div class="info-block">
            <span class="info-label">Titre</span>
            <span class="info-value">{{ projectData.title }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Statut</span>
            <span class="info-value">{{ getStatusLabel(projectData.status) }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Client principal</span>
            <span class="info-value">{{ mainClient }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Clients liés</span>
            <span class="info-value">{{ linkedClientsCount }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Intervenants liés</span>
            <span class="info-value">{{ linkedIntervenorsCount }}</span>
          </div>
        </div>

        <div v-if="projectData.projectClients?.length" class="related-section">
          <h3 class="section-title">Clients associés</h3>

          <div class="related-list">
            <div
              v-for="item in projectData.projectClients"
              :key="item.id"
              class="related-item"
            >
              <span class="related-name">{{ item.client.name }}</span>
              <span v-if="item.isMainClient" class="related-badge">
                Principal
              </span>
            </div>
          </div>
        </div>

        <div class="related-section">
          <div class="section-header">
            <h3 class="section-title">Lier un intervenant</h3>
            <span class="section-counter">
              {{ linkedIntervenorsCount }} lié(s)
            </span>
          </div>

          <div class="upload-card">
            <div class="upload-grid">
              <div class="field-group full">
                <label class="field-label" for="project-intervenor-id">
                  Intervenant
                </label>
                <select
                  id="project-intervenor-id"
                  v-model="selectedIntervenorId"
                  class="field-input"
                  :disabled="intervenorsOptionsPending || !availableIntervenors.length"
                >
                  <option value="">
                    Sélectionnez un intervenant
                  </option>
                  <option
                    v-for="item in availableIntervenors"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.firstName }} {{ item.lastName }} — {{ item.email }}
                  </option>
                </select>
              </div>
            </div>

            <div class="upload-actions">
              <button
                type="button"
                class="primary-upload-button"
                :disabled="!selectedIntervenorId || isLinkingIntervenor"
                @click="linkIntervenor"
              >
                {{ isLinkingIntervenor ? 'Liaison...' : 'Lier l’intervenant' }}
              </button>
            </div>

            <p v-if="linkIntervenorSuccess" class="success-message">
              {{ linkIntervenorSuccess }}
            </p>

            <p v-if="linkIntervenorError" class="error-message">
              {{ linkIntervenorError }}
            </p>

            <p v-if="unlinkIntervenorError" class="error-message">
              {{ unlinkIntervenorError }}
            </p>
          </div>
        </div>

        <div class="related-section">
          <div class="section-header">
            <h3 class="section-title">Intervenants associés</h3>
            <span class="section-counter">{{ linkedIntervenorsCount }}</span>
          </div>

          <div
            v-if="!projectData.projectIntervenors?.length"
            class="empty-state section-empty-state"
          >
            Aucun intervenant lié à ce projet.
          </div>

          <div v-else class="related-list">
            <div
              v-for="item in projectData.projectIntervenors"
              :key="item.id"
              class="related-item"
            >
              <div>
                <span class="related-name">
                  {{ item.intervenor.firstName }} {{ item.intervenor.lastName }}
                </span>
                <div class="document-meta">
                  <span>{{ item.intervenor.email || 'Email non renseigné' }}</span>
                  <span>•</span>
                  <span>{{ getAssignmentStatusLabel(item.assignmentStatus) }}</span>
                </div>
              </div>

              <div class="document-actions">
                <NuxtLink
                  :to="`/intervenors/${item.intervenor.id}`"
                  class="document-action-link"
                >
                  Voir la fiche
                </NuxtLink>

                <button
                  type="button"
                  class="danger-action-button"
                  :disabled="unlinkingIntervenorId === item.intervenor.id"
                  @click="unlinkIntervenor(item.intervenor.id)"
                >
                  {{
                    unlinkingIntervenorId === item.intervenor.id
                      ? 'Retrait...'
                      : 'Délier'
                  }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="related-section">
          <div class="section-header">
            <h3 class="section-title">Ajouter un document PDF</h3>
            <span class="section-counter">Admin uniquement</span>
          </div>

          <div class="upload-card">
            <div class="upload-grid">
              <div class="field-group">
                <label class="field-label" for="project-document-title">Titre</label>
                <input
                  id="project-document-title"
                  v-model="uploadTitle"
                  type="text"
                  class="field-input"
                  placeholder="Ex : Contrat signé 2025"
                >
              </div>

              <div class="field-group">
                <label class="field-label" for="project-document-type">
                  Type de document
                </label>
                <select
                  id="project-document-type"
                  v-model="uploadType"
                  class="field-input"
                >
                  <option
                    v-for="option in documentTypeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
              </div>

              <div class="field-group full">
                <label class="field-label" for="project-document-file">Fichier PDF</label>
                <input
                  id="project-document-file"
                  type="file"
                  class="field-input file-input"
                  accept="application/pdf"
                  @change="onFileChange"
                >
                <p class="field-help">
                  PDF uniquement • 10 Mo max • 5 fichiers max par projet
                </p>
              </div>
            </div>

            <div class="upload-actions">
              <button
                type="button"
                class="primary-upload-button"
                :disabled="!selectedFile || isUploading"
                @click="uploadDocument"
              >
                {{ isUploading ? 'Envoi en cours...' : 'Ajouter le PDF' }}
              </button>
            </div>

            <p v-if="uploadSuccess" class="success-message">
              {{ uploadSuccess }}
            </p>

            <p v-if="uploadError" class="error-message">
              {{ uploadError }}
            </p>
          </div>
        </div>

        <div class="related-section">
          <div class="section-header">
            <h3 class="section-title">Documents du projet</h3>
            <span class="section-counter">{{ documents.length }} fichier(s)</span>
          </div>

          <div v-if="documentsPending" class="empty-state section-empty-state">
            Chargement des documents...
          </div>

          <div v-else-if="documentsError" class="empty-state error section-empty-state">
            Erreur lors du chargement des documents.
          </div>

          <div v-else-if="!documents.length" class="empty-state section-empty-state">
            Aucun document pour ce projet.
          </div>

          <div v-else class="document-list">
            <div
              v-for="document in documents"
              :key="document.id"
              class="document-item"
            >
              <div class="document-main">
                <strong class="document-title">
                  {{ document.title || document.originalName }}
                </strong>

                <div class="document-meta">
                  <span>{{ getDocumentTypeLabel(document.type) }}</span>
                  <span>•</span>
                  <span>{{ getVisibilityLabel(document.visibility) }}</span>
                  <span>•</span>
                  <span>{{ formatFileSize(document.fileSize) }}</span>
                  <span>•</span>
                  <span>{{ formatDate(document.createdAt) }}</span>
                </div>
              </div>

              <div class="document-actions">
                <NuxtLink
                  :to="`/projects/${projectData.id}/documents/${document.id}`"
                  class="document-action-link"
                >
                  Consulter
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <div class="actions-bar">
          <BaseButton variant="secondary" @click="refreshAll()">
            Rafraîchir la fiche
          </BaseButton>

          <button
            type="button"
            class="archive-button"
            :disabled="isArchiving"
            @click="archiveProject"
          >
            {{ isArchiving ? 'Archivage...' : 'Archiver le projet' }}
          </button>
        </div>

        <p v-if="archiveSuccess" class="success-message">
          {{ archiveSuccess }}
        </p>

        <p v-if="archiveError" class="error-message">
          {{ archiveError }}
        </p>
      </div>

      <template #fallback>
        <div class="empty-state">
          Chargement du projet...
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.detail-title {
  margin: 0;
  font-size: 28px;
  color: #111827;
}

.detail-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 15px;
}

.badge {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.badge-draft {
  background: #eef2ff;
  color: #4338ca;
  border-color: #c7d2fe;
}

.badge-progress {
  background: #fff7ed;
  color: #c2410c;
  border-color: #fdba74;
}

.badge-done {
  background: #ecfdf5;
  color: #15803d;
  border-color: #86efac;
}

.badge-cancel {
  background: #fef2f2;
  color: #b91c1c;
  border-color: #fecaca;
}

.badge-validated {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.badge-default {
  background: #f3f4f6;
  color: #4b5563;
  border-color: #e5e7eb;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.info-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-block.full {
  grid-column: 1 / -1;
}

.info-label {
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.info-value {
  color: #111827;
  font-weight: 600;
  line-height: 1.5;
}

.related-section {
  margin-top: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.section-counter {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
}

.related-list,
.document-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.related-item,
.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f9fafb;
  flex-wrap: wrap;
}

.related-name,
.document-title {
  color: #111827;
  font-weight: 600;
}

.related-meta {
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.document-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.document-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.related-badge {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.upload-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-group.full {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
}

.field-input {
  width: 100%;
  min-height: 46px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 14px;
  color: #111827;
  background: white;
  outline: none;
  box-sizing: border-box;
}

.file-input {
  padding: 10px 14px;
}

.field-help {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.primary-upload-button {
  min-height: 42px;
  padding: 0 16px;
  border: none;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-upload-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.24);
}

.primary-upload-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.document-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.document-action-link,
.danger-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.document-action-link {
  border: 1px solid #d1d5db;
  background: white;
  color: #111827;
  text-decoration: none;
}

.document-action-link:hover {
  background: #f9fafb;
  border-color: #cbd5e1;
}

.danger-action-button {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  cursor: pointer;
}

.danger-action-button:hover:not(:disabled) {
  background: #fee2e2;
}

.danger-action-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.section-empty-state {
  margin-top: 0;
}

.actions-bar {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  flex-wrap: wrap;
}

.archive-button {
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.archive-button:hover:not(:disabled) {
  background: #fee2e2;
}

.archive-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.success-message {
  margin-top: 16px;
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 12px 14px;
  border-radius: 12px;
}

.error-message {
  margin-top: 16px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 12px 14px;
  border-radius: 12px;
}

.empty-state {
  background: white;
  border: 1px dashed #d1d5db;
  border-radius: 18px;
  padding: 24px;
  color: #6b7280;
  text-align: center;
}

.empty-state.error {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

@media (max-width: 768px) {
  .detail-card {
    padding: 18px;
    border-radius: 16px;
  }

  .detail-grid,
  .upload-grid {
    grid-template-columns: 1fr;
  }

  .actions-bar,
  .upload-actions,
  .document-actions {
    justify-content: stretch;
    flex-direction: column;
  }

  .archive-button,
  .primary-upload-button,
  .document-action-link,
  .danger-action-button {
    width: 100%;
  }
}
</style>