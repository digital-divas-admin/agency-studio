/**
 * Workflow Node Executors
 *
 * Wires workflow nodes to the actual generation, editing, and chat APIs.
 * Called by workflowRunner.js instead of the old HTTP-route stubs.
 *
 * KEY BEHAVIOR: Qwen image generation auto-injects the model's LoRA
 * (trigger word prepended to prompt + LoRA config in Power Lora Loader)
 * so users never need to manually configure LoRA in workflow nodes.
 */

const { config } = require('../config');
const { logger } = require('./logger');
const { supabaseAdmin } = require('./supabase');
const { runModel, extractOutputUrl } = require('./replicateClient');
const { routeGenerationRequest, getJobStatus } = require('./gpuRouter');
const { extractImageFromOutput } = require('./comfyuiOutput');
const { compressImage, compressImages } = require('./imageCompression');
const { fetchWithRetry } = require('./retryWithBackoff');
const { PerAgencyQueue } = require('./requestQueue');
const fetch = require('node-fetch');

// =============================================
// Constants
// =============================================

// Per-agency rate-limit queue for WaveSpeed (1.5s between requests per agency)
const wavespeedQueue = new PerAgencyQueue(1500);

// Replicate model identifiers
const KLING_MODEL = 'kwaivgi/kling-v2.5-turbo-pro';
const VEO_MODEL = 'google/veo-3.1-fast';
const WAN_MODEL = 'wan-video/wan-2.2-i2v-a14b';
const BG_REMOVER_MODEL = '851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';

// OpenRouter
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CHAT_MODEL = 'deepseek/deepseek-chat-v3-0324:free';
const NANO_BANANA_MODEL = 'google/gemini-3-pro-image-preview';

// WaveSpeed
const WAVESPEED_TEXT2IMG_URL = 'https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5';
const WAVESPEED_IMG2IMG_URL = 'https://api.wavespeed.ai/api/v3/bytedance/seedream-v4.5/edit';
const WAVESPEED_RESULT_URL = 'https://api.wavespeed.ai/api/v3/predictions';

// GPU Router polling
const POLL_INTERVAL = 3000;
const MAX_POLL_ATTEMPTS = 200;

// Aspect ratio → pixel dimensions for Qwen (ComfyUI needs exact pixels)
const QWEN_DIMENSIONS = {
  '1:1':  { width: 1536, height: 1536 },
  '4:3':  { width: 1536, height: 1152 },
  '3:4':  { width: 1152, height: 1536 },
  '16:9': { width: 1536, height: 864 },
  '9:16': { width: 864, height: 1536 },
  '2:3':  { width: 1024, height: 1536 },
  '3:2':  { width: 1536, height: 1024 },
};

// Aspect ratio → Seedream WaveSpeed size string
const SEEDREAM_SIZES = {
  '1:1':  '2048*2048',
  '4:3':  '2048*1536',
  '3:4':  '1536*2048',
  '16:9': '2048*1152',
  '9:16': '1152*2048',
  '2:3':  '1365*2048',
  '3:2':  '2048*1365',
};


// =============================================
// Qwen ComfyUI Workflow Template
// (same structure as routes/generation/qwen.js)
// =============================================

