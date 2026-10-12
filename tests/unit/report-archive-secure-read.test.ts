import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readSecureOfficialReportFile } from '../../server/utils/report-archive-secure-read'

describe('Lecture sécurisée des archives officielles', () => {
  const originalUploadDir = process.env.UPLOAD_DIR
  const directories: string[] = []

  afterEach(async () => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR
    }
    else {
      process.env.UPLOAD_DIR = originalUploadDir
    }

    for (const directory of directories.splice(0)) {
      await rm(directory, { recursive: true, force: true })
    }
  })

  async function setup() {
    const directory = await mkdtemp(
      join(tmpdir(), 'ifics-secure-archive-'),
    )
    directories.push(directory)

    const root = join(directory, 'uploads')
    const outside = join(directory, 'outside')

    await mkdir(join(root, 'reports'), { recursive: true })
    await mkdir(outside)

    process.env.UPLOAD_DIR = root

    return { root, outside }
  }

  it('lit un fichier PDF régulier', async () => {
    const { root } = await setup()
    const bytes = Buffer.from('%PDF-test')

    await writeFile(join(root, 'reports', 'valid.pdf'), bytes)

    const result = await readSecureOfficialReportFile(
      'reports/valid.pdf',
    )

    expect(result.equals(bytes)).toBe(true)
  })

  it('refuse une traversée hors du stockage', async () => {
    await setup()

    await expect(
      readSecureOfficialReportFile('../outside/secret.pdf'),
    ).rejects.toThrow('INVALID_OFFICIAL_ARCHIVE_PATH')
  })

  it('refuse un lien symbolique sur le fichier', async () => {
    const { root, outside } = await setup()

    await writeFile(
      join(outside, 'secret.pdf'),
      Buffer.from('%PDF-secret'),
    )

    await symlink(
      join(outside, 'secret.pdf'),
      join(root, 'reports', 'linked.pdf'),
    )

    await expect(
      readSecureOfficialReportFile('reports/linked.pdf'),
    ).rejects.toThrow('INVALID_OFFICIAL_ARCHIVE_FILE')
  })

  it('refuse un lien symbolique sur un répertoire parent', async () => {
    const { root, outside } = await setup()

    await writeFile(
      join(outside, 'secret.pdf'),
      Buffer.from('%PDF-secret'),
    )

    await symlink(
      outside,
      join(root, 'reports', 'linked'),
    )

    await expect(
      readSecureOfficialReportFile('reports/linked/secret.pdf'),
    ).rejects.toThrow('INVALID_OFFICIAL_ARCHIVE_DIRECTORY')
  })

  it('refuse un répertoire à la place du fichier', async () => {
    const { root } = await setup()

    await mkdir(join(root, 'reports', 'directory.pdf'))

    await expect(
      readSecureOfficialReportFile('reports/directory.pdf'),
    ).rejects.toThrow('INVALID_OFFICIAL_ARCHIVE_FILE')
  })
})
