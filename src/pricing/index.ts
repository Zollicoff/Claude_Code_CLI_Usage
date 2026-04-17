import { matchModel } from './models';

export { MODELS, matchModel } from './models';
export type { ModelDescriptor } from './models';
export { calculateCost } from './calculator';

export function getModelDisplayName(model: string): string {
  return matchModel(model)?.displayName ?? model;
}
