// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css', '~/assets/css/public-polish.css', '~/assets/css/public-photos.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      titleTemplate: '%s · IFICS',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#123b2a' },
        { name: 'description', content: 'IFICS — projets d’éducation, numérique & IT, insertion, culture, sport, innovation et R&D au service des territoires.' },
      ],
    },
  },
  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
})
