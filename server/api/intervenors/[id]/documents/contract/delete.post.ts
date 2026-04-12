import { createError, getRouterParam } from 'h3'
import { access, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const intervenorId = getRouterParam(event, 'id')

  if (!intervenorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Intervenor ID manquant.',
    })
  }

  const contract = await prisma.intervenorDocument.findFirst({
    where: {
      intervenorId,
      type: 'CONTRACT',
      archivedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      filePath: true,
    },
  })

  if (!contract) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Aucun contrat trouvé pour cet intervenant.',
    })
  }

  const absoluteFilePath = join(process.cwd(), contract.filePath)

  try {
    await access(absoluteFilePath, constants.R_OK)
    await unlink(absoluteFilePath)
  } catch {
    // ignore
  }

  await prisma.intervenorDocument.update({
    where: {
      id: contract.id,
    },
    data: {
      archivedAt: new Date(),
    },
  })

  return {
    ok: true,
    message: 'Contrat supprimé avec succès.',
  }
})