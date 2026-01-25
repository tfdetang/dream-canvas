import { BaseProviderAdapter } from './base'

export class OpenAIAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model = 'dall-e-3', size, quality, referenceImages = [] }) {
    // OpenAI DALL-E 不支持参考图
    if (referenceImages.length > 0) {
      throw new Error('OpenAI DALL-E does not support reference images. Please use image editing API instead.')
    }

    const response = await this.sendRequest('/images/generations', {
      model,
      prompt,
      n: 1,
      size: size || '1024x1024',
      quality: quality || 'standard',
      response_format: 'url'
    })

    return response.data.map(img => ({ url: img.url }))
  }
}
