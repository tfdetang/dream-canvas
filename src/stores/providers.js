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

// 防抖计时器
let saveTimer = null

// 将响应式对象转换为普通对象
const toPlainObject = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

const saveProviders = () => {
  // 清除之前的计时器
  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  // 使用防抖，300ms 后才真正保存
  saveTimer = setTimeout(() => {
    try {
      // 转换为普通对象以加速序列化
      const plainData = {
        activeProviderId: activeProviderId.value,
        providers: toPlainObject(providers.value)
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(plainData))
      console.log('[Providers] Saved to localStorage')
    } catch (error) {
      console.error('[Providers] Failed to save:', error)
      window.$message?.error('保存供应商配置失败')
    }
  }, 300)
}

// 导出供外部立即保存使用
export const saveProvidersNow = () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  try {
    const plainData = {
      activeProviderId: activeProviderId.value,
      providers: toPlainObject(providers.value)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(plainData))
    console.log('[Providers] Saved immediately to localStorage')
  } catch (error) {
    console.error('[Providers] Failed to save:', error)
    window.$message?.error('保存供应商配置失败')
  }
}

// 自动初始化
initProviders()

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

export const toggleModel = (providerId, modelId, enabled, skipSave = false) => {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return false

  const model = provider.models.find(m => m.id === modelId)
  if (!model) return false

  model.enabled = enabled

  // 允许跳过保存，用于批量操作
  if (!skipSave) {
    saveProviders()
  }
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
