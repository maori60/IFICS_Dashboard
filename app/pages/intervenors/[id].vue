<script setup lang="ts">
const route = useRoute()

type IntervenorProjectLink = {
  id: string
  assignmentStatus: string
  project: {
    id: string
    title: string
    status: string
  }
}

type IntervenorDocument = {
  id: string
  type: string
  status: string
  title: string | null
  originalName: string
  createdAt: string
  reviewedAt: string | null
}

type IntervenorAccountingDocument = {
  id: string
  type: string
  status: string
  title: string | null
  periodMonth: number | null
  periodYear: number | null
  originalName: string
  createdAt: string
}

type IntervenorReport = {
  id: string
  sessionDate: string
  studentsCount: number | null
  status: string
  createdAt: string
}

type IntervenorDetail = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  specialty: string | null
  status: string
  siret: string | null
  ribIban: string | null
  ribBic: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  projectLinks: IntervenorProjectLink[]
  documents: IntervenorDocument[]
  accountingDocuments: IntervenorAccountingDocument[]
  reports: IntervenorReport[]
}

type ProjectOption = {
  id: string
  title: string
  status: string
}

const intervenorId = computed(() => String(route.params.id || ''))

const {
  data: response,
  pending,
  error,
  refresh,
} = useFetch<{ ok: boolean; data: IntervenorDetail | null }>(
  `/api/intervenors/${intervenorId.value}`,
  {
    server: false,
    default: () => ({ ok: true, data: null }),
  },
)

const {
  data: projectsResponse,
  pending: projectsPending,
  refresh: refreshProjects,
} = useFetch<{ ok: boolean; data: ProjectOption[] }>(
  '/api/projects/options',
  {
    server: false,
    default: () => ({ ok: true, data: [] }),
  },
)

const intervenor = computed(() => response.value?.data || null)
const projectOptions = computed(() => projectsResponse.value?.data || [])

const editForm = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specialty: '',
  status: 'ACTIVE',
  siret: '',
  ribIban: '',
  ribBic: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  notes: '',
})

const selectedProjectId = ref('')
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

const isLinkingProject = ref(false)
const projectLinkError = ref('')
const projectLinkSuccess = ref('')
const unlinkProjectError = ref('')
const unlinkingProjectId = ref('')

const selectedContractFile = ref<File | null>(null)
const contractUploadError = ref('')
const contractUploadSuccess = ref('')
const isUploadingContract = ref(false)
const isDeletingContract = ref(false)

watch(
  intervenor,
  (value) => {
    if (!value) {
      return
    }

    editForm.firstName = value.firstName || ''
    editForm.lastName = value.lastName || ''
    editForm.email = value.email || ''
    editForm.phone = value.phone || ''
    editForm.specialty = value.specialty || ''
    editForm.status = value.status || 'ACTIVE'
    editForm.siret = value.siret || ''
    editForm.ribIban = value.ribIban || ''
    editForm.ribBic = value.ribBic || ''
    editForm.addressLine1 = value.addressLine1 || ''
    editForm.addressLine2 = value.addressLine2 || ''
    editForm.postalCode = value.postalCode || ''
    editForm.city = value.city || ''
    editForm.country = value.country || ''
    editForm.notes = value.notes || ''
  },
  { immediate: true },
)

function getStatusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Actif'
    case 'INACTIVE':
      return 'Inactif'
    case 'SUSPENDED':
      return 'Suspendu'
    default:
      return status || 'Non défini'
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
    case 'IDENTITY':
      return 'Pièce d’identité'
    case 'SIRENE':
      return 'Avis SIRENE'
    case 'RC_PRO':
      return 'Attestation RC'
    case 'CONTRACT':
      return 'Contrat'
    case 'CONVENTION':
      return 'Convention'
    case 'SIGNED_CONVENTION':
      return 'Convention signée'
    case 'OTHER':
      return 'Autre'
    default:
      return type || 'Document'
  }
}

function getDocumentStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'En attente'
    case 'ACCEPTED':
      return 'Accepté'
    case 'REFUSED':
      return 'Refusé'
    default:
      return status || 'Non défini'
  }
}

