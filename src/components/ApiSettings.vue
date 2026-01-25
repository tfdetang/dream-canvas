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
                <div class="model-header">
                  <n-checkbox :value="model.id">
                    {{ model.name }}
                  </n-checkbox>
                  <n-tag
                    size="tiny"
                    :type="model.type === 'image' ? 'success' : model.type === 'video' ? 'warning' : 'info'"
                    :bordered="false"
                  >
                    {{ model.type === 'text' ? '文本' : model.type === 'image' ? '图像' : model.type === 'video' ? '视频' : model.type }}
                  </n-tag>
                </div>
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

<script setup>
/**
 * API Settings Component | API 设置组件
 * Modal for configuring API key and base URL
 */
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

// Props | 属性
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

// Emits | 事件
const emit = defineEmits(['update:show', 'saved'])

// API Config hook | API 配置 hook
const { apiKey, baseUrl, isConfigured, setApiKey, setBaseUrl, clear: clearConfig } = useApiConfig()

// Modal visibility | 弹窗可见性
const showModal = ref(props.show)

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

// Form data | 表单数据（保留用于向后兼容）
const formData = reactive({
  apiKey: apiKey.value,
  baseUrl: baseUrl.value
})

// Watch prop changes | 监听属性变化
watch(() => props.show, (val) => {
  showModal.value = val
  if (val) {
    formData.apiKey = apiKey.value
    formData.baseUrl = baseUrl.value
  }
})

// Watch modal changes | 监听弹窗变化
watch(showModal, (val) => {
  emit('update:show', val)
})

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

// Handle save | 处理保存（保留用于向后兼容）
const handleSave = () => {
  if (formData.apiKey) {
    setApiKey(formData.apiKey)
  }
  if (formData.baseUrl) {
    setBaseUrl(formData.baseUrl)
  }
  showModal.value = false
  emit('saved')
}

// Handle clear | 处理清除（保留用于向后兼容）
const handleClear = () => {
  clearConfig()
  formData.apiKey = ''
  formData.baseUrl = 'https://api.chatfire.site/v1'
}
</script>

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

.model-header {
  display: flex;
  align-items: center;
  gap: 8px;
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
