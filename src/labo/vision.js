import {
  VISION_FOOD_CLASSIFIER_MODEL_ID,
  VISION_FOOD_DEPTH_MODEL_ID,
  VISION_FOOD_TOPK,
} from '../features'

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

function cacheKey(task, modelId, runtimeHint) {
  return `${task}::${String(modelId).trim()}::${normalizeRuntime(runtimeHint)}`
}

async function createImagePipeline(task, modelId, runtimeHint) {
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
      const instance = await pipeline(task, modelId, options)
      return {
        instance,
        runtime: attempt === 'auto' ? 'wasm' : attempt,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('MODEL_INIT_FAILED')
}

async function getPipeline(task, modelId, runtimeHint = 'auto') {
  const key = cacheKey(task, modelId, runtimeHint)
  if (!pipelineCache.has(key)) {
    pipelineCache.set(key, createImagePipeline(task, modelId, runtimeHint))
  }
  return pipelineCache.get(key)
}

export async function getClassifier(modelId = VISION_FOOD_CLASSIFIER_MODEL_ID, runtimeHint = 'auto') {
  return getPipeline('image-classification', modelId, runtimeHint)
}

export async function getDepthEstimator(modelId = VISION_FOOD_DEPTH_MODEL_ID, runtimeHint = 'auto') {
  return getPipeline('depth-estimation', modelId, runtimeHint)
}

export async function preloadVisionFoodModels(options = {}) {
  const classifierModelId = options.classifierModelId || VISION_FOOD_CLASSIFIER_MODEL_ID
  const depthModelId = options.depthModelId || VISION_FOOD_DEPTH_MODEL_ID
  const runtimeHint = options.runtime ?? 'auto'

  const [classifier, depth] = await Promise.all([
    getClassifier(classifierModelId, runtimeHint),
    getDepthEstimator(depthModelId, runtimeHint),
  ])

  return {
    classifierModelId,
    classifierRuntime: classifier.runtime,
    depthModelId,
    depthRuntime: depth.runtime,
  }
}

export function resetClassifierCache() {
  pipelineCache.clear()
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function mean(values) {
  const list = values.filter((value) => Number.isFinite(value))
  if (!list.length) return 0
  return list.reduce((sum, value) => sum + value, 0) / list.length
}

async function loadImage(source) {
  return await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    image.src = source
  })
}

async function extractImageMetrics(source) {
  const image = await loadImage(source)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const sampleMax = 256
  const ratio = Math.min(1, sampleMax / Math.max(width, height))
  const w = Math.max(32, Math.round(width * ratio))
  const h = Math.max(32, Math.round(height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  let nonNeutral = 0
  let centerMass = 0
  let total = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max === 0 ? 0 : (max - min) / max
      const brightness = (r + g + b) / 3 / 255
      const dx = (x / Math.max(1, w - 1)) - 0.5
      const dy = (y / Math.max(1, h - 1)) - 0.5
      const centerWeight = Math.max(0, 1 - ((Math.sqrt((dx * dx) + (dy * dy)) / 0.72)))

      if (saturation > 0.16 && brightness > 0.12 && brightness < 0.95) {
        nonNeutral++
        centerMass += centerWeight
      }
      total++
    }
  }

  return {
    width,
    height,
    aspectRatio: round1(width / Math.max(1, height)),
    colorCoverage: clamp(nonNeutral / Math.max(1, total), 0, 1),
    centralFoodness: clamp(centerMass / Math.max(1, nonNeutral), 0, 1),
  }
}

