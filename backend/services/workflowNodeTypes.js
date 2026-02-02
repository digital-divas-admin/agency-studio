/**
 * Workflow Node Type Registry
 *
 * Defines all available node types with their input/output ports,
 * config schemas, categories, and credit costs.
 *
 * Port types: image, image_batch, video, text, any_media
 * Type compatibility:
 *   - image → image, any_media
 *   - video → video, any_media
 *   - image_batch → image_batch only (use "pick" to narrow)
 *   - text → text only
 *   - any_media → any_media only
 */

const { config } = require('../config');

/**
 * All registered node types
 */
const NODE_TYPES = {
  // ==================
  // Generation
  // ==================
  generate_image: {
    type: 'generate_image',
    label: 'Generate Image',
    category: 'generation',
    description: 'Generate images using an AI model',
    inputs: [
      { name: 'reference_image', type: 'image', optional: true, label: 'Reference Image' },
    ],
    outputs: [
      { name: 'images', type: 'image_batch', label: 'Images' },
    ],
    configSchema: {
      model: { type: 'select', options: ['seedream', 'nanoBanana', 'qwen'], default: 'seedream', label: 'Model' },
      prompt: { type: 'textarea', default: '', label: 'Prompt', supportsVariables: true },
      negative_prompt: { type: 'textarea', default: '', label: 'Negative Prompt', supportsVariables: true },
      aspect_ratio: { type: 'select', options: ['1:1', '4:3', '3:4', '16:9', '9:16', '2:3', '3:2'], default: '1:1', label: 'Aspect Ratio' },
      count: { type: 'number', min: 1, max: 4, default: 1, label: 'Number of Images' },
    },
    creditCost: (nodeConfig) => {
      const modelCosts = { seedream: 10, nanoBanana: 8, qwen: 5 };
      const count = nodeConfig.count || 1;
      return (modelCosts[nodeConfig.model] || 10) * count;
    },
  },

  generate_video: {
    type: 'generate_video',
    label: 'Generate Video',
    category: 'generation',
    description: 'Generate videos using an AI model',
    inputs: [
      { name: 'start_image', type: 'image', optional: true, label: 'Start Image' },
    ],
    outputs: [
      { name: 'video', type: 'video', label: 'Video' },
    ],
    configSchema: {
      model: { type: 'select', options: ['kling', 'wan', 'veo'], default: 'kling', label: 'Model' },
      prompt: { type: 'textarea', default: '', label: 'Prompt', supportsVariables: true },
      duration: { type: 'number', min: 1, max: 10, default: 5, label: 'Duration (seconds)' },
      aspect_ratio: { type: 'select', options: ['16:9', '9:16', '1:1'], default: '16:9', label: 'Aspect Ratio' },
    },
    creditCost: (nodeConfig) => {
      const modelCosts = { kling: 50, wan: 40, veo: 60 };
      return modelCosts[nodeConfig.model] || 50;
    },
  },

  // ==================
  // Editing
  // ==================
  edit_bg_remove: {
    type: 'edit_bg_remove',
    label: 'Remove Background',
    category: 'editing',
    description: 'Remove the background from an image',
    inputs: [
      { name: 'image', type: 'image', optional: false, label: 'Image' },
    ],
    outputs: [
      { name: 'image', type: 'image', label: 'Image' },
    ],
    configSchema: {},
    creditCost: () => config.creditCosts.bgRemover,
  },

  // ==================
  // AI
  // ==================
  ai_caption: {
    type: 'ai_caption',
    label: 'AI Caption',
    category: 'ai',
    description: 'Generate a caption or text description for media',
    inputs: [
      { name: 'media', type: 'any_media', optional: false, label: 'Media' },
    ],
    outputs: [
      { name: 'text', type: 'text', label: 'Caption' },
      { name: 'media', type: 'any_media', label: 'Media (pass-through)' },
    ],
    configSchema: {
      instruction: { type: 'textarea', default: 'Write a caption for this image.', label: 'Instruction', supportsVariables: true },
      tone: { type: 'select', options: ['professional', 'casual', 'playful', 'flirty', 'edgy', 'custom'], default: 'casual', label: 'Tone' },
      max_length: { type: 'number', min: 10, max: 2000, default: 280, label: 'Max Length' },
    },
    creditCost: () => config.creditCosts.chat,
  },

  // ==================
  // Flow Control
  // ==================
  review: {
    type: 'review',
    label: 'Review Gate',
    category: 'flow_control',
    description: 'Pause the workflow for human review and approval',
    inputs: [
      { name: 'media', type: 'any_media', optional: true, label: 'Media' },
      { name: 'text', type: 'text', optional: true, label: 'Text' },
    ],
    outputs: [
      { name: 'media', type: 'any_media', label: 'Media (approved)' },
      { name: 'text', type: 'text', label: 'Text (approved)' },
    ],
    configSchema: {
      note: { type: 'textarea', default: '', label: 'Review Note', supportsVariables: true },
    },
    creditCost: () => 0,
  },

  pick: {
    type: 'pick',
    label: 'Pick Best',
    category: 'flow_control',
    description: 'Select the best image from a batch',
    inputs: [
      { name: 'images', type: 'image_batch', optional: false, label: 'Image Batch' },
    ],
    outputs: [
      { name: 'image', type: 'image', label: 'Selected Image' },
    ],
    configSchema: {},
    creditCost: () => 0,
  },

  // ==================
  // Output
  // ==================
  save_to_gallery: {
    type: 'save_to_gallery',
    label: 'Save to Gallery',
    category: 'output',
    description: 'Save media to the gallery for the current model',
    inputs: [
      { name: 'media', type: 'any_media', optional: false, label: 'Media' },
      { name: 'caption', type: 'text', optional: true, label: 'Caption' },
    ],
    outputs: [
      { name: 'media', type: 'any_media', label: 'Media (pass-through)' },
    ],
    configSchema: {
      tags: { type: 'tags', default: [], label: 'Tags' },
    },
    creditCost: () => 0,
  },

  export: {
    type: 'export',
    label: 'Export',
    category: 'output',
    description: 'Export content to a platform (coming soon)',
    inputs: [
      { name: 'media', type: 'any_media', optional: false, label: 'Media' },
      { name: 'caption', type: 'text', optional: true, label: 'Caption' },
    ],
    outputs: [],
    configSchema: {
      platform: { type: 'select', options: ['download', 'onlyfans', 'fansly', 'twitter'], default: 'download', label: 'Platform' },
    },
    creditCost: () => 0,
  },
};

