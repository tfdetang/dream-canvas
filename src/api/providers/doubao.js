import { BaseProviderAdapter } from './base'

export class DoubaoAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size, referenceImages = [], customParams = {} }) {
    // 验证参数
    this.validateParams({ prompt, model, referenceImages })

    const data = {
      model,
      prompt,
      size: size || '1024x1024',
      n: 1,
      ...customParams  // 🎯 合并自定义参数
    }

    // 豆包支持参考图（通过 image_url 传递）
    if (referenceImages.length > 0) {
      // 优先使用 URL，如果没有则使用 base64
      const refImage = referenceImages[0]
      if (refImage.url) {
        data.image_url = refImage.url
      } else if (refImage.base64) {
        data.image_url = refImage.base64
      }
    }

    console.log('[Doubao] Request data:', data)
    console.log('[Doubao] Custom params:', customParams)

    const response = await this.sendRequest('/images/generations', data)

    // 验证响应
    this.validateResponse(response, 'data')

    return response.data.map(img => ({ url: img.url }))
  }
}
