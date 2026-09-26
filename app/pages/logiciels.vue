<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'

useHead({ title: 'KREATORTECH — Logiciels & ressources' })

type Software = {
  id: string
  slug: string
  name: string
  description: string | null
  audience: string | null
  platforms: string[]
  license: string | null
  openSource: boolean
  repoUrl: string | null
  docsUrl: string | null
  videoUrl: string | null
  status: string
  category: { id: string; name: string; kind: string } | null
  latestVersion: {
    version: string
    downloadUrl: string | null
    sha256: string | null
    fileSize: string | null
    publishedAt: string | null
  } | null
  downloadCount: number
}

const { data } = await useFetch<ApiSuccess<Software[]>>('/api/public/software')
const items = computed(() => data.value?.data ?? [])

const resourceFamilies = [
  {
    icon: '◇',
    title: 'Applications',
    text: 'Outils complets pour des usages concrets.',
    tag: 'Applications',
  },
  {
    icon: '▤',
    title: 'Documentation',
    text: 'Guides, procédures et retours d’expérience.',
    tag: 'Documentation',
  },
  {
    icon: '⚙',
    title: 'Outils métiers',
    text: 'Scripts, utilitaires et ressources techniques.',
    tag: 'Outils',
  },
  {
    icon: '⌁',
    title: 'Ressources ouvertes',
    text: 'Contenus réutilisables et libres d’accès.',
    tag: 'Open source',
  },
]
</script>

<template>
  <div class="v9-page v9-software">
    <section class="v9-hero">
      <div class="container v9-hero-grid">
        <div class="v9-hero-copy">
          <p class="v9-eyebrow">KREATORTECH · Ressources</p>

          <h1>
            Des outils utiles.<br>
            Pas des démos<br>
            oubliées.
          </h1>

          <p class="v9-lead">
            Nous concevons et documentons des logiciels, ressources et outils
            métiers lorsqu’ils répondent à un besoin réel. Versions, plateformes,
            licences et informations techniques restent lisibles.
          </p>

          <div class="v9-actions">
            <NuxtLink to="/kreatortech" class="v9-btn v9-btn-primary">
              Découvrir KREATORTECH
              <span>→</span>
            </NuxtLink>

            <NuxtLink to="/innovation" class="v9-btn v9-btn-secondary">
              Innovation & R&amp;D
            </NuxtLink>
          </div>
        </div>

        <div class="v9-code-visual" aria-hidden="true">
          <div class="v9-code-plane v9-code-plane-back" />
          <div class="v9-code-plane v9-code-plane-mid" />

          <div class="v9-code-screen">
            <span>&lt;/&gt;</span>
          </div>

          <div class="v9-code-base" />

          <div class="v9-code-label v9-code-label-1">Open source</div>
          <div class="v9-code-label v9-code-label-2">Documentation</div>
          <div class="v9-code-label v9-code-label-3">Versioning</div>
          <div class="v9-code-label v9-code-label-4">Usage réel</div>
        </div>
      </div>
    </section>

    <section class="v9-section">
      <div class="container">
        <div class="v9-section-heading">
          <div>
            <p class="v9-eyebrow">Catalogue public</p>
            <h2>Logiciels &amp; ressources disponibles</h2>
          </div>

          <p>
            Le catalogue public ne présente que les ressources dont la diffusion
            est autorisée.
          </p>
        </div>

        <div
          v-if="items.length"
          class="v9-software-grid"
        >
          <article
            v-for="item in items"
            :key="item.id"
            class="v9-software-card"
          >
            <div class="v9-software-head">
              <span>{{ item.category?.name || 'KREATORTECH' }}</span>
              <span>{{ item.status }}</span>
            </div>

            <h3>{{ item.name }}</h3>
            <p>{{ item.description }}</p>

            <dl>
              <div>
                <dt>Plateformes</dt>
                <dd>{{ item.platforms.join(' · ') || 'Non précisées' }}</dd>
              </div>

              <div>
                <dt>Licence</dt>
                <dd>{{ item.license || 'Non renseignée' }}</dd>
              </div>

              <div v-if="item.latestVersion">
                <dt>Version</dt>
                <dd>{{ item.latestVersion.version }}</dd>
              </div>
            </dl>

            <details v-if="item.latestVersion?.sha256">
              <summary>Empreinte SHA-256</summary>
              <code>{{ item.latestVersion.sha256 }}</code>
            </details>

            <div class="v9-software-actions">
              <a
                v-if="item.latestVersion?.downloadUrl"
                :href="item.latestVersion.downloadUrl"
                class="v9-btn v9-btn-primary"
              >
                Télécharger
              </a>

              <a
                v-if="item.repoUrl"
                :href="item.repoUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Code source ↗
              </a>

              <a
                v-if="item.docsUrl"
                :href="item.docsUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Documentation ↗
              </a>
            </div>
          </article>
        </div>

        <div
          v-else
          class="v9-feature-grid v9-feature-grid-4"
        >
          <article
            v-for="resource in resourceFamilies"
            :key="resource.title"
            class="v9-feature-card"
          >
            <span class="v9-feature-icon">{{ resource.icon }}</span>
            <h3>{{ resource.title }}</h3>
            <p>{{ resource.text }}</p>
            <span class="v9-tag">{{ resource.tag }}</span>
          </article>
        </div>

        <div
          v-if="!items.length"
          class="v9-catalog-status"
        >
          <span class="v9-status-dot" />
          <div>
            <strong>Le catalogue public est en préparation.</strong>
            <p>
              Les premières ressources apparaîtront après validation technique
              et éditoriale.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="v9-bottom-shell">
      <div class="container">
        <div class="v9-bottom-card">
          <div>
            <p class="v9-eyebrow">Besoin d’un outil ou d’un accompagnement ?</p>
            <h2>Parlons de votre contexte.</h2>
          </div>

          <div class="v9-bottom-copy">
            <p>
              Nous étudions le besoin avant de choisir une réponse :
              développement, support, adaptation ou formation.
            </p>

            <NuxtLink to="/contact" class="v9-btn v9-btn-primary">
              Nous contacter
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
