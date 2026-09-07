<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
definePageMeta({layout:'dashboard',middleware:'auth'});useHead({title:'Innovation & R&D'})
type Rnd={id:string;title:string;description:string|null;status:string;budget:string|null;repoUrl:string|null;documentationUrl:string|null;publicEnabled:boolean;updatedAt:string}
const {data,error,refresh}=await useFetch<ApiSuccess<Rnd[]>>('/api/rnd');const items=computed(()=>data.value?.data??[])
</script>
<template><div><div class="page-head"><div><h1>Innovation & R&D</h1><p>Idées, expérimentations, prototypes et projets techniques.</p></div><button class="btn btn-secondary" type="button" @click="refresh()">Actualiser</button></div><div v-if="error" class="alert alert-error">Impossible de charger la R&D.</div><div v-else-if="!items.length" class="empty-state">Aucun projet R&D enregistré.</div><div v-else class="grid grid-2"><article v-for="item in items" :key="item.id" class="card card-pad"><div class="actions"><span class="badge">{{ item.status }}</span><span v-if="item.publicEnabled" class="badge">Public autorisé</span></div><h2>{{ item.title }}</h2><p class="muted">{{ item.description || 'Aucune description.' }}</p><div class="actions"><a v-if="item.repoUrl" :href="item.repoUrl" class="btn btn-secondary">Dépôt</a><a v-if="item.documentationUrl" :href="item.documentationUrl" class="btn btn-secondary">Documentation</a></div></article></div></div></template>
<style scoped>h2{margin:14px 0 6px}</style>
