/**
 * Custom Workflows Store | 自定义工作流存储
 * 管理用户保存的工作流模板
 *
 * 使用 IndexedDB 存储，支持大容量工作流数据（50MB-1GB+）
 * 避免 localStorage 的 5-10MB 配额限制
 */
import { ref } from 'vue'
import {
  getAllCustomWorkflows,
  saveCustomWorkflow as saveWorkflowToDB,
  deleteCustomWorkflow as deleteWorkflowFromDB
} from '../utils/indexedDB'

// 自定义工作流列表
export const customWorkflows = ref([])

/**
 * 初始化自定义工作流
 * 从 IndexedDB 加载数据
 */
export const initCustomWorkflows = async () => {
  try {
    console.log('[CustomWorkflows] Loading from IndexedDB...')
    const workflows = await getAllCustomWorkflows()
    customWorkflows.value = workflows || []
    console.log(`[CustomWorkflows] Loaded ${customWorkflows.value.length} workflows from IndexedDB`)
  } catch (e) {
    console.error('[CustomWorkflows] Failed to load from IndexedDB:', e)
    customWorkflows.value = []
    window.$message?.error('加载自定义工作流失败')
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
export const addCustomWorkflow = async (workflow) => {
  try {
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

    // 保存到 IndexedDB
    await saveWorkflowToDB(newWorkflow)

    // 更新内存中的列表
    customWorkflows.value.push(newWorkflow)

    console.log('[CustomWorkflows] Workflow saved to IndexedDB:', id)
    return id
  } catch (error) {
    console.error('[CustomWorkflows] Failed to add workflow:', error)
    window.$message?.error('保存工作流失败：' + (error.message || '未知错误'))
    throw error
  }
}

/**
 * 删除自定义工作流
 * @param {string} workflowId - 工作流ID
 */
export const deleteCustomWorkflow = async (workflowId) => {
  try {
    const index = customWorkflows.value.findIndex(w => w.id === workflowId)
    if (index === -1) {
      return false
    }

    // 从 IndexedDB 删除
    await deleteWorkflowFromDB(workflowId)

    // 从内存中删除
    customWorkflows.value.splice(index, 1)

    console.log('[CustomWorkflows] Workflow deleted from IndexedDB:', workflowId)
    return true
  } catch (error) {
    console.error('[CustomWorkflows] Failed to delete workflow:', error)
    window.$message?.error('删除工作流失败：' + (error.message || '未知错误'))
    return false
  }
}

/**
 * 更新自定义工作流
 * @param {string} workflowId - 工作流ID
 * @param {Object} updates - 更新的数据
 */
export const updateCustomWorkflow = async (workflowId, updates) => {
  try {
    const workflow = customWorkflows.value.find(w => w.id === workflowId)
    if (!workflow) {
      return false
    }

    // 更新工作流数据
    Object.assign(workflow, updates, {
      updatedAt: Date.now()
    })

    // 保存到 IndexedDB
    await saveWorkflowToDB(workflow)

    console.log('[CustomWorkflows] Workflow updated in IndexedDB:', workflowId)
    return true
  } catch (error) {
    console.error('[CustomWorkflows] Failed to update workflow:', error)
    window.$message?.error('更新工作流失败：' + (error.message || '未知错误'))
    return false
  }
}

/**
 * 根据ID获取工作流
 * @param {string} workflowId - 工作流ID
 */
export const getCustomWorkflow = (workflowId) => {
  return customWorkflows.value.find(w => w.id === workflowId)
}

// 初始化时自动从 IndexedDB 加载
// 注意：这是异步操作，但不阻塞模块加载
initCustomWorkflows().catch(error => {
  console.error('[CustomWorkflows] Auto-initialization failed:', error)
})
