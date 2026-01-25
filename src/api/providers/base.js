import { request } from '@/utils'

/**
 * 基础供应商适配器
 * 所有具体适配器必须继承此类并实现 generateImage 方法
 */
export class BaseProviderAdapter {
  constructor(config) {
    this.config = config  // { apiKey, baseUrl, models }
    this.validateConfig(config)
  }

  /**
   * 验证配置（子类可重写）
   */
  validateConfig(config) {
    if (!config.apiKey) {
      throw new Error('API Key is required')
    }
    if (!config.baseUrl) {
      throw new Error('Base URL is required')
    }
  }

  /**
   * 图像生成（必须由子类实现）
   * @param {Object} params
   * @param {string} params.prompt - 文本提示词
   * @param {string} params.model - 模型 ID
   * @param {string} params.size - 图片尺寸
   * @param {string} params.quality - 图片质量（如果支持）
   * @param {Array} params.referenceImages - 参考图列表 [{ url, base64 }]
   * @returns {Promise<Array>} - [{ url: '...' }, ...]
   */
  async generateImage(params) {
    throw new Error('generateImage must be implemented by subclass')
  }

  /**
   * 发送 HTTP 请求（通用方法）
   */
  async sendRequest(endpoint, data, headers = {}) {
    return await request({
      url: `${this.config.baseUrl}${endpoint}`,
      method: 'POST',
      data,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      }
    })
  }
}
