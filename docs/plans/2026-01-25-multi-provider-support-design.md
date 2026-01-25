# 多模型供应商支持功能设计文档

**文档版本**: 1.0
**创建日期**: 2026-01-25
**状态**: 设计完成，待实施

---

## 1. 功能概述

### 1.1 目标

为 dream-canvas 项目添加多模型供应商的添加与选择功能，使用户能够：

- 在预设的主流供应商中选择（OpenAI、Google Gemini、Banana-pro、豆包）
- 添加自定义的 OpenAI 兼容接口
- 为每个供应商配置可用模型
- 灵活切换供应商而不破坏已有工作流

### 1.2 设计原则

- ✅ **渐进增强** - 架构完备，支持逐个对接供应商
- ✅ **用户友好** - 预设供应商开箱即用，自定义供应商灵活配置
- ✅ **向后兼容** - 不破坏现有项目和节点
- ✅ **类型安全** - 统一的接口和数据结构

### 1.3 技术栈

- **前端框架**: Vue 3 + Composition API
- **UI 组件**: Naive UI
- **状态管理**: Reactive Composition (stores/)
- **数据持久化**: localStorage
- **HTTP 客户端**: Axios

---

## 2. 整体架构

### 2.1 三层架构模式

```
┌─────────────────────────────────────────────────────────┐
│              UI Layer (展示层)                            │
│  - ApiSettings.vue (供应商配置界面)                       │
│  - ImageConfigNode.vue (节点集成)                        │
│  - VideoConfigNode.vue (节点集成)                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│          Store Layer (状态管理层)                         │
│  - providers.js (供应商状态管理)                          │
│  - localStorage 持久化                                   │
│  - 配置验证与状态计算                                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│        Adapter Layer (API 适配层)                        │
│  - BaseProviderAdapter (基础适配器接口)                  │
│  - OpenAIAdapter, GeminiAdapter, DoubaoAdapter...       │
│  - 统一的 generateImage() 接口                           │
│  - 格式转换与错误处理                                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户配置供应商 (UI)
    ↓
保存到 Store (providers.js)
    ↓
持久化到 localStorage
    ↓
节点创建时绑定当前激活的供应商
    ↓
用户点击"立即生成"
    ↓
获取节点绑定的供应商配置
    ↓
创建对应的适配器 (createProviderAdapter)
    ↓
调用 adapter.generateImage()
    ↓
适配器处理 API 格式转换
    ↓
发起 HTTP 请求
    ↓
返回结果，创建输出节点
```

---

## 3. 数据层设计

### 3.1 数据结构

#### localStorage 存储格式

```javascript
{
  // 当前激活的供应商 ID
  activeProviderId: 'openai',

  // 供应商配置列表
  providers: [
    {
      id: 'openai',              // 唯一标识
      name: 'OpenAI',            // 显示名称
      type: 'preset',            // 类型：preset | custom
      apiKey: 'sk-xxx',          // API Key
      baseUrl: 'https://api.openai.com/v1',  // API 端点
      enabled: true,             // 是否启用（是否配置了 API Key）
      models: [                  // 可用模型列表
        {
          id: 'dall-e-3',
          name: 'DALL-E 3',
          enabled: true,         // 是否启用此模型
          sizes: ['1024x1024', '1024x1792', '1792x1024'],
          quality: ['standard', 'hd'],
          style: ['vivid', 'natural']
        },
        {
          id: 'dall-e-2',
          name: 'DALL-E 2',
          enabled: false,
          sizes: ['256x256', '512x512', '1024x1024']
        }
      ]
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      type: 'preset',
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      enabled: false,
      models: [
        {
          id: 'imagen-3.0-generate-001',
          name: 'Imagen 3',
          enabled: true,
          sizes: ['1024x1024', '1536x1536']
        }
      ]
    },
    {
      id: 'banana-pro',
      name: 'Banana-pro',
      type: 'preset',
      apiKey: '',
      baseUrl: 'https://api.banana-pro.com/v1',
      enabled: false,
      models: [
        {
          id: 'banana-model-1',
          name: 'Banana Model',
          enabled: true
        }
      ]
    },
    {
      id: 'doubao',
      name: '豆包',
      type: 'preset',
      apiKey: '',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      enabled: false,
      models: [
        {
          id: 'doubao-seedream-4-5-251128',
          name: 'SeeDream 4.5',
          enabled: true,
          sizes: ['1024x1024', '2048x2048', '1440x2560', '2560x1440']
        }
      ]
    },
    {
      id: 'custom-1643123456789',
      name: '我的自定义接口',
      type: 'custom',
      apiKey: 'xxx',
      baseUrl: 'https://my-api.com/v1',
      enabled: true,
      models: [
        {
          id: 'custom-model-1',
          name: '自定义模型',
          enabled: true
        }
      ]
    }
  ]
}
```

