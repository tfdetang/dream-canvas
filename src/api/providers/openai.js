import { BaseProviderAdapter } from './base'

export class OpenAIAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model = 'dall-e-3', size, quality, referenceImages = [] }) {
    // 验证参数
    this.validateParams({ prompt, model, referenceImages })

    // OpenAI DALL-E 不支持参考图
    if (referenceImages.length > 0) {
      throw new Error('OpenAI DALL-E 暂不支持参考图片，请使用图像编辑 API')
    }

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
}
