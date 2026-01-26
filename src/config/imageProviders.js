/**
 * 预设图像生成供应商配置
 */

// 模型类型定义
export const MODEL_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video'
}

// 模型类型标签配置
export const MODEL_TYPE_LABELS = {
  [MODEL_TYPES.TEXT]: { label: '文本', color: 'info', icon: '📝' },
  [MODEL_TYPES.IMAGE]: { label: '图像', color: 'success', icon: '🖼️' },
  [MODEL_TYPES.VIDEO]: { label: '视频', color: 'warning', icon: '🎬' }
}

export const PRESET_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    icon: '🤖',
    description: 'GPT 系列语言模型和 DALL-E 图像模型',
    apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/docs/api-reference',
    defaultModels: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        type: MODEL_TYPES.TEXT,
        enabled: true,
        apiFormat: 'openai'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        type: MODEL_TYPES.TEXT,
        enabled: true,
        apiFormat: 'openai'
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        type: MODEL_TYPES.TEXT,
        enabled: false,
        apiFormat: 'openai'
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        type: MODEL_TYPES.TEXT,
        enabled: false,
        apiFormat: 'openai'
      },
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        type: MODEL_TYPES.IMAGE,
        enabled: true,
        quality: ['standard', 'hd'],
        style: ['vivid', 'natural']
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        type: MODEL_TYPES.IMAGE,
        enabled: false
      }
    ]
  },
  {
    id: 'doubao',
    name: '豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: '🫘',
    description: '字节跳动 SeeDream 系列',
    apiKeyPlaceholder: 'xxxxxxxx',
    docUrl: 'https://www.volcengine.com/docs/82379/1099475',
    defaultModels: [
      {
        id: 'doubao-seedream-4-5-251128',
        name: 'SeeDream 4.5',
        type: MODEL_TYPES.IMAGE,
        enabled: true
      }
    ]
  }
]
