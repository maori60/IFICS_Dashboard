type PublicSeoOptions = {
  title: string
  description: string
  path: string
  image?: string
}

export function usePublicSeo(options: PublicSeoOptions) {
  const siteUrl = 'https://ifics.org'
  const canonicalUrl = `${siteUrl}${options.path === '/' ? '/' : options.path}`
  const socialImage = options.image
    ? `${siteUrl}${options.image}`
    : `${siteUrl}/brand/v2/ifics-wordmark-light.png`

  useHead({
    title: options.title,

    link: [
      {
        rel: 'canonical',
        href: canonicalUrl,
      },
    ],

    meta: [
      {
        name: 'description',
        content: options.description,
      },
      {
        name: 'robots',
        content: 'index, follow',
      },

      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'IFICS',
      },
      {
        property: 'og:locale',
        content: 'fr_FR',
      },
      {
        property: 'og:title',
        content: options.title,
      },
      {
        property: 'og:description',
        content: options.description,
      },
      {
        property: 'og:url',
        content: canonicalUrl,
      },
      {
        property: 'og:image',
        content: socialImage,
      },

      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: options.title,
      },
      {
        name: 'twitter:description',
        content: options.description,
      },
      {
        name: 'twitter:image',
        content: socialImage,
      },
    ],
  })
}
