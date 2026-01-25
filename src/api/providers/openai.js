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
    const refImage = referenceImages[0]

    // 如果是base64格式，使用edits API
    if (refImage.base64) {
      try {
        const formData = new FormData()

        // 提取base64数据
        const base64Data = refImage.base64.split(',')[1] || refImage.base64
        const blob = this.base64ToBlob(base64Data)

        formData.append('image', blob, 'image.png')
        formData.append('prompt', prompt)
        formData.append('n', '1')
        if (size) {
          formData.append('size', size)
        }

        const response = await this.sendRequestMultipart('/images/edits', formData)

        // 验证响应
        this.validateResponse(response, 'data')

        return response.data.map(img => ({ url: img.url }))
      } catch (error) {
        // 如果edits API失败，回退到标准生成，在提示词中描述参考图片
        console.warn('[OpenAI] Edits API failed, falling back to text-only generation:', error.message)
        return this.fallbackToTextGeneration({ prompt, model, size, quality: 'standard' })
      }
    }

    // 如果是URL，回退到标准生成
    return this.fallbackToTextGeneration({ prompt, model, size, quality: 'standard' })
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
   * 发送multipart/form-data请求
   */
  async sendRequestMultipart(endpoint, formData) {
    return await this.sendRequest(endpoint, formData, {
      'Content-Type': 'multipart/form-data'
    })
  }
}
