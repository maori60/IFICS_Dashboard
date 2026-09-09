export const publicVisuals = {
  home: '/images/site/home.webp',
  association: '/images/site/association.webp',
  actions: '/images/site/actions.webp',
  education: '/images/site/actions.webp',
  sport: '/images/site/join.webp',
  culture: '/images/site/news.webp',
  numerique: '/images/site/resources.webp',
  insertion: '/images/site/proposal.webp',
  innovation: '/images/site/innovation.webp',
  projects: '/images/site/projects.webp',
  news: '/images/site/news.webp',
  partners: '/images/site/partners.webp',
  join: '/images/site/join.webp',
  proposal: '/images/site/proposal.webp',
  resources: '/images/site/resources.webp',
  citoyennete: '/images/site/association.webp',
} as const

export type PublicVisualKey = keyof typeof publicVisuals

export function visualForDomain(label: string | null | undefined): string {
  const value = (label || '').toLocaleLowerCase('fr-FR')
  if (value.includes('sport')) return publicVisuals.sport
  if (value.includes('culture') || value.includes('artist')) return publicVisuals.culture
  if (value.includes('numér') || value.includes('numer') || value.includes('digital')) return publicVisuals.numerique
  if (value.includes('insert') || value.includes('emploi') || value.includes('profession')) return publicVisuals.insertion
  if (value.includes('innov') || value.includes('r&d') || value.includes('recherche')) return publicVisuals.innovation
  if (value.includes('citoy') || value.includes('social')) return publicVisuals.association
  return publicVisuals.projects
}