#### 节点数据扩展

每个配置节点（ImageConfigNode、VideoConfigNode）的 `data` 对象新增字段：

```javascript
{
  // 原有字段...
  label: '文生图',
  prompt: '',

  // 新增字段
  providerId: 'openai',        // 节点绑定的供应商 ID
  model: 'dall-e-3',           // 选择的模型 ID

  // 执行结果
  executed: true,
  executedAt: 1643123456789,
  outputNodeId: 'node_123'
}
```

### 3.2 预设供应商配置

创建 `src/config/imageProviders.js`：

```javascript
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
        enabled: true,
        sizes: ['1024x1024', '1024x1792', '1792x1024'],
        quality: ['standard', 'hd'],
        style: ['vivid', 'natural']
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
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
        enabled: true,
        sizes: ['1024x1024', '1536x1536']
      }
    ]
  },
  {
    id: 'banana-pro',
    name: 'Banana-pro',
    baseUrl: 'https://api.banana-pro.com/v1',  // 待确认实际 URL
    icon: '🍌',
    description: 'Banana-pro 图像服务',
    apiKeyPlaceholder: 'banana-xxxxxxxx',
    docUrl: '',  // 待补充
    defaultModels: [
      {
        id: 'banana-model-1',
        name: 'Banana Model',
        enabled: true
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
        enabled: true,
        sizes: ['1024x1024', '2048x2048', '1440x2560', '2560x1440']
      }
    ]
  }
]
```

---

## 4. Store 层实现

### 4.1 providers.js

创建 `src/stores/providers.js`：

```javascript
import { ref, computed } from 'vue'
import { PRESET_PROVIDERS } from '@/config/imageProviders'

const STORAGE_KEY = 'dream-canvas-providers'

// ========== 状态 ==========

export const activeProviderId = ref('openai')
export const providers = ref([])

// ========== 计算属性 ==========

// 当前激活的供应商
export const activeProvider = computed(() => {
  return providers.value.find(p => p.id === activeProviderId.value)
})

// 当前供应商的已启用模型
export const activeModels = computed(() => {
  if (!activeProvider.value) return []
  return activeProvider.value.models.filter(m => m.enabled)
})

// 是否有任何已配置的供应商
export const hasConfiguredProvider = computed(() => {
  return providers.value.some(p => p.enabled)
})

// ========== 初始化 ==========

export const initProviders = () => {
  const saved = localStorage.getItem(STORAGE_KEY)

  if (saved) {
    try {
      const data = JSON.parse(saved)
      activeProviderId.value = data.activeProviderId || 'openai'
      providers.value = data.providers || []
    } catch (e) {
      console.error('Failed to parse providers config:', e)
      loadDefaultProviders()
    }
  } else {
    loadDefaultProviders()
  }
}

const loadDefaultProviders = () => {
  providers.value = PRESET_PROVIDERS.map(preset => ({
    id: preset.id,
    name: preset.name,
    type: 'preset',
    baseUrl: preset.baseUrl,
    apiKey: '',
    enabled: false,
    models: preset.defaultModels.map(m => ({ ...m }))
  }))
  saveProviders()
}

const saveProviders = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activeProviderId: activeProviderId.value,
    providers: providers.value
  }))
}

// ========== 供应商操作 ==========

export const setActiveProvider = (providerId) => {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) {
    console.warn(`Provider ${providerId} not found`)
    return false
  }

  if (!provider.enabled) {
    console.warn(`Provider ${providerId} is not enabled`)
    return false
  }

  activeProviderId.value = providerId
  saveProviders()
  return true
}

export const updateProvider = (providerId, updates) => {
  const index = providers.value.findIndex(p => p.id === providerId)
  if (index === -1) return false

  providers.value[index] = {
    ...providers.value[index],
    ...updates,
    enabled: updates.apiKey ? true : providers.value[index].enabled
  }

  saveProviders()
  return true
}

export const addCustomProvider = (config) => {
  const customId = `custom-${Date.now()}`

  providers.value.push({
    id: customId,
    name: config.name || '自定义供应商',
    type: 'custom',
    baseUrl: config.baseUrl,
    apiKey: config.apiKey || '',
    enabled: !!config.apiKey,
    models: config.models || []
  })

  saveProviders()
  return customId
}

export const removeProvider = (providerId) => {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider || provider.type !== 'custom') {
    console.warn('Cannot remove preset provider')
    return false
  }

  providers.value = providers.value.filter(p => p.id !== providerId)

  if (activeProviderId.value === providerId) {
    const firstEnabled = providers.value.find(p => p.enabled)
    activeProviderId.value = firstEnabled?.id || 'openai'
  }

  saveProviders()
  return true
}

// ========== 模型操作 ==========

export const toggleModel = (providerId, modelId, enabled) => {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return false

  const model = provider.models.find(m => m.id === modelId)
  if (!model) return false

  model.enabled = enabled
  saveProviders()
  return true
}

export const addCustomModel = (providerId, modelConfig) => {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return false

  provider.models.push({
    id: modelConfig.id,
    name: modelConfig.name || modelConfig.id,
    enabled: true,
    ...modelConfig
  })

  saveProviders()
  return true
}

export const removeModel = (providerId, modelId) => {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return false

  provider.models = provider.models.filter(m => m.id !== modelId)
  saveProviders()
  return true
}

// ========== 工具函数 ==========

export const getProvider = (providerId) => {
  return providers.value.find(p => p.id === providerId)
}

export const getProviderModels = (providerId) => {
  const provider = getProvider(providerId)
  return provider?.models.filter(m => m.enabled) || []
}

// 自动初始化
initProviders()
```

