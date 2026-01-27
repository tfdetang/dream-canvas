/**
 * Node resize hook | 节点调整大小 hook
 * Provides resize functionality for canvas nodes
 */
import { ref, computed, onUnmounted } from 'vue'
import { updateNode, canvasViewport, nodes } from '../stores/canvas'

/**
 * useNodeResize - 节点调整大小的组合式函数
 * @param {string} nodeId - 节点 ID
 * @param {Object} nodeData - 节点数据 (props.data)
 * @param {Object} options - 配置选项
 * @param {number} options.minWidth - 最小宽度 (默认 200)
 * @param {number} options.minHeight - 最小高度 (默认 100)
 * @param {number} options.maxWidth - 最大宽度 (默认 800)
 * @param {number} options.maxHeight - 最大高度 (默认 600)
 */
export function useNodeResize(nodeId, nodeData, options = {}) {
  const {
    minWidth = 200,
    minHeight = 100,
    maxWidth = 800,
    maxHeight = 600
  } = options

  // Resize state | 调整大小状态
  const isResizing = ref(false)
  const startX = ref(0)
  const startY = ref(0)
  const startWidth = ref(0)
  const startHeight = ref(0)

  // Get current node data from store reactively | 从 store 响应式获取当前节点数据
  const currentNodeData = computed(() => {
    const node = nodes.value.find(n => n.id === nodeId)
    return node?.data
  })

  // Node style with dimensions | 带尺寸的节点样式
  const nodeStyle = computed(() => {
    const style = {}
    const data = currentNodeData.value
    if (data?.width) {
      style.width = `${data.width}px`
    }
    if (data?.height) {
      style.height = `${data.height}px`
    }
    return style
  })

  // Start resize | 开始调整大小
  const startResize = (e) => {
    // Handle both mouse and touch events | 处理鼠标和触摸事件
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    e.preventDefault()
    e.stopPropagation()
    
    isResizing.value = true
    startX.value = clientX
    startY.value = clientY
    
    // Get current element dimensions | 获取当前元素尺寸
    const nodeEl = e.target.closest('.resizable-node')
    if (nodeEl) {
      startWidth.value = nodeEl.offsetWidth
      startHeight.value = nodeEl.offsetHeight
    } else {
      // Fallback to data values or defaults | 回退到数据值或默认值
      startWidth.value = currentNodeData.value?.width || minWidth
      startHeight.value = currentNodeData.value?.height || minHeight
    }
    
    // Add global listeners | 添加全局监听器
    document.addEventListener('mousemove', onResize, { passive: false })
    document.addEventListener('mouseup', stopResize)
    document.addEventListener('touchmove', onResize, { passive: false })
    document.addEventListener('touchend', stopResize)
    
    // Prevent text selection during resize | 防止调整大小时选中文本
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'se-resize'
  }

  // Handle resize | 处理调整大小
  const onResize = (e) => {
    if (!isResizing.value) return
    
    e.preventDefault()
    
    // Handle both mouse and touch events | 处理鼠标和触摸事件
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    // Account for canvas zoom level | 考虑画布缩放级别
    const zoom = canvasViewport.value?.zoom || 1
    const deltaX = (clientX - startX.value) / zoom
    const deltaY = (clientY - startY.value) / zoom
    
    // Calculate new dimensions with constraints | 计算新尺寸（带约束）
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.value + deltaX))
    const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight.value + deltaY))
    
    // Update node data | 更新节点数据
    updateNode(nodeId, { 
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    })
  }

  // Stop resize | 停止调整大小
  const stopResize = () => {
    isResizing.value = false
    
    // Remove global listeners | 移除全局监听器
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    document.removeEventListener('touchmove', onResize)
    document.removeEventListener('touchend', stopResize)
    
    // Restore body styles | 恢复 body 样式
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  // Cleanup on unmount | 卸载时清理
  onUnmounted(() => {
    document.removeEventListener('mousemove', onResize)
    document.removeEventListener('mouseup', stopResize)
    document.removeEventListener('touchmove', onResize)
    document.removeEventListener('touchend', stopResize)
  })

  return {
    isResizing,
    nodeStyle,
    startResize
  }
}

export default useNodeResize
