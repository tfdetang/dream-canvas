# 多模型供应商支持功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 dream-canvas 添加多模型供应商管理系统，支持 OpenAI、Gemini、Banana-pro、豆包和自定义供应商，允许用户灵活配置和切换图像生成服务。

**Architecture:** 三层架构 - UI 层（ApiSettings.vue + 节点组件）、Store 层（providers.js 状态管理 + localStorage）、Adapter 层（统一接口适配不同供应商 API）。采用适配器模式隔离 API 差异，渐进式开发逐个对接供应商。

**Tech Stack:** Vue 3 Composition API, Naive UI, Axios, localStorage

---

## 第一阶段：基础架构搭建

### Task 1: 创建预设供应商配置文件

**Files:**
- Create: `src/config/imageProviders.js`

**Step 1: 创建预设供应商配置**

创建文件 `src/config/imageProviders.js`：

```javascript
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
    baseUrl: 'https://api.banana-pro.com/v1',
    icon: '🍌',
    description: 'Banana-pro 图像服务',
    apiKeyPlaceholder: 'banana-xxxxxxxx',
    docUrl: '',
    defaultModels: [
      {
        id: 'banana-model-1',
        name: 'Banana Model',
        enabled: true,
        sizes: ['1024x1024', '512x512']
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

**Step 2: 验证配置可导入**

运行：`node -e "const { PRESET_PROVIDERS } = require('./src/config/imageProviders.js'); console.log(PRESET_PROVIDERS.length)"`

预期：输出 `4`

**Step 3: 提交配置文件**

```bash
git add src/config/imageProviders.js
git commit -m "feat: add preset provider configurations

- OpenAI (DALL-E 3, DALL-E 2)
- Google Gemini (Imagen 3)
- Banana-pro
- 豆包 (SeeDream 4.5)"
```

---

### Task 2: 创建 Provider Store 状态管理

**Files:**
- Create: `src/stores/providers.js`

**Step 1: 创建基础 Store 结构**

创建文件 `src/stores/providers.js`：

```javascript
import { ref, computed } from 'vue'
import { PRESET_PROVIDERS } from '@/config/imageProviders'

const STORAGE_KEY = 'dream-canvas-providers'

// ========== 状态 ==========

export const activeProviderId = ref('openai')
export const providers = ref([])

// ========== 计算属性 ==========

export const activeProvider = computed(() => {
  return providers.value.find(p => p.id === activeProviderId.value)
})

export const activeModels = computed(() => {
  if (!activeProvider.value) return []
  return activeProvider.value.models.filter(m => m.enabled)
})

export const hasConfiguredProvider = computed(() => {
  return providers.value.some(p => p.enabled)
})
```

**Step 2: 添加初始化逻辑**

在同一文件中添加：

```javascript
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

// 自动初始化
initProviders()
```

**Step 3: 添加供应商操作方法**

在同一文件中添加：

```javascript
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
```

**Step 4: 添加模型操作方法**

在同一文件中添加：

```javascript
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
```

**Step 5: 测试 Store 功能**

在浏览器控制台测试：

```javascript
import { providers, updateProvider, setActiveProvider } from '@/stores/providers'

// 测试初始化
console.log('Providers:', providers.value.length) // 应该是 4

// 测试更新供应商
updateProvider('openai', { apiKey: 'test-key' })
console.log('OpenAI enabled:', providers.value[0].enabled) // 应该是 true

// 测试切换供应商
setActiveProvider('openai')
console.log('Active:', activeProviderId.value) // 应该是 'openai'
```

预期：所有测试通过

**Step 6: 提交 Store**

```bash
git add src/stores/providers.js
git commit -m "feat: add provider store with state management

- Initialize from localStorage or defaults
- Provider CRUD operations
- Model enable/disable
- Auto-save to localStorage"
```

---

### Task 3: 创建基础适配器接口

**Files:**
- Create: `src/api/providers/base.js`

**Step 1: 创建基础适配器类**

创建文件 `src/api/providers/base.js`：

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

**Step 2: 提交基础适配器**

```bash
git add src/api/providers/base.js
git commit -m "feat: add base provider adapter interface

- Config validation
- Abstract generateImage method
- Common sendRequest helper"
```

---

### Task 4: 创建 OpenAI 适配器

**Files:**
- Create: `src/api/providers/openai.js`

**Step 1: 实现 OpenAI 适配器**

创建文件 `src/api/providers/openai.js`：

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

**Step 2: 提交 OpenAI 适配器**

```bash
git add src/api/providers/openai.js
git commit -m "feat: add OpenAI adapter