### 4.2 关键逻辑说明

**初始化流程：**
1. 读取 localStorage
2. 如果存在，解析并恢复状态
3. 如果不存在或解析失败，加载默认预设供应商（未配置状态）

**供应商启用逻辑：**
- 预设供应商初始为 `enabled: false`
- 配置 API Key 后自动设置为 `enabled: true`
- 只有 `enabled: true` 的供应商才能被选为激活供应商

**数据持久化：**
- 所有修改操作（更新、添加、删除）都调用 `saveProviders()`
- 自动同步到 localStorage
- 无需手动保存

---

## 5. API 适配层设计

### 5.1 适配器架构

```
BaseProviderAdapter (抽象基类)
    ↓
├── OpenAIAdapter (OpenAI 标准格式)
├── GeminiAdapter (Gemini 特殊格式)
├── DoubaoAdapter (豆包 - OpenAI 兼容 + 参考图扩展)
└── BananaProAdapter (Banana-pro - 待实现)
```

### 5.2 基础适配器接口

创建 `src/api/providers/base.js`：

```javascript
import { request } from '@/utils'

/**
 * 基础供应商适配器
 * 所有具体适配器必须继承此类并实现 generateImage 方法
 */
export class BaseProviderAdapter {
  constructor(config) {
    this.config = config  // { apiKey, baseUrl, models }
    this.validateConfig(config)
  }

  /**
   * 验证配置（子类可重写）
   */
  validateConfig(config) {
    if (!config.apiKey) {
      throw new Error('API Key is required')
    }
    if (!config.baseUrl) {
      throw new Error('Base URL is required')
    }
  }

  /**
   * 图像生成（必须由子类实现）
   * @param {Object} params
   * @param {string} params.prompt - 文本提示词
   * @param {string} params.model - 模型 ID
   * @param {string} params.size - 图片尺寸
   * @param {string} params.quality - 图片质量（如果支持）
   * @param {Array} params.referenceImages - 参考图列表 [{ url, base64 }]
   * @returns {Promise<Array>} - [{ url: '...' }, ...]
   */
  async generateImage(params) {
    throw new Error('generateImage must be implemented by subclass')
  }

  /**
   * 发送 HTTP 请求（通用方法）
   */
  async sendRequest(endpoint, data, headers = {}) {
    return await request({
      url: `${this.config.baseUrl}${endpoint}`,
      method: 'POST',
      data,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...headers
      }
    })
  }
}
```

### 5.3 OpenAI 适配器

创建 `src/api/providers/openai.js`：

```javascript
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
```

### 5.4 Gemini 适配器

创建 `src/api/providers/gemini.js`：

```javascript
import { BaseProviderAdapter } from './base'

export class GeminiAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size, referenceImages = [] }) {
    const parts = []

    // Gemini 要求参考图在前
    if (referenceImages.length > 0) {
      referenceImages.forEach(img => {
        // 如果有 base64，使用 base64；否则需要先下载并转换
        if (img.base64) {
          parts.push({
            inlineData: {
              data: img.base64.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/png'
            }
          })
        } else {
          console.warn('Gemini requires base64 image data, URL will be skipped')
        }
      })
    }

    // 提示词在后
    parts.push({ text: prompt })

    const response = await this.sendRequest(`/models/${model}:generateContent`, {
      contents: [{ parts, role: 'user' }],
      generationConfig: {
        imageConfig: {
          aspectRatio: this.sizeToAspectRatio(size)
        },
        responseModalities: ['IMAGE']
      }
    })

    return this.parseGeminiResponse(response)
  }

  sizeToAspectRatio(size) {
    const map = {
      '1024x1024': '1:1',
      '1536x1536': '1:1',
      '1024x1792': '9:16',
      '1792x1024': '16:9'
    }
    return map[size] || '1:1'
  }

  parseGeminiResponse(response) {
    // Gemini 返回格式需要根据实际 API 调整
    // 这里是示例解析
    try {
      const candidates = response.candidates || []
      const images = []

      candidates.forEach(candidate => {
        const content = candidate.content
        if (content && content.parts) {
          content.parts.forEach(part => {
            if (part.inlineData && part.inlineData.data) {
              // 返回 base64 格式的图片
              images.push({
                url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              })
            }
          })
        }
      })

      return images
    } catch (error) {
      console.error('Failed to parse Gemini response:', error)
      throw new Error('Failed to parse image generation response')
    }
  }
}
```