function getAccountingTypeLabel(type: string) {
  switch (type) {
    case 'QUOTE':
      return 'Devis'
    case 'INVOICE':
      return 'Facture'
    default:
      return type || 'Document comptable'
  }
}

function getReportStatusLabel(status: string) {
  switch (status) {
    case 'NOT_STARTED':
      return 'Non démarré'
    case 'IN_PROGRESS':
      return 'En cours'
    case 'SUBMITTED':
      return 'Soumis'
    case 'VALIDATED':
      return 'Validé'
    case 'REFUSED':
      return 'Refusé'
    default:
      return status || 'Non défini'
  }
}

function formatDate(date: string | null | undefined) {
  if (!date) {
    return 'Non défini'
  }

  return new Date(date).toLocaleDateString('fr-FR')
}

function formatPeriod(month: number | null, year: number | null) {
  if (!month || !year) {
    return 'Période non renseignée'
  }

  return `${String(month).padStart(2, '0')}/${year}`
}

function onContractFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null

  contractUploadError.value = ''
  contractUploadSuccess.value = ''

  if (!file) {
    selectedContractFile.value = null
    return
  }

  if (file.type !== 'application/pdf') {
    selectedContractFile.value = null
    contractUploadError.value = 'Seuls les fichiers PDF sont autorisés.'
    target.value = ''
    return
  }

  selectedContractFile.value = file
}

const fullAddress = computed(() => {
  if (!intervenor.value) {
    return 'Non renseignée'
  }

  const parts = [
    intervenor.value.addressLine1,
    intervenor.value.addressLine2,
    intervenor.value.postalCode,
    intervenor.value.city,
    intervenor.value.country,
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : 'Non renseignée'
})

const availableProjects = computed(() => {
  if (!intervenor.value) {
    return []
  }

  const linkedIds = new Set(intervenor.value.projectLinks.map((link) => link.project.id))
  return projectOptions.value.filter((project) => !linkedIds.has(project.id))
})

const contractDocuments = computed(() => {
  return (intervenor.value?.documents || []).filter((document) => document.type === 'CONTRACT')
})

const currentContract = computed(() => contractDocuments.value[0] || null)

async function saveIntervenor() {
  if (!intervenor.value?.id || isSaving.value) {
    return
  }

  saveError.value = ''
  saveSuccess.value = ''

  const firstName = editForm.firstName.trim()
  const lastName = editForm.lastName.trim()
  const email = editForm.email.trim()

  if (!firstName || !lastName || !email) {
    saveError.value = 'Le prénom, le nom et l’email sont obligatoires.'
    return
  }

  if (!email.includes('@')) {
    saveError.value = 'Email invalide.'
    return
  }

  isSaving.value = true

  try {
    await $fetch(`/api/intervenors/${intervenor.value.id}/update`, {
      method: 'POST',
      body: {
        firstName,
        lastName,
        email,
        phone: editForm.phone.trim(),
        specialty: editForm.specialty.trim(),
        status: editForm.status,
        siret: editForm.siret.trim(),
        ribIban: editForm.ribIban.trim(),
        ribBic: editForm.ribBic.trim(),
        addressLine1: editForm.addressLine1.trim(),
        addressLine2: editForm.addressLine2.trim(),
        postalCode: editForm.postalCode.trim(),
        city: editForm.city.trim(),
        country: editForm.country.trim(),
        notes: editForm.notes.trim(),
      },
    })

    saveSuccess.value = 'Intervenant mis à jour avec succès.'
    await refresh()
  } catch (err: any) {
    console.error(err)
    saveError.value =
      err?.data?.statusMessage || 'Erreur lors de la mise à jour de l’intervenant.'
  } finally {
    isSaving.value = false
  }
}

async function linkProject() {
  if (!intervenor.value?.id || !selectedProjectId.value || isLinkingProject.value) {
    return
  }

  projectLinkError.value = ''
  projectLinkSuccess.value = ''
  unlinkProjectError.value = ''
  isLinkingProject.value = true

  try {
    await $fetch('/api/projects/link-intervenor', {
      method: 'POST',
      body: {
        projectId: selectedProjectId.value,
        intervenorId: intervenor.value.id,
      },
    })

    projectLinkSuccess.value = 'Projet lié avec succès.'
    selectedProjectId.value = ''

    await Promise.all([refresh(), refreshProjects()])
  } catch (err: any) {
    console.error(err)
    projectLinkError.value =
      err?.data?.statusMessage || 'Erreur lors de la liaison avec le projet.'
  } finally {
    isLinkingProject.value = false
  }
}

async function unlinkProject(projectId: string) {
  if (!intervenor.value?.id || !projectId || unlinkingProjectId.value) {
    return
  }

  const confirmed = window.confirm(
    'Voulez-vous vraiment délier cet intervenant de ce projet ?',
  )

  if (!confirmed) {
    return
  }

  unlinkProjectError.value = ''
  projectLinkSuccess.value = ''
  unlinkingProjectId.value = projectId

  try {
    await $fetch('/api/projects/unlink-intervenor', {
      method: 'POST',
      body: {
        projectId,
        intervenorId: intervenor.value.id,
      },
    })

    await Promise.all([refresh(), refreshProjects()])
  } catch (err: any) {
    console.error(err)
    unlinkProjectError.value =
      err?.data?.statusMessage || 'Erreur lors du retrait du projet.'
  } finally {
    unlinkingProjectId.value = ''
  }
}

async function uploadContract() {
  if (!intervenor.value?.id || !selectedContractFile.value || isUploadingContract.value) {
    return
  }

  isUploadingContract.value = true
  contractUploadError.value = ''
  contractUploadSuccess.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedContractFile.value)

    await $fetch(`/api/intervenors/${intervenor.value.id}/documents/contract/upload`, {
      method: 'POST',
      body: formData,
    })

    contractUploadSuccess.value = 'Contrat enregistré avec succès.'
    selectedContractFile.value = null

    const fileInput = document.getElementById(
      'intervenor-contract-file',
    ) as HTMLInputElement | null

    if (fileInput) {
      fileInput.value = ''
    }

    await refresh()
  } catch (err: any) {
    console.error(err)
    contractUploadError.value =
      err?.data?.statusMessage || 'Erreur lors de l’envoi du contrat.'
  } finally {
    isUploadingContract.value = false
  }
}