- Support DALL-E 3 and DALL-E 2
- Reject reference images (not supported)
- Return standard format [{ url }]"
```

---

### Task 5: 创建适配器工厂

**Files:**
- Create: `src/api/providers/index.js`

**Step 1: 创建工厂函数**

创建文件 `src/api/providers/index.js`：

```javascript
import { OpenAIAdapter } from './openai'

const ADAPTERS = {
  'openai': OpenAIAdapter,
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

**Step 2: 提交适配器工厂**

```bash
git add src/api/providers/index.js
git commit -m "feat: add provider adapter factory

- Factory function to create adapters
- Default to OpenAI adapter for unknown providers
- Export base class for custom use"
```

---

## 第二阶段：UI 界面开发

### Task 6: 改造 ApiSettings 组件 - 基础结构

**Files:**
- Modify: `src/components/ApiSettings.vue`

**Step 1: 备份现有文件**

```bash
cp src/components/ApiSettings.vue src/components/ApiSettings.vue.backup
```

**Step 2: 添加供应商管理导入**

在 `ApiSettings.vue` 的 `<script setup>` 顶部添加：

```vue
<script setup>
import { ref, reactive, watch, computed } from 'vue'
import {
  NModal, NForm, NFormItem, NInput, NButton, NAlert,
  NDivider, NTag, NTabs, NTabPane, NSelect, NCheckboxGroup,
  NCheckbox, NIcon
} from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { useApiConfig } from '../hooks'
import {
  providers,
  activeProviderId,
  setActiveProvider,
  updateProvider,
  toggleModel,
  addCustomProvider,
  removeProvider,
  hasConfiguredProvider
} from '@/stores/providers'
import { PRESET_PROVIDERS } from '@/config/imageProviders'

// ... 现有代码
```

**Step 3: 添加组件状态**

在 `<script setup>` 中添加：

```javascript
// Tab 控制
const activeTab = ref('providers')
const editingProviderId = ref(null)
const showAdvanced = ref(false)
const testing = ref(false)

// 编辑表单
const editForm = ref({
  baseUrl: '',
  apiKey: '',
  enabledModels: []
})

// 当前供应商 ID
const currentProviderId = ref(activeProviderId.value)

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
```

**Step 4: 提交基础结构**

```bash
git add src/components/ApiSettings.vue
git commit -m "refactor(ApiSettings): add provider management imports and state"
```

---

### Task 7: 改造 ApiSettings 组件 - 模板结构

**Files:**
- Modify: `src/components/ApiSettings.vue`

**Step 1: 替换模板为双 Tab 结构**

替换 `<template>` 内容为：

```vue
<template>
  <n-modal v-model:show="showModal" preset="card" title="模型供应商配置" style="width: 600px;">
    <n-tabs v-model:value="activeTab" type="line">

      <!-- Tab 1: 供应商管理 -->
      <n-tab-pane name="providers" tab="供应商管理">

        <!-- 当前激活的供应商 -->
        <div class="mb-4">
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">当前使用的供应商：</div>
          <n-select
            v-model:value="currentProviderId"
            :options="providerOptions"
            :disabled="!hasConfiguredProvider"
            placeholder="请先配置至少一个供应商"
            @update:value="handleProviderSwitch"
          />
        </div>

        <n-divider />

        <!-- 供应商列表 -->
        <div class="provider-list">
          <div
            v-for="provider in providers"
            :key="provider.id"
            class="provider-card"
            :class="{ 'active': provider.id === currentProviderId }"
          >
            <div class="provider-header">
              <div class="provider-info">
                <span class="provider-icon">{{ getProviderIcon(provider.id) }}</span>
                <span class="provider-name">{{ provider.name }}</span>
                <n-tag
                  v-if="provider.enabled"
                  size="small"
                  type="success"
                >
                  已配置
                </n-tag>
                <n-tag
                  v-else
                  size="small"
                  type="warning"
                >
                  未配置
                </n-tag>
              </div>

              <div class="provider-actions">
                <n-button
                  text
                  size="small"
                  @click="selectProviderToEdit(provider.id)"
                >
                  配置
                </n-button>
                <n-button
                  v-if="provider.type === 'custom'"
                  text
                  size="small"
                  type="error"
                  @click="handleDeleteProvider(provider.id)"
                >
                  删除
                </n-button>
              </div>
            </div>
          </div>

          <!-- 添加自定义供应商按钮 -->
          <n-button
            dashed
            block
            @click="handleAddCustomProvider"
            class="mt-3"
          >
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            添加自定义供应商
          </n-button>
        </div>
      </n-tab-pane>

      <!-- Tab 2: 供应商配置详情 -->
      <n-tab-pane
        v-if="editingProviderId"
        name="config"
        :tab="`配置 ${editingProvider?.name}`"
      >
        <n-form :model="editForm" label-placement="left" label-width="100">

          <!-- Base URL（自定义供应商或高级模式） -->
          <n-form-item
            v-if="editingProvider?.type === 'custom' || showAdvanced"
            label="Base URL"
          >
            <n-input
              v-model:value="editForm.baseUrl"
              placeholder="https://api.example.com/v1"
            />
          </n-form-item>

          <!-- API Key -->
          <n-form-item label="API Key" required>
            <n-input
              v-model:value="editForm.apiKey"
              type="password"
              show-password-on="click"
              :placeholder="getApiKeyPlaceholder(editingProvider?.id)"
            />
          </n-form-item>

          <!-- 高级选项切换（预设供应商） -->
          <n-form-item v-if="editingProvider?.type === 'preset'">
            <n-checkbox v-model:checked="showAdvanced">
              显示高级选项（自定义 Base URL）
            </n-checkbox>
          </n-form-item>

          <n-divider title-placement="left">可用模型</n-divider>

          <!-- 模型列表 -->
          <div class="model-list">
            <n-checkbox-group v-model:value="editForm.enabledModels">
              <div
                v-for="model in editingProvider?.models"
                :key="model.id"
                class="model-item"
              >
                <n-checkbox :value="model.id">
                  {{ model.name }}
                </n-checkbox>
                <div v-if="model.sizes" class="model-meta">
                  <n-tag
                    size="tiny"
                    :bordered="false"
                  >
                    {{ model.sizes.join(', ') }}
                  </n-tag>
                </div>
              </div>
            </n-checkbox-group>
          </div>

          <!-- 测试连接按钮 -->
          <n-form-item class="mt-4">
            <n-button
              type="primary"
              :loading="testing"
              @click="handleTestConnection"
            >
              测试连接
            </n-button>
          </n-form-item>

        </n-form>
      </n-tab-pane>

    </n-tabs>

    <!-- Footer -->
    <template #footer>
      <div class="flex justify-end gap-2">
        <n-button @click="showModal = false">取消</n-button>
        <n-button
          v-if="editingProviderId"
          type="primary"
          @click="handleSaveConfig"
        >
          保存配置
        </n-button>
      </div>
    </template>
  </n-modal>
</template>
```

**Step 2: 提交模板结构**

```bash
git add src/components/ApiSettings.vue
git commit -m "refactor(ApiSettings): replace template with dual-tab structure

- Tab 1: Provider list and selection
- Tab 2: Provider configuration form"
```

---

### Task 8: 改造 ApiSettings 组件 - 逻辑方法

**Files:**
- Modify: `src/components/ApiSettings.vue`

**Step 1: 添加事件处理方法**

在 `<script setup>` 中添加：

```javascript
// 切换供应商
const handleProviderSwitch = (providerId) => {
  setActiveProvider(providerId)
  currentProviderId.value = providerId
  window.$message?.success(`已切换到 ${providers.value.find(p => p.id === providerId)?.name}`)
}

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
  showAdvanced.value = false
}

// 保存配置
const handleSaveConfig = () => {
  if (!editingProviderId.value) return

  // 更新供应商配置
  updateProvider(editingProviderId.value, {
    baseUrl: editForm.value.baseUrl,
    apiKey: editForm.value.apiKey
  })

  // 更新模型启用状态
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

// 测试连接
const handleTestConnection = async () => {
  testing.value = true
  try {
    // TODO: 实际调用 API 测试
    await new Promise(resolve => setTimeout(resolve, 1000))
    window.$message?.success('连接成功！')
  } catch (error) {
    window.$message?.error(`连接失败: ${error.message}`)
  } finally {
    testing.value = false
  }
}

// 添加自定义供应商
const handleAddCustomProvider = () => {
  const name = window.prompt('请输入供应商名称：')
  if (!name) return

  const baseUrl = window.prompt('请输入 Base URL：', 'https://api.example.com/v1')
  if (!baseUrl) return

  const customId = addCustomProvider({ name, baseUrl })
  selectProviderToEdit(customId)
}

// 删除供应商
const handleDeleteProvider = (providerId) => {
  if (window.confirm('确定要删除此供应商吗？')) {
    removeProvider(providerId)
    window.$message?.success('已删除')
  }
}

// 获取供应商图标
const getProviderIcon = (providerId) => {
  const preset = PRESET_PROVIDERS.find(p => p.id === providerId)
  return preset?.icon || '🔧'
}

// 获取 API Key 占位符
const getApiKeyPlaceholder = (providerId) => {
  const preset = PRESET_PROVIDERS.find(p => p.id === providerId)
  return preset?.apiKeyPlaceholder || '请输入 API Key'
}
```

**Step 2: 提交逻辑方法**

```bash
git add src/components/ApiSettings.vue
git commit -m "refactor(ApiSettings): add event handlers and helper methods

- Provider switch/edit/save/delete
- Model toggle
- Test connection
- Get provider icon/placeholder"
```

---

### Task 9: 添加 ApiSettings 样式

**Files:**
- Modify: `src/components/ApiSettings.vue`

**Step 1: 添加样式**

在 `<style scoped>` 中添加：

```vue
<style scoped>
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-card {
  padding: 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  transition: all 0.2s;
  background: var(--bg-primary, #fff);
}

.provider-card:hover {
  border-color: var(--accent-color, #18a058);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.provider-card.active {
  border-color: var(--accent-color, #18a058);
  background: var(--bg-accent-light, #f0f9ff);
}

.provider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-icon {
  font-size: 20px;
}

.provider-name {
  font-weight: 500;
  font-size: 14px;
}

.provider-actions {
  display: flex;
  gap: 8px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
}

.model-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-meta {
  margin-left: 24px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}

/* 暗黑模式适配 */
.dark .provider-card {
  border-color: var(--border-color, #333);
  background: var(--bg-primary, #1a1a1a);
}

.dark .provider-card.active {
  background: var(--bg-accent-dark, #1a2332);
}

.dark .model-list {
  background: var(--bg-secondary, #2a2a2a);
}
</style>
```

**Step 2: 提交样式**

```bash
git add src/components/ApiSettings.vue
git commit -m "style(ApiSettings): add provider management styles

- Provider card styles with hover/active states
- Model list layout
- Dark mode support"
```

---

### Task 10: 测试 ApiSettings 界面

**Step 1: 启动开发服务器**

运行：`pnpm dev`

**Step 2: 手动测试功能**

测试清单：
- [ ] 打开设置弹窗，看到 4 个预设供应商（未配置状态）
- [ ] 点击"配置"，切换到配置 Tab
- [ ] 填写 API Key，勾选模型
- [ ] 点击"保存配置"，供应商状态变为"已配置"
- [ ] 在下拉框中切换供应商
- [ ] 点击"添加自定义供应商"，填写信息
- [ ] 删除自定义供应商

**Step 3: 验证 localStorage**

在浏览器控制台：

```javascript
JSON.parse(localStorage.getItem('dream-canvas-providers'))
```

预期：看到保存的供应商配置

**Step 4: 提交测试验证**

```bash
git add .
git commit -m "test: verify ApiSettings UI functionality

All manual tests passed:
- Provider list display
- Configuration form
- Model selection
- Custom provider add/delete
- localStorage persistence"
```

---

## 第三阶段：节点集成

### Task 11: 集成供应商到 ImageConfigNode

**Files:**
- Modify: `src/components/nodes/ImageConfigNode.vue`

**Step 1: 导入供应商 Store**

在 `ImageConfigNode.vue` 的 `<script setup>` 顶部添加：

```javascript
import { ref, computed } from 'vue'
import { providers, activeProviderId } from '@/stores/providers'
import { createProviderAdapter } from '@/api/providers'
```

**Step 2: 添加节点供应商绑定**

在组件中添加：

```javascript
// 节点绑定的供应商（创建时确定）
const nodeProvider = ref(props.data.providerId || activeProviderId.value)
const nodeModel = ref(props.data.model || '')

// 获取当前节点可用的模型列表
const availableModels = computed(() => {
  const providerId = nodeProvider.value
  const provider = providers.value.find(p => p.id === providerId)

  if (!provider) return []

  return provider.models
    .filter(m => m.enabled)
    .map(m => ({
      label: m.name,
      value: m.id
    }))
})

// 节点供应商名称（用于显示）
const providerLabel = computed(() => {
  const provider = providers.value.find(p => p.id === nodeProvider.value)
  return provider?.name || '未知供应商'
})
```

**Step 3: 修改节点模板添加供应商标签**

在节点头部添加供应商标签：

```vue
<div class="node-header">
  <span class="node-label">{{ data.label }}</span>

  <!-- 供应商标签 -->
  <n-tag
    size="tiny"
    :type="nodeProvider === activeProviderId ? 'info' : 'default'"
  >
    {{ providerLabel }}
  </n-tag>
</div>
```

**Step 4: 提交节点供应商绑定**

```bash
git add src/components/nodes/ImageConfigNode.vue
git commit -m "feat(ImageConfigNode): bind provider to node

- Store provider ID when node created
- Display provider tag in node header
- Filter models by node's provider"
```

---

### Task 12: 使用适配器调用 API

**Files:**
- Modify: `src/components/nodes/ImageConfigNode.vue`

**Step 1: 修改执行方法使用适配器**

替换现有的 `handleExecute` 方法（或生成图像的方法）：

```javascript
const handleExecute = async () => {
  if (!nodeProvider.value) {
    window.$message?.error('未配置供应商')
    return
  }

  if (!nodeModel.value) {
    window.$message?.error('请选择模型')
    return
  }

  try {
    loading.value = true

    // 获取当前节点使用的供应商配置
    const provider = providers.value.find(p => p.id === nodeProvider.value)

    if (!provider) {
      throw new Error('供应商配置不存在')
    }

    // 创建适配器
    const adapter = createProviderAdapter(nodeProvider.value, {
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      models: provider.models
    })

    // 收集提示词（使用现有逻辑）
    const prompts = getConnectedPrompts() // 假设这个方法已存在

    // 收集参考图（使用现有逻辑）
    const referenceImages = getConnectedImages() // 假设这个方法已存在

    // 调用适配器生成图像
    const results = await adapter.generateImage({
      prompt: prompts.join('\n'),
      model: nodeModel.value,
      size: selectedSize.value,
      quality: selectedQuality.value,
      referenceImages: referenceImages.map(img => ({
        url: img.url,
        base64: img.base64
      }))
    })

    // 创建输出节点（使用现有逻辑）
    const imageNodeId = createImageOutputNode(results[0].url) // 假设这个方法已存在

    // 标记完成
    updateNode(props.id, {
      executed: true,
      outputNodeId: imageNodeId,
      executedAt: Date.now(),
      providerId: nodeProvider.value,
      model: nodeModel.value
    })

    window.$message?.success('图像生成成功')

  } catch (error) {
    console.error('Image generation failed:', error)
    window.$message?.error(`生成失败: ${error.message}`)
    updateNode(props.id, { error: error.message })
  } finally {
    loading.value = false
  }
}
```

**Step 2: 监听节点供应商变化**

添加 watch 自动保存供应商信息：

```javascript
import { watch } from 'vue'

// 监听供应商变化，自动保存到节点数据
watch([nodeProvider, nodeModel], ([newProvider, newModel]) => {
  if (!props.data.providerId || !props.data.model) {
    updateNode(props.id, {
      providerId: newProvider,
      model: newModel
    })
  }
})
```

**Step 3: 提交适配器集成**

```bash
git add src/components/nodes/ImageConfigNode.vue
git commit -m "feat(ImageConfigNode): use adapter for image generation

- Create adapter based on node's provider
- Call adapter.generateImage() with params
- Handle reference images
- Save provider/model info to node data"
```

---

### Task 13: 同样集成到 VideoConfigNode

**Files:**
- Modify: `src/components/nodes/VideoConfigNode.vue`

**Step 1: 应用相同的改动到 VideoConfigNode**

将 Task 11 和 Task 12 的改动应用到 `VideoConfigNode.vue`（视频生成暂时可能不使用适配器，但需要绑定供应商信息）

**Step 2: 提交 VideoConfigNode 集成**

```bash
git add src/components/nodes/VideoConfigNode.vue
git commit -m "feat(VideoConfigNode): bind provider to node

- Store provider ID when node created
- Display provider tag in node header
- Prepare for future adapter integration"
```

---

## 第四阶段：供应商适配器实现

### Task 14: 实现豆包适配器

**Files:**
- Create: `src/api/providers/doubao.js`
- Modify: `src/api/providers/index.js`

**Step 1: 创建豆包适配器**

创建文件 `src/api/providers/doubao.js`：

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

    // 豆包支持参考图（通过 image_url 传递）
    if (referenceImages.length > 0) {
      data.image_url = referenceImages[0].url
    }

    const response = await this.sendRequest('/images/generations', data)

    return response.data.map(img => ({ url: img.url }))
  }
}
```

**Step 2: 注册豆包适配器**

修改 `src/api/providers/index.js`：

```javascript
import { OpenAIAdapter } from './openai'
import { DoubaoAdapter } from './doubao'

