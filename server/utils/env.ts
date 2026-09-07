export type Environment = Record<string, string | undefined>

export function requireEnv(
  name: string,
  env: Environment = process.env,
): string {
  const value = env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is missing`)
  }

  return value
}