async function deleteContract() {
  if (!intervenor.value?.id || !currentContract.value || isDeletingContract.value) {
    return
  }

  const confirmed = window.confirm(
    'Voulez-vous vraiment supprimer le contrat actuel ?',
  )

  if (!confirmed) {
    return
  }

  isDeletingContract.value = true
  contractUploadError.value = ''
  contractUploadSuccess.value = ''

  try {
    await $fetch(`/api/intervenors/${intervenor.value.id}/documents/contract/delete`, {
      method: 'POST',
    })

    contractUploadSuccess.value = 'Contrat supprimé avec succès.'
    await refresh()
  } catch (err: any) {
    console.error(err)
    contractUploadError.value =
      err?.data?.statusMessage || 'Erreur lors de la suppression du contrat.'
  } finally {
    isDeletingContract.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="Détail de l’intervenant"
      subtitle="Consultez et modifiez les informations complètes de l’intervenant."
    >
      <NuxtLink to="/intervenors">
        <BaseButton variant="secondary">Retour</BaseButton>
      </NuxtLink>

      <BaseButton variant="secondary" @click="refresh()">
        Actualiser
      </BaseButton>
    </PageHeader>

    <div v-if="pending" class="empty-state">
      Chargement de l’intervenant...
    </div>

    <div v-else-if="error" class="empty-state error">
      Erreur lors du chargement de l’intervenant.
    </div>

    <div v-else-if="!intervenor" class="empty-state">
      Intervenant introuvable.
    </div>

    <div v-else class="page-content">
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <h2 class="detail-title">
              {{ intervenor.firstName }} {{ intervenor.lastName }}
            </h2>
            <p class="detail-subtitle">
              {{ intervenor.email }}
            </p>
          </div>

          <span class="status-badge">
            {{ getStatusLabel(intervenor.status) }}
          </span>
        </div>

        <div class="detail-grid">
          <div class="info-block">
            <span class="info-label">Téléphone</span>
            <span class="info-value">{{ intervenor.phone || 'Non renseigné' }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Spécialité</span>
            <span class="info-value">{{ intervenor.specialty || 'Non renseignée' }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">SIRET</span>
            <span class="info-value">{{ intervenor.siret || 'Non renseigné' }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">IBAN</span>
            <span class="info-value">{{ intervenor.ribIban || 'Non renseigné' }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">BIC</span>
            <span class="info-value">{{ intervenor.ribBic || 'Non renseigné' }}</span>
          </div>

          <div class="info-block">
            <span class="info-label">Créé le</span>
            <span class="info-value">{{ formatDate(intervenor.createdAt) }}</span>
          </div>

          <div class="info-block full">
            <span class="info-label">Adresse</span>
            <span class="info-value">{{ fullAddress }}</span>
          </div>

          <div class="info-block full">
            <span class="info-label">Notes</span>
            <span class="info-value">{{ intervenor.notes || 'Aucune note.' }}</span>
          </div>
        </div>
      </div>

      <div class="form-card">
        <div class="section-header">
          <h3 class="section-title">Modifier l’intervenant</h3>
        </div>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label" for="firstName">Prénom</label>
            <input id="firstName" v-model="editForm.firstName" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="lastName">Nom</label>
            <input id="lastName" v-model="editForm.lastName" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="email">Email</label>
            <input id="email" v-model="editForm.email" type="email" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="phone">Téléphone</label>
            <input id="phone" v-model="editForm.phone" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="specialty">Spécialité</label>
            <input id="specialty" v-model="editForm.specialty" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="status">Statut</label>
            <select id="status" v-model="editForm.status" class="field-input">
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              <option value="SUSPENDED">Suspendu</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label" for="siret">SIRET</label>
            <input id="siret" v-model="editForm.siret" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="ribIban">IBAN</label>
            <input id="ribIban" v-model="editForm.ribIban" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="ribBic">BIC</label>
            <input id="ribBic" v-model="editForm.ribBic" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="postalCode">Code postal</label>
            <input id="postalCode" v-model="editForm.postalCode" type="text" class="field-input">
          </div>

          <div class="field-group full">
            <label class="field-label" for="addressLine1">Adresse</label>
            <input id="addressLine1" v-model="editForm.addressLine1" type="text" class="field-input">
          </div>

          <div class="field-group full">
            <label class="field-label" for="addressLine2">Complément d’adresse</label>
            <input id="addressLine2" v-model="editForm.addressLine2" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="city">Ville</label>
            <input id="city" v-model="editForm.city" type="text" class="field-input">
          </div>

          <div class="field-group">
            <label class="field-label" for="country">Pays</label>
            <input id="country" v-model="editForm.country" type="text" class="field-input">
          </div>

          <div class="field-group full">
            <label class="field-label" for="notes">Notes</label>
            <textarea
              id="notes"
              v-model="editForm.notes"
              class="field-textarea"
              rows="4"
            />
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="primary-button"
            :disabled="isSaving"
            @click="saveIntervenor"
          >
            {{ isSaving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
          </button>
        </div>

        <p v-if="saveSuccess" class="success-message">
          {{ saveSuccess }}
        </p>

        <p v-if="saveError" class="error-message">
          {{ saveError }}
        </p>
      </div>

      <div class="form-card">
        <div class="section-header">
          <h3 class="section-title">Contrat intervenant</h3>
        </div>

        <div class="upload-contract-card">
          <div v-if="currentContract" class="contract-current-box">
            <div>
              <strong class="item-title">
                {{ currentContract.title || currentContract.originalName }}
              </strong>
              <p class="item-meta">
                {{ getDocumentTypeLabel(currentContract.type) }} •
                {{ formatDate(currentContract.createdAt) }}
              </p>
            </div>

            <div class="document-actions">
              <NuxtLink
                :to="`/intervenors/documents/${currentContract.id}`"
                class="document-action-link"
              >
                Consulter
              </NuxtLink>

              <button
                type="button"
                class="danger-action-button"
                :disabled="isDeletingContract"
                @click="deleteContract"
              >
                {{ isDeletingContract ? 'Suppression...' : 'Supprimer' }}
              </button>
            </div>
          </div>

          <div class="field-group full">
            <label class="field-label" for="intervenor-contract-file">
              {{ currentContract ? 'Remplacer le contrat PDF' : 'Ajouter le contrat PDF' }}
            </label>
            <input
              id="intervenor-contract-file"
              type="file"
              class="field-input file-input"
              accept="application/pdf"
              @change="onContractFileChange"
            >
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="primary-button"
              :disabled="!selectedContractFile || isUploadingContract"
              @click="uploadContract"
            >
              {{ isUploadingContract ? 'Envoi...' : 'Enregistrer le contrat' }}
            </button>
          </div>

          <p v-if="contractUploadSuccess" class="success-message">
            {{ contractUploadSuccess }}
          </p>

          <p v-if="contractUploadError" class="error-message">
            {{ contractUploadError }}
          </p>
        </div>
      </div>

      <div class="form-card">
        <div class="section-header">
          <h3 class="section-title">Lier à un projet</h3>
        </div>

        <div class="link-grid">
          <div class="field-group grow">
            <label class="field-label" for="projectId">Projet</label>
            <select
              id="projectId"
              v-model="selectedProjectId"
              class="field-input"
              :disabled="projectsPending || !availableProjects.length"
            >
              <option value="">
                Sélectionnez un projet
              </option>
              <option
                v-for="project in availableProjects"
                :key="project.id"
                :value="project.id"
              >
                {{ project.title }} — {{ project.status }}
              </option>
            </select>
          </div>

          <div class="link-action">
            <button
              type="button"
              class="primary-button"
              :disabled="!selectedProjectId || isLinkingProject"
              @click="linkProject"
            >
              {{ isLinkingProject ? 'Liaison...' : 'Lier le projet' }}
            </button>
          </div>
        </div>

        <p v-if="projectLinkSuccess" class="success-message">
          {{ projectLinkSuccess }}
        </p>

        <p v-if="projectLinkError" class="error-message">
          {{ projectLinkError }}
        </p>

        <p v-if="unlinkProjectError" class="error-message">
          {{ unlinkProjectError }}
        </p>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Projets liés</h3>
          <span class="section-counter">{{ intervenor.projectLinks.length }}</span>
        </div>

        <div v-if="!intervenor.projectLinks.length" class="empty-state section-empty-state">
          Aucun projet lié.
        </div>

        <div v-else class="list">
          <div
            v-for="link in intervenor.projectLinks"
            :key="link.id"
            class="item-card"
          >
            <div>
              <strong class="item-title">{{ link.project.title }}</strong>
              <p class="item-meta">
                Statut projet : {{ link.project.status }} •
                Statut liaison : {{ getAssignmentStatusLabel(link.assignmentStatus) }}
              </p>
            </div>

            <div class="document-actions">
              <NuxtLink
                :to="`/projects/${link.project.id}`"
                class="document-action-link"
              >
                Voir la fiche
              </NuxtLink>

              <button
                type="button"
                class="danger-action-button"
                :disabled="unlinkingProjectId === link.project.id"
                @click="unlinkProject(link.project.id)"
              >
                {{
                  unlinkingProjectId === link.project.id
                    ? 'Retrait...'
                    : 'Délier'
                }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Documents administratifs</h3>
          <span class="section-counter">{{ intervenor.documents.length }}</span>
        </div>

        <div v-if="!intervenor.documents.length" class="empty-state section-empty-state">
          Aucun document administratif.
        </div>

        <div v-else class="list">
          <div
            v-for="document in intervenor.documents"
            :key="document.id"
            class="item-card"
          >
            <div>
              <strong class="item-title">
                {{ document.title || document.originalName }}
              </strong>
              <p class="item-meta">
                {{ getDocumentTypeLabel(document.type) }} •
                {{ formatDate(document.createdAt) }}
              </p>
            </div>

            <div class="document-actions">
              <NuxtLink
                :to="`/intervenors/documents/${document.id}`"
                class="document-action-link"
              >
                Consulter
              </NuxtLink>

              <span class="item-badge">
                {{ getDocumentStatusLabel(document.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Documents comptables</h3>
          <span class="section-counter">{{ intervenor.accountingDocuments.length }}</span>
        </div>

        <div v-if="!intervenor.accountingDocuments.length" class="empty-state section-empty-state">
          Aucun document comptable.
        </div>

        <div v-else class="list">
          <div
            v-for="document in intervenor.accountingDocuments"
            :key="document.id"
            class="item-card"
          >
            <div>
              <strong class="item-title">
                {{ document.title || document.originalName }}
              </strong>
              <p class="item-meta">
                {{ getAccountingTypeLabel(document.type) }} •
                {{ formatPeriod(document.periodMonth, document.periodYear) }} •
                {{ formatDate(document.createdAt) }}
              </p>
            </div>

            <span class="item-badge">
              {{ getDocumentStatusLabel(document.status) }}
            </span>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h3 class="section-title">Bilans</h3>
          <span class="section-counter">{{ intervenor.reports.length }}</span>
        </div>

        <div v-if="!intervenor.reports.length" class="empty-state section-empty-state">
          Aucun bilan.
        </div>

        <div v-else class="list">
          <div
            v-for="report in intervenor.reports"
            :key="report.id"
            class="item-card"
          >
            <div>
              <strong class="item-title">
                Séance du {{ formatDate(report.sessionDate) }}
              </strong>
              <p class="item-meta">
                Élèves : {{ report.studentsCount ?? 'Non renseigné' }} •
                Créé le {{ formatDate(report.createdAt) }}
              </p>
            </div>

            <span class="item-badge">
              {{ getReportStatusLabel(report.status) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-card,
.form-card,
.section-card,
.item-card,
.empty-state {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.detail-card,
.form-card,
.section-card {
  padding: 24px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
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

.status-badge,
.item-badge {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  background: #ecfdf5;
  color: #15803d;
  border: 1px solid #86efac;
  white-space: nowrap;
}

.detail-grid,
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.info-block,
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-block.full,
.field-group.full {
  grid-column: 1 / -1;
}

.info-label,
.field-label {
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.info-value {
  color: #111827;
  font-weight: 600;
  line-height: 1.5;
}

.field-input,
.field-textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  font-size: 14px;
  color: #111827;
  background: white;
  outline: none;
  box-sizing: border-box;
}

.field-input {
  min-height: 46px;
  padding: 0 14px;
}

.file-input {
  padding: 10px 14px;
}

.field-textarea {
  padding: 12px 14px;
  resize: vertical;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.section-title {
  margin: 0;
  font-size: 20px;
  color: #111827;
}

.section-counter {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.primary-button {
  min-height: 42px;
  padding: 0 16px;
  border: none;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.primary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.link-grid {
  display: flex;
  gap: 16px;
  align-items: end;
  flex-wrap: wrap;
}

.grow {
  flex: 1;
  min-width: 280px;
}

.link-action {
  display: flex;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-card {
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.item-title {
  color: #111827;
}

.item-meta {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.upload-contract-card,
.contract-current-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.document-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  padding: 24px;
  color: #6b7280;
  text-align: center;
}

.empty-state.error {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fef2f2;
}

.section-empty-state {
  margin-top: 0;
}

@media (max-width: 768px) {
  .detail-card,
  .form-card,
  .section-card {
    padding: 18px;
  }

  .detail-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions,
  .link-action,
  .document-actions {
    width: 100%;
  }

  .primary-button,
  .document-action-link,
  .danger-action-button {
    width: 100%;
  }
}
</style>