### 5.5 豆包适配器

创建 `src/api/providers/doubao.js`：

```javascript
import { BaseProviderAdapter } from './base'

export class DoubaoAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size, referenceImages = [] }) {
    const data = {
      model,
      prompt,
      size: size || '1024x1024',
      n: 1
    }

    // 豆包支持参考图（假设通过 image_url 传递）
    // 具体参数需要根据实际 API 文档调整
    if (referenceImages.length > 0) {
      data.image_url = referenceImages[0].url
    }

    const response = await this.sendRequest('/images/generations', data)

    return response.data.map(img => ({ url: img.url }))
  }
}
```

### 5.6 适配器工厂

创建 `src/api/providers/index.js`：

```javascript
import { OpenAIAdapter } from './openai'
import { GeminiAdapter } from './gemini'
import { DoubaoAdapter } from './doubao'

const ADAPTERS = {
  'openai': OpenAIAdapter,
  'gemini': GeminiAdapter,
  'doubao': DoubaoAdapter,
  'banana-pro': OpenAIAdapter,  // 暂时使用 OpenAI 适配器
  'custom': OpenAIAdapter       // 自定义默认使用 OpenAI 格式
}

/**
 * 创建供应商适配器
 * @param {string} providerId - 供应商 ID
 * @param {Object} config - 配置 { apiKey, baseUrl, models }
 * @returns {BaseProviderAdapter} - 适配器实例
 */
export function createProviderAdapter(providerId, config) {
  const AdapterClass = ADAPTERS[providerId] || OpenAIAdapter
  return new AdapterClass(config)
}

// 重新导出基类供自定义使用
export { BaseProviderAdapter } from './base'
```

### 5.7 适配器使用示例

```javascript
import { createProviderAdapter } from '@/api/providers'

// 创建 OpenAI 适配器
const openaiAdapter = createProviderAdapter('openai', {
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.openai.com/v1'
})

// 生成图像
const results = await openaiAdapter.generateImage({
  prompt: '一只可爱的猫咪',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd'
})

console.log(results) // [{ url: 'https://...' }]
```

---

## 6. UI 层实现

### 6.1 ApiSettings.vue 改造

改造现有的 `src/components/ApiSettings.vue`：

**核心改动：**

1. **双 Tab 设计**
   - Tab 1: 供应商管理（列表视图）
   - Tab 2: 供应商配置详情（表单视图）

2. **供应商列表**
   - 显示所有预设供应商 + 自定义供应商
   - 状态标签（已配置/未配置）
   - 当前激活供应商高亮
   - 配置/删除按钮

3. **配置表单**
   - Base URL（自定义供应商或高级模式）
   - API Key（必填）
   - 模型勾选列表
   - 测试连接按钮

4. **交互流程**
   ```
   用户点击"配置" → 切换到 Tab 2
                 ↓
   填写 API Key 和配置
                 ↓
   勾选要启用的模型
                 ↓
   点击"测试连接"（可选）
                 ↓
   点击"保存配置"
                 ↓
   返回 Tab 1，供应商状态变为"已配置"
   ```

**关键代码片段：**

