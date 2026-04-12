import { prisma } from '../../utils/prisma'

const DEFAULT_ASSOCIATION_ID = 'assoc_default_ifics'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  let associationId = body.associationId as string | undefined

  if (associationId) {
    const existingAssociation = await prisma.association.findUnique({
      where: { id: associationId },
      select: { id: true },
    })

    if (!existingAssociation) {
      associationId = undefined
    }
  }

  if (!associationId) {
    const defaultAssociation = await prisma.association.findUnique({
      where: { id: DEFAULT_ASSOCIATION_ID },
      select: { id: true },
    })

    if (defaultAssociation) {
      associationId = defaultAssociation.id
    }
  }

  if (!associationId) {
    const firstAssociation = await prisma.association.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    if (firstAssociation) {
      associationId = firstAssociation.id
    }
  }

  if (!associationId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'No association available to create client.',
    })
  }

  const client = await prisma.client.create({
    data: {
      associationId,
      type: body.type,
      name: body.name,
      email: body.email || null,
      addressLine1: body.addressLine1,
      postalCode: body.postalCode,
      city: body.city,
      country: body.country,
    },
  })

  return {
    ok: true,
    data: client,
  }
})