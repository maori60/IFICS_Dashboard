import { createError, getRouterParam, readMultipartFormData } from 'h3'
import { access, mkdir, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const intervenorId = getRouterParam(event, 'id')

  if (!intervenorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Intervenor ID manquant.',
    })
  }

  const intervenor = await prisma.intervenor.findFirst({
    where: {
      id: intervenorId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  })

  if (!intervenor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Intervenant introuvable.',
    })
  }

  const files = await readMultipartFormData(event)
  const filePart = files?.find((item) => item.name === 'file')

  if (!filePart || !filePart.data || !filePart.filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Le fichier PDF est obligatoire.',
    })
  }

  if (filePart.type !== 'application/pdf') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Seuls les fichiers PDF sont autorisés.',
    })
  }

  const uploadsDir = join(process.cwd(), 'uploads', 'intervenors', intervenorId, 'contracts')
  await mkdir(uploadsDir, { recursive: true })

  const existingContracts = await prisma.intervenorDocument.findMany({
    where: {
      intervenorId,
      type: 'CONTRACT',
    },
    select: {
      id: true,
      filePath: true,
    },
  })

  for (const contract of existingContracts) {
    const absolutePath = join(process.cwd(), contract.filePath)

    try {
      await access(absolutePath, constants.R_OK)
      await unlink(absolutePath)
    }
    catch {
      // ignore file deletion errors
    }
  }

  if (existingContracts.length) {
    await prisma.intervenorDocument.deleteMany({
      where: {
        intervenorId,
        type: 'CONTRACT',
      },
    })
  }

  const extension = extname(filePart.filename) || '.pdf'
  const storedName = `${randomUUID()}${extension}`
  const relativeFilePath = join(
    'uploads',
    'intervenors',
    intervenorId,
    'contracts',
    storedName,
  )
  const absoluteFilePath = join(process.cwd(), relativeFilePath)

  await writeFile(absoluteFilePath, filePart.data)

  const created = await prisma.intervenorDocument.create({
    data: {
      intervenorId,
      type: 'CONTRACT',
      status: 'PENDING',
      title: 'Contrat intervenant',
      originalName: filePart.filename,
      storedName,
      filePath: relativeFilePath,
      mimeType: filePart.type || 'application/pdf',
      fileSize: BigInt(filePart.data.length),
    },
    select: {
      id: true,
      title: true,
      originalName: true,
      createdAt: true,
    },
  })

  return {
    ok: true,
    data: created,
  }
})