/**
 * Port type compatibility matrix.
 * Can output type X connect to input type Y?
 */
const TYPE_COMPATIBILITY = {
  image:       ['image', 'any_media'],
  image_batch: ['image_batch'],
  video:       ['video', 'any_media'],
  text:        ['text'],
  any_media:   ['any_media', 'image', 'video'],
};

/**
 * Check if an output port type is compatible with an input port type
 */
function isPortCompatible(outputType, inputType) {
  const compatible = TYPE_COMPATIBILITY[outputType];
  return compatible ? compatible.includes(inputType) : false;
}

/**
 * Get all node types as an array (for the GET /node-types endpoint)
 */
function getNodeTypeList() {
  return Object.values(NODE_TYPES).map(({ creditCost, ...rest }) => ({
    ...rest,
    // Return a sample credit cost with default config
    estimatedCredits: typeof creditCost === 'function' ? creditCost(rest.configSchema ? Object.fromEntries(
      Object.entries(rest.configSchema).map(([k, v]) => [k, v.default])
    ) : {}) : 0,
  }));
}

/**
 * Get a node type definition by type key
 */
function getNodeType(type) {
  return NODE_TYPES[type] || null;
}

/**
 * Calculate the credit cost for a node given its config
 */
function calculateNodeCreditCost(nodeType, nodeConfig) {
  const def = NODE_TYPES[nodeType];
  if (!def) return 0;
  return typeof def.creditCost === 'function' ? def.creditCost(nodeConfig || {}) : 0;
}

/**
 * Category metadata for the UI palette
 */
const NODE_CATEGORIES = {
  generation:   { label: 'Generation', color: '#8b5cf6', order: 1 },
  editing:      { label: 'Editing',    color: '#3b82f6', order: 2 },
  ai:           { label: 'AI',         color: '#14b8a6', order: 3 },
  flow_control: { label: 'Flow Control', color: '#eab308', order: 4 },
  output:       { label: 'Output',     color: '#22c55e', order: 5 },
};

module.exports = {
  NODE_TYPES,
  NODE_CATEGORIES,
  TYPE_COMPATIBILITY,
  isPortCompatible,
  getNodeTypeList,
  getNodeType,
  calculateNodeCreditCost,
};
