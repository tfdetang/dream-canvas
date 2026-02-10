<template>
  <!-- Text node wrapper for hover area | 文本节点包裹层，扩展悬浮区域 -->
  <div class="text-node-wrapper">
    <!-- Text node | 文本节点 -->
    <div
      class="text-node resizable-node bg-[var(--bg-secondary)] rounded-xl border relative transition-[border-color,box-shadow] duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'"
      :style="nodeStyle">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <span class="text-sm font-medium text-[var(--text-secondary)]">{{ data.label }}</span>
        <div class="flex items-center gap-1">
          <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
          <button class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14">
              <ExpandOutline />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- Content | 内容 -->
      <div class="p-3 flex flex-col h-[calc(100%-41px)]">
        <textarea
          v-model="content"
          @blur="updateContent"
          @wheel.stop
          @input="updateContent"
          class="w-full flex-1 bg-transparent resize-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
          placeholder="请输入文本内容..."
        />

        <!-- Model selector | 模型选择器 -->
        <div class="mt-2">
          <n-select
            v-if="textModels.length > 0"
            v-model:value="selectedModel"
            @update:value="handleModelChange"
            :options="textModels.map(m => ({ label: `${m.providerName} - ${m.modelName}`, value: m.modelId }))"
            size="small"
            placeholder="选择文本模型"
            :consistent-menu-width="false"
          />
          <div v-else class="text-xs text-[var(--text-secondary)] p-2 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
            请先在设置中配置文本模型
          </div>
        </div>

        <!-- Polish button | 润色按钮 -->
        <button
          @click="handlePolish"
          :disabled="isPolishing || !content.trim() || !selectedModel"
          class="mt-2 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--accent-color)] hover:text-white border border-[var(--border-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <n-spin v-if="isPolishing" :size="12" />
          <span v-else>✨</span>
          AI 润色
        </button>
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="source" :position="Position.Right" id="right" class="!bg-[var(--accent-color)]" />
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />

      <!-- Resize handle | 调整大小手柄 -->
      <div 
        class="resize-handle"
        @mousedown="startResize"
        @touchstart.prevent="startResize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M9 1v8H1" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- Hover action buttons | 悬浮操作按钮 -->
    <!-- Top right - Copy button | 右上角 - 复制按钮 -->
    <div class="node-actions absolute -top-5 right-12 z-[1000]">
      <button @click="handleDuplicate"
        class="action-btn group p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center gap-0 hover:gap-1.5 w-max transition-[gap] duration-150">
        <n-icon :size="16" class="text-gray-600 dark:text-gray-300">
          <CopyOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 dark:text-gray-300 max-w-0 overflow-hidden group-hover:max-w-[60px] transition-[max-width] duration-150 whitespace-nowrap">复制</span>
      </button>
    </div>

    <!-- Right side - Action buttons | 右侧 - 操作按钮 -->
    <div
      class="node-actions absolute right-10 top-1/2 -translate-y-1/2 translate-x-full flex flex-col gap-2 z-[1000]">
      <!-- Image generation button | 图片生成按钮 -->
      <button @click="handleImageGen"
        class="action-btn group p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center gap-0 hover:gap-1.5 w-max transition-[gap] duration-150">
        <n-icon :size="16" class="text-gray-600 dark:text-gray-300">
          <ImageOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 dark:text-gray-300 max-w-0 overflow-hidden group-hover:max-w-[80px] transition-[max-width] duration-150 whitespace-nowrap">图片生成</span>
      </button>
      <!-- Video generation button | 视频生成按钮 -->
      <button @click="handleVideoGen"
        class="action-btn group p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center gap-0 hover:gap-1.5 w-max transition-[gap] duration-150">
        <n-icon :size="16" class="text-gray-600 dark:text-gray-300">
          <VideocamOutline />
        </n-icon>
        <span
          class="text-xs text-gray-600 dark:text-gray-300 max-w-0 overflow-hidden group-hover:max-w-[80px] transition-[max-width] duration-150 whitespace-nowrap">视频生成</span>
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Text node component | 文本节点组件
 * Allows user to input and edit text content
 */
import { ref, watch, nextTick, computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin, NSelect } from 'naive-ui'
import { TrashOutline, ExpandOutline, CopyOutline, ImageOutline, VideocamOutline } from '@vicons/ionicons5'
import { updateNode, removeNode, duplicateNode, addNode, addEdge, nodes, edges } from '../../stores/canvas'
import { useChat, useNodeResize } from '../../hooks'
import { getAllTextModels, getModelConfigById } from '../../stores/providers'
import { getPolishPrompt } from '../../utils/promptPolish'

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// Node resize | 节点调整大小
const { nodeStyle, startResize } = useNodeResize(props.id, props.data, {
  minWidth: 250,
  minHeight: 150,
  maxWidth: 500,
  maxHeight: 400
})

// Get all available text models | 获取所有可用的文本模型
const textModels = computed(() => getAllTextModels())

// Local content state | 本地内容状态
const content = ref(props.data?.content || '')

// Selected model state | 选择的模型状态
const selectedModel = ref(props.data?.selectedModel || textModels.value[0]?.modelId || null)

// Polish loading state | 润色加载状态
const isPolishing = ref(false)

// Watch for external data changes | 监听外部数据变化
watch(() => props.data?.content, (newVal) => {
  if (newVal !== content.value) {
    content.value = newVal
  }
})

