import { OpenAIAdapter } from './openai'
import { DoubaoAdapter } from './doubao'

// API 格式类型定义
export const API_FORMATS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  DOUBAO: 'doubao'
}

const ADAPTERS = {
  'openai': OpenAIAdapter,
  'banana-pro': OpenAIAdapter,
  'doubao': DoubaoAdapter
}

/**
 * 创建供应商适配器
 * @param {string} providerId - 供应商 ID
 * @param {Object} config - 配置 { apiKey, baseUrl, models }
 * @returns {BaseProviderAdapter} - 适配器实例
 */
export function createProviderAdapter(providerId, config) {
  const AdapterClass = ADAPTERS[providerId] || OpenAIAdapter
  return new AdapterClass(config)
}

/**
 * 根据模型创建适配器（支持模型级别的API格式）
 * @param {string} providerId - 供应商 ID
 * @param {string} modelId - 模型 ID
 * @param {Object} config - 配置 { apiKey, baseUrl, models }
 * @returns {BaseProviderAdapter} - 适配器实例
 */
export function createAdapterForModel(providerId, modelId, config) {
  // 查找模型配置
  const model = config.models?.find(m => m.id === modelId)

  if (!model) {
    // 如果找不到模型，使用供应商默认适配器
    return createProviderAdapter(providerId, config)
  }

  // 根据模型的 apiFormat 选择适配器
  const apiFormat = model.apiFormat || 'openai'

  switch (apiFormat) {
    case API_FORMATS.GEMINI:
      // TODO: 返回 Gemini 适配器
      return createProviderAdapter(providerId, config)
    case API_FORMATS.DOUBAO:
      // TODO: 返回豆包适配器
      return createProviderAdapter(providerId, config)
    case API_FORMATS.OPENAI:
    default:
      return createProviderAdapter(providerId, config)
  }
}

// 重新导出基类供自定义使用
export { BaseProviderAdapter } from './base'
