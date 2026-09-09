export const publicVisuals = {
  home: '/illustrations/home.svg',
  association: '/illustrations/association.svg',
  actions: '/illustrations/actions.svg',
  education: '/illustrations/education.svg',
  sport: '/illustrations/sport.svg',
  culture: '/illustrations/culture.svg',
  numerique: '/illustrations/numerique.svg',
  insertion: '/illustrations/insertion.svg',
  innovation: '/illustrations/innovation.svg',
  projects: '/illustrations/projects.svg',
  news: '/illustrations/news.svg',
  partners: '/illustrations/partners.svg',
  join: '/illustrations/join.svg',
  proposal: '/illustrations/proposal.svg',
  resources: '/illustrations/resources.svg',
  citoyennete: '/illustrations/association.svg',
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
