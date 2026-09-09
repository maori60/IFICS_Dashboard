<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Paramètres IFICS' })

type FinanceSettings = {
  legalForm: string | null
  rnaNumber: string | null
  vatNumber: string | null
  bankName: string | null
  bankAccountHolder: string | null
  iban: string | null
  bic: string | null
  paymentTerms: string | null
  taxExemptionText: string | null
  logoFilePath: string | null
  maxAssetDocuments: number
  maxAssetDocumentMb: number
}

type Settings = {
  id: string
  name: string
  legalName: string | null
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  legalNotice: string | null
  billingName: string | null
  billingAddress: string | null
  billingPostalCode: string | null
  billingCity: string | null
  billingCountry: string | null
  billingEmail: string | null
  billingPhone: string | null
  siret: string | null
  pdfFooter: string | null
  timezone: string
  locale: string
  currency: string
  finance: FinanceSettings
}

const { data, error, refresh } = await useFetch<ApiSuccess<Settings>>('/api/settings')
const settings = computed(() => data.value?.data ?? null)
const saving = ref(false)
const uploadingLogo = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const logoFile = ref<File | null>(null)

const form = reactive({
  name: '',
  legalName: '',
  legalForm: '',
  siret: '',
  rnaNumber: '',
  vatNumber: '',
  billingName: '',
  billingAddress: '',
  billingPostalCode: '',
  billingCity: '',
  billingCountry: 'France',
  billingEmail: '',
  billingPhone: '',
  bankName: '',
  bankAccountHolder: '',
  iban: '',
  bic: '',
  paymentTerms: '',
  taxExemptionText: '',
  pdfFooter: '',
  primaryColor: '',
  secondaryColor: '',
  timezone: 'Europe/Paris',
  locale: 'fr-FR',
  currency: 'EUR',
  maxAssetDocuments: 20,
  maxAssetDocumentMb: 10,
})

watch(settings, (value) => {
  if (!value) return
  Object.assign(form, {
    name: value.name,
    legalName: value.legalName || '',
    legalForm: value.finance.legalForm || '',
    siret: value.siret || '',
    rnaNumber: value.finance.rnaNumber || '',
    vatNumber: value.finance.vatNumber || '',
    billingName: value.billingName || '',
    billingAddress: value.billingAddress || '',
    billingPostalCode: value.billingPostalCode || '',
    billingCity: value.billingCity || '',
    billingCountry: value.billingCountry || 'France',
    billingEmail: value.billingEmail || '',
    billingPhone: value.billingPhone || '',
    bankName: value.finance.bankName || '',
    bankAccountHolder: value.finance.bankAccountHolder || '',
    iban: value.finance.iban || '',
    bic: value.finance.bic || '',
    paymentTerms: value.finance.paymentTerms || '',
    taxExemptionText: value.finance.taxExemptionText || '',
    pdfFooter: value.pdfFooter || '',
    primaryColor: value.primaryColor || '',
    secondaryColor: value.secondaryColor || '',
    timezone: value.timezone || 'Europe/Paris',
    locale: value.locale || 'fr-FR',
    currency: value.currency || 'EUR',
    maxAssetDocuments: value.finance.maxAssetDocuments || 20,
    maxAssetDocumentMb: value.finance.maxAssetDocumentMb || 10,
  })
}, { immediate: true })

function selectLogo(event: Event) {
  const input = event.target as HTMLInputElement
  logoFile.value = input.files?.[0] ?? null
}

