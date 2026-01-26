/**
 * Image Storage Service | 图片存储服务
 *
 * 将图片数据从节点响应式对象中分离，存储到 IndexedDB
 * 优化性能：
 * - 减少 Vue 响应式系统内存占用
 * - 深度克隆时只克隆 ID 字符串
 * - 支持清理未使用的图片
 */

const DB_NAME = 'dream-canvas-images'
const DB_VERSION = 1
const STORE_NAME = 'images'

let db = null

/**
 * 初始化 IndexedDB | Initialize IndexedDB
 */
export async function initImageStorage() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[ImageStorage] Failed to open database')
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      console.log('[ImageStorage] Database initialized')
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result

      // 创建图片存储对象 | Create image store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        objectStore.createIndex('createdAt', 'createdAt', { unique: false })
        console.log('[ImageStorage] Object store created')
      }
    }
  })
}

/**
 * 生成图片 ID | Generate image ID
 */
function generateImageId() {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 保存图片 | Save image
 * @param {string} base64Data - Base64 图片数据
 * @returns {Promise<string>} 图片 ID
 */
export async function saveImage(base64Data) {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const objectStore = transaction.objectStore(STORE_NAME)

    const id = generateImageId()
    const imageRecord = {
      id,
      data: base64Data,
      size: base64Data.length,
      createdAt: Date.now()
    }

    const request = objectStore.add(imageRecord)

    request.onsuccess = () => {
      console.log(`[ImageStorage] Image saved: ${id} (${(imageRecord.size / 1024 / 1024).toFixed(2)} MB)`)
      resolve(id)
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to save image')
      reject(request.error)
    }
  })
}

/**
 * 批量保存图片 | Batch save images
 * @param {string[]} base64DataArray - Base64 图片数据数组
 * @returns {Promise<string[]>} 图片 ID 数组
 */
export async function saveImages(base64DataArray) {
  await initImageStorage()

  const promises = base64DataArray.map(data => saveImage(data))
  return Promise.all(promises)
}

/**
 * 获取图片 | Get image
 * @param {string} imageId - 图片 ID
 * @returns {Promise<string|null>} Base64 图片数据
 */
export async function getImage(imageId) {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.get(imageId)

    request.onsuccess = () => {
      const result = request.result
      if (result) {
        resolve(result.data)
      } else {
        console.warn(`[ImageStorage] Image not found: ${imageId}`)
        resolve(null)
      }
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to get image')
      reject(request.error)
    }
  })
}

/**
 * 获取图片元数据 | Get image metadata
 * @param {string} imageId - 图片 ID
 * @returns {Promise<object|null>} 图片元数据
 */
export async function getImageMeta(imageId) {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.get(imageId)

    request.onsuccess = () => {
      const result = request.result
      if (result) {
        resolve({
          id: result.id,
          size: result.size,
          createdAt: result.createdAt
        })
      } else {
        resolve(null)
      }
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to get image metadata')
      reject(request.error)
    }
  })
}

/**
 * 删除图片 | Delete image
 * @param {string} imageId - 图片 ID
 */
export async function deleteImage(imageId) {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.delete(imageId)

    request.onsuccess = () => {
      console.log(`[ImageStorage] Image deleted: ${imageId}`)
      resolve()
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to delete image')
      reject(request.error)
    }
  })
}

/**
 * 批量删除图片 | Batch delete images
 * @param {string[]} imageIds - 图片 ID 数组
 */
export async function deleteImages(imageIds) {
  await initImageStorage()

  const promises = imageIds.map(id => deleteImage(id))
  await Promise.all(promises)
  console.log(`[ImageStorage] Batch deleted ${imageIds.length} images`)
}

/**
 * 清理未使用的图片 | Cleanup unused images
 * @param {string[]} usedImageIds - 正在使用的图片 ID 数组
 * @returns {Promise<number>} 删除的图片数量
 */
export async function cleanupUnusedImages(usedImageIds = []) {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.openCursor()

    let deletedCount = 0
    const usedSet = new Set(usedImageIds)

    request.onsuccess = (event) => {
      const cursor = event.target.result

      if (cursor) {
        const imageId = cursor.key

        // 如果图片不在使用列表中，删除它
        if (!usedSet.has(imageId)) {
          cursor.delete()
          deletedCount++
        }

        cursor.continue()
      } else {
        console.log(`[ImageStorage] Cleanup completed: ${deletedCount} unused images deleted`)
        resolve(deletedCount)
      }
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to cleanup images')
      reject(request.error)
    }
  })
}

