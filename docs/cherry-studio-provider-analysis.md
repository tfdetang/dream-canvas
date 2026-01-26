# Cherry Studio 多模型供应商系统架构分析

> 基于 Cherry Studio 项目的 Provider 配置系统研究，聚焦图像生成相关实现

## 项目概述

Cherry Studio 是一个支持多 LLM 供应商的桌面客户端，支持 Windows、Mac 和 Linux。它使用 Electron + Vue 3 架构，集成了 Vercel AI SDK 作为底层模型调用框架。

## 一、核心架构设计

### 1.1 三层架构模式

```
┌─────────────────────────────────────────────────────────┐
│              应用层 (Renderer Process)                    │
│  - 前端 UI 配置界面                                        │
│  - Provider 列表管理                                      │
│  - 模型选择器                                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│          Provider Registry (注册与管理层)                 │
│  - ProviderConfig Schema (配置验证)                       │
│  - Registry Management (全局注册器)                       │
│  - Provider Factory (工厂模式)                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│        AI SDK Provider Layer (SDK 适配层)                │
│  - @ai-sdk/openai                                        │
│  - @ai-sdk/anthropic                                     │
│  - @ai-sdk/google                                        │
│  - @ai-sdk/openai-compatible                             │
│  - 自定义 Provider SDK                                    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 文件结构

```
cherry-studio/
├── packages/
│   ├── aiCore/src/core/
│   │   ├── providers/
│   │   │   ├── schemas.ts          # Provider 配置 Schema
│   │   │   ├── registry.ts         # 注册与管理逻辑
│   │   │   ├── RegistryManagement.ts # 全局管理器
│   │   │   ├── types.ts            # TypeScript 类型定义
│   │   │   └── factory.ts          # Provider 工厂方法
│   │   ├── models/
│   │   │   └── ModelResolver.ts    # 模型解析器
│   │   └── runtime/
│   │       └── executor.ts         # 运行时执行器
│   └── shared/config/
│       └── providers.ts            # 共享配置
├── src/renderer/src/
│   ├── config/
│   │   ├── providers.ts            # 前端 Provider 配置
│   │   └── models/                 # 模型配置目录
│   └── types/
│       └── provider.ts             # Provider 类型定义
```

## 二、Provider 配置系统详解

### 2.1 核心配置 Schema (`schemas.ts`)

```typescript
// 基础 Provider IDs (内置)
export const baseProviderIds = [
  'openai',
  'openai-chat',
  'openai-compatible',
  'anthropic',
  'google',
  'xai',
  'azure',
  'azure-responses',
  'deepseek',
  'openrouter',
  'cherryin',
  'cherryin-chat'
] as const

// Provider 配置结构
export const baseProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    creator: createOpenAI,
    supportsImageGeneration: true  // ✅ 支持图像生成
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    creator: createOpenAICompatible,
    supportsImageGeneration: true  // ✅ 支持图像生成
  },
  {
    id: 'google',
    name: 'Google Generative AI',
    creator: createGoogleGenerativeAI,
    supportsImageGeneration: true  // ✅ 支持图像生成
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    creator: createXai,
    supportsImageGeneration: true  // ✅ 支持图像生成
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    creator: createAzure,
    supportsImageGeneration: true  // ✅ 支持图像生成
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    creator: createAnthropic,
    supportsImageGeneration: false // ❌ 不支持图像生成
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    creator: createDeepSeek,
    supportsImageGeneration: false // ❌ 不支持图像生成
  }
] as const
```

### 2.2 动态 Provider 注册

```typescript
// Provider 配置接口
export type ProviderConfig = {
  id: string                    // 唯一标识符
  name: string                  // 显示名称
  creator?: (options: any) => Provider  // 创建函数
  import?: () => Promise<any>   // 动态导入
  creatorFunctionName?: string  // 导入后的函数名
  supportsImageGeneration: boolean  // ✅ 关键：图像生成支持标记
  imageCreator?: Function       // 可选的图像创建函数
  validateOptions?: Function    // 配置验证函数
  aliases?: string[]            // 别名支持
}

