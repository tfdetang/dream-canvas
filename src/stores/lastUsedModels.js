/**
 * Last Used Models Store
 * 记录每种节点类型上次使用的模型
 */
import { ref } from 'vue'
import { MODEL_TYPES } from '@/config/imageProviders'

const STORAGE_KEY = 'dream-canvas-last-used-models'

// 上次使用的模型 (按节点类型存储)
export const lastUsedModels = ref({
  imageConfig: null,  // 文生图节点
  videoConfig: null   // 视频配置节点
})

// 从 localStorage 加载
const loadLastUsedModels = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      lastUsedModels.value = {
        imageConfig: data.imageConfig || null,
        videoConfig: data.videoConfig || null
      }
    }
  } catch (error) {
    console.error('[LastUsedModels] Failed to load:', error)
  }
}

// 保存到 localStorage
const saveLastUsedModels = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastUsedModels.value))
  } catch (error) {
    console.error('[LastUsedModels] Failed to save:', error)
  }
}

/**
 * 设置上次使用的模型
 * @param {string} nodeType - 节点类型 (imageConfig/videoConfig)
 * @param {string} modelId - 模型ID
 */
export const setLastUsedModel = (nodeType, modelId) => {
  if (!modelId) return

  lastUsedModels.value[nodeType] = modelId
  saveLastUsedModels()
  console.log(`[LastUsedModels] Set ${nodeType}:`, modelId)
}

/**
 * 获取上次使用的模型
 * @param {string} nodeType - 节点类型
 * @returns {string|null} 模型ID
 */
export const getLastUsedModel = (nodeType) => {
  return lastUsedModels.value[nodeType] || null
}

/**
 * 获取默认模型 (优先上次使用，否则返回第一个已配置的模型)
 * @param {string} nodeType - 节点类型
 * @param {Array} availableModels - 可用模型列表（已过滤为已启用的供应商）
 * @param {string} modelType - 模型类型 (IMAGE/VIDEO)
 * @returns {string|null} 模型ID
 */
export const getDefaultModel = (nodeType, availableModels, modelType) => {
  if (!availableModels || availableModels.length === 0) {
    console.warn(`[LastUsedModels] No available models for ${nodeType}`)
    return null
  }

  // 1. 检查上次使用的模型是否还在可用列表中
  const lastUsed = getLastUsedModel(nodeType)
  if (lastUsed) {
    const isStillAvailable = availableModels.some(m => m.key === lastUsed)
    if (isStillAvailable) {
      console.log(`[LastUsedModels] ✅ Using last used model for ${nodeType}:`, lastUsed)
      return lastUsed
    } else {
      console.log(`[LastUsedModels] ⚠️ Last used model ${lastUsed} no longer available (provider disabled or model removed)`)
    }
  }

  // 2. 返回第一个可用的模型（已经是已配置API key的供应商）
  const firstModel = availableModels[0]?.key
  if (firstModel) {
    console.log(`[LastUsedModels] ✅ Using first available model for ${nodeType}:`, firstModel, `(from ${availableModels[0]?.providerName})`)
    return firstModel
  }

  console.warn(`[LastUsedModels] ⚠️ No models available for ${nodeType}`)
  return null
}

// 初始化
loadLastUsedModels()