/**
 * 获取所有图片 ID | Get all image IDs
 * @returns {Promise<string[]>} 所有图片 ID
 */
export async function getAllImageIds() {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.getAllKeys()

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to get all image IDs')
      reject(request.error)
    }
  })
}

/**
 * 获取存储统计信息 | Get storage statistics
 * @returns {Promise<object>} 存储统计信息
 */
export async function getStorageStats() {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.openCursor()

    let totalCount = 0
    let totalSize = 0

    request.onsuccess = (event) => {
      const cursor = event.target.result

      if (cursor) {
        totalCount++
        totalSize += cursor.value.size
        cursor.continue()
      } else {
        resolve({
          totalCount,
          totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
          averageSizeMB: (totalSize / totalCount / 1024 / 1024).toFixed(2)
        })
      }
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to get storage stats')
      reject(request.error)
    }
  })
}

/**
 * 清空所有图片 | Clear all images
 */
export async function clearAllImages() {
  await initImageStorage()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const objectStore = transaction.objectStore(STORE_NAME)
    const request = objectStore.clear()

    request.onsuccess = () => {
      console.log('[ImageStorage] All images cleared')
      resolve()
    }

    request.onerror = () => {
      console.error('[ImageStorage] Failed to clear images')
      reject(request.error)
    }
  })
}

/**
 * 从项目节点中提取所有图片 ID | Extract all image IDs from project nodes
 * @param {Array} nodes - 节点数组
 * @returns {string[]} 图片 ID 数组
 */
export function extractImageIdsFromNodes(nodes) {
  const imageIds = new Set()

  nodes.forEach(node => {
    // 检查节点的 imageUrl 字段
    if (node.data?.imageUrl && typeof node.data.imageUrl === 'string') {
      imageIds.add(node.data.imageUrl)
    }

    // 检查视频节点的视频图片（首帧/尾帧）
    if (node.data?.firstFrameImageUrl && typeof node.data.firstFrameImageUrl === 'string') {
      imageIds.add(node.data.firstFrameImageUrl)
    }
    if (node.data?.lastFrameImageUrl && typeof node.data.lastFrameImageUrl === 'string') {
      imageIds.add(node.data.lastFrameImageUrl)
    }
  })

  return Array.from(imageIds)
}

/**
 * 迁移项目中的图片 | Migrate images in project
 * 将旧的 base64 数据迁移到 IndexedDB，并替换为图片 ID
 * @param {Array} nodes - 节点数组
 * @returns {Promise<Array>} 迁移后的节点数组
 */
export async function migrateProjectImages(nodes) {
  const migrationTasks = []

  nodes.forEach(node => {
    // 迁移图片节点的 url
    if (node.data?.url && isBase64Image(node.data.url)) {
      const task = saveImage(node.data.url).then(imageId => {
        node.data = { ...node.data, imageUrl: imageId }
        // 删除旧的 url 字段
        delete node.data.url
      })
      migrationTasks.push(task)
    }

    // 迁移视频节点的首帧图片
    if (node.data?.firstFrameImage && isBase64Image(node.data.firstFrameImage)) {
      const task = saveImage(node.data.firstFrameImage).then(imageId => {
        node.data = { ...node.data, firstFrameImageUrl: imageId }
        delete node.data.firstFrameImage
      })
      migrationTasks.push(task)
    }

    // 迁移视频节点的尾帧图片
    if (node.data?.lastFrameImage && isBase64Image(node.data.lastFrameImage)) {
      const task = saveImage(node.data.lastFrameImage).then(imageId => {
        node.data = { ...node.data, lastFrameImageUrl: imageId }
        delete node.data.lastFrameImage
      })
      migrationTasks.push(task)
    }
  })

  await Promise.all(migrationTasks)
  console.log(`[ImageStorage] Migrated ${migrationTasks.length} images`)

  return nodes
}

/**
 * 检查是否为 base64 图片 | Check if it's a base64 image
 * @param {string} data - 数据字符串
 * @returns {boolean}
 */
function isBase64Image(data) {
  return typeof data === 'string' && data.startsWith('data:image/')
}
