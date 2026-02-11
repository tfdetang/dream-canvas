/**
 * IndexedDB Utility for Project Storage
 * 项目存储的 IndexedDB 工具
 *
 * IndexedDB 优势：
 * - 存储容量大 (50MB - 1GB+，远超 localStorage 的 5-10MB)
 * - 支持存储 Blob 和大型对象
 * - 异步操作，不会阻塞主线程
 */

const DB_NAME = 'ai-canvas-db'
const DB_VERSION = 2  // Upgraded to support custom workflows
const STORE_NAME = 'projects'
const WORKFLOWS_STORE_NAME = 'customWorkflows'

/**
 * Open IndexedDB connection
 * 打开 IndexedDB 连接
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    console.log(`[IndexedDB] Opening database "${DB_NAME}" at version ${DB_VERSION}`)
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[IndexedDB] Open error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      const db = request.result
      console.log(`[IndexedDB] Database opened successfully at version ${db.version}`)
      console.log('[IndexedDB] Available object stores:', Array.from(db.objectStoreNames))
      resolve(db)
    }

    request.onblocked = () => {
      console.warn('[IndexedDB] Database upgrade blocked - please close all other tabs with this app')
      window.$message?.warning('数据库升级被阻止，请关闭其他标签页后刷新')
    }

    request.onupgradeneeded = (event) => {
      console.log(`[IndexedDB] Upgrade needed from version ${event.oldVersion} to ${event.newVersion}`)
      const db = event.target.result

      // Create projects object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' })

        // Create indexes for sorting
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        objectStore.createIndex('createdAt', 'createdAt', { unique: false })
        objectStore.createIndex('name', 'name', { unique: false })

        console.log('[IndexedDB] ✅ Projects object store created')
      } else {
        console.log('[IndexedDB] Projects object store already exists')
      }

      // Create custom workflows object store if it doesn't exist
      if (!db.objectStoreNames.contains(WORKFLOWS_STORE_NAME)) {
        const workflowStore = db.createObjectStore(WORKFLOWS_STORE_NAME, { keyPath: 'id' })

        // Create indexes for sorting
        workflowStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        workflowStore.createIndex('createdAt', 'createdAt', { unique: false })
        workflowStore.createIndex('name', 'name', { unique: false })

        console.log('[IndexedDB] ✅ Custom workflows object store created')
      } else {
        console.log('[IndexedDB] Custom workflows object store already exists')
      }
    }
  })
}

/**
 * Get all projects from IndexedDB
 * 从 IndexedDB 获取所有项目
 */
export const getAllProjects = async () => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.getAll()

      request.onerror = () => {
        console.error('Failed to get projects:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        // Convert date strings back to Date objects
        const projects = request.result.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        }))
        resolve(projects)
      }
    })
  } catch (error) {
    console.error('getAllProjects error:', error)
    return []
  }
}

/**
 * Get a single project by ID
 * 根据 ID 获取单个项目
 */
export const getProject = async (id) => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.get(id)

      request.onerror = () => {
        console.error('Failed to get project:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        if (request.result) {
          const project = {
            ...request.result,
            createdAt: new Date(request.result.createdAt),
            updatedAt: new Date(request.result.updatedAt)
          }
          resolve(project)
        } else {
          resolve(null)
        }
      }
    })
  } catch (error) {
    console.error('getProject error:', error)
    return null
  }
}

/**
 * Convert reactive proxy to plain object
 * 将响应式代理对象转换为普通对象
 */
const toPlainObject = (obj) => {
  if (obj === null || obj === undefined) return obj

  // Handle Date objects
  if (obj instanceof Date) {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => toPlainObject(item))
  }

  // Handle objects (including Vue proxies)
  if (typeof obj === 'object') {
    // Use JSON parse/stringify to remove reactivity
    return JSON.parse(JSON.stringify(obj))
  }

  // Return primitive values as-is
  return obj
}

/**
 * Save a project to IndexedDB
 * 保存项目到 IndexedDB
 */
