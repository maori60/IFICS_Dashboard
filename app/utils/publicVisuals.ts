import education from './visuals/education'
import sport from './visuals/sport'
import culture from './visuals/culture'
import numerique from './visuals/numerique'
import insertion from './visuals/insertion'
import innovation from './visuals/innovation'

export const publicVisuals = {
  education,
  sport,
  culture,
  numerique,
  insertion,
  innovation,
  citoyennete: culture,
} as const

export type PublicVisualKey = keyof typeof publicVisuals

export function visualForDomain(label: string | null | undefined): string {
  const value = (label || '').toLocaleLowerCase('fr-FR')
  if (value.includes('sport')) return sport
  if (value.includes('culture') || value.includes('artist')) return culture
  if (value.includes('numér') || value.includes('numer') || value.includes('digital')) return numerique
  if (value.includes('insert') || value.includes('emploi') || value.includes('profession')) return insertion
  if (value.includes('innov') || value.includes('r&d') || value.includes('recherche')) return innovation
  if (value.includes('citoy') || value.includes('social')) return culture
  return education
}
