/**
 * Canvas store | 画布状态管理
 * Manages nodes, edges and canvas state
 */
import { ref, watch } from 'vue'
import { updateProjectCanvas, getProjectCanvas } from './projects'
import { extractImageIdsFromNodes as extractImageIdsFromNodesUtil } from '../utils/imageStorage'

// Node ID counter | 节点ID计数器
let nodeId = 0
const getNodeId = () => `node_${nodeId++}`

// Current project ID | 当前项目ID
export const currentProjectId = ref(null)

// Nodes and edges | 节点和边
export const nodes = ref([])
export const edges = ref([])

// Viewport state | 视口状态
export const canvasViewport = ref({ x: 100, y: 50, zoom: 0.8 })

// Selected node | 选中的节点
export const selectedNode = ref(null)

// Auto-save flag | 自动保存标志
let autoSaveEnabled = false
let saveTimeout = null

// History for undo/redo | 撤销/重做历史
const history = ref([])
const historyIndex = ref(-1)
const MAX_HISTORY = 50
let isRestoring = false

/**
 * Save current state to history | 保存当前状态到历史
 *
 * 性能优化：不深度克隆图片数据，只保留图片 ID 引用
 * 图片数据存储在 IndexedDB 中，节点 data 中只保留 imageUrl 字符串 ID
 */
