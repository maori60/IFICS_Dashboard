import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export const HR_CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'ALTERNANCE', 'APPRENTISSAGE', 'PROFESSIONNALISATION', 'VOLONTARIAT', 'OTHER'] as const
export type HrContractTypeValue = typeof HR_CONTRACT_TYPES[number]

const COMMON_IDENTITY = `Employeur : {{association.legalName}}
SIRET : {{association.siret}}
Adresse : {{association.address}}

Personne concernée : {{employee.fullName}}
Adresse : {{employee.address}}
Date et lieu de naissance : {{employee.birth}}
Nationalité : {{employee.nationality}}

Poste / fonction : {{position.title}}
Lieu de travail : {{contract.workLocation}}
Date de début : {{contract.startDate}}
Durée hebdomadaire : {{contract.weeklyHours}}
Rémunération brute mensuelle indicative : {{contract.salary}}
Période d’essai : {{contract.probationPeriod}}`

export const BUILT_IN_CONTRACT_TEMPLATES: Record<HrContractTypeValue, { name: string; content: string }> = {
  CDI: {
    name: 'Modèle IFICS — CDI',
    content: `CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE — MODÈLE DE TRAVAIL

${COMMON_IDENTITY}

Durée : le présent contrat est conclu pour une durée indéterminée à compter du {{contract.startDate}}.

Conditions complémentaires :
{{contract.additionalConditions}}

Fait pour préparation et validation interne IFICS.

IMPORTANT : ce document est un modèle opérationnel généré par la plateforme. Avant toute signature, son contenu, les mentions obligatoires, la convention collective éventuelle, la rémunération, la durée du travail et les clauses particulières doivent être validés par la fonction RH ou un conseil juridique compétent.`,
  },
  CDD: {
    name: 'Modèle IFICS — CDD',
    content: `CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE — MODÈLE DE TRAVAIL

${COMMON_IDENTITY}
Date de fin prévue : {{contract.endDate}}

Objet / motif à préciser :
{{contract.additionalConditions}}

Le motif légal du recours au CDD, la durée, le renouvellement éventuel et les mentions obligatoires doivent être complétés avant signature.

IMPORTANT : ce document est un modèle opérationnel généré par la plateforme et doit faire l’objet d’une validation RH/juridique avant utilisation.`,
  },
  STAGE: {
    name: 'Modèle IFICS — Stage',
    content: `CONVENTION / DOCUMENT DE STAGE — MODÈLE DE PRÉPARATION

${COMMON_IDENTITY}
Date de fin prévue : {{contract.endDate}}

Missions / objectifs pédagogiques :
{{contract.additionalConditions}}

Ce modèle ne remplace pas la convention tripartite exigée lorsqu’elle s’applique. Les informations de l’établissement d’enseignement, du tuteur, de la gratification, du volume horaire et des assurances doivent être complétées et validées.

IMPORTANT : document de préparation à faire valider avant signature.`,
  },
  ALTERNANCE: {
    name: 'Modèle IFICS — Alternance',
    content: `CONTRAT D’ALTERNANCE — MODÈLE DE PRÉPARATION

${COMMON_IDENTITY}
Date de fin prévue : {{contract.endDate}}

Formation / organisme / rythme et conditions particulières :
{{contract.additionalConditions}}

Le contrat définitif doit être établi selon le dispositif d’alternance effectivement retenu et les formulaires/mentions réglementaires applicables.

IMPORTANT : document de préparation à faire valider par la fonction RH ou un conseil compétent.`,
  },
  APPRENTISSAGE: {
    name: 'Modèle IFICS — Apprentissage',
    content: `CONTRAT D’APPRENTISSAGE — MODÈLE DE PRÉPARATION

${COMMON_IDENTITY}
Date de fin prévue : {{contract.endDate}}

CFA, diplôme préparé, maître d’apprentissage et conditions particulières :
{{contract.additionalConditions}}

Le document définitif et ses formalités doivent respecter le régime de l’apprentissage applicable au dossier concerné.

IMPORTANT : document de préparation à faire valider avant signature.`,
  },
  PROFESSIONNALISATION: {
    name: 'Modèle IFICS — Professionnalisation',
    content: `CONTRAT DE PROFESSIONNALISATION — MODÈLE DE PRÉPARATION

${COMMON_IDENTITY}
Date de fin prévue : {{contract.endDate}}

Formation, organisme, qualification visée et conditions particulières :
{{contract.additionalConditions}}

Le contrat définitif doit être complété avec les mentions et formalités correspondant au dispositif réellement utilisé.

IMPORTANT : document de préparation à faire valider avant signature.`,
  },
  VOLONTARIAT: {
    name: 'Modèle IFICS — Volontariat',
    content: `CONVENTION DE VOLONTARIAT — MODÈLE DE PRÉPARATION

${COMMON_IDENTITY}
Date de fin prévue : {{contract.endDate}}

Mission, cadre du volontariat, indemnisation éventuelle et conditions particulières :
{{contract.additionalConditions}}

IMPORTANT : le régime juridique dépend du dispositif de volontariat retenu. Ce document est un modèle de préparation et doit être adapté puis validé avant signature.`,
  },
  OTHER: {
    name: 'Modèle IFICS — Autre engagement',
    content: `DOCUMENT CONTRACTUEL — MODÈLE DE PRÉPARATION

${COMMON_IDENTITY}
Date de fin éventuelle : {{contract.endDate}}

Conditions particulières :
{{contract.additionalConditions}}

IMPORTANT : modèle générique à adapter au cadre juridique réel et à faire valider avant signature.`,
  },
}

