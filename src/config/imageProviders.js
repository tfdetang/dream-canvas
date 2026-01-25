/**
 * 预设图像生成供应商配置
 */

export const PRESET_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    icon: '🤖',
    description: 'DALL-E 系列模型',
    apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/docs/api-reference/images',
    defaultModels: [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        type: 'image',
        enabled: false,
        sizes: ['1024x1024', '1024x1792', '1792x1024'],
        quality: ['standard', 'hd'],
        style: ['vivid', 'natural']
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        type: 'image',
        enabled: false,
        sizes: ['256x256', '512x512', '1024x1024']
      }
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    icon: '🔷',
    description: 'Imagen 3 图像生成',
    apiKeyPlaceholder: 'AIzaSyxxxxxxxxxxxxxx',
    docUrl: 'https://ai.google.dev/tutorials/image_generation',
    defaultModels: [
      {
        id: 'imagen-3.0-generate-001',
        name: 'Imagen 3',
        type: 'image',
        enabled: false,
        sizes: ['1024x1024', '1536x1536']
      }
    ]
  },
  {
    id: 'banana-pro',
    name: 'Banana-pro',
    baseUrl: 'https://api.banana-pro.com/v1',
    icon: '🍌',
    description: 'Banana-pro 图像服务',
    apiKeyPlaceholder: 'banana-xxxxxxxx',
    docUrl: '',
    defaultModels: [
      {
        id: 'nano-banana',
        name: 'Nano Banana',
        type: 'image',
        enabled: false,
        sizes: [],
        tips: '尺寸写在提示词中: 尺寸 9:16'
      },
      {
        id: 'nano-banana-pro',
        name: 'Nano Banana Pro',
        type: 'image',
        enabled: false,
        sizes: ['21x9', '16x9', '4x3', '3x2', '1x1', '2x3', '3x4', '9x16', '9x21']
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
        name: '豆包 Seedream 4.5',
        type: 'image',
        enabled: true,
        sizes: ['3024x1296', '2560x1440', '2304x1728', '2496x1664', '2048x2048', '1664x2496', '1728x2304', '1440x2560', '1296x3024'],
        quality: ['standard', '4k'],
        getSizesByQuality: (quality) => {
          // 返回4K尺寸或标准尺寸
          if (quality === '4k') {
            return ['6198x2656', '5404x3040', '4694x3520', '4992x3328', '4096x4096', '3328x4992', '3520x4694', '3040x5404', '2656x6198']
          }
          return ['3024x1296', '2560x1440', '2304x1728', '2496x1664', '2048x2048', '1664x2496', '1728x2304', '1440x2560', '1296x3024']
        }
      },
      {
        id: 'doubao-seedance-1-5-pro_720p',
        name: '豆包视频 720P',
        type: 'video',
        enabled: true,
        ratios: ['16x9', '4x3', '1x1', '3x4', '9x16'],
        durations: [5, 10]
      }
    ]
  },
  {
    id: 'kling',
    name: '可灵',
    baseUrl: 'https://api.klingai.com/v1',
    icon: '🎬',
    description: '可灵视频生成',
    apiKeyPlaceholder: 'xxxxxxxx',
    docUrl: '',
    defaultModels: [
      {
        id: 'kling-video-o1',
        name: '可灵视频 O1',
        type: 'video',
        enabled: true,
        ratios: ['16x9', '4x3', '1x1', '3x4', '9x16'],
        durations: [5, 10]
      }
    ]
  },
  {
    id: 'sora',
    name: 'Sora',
    baseUrl: 'https://api.sora.com/v1',
    icon: '🎥',
    description: 'OpenAI Sora 视频生成',
    apiKeyPlaceholder: 'sora-xxxxxxxx',
    docUrl: 'https://openai.com/sora',
    defaultModels: [
      {
        id: 'sora-2',
        name: 'Sora 2',
        type: 'video',
        enabled: false,
        ratios: ['16x9', '4x3', '1x1', '3x4', '9x16'],
        durations: [5, 10]
      }
    ]
  },
  {
    id: 'wan',
    name: 'Wan',
    baseUrl: 'https://api.wan.com/v1',
    icon: '🌐',
    description: 'Wan 2.6 视频生成',
    apiKeyPlaceholder: 'wan-xxxxxxxx',
    docUrl: '',
    defaultModels: [
      {
        id: 'wan2.6_720p',
        name: 'Wan 2.6 720P',
        type: 'video',
        enabled: true,
        ratios: ['16x9', '4x3', '1x1', '3x4', '9x16'],
        durations: [5, 10]
      }
    ]
  },
  {
    id: 'openai-chat',
    name: 'OpenAI (Chat)',
    baseUrl: 'https://api.openai.com/v1',
    icon: '💬',
    description: 'GPT 系列对话模型',
    apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat',
    defaultModels: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        type: 'text',
        enabled: true
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        type: 'text',
        enabled: false
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        type: 'text',
        enabled: false
      }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    icon: '🔍',
    description: 'DeepSeek 对话模型',
    apiKeyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    docUrl: 'https://platform.deepseek.com/api-docs/',
    defaultModels: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        type: 'text',
        enabled: true
      }
    ]
  },
  {
    id: 'doubao-chat',
    name: '豆包 (Chat)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    icon: '🫘',
    description: '豆包对话模型',
    apiKeyPlaceholder: 'xxxxxxxx',
    docUrl: 'https://www.volcengine.com/docs/82379/1263483',
    defaultModels: [
      {
        id: 'doubao-seed-1-6-flash-250615',
        name: '豆包 Seed Flash',
        type: 'text',
        enabled: true
      }
    ]
  },
  {
    id: 'gemini-chat',
    name: 'Gemini (Chat)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    icon: '🔷',
    description: 'Gemini 对话模型',
    apiKeyPlaceholder: 'AIzaSyxxxxxxxxxxxxxx',
    docUrl: 'https://ai.google.dev/tutorials/chat',
    defaultModels: [
      {
        id: 'gemini-3-pro',
        name: 'Gemini 3 Pro',
        type: 'text',
        enabled: true
      }
    ]
  }
]