function analyzeDepthMap(predictedDepth) {
  const dims = predictedDepth?.dims ?? []
  const data = predictedDepth?.data
  if (!data || dims.length < 2) {
    return {
      coverage: 0.45,
      depthStrength: 0.5,
      compactness: 0.65,
      volumeScore: 0.5,
    }
  }

  const height = dims.at(-2)
  const width = dims.at(-1)
  let min = Infinity
  let max = -Infinity
  for (const value of data) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const span = Math.max(1e-6, max - min)

  let selected = 0
  let weightedDepth = 0
  let xMin = width
  let yMin = height
  let xMax = 0
  let yMax = 0
  let centerHits = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const normalized = (data[idx] - min) / span
      const dx = (x / Math.max(1, width - 1)) - 0.5
      const dy = (y / Math.max(1, height - 1)) - 0.5
      const radial = Math.sqrt((dx * dx) + (dy * dy))
      const centerWeight = clamp(1 - (radial / 0.68), 0, 1)
      const foregroundScore = (normalized * 0.75) + (centerWeight * 0.25)

      if (foregroundScore >= 0.58) {
        selected++
        weightedDepth += normalized
        xMin = Math.min(xMin, x)
        yMin = Math.min(yMin, y)
        xMax = Math.max(xMax, x)
        yMax = Math.max(yMax, y)
        centerHits += centerWeight
      }
    }
  }

  const total = Math.max(1, width * height)
  const coverage = clamp(selected / total, 0.12, 0.92)
  const depthStrength = clamp(selected ? weightedDepth / selected : 0.5, 0.2, 0.95)
  const boxArea = Math.max(1, (xMax - xMin + 1) * (yMax - yMin + 1))
  const compactness = clamp(selected / boxArea, 0.25, 1)
  const centerBias = clamp(centerHits / Math.max(1, selected), 0.2, 1)
  const volumeScore = clamp((coverage * 0.55) + (depthStrength * 0.3) + (compactness * 0.1) + (centerBias * 0.05), 0.2, 1)

  return {
    coverage: round1(coverage),
    depthStrength: round1(depthStrength),
    compactness: round1(compactness),
    centerBias: round1(centerBias),
    volumeScore: round1(volumeScore),
  }
}

export async function classifyMealImage(source, options = {}) {
  const modelId = options.modelId || VISION_FOOD_CLASSIFIER_MODEL_ID
  const topk = Number(options.topk) || VISION_FOOD_TOPK
  const runtimeHint = options.runtime ?? 'auto'

  const { instance, runtime } = await getClassifier(modelId, runtimeHint)
  const raw = await instance(source, { topk })
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

export async function analyzeMealVision(source, options = {}) {
  const classifierModelId = options.classifierModelId || VISION_FOOD_CLASSIFIER_MODEL_ID
  const depthModelId = options.depthModelId || VISION_FOOD_DEPTH_MODEL_ID
  const topk = Number(options.topk) || VISION_FOOD_TOPK
  const runtimeHint = options.runtime ?? 'auto'

  const imageMetricsPromise = extractImageMetrics(source)
  const classifierPromise = getClassifier(classifierModelId, runtimeHint)
  const depthPromise = getDepthEstimator(depthModelId, runtimeHint)

  const [imageMetrics, classifierHandle, depthHandle] = await Promise.all([
    imageMetricsPromise,
    classifierPromise,
    depthPromise,
  ])

  const [classificationRaw, depthRaw] = await Promise.all([
    classifierHandle.instance(source, { topk }),
    depthHandle.instance(source),
  ])

  const predictions = (Array.isArray(classificationRaw) ? classificationRaw : [classificationRaw])
    .map((pred) => ({
      label: String(pred?.label ?? '').trim(),
      score: Number(pred?.score ?? 0),
    }))
    .filter((pred) => pred.label)
    .sort((a, b) => b.score - a.score)

  const depthStats = analyzeDepthMap(depthRaw?.predicted_depth)
  const volumeScore = clamp(
    (depthStats.volumeScore * 0.68) +
    (imageMetrics.colorCoverage * 0.18) +
    (imageMetrics.centralFoodness * 0.14),
    0.2,
    1
  )

  return {
    predictions,
    classifierModelId,
    classifierRuntime: classifierHandle.runtime,
    depthModelId,
    depthRuntime: depthHandle.runtime,
    imageMetrics,
    depth: {
      coverage: depthStats.coverage,
      depthStrength: depthStats.depthStrength,
      compactness: depthStats.compactness,
      centerBias: depthStats.centerBias,
      volumeScore: round1(volumeScore),
    },
  }
}
