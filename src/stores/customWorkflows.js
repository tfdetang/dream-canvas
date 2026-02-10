/**
 * Custom Workflows Store | 自定义工作流存储
 * 管理用户保存的工作流模板
 */
import { ref } from 'vue'

const STORAGE_KEY = 'dream-canvas-custom-workflows'

// 自定义工作流列表
export const customWorkflows = ref([])

/**
 * 初始化自定义工作流
 */
export const initCustomWorkflows = () => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      customWorkflows.value = JSON.parse(saved)
    } catch (e) {
      console.error('[CustomWorkflows] Failed to parse:', e)
      customWorkflows.value = []
    }
  }
}

/**
 * 保存工作流列表到 localStorage
 */
const saveWorkflows = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customWorkflows.value))
    console.log('[CustomWorkflows] Saved to localStorage')
  } catch (error) {
    console.error('[CustomWorkflows] Failed to save:', error)
    window.$message?.error('保存工作流失败')
  }
}

/**
 * 添加自定义工作流
 * @param {Object} workflow - 工作流数据
 * @param {string} workflow.name - 工作流名称
 * @param {string} workflow.description - 工作流描述
 * @param {Array} workflow.nodes - 节点数据
 * @param {Array} workflow.edges - 连线数据
 * @param {string} workflow.cover - 封面图（可选）
 */
export const addCustomWorkflow = (workflow) => {
  const id = `custom-${Date.now()}`

  const newWorkflow = {
    id,
    name: workflow.name,
    description: workflow.description,
    category: 'custom',
    type: 'custom',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    cover: workflow.cover || null,
    // 保存节点和边的数据
    nodes: workflow.nodes || [],
    edges: workflow.edges || []
  }

  customWorkflows.value.push(newWorkflow)
  saveWorkflows()

  return id
}

/**
 * 删除自定义工作流
 * @param {string} workflowId - 工作流ID
 */
export const deleteCustomWorkflow = (workflowId) => {
  const index = customWorkflows.value.findIndex(w => w.id === workflowId)
  if (index === -1) {
    return false
  }

  customWorkflows.value.splice(index, 1)
  saveWorkflows()

  return true
}

/**
 * 更新自定义工作流
 * @param {string} workflowId - 工作流ID
 * @param {Object} updates - 更新的数据
 */
export const updateCustomWorkflow = (workflowId, updates) => {
  const workflow = customWorkflows.value.find(w => w.id === workflowId)
  if (!workflow) {
    return false
  }

  Object.assign(workflow, updates, {
    updatedAt: Date.now()
  })

  saveWorkflows()
  return true
}

/**
 * 根据ID获取工作流
 * @param {string} workflowId - 工作流ID
 */
export const getCustomWorkflow = (workflowId) => {
  return customWorkflows.value.find(w => w.id === workflowId)
}

// 自动初始化
initCustomWorkflows()
