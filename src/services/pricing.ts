/**
 * Claude API pricing constants (per million tokens)
 * Updated to match current Anthropic pricing
 */

interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

// Pricing per million tokens
const PRICING: Record<string, ModelPricing> = {
  // Opus 4.5
  'opus-4.5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.50 },
  // Opus 4.1
  'opus-4.1': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  // Opus 4
  'opus-4': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  // Opus 3
  'opus-3': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  // Sonnet 4.5
  'sonnet-4.5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  // Sonnet 4
  'sonnet-4': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  // Sonnet 3.7
  'sonnet-3.7': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  // Sonnet 3.5
  'sonnet-3.5': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
  // Haiku 4.5
  'haiku-4.5': { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.10 },
  // Haiku 3.5
  'haiku-3.5': { input: 0.80, output: 4.0, cacheWrite: 1.0, cacheRead: 0.08 },
  // Haiku 3
  'haiku-3': { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 },
};

/**
 * Get the pricing tier for a model name
 */
function getModelPricing(model: string): ModelPricing | null {
  const modelLower = model.toLowerCase();

  // Check more specific patterns first (order matters!)

  // Opus 4.5
  if (modelLower.includes('opus-4-5') || modelLower.includes('opus-4.5') ||
      modelLower.includes('claude-opus-4-5') || modelLower.includes('claude-opus-4.5')) {
    return PRICING['opus-4.5'];
  }
  // Opus 4.1
  if (modelLower.includes('opus-4-1') || modelLower.includes('opus-4.1') ||
      modelLower.includes('claude-opus-4-1') || modelLower.includes('claude-opus-4.1')) {
    return PRICING['opus-4.1'];
  }
  // Opus 4 (must come after 4.5 and 4.1)
  if (modelLower.includes('opus-4') || modelLower.includes('claude-opus-4')) {
    return PRICING['opus-4'];
  }
  // Opus 3
  if (modelLower.includes('opus-3') || modelLower.includes('claude-3-opus')) {
    return PRICING['opus-3'];
  }
  // Sonnet 4.5
  if (modelLower.includes('sonnet-4-5') || modelLower.includes('sonnet-4.5') ||
      modelLower.includes('claude-sonnet-4-5') || modelLower.includes('claude-sonnet-4.5')) {
    return PRICING['sonnet-4.5'];
  }
  // Sonnet 4 (must come after 4.5)
  if (modelLower.includes('sonnet-4') || modelLower.includes('claude-sonnet-4')) {
    return PRICING['sonnet-4'];
  }
  // Sonnet 3.7
  if (modelLower.includes('sonnet-3-7') || modelLower.includes('sonnet-3.7') ||
      modelLower.includes('claude-3-7-sonnet') || modelLower.includes('claude-3.7-sonnet')) {
    return PRICING['sonnet-3.7'];
  }
  // Sonnet 3.5
  if (modelLower.includes('sonnet-3-5') || modelLower.includes('sonnet-3.5') ||
      modelLower.includes('claude-3-5-sonnet') || modelLower.includes('claude-3.5-sonnet')) {
    return PRICING['sonnet-3.5'];
  }
  // Haiku 4.5
  if (modelLower.includes('haiku-4-5') || modelLower.includes('haiku-4.5') ||
      modelLower.includes('claude-haiku-4-5') || modelLower.includes('claude-haiku-4.5')) {
    return PRICING['haiku-4.5'];
  }
  // Haiku 3.5
  if (modelLower.includes('haiku-3-5') || modelLower.includes('haiku-3.5') ||
      modelLower.includes('claude-3-5-haiku') || modelLower.includes('claude-3.5-haiku')) {
    return PRICING['haiku-3.5'];
  }
  // Haiku 3
  if (modelLower.includes('haiku-3') || modelLower.includes('claude-3-haiku')) {
    return PRICING['haiku-3'];
  }

  return null;
}

/**
 * Calculate the cost for a usage entry
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): number {
  const pricing = getModelPricing(model);

  if (!pricing) {
    return 0; // Unknown model
  }

  // Prices are per million tokens
  const inputCost = (inputTokens * pricing.input) / 1_000_000;
  const outputCost = (outputTokens * pricing.output) / 1_000_000;
  const cacheWriteCost = (cacheCreationTokens * pricing.cacheWrite) / 1_000_000;
  const cacheReadCost = (cacheReadTokens * pricing.cacheRead) / 1_000_000;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Get a display name for a model
 */
export function getModelDisplayName(model: string): string {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('opus-4-5') || modelLower.includes('opus-4.5')) {
    return 'Claude Opus 4.5';
  }
  if (modelLower.includes('opus-4-1') || modelLower.includes('opus-4.1')) {
    return 'Claude Opus 4.1';
  }
  if (modelLower.includes('opus-4')) {
    return 'Claude Opus 4';
  }
  if (modelLower.includes('opus-3') || modelLower.includes('claude-3-opus')) {
    return 'Claude Opus 3';
  }
  if (modelLower.includes('sonnet-4-5') || modelLower.includes('sonnet-4.5')) {
    return 'Claude Sonnet 4.5';
  }
  if (modelLower.includes('sonnet-4')) {
    return 'Claude Sonnet 4';
  }
  if (modelLower.includes('sonnet-3-7') || modelLower.includes('sonnet-3.7')) {
    return 'Claude Sonnet 3.7';
  }
  if (modelLower.includes('sonnet-3-5') || modelLower.includes('sonnet-3.5')) {
    return 'Claude Sonnet 3.5';
  }
  if (modelLower.includes('haiku-4-5') || modelLower.includes('haiku-4.5')) {
    return 'Claude Haiku 4.5';
  }
  if (modelLower.includes('haiku-3-5') || modelLower.includes('haiku-3.5')) {
    return 'Claude Haiku 3.5';
  }
  if (modelLower.includes('haiku-3')) {
    return 'Claude Haiku 3';
  }

  return model; // Return original if no match
}