```vue
<script setup>
import { ref, computed } from 'vue'
import {
  providers,
  activeProviderId,
  setActiveProvider,
  updateProvider,
  toggleModel,
  addCustomProvider,
  removeProvider
} from '@/stores/providers'
import { PRESET_PROVIDERS } from '@/config/imageProviders'

const activeTab = ref('providers')
const editingProviderId = ref(null)
const showAdvanced = ref(false)

const editForm = ref({
  baseUrl: '',
  apiKey: '',
  enabledModels: []
})

// 供应商选项（只包含已配置的）
const providerOptions = computed(() => {
  return providers.value
    .filter(p => p.enabled)
    .map(p => ({
      label: p.name,
      value: p.id
    }))
})

// 当前编辑的供应商
const editingProvider = computed(() => {
  return providers.value.find(p => p.id === editingProviderId.value)
})

// 选择供应商进行编辑
const selectProviderToEdit = (providerId) => {
  editingProviderId.value = providerId
  activeTab.value = 'config'

  const provider = providers.value.find(p => p.id === providerId)
  editForm.value = {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    enabledModels: provider.models.filter(m => m.enabled).map(m => m.id)
  }
}

// 保存配置
const handleSaveConfig = () => {
  if (!editingProviderId.value) return

  updateProvider(editingProviderId.value, {
    baseUrl: editForm.value.baseUrl,
    apiKey: editForm.value.apiKey
  })

  const provider = providers.value.find(p => p.id === editingProviderId.value)
  provider.models.forEach(model => {
    toggleModel(
      editingProviderId.value,
      model.id,
      editForm.value.enabledModels.includes(model.id)
    )
  })

  window.$message?.success('配置已保存')
  editingProviderId.value = null
  activeTab.value = 'providers'
}
</script>
```

### 6.2 ImageConfigNode.vue 集成

改造 `src/components/nodes/ImageConfigNode.vue`：

**核心改动：**

1. **节点绑定供应商**
   ```javascript
   const nodeProvider = ref(props.data.providerId || activeProviderId.value)
   const nodeModel = ref(props.data.model || '')
   ```

2. **显示供应商标签**
   ```vue
   <n-tag size="tiny" :type="nodeProvider === activeProviderId ? 'info' : 'default'">
     {{ providerLabel }}
   </n-tag>
   ```

3. **模型列表动态获取**
   ```javascript
   const availableModels = computed(() => {
     const provider = providers.value.find(p => p.id === nodeProvider.value)
     if (!provider) return []
     return provider.models
       .filter(m => m.enabled)
       .map(m => ({ label: m.name, value: m.id }))
   })
   ```

4. **使用适配器生成图像**
   ```javascript
   const handleExecute = async () => {
     const provider = providers.value.find(p => p.id === nodeProvider.value)

     const adapter = createProviderAdapter(nodeProvider.value, {
       apiKey: provider.apiKey,
       baseUrl: provider.baseUrl,
       models: provider.models
     })

     const results = await adapter.generateImage({
       prompt: prompts.join('\n'),
       model: nodeModel.value,
       size: selectedSize.value,
       quality: selectedQuality.value,
       referenceImages: referenceImages
     })

     // 创建输出节点...
   }
   ```

### 6.3 辅助组件

#### AddCustomProviderModal.vue

添加自定义供应商的弹窗：

```vue
<template>
  <n-modal v-model:show="showModal" preset="card" title="添加自定义供应商" style="width: 480px;">
    <n-form :model="formData">
      <n-form-item label="供应商名称" required>
        <n-input v-model:value="formData.name" placeholder="如：My Custom API" />
      </n-form-item>

      <n-form-item label="Base URL" required>
        <n-input v-model:value="formData.baseUrl" placeholder="https://api.example.com/v1" />
      </n-form-item>

      <n-form-item label="API Key">
        <n-input v-model:value="formData.apiKey" type="password" />
      </n-form-item>

      <n-alert type="info" class="mb-4">
        自定义供应商需要兼容 OpenAI 图像生成 API 格式
      </n-alert>
    </n-form>

    <template #footer>
      <n-button @click="showModal = false">取消</n-button>
      <n-button type="primary" @click="handleAdd">添加</n-button>
    </template>
  </n-modal>
</template>

<script setup>
import { ref } from 'vue'
import { addCustomProvider } from '@/stores/providers'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['update:show', 'added'])

const formData = ref({
  name: '',
  baseUrl: '',
  apiKey: ''
})

const handleAdd = () => {
  const id = addCustomProvider(formData.value)
  window.$message?.success('自定义供应商已添加')
  emit('added', id)
  emit('update:show', false)
}
</script>
```

#### AddModelModal.vue

为自定义供应商添加模型的弹窗：

```vue
<template>
  <n-modal v-model:show="showModal" preset="card" title="添加模型" style="width: 400px;">
    <n-form :model="formData">
      <n-form-item label="模型 ID" required>
        <n-input v-model:value="formData.id" placeholder="model-name-v1" />
      </n-form-item>

      <n-form-item label="显示名称">
        <n-input v-model:value="formData.name" placeholder="留空则使用 ID" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-button @click="showModal = false">取消</n-button>
      <n-button type="primary" @click="handleAdd">添加</n-button>
    </template>
  </n-modal>
</template>

<script setup>
import { ref } from 'vue'
import { addCustomModel } from '@/stores/providers'

const props = defineProps({
  show: Boolean,
  providerId: String
})

const emit = defineEmits(['update:show', 'added'])

const formData = ref({
  id: '',
  name: ''
})

const handleAdd = () => {
  addCustomModel(props.providerId, formData.value)
  window.$message?.success('模型已添加')
  emit('added')
  emit('update:show', false)
}
</script>
```

