<script setup lang="ts">
import type { ApiSuccess, SessionPayload } from '~/types/api'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Créer un contenu' })

const { data: session } = await useFetch<ApiSuccess<SessionPayload>>('/api/auth/me', { key:'session-me' })
const permissions = computed(() => session.value?.data.user.permissions ?? [])
const canWrite = computed(() => permissions.value.includes('*') || permissions.value.includes('content:write'))
const form = reactive({ kind:'NEWS', slug:'', titleFr:'', titleEn:'', excerptFr:'', excerptEn:'', bodyFr:'', bodyEn:'', heroImageUrl:'', featured:false })
const saving=ref(false);const errorMessage=ref('')

async function submit(){if(!canWrite.value||saving.value)return;saving.value=true;errorMessage.value='';try{const response=await $fetch<ApiSuccess<{id:string}>>('/api/content/create',{method:'POST',body:form});await navigateTo(`/dashboard/content/${response.data.id}?created=1`)}catch(error){errorMessage.value=apiErrorMessage(error,'Le contenu n’a pas pu être créé.')}finally{saving.value=false}}
</script>

<template><div><div class="page-head"><div><h1>Nouveau contenu</h1><p>Créez un brouillon public FR/EN, puis faites-le passer par le workflow éditorial.</p></div><NuxtLink class="btn btn-secondary" to="/dashboard/content">Retour</NuxtLink></div>
<div v-if="!canWrite" class="alert alert-error">Votre rôle ne permet pas de créer du contenu.</div>
<form v-else class="card card-pad" @submit.prevent="submit"><div v-if="errorMessage" class="alert alert-error" style="margin-bottom:18px">{{ errorMessage }}</div><div class="form-grid">
<div class="field"><label for="content-kind">Type *</label><select id="content-kind" v-model="form.kind" class="select" required><option value="PAGE">Page</option><option value="ARTICLE">Article</option><option value="NEWS">Actualité</option><option value="RND">R&D</option><option value="ACTIVITY_REPORT">Rapport d’activité</option></select></div>
<div class="field"><label for="content-slug">Slug</label><input id="content-slug" v-model="form.slug" class="input" maxlength="180" placeholder="Généré automatiquement si vide"></div>
<div class="field"><label for="content-title-fr">Titre FR *</label><input id="content-title-fr" v-model="form.titleFr" class="input" maxlength="255" required></div>
<div class="field"><label for="content-title-en">Titre EN</label><input id="content-title-en" v-model="form.titleEn" class="input" maxlength="255"></div>
<div class="field field-full"><label for="content-excerpt-fr">Résumé FR</label><textarea id="content-excerpt-fr" v-model="form.excerptFr" class="textarea" rows="3" /></div>
<div class="field field-full"><label for="content-body-fr">Contenu FR *</label><textarea id="content-body-fr" v-model="form.bodyFr" class="textarea" rows="14" required maxlength="200000" /></div>
<div class="field field-full"><label for="content-excerpt-en">Résumé EN</label><textarea id="content-excerpt-en" v-model="form.excerptEn" class="textarea" rows="3" /></div>
<div class="field field-full"><label for="content-body-en">Contenu EN</label><textarea id="content-body-en" v-model="form.bodyEn" class="textarea" rows="10" maxlength="200000" /></div>
<div class="field field-full"><label for="content-image">URL image de couverture</label><input id="content-image" v-model="form.heroImageUrl" class="input" maxlength="500" placeholder="https://"></div>
</div><label style="display:flex;gap:8px;align-items:center;margin-top:14px"><input v-model="form.featured" type="checkbox"> Mettre à la une lorsque publié</label><div class="actions" style="margin-top:22px"><button class="btn btn-primary" type="submit" :disabled="saving||!form.titleFr.trim()||!form.bodyFr.trim()">{{ saving?'Création…':'Créer le brouillon' }}</button><NuxtLink class="btn btn-secondary" to="/dashboard/content">Annuler</NuxtLink></div></form></div></template>
