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
      throw new Error('请先在设置中配置 API Key')
    }
    if (!config.baseUrl) {
      throw new Error('Base URL 未配置，请检查供应商设置')
    }
  }

  /**
   * 验证生成参数
   */
  validateParams(params) {
    if (!params.prompt && (!params.referenceImages || params.referenceImages.length === 0)) {
      throw new Error('请提供提示词或参考图片')
    }
    if (!params.model) {
      throw new Error('请选择模型')
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
    try {
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
    } catch (error) {
      // 增强错误信息
      throw this.enhanceError(error)
    }
  }

  /**
   * 增强错误信息，提供更友好的错误提示
   */
  enhanceError(error) {
    const errorMap = {
      401: 'API Key 无效或已过期，请检查配置',
      403: '没有访问权限，请检查 API Key 权限',
      404: 'API 接口不存在，请检查 Base URL 配置',
      429: '请求过于频繁，请稍后再试',
      500: '服务器错误，请稍后再试',
      502: '网关错误，请检查网络连接',
      503: '服务暂时不可用，请稍后再试'
    }

    const statusCode = error.response?.status
    const message = errorMap[statusCode] || error.message || '请求失败'

    return new Error(message)
  }

  /**
   * 验证响应数据
   */
  validateResponse(response, requiredField = 'data') {
    if (!response) {
      throw new Error('未收到响应数据')
    }
    if (!response[requiredField]) {
      throw new Error(`响应数据格式错误：缺少 ${requiredField} 字段`)
    }
    if (!Array.isArray(response[requiredField]) || response[requiredField].length === 0) {
      throw new Error('未生成任何图片')
    }
  }
}