---

## 7. 实施计划

### 7.1 开发阶段

#### 第一阶段：基础架构（2-3 天）

**目标**：搭建完整的架构框架

- [ ] 创建 `src/config/imageProviders.js` - 预设供应商配置
- [ ] 创建 `src/stores/providers.js` - 状态管理
- [ ] 创建 `src/api/providers/base.js` - 基础适配器
- [ ] 创建 `src/api/providers/openai.js` - OpenAI 适配器（参考实现）
- [ ] 创建 `src/api/providers/index.js` - 适配器工厂
- [ ] 测试 Store 层功能（初始化、保存、读取）

**验收标准**：
- ✅ 可以成功初始化默认供应商列表
- ✅ 配置修改后正确保存到 localStorage
- ✅ OpenAI 适配器可以成功调用（使用测试 API Key）

#### 第二阶段：UI 界面（2-3 天）

**目标**：完成用户配置界面

- [ ] 改造 `src/components/ApiSettings.vue`
  - [ ] 供应商列表 Tab
  - [ ] 供应商配置 Tab
  - [ ] 供应商切换逻辑
  - [ ] 模型勾选功能
- [ ] 创建 `src/components/AddCustomProviderModal.vue`
- [ ] 创建 `src/components/AddModelModal.vue`
- [ ] 测试所有 UI 交互

**验收标准**：
- ✅ 可以配置预设供应商的 API Key
- ✅ 可以勾选/取消勾选模型
- ✅ 可以添加自定义供应商
- ✅ 可以切换当前激活的供应商
- ✅ UI 状态与 Store 数据同步

#### 第三阶段：节点集成（1-2 天）

**目标**：将供应商系统集成到节点

- [ ] 修改 `src/components/nodes/ImageConfigNode.vue`
  - [ ] 添加供应商绑定逻辑
  - [ ] 添加供应商标签显示
  - [ ] 使用适配器调用 API
  - [ ] 处理参考图（如果供应商支持）
- [ ] 修改 `src/components/nodes/VideoConfigNode.vue`（类似改动）
- [ ] 测试节点创建和执行

**验收标准**：
- ✅ 节点创建时绑定当前激活的供应商
- ✅ 节点显示供应商名称标签
- ✅ 点击"立即生成"可以成功调用 API
- ✅ 全局切换供应商不影响已有节点

#### 第四阶段：供应商适配（逐步进行）

**目标**：为每个供应商实现专属适配器

优先级顺序：

1. **OpenAI**（第一阶段已完成） ✅
2. **豆包**（OpenAI 兼容 + 参考图扩展）
   - [ ] 创建 `src/api/providers/doubao.js`
   - [ ] 测试文生图
   - [ ] 测试图生图（参考图）
3. **Gemini**（特殊格式）
   - [ ] 创建 `src/api/providers/gemini.js`
   - [ ] 实现请求格式转换
   - [ ] 实现响应解析
   - [ ] 测试文生图
   - [ ] 测试图生图
4. **Banana-pro**（待确认 API 格式）
   - [ ] 获取 API 文档
   - [ ] 创建适配器
   - [ ] 测试

**每个供应商的验收标准**：
- ✅ 可以成功调用 API 生成图像
- ✅ 错误处理正确（API Key 错误、网络错误等）
- ✅ 参考图功能正常（如果支持）

### 7.2 测试计划

#### 单元测试

- [ ] Store 层测试
  - 初始化逻辑
  - 供应商增删改
  - 模型启用/禁用
  - localStorage 持久化
- [ ] 适配器测试
  - 请求格式正确性
  - 响应解析正确性
  - 错误处理

#### 集成测试

- [ ] 完整工作流测试
  - 配置供应商 → 创建节点 → 生成图像
  - 切换供应商 → 新节点使用新供应商
  - 修改配置 → 已有节点不受影响
- [ ] 边界情况测试
  - 无可用供应商时的行为
  - 网络错误时的处理
  - 无效配置的提示

#### 用户验收测试

- [ ] 首次使用体验
  - 未配置时的引导
  - 配置流程是否顺畅
- [ ] 多供应商切换
  - 切换是否流畅
  - 节点供应商标识是否清晰
- [ ] 自定义供应商
  - 添加流程是否简单
  - 配置是否足够灵活

### 7.3 时间估算

