import { request } from '@/utils'
import { BaseProviderAdapter } from './base'

export class OpenAIAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model = 'dall-e-3', size, quality, referenceImages = [] }) {
    // 验证参数
    this.validateParams({ prompt, model, referenceImages })

    // 如果有参考图片，尝试使用图生图功能
    if (referenceImages.length > 0) {
      return this.generateImageWithReference({ prompt, model, size, referenceImages })
    }

    // 标准文生图
    const response = await this.sendRequest('/images/generations', {
      model,
      prompt,
      n: 1,
      size: size || '1024x1024',
      quality: quality || 'standard',
      response_format: 'url'
    })

    // 验证响应
    this.validateResponse(response, 'data')

    return response.data.map(img => ({ url: img.url }))
  }

  /**
   * 使用参考图片生成（图生图）
   */
  async generateImageWithReference({ prompt, model, size, referenceImages }) {
    try {
      const formData = new FormData()

      // 添加模型
      formData.append('model', model)

      // 添加提示词
      formData.append('prompt', prompt)

      // 添加所有参考图片（支持多张）
      for (let i = 0; i < referenceImages.length; i++) {
        const refImage = referenceImages[i]

        if (refImage.base64) {
          // base64格式，转换为Blob
          const base64Data = refImage.base64.split(',')[1] || refImage.base64
          const blob = this.base64ToBlob(base64Data)
          formData.append('image', blob, `image_${i}.png`)
        } else if (refImage.url) {
          // URL格式，需要先下载转换为Blob
          const blob = await this.urlToBlob(refImage.url)
          formData.append('image', blob, `image_${i}.png`)
        }
      }

      // 添加响应格式
      formData.append('response_format', 'url')

      // 添加可选参数
      if (size) {
        formData.append('image_size', size)
      }

      // 使用专门的multipart请求方法
      const response = await this.sendMultipartRequest('/images/edits', formData)

      // 验证响应
      this.validateResponse(response, 'data')

      return response.data.map(img => ({ url: img.url }))
    } catch (error) {
      // 如果edits API失败，回退到标准生成，在提示词中描述参考图片
      console.warn('[OpenAI] Edits API failed, falling back to text-only generation:', error.message)
      return this.fallbackToTextGeneration({ prompt, model, size, quality: 'standard' })
    }
  }

  /**
   * 回退到纯文本生成（在提示词中说明有参考图片）
   */
  async fallbackToTextGeneration({ prompt, model, size, quality }) {
    const enhancedPrompt = `${prompt}\n\n(Note: Based on a reference image)`

    const response = await this.sendRequest('/images/generations', {
      model,
      prompt: enhancedPrompt,
      n: 1,
      size: size || '1024x1024',
      quality: quality || 'standard',
      response_format: 'url'
    })

    // 验证响应
    this.validateResponse(response, 'data')

    return response.data.map(img => ({ url: img.url }))
  }

  /**
   * 将base64转换为Blob
   */
  base64ToBlob(base64) {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: 'image/png' })
  }

  /**
   * 将URL转换为Blob
   */
  async urlToBlob(url) {
    const response = await fetch(url)
    const blob = await response.blob()
    return blob
  }

  /**
   * 发送multipart/form-data请求
   * 不使用request工具，直接使用axios以支持FormData
   */
  async sendMultipartRequest(endpoint, formData) {
    try {
      const axios = (await import('axios')).default

      const response = await axios.post(
        `${this.config.baseUrl}${endpoint}`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            // 不要手动设置Content-Type，让浏览器自动设置并添加boundary
          },
          transformRequest: [(data) => data] // 防止axios重新序列化FormData
        }
      )

      return response.data
    } catch (error) {
      // 增强错误信息
      throw this.enhanceError(error)
    }
  }
}