export const saveProject = async (project) => {
  try {
    const db = await openDB()

    // Convert to plain object to avoid DataCloneError
    const plainProject = toPlainObject(project)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.put(plainProject)

      request.onerror = () => {
        console.error('Failed to save project:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(true)
      }
    })
  } catch (error) {
    console.error('saveProject error:', error)
    throw error
  }
}

/**
 * Save multiple projects in a batch
 * 批量保存多个项目
 */
export const saveProjects = async (projects) => {
  try {
    const db = await openDB()

    // Convert all projects to plain objects
    const plainProjects = projects.map(p => toPlainObject(p))

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)

      let completed = 0
      let hasError = false

      plainProjects.forEach(project => {
        const request = objectStore.put(project)

        request.onerror = () => {
          console.error('Failed to save project:', project.id, request.error)
          hasError = true
        }

        request.onsuccess = () => {
          completed++
          if (completed === plainProjects.length) {
            if (hasError) {
              reject(new Error('Some projects failed to save'))
            } else {
              resolve(true)
            }
          }
        }
      })
    })
  } catch (error) {
    console.error('saveProjects error:', error)
    throw error
  }
}

/**
 * Delete a project from IndexedDB
 * 从 IndexedDB 删除项目
 */
export const deleteProject = async (id) => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.delete(id)

      request.onerror = () => {
        console.error('Failed to delete project:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(true)
      }
    })
  } catch (error) {
    console.error('deleteProject error:', error)
    throw error
  }
}

/**
 * Clear all projects from IndexedDB
 * 清空 IndexedDB 中的所有项目
 */
export const clearAllProjects = async () => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.clear()

      request.onerror = () => {
        console.error('Failed to clear projects:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(true)
      }
    })
  } catch (error) {
    console.error('clearAllProjects error:', error)
    throw error
  }
}

/**
 * Get storage usage information
 * 获取存储使用信息
 */
export const getStorageInfo = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        usageInMB: (estimate.usage / 1024 / 1024).toFixed(2),
        quotaInMB: (estimate.quota / 1024 / 1024).toFixed(2),
        percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
      }
    }
    return null
  } catch (error) {
    console.error('getStorageInfo error:', error)
    return null
  }
}

/**
 * Get all custom workflows from IndexedDB
 * 从 IndexedDB 获取所有自定义工作流
 */
export const getAllCustomWorkflows = async () => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKFLOWS_STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(WORKFLOWS_STORE_NAME)
      const request = objectStore.getAll()

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get custom workflows:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result || [])
      }
    })
  } catch (error) {
    console.error('[IndexedDB] getAllCustomWorkflows error:', error)
    return []
  }
}

/**
 * Get a single custom workflow by ID
 * 根据 ID 获取单个自定义工作流
 */
export const getCustomWorkflow = async (id) => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKFLOWS_STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(WORKFLOWS_STORE_NAME)
      const request = objectStore.get(id)

      request.onerror = () => {
        console.error('[IndexedDB] Failed to get custom workflow:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result || null)
      }
    })
  } catch (error) {
    console.error('[IndexedDB] getCustomWorkflow error:', error)
    return null
  }
}

/**
 * Save a custom workflow to IndexedDB
 * 保存自定义工作流到 IndexedDB
 */
export const saveCustomWorkflow = async (workflow) => {
  try {
    const db = await openDB()

    // Convert to plain object to avoid DataCloneError
    const plainWorkflow = toPlainObject(workflow)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKFLOWS_STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(WORKFLOWS_STORE_NAME)
      const request = objectStore.put(plainWorkflow)

      request.onerror = () => {
        console.error('[IndexedDB] Failed to save custom workflow:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('[IndexedDB] Custom workflow saved successfully:', workflow.id)
        resolve(true)
      }
    })
  } catch (error) {
    console.error('[IndexedDB] saveCustomWorkflow error:', error)
    throw error
  }
}

/**
 * Save multiple custom workflows in a batch
 * 批量保存多个自定义工作流
 */
