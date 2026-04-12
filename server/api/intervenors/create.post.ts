import { createError, readBody } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = String(body.phone || '').trim()
  const specialty = String(body.specialty || '').trim()

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

  const association = await prisma.association.findFirst({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
    },
  })

  if (!association) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aucune association trouvée en base.',
    })
  }

  try {
    const intervenor = await prisma.intervenor.create({
      data: {
        associationId: association.id,
        firstName,
        lastName,
        email,
        phone: phone || null,
        specialty: specialty || null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        specialty: true,
        status: true,
        createdAt: true,
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
      statusMessage: 'Erreur serveur lors de la création de l’intervenant.',
    })
  }
})