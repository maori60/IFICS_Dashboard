import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const client = await prisma.client.create({
    data: {
      associationId: body.associationId,
      type: body.type,
      name: body.name,
      email: body.email,
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