export const saveCustomWorkflows = async (workflows) => {
  try {
    const db = await openDB()

    // Convert all workflows to plain objects
    const plainWorkflows = workflows.map(w => toPlainObject(w))

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKFLOWS_STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(WORKFLOWS_STORE_NAME)

      let completed = 0
      let hasError = false

      plainWorkflows.forEach(workflow => {
        const request = objectStore.put(workflow)

        request.onerror = () => {
          console.error('[IndexedDB] Failed to save workflow:', workflow.id, request.error)
          hasError = true
        }

        request.onsuccess = () => {
          completed++
          if (completed === plainWorkflows.length) {
            if (hasError) {
              reject(new Error('Some workflows failed to save'))
            } else {
              console.log(`[IndexedDB] ${plainWorkflows.length} workflows saved successfully`)
              resolve(true)
            }
          }
        }
      })

      // Handle empty array case
      if (plainWorkflows.length === 0) {
        resolve(true)
      }
    })
  } catch (error) {
    console.error('[IndexedDB] saveCustomWorkflows error:', error)
    throw error
  }
}

/**
 * Delete a custom workflow from IndexedDB
 * 从 IndexedDB 删除自定义工作流
 */
export const deleteCustomWorkflow = async (id) => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKFLOWS_STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(WORKFLOWS_STORE_NAME)
      const request = objectStore.delete(id)

      request.onerror = () => {
        console.error('[IndexedDB] Failed to delete custom workflow:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('[IndexedDB] Custom workflow deleted successfully:', id)
        resolve(true)
      }
    })
  } catch (error) {
    console.error('[IndexedDB] deleteCustomWorkflow error:', error)
    throw error
  }
}

/**
 * Clear all custom workflows from IndexedDB
 * 清空 IndexedDB 中的所有自定义工作流
 */
export const clearAllCustomWorkflows = async () => {
  try {
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([WORKFLOWS_STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(WORKFLOWS_STORE_NAME)
      const request = objectStore.clear()

      request.onerror = () => {
        console.error('[IndexedDB] Failed to clear custom workflows:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('[IndexedDB] All custom workflows cleared')
        resolve(true)
      }
    })
  } catch (error) {
    console.error('[IndexedDB] clearAllCustomWorkflows error:', error)
    throw error
  }
}

/**
 * Migrate custom workflows from localStorage to IndexedDB
 * 从 localStorage 迁移自定义工作流到 IndexedDB
 */
export const migrateCustomWorkflowsFromLocalStorage = async () => {
  try {
    const STORAGE_KEY = 'dream-canvas-custom-workflows'
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      console.log('[IndexedDB] No custom workflows in localStorage to migrate')
      return false
    }

    const workflows = JSON.parse(stored)
    console.log(`[IndexedDB] Migrating ${workflows.length} custom workflows from localStorage to IndexedDB...`)

    await saveCustomWorkflows(workflows)

    console.log('[IndexedDB] Custom workflows migration completed successfully')

    // Keep localStorage as backup for now (don't delete)
    // Users can manually clear it later if needed

    return true
  } catch (error) {
    console.error('[IndexedDB] Custom workflows migration failed:', error)
    throw error
  }
}

/**
 * Migrate data from localStorage to IndexedDB
 * 从 localStorage 迁移数据到 IndexedDB
 */