| 阶段 | 工作量 | 备注 |
|------|--------|------|
| 第一阶段：基础架构 | 2-3 天 | 核心逻辑 |
| 第二阶段：UI 界面 | 2-3 天 | 主要是界面开发 |
| 第三阶段：节点集成 | 1-2 天 | 逻辑相对简单 |
| 第四阶段：供应商适配 | 1 天/供应商 | 并行或串行进行 |
| 测试与优化 | 2-3 天 | 全面测试 |
| **总计** | **8-14 天** | 根据并行程度调整 |

---

## 8. 向后兼容策略

### 8.1 数据迁移

**现有项目数据：**
- 现有的 API 配置存储在 `useApiConfig` hook 中
- 需要将现有的 `baseUrl` 和 `apiKey` 迁移到新的供应商系统

**迁移逻辑：**

```javascript
// 在 providers.js 初始化时执行
import { useApiConfig } from '@/hooks/useApiConfig'

const migrateFromLegacyConfig = () => {
  const { apiKey, baseUrl } = useApiConfig()

  if (apiKey.value && baseUrl.value) {
    // 尝试匹配预设供应商
    const matchedPreset = PRESET_PROVIDERS.find(p => p.baseUrl === baseUrl.value)

    if (matchedPreset) {
      // 更新对应的预设供应商
      updateProvider(matchedPreset.id, { apiKey: apiKey.value })
      setActiveProvider(matchedPreset.id)
    } else {
      // 创建自定义供应商
      const customId = addCustomProvider({
        name: '已有配置',
        baseUrl: baseUrl.value,
        apiKey: apiKey.value,
        models: [
          { id: 'default', name: '默认模型', enabled: true }
        ]
      })
      setActiveProvider(customId)
    }

    console.log('Legacy config migrated to new provider system')
  }
}
```

### 8.2 节点兼容

**已有节点处理：**
- 已有节点没有 `providerId` 字段
- 在节点渲染时检测并自动补充

```javascript
// ImageConfigNode.vue
const nodeProvider = ref(props.data.providerId || activeProviderId.value)

// 如果没有 providerId，保存时自动添加
watch(nodeProvider, (val) => {
  if (!props.data.providerId) {
    updateNode(props.id, { providerId: val })
  }
})
```

### 8.3 API 调用兼容

**保留原有 API 层：**
- `src/api/image.js` 的 `generateImage()` 函数保持不变
- 新增适配器层不影响直接调用方式
- 节点可以选择使用适配器或直接调用

---

## 9. 扩展性考虑

### 9.1 添加新供应商

**步骤：**

1. 在 `src/config/imageProviders.js` 添加预设配置（可选）
2. 在 `src/api/providers/` 创建适配器类
3. 在 `src/api/providers/index.js` 注册适配器
4. 测试

**示例：添加 Stability AI**

```javascript
// 1. imageProviders.js
{
  id: 'stability',
  name: 'Stability AI',
  baseUrl: 'https://api.stability.ai/v1',
  icon: '🎨',
  defaultModels: [
    { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1.0', enabled: true }
  ]
}

// 2. providers/stability.js
import { BaseProviderAdapter } from './base'

export class StabilityAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size }) {
    // 实现 Stability AI 的 API 调用
  }
}

// 3. providers/index.js
import { StabilityAdapter } from './stability'

const ADAPTERS = {
  // ...
  'stability': StabilityAdapter
}
```

### 9.2 添加新功能

**扩展适配器接口：**

```javascript
// 如果需要添加视频生成支持
export class BaseProviderAdapter {
  async generateImage(params) { ... }

  async generateVideo(params) {
    throw new Error('Video generation not supported by this provider')
  }
}
```

**扩展节点配置：**

```javascript
// 节点数据可以存储更多供应商特定参数
{
  providerId: 'openai',
  model: 'dall-e-3',
  providerSpecificParams: {
    style: 'vivid',
    quality: 'hd'
  }
}
```

### 9.3 多区域支持

**未来可以支持同一供应商的不同区域：**

```javascript
{
  id: 'openai-us',
  name: 'OpenAI (US)',
  baseUrl: 'https://api.openai.com/v1',
  region: 'us'
},
{
  id: 'openai-eu',
  name: 'OpenAI (EU)',
  baseUrl: 'https://api.openai.eu/v1',
  region: 'eu'
}
```

---

## 10. 风险与挑战

### 10.1 技术风险

**风险 1：供应商 API 格式差异大**
- **影响**：需要为每个供应商写大量适配代码
- **缓解**：优先支持 OpenAI 兼容格式，非兼容格式逐步添加
- **应对**：使用适配器模式隔离差异，保持核心逻辑简洁

**风险 2：参考图格式不统一**
- **影响**：有的供应商需要 URL，有的需要 base64
- **缓解**：适配器层统一处理转换
- **应对**：在节点层提供 URL 和 base64 两种格式

