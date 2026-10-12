import { constants } from 'node:fs'
import { lstat, open } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { uploadRoot } from './files'

export async function readSecureOfficialReportFile(
  filePath: string,
): Promise<Buffer> {
  const root = uploadRoot()
  const absolute = resolve(root, filePath)
  const relativePath = relative(root, absolute)

  if (
    !relativePath
    || relativePath === '..'
    || relativePath.startsWith(`..${sep}`)
    || relativePath.startsWith(sep)
  ) {
    throw new Error('INVALID_OFFICIAL_ARCHIVE_PATH')
  }

  const rootStat = await lstat(root)

  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('INVALID_OFFICIAL_ARCHIVE_ROOT')
  }

  const components = relativePath.split(sep)
  let current = root

  for (const component of components.slice(0, -1)) {
    current = resolve(current, component)

    const stat = await lstat(current)

    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error('INVALID_OFFICIAL_ARCHIVE_DIRECTORY')
    }
  }

  const finalStat = await lstat(absolute)

  if (!finalStat.isFile() || finalStat.isSymbolicLink()) {
    throw new Error('INVALID_OFFICIAL_ARCHIVE_FILE')
  }

  const handle = await open(
    absolute,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  )

  try {
    const openedStat = await handle.stat()

    if (!openedStat.isFile()) {
      throw new Error('INVALID_OFFICIAL_ARCHIVE_FILE')
    }

    return await handle.readFile()
  }
  finally {
    await handle.close()
  }
}
