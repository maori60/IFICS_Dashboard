<script setup lang="ts">
const route = useRoute()

const projectId = computed(() => String(route.params.id || ''))
const documentId = computed(() => String(route.params.documentId || ''))

const pdfUrl = computed(() => `/api/projects/documents/${documentId.value}/view`)
</script>

<template>
  <div class="viewer-page">
    <div class="viewer-header">
      <NuxtLink :to="`/projects/${projectId}`" class="back-link">
        ← Retour au projet
      </NuxtLink>
    </div>

    <div class="viewer-container">
      <iframe
        :src="pdfUrl"
        class="pdf-frame"
        title="Aperçu du document PDF"
      />
    </div>
  </div>
</template>

<style scoped>
.viewer-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 140px);
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.back-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  background: white;
  color: #111827;
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.2s ease;
}

.back-link:hover {
  background: #f9fafb;
  border-color: #cbd5e1;
}

.viewer-container {
  flex: 1;
  min-height: 78vh;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  overflow: hidden;
  background: white;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.pdf-frame {
  width: 100%;
  height: 78vh;
  border: none;
  display: block;
}

@media (max-width: 768px) {
  .pdf-frame {
    height: 70vh;
  }
}
</style>