// 注册自定义 Provider
export function registerProviderConfig(config: ProviderConfig): boolean {
  // 1. 验证配置
  if (!config || !config.id || !config.name) {
    return false
  }

  // 2. 存储配置
  providerConfigs.set(config.id, config)

  // 3. 处理别名
  if (config.aliases?.length > 0) {
    config.aliases.forEach(alias => {
      providerConfigAliases.set(alias, config.id)
    })
  }

  return true
}
```

### 2.3 三步初始化流程

```typescript
// 步骤 1: 注册配置（仅存储，不创建）
registerProviderConfig({
  id: 'my-custom-provider',
  name: 'My Custom Provider',
  creator: createMyProvider,
  supportsImageGeneration: true
})

// 步骤 2: 创建 Provider 实例
const provider = await createProvider('my-custom-provider', {
  apiKey: 'xxx',
  baseURL: 'https://api.example.com'
})

// 步骤 3: 注册到全局管理器
registerProvider('my-custom-provider', provider)

// 或者一步到位
await createAndRegisterProvider('my-custom-provider', options)
```

## 三、图像生成相关实现

### 3.1 支持图像生成的 Provider

根据 `schemas.ts` 配置，以下 Provider 支持图像生成：

| Provider ID | Provider 名称 | 底层 SDK | 图像生成能力 |
|------------|--------------|---------|------------|
| `openai` | OpenAI | @ai-sdk/openai | ✅ DALL-E 3 |
| `openai-compatible` | OpenAI Compatible | @ai-sdk/openai-compatible | ✅ 兼容接口 |
| `google` | Google Generative AI | @ai-sdk/google | ✅ Imagen |
| `xai` | xAI (Grok) | @ai-sdk/xai | ✅ Grok Image |
| `azure` | Azure OpenAI | @ai-sdk/azure | ✅ Azure DALL-E |
| `openrouter` | OpenRouter | @openrouter/ai-sdk-provider | ✅ 多模型 |
| `cherryin` | CherryIN | @cherrystudio/ai-sdk-provider | ✅ 自有服务 |

### 3.2 模型类型系统

```typescript
// 从 types.ts
export type AiSdkModelType = 'text' | 'image' | 'embedding' | 'transcription' | 'speech'

export const METHOD_MAP = {
  text: 'languageModel',
  image: 'imageModel',           // ✅ 图像模型方法
  embedding: 'textEmbeddingModel',
  transcription: 'transcriptionModel',
  speech: 'speechModel'
} as const

// 获取图像模型
export const getImageModel = (id: string) =>
  globalRegistryManagement.imageModel(id)
```

### 3.3 图像生成调用示例

基于 Vercel AI SDK 的调用模式：

```typescript
import { getImageModel } from '@/core/providers/registry'

// 1. 获取图像模型
const imageModel = getImageModel('openai:dall-e-3')

// 2. 调用生成
const result = await imageModel.generateImage({
  prompt: '一只可爱的猫咪在草地上玩耍',
  n: 1,
  size: '1024x1024',
  quality: 'hd',
  style: 'vivid'
})

// 3. 获取结果
const imageUrl = result.images[0].url
```

## 四、关键设计模式

### 4.1 Provider Factory 模式

```typescript
export async function createProvider(providerId: string, options: any) {
  const config = getProviderConfigByAlias(providerId)

  if (!config) {
    throw new Error(`ProviderConfig not found for id: ${providerId}`)
  }

  let creator: (options: any) => any

  if (config.creator) {
    // 方式 1: 直接使用 creator 函数
    creator = config.creator
  } else if (config.import && config.creatorFunctionName) {
    // 方式 2: 动态导入模块
    const module = await config.import()
    creator = module[config.creatorFunctionName]
  } else {
    throw new Error('No valid creator method')
  }

  return creator(options)
}
```

### 4.2 Registry Management (注册器模式)

```typescript
class RegistryManagement {
  private providers = new Map<string, Provider>()
  private aliases = new Map<string, string>()

