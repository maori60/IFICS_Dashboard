import {
  createHash,
  randomUUID,
} from 'node:crypto'

import {
  mkdtemp,
  readdir,
  rm,
} from 'node:fs/promises'

import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  defineEventHandler,
  type H3Event,
} from 'h3'

import { PDFDocument } from 'pdf-lib'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const request = vi.hoisted(() => ({
  associationId: '',
  userId: '',
  intervenorId: null as string | null,
  roleCode: 'CLIENT',
  permissions: [] as string[],
  body: {} as Record<string, unknown>,
  expenseId: '',
  attachmentId: '',

  query: {} as Record<
    string,
    string
  >,

  parts: [] as Array<{
    name: string
    filename?: string
    type?: string
    data: Buffer
  }>,
}))

const writeAuditLog = vi.hoisted(
  () => vi.fn(),
)

const responseHeaders = vi.hoisted(
  () => (
    {} as Record<
      string,
      string
    >
  ),
)

const readMultipartFormData = vi.hoisted(
  () => vi.fn(),
)

const scanBufferWithClamAv = vi.hoisted(
  () => vi.fn(),
)

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,
    readBody: async () => request.body,

    readMultipartFormData: async () => {
      readMultipartFormData()
      return request.parts
    },

    getRouterParam: (
      _event: unknown,
      name: string,
    ) =>
      name === 'attachmentId'
        ? request.attachmentId
        : request.expenseId,

    getQuery: () =>
      request.query,

    setResponseHeader: (
      _event: unknown,
      name: string,
      value: string | number,
    ) => {
      responseHeaders[
        name.toLowerCase()
      ] = String(value)
    },
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    sessionId: 'expense-test-session',
    userId: request.userId,
    associationId: request.associationId,
    clientId: null,
    intervenorId: request.intervenorId,
    email: 'expense-test@example.invalid',
    firstName: 'Test',
    lastName: 'Expense',
    roleCode: request.roleCode,
    roleName: request.roleCode,
    permissions: request.permissions,
    mfaEnabled: true,
    mfaVerified: true,
    mfaSetupRequired: false,
  }),

  hasPermission: (
    context: { permissions: string[] },
    permission: string,
  ) =>
    context.permissions.includes('*')
    || context.permissions.includes(permission),
}))

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog,
}))

vi.mock(
  '../../server/utils/antivirus',
  async (importOriginal) => {
    const actual
      = await importOriginal<
        typeof import(
          '../../server/utils/antivirus'
        )
      >()

    return {
      ...actual,
      scanBufferWithClamAv,
    }
  },
)