**风险 3：API 变更**
- **影响**：供应商更新 API 可能导致适配器失效
- **缓解**：版本号管理，适配器支持多版本
- **应对**：错误处理友好，提示用户 API 可能已更新

### 10.2 用户体验风险

**风险 1：配置复杂度**
- **影响**：用户可能不理解如何配置
- **缓解**：预设供应商简化配置，只需填 API Key
- **应对**：提供文档和示例

**风险 2：供应商切换混淆**
- **影响**：用户不清楚哪个节点用的哪个供应商
- **缓解**：节点显示供应商标签
- **应对**：提供供应商筛选和高亮功能

### 10.3 性能风险

**风险 1：localStorage 容量限制**
- **影响**：大量供应商配置可能超出限制（5-10MB）
- **缓解**：合理设计数据结构，避免冗余
- **应对**：定期清理无用配置，提供导入/导出功能

**风险 2：多适配器加载**
- **影响**：打包体积增大
- **缓解**：动态导入（code splitting）
- **应对**：按需加载适配器

---

## 11. 成功指标

### 11.1 功能完整性

- ✅ 支持 4 个预设供应商（OpenAI、Gemini、Banana-pro、豆包）
- ✅ 支持添加自定义供应商
- ✅ 支持供应商配置管理（增删改）
- ✅ 支持模型启用/禁用
- ✅ 支持供应商切换
- ✅ 节点正确绑定供应商
- ✅ 适配器正确调用 API

### 11.2 用户体验

- ✅ 首次配置流程 < 2 分钟
- ✅ 供应商切换 < 5 秒
- ✅ 错误提示清晰易懂
- ✅ 所有操作有即时反馈

### 11.3 代码质量

- ✅ 单元测试覆盖率 > 80%
- ✅ 无 TypeScript 类型错误
- ✅ 遵循项目代码规范
- ✅ 文档完整清晰

---

## 12. 后续优化方向

### 12.1 短期优化（1-2 周）

- [ ] 添加供应商配置导入/导出功能
- [ ] 添加 API 调用统计（次数、成本）
- [ ] 优化错误提示（更详细的错误信息）
- [ ] 添加供应商文档链接

### 12.2 中期优化（1-2 月）

- [ ] 支持更多供应商（Midjourney、Replicate 等）
- [ ] 智能供应商推荐（根据需求推荐最合适的供应商）
- [ ] 供应商性能监控（响应时间、成功率）
- [ ] 批量操作（批量切换节点供应商）

### 12.3 长期优化（3+ 月）

- [ ] 供应商市场（社区共享供应商配置）
- [ ] 智能降级（主供应商失败时自动切换）
- [ ] 成本优化建议（分析使用情况，推荐更经济的方案）
- [ ] 企业级功能（配额管理、权限控制）

---

## 13. 附录

### 13.1 参考资料

- [Cherry Studio Provider 架构分析](../cherry-studio-provider-analysis.md)
- [OpenAI Images API 文档](https://platform.openai.com/docs/api-reference/images)
- [Google Gemini API 文档](https://ai.google.dev/tutorials/image_generation)
- [Vercel AI SDK 文档](https://sdk.vercel.ai/docs)

### 13.2 词汇表

| 术语 | 说明 |
|------|------|
| Provider | 供应商，提供图像生成 API 的服务商 |
| Adapter | 适配器，封装不同供应商 API 差异的类 |
| Preset Provider | 预设供应商，内置的主流供应商 |
| Custom Provider | 自定义供应商，用户手动添加的供应商 |
| Active Provider | 激活供应商，当前全局默认使用的供应商 |
| Node Provider | 节点供应商，节点绑定的供应商（创建时确定） |

### 13.3 文件清单

**新增文件（9 个）：**

1. `src/config/imageProviders.js`
2. `src/stores/providers.js`
3. `src/api/providers/base.js`
4. `src/api/providers/openai.js`
5. `src/api/providers/gemini.js`
6. `src/api/providers/doubao.js`
7. `src/api/providers/index.js`
8. `src/components/AddCustomProviderModal.vue`
9. `src/components/AddModelModal.vue`

**修改文件（3 个）：**

1. `src/components/ApiSettings.vue`
2. `src/components/nodes/ImageConfigNode.vue`
3. `src/components/nodes/VideoConfigNode.vue`

---

## 14. 审批与确认

**设计审批：**
- [ ] 产品负责人审批
- [ ] 技术负责人审批
- [ ] 用户体验审批

**准备开始实施：**
- [ ] 创建 feature 分支
- [ ] 设置开发环境
- [ ] 分配开发任务

---

**文档结束**
