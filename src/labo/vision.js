import { LABO_DEFAULT_MODEL_ID, LABO_TOPK } from '../features'

const pipelineCache = new Map()

function normalizeRuntime(value) {
  if (value === 'webgpu' || value === 'wasm') return value
  return 'auto'
}

function hasWebGPU() {
  return typeof navigator !== 'undefined' && !!navigator.gpu
}

function buildAttempts(runtimeHint) {
  const hint = normalizeRuntime(runtimeHint)
  if (hint === 'webgpu') return ['webgpu', 'wasm', 'auto']
  if (hint === 'wasm') return ['wasm', 'auto']
  return hasWebGPU() ? ['webgpu', 'wasm', 'auto'] : ['wasm', 'auto']
}

async function createClassifier(modelId, runtimeHint) {
  const { pipeline, env } = await import('@huggingface/transformers')

  env.allowRemoteModels = true
  env.allowLocalModels = true
  env.useBrowserCache = true

  if (env.backends?.onnx?.wasm) {
    const threads = Math.max(1, Math.min(4, navigator?.hardwareConcurrency ?? 2))
    env.backends.onnx.wasm.numThreads = threads
  }

  const attempts = buildAttempts(runtimeHint)
  let lastError = null

  for (const attempt of attempts) {
    try {
      const options = attempt === 'auto' ? {} : { device: attempt }
      const classifier = await pipeline('image-classification', modelId, options)
      return {
        classifier,
        runtime: attempt === 'auto' ? 'wasm' : attempt,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('MODEL_INIT_FAILED')
}

export async function getClassifier(modelId = LABO_DEFAULT_MODEL_ID, runtimeHint = 'auto') {
  const resolvedModel = String(modelId || LABO_DEFAULT_MODEL_ID).trim()
  const resolvedRuntime = normalizeRuntime(runtimeHint)
  const key = `${resolvedModel}::${resolvedRuntime}`
  if (!pipelineCache.has(key)) {
    pipelineCache.set(key, createClassifier(resolvedModel, resolvedRuntime))
  }
  return pipelineCache.get(key)
}

export function resetClassifierCache() {
  pipelineCache.clear()
}

export async function classifyMealImage(source, options = {}) {
  const modelId = options.modelId || LABO_DEFAULT_MODEL_ID
  const topk = Number(options.topk) || LABO_TOPK
  const runtimeHint = options.runtime ?? 'auto'

  const { classifier, runtime } = await getClassifier(modelId, runtimeHint)
  const raw = await classifier(source, { topk })
  const out = Array.isArray(raw) ? raw : [raw]

  return {
    modelId,
    runtime,
    predictions: out
      .map((pred) => ({
        label: String(pred?.label ?? '').trim(),
        score: Number(pred?.score ?? 0),
      }))
      .filter((pred) => pred.label)
      .sort((a, b) => b.score - a.score),
  }
}
