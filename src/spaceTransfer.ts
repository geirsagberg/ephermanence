import { parseSpaceState } from './spaceStorage'
import type { SpaceState } from './types'

const spaceExportFormat = 'ephermanence-space'
const spaceExportVersion = 1

export function serializeSpaceExport(space: SpaceState) {
  return JSON.stringify(
    {
      format: spaceExportFormat,
      version: spaceExportVersion,
      space,
    },
    null,
    2,
  )
}

export function parseSpaceImport(serialized: string): SpaceState | null {
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (isRecord(parsed) && parsed.format === spaceExportFormat && parsed.version === spaceExportVersion) {
      return parseSpaceState(parsed.space)
    }
    return parseSpaceState(parsed)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
