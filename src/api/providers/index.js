import { OpenAIAdapter } from './openai'

const ADAPTERS = {
  'openai': OpenAIAdapter,
  'banana-pro': OpenAIAdapter,  // 暂时使用 OpenAI 适配器
  'custom': OpenAIAdapter       // 自定义默认使用 OpenAI 格式
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

// 重新导出基类供自定义使用
export { BaseProviderAdapter } from './base'