describe.skipIf(
  process.env.EXPENSE_INTEGRATION_TESTS !== '1',
)(
  'Gestion sécurisée des dépenses avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let listHandler:
      typeof import(
        '../../server/api/expenses/index.get'
      )['default']

    let createHandler:
      typeof import(
        '../../server/api/expenses/create.post'
      )['default']

    let detailHandler:
      typeof import(
        '../../server/api/expenses/[id].get'
      )['default']

    let updateHandler:
      typeof import(
        '../../server/api/expenses/[id].put'
      )['default']

    let submitHandler:
      typeof import(
        '../../server/api/expenses/[id]/submit.post'
      )['default']

    let reviewHandler:
      typeof import(
        '../../server/api/expenses/[id]/review.post'
      )['default']

    let markPaidHandler:
      typeof import(
        '../../server/api/expenses/[id]/mark-paid.post'
      )['default']

    let cancelHandler:
      typeof import(
        '../../server/api/expenses/[id]/cancel.post'
      )['default']

    let attachmentUploadHandler:
      typeof import(
        '../../server/api/expenses/[id]/attachments.post'
      )['default']

    let attachmentReadHandler:
      typeof import(
        '../../server/api/expenses/[id]/attachments/[attachmentId].get'
      )['default']

    let attachmentDeleteHandler:
      typeof import(
        '../../server/api/expenses/[id]/attachments/[attachmentId].delete'
      )['default']

    let readStoredFile:
      typeof import(
        '../../server/utils/files'
      )['readStoredFile']

    let roleId: string

    let managerUserId: string
    let intervenorUserId: string
    let otherIntervenorUserId: string
    let clientUserId: string

    let intervenorId: string
    let otherIntervenorId: string

    let assignedProjectId: string
    let unassignedProjectId: string

    let ownExpenseId: string
    let otherExpenseId: string

    const event = {} as H3Event

    const token = randomUUID()

    let uploadDir = ''

    const previousUploadDir
      = process.env.UPLOAD_DIR

    const previousMaxUploadMb
      = process.env.MAX_UPLOAD_MB

    const associationId
      = `expense-test-${token}`

    const foreignAssociationId
      = `expense-foreign-${token}`

    function setActor(options: {
      userId: string
      intervenorId?: string | null
      roleCode: string
      permissions: string[]
    }) {
      request.associationId = associationId
      request.userId = options.userId
      request.intervenorId = options.intervenorId ?? null
      request.roleCode = options.roleCode
      request.permissions = options.permissions
    }

    async function validExpensePdf():
      Promise<Buffer> {
      const pdf
        = await PDFDocument.create()

      pdf.addPage([
        300,
        200,
      ])

      return Buffer.from(
        await pdf.save(),
      )
    }

    async function listStoredFiles(
      directory: string,
    ): Promise<string[]> {
      try {
        const entries
          = await readdir(
            directory,
            {
              withFileTypes: true,
            },
          )

        const files: string[] = []

        for (const entry of entries) {
          const path = join(
            directory,
            entry.name,
          )

          if (entry.isDirectory()) {
            files.push(
              ...await listStoredFiles(
                path,
              ),
            )
          }
          else {
            files.push(path)
          }
        }

        return files.sort()
      }
      catch (error) {
        if (
          error
          && typeof error === 'object'
          && 'code' in error
          && error.code === 'ENOENT'
        ) {
          return []
        }

        throw error
      }
    }

    async function createUser(
      suffix: string,
    ): Promise<string> {
      const user = await prisma.user.create({
        data: {
          associationId,
          roleId,
          firstName: 'Test',
          lastName: suffix,
          email: `${suffix}.${token}@example.invalid`,
          passwordHash: 'integration-test-only',
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      })

      return user.id
    }

    async function cleanup() {
      if (!prisma) return

      await prisma.expenseAttachment.deleteMany({
        where: {
          expense: {
            associationId: {
              in: [
                associationId,
                foreignAssociationId,
              ],
            },
          },
        },
      })

      await prisma.expense.deleteMany({
        where: {
          associationId: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })

      await prisma.projectIntervenor.deleteMany({
        where: {
          project: {
            associationId,
          },
        },
      })

      await prisma.project.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.intervenor.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.user.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.role.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.association.deleteMany({
        where: {
          id: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })
    }

    afterAll(async () => {
      await rm(
        uploadDir,
        {
          recursive: true,
          force: true,
        },
      )

      if (
        previousUploadDir
        === undefined
      ) {
        delete process.env.UPLOAD_DIR
      }
      else {
        process.env.UPLOAD_DIR
          = previousUploadDir
      }

      if (
        previousMaxUploadMb
        === undefined
      ) {
        delete process.env.MAX_UPLOAD_MB
      }
      else {
        process.env.MAX_UPLOAD_MB
          = previousMaxUploadMb
      }
    })

    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        defineEventHandler,
      )

      uploadDir = await mkdtemp(
        join(
          tmpdir(),
          'ifics-expense-api-',
        ),
      )

      process.env.UPLOAD_DIR
        = uploadDir

      process.env.MAX_UPLOAD_MB
        = '10'

      prisma = (
        await import(
          '../../server/utils/prisma'
        )
      ).prisma

      listHandler = (
        await import(
          '../../server/api/expenses/index.get'
        )
      ).default

      createHandler = (
        await import(
          '../../server/api/expenses/create.post'
        )
      ).default

      detailHandler = (
        await import(
          '../../server/api/expenses/[id].get'
        )
      ).default

      updateHandler = (
        await import(
          '../../server/api/expenses/[id].put'
        )
      ).default

      submitHandler = (
        await import(
          '../../server/api/expenses/[id]/submit.post'
        )
      ).default

      reviewHandler = (
        await import(
          '../../server/api/expenses/[id]/review.post'
        )
      ).default

      markPaidHandler = (
        await import(
          '../../server/api/expenses/[id]/mark-paid.post'
        )
      ).default

      cancelHandler = (
        await import(
          '../../server/api/expenses/[id]/cancel.post'
        )
      ).default

      attachmentUploadHandler = (
        await import(
          '../../server/api/expenses/[id]/attachments.post'
        )
      ).default

      attachmentReadHandler = (
        await import(
          '../../server/api/expenses/[id]/attachments/[attachmentId].get'
        )
      ).default

      attachmentDeleteHandler = (
        await import(
          '../../server/api/expenses/[id]/attachments/[attachmentId].delete'
        )
      ).default

      readStoredFile = (
        await import(
          '../../server/utils/files'
        )
      ).readStoredFile

      await prisma.association.create({
        data: {
          id: associationId,
          name: 'Association test Expense',
        },
      })

      await prisma.association.create({
        data: {
          id: foreignAssociationId,
          name: 'Association étrangère Expense',
        },
      })

      const role = await prisma.role.create({
        data: {
          associationId,
          name: 'Rôle test Expense',
          code: 'EXPENSE_TEST',
          permissions: [],
          isSystemRole: false,
        },
        select: {
          id: true,
        },
      })

      roleId = role.id

      managerUserId = await createUser('manager')
      intervenorUserId = await createUser('intervenor')
      otherIntervenorUserId = await createUser(
        'other-intervenor',
      )
      clientUserId = await createUser('client')

      const ownIntervenor
        = await prisma.intervenor.create({
          data: {
            associationId,
            userId: intervenorUserId,
            firstName: 'Alice',
            lastName: 'Intervenante',
            email: `alice.${token}@example.invalid`,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        })

      intervenorId = ownIntervenor.id

      const otherIntervenor
        = await prisma.intervenor.create({
          data: {
            associationId,
            userId: otherIntervenorUserId,
            firstName: 'Bob',
            lastName: 'Intervenant',
            email: `bob.${token}@example.invalid`,
            status: 'ACTIVE',
          },
          select: {
            id: true,
          },
        })

      otherIntervenorId = otherIntervenor.id

      const assignedProject
        = await prisma.project.create({
          data: {
            associationId,
            reference: `EXP-A-${token.slice(0, 8)}`,
            title: 'Projet affecté',
            status: 'IN_PROGRESS',
            classification: 'INTERNAL',

            projectIntervenors: {
              create: {
                intervenorId,
                assignmentStatus: 'ACCEPTED',
              },
            },
          },
          select: {
            id: true,
          },
        })

      assignedProjectId = assignedProject.id

      const unassignedProject
        = await prisma.project.create({
          data: {
            associationId,
            reference: `EXP-U-${token.slice(0, 8)}`,
            title: 'Projet non affecté',
            status: 'IN_PROGRESS',
            classification: 'INTERNAL',
          },
          select: {
            id: true,
          },
        })

      unassignedProjectId = unassignedProject.id
    })

    async function createClassifiedExpense(
      classification:
        | 'CONFIDENTIAL'
        | 'RESTRICTED'
        = 'CONFIDENTIAL',
      status:
        | 'DRAFT'
        | 'SUBMITTED'
        = 'SUBMITTED',
    ) {
      const project
        = await prisma.project.create({
          data: {
            associationId,

            reference:
              `EXP-C-${randomUUID().slice(0, 8)}`,

            title:
              'Projet classifié Expense',

            status:
              'IN_PROGRESS',

            classification,
          },

          select: {
            id: true,
          },
        })

      const expense
        = await prisma.expense.create({
          data: {
            associationId,

            projectId:
              project.id,

            intervenorId,

            createdByUserId:
              managerUserId,

            category:
              'SOFTWARE',

            status,

            submittedAt:
              status === 'SUBMITTED'
                ? new Date(
                    '2026-09-24T08:00:00.000Z',
                  )
                : null,

            expenseDate:
              new Date(
                '2026-09-24T00:00:00.000Z',
              ),

            supplierName:
              'Éditeur confidentiel',

            description:
              'Dépense projet classifié',

            currency:
              'EUR',

            amountExclTax:
              '100.00',

            taxRate:
              '20.00',

            taxAmount:
              '20.00',

            amountInclTax:
              '120.00',

            paymentMethod:
              'BANK_TRANSFER',

            reimbursable:
              true,
          },

          select: {
            id: true,
          },
        })

      return {
        projectId:
          project.id,

        expenseId:
          expense.id,
      }
    }

    beforeEach(async () => {
      await rm(
        uploadDir,
        {
          recursive: true,
          force: true,
        },
      )

      readMultipartFormData.mockReset()

      scanBufferWithClamAv.mockReset()

      scanBufferWithClamAv.mockResolvedValue({
        status: 'CLEAN',
        rawResult: 'stream: OK',
      })

      await prisma.expense.deleteMany({
        where: {
          associationId: {
            in: [
              associationId,
              foreignAssociationId,
            ],
          },
        },
      })

      writeAuditLog.mockReset()

      request.body = {}
      request.expenseId = ''
      request.attachmentId = ''
      request.query = {}
      request.parts = []

      for (
        const key
        of Object.keys(
          responseHeaders,
        )
      ) {
        Reflect.deleteProperty(
          responseHeaders,
          key,
        )
      }

      setActor({
        userId: managerUserId,
        roleCode: 'MANAGER',
        permissions: [
          'expense:read:all',
          'expense:review',
          'expense:manage',
          'expense:export',
        ],
      })

      const ownExpense
        = await prisma.expense.create({
          data: {
            associationId,
            projectId: assignedProjectId,
            intervenorId,
            createdByUserId: managerUserId,
            category: 'FUEL',
            status: 'DRAFT',
            expenseDate:
              new Date('2026-09-20T00:00:00.000Z'),
            supplierName: 'Station Test',
            description: 'Carburant intervenant A',
            currency: 'EUR',
            amountExclTax: '50.00',
            taxRate: '20.00',
            taxAmount: '10.00',
            amountInclTax: '60.00',
            paymentMethod: 'CARD',
            reimbursable: true,
          },
          select: {
            id: true,
          },
        })

      ownExpenseId = ownExpense.id

      const otherExpense
        = await prisma.expense.create({
          data: {
            associationId,
            intervenorId: otherIntervenorId,
            createdByUserId: managerUserId,
            category: 'MEAL',
            status: 'DRAFT',
            expenseDate:
              new Date('2026-09-21T00:00:00.000Z'),
            supplierName: 'Restaurant Test',
            description: 'Repas intervenant B',
            currency: 'EUR',
            amountExclTax: '20.00',
            taxRate: '10.00',
            taxAmount: '2.00',
            amountInclTax: '22.00',
            paymentMethod: 'CARD',
            reimbursable: true,
          },
          select: {
            id: true,
          },
        })

      otherExpenseId = otherExpense.id

      await prisma.expense.create({
        data: {
          associationId: foreignAssociationId,
          category: 'SOFTWARE',
          status: 'DRAFT',
          expenseDate:
            new Date('2026-09-22T00:00:00.000Z'),
          description: 'Dépense étrangère',
          currency: 'EUR',
          amountExclTax: '100.00',
          taxRate: '20.00',
          taxAmount: '20.00',
          amountInclTax: '120.00',
        },
      })
    })

    afterAll(async () => {
      try {
        await cleanup()
      }
      finally {
        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })

    it(
      'limite la liste aux dépenses de l’intervenant connecté',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        const result = await listHandler(event)

        expect(result.data).toHaveLength(1)

        expect(result.data[0]).toMatchObject({
          id: ownExpenseId,
          category: 'FUEL',
        })
      },
    )

    it(
      'masque la dépense d’un autre intervenant avec un 404',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = otherExpenseId

        await expect(
          detailHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'permet à un intervenant de créer sa propre dépense et recalcule la TVA',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.body = {
          category: 'FUEL',
          expenseDate: '2026-09-23',
          supplierName: 'Station API',
          description: 'Plein carburant',
          amountExclTax: 100,
          taxRate: 20,
          paymentMethod: 'CARD',
          reimbursable: true,
          projectId: assignedProjectId,
        }

        const result = await createHandler(event)

        expect(result.data).toMatchObject({
          category: 'FUEL',
          status: 'DRAFT',
          intervenorId,
          projectId: assignedProjectId,
          reimbursable: true,
        })

        expect(
          Number(result.data.amountExclTax),
        ).toBe(100)

        expect(
          Number(result.data.taxAmount),
        ).toBe(20)

        expect(
          Number(result.data.amountInclTax),
        ).toBe(120)

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: result.data.id,
            },
          })

        expect(stored.associationId)
          .toBe(associationId)

        expect(stored.intervenorId)
          .toBe(intervenorId)

        expect(stored.projectId)
          .toBe(assignedProjectId)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_CREATED',
              entityType: 'Expense',
              entityId: result.data.id,
            }),
          )
      },
    )

    it(
      'interdit à un intervenant de créer une dépense pour un autre',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.body = {
          category: 'MEAL',
          expenseDate: '2026-09-23',
          description: 'Tentative autre intervenant',
          amountExclTax: 30,
          taxRate: 10,
          intervenorId: otherIntervenorId,
        }

        await expect(
          createHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'refuse un projet auquel l’intervenant n’est pas affecté',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.body = {
          category: 'TRANSPORT',
          expenseDate: '2026-09-23',
          description: 'Projet non affecté',
          amountExclTax: 15,
          taxRate: 20,
          projectId: unassignedProjectId,
        }

        await expect(
          createHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'permet au manager de lire toutes les dépenses de son association uniquement',
      async () => {
        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:read:all',
            'expense:manage',
          ],
        })

        const result = await listHandler(event)

        expect(result.data).toHaveLength(2)

        const ids = result.data.map(
          item => item.id,
        )

        expect(ids).toContain(ownExpenseId)
        expect(ids).toContain(otherExpenseId)
      },
    )

    it(
      'masque les dépenses de projets classifiés au manager sans project:confidential:read',
      async () => {
        const classified
          = await createClassifiedExpense(
            'CONFIDENTIAL',
            'DRAFT',
          )

        setActor({
          userId:
            managerUserId,

          roleCode:
            'MANAGER',

          permissions: [
            'expense:read:all',
            'expense:manage',
          ],
        })

        const result
          = await listHandler(event)

        const ids
          = result.data.map(
            item => item.id,
          )

        expect(ids)
          .not.toContain(
            classified.expenseId,
          )

        expect(ids)
          .toContain(
            ownExpenseId,
          )
      },
    )

    it(
      'affiche les dépenses de projets classifiés avec project:confidential:read',
      async () => {
        const confidential
          = await createClassifiedExpense(
            'CONFIDENTIAL',
            'DRAFT',
          )

        const restricted
          = await createClassifiedExpense(
            'RESTRICTED',
            'DRAFT',
          )

        setActor({
          userId:
            managerUserId,

          roleCode:
            'MANAGER',

          permissions: [
            'expense:read:all',
            'project:confidential:read',
          ],
        })

        const result
          = await listHandler(event)

        const ids
          = result.data.map(
            item => item.id,
          )

        expect(ids)
          .toContain(
            confidential.expenseId,
          )

        expect(ids)
          .toContain(
            restricted.expenseId,
          )
      },
    )

    it(
      'permet au manager de créer une dépense générale',
      async () => {
        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:read:all',
            'expense:manage',
          ],
        })

        request.body = {
          category: 'SOFTWARE',
          expenseDate: '2026-09-23',
          supplierName: 'Éditeur logiciel',
          description: 'Licence annuelle',
          amountExclTax: 200,
          taxRate: 20,
          paymentMethod: 'BANK_TRANSFER',
        }

        const result = await createHandler(event)

        expect(result.data.intervenorId)
          .toBeNull()

        expect(result.data.projectId)
          .toBeNull()

        expect(
          Number(result.data.amountInclTax),
        ).toBe(240)
      },
    )

    it(
      'ignore un associationId injecté dans le body',
      async () => {
        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.body = {
          associationId: foreignAssociationId,
          category: 'SUPPLIES',
          expenseDate: '2026-09-23',
          description: 'Fournitures test',
          amountExclTax: 10,
          taxRate: 20,
        }

        const result = await createHandler(event)

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: result.data.id,
            },
          })

        expect(stored.associationId)
          .toBe(associationId)

        expect(stored.associationId)
          .not.toBe(foreignAssociationId)
      },
    )

    it(
      'refuse au client la liste des dépenses',
      async () => {
        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        await expect(
          listHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'permet à un intervenant de modifier sa propre dépense brouillon',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          category: 'TOLL',
          expenseDate: '2026-09-24',
          supplierName: 'Autoroute Test',
          description: 'Péage corrigé',
          amountExclTax: 25,
          taxRate: 20,
          paymentMethod: 'CARD',
          reimbursable: true,
          projectId: assignedProjectId,
        }

        const result = await updateHandler(event)

        expect(result.data).toMatchObject({
          id: ownExpenseId,
          category: 'TOLL',
          status: 'DRAFT',
          intervenorId,
          projectId: assignedProjectId,
        })

        expect(
          Number(result.data.amountExclTax),
        ).toBe(25)

        expect(
          Number(result.data.taxAmount),
        ).toBe(5)

        expect(
          Number(result.data.amountInclTax),
        ).toBe(30)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_UPDATED',
              entityType: 'Expense',
              entityId: ownExpenseId,
            }),
          )
      },
    )

    it(
      'refuse la modification sans expense:write:own',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          category: 'FUEL',
          expenseDate: '2026-09-24',
          description: 'Modification interdite',
          amountExclTax: 100,
          taxRate: 20,
        }

        await expect(
          updateHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'refuse de modifier la dépense d’un autre intervenant',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = otherExpenseId

        request.body = {
          category: 'MEAL',
          expenseDate: '2026-09-24',
          description: 'Tentative modification étrangère',
          amountExclTax: 25,
          taxRate: 10,
        }

        await expect(
          updateHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'refuse à un intervenant de changer l’intervenant associé',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          category: 'FUEL',
          expenseDate: '2026-09-24',
          description: 'Tentative changement intervenant',
          amountExclTax: 50,
          taxRate: 20,
          intervenorId: otherIntervenorId,
        }

        await expect(
          updateHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'remet une dépense rejetée en brouillon lorsqu’elle est corrigée',
      async () => {
        const rejectedAt
          = new Date('2026-09-23T10:00:00.000Z')

        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'REJECTED',
            submittedAt:
              new Date('2026-09-22T09:00:00.000Z'),
            reviewedAt: rejectedAt,
            reviewedByUserId: managerUserId,
            rejectionReason: 'Justificatif à corriger',
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          category: 'FUEL',
          expenseDate: '2026-09-24',
          description: 'Dépense corrigée',
          amountExclTax: 60,
          taxRate: 20,
          projectId: assignedProjectId,
          reimbursable: true,
        }

        const result = await updateHandler(event)

        expect(result.data.status)
          .toBe('DRAFT')

        expect(result.data.submittedAt)
          .toBeNull()

        expect(result.data.reviewedAt)
          .toBeNull()

        expect(result.data.rejectionReason)
          .toBeNull()

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.reviewedByUserId)
          .toBeNull()
      },
    )

    it.each([
      'SUBMITTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'verrouille la modification lorsque le statut est %s',
      async (status) => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },
          data: {
            status,
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          category: 'FUEL',
          expenseDate: '2026-09-24',
          description: 'Modification interdite',
          amountExclTax: 100,
          taxRate: 20,
        }

        await expect(
          updateHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'permet au manager de modifier une dépense générale',
      async () => {
        const generalExpense
          = await prisma.expense.create({
            data: {
              associationId,
              createdByUserId: managerUserId,
              category: 'SOFTWARE',
              status: 'DRAFT',
              expenseDate:
                new Date('2026-09-20T00:00:00.000Z'),
              description: 'Licence initiale',
              currency: 'EUR',
              amountExclTax: '100.00',
              taxRate: '20.00',
              taxAmount: '20.00',
              amountInclTax: '120.00',
            },
          })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:read:all',
            'expense:manage',
          ],
        })

        request.expenseId = generalExpense.id

        request.body = {
          category: 'SOFTWARE',
          expenseDate: '2026-09-24',
          supplierName: 'Éditeur corrigé',
          description: 'Licence mise à jour',
          amountExclTax: 150,
          taxRate: 20,
          paymentMethod: 'BANK_TRANSFER',
        }

        const result = await updateHandler(event)

        expect(result.data.intervenorId)
          .toBeNull()

        expect(result.data.projectId)
          .toBeNull()

        expect(
          Number(result.data.amountInclTax),
        ).toBe(180)
      },
    )

    it(
      'permet à un intervenant de soumettre sa propre dépense brouillon',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        const result = await submitHandler(event)

        expect(result.data.status)
          .toBe('SUBMITTED')

        expect(result.data.submittedAt)
          .not.toBeNull()

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('SUBMITTED')

        expect(stored.submittedAt)
          .not.toBeNull()

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_SUBMITTED',
              entityType: 'Expense',
              entityId: ownExpenseId,
            }),
          )
      },
    )

    it(
      'refuse la soumission sans expense:write:own',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
          ],
        })

        request.expenseId = ownExpenseId

        await expect(
          submitHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'masque la dépense d’un autre intervenant lors de la soumission',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = otherExpenseId

        await expect(
          submitHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it.each([
      'SUBMITTED',
      'REJECTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'refuse la soumission lorsque le statut est %s',
      async (status) => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status,
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        await expect(
          submitHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'permet au manager de soumettre une dépense générale',
      async () => {
        const generalExpense
          = await prisma.expense.create({
            data: {
              associationId,
              createdByUserId: managerUserId,

              category: 'SOFTWARE',
              status: 'DRAFT',

              expenseDate:
                new Date('2026-09-24T00:00:00.000Z'),

              description:
                'Licence à soumettre',

              currency: 'EUR',

              amountExclTax:
                '100.00',

              taxRate:
                '20.00',

              taxAmount:
                '20.00',

              amountInclTax:
                '120.00',
            },
          })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:read:all',
            'expense:manage',
          ],
        })

        request.expenseId
          = generalExpense.id

        const result
          = await submitHandler(event)

        expect(result.data.status)
          .toBe('SUBMITTED')

        expect(result.data.intervenorId)
          .toBeNull()
      },
    )

    it(
      'refuse au client la soumission d’une dépense',
      async () => {
        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.expenseId = ownExpenseId

        await expect(
          submitHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'permet à un reviewer seul de consulter une dépense SUBMITTED',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date(
                '2026-09-24T08:00:00.000Z',
              ),
          },
        })

        setActor({
          userId:
            managerUserId,
          roleCode:
            'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId
          = ownExpenseId

        const result
          = await detailHandler(
            event,
          )

        expect(result.data.id)
          .toBe(ownExpenseId)

        expect(result.data.status)
          .toBe('SUBMITTED')
      },
    )

    it(
      'masque un brouillon à un reviewer disposant uniquement de expense:review',
      async () => {
        setActor({
          userId:
            managerUserId,
          roleCode:
            'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId
          = ownExpenseId

        await expect(
          detailHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            404,

          data: {
            code:
              'EXPENSE_NOT_FOUND',
          },
        })
      },
    )

    it(
      'permet à un reviewer seul de consulter le justificatif d’une dépense SUBMITTED',
      async () => {
        const pdf
          = await validExpensePdf()

        /*
         * La pièce est déposée avant la soumission,
         * puisque les justificatifs deviennent ensuite
         * immuables.
         */
        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'piece-review.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status:
              'SUBMITTED',

            submittedAt:
              new Date(
                '2026-09-24T08:00:00.000Z',
              ),
          },
        })

        setActor({
          userId:
            managerUserId,
          roleCode:
            'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.attachmentId
          = uploaded.data.id

        const buffer
          = await attachmentReadHandler(
            event,
          )

        expect(
          Buffer.compare(
            buffer,
            pdf,
          ),
        ).toBe(0)
      },
    )

    it(
      'masque une dépense SUBMITTED confidentielle au reviewer sans project:confidential:read',
      async () => {
        const classified
          = await createClassifiedExpense(
            'CONFIDENTIAL',
            'SUBMITTED',
          )

        setActor({
          userId:
            managerUserId,

          roleCode:
            'REVIEWER',

          permissions: [
            'expense:review',
          ],
        })

        request.expenseId
          = classified.expenseId

        await expect(
          detailHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            404,

          data: {
            code:
              'EXPENSE_NOT_FOUND',
          },
        })
      },
    )

    it(
      'autorise le reviewer à consulter une dépense confidentielle avec project:confidential:read',
      async () => {
        const classified
          = await createClassifiedExpense(
            'CONFIDENTIAL',
            'SUBMITTED',
          )

        setActor({
          userId:
            managerUserId,

          roleCode:
            'REVIEWER',

          permissions: [
            'expense:review',
            'project:confidential:read',
          ],
        })

        request.expenseId
          = classified.expenseId

        const result
          = await detailHandler(event)

        expect(result.data.id)
          .toBe(
            classified.expenseId,
          )

        expect(result.data.status)
          .toBe('SUBMITTED')
      },
    )

    it(
      'masque la revue d’une dépense confidentielle sans project:confidential:read',
      async () => {
        const classified
          = await createClassifiedExpense(
            'CONFIDENTIAL',
            'SUBMITTED',
          )

        setActor({
          userId:
            managerUserId,

          roleCode:
            'REVIEWER',

          permissions: [
            'expense:review',
          ],
        })

        request.expenseId
          = classified.expenseId

        request.body = {
          decision:
            'APPROVED',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            404,

          data: {
            code:
              'EXPENSE_NOT_FOUND',
          },
        })

        const stored
          = await prisma.expense
            .findUniqueOrThrow({
              where: {
                id:
                  classified.expenseId,
              },
            })

        expect(stored.status)
          .toBe('SUBMITTED')
      },
    )

    it(
      'autorise la revue d’une dépense RESTRICTED avec project:confidential:read',
      async () => {
        const classified
          = await createClassifiedExpense(
            'RESTRICTED',
            'SUBMITTED',
          )

        setActor({
          userId:
            managerUserId,

          roleCode:
            'REVIEWER',

          permissions: [
            'expense:review',
            'project:confidential:read',
          ],
        })

        request.expenseId
          = classified.expenseId

        request.body = {
          decision:
            'APPROVED',
        }

        const result
          = await reviewHandler(event)

        expect(result.data.status)
          .toBe('APPROVED')

        const stored
          = await prisma.expense
            .findUniqueOrThrow({
              where: {
                id:
                  classified.expenseId,
              },
            })

        expect(stored.status)
          .toBe('APPROVED')
      },
    )

    it(
      'permet à un rôle disposant uniquement de expense:review d’approuver une dépense',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date('2026-09-24T08:00:00.000Z'),
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'APPROVED',
        }

        const result = await reviewHandler(event)

        expect(result.data.status)
          .toBe('APPROVED')

        expect(result.data.reviewedAt)
          .not.toBeNull()

        expect(result.data.reviewedByUserId)
          .toBe(managerUserId)

        expect(result.data.rejectionReason)
          .toBeNull()

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('APPROVED')

        expect(stored.reviewedByUserId)
          .toBe(managerUserId)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_APPROVED',
              entityType: 'Expense',
              entityId: ownExpenseId,
            }),
          )
      },
    )

    it(
      'permet de rejeter une dépense soumise avec un motif',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date('2026-09-24T08:00:00.000Z'),
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'REJECTED',
          rejectionReason:
            'Le justificatif fourni est illisible.',
        }

        const result = await reviewHandler(event)

        expect(result.data.status)
          .toBe('REJECTED')

        expect(result.data.reviewedAt)
          .not.toBeNull()

        expect(result.data.reviewedByUserId)
          .toBe(managerUserId)

        expect(result.data.rejectionReason)
          .toBe(
            'Le justificatif fourni est illisible.',
          )

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_REJECTED',
              entityType: 'Expense',
              entityId: ownExpenseId,
            }),
          )
      },
    )

    it(
      'refuse un rejet sans motif',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date('2026-09-24T08:00:00.000Z'),
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'REJECTED',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
        })

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('SUBMITTED')

        expect(stored.reviewedAt)
          .toBeNull()
      },
    )

    it(
      'refuse une décision de revue invalide',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date('2026-09-24T08:00:00.000Z'),
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'INVALID_DECISION',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
        })
      },
    )

    it.each([
      'DRAFT',
      'REJECTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'refuse la revue lorsque le statut est %s',
      async (status) => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'APPROVED',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'masque une dépense appartenant à une autre association',
      async () => {
        const foreignExpense
          = await prisma.expense.create({
            data: {
              associationId:
                foreignAssociationId,

              category: 'SOFTWARE',
              status: 'SUBMITTED',

              expenseDate:
                new Date('2026-09-24T00:00:00.000Z'),

              description:
                'Dépense étrangère à valider',

              currency: 'EUR',

              amountExclTax:
                '100.00',

              taxRate:
                '20.00',

              taxAmount:
                '20.00',

              amountInclTax:
                '120.00',

              submittedAt:
                new Date('2026-09-24T08:00:00.000Z'),
            },
          })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId
          = foreignExpense.id

        request.body = {
          decision: 'APPROVED',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'refuse au client la revue avant même la validation du body',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
          },
        })

        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'NIMPORTE_QUOI',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'empêche de traiter deux fois la même dépense',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date('2026-09-24T08:00:00.000Z'),
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'APPROVED',
        }

        await reviewHandler(event)

        request.body = {
          decision: 'REJECTED',
          rejectionReason:
            'Deuxième décision impossible',
        }

        await expect(
          reviewHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('APPROVED')
      },
    )

    it(
      'autorise expense:manage à effectuer une revue',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'SUBMITTED',
            submittedAt:
              new Date('2026-09-24T08:00:00.000Z'),
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          decision: 'APPROVED',
        }

        const result = await reviewHandler(event)

        expect(result.data.status)
          .toBe('APPROVED')

        expect(result.data.reviewedByUserId)
          .toBe(managerUserId)
      },
    )

    it(
      'permet au manager de solder un remboursement intervenant approuvé',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',

            reviewedAt:
              new Date('2026-09-24T09:00:00.000Z'),

            reviewedByUserId:
              managerUserId,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId = ownExpenseId

        const result
          = await markPaidHandler(event)

        expect(result.data.status)
          .toBe('PAID')

        expect(result.data.paidAt)
          .not.toBeNull()

        expect(result.data.paidByUserId)
          .toBe(managerUserId)

        expect(result.data.reimbursable)
          .toBe(true)

        expect(result.data.intervenorId)
          .toBe(intervenorId)

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('PAID')

        expect(stored.paidAt)
          .not.toBeNull()

        expect(stored.paidByUserId)
          .toBe(managerUserId)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_PAID',
              entityType: 'Expense',
              entityId: ownExpenseId,

              metadata:
                expect.objectContaining({
                  settlementKind:
                    'INTERVENOR_REIMBURSEMENT',

                  reimbursable:
                    true,

                  intervenorId,

                  paidByUserId:
                    managerUserId,
                }),
            }),
          )
      },
    )

    it(
      'permet au manager de solder une dépense générale approuvée',
      async () => {
        const generalExpense
          = await prisma.expense.create({
            data: {
              associationId,

              createdByUserId:
                managerUserId,

              category:
                'SOFTWARE',

              status:
                'APPROVED',

              expenseDate:
                new Date('2026-09-24T00:00:00.000Z'),

              description:
                'Licence déjà approuvée',

              currency:
                'EUR',

              amountExclTax:
                '100.00',

              taxRate:
                '20.00',

              taxAmount:
                '20.00',

              amountInclTax:
                '120.00',

              reimbursable:
                false,

              reviewedAt:
                new Date('2026-09-24T09:00:00.000Z'),

              reviewedByUserId:
                managerUserId,
            },
          })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = generalExpense.id

        const result
          = await markPaidHandler(event)

        expect(result.data.status)
          .toBe('PAID')

        expect(result.data.paidAt)
          .not.toBeNull()

        expect(result.data.intervenorId)
          .toBeNull()

        expect(result.data.reimbursable)
          .toBe(false)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action:
                'EXPENSE_PAID',

              entityId:
                generalExpense.id,

              metadata:
                expect.objectContaining({
                  settlementKind:
                    'ASSOCIATION_EXPENSE',
                }),
            }),
          )
      },
    )

    it(
      'refuse le règlement avec seulement expense:review',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        await expect(
          markPaidHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'refuse à un intervenant de marquer sa dépense comme payée',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        await expect(
          markPaidHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'refuse au client de marquer une dépense comme payée',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',
          },
        })

        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.expenseId = ownExpenseId

        await expect(
          markPaidHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'masque une dépense approuvée appartenant à une autre association lors du règlement',
      async () => {
        const foreignExpense
          = await prisma.expense.create({
            data: {
              associationId:
                foreignAssociationId,

              category:
                'SOFTWARE',

              status:
                'APPROVED',

              expenseDate:
                new Date('2026-09-24T00:00:00.000Z'),

              description:
                'Dépense étrangère approuvée',

              currency:
                'EUR',

              amountExclTax:
                '100.00',

              taxRate:
                '20.00',

              taxAmount:
                '20.00',

              amountInclTax:
                '120.00',

              reviewedAt:
                new Date('2026-09-24T09:00:00.000Z'),
            },
          })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = foreignExpense.id

        await expect(
          markPaidHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it.each([
      'DRAFT',
      'SUBMITTED',
      'REJECTED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'refuse le règlement lorsque le statut est %s',
      async (status) => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        await expect(
          markPaidHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'empêche de solder deux fois la même dépense',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',

            reviewedAt:
              new Date('2026-09-24T09:00:00.000Z'),

            reviewedByUserId:
              managerUserId,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        const first
          = await markPaidHandler(event)

        expect(first.data.status)
          .toBe('PAID')

        const firstPaidAt
          = first.data.paidAt

        await expect(
          markPaidHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('PAID')

        expect(
          stored.paidAt?.toISOString(),
        ).toBe(
          new Date(firstPaidAt).toISOString(),
        )
      },
    )

    it(
      'permet à un intervenant d’annuler sa propre dépense brouillon avec traçabilité',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            'Dépense créée par erreur.',
        }

        const result
          = await cancelHandler(event)

        expect(result.data.status)
          .toBe('CANCELLED')

        expect(result.data.cancelledAt)
          .not.toBeNull()

        expect(result.data.cancelledByUserId)
          .toBe(intervenorUserId)

        expect(result.data.cancellationReason)
          .toBe(
            'Dépense créée par erreur.',
          )

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('CANCELLED')

        expect(stored.cancelledAt)
          .not.toBeNull()

        expect(stored.cancelledByUserId)
          .toBe(intervenorUserId)

        expect(stored.cancellationReason)
          .toBe(
            'Dépense créée par erreur.',
          )

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action: 'EXPENSE_CANCELLED',
              entityType: 'Expense',
              entityId: ownExpenseId,

              metadata:
                expect.objectContaining({
                  previousStatus:
                    'DRAFT',

                  newStatus:
                    'CANCELLED',

                  cancelledByUserId:
                    intervenorUserId,

                  cancellationReason:
                    'Dépense créée par erreur.',
                }),
            }),
          )
      },
    )

    it.each([
      'SUBMITTED',
      'REJECTED',
    ] as const)(
      'permet à un intervenant d’annuler sa dépense au statut %s',
      async (status) => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status,

            submittedAt:
              status === 'SUBMITTED'
                ? new Date(
                    '2026-09-24T08:00:00.000Z',
                  )
                : null,

            rejectionReason:
              status === 'REJECTED'
                ? 'Ancien rejet'
                : null,
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            `Annulation depuis ${status}`,
        }

        const result
          = await cancelHandler(event)

        expect(result.data.status)
          .toBe('CANCELLED')

        expect(result.data.cancelledByUserId)
          .toBe(intervenorUserId)

        expect(result.data.cancellationReason)
          .toBe(
            `Annulation depuis ${status}`,
          )
      },
    )

    it(
      'refuse à un intervenant d’annuler une dépense déjà approuvée',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',
            reviewedAt:
              new Date('2026-09-24T09:00:00.000Z'),
            reviewedByUserId:
              managerUserId,
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            'Tentative après approbation',
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'permet au manager d’annuler une dépense approuvée non payée',
      async () => {
        const reviewedAt
          = new Date(
            '2026-09-24T09:00:00.000Z',
          )

        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'APPROVED',
            submittedAt:
              new Date(
                '2026-09-24T08:00:00.000Z',
              ),
            reviewedAt,
            reviewedByUserId:
              managerUserId,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            'Paiement finalement annulé.',
        }

        const result
          = await cancelHandler(event)

        expect(result.data.status)
          .toBe('CANCELLED')

        expect(result.data.cancelledByUserId)
          .toBe(managerUserId)

        expect(result.data.cancelledAt)
          .not.toBeNull()

        expect(result.data.cancellationReason)
          .toBe(
            'Paiement finalement annulé.',
          )

        /*
         * L'annulation ne doit pas effacer
         * l'historique de validation.
         */
        expect(result.data.reviewedAt)
          .not.toBeNull()

        expect(result.data.reviewedByUserId)
          .toBe(managerUserId)

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.reviewedAt?.toISOString())
          .toBe(reviewedAt.toISOString())

        expect(stored.reviewedByUserId)
          .toBe(managerUserId)

        expect(stored.paidAt)
          .toBeNull()

        expect(stored.paidByUserId)
          .toBeNull()
      },
    )

    it(
      'refuse toute annulation après paiement',
      async () => {
        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status: 'PAID',

            paidAt:
              new Date(
                '2026-09-24T10:00:00.000Z',
              ),

            paidByUserId:
              managerUserId,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            'Tentative après règlement',
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('PAID')

        expect(stored.cancelledAt)
          .toBeNull()

        expect(stored.cancelledByUserId)
          .toBeNull()
      },
    )

    it(
      'refuse une annulation sans motif',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {}

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
        })

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('DRAFT')

        expect(stored.cancelledAt)
          .toBeNull()

        expect(stored.cancelledByUserId)
          .toBeNull()

        expect(stored.cancellationReason)
          .toBeNull()
      },
    )

    it(
      'masque la dépense d’un autre intervenant lors de l’annulation',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = otherExpenseId

        request.body = {
          cancellationReason:
            'Tentative étrangère',
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'masque une dépense d’une autre association au manager',
      async () => {
        const foreignExpense
          = await prisma.expense.create({
            data: {
              associationId:
                foreignAssociationId,

              category:
                'SOFTWARE',

              status:
                'DRAFT',

              expenseDate:
                new Date(
                  '2026-09-24T00:00:00.000Z',
                ),

              description:
                'Dépense étrangère à annuler',

              currency:
                'EUR',

              amountExclTax:
                '100.00',

              taxRate:
                '20.00',

              taxAmount:
                '20.00',

              amountInclTax:
                '120.00',
            },
          })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = foreignExpense.id

        request.body = {
          cancellationReason:
            'Tentative inter-association',
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'refuse l’annulation à un reviewer sans permission de gestion',
      async () => {
        setActor({
          userId: managerUserId,
          roleCode: 'REVIEWER',
          permissions: [
            'expense:read:all',
            'expense:review',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            'Tentative du reviewer',
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'refuse au client l’annulation avant même la validation du body',
      async () => {
        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason: 123456,
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'empêche d’annuler deux fois la même dépense',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.body = {
          cancellationReason:
            'Première annulation',
        }

        const first
          = await cancelHandler(event)

        expect(first.data.status)
          .toBe('CANCELLED')

        const firstCancelledAt
          = first.data.cancelledAt

        request.body = {
          cancellationReason:
            'Deuxième annulation interdite',
        }

        await expect(
          cancelHandler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
        })

        const stored
          = await prisma.expense.findUniqueOrThrow({
            where: {
              id: ownExpenseId,
            },
          })

        expect(stored.status)
          .toBe('CANCELLED')

        expect(
          stored.cancelledAt?.toISOString(),
        ).toBe(
          new Date(
            firstCancelledAt,
          ).toISOString(),
        )

        expect(stored.cancellationReason)
          .toBe(
            'Première annulation',
          )
      },
    )

    it(
      'permet à un intervenant de déposer un justificatif PDF CLEAN sur sa dépense brouillon',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            '../../ticket"<script>.pdf',
          type:
            'application/octet-stream',
          data: pdf,
        }]

        const result
          = await attachmentUploadHandler(
            event,
          )

        expect(result.data.expenseId)
          .toBe(ownExpenseId)

        expect(
          result.data.uploadedByUserId,
        ).toBe(intervenorUserId)

        expect(result.data.mimeType)
          .toBe('application/pdf')

        expect(result.data.fileSize)
          .toBe(String(pdf.length))

        expect(result.data.sha256)
          .toBe(
            createHash('sha256')
              .update(pdf)
              .digest('hex'),
          )

        /*
         * Les chemins internes de stockage
         * ne doivent jamais être exposés.
         */
        expect(result.data)
          .not.toHaveProperty(
            'filePath',
          )

        expect(result.data)
          .not.toHaveProperty(
            'storedName',
          )

        expect(result.data.originalName)
          .not.toContain('<')

        expect(result.data.originalName)
          .not.toContain('>')

        const stored
          = await prisma.expenseAttachment
            .findUniqueOrThrow({
              where: {
                id: result.data.id,
              },
            })

        expect(stored.expenseId)
          .toBe(ownExpenseId)

        expect(stored.uploadedByUserId)
          .toBe(intervenorUserId)

        expect(stored.fileSize)
          .toBe(BigInt(pdf.length))

        expect(stored.sha256)
          .toBe(
            createHash('sha256')
              .update(pdf)
              .digest('hex'),
          )

        const storedBuffer
          = await readStoredFile(
            stored.filePath,
          )

        expect(
          storedBuffer.equals(pdf),
        ).toBe(true)

        expect(
          scanBufferWithClamAv,
        ).toHaveBeenCalledTimes(1)

        expect(
          scanBufferWithClamAv,
        ).toHaveBeenCalledWith(pdf)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action:
                'EXPENSE_ATTACHMENT_UPLOADED',

              entityType:
                'ExpenseAttachment',

              entityId:
                result.data.id,

              metadata:
                expect.objectContaining({
                  expenseId:
                    ownExpenseId,

                  antivirusStatus:
                    'CLEAN',

                  sha256:
                    stored.sha256,
                }),
            }),
          )
      },
    )

    it(
      'refuse le dépôt si la dépense est soumise pendant le scan antivirus',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            intervenorUserId,

          intervenorId,

          roleCode:
            'INTERVENOR',

          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'course-concurrente.pdf',
          data: pdf,
        }]

        /*
         * Le handler a déjà validé DRAFT et placé le
         * fichier en quarantaine.
         *
         * On simule ensuite une soumission concurrente
         * pendant le temps passé dans ClamAV.
         */
        scanBufferWithClamAv
          .mockImplementationOnce(
            async () => {
              await prisma.expense.update({
                where: {
                  id:
                    ownExpenseId,
                },

                data: {
                  status:
                    'SUBMITTED',

                  submittedAt:
                    new Date(),
                },
              })

              return {
                status:
                  'CLEAN' as const,

                rawResult:
                  'stream: OK',
              }
            },
          )

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            409,

          data: {
            code:
              'EXPENSE_ATTACHMENT_STATUS_LOCKED',
          },
        })

        /*
         * Aucune ligne ne doit avoir été créée.
         */
        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                expenseId:
                  ownExpenseId,
              },
            }),
        ).toBe(0)

        /*
         * Et aucun fichier ne doit rester :
         * ni en quarantaine, ni dans le stockage final.
         */
        const quarantineFiles
          = await readdir(
            join(
              uploadDir,
              'quarantine',
              'expenses',
              ownExpenseId,
            ),
          ).catch(
            () => [],
          )

        const finalFiles
          = await readdir(
            join(
              uploadDir,
              'expenses',
              ownExpenseId,
              'attachments',
            ),
          ).catch(
            () => [],
          )

        expect(
          quarantineFiles,
        ).toHaveLength(0)

        expect(
          finalFiles,
        ).toHaveLength(0)
      },
    )

    it(
      'refuse un faux justificatif avant tout appel antivirus',
      async () => {
        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'faux.pdf',
          type: 'application/pdf',
          data: Buffer.from(
            'pas un PDF',
          ),
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                expenseId:
                  ownExpenseId,
              },
            }),
        ).toBe(0)

        expect(
          await listStoredFiles(
            uploadDir,
          ),
        ).toEqual([])
      },
    )

    it(
      'refuse et détruit un justificatif déclaré infecté par ClamAV',
      async () => {
        const pdf
          = await validExpensePdf()

        scanBufferWithClamAv
          .mockResolvedValue({
            status: 'INFECTED',
            signature:
              'Eicar-Test-Signature',
            rawResult:
              'stream: Eicar-Test-Signature FOUND',
          })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'infecte.pdf',
          data: pdf,
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 422,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                expenseId:
                  ownExpenseId,
              },
            }),
        ).toBe(0)

        expect(
          await listStoredFiles(
            uploadDir,
          ),
        ).toEqual([])

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action:
                'EXPENSE_ATTACHMENT_INFECTED',

              outcome:
                'FAILURE',

              entityId:
                ownExpenseId,

              metadata:
                expect.objectContaining({
                  antivirusSignature:
                    'Eicar-Test-Signature',
                }),
            }),
          )
      },
    )

    it(
      'supprime la quarantaine et retourne 503 lorsque ClamAV est indisponible',
      async () => {
        const pdf
          = await validExpensePdf()

        const {
          ClamAvError,
        } = await import(
          '../../server/utils/antivirus'
        )

        scanBufferWithClamAv
          .mockRejectedValue(
            new ClamAvError(
              'CLAMAV_UNAVAILABLE',
              'ClamAV indisponible pour le test.',
            ),
          )

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 503,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                expenseId:
                  ownExpenseId,
              },
            }),
        ).toBe(0)

        expect(
          await listStoredFiles(
            uploadDir,
          ),
        ).toEqual([])

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action:
                'EXPENSE_ATTACHMENT_SCAN_FAILED',

              outcome:
                'FAILURE',

              entityId:
                ownExpenseId,

              metadata:
                expect.objectContaining({
                  errorCode:
                    'CLAMAV_UNAVAILABLE',
                }),
            }),
          )
      },
    )

    it(
      'refuse plusieurs fichiers dans le même formulaire',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.parts = [
          {
            name: 'file',
            filename: 'a.pdf',
            data: pdf,
          },
          {
            name: 'file',
            filename: 'b.pdf',
            data: pdf,
          },
        ]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()

        expect(
          await listStoredFiles(
            uploadDir,
          ),
        ).toEqual([])
      },
    )

    it(
      'refuse les champs multipart supplémentaires',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId = ownExpenseId

        request.parts = [
          {
            name: 'file',
            filename: 'facture.pdf',
            data: pdf,
          },
          {
            name: 'title',
            data: Buffer.from(
              'champ non autorisé',
            ),
          },
        ]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()

        expect(
          await listStoredFiles(
            uploadDir,
          ),
        ).toEqual([])
      },
    )

    it(
      'masque la dépense d’un autre intervenant avant même la lecture multipart',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.parts = [{
          name: 'file',
          filename: 'secret.pdf',
          data: pdf,
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        })

        expect(
          readMultipartFormData,
        ).not.toHaveBeenCalled()

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'refuse le client avant même la lecture multipart',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 403,
        })

        expect(
          readMultipartFormData,
        ).not.toHaveBeenCalled()

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()
      },
    )

    it.each([
      'SUBMITTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'verrouille le dépôt intervenant lorsque la dépense est %s',
      async (status) => {
        const pdf
          = await validExpensePdf()

        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status,
          },
        })

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
        })

        expect(
          readMultipartFormData,
        ).not.toHaveBeenCalled()

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()
      },
    )

    it.each([
      'SUBMITTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'verrouille le dépôt manager lorsque la dépense est %s',
      async (status) => {
        const pdf
          = await validExpensePdf()

        await prisma.expense.update({
          where: {
            id: ownExpenseId,
          },

          data: {
            status,
          },
        })

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        await expect(
          attachmentUploadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
        })

        expect(
          readMultipartFormData,
        ).not.toHaveBeenCalled()

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'permet à un intervenant de consulter son justificatif avec contrôle d’intégrité',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'ticket-test.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        request.attachmentId
          = uploaded.data.id

        request.query = {}

        const result
          = await attachmentReadHandler(
            event,
          )

        expect(
          Buffer.isBuffer(result),
        ).toBe(true)

        expect(
          result.equals(pdf),
        ).toBe(true)

        expect(
          responseHeaders[
            'content-type'
          ],
        ).toBe(
          'application/pdf',
        )

        expect(
          responseHeaders[
            'content-length'
          ],
        ).toBe(
          String(pdf.length),
        )

        expect(
          responseHeaders[
            'content-disposition'
          ],
        ).toContain('inline')

        expect(
          responseHeaders[
            'cache-control'
          ],
        ).toBe(
          'private, no-store, max-age=0',
        )

        expect(
          responseHeaders[
            'x-content-type-options'
          ],
        ).toBe('nosniff')
      },
    )

    it(
      'force le téléchargement lorsque download=1',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'facture septembre.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        request.attachmentId
          = uploaded.data.id

        request.query = {
          download: '1',
        }

        await attachmentReadHandler(
          event,
        )

        expect(
          responseHeaders[
            'content-disposition'
          ],
        ).toContain(
          'attachment',
        )
      },
    )

    it(
      'masque le justificatif d’un autre intervenant',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.parts = [{
          name: 'file',
          filename: 'autre.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        setActor({
          userId: intervenorUserId,
          intervenorId,
          roleCode: 'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentReadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'refuse au client la lecture d’un justificatif',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.expenseId
          = ownExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentReadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 403,
        })
      },
    )

    it(
      'refuse un attachmentId appartenant à une autre dépense',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.parts = [{
          name: 'file',
          filename: 'autre.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        request.expenseId
          = ownExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentReadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        })
      },
    )

    it(
      'refuse la lecture si la taille enregistrée ne correspond plus au fichier',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expenseAttachment.update({
          where: {
            id: uploaded.data.id,
          },

          data: {
            fileSize:
              BigInt(
                pdf.length + 1,
              ),
          },
        })

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentReadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'refuse la lecture si le SHA-256 enregistré ne correspond plus au fichier',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expenseAttachment.update({
          where: {
            id: uploaded.data.id,
          },

          data: {
            sha256:
              '0'.repeat(64),
          },
        })

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentReadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'refuse un chemin de stockage ne correspondant pas à la dépense',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId: managerUserId,
          roleCode: 'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename: 'facture.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expenseAttachment.update({
          where: {
            id: uploaded.data.id,
          },

          data: {
            storedName:
              '../fichier.pdf',

            filePath:
              `expenses/${ownExpenseId}/attachments/../fichier.pdf`,
          },
        })

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentReadHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode: 409,
        })
      },
    )

    it(
      'permet à un intervenant de supprimer son propre justificatif en brouillon',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            intervenorUserId,
          intervenorId,
          roleCode:
            'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'ticket-a-supprimer.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        const stored
          = await prisma.expenseAttachment
            .findUniqueOrThrow({
              where: {
                id:
                  uploaded.data.id,
              },
            })

        request.attachmentId
          = uploaded.data.id

        const result
          = await attachmentDeleteHandler(
            event,
          )

        expect(result.data)
          .toEqual({
            id:
              uploaded.data.id,

            expenseId:
              ownExpenseId,

            deleted:
              true,

            storageCleanup:
              'DELETED',
          })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(0)

        await expect(
          readStoredFile(
            stored.filePath,
          ),
        ).rejects.toMatchObject({
          statusCode: 404,
        })

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),
            expect.objectContaining({
              action:
                'EXPENSE_ATTACHMENT_DELETED',

              entityType:
                'ExpenseAttachment',

              entityId:
                uploaded.data.id,

              metadata:
                expect.objectContaining({
                  expenseId:
                    ownExpenseId,

                  storageCleanup:
                    'DELETED',
                }),
            }),
          )
      },
    )

    it(
      'permet à un intervenant de supprimer son justificatif sur une dépense REJECTED',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            intervenorUserId,
          intervenorId,
          roleCode:
            'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'recu-rejete.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expense.update({
          where: {
            id:
              ownExpenseId,
          },

          data: {
            status:
              'REJECTED',

            rejectionReason:
              'Correction demandée',
          },
        })

        request.attachmentId
          = uploaded.data.id

        const result
          = await attachmentDeleteHandler(
            event,
          )

        expect(result.data.deleted)
          .toBe(true)

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                expenseId:
                  ownExpenseId,
              },
            }),
        ).toBe(0)
      },
    )

    it(
      'interdit à un intervenant de supprimer un justificatif ajouté par le manager',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'piece-manager.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        setActor({
          userId:
            intervenorUserId,
          intervenorId,
          roleCode:
            'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            403,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(1)
      },
    )

    it.each([
      'SUBMITTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'verrouille la suppression intervenant lorsque la dépense est %s',
      async (status) => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            intervenorUserId,
          intervenorId,
          roleCode:
            'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'piece.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expense.update({
          where: {
            id:
              ownExpenseId,
          },

          data: {
            status,
          },
        })

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            409,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(1)
      },
    )

    it(
      'refuse de supprimer un justificatif dont le chemin canonique est corrompu',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'piece-chemin.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expenseAttachment.update({
          where: {
            id:
              uploaded.data.id,
          },

          data: {
            storedName:
              '../piece-chemin.pdf',

            filePath:
              `expenses/${ownExpenseId}/attachments/../piece-chemin.pdf`,
          },
        })

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            409,

          data: {
            code:
              'EXPENSE_ATTACHMENT_INVALID_PATH',
          },
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(1)
      },
    )

    it.each([
      'SUBMITTED',
      'APPROVED',
      'PAID',
      'CANCELLED',
    ] as const)(
      'verrouille la suppression manager lorsque la dépense est %s',
      async (status) => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'piece.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        await prisma.expense.update({
          where: {
            id:
              ownExpenseId,
          },

          data: {
            status,
          },
        })

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            409,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(1)
      },
    )

    it(
      'masque la suppression du justificatif d’un autre intervenant',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'autre.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        setActor({
          userId:
            intervenorUserId,
          intervenorId,
          roleCode:
            'INTERVENOR',
          permissions: [
            'expense:read:own',
            'expense:write:own',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            404,
        })
      },
    )

    it(
      'refuse un attachmentId appartenant à une autre dépense lors de la suppression',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = otherExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'autre.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        request.expenseId
          = ownExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            404,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(1)
      },
    )

    it(
      'refuse au client la suppression d’un justificatif',
      async () => {
        const pdf
          = await validExpensePdf()

        setActor({
          userId:
            managerUserId,
          roleCode:
            'MANAGER',
          permissions: [
            'expense:manage',
          ],
        })

        request.expenseId
          = ownExpenseId

        request.parts = [{
          name: 'file',
          filename:
            'facture.pdf',
          data: pdf,
        }]

        const uploaded
          = await attachmentUploadHandler(
            event,
          )

        setActor({
          userId:
            clientUserId,
          roleCode:
            'CLIENT',
          permissions: [],
        })

        request.expenseId
          = ownExpenseId

        request.attachmentId
          = uploaded.data.id

        await expect(
          attachmentDeleteHandler(
            event,
          ),
        ).rejects.toMatchObject({
          statusCode:
            403,
        })

        expect(
          await prisma.expenseAttachment
            .count({
              where: {
                id:
                  uploaded.data.id,
              },
            }),
        ).toBe(1)
      },
    )

    it(
      'refuse au client la création avant même la validation du body',
      async () => {
        setActor({
          userId: clientUserId,
          roleCode: 'CLIENT',
          permissions: [],
        })

        request.body = {
          complètement: 'invalide',
        }

        await expect(
          createHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,
        })

        expect(writeAuditLog)
          .not.toHaveBeenCalled()
      },
    )
  },
)