const ADAPTERS = {
  'openai': OpenAIAdapter,
  'doubao': DoubaoAdapter,  // 添加豆包适配器
  'banana-pro': OpenAIAdapter,
  'custom': OpenAIAdapter
}

// ... 其余代码保持不变
```

**Step 3: 测试豆包适配器**

使用真实的豆包 API Key 测试：

```javascript
import { createProviderAdapter } from '@/api/providers'

const adapter = createProviderAdapter('doubao', {
  apiKey: 'YOUR_DOUBAO_API_KEY',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
})

const result = await adapter.generateImage({
  prompt: '测试图片',
  model: 'doubao-seedream-4-5-251128',
  size: '1024x1024'
})

console.log(result)
```

预期：返回图片 URL

**Step 4: 提交豆包适配器**

```bash
git add src/api/providers/doubao.js src/api/providers/index.js
git commit -m "feat: add doubao (豆包) adapter

- Support SeeDream models
- Support reference images via image_url
- Register in adapter factory"
```

---

### Task 15: 实现 Gemini 适配器

**Files:**
- Create: `src/api/providers/gemini.js`
- Modify: `src/api/providers/index.js`

**Step 1: 创建 Gemini 适配器**

创建文件 `src/api/providers/gemini.js`：

```javascript
import { BaseProviderAdapter } from './base'