export const migrateFromLocalStorage = async () => {
  try {
    const STORAGE_KEY = 'ai-canvas-projects'
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      console.log('No localStorage data to migrate')
      return false
    }

    const projects = JSON.parse(stored)
    console.log(`Migrating ${projects.length} projects from localStorage to IndexedDB...`)

    await saveProjects(projects)

    console.log('Migration completed successfully')

    // Keep localStorage as backup for now (don't delete)
    // Users can manually clear it later if needed

    return true
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

/**
 * Check if migration is needed
 * 检查是否需要迁移
 */
export const needsMigration = async () => {
  try {
    const STORAGE_KEY = 'ai-canvas-projects'
    const MIGRATION_KEY = 'ai-canvas-indexeddb-migrated'

    // Check if already migrated
    const migrated = localStorage.getItem(MIGRATION_KEY)
    if (migrated) {
      return false
    }

    // Check if localStorage has data
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return false
    }

    // Check if IndexedDB is empty
    const projects = await getAllProjects()
    if (projects.length > 0) {
      // IndexedDB has data, mark as migrated
      localStorage.setItem(MIGRATION_KEY, 'true')
      return false
    }

    return true
  } catch (error) {
    console.error('needsMigration check failed:', error)
    return false
  }
}

// Track initialization state to prevent duplicate calls
let isInitialized = false
let initPromise = null

/**
 * Check if custom workflows migration is needed
 * 检查是否需要迁移自定义工作流
 */
export const needsWorkflowMigration = async () => {
  try {
    const STORAGE_KEY = 'dream-canvas-custom-workflows'
    const MIGRATION_KEY = 'ai-canvas-workflows-indexeddb-migrated'

    // Check if already migrated
    const migrated = localStorage.getItem(MIGRATION_KEY)
    if (migrated) {
      return false
    }

    // Check if localStorage has data
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return false
    }

    // Check if IndexedDB is empty
    const workflows = await getAllCustomWorkflows()
    if (workflows.length > 0) {
      // IndexedDB has data, mark as migrated
      localStorage.setItem(MIGRATION_KEY, 'true')
      return false
    }

    return true
  } catch (error) {
    console.error('[IndexedDB] needsWorkflowMigration check failed:', error)
    return false
  }
}

/**
 * Initialize IndexedDB and perform migration if needed
 * 初始化 IndexedDB 并在需要时执行迁移
 */
export const initIndexedDB = async () => {
  // If already initialized, return immediately
  if (isInitialized) {
    console.log('IndexedDB already initialized, skipping')
    return true
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    console.log('IndexedDB initialization in progress, waiting...')
    return initPromise
  }

  // Start initialization
  initPromise = (async () => {
    try {
      // Open DB to ensure it's created
      await openDB()
      console.log('IndexedDB initialized')

      let migrationPerformed = false

      // Check and perform projects migration
      if (await needsMigration()) {
        console.log('Projects migration needed, starting...')
        await migrateFromLocalStorage()
        localStorage.setItem('ai-canvas-indexeddb-migrated', 'true')
        console.log('Projects migration completed')
        migrationPerformed = true
      }

      // Check and perform custom workflows migration
      if (await needsWorkflowMigration()) {
        console.log('Custom workflows migration needed, starting...')
        await migrateCustomWorkflowsFromLocalStorage()
        localStorage.setItem('ai-canvas-workflows-indexeddb-migrated', 'true')
        console.log('Custom workflows migration completed')
        migrationPerformed = true
      }

      // Show success message to user if any migration was performed
      if (migrationPerformed && typeof window !== 'undefined' && window.$message) {
        window.$message.success('已迁移到 IndexedDB 存储，支持更大容量！')
      }

      isInitialized = true
      return true
    } catch (error) {
      console.error('IndexedDB initialization failed:', error)

      // Show error message to user
      if (typeof window !== 'undefined' && window.$message) {
        window.$message.error('IndexedDB 初始化失败，请检查浏览器设置')
      }

      initPromise = null // Reset on error to allow retry
      throw error
    }
  })()

  return initPromise
}

export default {
  openDB,
  getAllProjects,
  getProject,
  saveProject,
  saveProjects,
  deleteProject,
  clearAllProjects,
  getAllCustomWorkflows,
  getCustomWorkflow,
  saveCustomWorkflow,
  saveCustomWorkflows,
  deleteCustomWorkflow,
  clearAllCustomWorkflows,
  getStorageInfo,
  migrateFromLocalStorage,
  migrateCustomWorkflowsFromLocalStorage,
  needsMigration,
  needsWorkflowMigration,
  initIndexedDB
}
