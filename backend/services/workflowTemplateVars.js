/**
 * Workflow Template Variable Resolver
 *
 * Resolves {{model.*}} template variables in workflow node configs
 * against an agency_models record.
 *
 * Supported variables:
 *   {{model.name}}           - Creator name
 *   {{model.slug}}           - URL-safe slug
 *   {{model.of_handle}}      - OnlyFans handle
 *   {{model.notes}}          - Freeform notes (style, appearance, etc.)
 *   {{model.lora_name}}      - LoRA model filename (from lora_config.path)
 *   {{model.lora_strength}}  - LoRA weight (from lora_config.weight)
 *   {{model.lora_trigger}}   - LoRA trigger word (from lora_config.triggerWord)
 */

const VARIABLE_REGEX = /\{\{model\.(\w+)\}\}/g;

/**
 * Build the variable map from an agency_models record
 */
function buildVariableMap(modelRecord) {
  if (!modelRecord) return {};

  const loraConfig = modelRecord.lora_config || {};

  return {
    name: modelRecord.name || '',
    slug: modelRecord.slug || '',
    of_handle: modelRecord.onlyfans_handle || '',
    notes: modelRecord.notes || '',
    lora_name: loraConfig.path || '',
    lora_strength: String(loraConfig.weight ?? '0.7'),
    lora_trigger: loraConfig.triggerWord || '',
  };
}

/**
 * Resolve template variables in a single string
 */
function resolveString(str, variableMap) {
  if (typeof str !== 'string') return str;
  return str.replace(VARIABLE_REGEX, (match, key) => {
    return variableMap[key] !== undefined ? variableMap[key] : match;
  });
}

/**
 * Recursively resolve template variables in a value (string, object, or array)
 */
function resolveValue(value, variableMap) {
  if (typeof value === 'string') {
    return resolveString(value, variableMap);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, variableMap));
  }
  if (value !== null && typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveValue(v, variableMap);
    }
    return resolved;
  }
  return value;
}

/**
 * Resolve all template variables in a node's config
 * Returns a new config object with all {{model.*}} replaced
 */
function resolveNodeConfig(config, modelRecord) {
  const variableMap = buildVariableMap(modelRecord);
  return resolveValue(config, variableMap);
}

/**
 * Get all available template variables with descriptions (for the UI)
 */
function getAvailableVariables() {
  return [
    { key: 'model.name', label: 'Model Name', example: 'Sarah' },
    { key: 'model.slug', label: 'Model Slug', example: 'sarah' },
    { key: 'model.of_handle', label: 'OnlyFans Handle', example: '@sarahxxx' },
    { key: 'model.notes', label: 'Model Notes', example: 'Blonde, prefers warm tones' },
    { key: 'model.lora_name', label: 'LoRA Filename', example: 'sarah_v2.safetensors' },
    { key: 'model.lora_strength', label: 'LoRA Strength', example: '0.85' },
    { key: 'model.lora_trigger', label: 'LoRA Trigger Word', example: 'sks_sarah' },
  ];
}

module.exports = {
  resolveNodeConfig,
  resolveString,
  buildVariableMap,
  getAvailableVariables,
  VARIABLE_REGEX,
};