async function uploadLogo() {
  if (!logoFile.value || uploadingLogo.value) return
  uploadingLogo.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const body = new FormData()
    body.append('file', logoFile.value)
    await $fetch('/api/settings/logo', { method: 'POST', body })
    logoFile.value = null
    await refresh()
    successMessage.value = 'Logo IFICS mis à jour. Il pourra être réutilisé dans les documents générés.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Le logo n’a pas pu être envoyé.')
  }
  finally {
    uploadingLogo.value = false
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { ...form, logoUrl: settings.value?.logoUrl || undefined } })
    await refresh()
    successMessage.value = 'Paramètres de l’association enregistrés.'
  }
  catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Les paramètres n’ont pas pu être enregistrés.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Paramètres IFICS</h1><p>Données légales, facturation, identité visuelle, banque et règles documentaires.</p></div>
    </div>

    <div v-if="error" class="alert alert-error">Vous n’avez pas accès aux paramètres de l’association.</div>
    <template v-else-if="settings">
      <div v-if="successMessage" class="alert alert-success message-gap">{{ successMessage }}</div>
      <div v-if="errorMessage" class="alert alert-error message-gap">{{ errorMessage }}</div>

      <section class="card card-pad settings-section">
        <div class="section-title-row"><div><h2>Identité et logo</h2><p class="muted">Le logo centralisé sera réutilisable sur le site et les PDF.</p></div><img v-if="settings.logoUrl" :src="`${settings.logoUrl}?v=${encodeURIComponent(settings.finance.logoFilePath || '')}`" alt="Logo IFICS configuré" class="logo-preview"></div>
        <div class="form-grid">
          <div class="field"><label for="settings-name">Nom usuel *</label><input id="settings-name" v-model="form.name" class="input" required maxlength="150"></div>
          <div class="field"><label for="settings-legal-name">Raison sociale</label><input id="settings-legal-name" v-model="form.legalName" class="input" maxlength="255"></div>
          <div class="field"><label for="settings-legal-form">Forme juridique</label><input id="settings-legal-form" v-model="form.legalForm" class="input" maxlength="100" placeholder="Association loi 1901"></div>
          <div class="field"><label for="settings-siret">SIRET</label><input id="settings-siret" v-model="form.siret" class="input" maxlength="30" inputmode="numeric"></div>
          <div class="field"><label for="settings-rna">Numéro RNA</label><input id="settings-rna" v-model="form.rnaNumber" class="input" maxlength="40"></div>
          <div class="field"><label for="settings-vat">N° TVA intracommunautaire</label><input id="settings-vat" v-model="form.vatNumber" class="input" maxlength="40"></div>
          <div class="field"><label for="settings-primary">Couleur principale</label><input id="settings-primary" v-model="form.primaryColor" class="input" placeholder="#123B2A"></div>
          <div class="field"><label for="settings-secondary">Couleur secondaire</label><input id="settings-secondary" v-model="form.secondaryColor" class="input" placeholder="#E7F2EA"></div>
        </div>
        <div class="logo-upload">
          <div class="field"><label for="settings-logo">Fichier logo</label><input id="settings-logo" class="input" type="file" accept="image/png,image/jpeg" @change="selectLogo"><span class="help">PNG ou JPEG, 5 Mo maximum. Les SVG ne sont pas acceptés dans cette première version pour réduire la surface d’attaque.</span></div>
          <button class="btn btn-secondary" type="button" :disabled="!logoFile || uploadingLogo" @click="uploadLogo">{{ uploadingLogo ? 'Envoi…' : 'Envoyer le logo' }}</button>
        </div>
      </section>

      <section class="card card-pad settings-section">
        <h2>Coordonnées de facturation</h2>
        <div class="form-grid">
          <div class="field"><label for="settings-billing-name">Nom affiché</label><input id="settings-billing-name" v-model="form.billingName" class="input" maxlength="255"></div>
          <div class="field"><label for="settings-billing-email">E-mail</label><input id="settings-billing-email" v-model="form.billingEmail" class="input" type="email" maxlength="255"></div>
          <div class="field field-full"><label for="settings-billing-address">Adresse</label><input id="settings-billing-address" v-model="form.billingAddress" class="input" maxlength="255"></div>
          <div class="field"><label for="settings-billing-postal">Code postal</label><input id="settings-billing-postal" v-model="form.billingPostalCode" class="input" maxlength="20"></div>
          <div class="field"><label for="settings-billing-city">Ville</label><input id="settings-billing-city" v-model="form.billingCity" class="input" maxlength="120"></div>
          <div class="field"><label for="settings-billing-country">Pays</label><input id="settings-billing-country" v-model="form.billingCountry" class="input" maxlength="100"></div>
          <div class="field"><label for="settings-billing-phone">Téléphone</label><input id="settings-billing-phone" v-model="form.billingPhone" class="input" maxlength="30"></div>
        </div>
      </section>

      <section class="card card-pad settings-section">
        <h2>Compte bancaire utilisé pour les règlements clients</h2>
        <p class="muted">Ces informations sont réservées aux utilisateurs autorisés et peuvent être injectées automatiquement dans les factures.</p>
        <div class="form-grid">
          <div class="field"><label for="settings-bank-name">Banque</label><input id="settings-bank-name" v-model="form.bankName" class="input" maxlength="150"></div>
          <div class="field"><label for="settings-account-holder">Titulaire du compte</label><input id="settings-account-holder" v-model="form.bankAccountHolder" class="input" maxlength="200"></div>
          <div class="field field-full"><label for="settings-iban">IBAN</label><input id="settings-iban" v-model="form.iban" class="input mono" maxlength="50" autocomplete="off"></div>
          <div class="field"><label for="settings-bic">BIC</label><input id="settings-bic" v-model="form.bic" class="input mono" maxlength="20" autocomplete="off"></div>
          <div class="field field-full"><label for="settings-payment-terms">Conditions de règlement</label><textarea id="settings-payment-terms" v-model="form.paymentTerms" class="textarea" rows="3" placeholder="Ex. Règlement à 30 jours par virement bancaire." /></div>
          <div class="field field-full"><label for="settings-tax-text">Mention de TVA / exonération</label><textarea id="settings-tax-text" v-model="form.taxExemptionText" class="textarea" rows="3" placeholder="À renseigner uniquement si la situation fiscale d’IFICS l’exige." /><span class="help">Le logiciel ne choisit pas automatiquement une mention fiscale : elle doit être validée et configurée par IFICS.</span></div>
        </div>
      </section>

      <section class="card card-pad settings-section">
        <h2>PDF et documents</h2>
        <div class="form-grid">
          <div class="field field-full"><label for="settings-pdf-footer">Pied de page PDF</label><textarea id="settings-pdf-footer" v-model="form.pdfFooter" class="textarea" rows="3" /></div>
          <div class="field"><label for="settings-asset-count">Documents max. par matériel</label><input id="settings-asset-count" v-model.number="form.maxAssetDocuments" class="input" type="number" min="1" max="100"></div>
          <div class="field"><label for="settings-asset-size">Taille max. par document (Mo)</label><input id="settings-asset-size" v-model.number="form.maxAssetDocumentMb" class="input" type="number" min="1" max="50"></div>
          <div class="field"><label for="settings-currency">Devise</label><input id="settings-currency" v-model="form.currency" class="input" maxlength="3"></div>
          <div class="field"><label for="settings-timezone">Fuseau horaire</label><input id="settings-timezone" v-model="form.timezone" class="input" maxlength="100"></div>
        </div>
      </section>

      <section class="card card-pad settings-section contract-callout">
        <div><h2>Modèles de contrats RH</h2><p class="muted">Les modèles CDI, CDD, stage, alternance et autres seront administrés ici avec versionnement. Chaque contrat généré conservera son propre instantané.</p></div>
        <NuxtLink class="btn btn-secondary" to="/dashboard/settings/contracts">Gérer les modèles</NuxtLink>
      </section>

      <div class="save-bar"><button class="btn btn-primary" type="button" :disabled="saving" @click="save">{{ saving ? 'Enregistrement…' : 'Enregistrer les paramètres' }}</button></div>
    </template>
  </div>
</template>

<style scoped>
.settings-section{margin-bottom:20px}.settings-section h2{margin-top:0}.message-gap{margin-bottom:18px}.section-title-row{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.logo-preview{width:110px;height:80px;object-fit:contain;border:1px solid var(--ifics-border);border-radius:12px;background:#fff;padding:8px}.logo-upload{display:flex;align-items:end;gap:14px;margin-top:18px}.logo-upload .field{flex:1}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.contract-callout{display:flex;justify-content:space-between;align-items:center;gap:24px}.contract-callout p{margin-bottom:0}.save-bar{position:sticky;bottom:16px;display:flex;justify-content:flex-end;padding:14px;border:1px solid var(--ifics-border);border-radius:16px;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);box-shadow:var(--ifics-shadow)}@media(max-width:700px){.section-title-row,.logo-upload,.contract-callout{flex-direction:column;align-items:stretch}.logo-preview{width:100%;height:120px}}
</style>