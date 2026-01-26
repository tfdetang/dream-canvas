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

      // 添加提示词
      formData.append('prompt', prompt)

      // 添加模型
      formData.append('model', model)

      console.log('[OpenAI] Processing', referenceImages.length, 'reference images...')

      // 添加所有参考图片（支持多张）
      // 注意：所有图片都使用相同的字段名 'image'，服务器会接收多个同名字段
      for (let i = 0; i < referenceImages.length; i++) {
        const refImage = referenceImages[i]

        if (refImage.base64) {
          // base64格式，转换为Blob
          const base64Data = refImage.base64.split(',')[1] || refImage.base64
          const mimeType = this.getMimeTypeFromBase64(refImage.base64)
          const blob = this.base64ToBlob(base64Data, mimeType)
          const filename = `reference_${i}.${this.getExtensionFromMimeType(mimeType)}`

          formData.append('image', blob, filename)
          console.log(`[OpenAI] Appended image ${i + 1}:`, {
            type: 'base64',
            mimeType,
            filename,
            size: blob.size
          })
        } else if (refImage.url) {
          // URL格式，需要先下载转换为Blob
          const blob = await this.urlToBlob(refImage.url)
          const extension = this.getExtensionFromUrl(refImage.url) || this.getExtensionFromMimeType(blob.type)
          const filename = `reference_${i}.${extension}`

          formData.append('image', blob, filename)
          console.log(`[OpenAI] Appended image ${i + 1}:`, {
            type: 'url',
            url: refImage.url,
            filename,
            size: blob.size,
            blobType: blob.type
          })
        }
      }

      // 添加可选参数
      if (size && size !== 'auto') {
        formData.append('size', size)
      }

      // 添加响应格式
      formData.append('response_format', 'url')

      // 打印 FormData 内容用于调试
      console.log('[OpenAI] FormData entries:')
      for (const [key, value] of formData.entries()) {
        if (value instanceof Blob) {
          console.log(`  ${key}: Blob(${value.size} bytes, ${value.type})`)
        } else {
          console.log(`  ${key}: ${value}`)
        }
      }

      console.log('[OpenAI] Sending edits request with', referenceImages.length, 'reference images')

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
  base64ToBlob(base64, mimeType = 'image/png') {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  /**
   * 从 base64 字符串中提取 MIME 类型
   */
  getMimeTypeFromBase64(base64) {
    const match = base64.match(/^data:([^;]+);/)
    return match ? match[1] : 'image/png'
  }

  /**
   * 从 MIME 类型获取文件扩展名
   */
  getExtensionFromMimeType(mimeType) {
    const mimeMap = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp'
    }
    return mimeMap[mimeType] || 'png'
  }

  /**
   * 从 URL 中提取文件扩展名
   */
  getExtensionFromUrl(url) {
    try {
      const pathname = new URL(url).pathname
      const match = pathname.match(/\.([^.]+)$/)
      return match ? match[1] : null
    } catch {
      return null
    }
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
   * 使用原生 fetch API 以确保 FormData 正确发送（模仿 Cherry Studio）
   */
  async sendMultipartRequest(endpoint, formData) {
    try {
      const url = `${this.config.baseUrl}${endpoint}`

      const headers = {
        'Authorization': `Bearer ${this.config.apiKey}`
        // 不设置 Content-Type，让浏览器自动设置并添加 boundary
      }

      console.log('[OpenAI] Sending request to:', url)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }))
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      // 增强错误信息
      throw this.enhanceError(error)
    }
  }
}