watch(() => props.data?.selectedModel, (newVal) => {
  if (newVal !== selectedModel.value) {
    selectedModel.value = newVal
  }
})

// Update content in store | 更新存储中的内容
const updateContent = () => {
  updateNode(props.id, { content: content.value })
}

// Handle model change | 处理模型变化
const handleModelChange = (modelId) => {
  selectedModel.value = modelId
  updateNode(props.id, { selectedModel: modelId })
}

// Get connected input images | 获取连接的输入图片
const getConnectedImages = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const images = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'image') {
      // Prefer base64, fallback to url | 优先使用 base64，回退到 url
      const imageData = sourceNode.data?.base64 || sourceNode.data?.url
      if (imageData) {
        images.push({
          data: imageData,
          order: edge.data?.imageOrder || 1
        })
      }
    }
  }

  // Sort by order | 按顺序排序
  images.sort((a, b) => a.order - b.order)
  return images.map(img => img.data)
}

// Handle AI polish | 处理 AI 润色
const handlePolish = async () => {
  const input = content.value.trim()
  if (!input) {
    window.$message?.warning('请输入要润色的文本内容')
    return
  }

  // Check if model is selected | 检查是否选择了模型
  if (!selectedModel.value) {
    window.$message?.warning('请先选择一个文本模型')
    return
  }

  // Get model config | 获取模型配置
  const modelConfig = getModelConfigById(selectedModel.value)
  if (!modelConfig || !modelConfig.apiKey) {
    window.$message?.warning('请先在设置中配置 API Key')
    return
  }

  // Get connected reference images | 获取连接的参考图
  const referenceImages = getConnectedImages()

  isPolishing.value = true
  const originalContent = content.value

  try {
    // Get polish prompt based on input language | 根据输入语言获取润色 prompt
    const polishConfig = getPolishPrompt(input)

    // 在用户消息前加上语言要求，确保输出语言正确
    const languageHint = polishConfig.language === 'zh'
      ? '【请用中文润色以下内容】\n'
      : '【Please polish the following content in English】\n'

    const textMessage = languageHint + input

    // Create chat hook with dynamic provider config | 使用动态提供商配置创建 chat hook
    const { send: sendChat } = useChat({
      systemPrompt: polishConfig.system,
      model: selectedModel.value,
      providerConfig: {
        apiKey: modelConfig.apiKey,
        baseUrl: modelConfig.baseUrl,
        models: modelConfig.models  // 添加 models 数组，用于 adapter 检测
      },
      providerId: modelConfig.providerId  // 添加 providerId，用于选择正确的 adapter
    })

    let result

    // 如果有参考图，使用多模态输入
    if (referenceImages.length > 0) {
      console.log('[TextNode] Polishing with reference images:', referenceImages.length)

      // Call chat API with images | 调用 AI API 并携带图片
      result = await sendChat(textMessage, true, referenceImages)

      window.$message?.info(`正在使用 ${referenceImages.length} 张参考图进行润色...`)
    } else {
      // 纯文本润色
      result = await sendChat(textMessage, true)
    }

    if (result) {
      content.value = result
      updateNode(props.id, { content: result })
      window.$message?.success(`提示词已润色 (${polishConfig.label})`)
    }
  } catch (err) {
    content.value = originalContent
    window.$message?.error(err.message || '润色失败')
  } finally {
    isPolishing.value = false
  }
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
}

// Handle duplicate | 处理复制
const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  window.$message?.success('节点已复制')
  if (newNodeId) {
    setTimeout(() => {
      updateNodeInternals(newNodeId)
    }, 50)
  }
}

// Handle image generation | 处理图片生成
const handleImageGen = () => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create imageConfig node | 创建text生图配置节点
  const configNodeId = addNode('imageConfig', { x: nodeX + 400, y: nodeY }, {
    model: 'doubao-seedream-4-5-251128',
    size: '2048x2048',
    label: '文生图'
  })

  // Auto connect | 自动连接
  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(configNodeId)
  }, 50)
}

// Handle video generation | 处理视频生成
const handleVideoGen = () => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create videoConfig node | 创建视频配置节点
  const configNodeId = addNode('videoConfig', { x: nodeX + 400, y: nodeY }, {
    label: '视频生成'
  })

  // Auto connect | 自动连接
  addEdge({
    source: props.id,
    target: configNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(configNodeId)
  }, 50)
}
</script>

<style scoped>
.text-node-wrapper {
  padding-right: 50px;
  padding-top: 20px;
  position: relative;
}

.text-node {
  cursor: default;
  position: relative;
  min-width: 250px;
  min-height: 150px;
}

.text-node textarea {
  cursor: text;
}

/* Hover actions - hidden by default, shown on wrapper hover | 悬浮操作 - 默认隐藏，wrapper 悬浮时显示 */
.node-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease-out;
}

.text-node-wrapper:hover .node-actions {
  opacity: 1;
  pointer-events: auto;
}

/* Resize handle | 调整大小手柄 */
.resize-handle {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.15s ease-out;
  border-radius: 0 0 8px 0;
}

.text-node:hover .resize-handle {
  opacity: 0.6;
}

.resize-handle:hover {
  opacity: 1 !important;
  color: var(--accent-color);
}
</style>