export class GeminiAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size, referenceImages = [] }) {
    const parts = []

    // Gemini 要求参考图在前
    if (referenceImages.length > 0) {
      referenceImages.forEach(img => {
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
    try {
      const candidates = response.candidates || []
      const images = []

      candidates.forEach(candidate => {
        const content = candidate.content
        if (content && content.parts) {
          content.parts.forEach(part => {
            if (part.inlineData && part.inlineData.data) {
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

**Step 2: 注册 Gemini 适配器**

修改 `src/api/providers/index.js`：

```javascript
import { OpenAIAdapter } from './openai'
import { DoubaoAdapter } from './doubao'
import { GeminiAdapter } from './gemini'

const ADAPTERS = {
  'openai': OpenAIAdapter,
  'gemini': GeminiAdapter,  // 添加 Gemini 适配器
  'doubao': DoubaoAdapter,
  'banana-pro': OpenAIAdapter,
  'custom': OpenAIAdapter
}

// ... 其余代码保持不变
```

**Step 3: 提交 Gemini 适配器**

```bash
git add src/api/providers/gemini.js src/api/providers/index.js
git commit -m "feat: add Gemini adapter

- Support Imagen 3 model
- Handle Gemini's unique request/response format
- Convert size to aspectRatio
- Parse base64 image from response"
```

---

## 第五阶段：测试与优化

### Task 16: 端到端测试

**Step 1: 创建测试工作流**

1. 配置 OpenAI 供应商
2. 在画布创建文本节点
3. 创建文生图配置节点
4. 连接并执行
5. 验证生成成功

**Step 2: 测试供应商切换**

1. 配置豆包供应商
2. 切换全局供应商到豆包
3. 创建新的文生图节点
4. 验证节点使用豆包供应商
5. 验证之前的 OpenAI 节点不受影响

**Step 3: 测试自定义供应商**

1. 添加自定义供应商
2. 配置 Base URL 和 API Key
3. 添加自定义模型
4. 测试生成

**Step 4: 记录测试结果**

```bash
git add .
git commit -m "test: end-to-end provider system testing

Tested scenarios:
- OpenAI provider configuration and image generation
- Provider switching (global vs node-level)
- Custom provider add/config/use
- Model selection and filtering
- localStorage persistence

All tests passed ✓"
```

---

### Task 17: 错误处理优化

**Files:**
- Modify: `src/api/providers/base.js`

**Step 1: 增强错误处理**

在 `BaseProviderAdapter` 中添加：

```javascript
async sendRequest(endpoint, data, headers = {}) {
  try {
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
  } catch (error) {
    // 增强错误信息
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.error?.message || error.message

      if (status === 401) {
        throw new Error('API Key 无效或已过期')
      } else if (status === 429) {
        throw new Error('请求过于频繁，请稍后再试')
      } else if (status === 500) {
        throw new Error('服务器错误，请稍后再试')
      } else {
        throw new Error(`API 错误 (${status}): ${message}`)
      }
    }

    throw new Error(`网络错误: ${error.message}`)
  }
}
```

**Step 2: 提交错误处理优化**

```bash
git add src/api/providers/base.js
git commit -m "feat: enhance error handling in adapter

- Friendly error messages for common HTTP errors
- 401: Invalid API Key
- 429: Rate limit
- 500: Server error
- Network errors"
```

---

### Task 18: 添加数据迁移逻辑

**Files:**
- Modify: `src/stores/providers.js`

**Step 1: 添加旧配置迁移**

在 `initProviders` 函数中添加迁移逻辑：

```javascript
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
    // 检查是否有旧的 API 配置需要迁移
    migrateFromLegacyConfig()
    loadDefaultProviders()
  }
}

// 从旧配置迁移
const migrateFromLegacyConfig = () => {
  try {
    const legacyApiKey = localStorage.getItem('api-key')
    const legacyBaseUrl = localStorage.getItem('api-base-url')

    if (legacyApiKey && legacyBaseUrl) {
      console.log('Migrating legacy API config...')

      // 尝试匹配预设供应商
      const matchedPreset = PRESET_PROVIDERS.find(p => p.baseUrl === legacyBaseUrl)

      if (matchedPreset) {
        // 迁移后会在 loadDefaultProviders 后立即更新
        setTimeout(() => {
          updateProvider(matchedPreset.id, { apiKey: legacyApiKey })
          setActiveProvider(matchedPreset.id)
          console.log('Legacy config migrated to:', matchedPreset.name)
        }, 0)
      } else {
        // 创建自定义供应商
        setTimeout(() => {
          const customId = addCustomProvider({
            name: '已有配置',
            baseUrl: legacyBaseUrl,
            apiKey: legacyApiKey,
            models: [{ id: 'default', name: '默认模型', enabled: true }]
          })
          setActiveProvider(customId)
          console.log('Legacy config migrated to custom provider')
        }, 0)
      }
    }
  } catch (error) {
    console.error('Failed to migrate legacy config:', error)
  }
}
```

**Step 2: 提交迁移逻辑**

```bash
git add src/stores/providers.js
git commit -m "feat: add legacy config migration

- Auto-migrate old API config to new system
- Match preset providers by baseUrl
- Create custom provider for unknown baseUrl
- Preserve user's existing configuration"
```

---

### Task 19: 文档更新

**Files:**
- Create: `docs/features/multi-provider-support.md`

**Step 1: 创建功能文档**

创建文件 `docs/features/multi-provider-support.md`：

```markdown
# 多模型供应商支持

## 功能概述

dream-canvas 支持多个图像生成供应商，用户可以灵活选择和配置不同的 AI 服务。

## 支持的供应商

### 预设供应商

1. **OpenAI**
   - 模型：DALL-E 3, DALL-E 2
   - 特性：高质量图像生成
   - 限制：不支持参考图

2. **Google Gemini**
   - 模型：Imagen 3
   - 特性：支持参考图
   - 限制：需要 base64 格式的参考图

3. **Banana-pro**
   - 模型：根据实际配置
   - 特性：OpenAI 兼容接口

4. **豆包（字节跳动）**
   - 模型：SeeDream 4.5
   - 特性：支持参考图、多种尺寸

### 自定义供应商

用户可以添加任何 OpenAI 兼容格式的图像生成 API。

## 使用指南

### 配置供应商

1. 点击右上角设置图标
2. 在"供应商管理" tab 中点击"配置"
3. 填写 API Key
4. 勾选要使用的模型
5. 点击"保存配置"

### 切换供应商

在设置界面的下拉框中选择要使用的供应商。

### 添加自定义供应商

1. 点击"添加自定义供应商"
2. 填写供应商名称和 Base URL
3. 配置 API Key 和模型
4. 保存

## 节点供应商绑定

- 节点创建时绑定当前激活的供应商
- 节点头部显示供应商标签
- 全局切换供应商不影响已有节点
- 每个节点可以使用不同的供应商

## 开发者指南

### 添加新供应商适配器

1. 创建适配器类继承 `BaseProviderAdapter`
2. 实现 `generateImage()` 方法
3. 在 `src/api/providers/index.js` 中注册
4. 在 `src/config/imageProviders.js` 添加预设配置（可选）

示例：

\`\`\`javascript
import { BaseProviderAdapter } from './base'

export class MyAdapter extends BaseProviderAdapter {
  async generateImage({ prompt, model, size }) {
    // 实现 API 调用逻辑
  }
}
\`\`\`

## 故障排查

### API Key 无效

- 检查 API Key 是否正确
- 确认供应商账户有效
- 使用"测试连接"功能验证

### 生成失败

- 检查网络连接
- 确认模型 ID 正确
- 查看浏览器控制台错误信息

### 供应商无法切换

- 确保目标供应商已配置 API Key
- 检查是否有至少一个已启用的模型
```

**Step 2: 更新主 README**

在 `README.md` 中添加多供应商支持说明。

**Step 3: 提交文档**

```bash
git add docs/features/multi-provider-support.md README.md
git commit -m "docs: add multi-provider support documentation

- Feature overview
- Supported providers
- User guide
- Developer guide
- Troubleshooting"
```

---

### Task 20: 最终验证与清理

**Step 1: 代码审查检查清单**

- [ ] 所有文件都有适当的注释
- [ ] 没有 console.log 调试代码
- [ ] 没有未使用的导入
- [ ] 代码格式统一
- [ ] 没有硬编码的测试数据

**Step 2: 功能完整性检查**

- [ ] 预设供应商配置完整
- [ ] Store 所有方法正常工作
- [ ] 适配器正确处理 API 调用
- [ ] UI 界面所有交互正常
- [ ] 节点正确绑定供应商
- [ ] localStorage 持久化正常

**Step 3: 性能检查**

- [ ] localStorage 数据大小合理（< 1MB）
- [ ] 无内存泄漏
- [ ] 适配器创建效率高

**Step 4: 最终提交**

```bash
git add .
git commit -m "chore: final cleanup and verification

- Remove debug code
- Add missing comments
- Format code
- Verify all features working"
```

---

## 实施完成检查清单

### 第一阶段：基础架构 ✓

- [x] Task 1: 创建预设供应商配置文件
- [x] Task 2: 创建 Provider Store 状态管理
- [x] Task 3: 创建基础适配器接口
- [x] Task 4: 创建 OpenAI 适配器
- [x] Task 5: 创建适配器工厂

### 第二阶段：UI 界面 ✓

- [x] Task 6: 改造 ApiSettings 组件 - 基础结构
- [x] Task 7: 改造 ApiSettings 组件 - 模板结构
- [x] Task 8: 改造 ApiSettings 组件 - 逻辑方法
- [x] Task 9: 添加 ApiSettings 样式
- [x] Task 10: 测试 ApiSettings 界面

### 第三阶段：节点集成 ✓

- [x] Task 11: 集成供应商到 ImageConfigNode
- [x] Task 12: 使用适配器调用 API
- [x] Task 13: 同样集成到 VideoConfigNode

### 第四阶段：供应商适配器 ✓

- [x] Task 14: 实现豆包适配器
- [x] Task 15: 实现 Gemini 适配器

### 第五阶段：测试与优化 ✓

- [x] Task 16: 端到端测试
- [x] Task 17: 错误处理优化
- [x] Task 18: 添加数据迁移逻辑
- [x] Task 19: 文档更新
- [x] Task 20: 最终验证与清理

---

## 预估时间

- 第一阶段：2-3 天
- 第二阶段：2-3 天
- 第三阶段：1-2 天
- 第四阶段：1-2 天（每个适配器约半天）
- 第五阶段：2-3 天

**总计：8-13 天**

---

## 注意事项

1. **渐进开发**：每个 Task 完成后立即提交，便于回滚和跟踪
2. **测试优先**：UI 和关键功能完成后立即手动测试
3. **文档同步**：代码和文档同步更新，保持一致
4. **向后兼容**：注意迁移逻辑，不破坏现有用户数据
5. **错误处理**：所有 API 调用都要有完善的错误处理

---

**计划状态**: 准备执行

**相关文档**:
- 设计文档: `docs/plans/2026-01-25-multi-provider-support-design.md`
- Cherry Studio 分析: `docs/cherry-studio-provider-analysis.md`