  // 注册 Provider（支持别名）
  registerProvider(id: string, provider: Provider, aliases?: string[]) {
    this.providers.set(id, provider)

    if (aliases) {
      aliases.forEach(alias => {
        this.aliases.set(alias, id)
      })
    }
  }

  // 获取图像模型
  imageModel(modelId: string): ImageModel {
    const [providerId, model] = this.parseModelId(modelId)
    const provider = this.getProvider(providerId)

    if (!provider.imageModel) {
      throw new Error(`Provider ${providerId} does not support image generation`)
    }

    return provider.imageModel(model)
  }

  // 解析模型 ID（支持别名）
  private parseModelId(modelId: string): [string, string] {
    const [providerId, ...modelParts] = modelId.split(':')
    const realProviderId = this.aliases.get(providerId) || providerId
    return [realProviderId, modelParts.join(':')]
  }
}
```

### 4.3 Custom Provider 包装模式

```typescript
// OpenAI Chat 变体
{
  id: 'openai-chat',
  creator: (options: OpenAIProviderSettings) => {
    const provider = createOpenAI(options)
    return customProvider({
      fallbackProvider: {
        ...provider,
        languageModel: (modelId: string) => provider.chat(modelId)
      }
    })
  }
}

// Azure Responses 变体
{
  id: 'azure-responses',
  creator: (options: AzureOpenAIProviderSettings) => {
    const provider = createAzure(options)
    return customProvider({
      fallbackProvider: {
        ...provider,
        languageModel: (modelId: string) => provider.responses(modelId)
      }
    })
  }
}
```

## 五、前端 Provider 配置接口

### 5.1 Provider 配置 UI 数据结构

```typescript
// 从 src/renderer/src/config/providers.ts
export interface ProviderUIConfig {
  id: string
  name: string
  avatar?: string          // Provider logo
  apiKey?: string         // API Key 输入
  baseURL?: string        // 自定义端点
  models: ModelConfig[]   // 支持的模型列表
  capabilities: {
    chat: boolean
    imageGeneration: boolean    // ✅ 图像生成能力
    embedding: boolean
    vision: boolean
  }
}

export interface ModelConfig {
  id: string
  name: string
  type: 'text' | 'image' | 'embedding'  // ✅ 模型类型
  maxTokens?: number
  supportVision?: boolean
  imageSize?: string[]    // 图像尺寸选项
}
```

### 5.2 OpenAI Compatible 配置示例

```typescript
{
  id: 'silicon',
  name: 'Silicon Flow',
  type: 'openai-compatible',  // 使用 OpenAI 兼容 SDK
  baseURL: 'https://api.siliconflow.cn/v1',
  models: [
    // 文生图模型
    {
      id: 'black-forest-labs/FLUX.1-schnell',
      name: 'FLUX.1 Schnell',
      type: 'image',
      imageSize: ['1024x1024', '512x512']
    },
    {
      id: 'stabilityai/stable-diffusion-3-5-large',
      name: 'Stable Diffusion 3.5',
      type: 'image'
    },
    // 对话模型
    {
      id: 'deepseek-ai/DeepSeek-V3',
      name: 'DeepSeek V3',
      type: 'text',
      maxTokens: 64000
    }
  ],
  capabilities: {
    chat: true,
    imageGeneration: true,  // ✅ 支持图像生成
    embedding: true,
    vision: false
  }
}
```

## 六、应用到 dream-canvas 项目的建议

### 6.1 架构改进方案

```typescript
// 1. 创建 Provider 配置系统
// src/stores/providers.js

import { ref } from 'vue'

// Provider 注册表
const providers = ref(new Map())

// 注册 Provider
export function registerProvider(config) {
  const {
    id,
    name,
    type,           // 'openai' | 'openai-compatible' | 'google'
    baseURL,
    apiKey,
    models,
    capabilities
  } = config

  providers.value.set(id, {
    id,
    name,
    type,
    baseURL,
    apiKey,
    models: models.filter(m => m.type === 'image'),  // 只保留图像模型
    capabilities
  })
}

// 获取支持图像生成的 Provider
export function getImageProviders() {
  return Array.from(providers.value.values())
    .filter(p => p.capabilities.imageGeneration)
}