const saveToHistory = () => {
  if (isRestoring) return

  // 优化：克隆节点数据时，只保留图片 ID 字符串，不克隆实际的 base64 数据
  // 这样可以大幅减少内存占用和克隆时间（从 O(图片大小) 降到 O(1)）
  const state = {
    nodes: nodes.value.map(node => {
      // 浅拷贝节点对象
      const clonedNode = {
        id: node.id,
        type: node.type,
        position: { ...node.position },
        zIndex: node.zIndex,
        data: { ...node.data }
      }

      // 确保图片字段只保留 ID 字符串（不包含实际图片数据）
      // 如果有旧的 base64 数据，会在迁移时自动转换为 imageUrl ID
      return clonedNode
    }),
    edges: edges.value.map(edge => ({ ...edge }))
  }

  // Remove future history if we're not at the end | 如果不在末尾，删除未来历史
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  // Add new state | 添加新状态
  history.value.push(state)

  // Limit history size | 限制历史大小
  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

// Add a new node | 添加新节点
export const addNode = (type, position = { x: 100, y: 100 }, data = {}) => {
  const id = getNodeId()
  const now = Date.now()
  const newNode = {
    id,
    type,
    position,
    data: {
      ...getDefaultNodeData(type),
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    }
  }
  nodes.value = [...nodes.value, newNode]
  saveToHistory() // Save to history | 保存到历史
  debouncedSave() // Trigger auto-save | 触发自动保存
  return id
}

// Get default data for node type | 获取节点类型的默认数据
const getDefaultNodeData = (type) => {
  switch (type) {
    case 'text':
      return {
        content: '',
        label: '文本输入',
        selectedModel: null  // 选择的文本模型 ID
      }
    case 'imageConfig':
      return {
        prompt: '',
        model: null,  // 不再硬编码，由组件根据上次使用或已配置的供应商动态选择
        size: '2048x2048',
        ratio: '1:1',
        quality: '4张 | 高清',
        label: '文生图'
      }
    case 'videoConfig':
      return {
        prompt: '',
        ratio: '16:9',
        duration: '5秒',
        model: 'doubao-seedance-1-5-pro_720p',
        label: '图生视频'
      }
    case 'video':
      return {
        url: '',
        duration: 0,
        label: '视频节点'
      }
    case 'image':
      return {
        url: '',
        label: '图片节点',
        width: 300,  // 默认宽度，不超过最大限制
        height: 300  // 默认高度，不超过最大限制
      }
    case 'imageBlend':
      return {
        label: '图片叠加',
        baseImage: null,      // 原始图片
        alphaImage: null,     // 透明通道图
        resultUrl: null,      // 生成的叠加结果
        isProcessing: false,  // 处理状态
        error: null,          // 错误信息
        width: 280,
        height: 400
      }
    default:
      return {}
  }
}

// Update node data | 更新节点数据
export const updateNode = (id, data) => {
  nodes.value = nodes.value.map(node =>
    node.id === id ? { ...node, data: { ...node.data, ...data } } : node
  )
  // Trigger auto-save when node is updated | 节点更新时触发自动保存
  debouncedSave()
}

// Remove node | 删除节点
export const removeNode = (id) => {
  nodes.value = nodes.value.filter(node => node.id !== id)
  edges.value = edges.value.filter(edge => edge.source !== id && edge.target !== id)
  saveToHistory() // Save after removing node | 删除节点后保存
}

// Duplicate node | 复制节点
export const duplicateNode = (id) => {
  const sourceNode = nodes.value.find(node => node.id === id)
  if (!sourceNode) return null
  
  const newId = getNodeId()
  
  // Calculate max z-index | 计算最大层级
  const maxZIndex = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
  
  const newNode = {
    id: newId,
    type: sourceNode.type,
    position: {
      x: sourceNode.position.x + 50,
      y: sourceNode.position.y + 50
    },
    data: { ...sourceNode.data },
    zIndex: maxZIndex + 1
  }
  nodes.value = [...nodes.value, newNode]
  saveToHistory() // Save after duplicating node | 复制节点后保存
  return newId
}

// Add edge | 添加边
export const addEdge = (params) => {
  const newEdge = {
    id: `edge_${params.source}_${params.target}`,
    ...params
  }
  edges.value = [...edges.value, newEdge]
  saveToHistory() // Save to history | 保存到历史
  debouncedSave() // Trigger auto-save | 触发自动保存
}

// Update edge data | 更新边数据
export const updateEdge = (id, data) => {
  edges.value = edges.value.map(edge => 
    edge.id === id ? { ...edge, data: { ...edge.data, ...data } } : edge
  )
  saveToHistory() // Save after updating edge | 更新连线后保存
}

// Remove edge | 删除边
export const removeEdge = (id) => {
  edges.value = edges.value.filter(edge => edge.id !== id)
  saveToHistory() // Save after removing edge | 删除连线后保存
}

// Clear canvas | 清空画布
export const clearCanvas = () => {
  nodes.value = []
  edges.value = []
  nodeId = 0
}

// Initialize with sample data | 使用示例数据初始化
export const initSampleData = () => {
  clearCanvas()
  
  // Add text node | 添加文本节点
  addNode('text', { x: 150, y: 150 }, {
    content: '一只金毛寻回犬在草地上奔跑，摇着尾巴，脸上带着快乐的表情。它的毛发在阳光下闪耀，眼神充满了对自由的渴望，全身散发着阳光、友善的气息。',
    label: '文本输入'
  })
  
  // Add image config node | 添加文生图配置节点
  addNode('imageConfig', { x: 450, y: 150 }, {
    prompt: '',
    model: 'doubao-seedream-4-5-251128',
    ratio: '16:9 | 4张 | 高清',
    label: '文生图'
  })
  
  // Add edge between nodes | 添加节点之间的边
  addEdge({
    source: 'node_0',
    target: 'node_1',
    sourceHandle: 'right',
    targetHandle: 'left'
  })
}

/**
 * Load project data | 加载项目数据
 * @param {string} projectId - Project ID | 项目ID
 */
export const loadProject = async (projectId) => {
  autoSaveEnabled = false
  isRestoring = true
  currentProjectId.value = projectId

  const canvasData = getProjectCanvas(projectId)

  if (canvasData) {
    // Restore nodes | 恢复节点（浅拷贝，不包含图片数据）
    nodes.value = (canvasData.nodes || []).map(node => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      zIndex: node.zIndex,
      data: { ...node.data }
    }))

    edges.value = (canvasData.edges || []).map(edge => ({ ...edge }))
    canvasViewport.value = canvasData.viewport || { x: 100, y: 50, zoom: 0.8 }

    // Update node ID counter | 更新节点ID计数器
    const maxId = nodes.value.reduce((max, node) => {
      const match = node.id.match(/node_(\d+)/)
      if (match) {
        return Math.max(max, parseInt(match[1], 10))
      }
      return max
    }, -1)
    nodeId = maxId + 1
  } else {
    // Empty project | 空项目
    clearCanvas()
  }

  // Initialize history with current state | 用当前状态初始化历史
  history.value = [{
    nodes: nodes.value.map(node => ({
      id: node.id,
      type: node.type,
      position: { ...node.position },
      zIndex: node.zIndex,
      data: { ...node.data }
    })),
    edges: edges.value.map(edge => ({ ...edge }))
  }]
  historyIndex.value = 0

  // Enable auto-save immediately after loading | 加载后立即启用自动保存
  isRestoring = false
  autoSaveEnabled = true
}

