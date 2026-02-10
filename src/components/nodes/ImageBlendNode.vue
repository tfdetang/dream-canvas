<template>
  <!-- Image Blend Node wrapper | 图片叠加节点包裹层 -->
  <div class="image-blend-node-wrapper">
    <!-- Image Blend Node | 图片叠加节点 -->
    <div
      class="image-blend-node resizable-node bg-[var(--bg-secondary)] rounded-xl border relative transition-[border-color,box-shadow] duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'"
      :style="nodeStyle">
      <!-- Header | 头部 -->
      <div class="px-3 py-2 border-b border-[var(--border-color)]">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-[var(--text-primary)]">{{ data.label || '图片叠加' }}</span>
          <div class="flex items-center gap-1">
            <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
              <n-icon :size="14">
                <TrashOutline />
              </n-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Content | 内容区 -->
      <div class="p-3 flex flex-col gap-3">
        <!-- Base Image Section | 原始图片区 -->
        <div class="flex flex-col gap-1">
          <div class="text-xs text-[var(--text-secondary)]">原始图片</div>
          <div
            class="rounded-lg border-2 border-dashed border-[var(--border-color)] relative overflow-hidden"
            :class="baseImageConnected ? 'border-solid' : ''"
            :style="{ height: '120px' }">
            <!-- Base image preview | 原图预览 -->
            <img
              v-if="baseImagePreview"
              :src="baseImagePreview"
              alt="原始图片"
              class="w-full h-full object-cover"
            />
            <!-- Placeholder | 占位符 -->
            <div
              v-else
              class="w-full h-full flex flex-col items-center justify-center gap-1 bg-[var(--bg-tertiary)]">
              <n-icon :size="24" class="text-[var(--text-secondary)]">
                <ImageOutline />
              </n-icon>
              <span class="text-xs text-[var(--text-secondary)]">请连接原始图片</span>
            </div>
          </div>
        </div>

        <!-- Alpha Image Section | 透明通道图区 -->
        <div class="flex flex-col gap-1">
          <div class="text-xs text-[var(--text-secondary)]">透明通道图（黑白）</div>
          <div
            class="rounded-lg border-2 border-dashed border-[var(--border-color)] relative overflow-hidden"
            :class="alphaImageConnected ? 'border-solid' : ''"
            :style="{ height: '120px' }">
            <!-- Alpha image preview | 透明图预览 -->
            <img
              v-if="alphaImagePreview"
              :src="alphaImagePreview"
              alt="透明通道图"
              class="w-full h-full object-cover"
            />
            <!-- Placeholder | 占位符 -->
            <div
              v-else
              class="w-full h-full flex flex-col items-center justify-center gap-1 bg-[var(--bg-tertiary)]">
              <n-icon :size="24" class="text-[var(--text-secondary)]">
                <ColorFilterOutline />
              </n-icon>
              <span class="text-xs text-[var(--text-secondary)]">请连接透明通道图</span>
            </div>
          </div>
        </div>

        <!-- Error message | 错误信息 -->
        <div v-if="data.error" class="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
          {{ data.error }}
        </div>

        <!-- Action Button | 操作按钮 -->
        <button
          @click="handleBlend"
          :disabled="!canBlend || data.isProcessing"
          class="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          :class="canBlend && !data.isProcessing
            ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'">
          <n-spin v-if="data.isProcessing" :size="16" />
          <span v-if="data.isProcessing">处理中...</span>
          <span v-else-if="blendSuccess">✓ 完成</span>
          <span v-else>生成叠加</span>
        </button>

        <!-- Progress bar | 进度条（大图处理时显示） -->
        <div v-if="showProgress" class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>处理进度</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 transition-all duration-100"
              :style="{ width: progress + '%' }"
            />
          </div>
        </div>
      </div>

      <!-- Handles | 连接点 -->
      <!-- Base image input | 原始图输入 -->
      <Handle
        type="target"
        :position="Position.Left"
        id="base"
        class="!bg-[var(--accent-color)]"
        style="top: 30%"
      />
      <!-- Alpha image input | 透明图输入 -->
      <Handle
        type="target"
        :position="Position.Left"
        id="alpha"
        class="!bg-[var(--accent-color)]"
        style="top: 70%"
      />
      <!-- Output | 输出 -->
      <Handle type="source" :position="Position.Right" id="right" class="!bg-[var(--accent-color)]" />

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
  </div>