// 获取 Provider 的图像模型列表
export function getImageModels(providerId) {
  const provider = providers.value.get(providerId)
  return provider?.models.filter(m => m.type === 'image') || []
}
```

### 6.2 配置文件结构

```javascript
// src/config/imageProviders.js

export const IMAGE_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    apiKeyRequired: true,
    models: [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        type: 'image',
        sizes: ['1024x1024', '1024x1792', '1792x1024'],
        quality: ['standard', 'hd'],
        style: ['vivid', 'natural']
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        type: 'image',
        sizes: ['256x256', '512x512', '1024x1024']
      }
    ]
  },
  {
    id: 'silicon',
    name: 'Silicon Flow (硅基流动)',
    type: 'openai-compatible',
    baseURL: 'https://api.siliconflow.cn/v1',
    apiKeyRequired: true,
    models: [
      {
        id: 'black-forest-labs/FLUX.1-schnell',
        name: 'FLUX.1 Schnell',
        type: 'image',
        sizes: ['1024x1024', '512x512', '768x768'],
        numImages: [1, 2, 4]
      },
      {
        id: 'stabilityai/stable-diffusion-3-5-large',
        name: 'Stable Diffusion 3.5',
        type: 'image',
        sizes: ['1024x1024', '1024x768', '768x1024']
      }
    ]
  },
  {
    id: 'doubao',
    name: '豆包 (字节跳动)',
    type: 'openai-compatible',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyRequired: true,
    models: [
      {
        id: 'doubao-seedream-4-5-251128',
        name: 'SeeDream 4.5',
        type: 'image',
        sizes: ['1024x1024', '2048x2048', '1440x2560', '2560x1440']
      }
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    type: 'google',
    apiKeyRequired: true,
    models: [
      {
        id: 'imagen-3.0-generate-001',
        name: 'Imagen 3',
        type: 'image',
        sizes: ['1024x1024', '1536x1536']
      }
    ]
  },
  {
    id: 'custom',
    name: '自定义接口',
    type: 'openai-compatible',
    baseURL: '',  // 用户配置
    apiKeyRequired: false,
    models: []    // 动态获取
  }
]
```

### 6.3 API 层改造

```javascript
// src/api/imageGeneration.js

import axios from 'axios'
import { getProvider, getModel } from '@/stores/providers'

/**
 * 统一图像生成接口
 * @param {Object} params
 * @param {string} params.providerId - Provider ID
 * @param {string} params.modelId - 模型 ID
 * @param {string} params.prompt - 提示词
 * @param {Object} params.options - 生成选项 (size, quality, etc.)
 */
export async function generateImage({ providerId, modelId, prompt, options = {} }) {
  const provider = getProvider(providerId)
  const model = getModel(providerId, modelId)

  // 根据 Provider 类型构建不同的请求
  switch (provider.type) {
    case 'openai':
      return await generateWithOpenAI(provider, model, prompt, options)

    case 'openai-compatible':
      return await generateWithOpenAICompatible(provider, model, prompt, options)

    case 'google':
      return await generateWithGoogle(provider, model, prompt, options)

    default:
      throw new Error(`Unsupported provider type: ${provider.type}`)
  }
}

// OpenAI 标准接口
async function generateWithOpenAI(provider, model, prompt, options) {
  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: model.id,
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
      quality: options.quality || 'standard',
      style: options.style || 'vivid'
    },
    {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )

  return response.data.data.map(img => ({
    url: img.url,
    b64_json: img.b64_json
  }))
}

