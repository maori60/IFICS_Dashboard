import { createError, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import type { IntervenorStatus } from '../../../../generated/prisma/client'

export default defineEventHandler(async (event) => {
  const intervenorId = getRouterParam(event, 'id')

  if (!intervenorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Intervenor ID manquant.',
    })
  }

  const body = await readBody(event)

  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = String(body.phone || '').trim()
  const specialty = String(body.specialty || '').trim()
  const siret = String(body.siret || '').trim()
  const ribIban = String(body.ribIban || '').trim()
  const ribBic = String(body.ribBic || '').trim()
  const addressLine1 = String(body.addressLine1 || '').trim()
  const addressLine2 = String(body.addressLine2 || '').trim()
  const postalCode = String(body.postalCode || '').trim()
  const city = String(body.city || '').trim()
  const country = String(body.country || '').trim()
  const notes = String(body.notes || '').trim()

  const allowedStatuses: IntervenorStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
  const rawStatus = String(body.status || '').trim()
  const status: IntervenorStatus = allowedStatuses.includes(rawStatus as IntervenorStatus)
    ? (rawStatus as IntervenorStatus)
    : 'ACTIVE'

  if (!firstName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Le prénom est obligatoire.',
    })
  }

  if (!lastName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Le nom est obligatoire.',
    })
  }

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'L’email est obligatoire.',
    })
  }

  if (!email.includes('@')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email invalide.',
    })
  }

  const existing = await prisma.intervenor.findFirst({
    where: {
      id: intervenorId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Intervenant introuvable.',
    })
  }

  try {
    const intervenor = await prisma.intervenor.update({
      where: {
        id: intervenorId,
      },
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        specialty: specialty || null,
        siret: siret || null,
        ribIban: ribIban || null,
        ribBic: ribBic || null,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        postalCode: postalCode || null,
        city: city || null,
        country: country || null,
        notes: notes || null,
        status,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        specialty: true,
        status: true,
        siret: true,
        ribIban: true,
        ribBic: true,
        addressLine1: true,
        addressLine2: true,
        postalCode: true,
        city: true,
        country: true,
        notes: true,
        updatedAt: true,
      },
    })

    return {
      ok: true,
      data: intervenor,
    }
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Un intervenant avec cet email existe déjà.',
      })
    }

    console.error(err)

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la mise à jour de l’intervenant.',
    })
  }
})