export function contractTypeLabel(type: HrContractTypeValue): string {
  return ({
    CDI: 'CDI',
    CDD: 'CDD',
    STAGE: 'Stage',
    ALTERNANCE: 'Alternance',
    APPRENTISSAGE: 'Apprentissage',
    PROFESSIONNALISATION: 'Professionnalisation',
    VOLONTARIAT: 'Volontariat',
    OTHER: 'Autre',
  } as Record<HrContractTypeValue, string>)[type]
}

export function renderContractTemplate(template: string, values: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_match, key: string) => {
    const value = values[key]
    return value && value.trim() ? value.trim() : 'Non renseigné'
  })
}

function cleanText(value: string): string {
  return Array.from(value).map(character => {
    const code = character.charCodeAt(0)
    return code < 32 && character !== '\n' && character !== '\t' ? ' ' : character
  }).join('')
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = cleanText(text).replace(/\t/g, ' ').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

export async function generateContractPdf(input: {
  title: string
  content: string
  associationName: string
  reference?: string | null
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const width = 595.28
  const height = 841.89
  const margin = 48
  let page: PDFPage = pdf.addPage([width, height])
  let y = height - margin

  const newPage = () => {
    page = pdf.addPage([width, height])
    y = height - margin
  }

  page.drawText(cleanText(input.title).slice(0, 90), { x: margin, y, size: 18, font: bold, color: rgb(0.06, 0.25, 0.17) })
  if (input.reference) page.drawText(cleanText(input.reference).slice(0, 50), { x: width - margin - 150, y: y + 2, size: 9, font: regular })
  y -= 34

  const paragraphs = cleanText(input.content).split(/\n{2,}/)
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').flatMap(line => wrapText(line, regular, 9.5, width - 2 * margin))
    const blockHeight = lines.length * 13 + 10
    if (y - blockHeight < 55) newPage()
    lines.forEach((line, index) => page.drawText(line, { x: margin, y: y - index * 13, size: 9.5, font: regular, color: rgb(0.12, 0.16, 0.23) }))
    y -= blockHeight
  }

  for (const pdfPage of pdf.getPages()) {
    pdfPage.drawText(`${cleanText(input.associationName).slice(0, 80)} — document RH généré par IFICS Platform`, { x: margin, y: 26, size: 7, font: regular, color: rgb(0.45, 0.49, 0.57) })
  }

  return pdf.save()
}
