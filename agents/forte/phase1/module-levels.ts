import type { ModuleProgressionProfile } from "@core/registry"
import { moduleProgression as clientesProgression } from "@modules/clientes/levels"
import { moduleProgression as proyectosProgression } from "@modules/proyectos/levels"
import { moduleProgression as inboxProgression } from "@modules/inbox/levels"

const progressionMap = new Map<string, ModuleProgressionProfile>([
  [clientesProgression.moduleId, clientesProgression],
  [proyectosProgression.moduleId, proyectosProgression],
  [inboxProgression.moduleId, inboxProgression],
])

export function getModuleProgression(moduleId: string): ModuleProgressionProfile | undefined {
  return progressionMap.get(moduleId)
}

export function getModuleLevelNames(moduleId: string) {
  return getModuleProgression(moduleId)?.levels.map((level) => level.level)
}