</template>

<script setup>
/**
 * Image Blend Node Component | 图片叠加节点组件
 * Blends a base image with a black/white alpha channel image
 */
import { ref, computed, onMounted, watch } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NSpin } from 'naive-ui'
import {
  TrashOutline,
  ImageOutline,
  ColorFilterOutline,
  CopyOutline
} from '@vicons/ionicons5'
import { updateNode, removeNode, duplicateNode, addNode, nodes, edges } from '../../stores/canvas'
import { blendImagesWithAlpha, validateImageInputs } from '../../utils/imageBlender'
import { getImage } from '../../utils/imageStorage'
import { useNodeResize } from '../../hooks'

const props = defineProps({
  id: String,
  data: Object
})

// Node resize | 节点调整大小
const { nodeStyle, startResize } = useNodeResize(props.id, props.data, {
  minWidth: 250,
  minHeight: 350,
  maxWidth: 400,
  maxHeight: 600
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// Image previews | 图片预览
const baseImagePreview = ref('')
const alphaImagePreview = ref('')

// Processing state | 处理状态
const progress = ref(0)
const showProgress = ref(false)
const blendSuccess = ref(false)

/**
 * Get connected image data by handle ID | 根据handle ID获取连接的图片数据
 */
const getConnectedImageData = (handleId) => {
  // Find edges connected to this node's target handle | 查找连接到当前节点目标handle的边
  const connectedEdges = edges.value.filter(e => e.target === props.id && e.targetHandle === handleId)

  if (connectedEdges.length === 0) {
    return null
  }

  // Get the source node (image node) | 获取源节点（图片节点）
  const sourceNodeId = connectedEdges[0].source
  const sourceNode = nodes.value.find(n => n.id === sourceNodeId)

  if (!sourceNode || sourceNode.type !== 'image') {
    return null
  }

  // Get image data from the image node | 从图片节点获取图片数据
  // Priority: imageUrl > url (for backward compatibility) | 优先级：imageUrl > url（向后兼容）
  return sourceNode.data.imageUrl || sourceNode.data.url || null
}

/**
 * Load image from node connection | 从节点连接加载图片
 */
const loadImageFromConnection = async (imageData) => {
  if (!imageData) return ''

  try {
    // If it's an image ID (starts with img_), load from IndexedDB | 如果是图片ID，从IndexedDB加载
    if (typeof imageData === 'string' && imageData.startsWith('img_')) {
      const base64Data = await getImage(imageData)
      return base64Data || ''
    }
    // Otherwise, use as URL or base64 directly | 否则直接作为URL或base64使用
    return imageData
  } catch (error) {
    console.error('[ImageBlendNode] Failed to load image:', error)
    return ''
  }
}

// Get connected image data | 获取连接的图片数据
const baseImageData = computed(() => getConnectedImageData('base'))
const alphaImageData = computed(() => getConnectedImageData('alpha'))

const baseImageConnected = computed(() => !!baseImageData.value)
const alphaImageConnected = computed(() => !!alphaImageData.value)

// Check if blend can be performed | 检查是否可以执行叠加
const canBlend = computed(() => {
  return baseImageConnected.value && alphaImageConnected.value
})

/**
 * Load image previews | 加载图片预览
 */
const loadPreviews = async () => {
  if (baseImageData.value) {
    baseImagePreview.value = await loadImageFromConnection(baseImageData.value)
  } else {
    baseImagePreview.value = ''
  }

  if (alphaImageData.value) {
    alphaImagePreview.value = await loadImageFromConnection(alphaImageData.value)
  } else {
    alphaImagePreview.value = ''
  }
}

// Watch for data changes | 监听数据变化
watch(
  () => [baseImageData.value, alphaImageData.value],
  () => {
    loadPreviews()
    // Clear error and success state when inputs change | 输入变化时清除错误和成功状态
    if (props.data.error) {
      updateNode(props.id, { error: null })
    }
    blendSuccess.value = false
  }
)

// Load previews on mount | 组件挂载时加载预览
onMounted(() => {
  loadPreviews()
})

/**
 * Handle blend action | 处理叠加操作
 */
const handleBlend = async () => {
  if (!canBlend.value || props.data.isProcessing) return

  // Get actual image data from connected nodes | 从连接的节点获取实际图片数据
  const baseImage = baseImageData.value
  const alphaImage = alphaImageData.value

  // Validate inputs | 验证输入
  const validation = validateImageInputs(baseImage, alphaImage)
  if (!validation.valid) {
    updateNode(props.id, { error: validation.error })
    return
  }

  // Clear previous error | 清除之前的错误
  updateNode(props.id, { error: null, isProcessing: true })
  blendSuccess.value = false

  try {
    // Determine if we should show progress (for large images) | 判断是否显示进度（大图）
    const baseSize = baseImage?.length || 0
    const alphaSize = alphaImage?.length || 0
    const shouldShowProgress = baseSize > 2 * 1024 * 1024 || alphaSize > 2 * 1024 * 1024

    if (shouldShowProgress) {
      showProgress.value = true
      progress.value = 0
    }

    // Perform blend with progress callback | 执行叠加（带进度回调）
    const resultDataUrl = await blendImagesWithAlpha(
      baseImage,
      alphaImage,
      shouldShowProgress ? (p) => { progress.value = p } : null
    )

    // Hide progress | 隐藏进度
    showProgress.value = false
    progress.value = 0

    // Update node with result | 更新节点结果
    updateNode(props.id, {
      resultUrl: resultDataUrl,
      isProcessing: false
    })

    // Show success state | 显示成功状态
    blendSuccess.value = true
    setTimeout(() => {
      blendSuccess.value = false
    }, 2000)

    // Create result image node | 创建结果图片节点
    createResultNode(resultDataUrl)

    window.$message?.success('图片叠加完成')
  } catch (error) {
    console.error('[ImageBlendNode] Blend failed:', error)
    updateNode(props.id, {
      error: error.message || '图片叠加失败',
      isProcessing: false
    })
    showProgress.value = false
    progress.value = 0
  }
}

/**
 * Create result image node | 创建结果图片节点
 */
const createResultNode = (resultUrl) => {
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create new image node with result | 创建包含结果的新图片节点
  const resultNodeId = addNode('image', { x: nodeX + 400, y: nodeY }, {
    imageUrl: resultUrl,
    url: resultUrl,
    label: '叠加结果',
    createdAt: Date.now()
  })

  // Connect blend node to result | 连接叠加节点到结果节点
  import('../../stores/canvas').then(({ addEdge }) => {
    addEdge({
      source: props.id,
      target: resultNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })

    // Force Vue Flow to recalculate | 强制重新计算
    setTimeout(() => {
      updateNodeInternals(resultNodeId)
    }, 50)
  })
}

/**
 * Handle delete | 处理删除
 */
const handleDelete = () => {
  removeNode(props.id)
}

/**
 * Handle duplicate | 处理复制
 */
const handleDuplicate = () => {
  const newId = duplicateNode(props.id)
  if (newId) {
    updateNode(props.id, { selected: false })
    updateNode(newId, { selected: true })
    window.$message?.success('节点已复制')
    setTimeout(() => {
      updateNodeInternals(newId)
    }, 50)
  }
}
</script>

<style scoped>
.image-blend-node-wrapper {
  position: relative;
  padding-right: 50px;
  padding-top: 20px;
}

.image-blend-node {
  cursor: default;
  position: relative;
  min-width: 250px;
  min-height: 350px;
}

/* Hover actions | 悬浮操作 */
.node-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease-out;
}

.image-blend-node-wrapper:hover .node-actions {
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
  z-index: 10;
}

.image-blend-node:hover .resize-handle {
  opacity: 0.6;
}

.resize-handle:hover {
  opacity: 1 !important;
  color: var(--accent-color);
}
</style>