/**
 * Save current project | 保存当前项目
 * @param {boolean} force - Force save even if auto-save is disabled | 强制保存（即使自动保存未启用）
 */
export const saveProject = (force = false) => {
  if (!currentProjectId.value) {
    console.warn('[Canvas] Cannot save: no current project ID')
    return
  }

  // For manual saves, force regardless of autoSaveEnabled
  // For auto saves, check autoSaveEnabled flag
  if (!force && !autoSaveEnabled) {
    console.log('[Canvas] Auto-save skipped: not enabled yet')
    return
  }

  console.log('[Canvas] Saving project:', currentProjectId.value)
  updateProjectCanvas(currentProjectId.value, {
    nodes: nodes.value,
    edges: edges.value,
    viewport: canvasViewport.value
  })
}

/**
 * Debounced auto-save | 防抖动自动保存
 */
const debouncedSave = () => {
  if (!autoSaveEnabled || !currentProjectId.value) return
  
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  
  // Increased delay to 1000ms to reduce frequent saves | 增加延迟到 1000ms 以减少频繁保存
  saveTimeout = setTimeout(() => {
    saveProject()
  }, 1000)
}

/**
 * Update viewport and save | 更新视口并保存
 * Note: Uses debounce to avoid frequent saves during pan/zoom | 使用防抖避免拖动/缩放时频繁保存
 */
export const updateViewport = (viewport) => {
  canvasViewport.value = viewport
  // Only trigger save if viewport change is significant enough | 只在视口变化足够大时触发保存
  debouncedSave()
}

/**
 * Undo last action | 撤销上一步操作
 */
export const undo = () => {
  if (historyIndex.value <= 0) {
    window.$message?.info('没有可撤销的操作')
    return false
  }
  
  historyIndex.value--
  restoreState(history.value[historyIndex.value])
  return true
}

/**
 * Redo last undone action | 重做上一步撤销的操作
 */
export const redo = () => {
  if (historyIndex.value >= history.value.length - 1) {
    window.$message?.info('没有可重做的操作')
    return false
  }
  
  historyIndex.value++
  restoreState(history.value[historyIndex.value])
  return true
}

/**
 * Restore state from history | 从历史恢复状态
 *
 * 性能优化：使用浅拷贝而不是深度克隆
 * 历史记录中已经不包含图片数据，只包含 ID 引用
 */
const restoreState = (state) => {
  isRestoring = true

  // 使用浅拷贝恢复节点和边数据
  nodes.value = state.nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: { ...node.position },
    zIndex: node.zIndex,
    data: { ...node.data }
  }))

  edges.value = state.edges.map(edge => ({ ...edge }))

  setTimeout(() => {
    isRestoring = false
  }, 100)
}

/**
 * Check if can undo | 检查是否可以撤销
 */
export const canUndo = () => historyIndex.value > 0

/**
 * Check if can redo | 检查是否可以重做
 */
export const canRedo = () => historyIndex.value < history.value.length - 1

/**
 * Manually save current state to history | 手动保存当前状态到历史
 * Used for edge deletions and other operations not covered by automatic saves
 */
export const manualSaveHistory = () => {
  saveToHistory()
}

// Note: Removed deep watch to avoid performance issues | 移除深度监听以避免性能问题
// Auto-save is now triggered explicitly by specific operations (addNode, updateNode, etc.)
// 自动保存现在由特定操作明确触发（addNode、updateNode 等）

/**
 * Cleanup unused images | 清理未使用的图片
 *
 * 扫描所有节点，提取正在使用的图片 ID，然后删除 IndexedDB 中未使用的图片
 * 建议在删除节点后定期调用此功能以释放存储空间
 */
export const cleanupUnusedImages = async () => {
  try {
    // 提取当前正在使用的图片 ID
    const usedImageIds = extractImageIdsFromNodesUtil(nodes.value)

    // 清理未使用的图片
    const { cleanupUnusedImages: cleanupImages } = await import('../utils/imageStorage.js')
    const deletedCount = await cleanupImages(usedImageIds)

    if (deletedCount > 0) {
      console.log(`[Canvas] Cleaned up ${deletedCount} unused images`)
    }
  } catch (error) {
    console.error('[Canvas] Failed to cleanup unused images:', error)
  }
}