// OpenAI 兼容接口（Silicon Flow, 豆包等）
async function generateWithOpenAICompatible(provider, model, prompt, options) {
  const response = await axios.post(
    `${provider.baseURL}/images/generations`,
    {
      model: model.id,
      prompt,
      n: options.n || 1,
      size: options.size || '1024x1024',
      response_format: options.responseFormat || 'url'
    },
    {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )

  return response.data.data.map(img => ({
    url: img.url
  }))
}

// Google Imagen 接口
async function generateWithGoogle(provider, model, prompt, options) {
  // Google 使用不同的 API 格式
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:predict`,
    {
      instances: [{
        prompt
      }],
      parameters: {
        sampleCount: options.n || 1,
        aspectRatio: options.aspectRatio || '1:1'
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )

  return response.data.predictions.map(pred => ({
    url: pred.bytesBase64Encoded
      ? `data:image/png;base64,${pred.bytesBase64Encoded}`
      : pred.url
  }))
}
```

### 6.4 UI 层 Provider 选择器

```vue
<!-- src/components/ProviderSelector.vue -->
<template>
  <div class="provider-selector">
    <n-select
      v-model:value="selectedProviderId"
      :options="providerOptions"
      placeholder="选择图像生成服务商"
      @update:value="handleProviderChange"
    />

    <n-select
      v-if="selectedProviderId"
      v-model:value="selectedModelId"
      :options="modelOptions"
      placeholder="选择模型"
      @update:value="handleModelChange"
    />

    <!-- 模型特定配置 -->
    <div v-if="selectedModel" class="model-config">
      <!-- 尺寸选择 -->
      <n-select
        v-if="selectedModel.sizes"
        v-model:value="imageSize"
        :options="sizeOptions"
        placeholder="图片尺寸"
      />

      <!-- 质量选择 (DALL-E 3) -->
      <n-select
        v-if="selectedModel.quality"
        v-model:value="imageQuality"
        :options="qualityOptions"
        placeholder="图片质量"
      />

      <!-- 数量选择 -->
      <n-input-number
        v-model:value="imageCount"
        :min="1"
        :max="selectedModel.maxCount || 4"
        placeholder="生成数量"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getImageProviders, getImageModels } from '@/stores/providers'

const selectedProviderId = ref(null)
const selectedModelId = ref(null)
const imageSize = ref('1024x1024')
const imageQuality = ref('standard')
const imageCount = ref(1)

// Provider 列表
const providerOptions = computed(() => {
  return getImageProviders().map(p => ({
    label: p.name,
    value: p.id
  }))
})

// 模型列表
const modelOptions = computed(() => {
  if (!selectedProviderId.value) return []

  const models = getImageModels(selectedProviderId.value)
  return models.map(m => ({
    label: m.name,
    value: m.id
  }))
})

// 当前选中的模型
const selectedModel = computed(() => {
  if (!selectedProviderId.value || !selectedModelId.value) return null

  const models = getImageModels(selectedProviderId.value)
  return models.find(m => m.id === selectedModelId.value)
})

// 尺寸选项
const sizeOptions = computed(() => {
  if (!selectedModel.value?.sizes) return []

  return selectedModel.value.sizes.map(size => ({
    label: size,
    value: size
  }))
})

// 质量选项
const qualityOptions = computed(() => {
  if (!selectedModel.value?.quality) return []

  return selectedModel.value.quality.map(q => ({
    label: q === 'hd' ? '高清' : '标准',
    value: q
  }))
})

// 监听 Provider 变化，自动选择第一个模型
watch(selectedProviderId, (newVal) => {
  if (newVal) {
    const models = getImageModels(newVal)
    if (models.length > 0) {
      selectedModelId.value = models[0].id
    }
  }
})

// 导出配置供父组件使用
const emit = defineEmits(['update:config'])

watch([selectedProviderId, selectedModelId, imageSize, imageQuality, imageCount], () => {
  emit('update:config', {
    providerId: selectedProviderId.value,
    modelId: selectedModelId.value,
    size: imageSize.value,
    quality: imageQuality.value,
    n: imageCount.value
  })
}, { deep: true })
</script>
```

## 七、Cherry Studio 的关键设计亮点

### 7.1 类型安全

✅ **使用 Zod Schema 进行运行时验证**
- 配置验证在运行时执行，防止错误配置
- TypeScript 类型从 Schema 推导，保持类型一致性

```typescript
export const providerConfigSchema = z.object({
  id: customProviderIdSchema,
  name: z.string().min(1),
  creator: z.function().optional(),
  supportsImageGeneration: z.boolean().default(false)
})

export type ProviderConfig = z.infer<typeof providerConfigSchema>
```

### 7.2 别名系统

✅ **支持 Provider 和模型别名**
- 用户友好：可以用 `gpt-4` 代替 `openai:gpt-4`
- 兼容性：支持不同命名约定

```typescript
// 注册别名
providerConfigAliases.set('gpt', 'openai')

// 使用时自动解析
const realId = providerConfigAliases.get('gpt') || 'gpt'
// realId = 'openai'
```

### 7.3 延迟加载

✅ **动态导入 Provider SDK**
- 减少初始包体积
- 按需加载第三方 SDK

```typescript
{
  id: 'my-custom',
  import: () => import('@my-org/custom-sdk'),
  creatorFunctionName: 'createCustomProvider'
}
```

### 7.4 多态 Provider 支持

✅ **同一 Provider 的不同变体**
- `openai` vs `openai-chat`
- `azure` vs `azure-responses`

```typescript
// 自动创建变体
if (providerId === 'openai') {
  // 注册标准版本
  globalRegistryManagement.registerProvider(providerId, provider)

  // 创建 Chat 变体
  const chatVariant = customProvider({
    fallbackProvider: {
      ...provider,
      languageModel: (modelId) => provider.chat(modelId)
    }
  })
  globalRegistryManagement.registerProvider('openai-chat', chatVariant)
}
```

## 八、总结与建议

### 8.1 核心优势

1. **清晰的分层架构**：配置层、注册层、SDK 层职责分明
2. **类型安全**：Zod + TypeScript 双重保障
3. **扩展性强**：支持自定义 Provider 和动态注册
4. **标准化接口**：统一的 Vercel AI SDK 接口
5. **图像生成标记**：`supportsImageGeneration` 标记清晰标识能力

### 8.2 应用到 dream-canvas 的关键点

#### ✅ 建议采纳的设计

1. **Provider 配置系统**
   - 使用配置文件集中管理所有 Provider
   - 每个 Provider 标记图像生成能力
   - 支持多个 Provider 的图像模型

2. **分层 API 设计**
   - 统一的 `generateImage()` 接口
   - 根据 Provider 类型分发到不同实现
   - 屏蔽底层差异

3. **UI 层配置化**
   - Provider 选择器自动读取配置
   - 模型特定选项动态渲染
   - 配置保存到 localStorage

#### 🔄 需要适配的部分

1. **简化架构**（dream-canvas 不需要 Electron）
   - 去掉主进程/渲染进程分离
   - 直接在浏览器环境调用 API

2. **保持轻量**
   - 不引入 Vercel AI SDK（除非需要）
   - 直接使用 Axios 调用各 Provider API
   - 按需加载，避免打包所有 Provider

3. **增强用户体验**
   - 在 API 配置界面集成 Provider 管理
   - 支持测试连接功能
   - 显示配额使用情况（如果 API 支持）

### 8.3 实施路线图

#### 第一阶段：基础架构
- [ ] 创建 Provider 配置系统 (`src/stores/providers.js`)
- [ ] 定义 Provider 配置格式 (`src/config/imageProviders.js`)
- [ ] 实现统一的图像生成 API (`src/api/imageGeneration.js`)

#### 第二阶段：多 Provider 支持
- [ ] 添加 OpenAI 支持
- [ ] 添加 Silicon Flow 支持
- [ ] 添加豆包支持
- [ ] 添加自定义接口支持

#### 第三阶段：UI 改进
- [ ] Provider 选择器组件
- [ ] 模型配置面板
- [ ] API 配置界面重构
- [ ] 支持多 Provider 切换

#### 第四阶段：高级功能
- [ ] Provider 配额监控
- [ ] 智能降级（主 Provider 失败时切换）
- [ ] 批量生成支持
- [ ] 成本估算功能

---

**参考资料**

- Cherry Studio GitHub: https://github.com/CherryHQ/cherry-studio
- Vercel AI SDK: https://sdk.vercel.ai/docs
- OpenAI Images API: https://platform.openai.com/docs/api-reference/images
- Silicon Flow API: https://docs.siliconflow.cn/
