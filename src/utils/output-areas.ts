import type { RespecLikeConfig, OutputArea } from '../types';

export interface FieldMapping<T> {
  fields: (keyof T)[];
  outputs: OutputArea[];
}

export const CONFIG_TO_OUTPUT_MAP: FieldMapping<RespecLikeConfig>[] = [
  {
    fields: ['sections'],
    outputs: ['idl', 'xref', 'references', 'boilerplate', 'toc', 'diagnostics'],
  },
  {
    fields: ['header', 'sotd', 'pubrules', 'legal'],
    outputs: ['boilerplate'],
  },
];

function fieldChanged(oldVal: unknown, newVal: unknown): boolean {
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (oldVal === newVal) return false;
    if (oldVal.length !== newVal.length) return true;
    for (let i = 0; i < oldVal.length; i++) {
      if (oldVal[i] !== newVal[i]) return true;
    }
    return false;
  }
  return oldVal !== newVal;
}

export function getChangedOutputAreas(
  oldConfig: RespecLikeConfig | undefined,
  newConfig: RespecLikeConfig,
): OutputArea[] {
  if (!oldConfig) {
    const all = new Set<OutputArea>();
    for (const mapping of CONFIG_TO_OUTPUT_MAP) {
      for (const out of mapping.outputs) all.add(out);
    }
    return Array.from(all);
  }

  const areas = new Set<OutputArea>();
  for (const { fields, outputs } of CONFIG_TO_OUTPUT_MAP) {
    if (fields.some(f => fieldChanged((oldConfig as any)[f], (newConfig as any)[f]))) {
      outputs.forEach(o => areas.add(o));
    }
  }
  return Array.from(areas);
}

