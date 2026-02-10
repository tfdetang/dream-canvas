import { BaseProviderAdapter } from './base'

export class GeminiAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size, referenceImages = [], customParams = {} }) {
    // 验证参数
    this.validateParams({ prompt, model, referenceImages })

    // Gemini 使用不同的 endpoint 格式
    const endpoint = `/models/${model}:generateContent`

    // 构建内容数组（注意：图片必须在文本之前）
    const parts = []

    // 1. 先添加参考图片（Gemini 使用 base64 inlineData）
    if (referenceImages.length > 0) {
      for (const refImage of referenceImages) {
        if (refImage.base64) {
          // 提取 base64 数据（移除 data:image/xxx;base64, 前缀）
          const base64Data = refImage.base64.split(',')[1] || refImage.base64
          // 提取正确的 MIME 类型
          const mimeType = this.getMimeTypeFromBase64(refImage.base64)
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          })
        } else if (refImage.url) {
          // 如果是 URL，需要先转换为 base64
          console.warn('[Gemini] URL reference images need to be converted to base64 first')
        }
      }
    }

    // 2. 再添加文本提示词
    parts.push({
      text: prompt
    })

    // 构建 imageConfig（额外参数放在这里）
    const imageConfig = {}

    // 将 size 转换为 aspectRatio
    if (size) {
      imageConfig.aspectRatio = this.sizeToAspectRatio(size)
    }

    // 合并自定义参数到 imageConfig
    Object.assign(imageConfig, customParams)

    const data = {
      contents: [
        {
          parts,
          role: 'user'  // 添加 role 字段
        }
      ],
      generationConfig: {
        imageConfig,  // 额外参数放在 imageConfig 里
        responseModalities: ['IMAGE']  // 指定返回图片
      }
    }

    console.log('[Gemini] Request data:', JSON.stringify(data, null, 2))
    console.log('[Gemini] Custom params merged into imageConfig:', customParams)

    const response = await this.sendRequest(endpoint, data)

    // 验证响应
    this.validateResponse(response, 'candidates')

    // 解析 Gemini 响应格式
    // Gemini 返回 base64 图片在 response.candidates[0].content.parts[0].inlineData.data
    const candidates = response.candidates || []
    if (candidates.length > 0) {
      const content = candidates[0].content
      const parts = content.parts || []
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          // 将 base64 转换为 data URL 格式
          return [{
            url: `data:image/png;base64,${part.inlineData.data}`,
            base64: `data:image/png;base64,${part.inlineData.data}`
          }]
        }
      }
    }

    throw new Error('Gemini 未生成任何图片，请重试')
  }

  /**
   * 文本生成（Gemini 格式）
   * 支持多模态输入（文本 + 图片）
   */
  async generateText({ prompt, model, customParams = {}, images = [] }) {
    // 验证参数
    this.validateParams({ prompt, model })

    // Gemini 使用不同的 endpoint 格式
    const endpoint = `/models/${model}:generateContent`

    // 构建内容数组（注意：图片必须在文本之前）
    const parts = []

    // 1. 先添加图片（如果有）
    if (images && images.length > 0) {
      for (const img of images) {
        // 提取 base64 数据（移除 data:image/xxx;base64, 前缀）
        const base64Data = img.split(',')[1] || img
        // 提取正确的 MIME 类型
        const mimeType = this.getMimeTypeFromBase64(img)
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        })
      }
    }

    // 2. 再添加文本提示词
    parts.push({
      text: prompt
    })

    // 构建请求数据
    const data = {
      contents: [
        {
          parts,
          role: 'user'
        }
      ]
    }

    // 添加自定义参数到 generationConfig
    if (Object.keys(customParams).length > 0) {
      data.generationConfig = customParams
    }

    console.log('[Gemini] Text generation request (multimodal):', JSON.stringify(data, null, 2))

    const response = await this.sendRequest(endpoint, data)

    // 验证响应
    this.validateResponse(response, 'candidates')

    // 解析 Gemini 响应格式
    const candidates = response.candidates || []
    if (candidates.length > 0) {
      const content = candidates[0].content
      const parts = content.parts || []
      for (const part of parts) {
        if (part.text) {
          return part.text
        }
      }
    }

    throw new Error('Gemini 未生成任何文本，请重试')
  }

  /**
   * 从 base64 字符串中提取 MIME 类型
   */
  getMimeTypeFromBase64(base64) {
    const match = base64.match(/^data:([^;]+);/)
    return match ? match[1] : 'image/png'
  }

  /**
   * 将尺寸转换为 aspectRatio
   * @param {string} size - 格式: "宽x高" (如 "1024x1024", "1024x1792")
   * @returns {string} - aspectRatio (如 "1:1", "9:16")
   */
  sizeToAspectRatio(size) {
    const [width, height] = size.split('x').map(Number)

    // 简化比例
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
    const divisor = gcd(width, height)

    return `${width / divisor}:${height / divisor}`
  }
}
