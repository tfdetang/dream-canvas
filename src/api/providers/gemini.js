import { BaseProviderAdapter } from './base'

export class GeminiAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size, referenceImages = [] }) {
    // Gemini 使用不同的 endpoint 格式
    const endpoint = `/models/${model}:generateContent`

    // 构建内容数组
    const parts = []

    // 添加文本提示词
    parts.push({
      text: prompt
    })

    // 添加参考图片（Gemini 使用 base64 inlineData）
    if (referenceImages.length > 0) {
      for (const refImage of referenceImages) {
        if (refImage.base64) {
          // 提取 base64 数据（移除 data:image/xxx;base64, 前缀）
          const base64Data = refImage.base64.split(',')[1] || refImage.base64
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          })
        }
      }
    }

    const data = {
      contents: [
        {
          parts
        }
      ],
      generationConfig: {
        // 将 size 转换为 aspectRatio
        aspectRatio: this.sizeToAspectRatio(size || '1024x1024')
      }
    }

    const response = await this.sendRequest(endpoint, data)

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

    throw new Error('No image generated in Gemini response')
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