function getQwenWorkflowTemplate({ prompt, negativePrompt = '', width = 1152, height = 1536, seed = null, loraConfig = null }) {
  const actualSeed = seed ?? Math.floor(Math.random() * 999999999999999);

  return {
    "3": {
      "inputs": {
        "seed": actualSeed,
        "steps": 4,
        "cfg": 1,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1,
        "model": ["66", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["58", 0]
      },
      "class_type": "KSampler",
      "_meta": { "title": "KSampler" }
    },
    "6": {
      "inputs": {
        "text": prompt,
        "clip": ["38", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "CLIP Text Encode (Positive Prompt)" }
    },
    "7": {
      "inputs": {
        "text": negativePrompt,
        "clip": ["38", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": { "title": "CLIP Text Encode (Negative Prompt)" }
    },
    "8": {
      "inputs": {
        "samples": ["3", 0],
        "vae": ["39", 0]
      },
      "class_type": "VAEDecode",
      "_meta": { "title": "VAE Decode" }
    },
    "37": {
      "inputs": {
        "unet_name": "qwen_image_bf16.safetensors",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": { "title": "Load Diffusion Model" }
    },
    "38": {
      "inputs": {
        "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
        "type": "qwen_image",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": { "title": "Load CLIP" }
    },
    "39": {
      "inputs": {
        "vae_name": "qwen_image_vae.safetensors"
      },
      "class_type": "VAELoader",
      "_meta": { "title": "Load VAE" }
    },
    "58": {
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage",
      "_meta": { "title": "EmptySD3LatentImage" }
    },
    "60": {
      "inputs": {
        "filename_prefix": "txt2img/%date:yyyy-MM-dd%/%date:yyyy-MM-dd%",
        "images": ["8", 0]
      },
      "class_type": "SaveImage",
      "_meta": { "title": "Save Image" }
    },
    "66": {
      "inputs": {
        "shift": 2,
        "model": ["76", 0]
      },
      "class_type": "ModelSamplingAuraFlow",
      "_meta": { "title": "ModelSamplingAuraFlow" }
    },
    "76": {
      "inputs": {
        "PowerLoraLoaderHeaderWidget": { "type": "PowerLoraLoaderHeaderWidget" },
        "lora_1": loraConfig?.path
          ? { "on": true, "lora": loraConfig.path, "strength": loraConfig.weight ?? 0.7 }
          : { "on": false, "lora": "None", "strength": 1 },
        "lora_2": { "on": true, "lora": "qwen-boreal-portraits-portraits-high-rank.safetensors", "strength": 0.6 },
        "lora_3": { "on": true, "lora": "Qwen-Image-Lightning-4steps-V2.0.safetensors", "strength": 1 },
        "➕ Add Lora": "",
        "model": ["37", 0]
      },
      "class_type": "Power Lora Loader (rgthree)",
      "_meta": { "title": "Power Lora Loader (rgthree)" }
    }
  };
}


// =============================================
// GPU Router Polling (same logic as qwen.js)
// =============================================

async function pollGpuJob(jobId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const statusResult = await getJobStatus(jobId);

      if (!statusResult.success) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      const data = statusResult.data;

      if (data.status === 'COMPLETED') {
        const { imageUrl, images } = extractImageFromOutput(data.output);
        if (imageUrl) {
          return { success: true, imageUrl, images };
        }
        return { success: false, error: 'No image in output' };
      }

      if (data.status === 'FAILED') {
        return { success: false, error: data.error || 'Job failed' };
      }

      if (data.status === 'CANCELLED') {
        return { success: false, error: 'Job was cancelled' };
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  return { success: false, error: 'Job timed out after polling' };
}


// =============================================
// WaveSpeed Polling (same logic as seedream.js)
// =============================================

async function pollWavespeedResult(taskId) {
  const pollUrl = `${WAVESPEED_RESULT_URL}/${taskId}/result`;

  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.wavespeed.apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`WaveSpeed polling error: ${response.status}`);
    }

    const result = await response.json();

    if (result.status === 'completed' || result.status === 'succeeded') {
      return result.data || result;
    }

    if (result.status === 'failed' || result.status === 'error') {
      throw new Error(result.error || 'Generation failed');
    }

    if (result.outputs || result.output || (result.data && (result.data.outputs || result.data.url))) {
      return result.data || result;
    }
  }

  throw new Error('WaveSpeed generation timed out');
}


// =============================================
// WaveSpeed Image Extraction (handles all formats)
// =============================================

function extractWavespeedImages(result) {
  const images = [];

  if (result.data?.outputs) {
    for (const output of result.data.outputs) {
      if (typeof output === 'string') images.push(output);
      else if (output.url) images.push(output.url);
      else if (output.base64) images.push(`data:image/png;base64,${output.base64}`);
    }
  } else if (result.data?.url) {
    images.push(result.data.url);
  } else if (result.data?.base64) {
    images.push(`data:image/png;base64,${result.data.base64}`);
  } else if (result.outputs) {
    for (const output of result.outputs) {
      if (typeof output === 'string') {
        images.push(output.startsWith('http') ? output : `data:image/png;base64,${output}`);
      } else if (output.url) images.push(output.url);
      else if (output.base64) images.push(`data:image/png;base64,${output.base64}`);
    }
  } else if (result.output) {
    if (typeof result.output === 'string') {
      images.push(result.output.startsWith('http') ? result.output : `data:image/png;base64,${result.output}`);
    }
  }

  return images;
}


// =============================================
// Image Generation — Model Backends
// =============================================

/**
 * Generate images with Qwen via ComfyUI + GPU Router.
 * AUTO-INJECTS the model's LoRA: trigger word is prepended to prompt,
 * LoRA file is set in Power Lora Loader slot 1.
 */
async function generateWithQwen(nodeConfig, inputs, ctx) {
  if (!config.runpod.apiKey) {
    throw new Error('RunPod API key not configured');
  }

  const prompt = nodeConfig.prompt || '';
  const negativePrompt = nodeConfig.negative_prompt || '';
  const aspectRatio = nodeConfig.aspect_ratio || '1:1';
  const count = nodeConfig.count || 1;
  const dims = QWEN_DIMENSIONS[aspectRatio] || QWEN_DIMENSIONS['1:1'];

  // Auto-inject LoRA from the run's model
  const loraConfig = ctx.model?.lora_config?.path ? ctx.model.lora_config : null;
  let effectivePrompt = prompt;
  if (loraConfig?.triggerWord) {
    effectivePrompt = `${loraConfig.triggerWord} ${prompt}`;
  }

  logger.info('Workflow: Qwen generation', {
    hasLora: !!loraConfig,
    loraPath: loraConfig?.path || 'none',
    triggerWord: loraConfig?.triggerWord || 'none',
    dimensions: dims,
  });

  const allImages = [];

  // Qwen ComfyUI produces 1 image per job, so loop for count > 1
  for (let i = 0; i < count; i++) {
    const workflow = getQwenWorkflowTemplate({
      prompt: effectivePrompt,
      negativePrompt,
      width: dims.width,
      height: dims.height,
      loraConfig,
    });

    const submitResult = await routeGenerationRequest({ workflow });
    if (!submitResult.success) {
      throw new Error(`Failed to submit Qwen job: ${submitResult.error}`);
    }

    const result = await pollGpuJob(submitResult.jobId);
    if (!result.success) {
      throw new Error(`Qwen generation failed: ${result.error}`);
    }

    allImages.push(...result.images);
  }

  return allImages;
}

/**
 * Generate images with Seedream via WaveSpeed API.
 * No LoRA support (direct API model).
 */
async function generateWithSeedream(nodeConfig, inputs, ctx) {
  if (!config.wavespeed.apiKey) {
    throw new Error('WaveSpeed API key not configured');
  }

  const prompt = nodeConfig.prompt || '';
  const negativePrompt = nodeConfig.negative_prompt || '';
  const aspectRatio = nodeConfig.aspect_ratio || '1:1';
  const count = nodeConfig.count || 1;
  const size = SEEDREAM_SIZES[aspectRatio] || SEEDREAM_SIZES['1:1'];

  let imagePrompt = prompt;
  if (negativePrompt) {
    imagePrompt += ` Avoid: ${negativePrompt}`;
  }

  // Handle reference image from upstream node
  let referenceImages = [];
  if (inputs.reference_image) {
    const compressed = await compressImage(inputs.reference_image, { maxDimension: 1024, quality: 75 });
    referenceImages = [compressed];
    imagePrompt = `Use these reference images as style guide. ${imagePrompt}`;
  }

  // Use img2img endpoint when reference images are provided (matches seedream.js route)
  const apiEndpoint = referenceImages.length > 0 ? WAVESPEED_IMG2IMG_URL : WAVESPEED_TEXT2IMG_URL;

  const requestBody = referenceImages.length > 0
    ? { prompt: imagePrompt, images: referenceImages, size, enable_base64_output: true, enable_sync_mode: true }
    : { prompt: imagePrompt, size, n: Math.min(count, 4), enable_base64_output: true, enable_sync_mode: true };

  const agencyId = ctx.workflow?.agency_id || 'unknown';
  const response = await wavespeedQueue.add(agencyId, () =>
    fetchWithRetry(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.wavespeed.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`WaveSpeed API error: ${response.status} - ${responseText}`);
  }

  const result = JSON.parse(responseText);
  let images = extractWavespeedImages(result);

  // If async response, poll for result
  if (images.length === 0 && result.id && !result.data) {
    const taskResult = await pollWavespeedResult(result.id);
    images = extractWavespeedImages(taskResult);
  }

  if (images.length === 0) {
    throw new Error('No images generated by Seedream');
  }

  return images;
}

/**
 * Generate images with Nano Banana (Gemini 3) via OpenRouter.
 * No LoRA support.
 */
async function generateWithNanoBanana(nodeConfig, inputs, ctx) {
  if (!config.openrouter.apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const prompt = nodeConfig.prompt || '';
  const aspectRatio = nodeConfig.aspect_ratio || '1:1';
  const count = nodeConfig.count || 1;

  const images = [];

  // Handle reference image from upstream
  let compressedRefs = [];
  if (inputs.reference_image) {
    compressedRefs = await compressImages([inputs.reference_image], { maxDimension: 1536, quality: 80 });
  }

  for (let i = 0; i < count; i++) {
    let messages = [];

    if (compressedRefs.length > 0) {
      const contentParts = compressedRefs.map(img => ({
        type: 'image_url',
        image_url: { url: img },
      }));
      contentParts.push({ type: 'text', text: `Use these as reference. ${prompt}` });
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const response = await fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.frontendUrl,
        'X-Title': 'Agency Studio',
      },
      body: JSON.stringify({
        model: NANO_BANANA_MODEL,
        messages,
        modalities: ['image', 'text'],
        image_config: { aspect_ratio: aspectRatio },
      }),
    }, { maxRetries: 3, initialBackoffMs: 2000 });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;

    // Extract image from response (matches nanoBanana.js route formats)
    let imageFound = false;

    if (message?.images?.[0]) {
      const img = message.images[0];
      const imageUrl = img.image_url?.url || img.url;
      if (imageUrl) {
        images.push(imageUrl);
        imageFound = true;
      }
    }

    if (!imageFound && Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part.inline_data?.data) {
          const mimeType = part.inline_data.mime_type || 'image/png';
          images.push(`data:${mimeType};base64,${part.inline_data.data}`);
          imageFound = true;
          break;
        }
        if (part.type === 'image_url' && part.image_url?.url) {
          images.push(part.image_url.url);
          imageFound = true;
          break;
        }
      }
    }

    // Delay between multiple requests
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (images.length === 0) {
    throw new Error('No images generated by Nano Banana');
  }

  return images;
}


// =============================================
// Video Generation — Model Backends
// =============================================

async function generateWithKling(nodeConfig, inputs) {
  const input = {
    prompt: nodeConfig.prompt || '',
    aspect_ratio: nodeConfig.aspect_ratio || '16:9',
    duration: nodeConfig.duration || 5,
    guidance_scale: 0.5,
  };

  if (inputs.start_image) {
    input.start_image = inputs.start_image;
  }

  const output = await runModel(KLING_MODEL, input);
  return extractOutputUrl(output) || output;
}

async function generateWithVeo(nodeConfig, inputs) {
  const input = {
    prompt: nodeConfig.prompt || '',
    aspect_ratio: nodeConfig.aspect_ratio || '16:9',
    duration: nodeConfig.duration || 8,
    resolution: '720p',
    generate_audio: true,
  };

  if (inputs.start_image) {
    input.image = await compressImage(inputs.start_image, { maxDimension: 1024, quality: 75 });
  }

  const output = await runModel(VEO_MODEL, input);
  return extractOutputUrl(output) || output;
}

async function generateWithWan(nodeConfig, inputs) {
  const input = {
    prompt: nodeConfig.prompt || '',
    resolution: '480p',
    num_frames: 81,
    frames_per_second: 16,
    sample_steps: 30,
    sample_shift: 5,
    go_fast: false,
  };

  if (inputs.start_image) {
    input.image = await compressImage(inputs.start_image, { maxDimension: 1024, quality: 75 });
  }

  const output = await runModel(WAN_MODEL, input);
  return extractOutputUrl(output) || output;
}


// =============================================
// Public Executor Functions
// =============================================

/**
 * Execute an image generation node.
 * Dispatches to the correct model backend.
 * Qwen auto-injects LoRA from the run's model.
 */
async function executeGenerateImage(nodeConfig, inputs, ctx) {
  const genModel = nodeConfig.model || 'seedream';

  logger.info('Workflow: executeGenerateImage', {
    model: genModel,
    prompt: (nodeConfig.prompt || '').substring(0, 50),
  });

  let images;
  switch (genModel) {
    case 'qwen':
      images = await generateWithQwen(nodeConfig, inputs, ctx);
      break;
    case 'seedream':
      images = await generateWithSeedream(nodeConfig, inputs, ctx);
      break;
    case 'nanoBanana':
      images = await generateWithNanoBanana(nodeConfig, inputs, ctx);
      break;
    default:
      throw new Error(`Unknown image generation model: ${genModel}`);
  }

  return { images };
}

/**
 * Execute a video generation node.
 */
async function executeGenerateVideo(nodeConfig, inputs, ctx) {
  const genModel = nodeConfig.model || 'kling';

  logger.info('Workflow: executeGenerateVideo', {
    model: genModel,
    prompt: (nodeConfig.prompt || '').substring(0, 50),
  });

  let videoUrl;
  switch (genModel) {
    case 'kling':
      videoUrl = await generateWithKling(nodeConfig, inputs);
      break;
    case 'veo':
      videoUrl = await generateWithVeo(nodeConfig, inputs);
      break;
    case 'wan':
      videoUrl = await generateWithWan(nodeConfig, inputs);
      break;
    default:
      throw new Error(`Unknown video generation model: ${genModel}`);
  }

  return { video: typeof videoUrl === 'string' ? videoUrl : String(videoUrl) };
}

/**
 * Execute background removal via Replicate.
 */
async function executeEditBgRemove(inputs, ctx) {
  if (!inputs.image) {
    throw new Error('No input image provided for background removal');
  }

  const compressedImage = await compressImage(inputs.image, { maxDimension: 1536, quality: 80 });
  const output = await runModel(BG_REMOVER_MODEL, { image: compressedImage });
  const resultUrl = extractOutputUrl(output) || output;

  return { image: resultUrl };
}

/**
 * Execute AI caption generation via OpenRouter (DeepSeek).
 */
async function executeAiCaption(nodeConfig, inputs, ctx) {
  if (!config.openrouter.apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const imageUrl = inputs.media;
  if (!imageUrl) {
    throw new Error('No input media provided for captioning');
  }

  const instruction = nodeConfig.instruction || 'Write a caption for this image.';
  const tone = nodeConfig.tone || 'casual';
  const maxLength = nodeConfig.max_length || 280;

  const userMessage = `${instruction}\n\nTone: ${tone}\nMax length: ${maxLength} characters.`;

  const messages = [
    {
      role: 'system',
      content: 'You are an AI assistant for a creative agency. Help with image captioning, content descriptions, and creative writing. Be concise and professional.',
    },
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: userMessage },
      ],
    },
  ];

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openrouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.frontendUrl,
      'X-Title': 'Agency Studio',
    },
    body: JSON.stringify({ model: CHAT_MODEL, messages }),
  }, { maxRetries: 3, initialBackoffMs: 2000 });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const aiMessage = result.choices?.[0]?.message?.content;

  if (!aiMessage) {
    throw new Error('No response from AI model');
  }

  return {
    text: aiMessage,
    media: imageUrl, // Pass through
  };
}

/**
 * Save media to the gallery.
 */
async function executeSaveToGallery(nodeConfig, inputs, ctx) {
  const { run, model: agencyModel, workflow } = ctx;
  const mediaUrl = inputs.media;
  if (!mediaUrl) {
    throw new Error('No media provided to save');
  }

  const isVideo = typeof mediaUrl === 'string' && (
    mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('video')
  );

  try {
    await supabaseAdmin
      .from('gallery_items')
      .insert({
        agency_id: workflow.agency_id,
        user_id: run.started_by,
        model_id: agencyModel?.id || null,
        url: mediaUrl,
        type: isVideo ? 'video' : 'image',
        source: 'generated',
        title: inputs.caption || null,
        tags: nodeConfig.tags || [],
      });
  } catch (err) {
    logger.error('Workflow: Failed to save to gallery:', err);
    // Non-fatal — don't fail the workflow for a gallery save error
  }

  return { media: mediaUrl };
}

module.exports = {
  executeGenerateImage,
  executeGenerateVideo,
  executeEditBgRemove,
  executeAiCaption,
  executeSaveToGallery,
};
