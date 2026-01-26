/**
 * Data Migration Utility | 数据迁移工具
 *
 * 帮助将现有项目中的 base64 图片数据迁移到 IndexedDB
 * 实现性能优化后的图片存储格式
 */

import { projects, saveProjects, updateProject } from '../stores/projects'
import { initImageStorage, migrateProjectImages, extractImageIdsFromNodes, cleanupUnusedImages } from './imageStorage'

// 迁移状态标志
const MIGRATION_FLAG = 'dream-canvas-images-migrated-v2'

/**
 * 检查是否已完成迁移 | Check if migration is completed
 */
export async function checkMigrationStatus() {
  try {
    const flag = localStorage.getItem(MIGRATION_FLAG)
    return flag === 'true'
  } catch (error) {
    console.error('[DataMigration] Failed to check migration status:', error)
    return false
  }
}

/**
 * 标记迁移完成 | Mark migration as completed
 */
function markMigrationCompleted() {
  try {
    localStorage.setItem(MIGRATION_FLAG, 'true')
    console.log('[DataMigration] Migration marked as completed')
  } catch (error) {
    console.error('[DataMigration] Failed to mark migration as completed:', error)
  }
}

/**
 * 迁移单个项目 | Migrate a single project
 * @param {object} project - 项目对象
 * @param {function} onProgress - 进度回调函数 (current, total, projectName)
 * @returns {Promise<boolean>} 是否成功迁移
 */
async function migrateSingleProject(project, onProgress) {
  try {
    console.log(`[DataMigration] Migrating project: ${project.name}`)

    // 检查项目是否有节点数据
    if (!project.canvas || !project.canvas.nodes) {
      console.log(`[DataMigration] Project ${project.name} has no nodes, skipping`)
      return false
    }

    // 检查是否已经迁移过（检查是否有 imageUrl 字段）
    const hasImageUrls = project.canvas.nodes.some(node =>
      node.data && (node.data.imageUrl || node.data.firstFrameImageUrl || node.data.lastFrameImageUrl)
    )

    if (hasImageUrls) {
      console.log(`[DataMigration] Project ${project.name} already migrated, skipping`)
      return false
    }

    // 检查是否有需要迁移的图片
    const hasBase64Images = project.canvas.nodes.some(node => {
      const data = node.data || {}
      return (
        (data.url && data.url.startsWith('data:image')) ||
        (data.firstFrameImage && data.firstFrameImage.startsWith('data:image')) ||
        (data.lastFrameImage && data.lastFrameImage.startsWith('data:image'))
      )
    })

    if (!hasBase64Images) {
      console.log(`[DataMigration] Project ${project.name} has no images to migrate`)
      return false
    }

    // 执行迁移
    console.log(`[DataMigration] Starting migration for project: ${project.name}`)
    const migratedNodes = await migrateProjectImages(project.canvas.nodes)

    // 更新项目数据
    project.canvas.nodes = migratedNodes
    // 触发保存到 IndexedDB
    await saveProjects()

    console.log(`[DataMigration] Successfully migrated project: ${project.name}`)
    return true
  } catch (error) {
    console.error(`[DataMigration] Failed to migrate project ${project.name}:`, error)
    return false
  }
}

/**
 * 迁移所有项目 | Migrate all projects
 * @param {function} onProgress - 进度回调函数 (current, total, projectName)
 * @returns {Promise<object>} 迁移结果统计
 */
export async function migrateAllProjects(onProgress) {
  try {
    console.log('[DataMigration] Starting full migration process...')

    // 初始化图片存储
    await initImageStorage()

    // 获取所有项目
    const allProjects = projects.value
    console.log(`[DataMigration] Found ${allProjects.length} projects`)

    let migratedCount = 0
    let skippedCount = 0
    let failedCount = 0

    // 迁移每个项目
    for (let i = 0; i < allProjects.length; i++) {
      const project = allProjects[i]

      // 调用进度回调
      if (onProgress) {
        onProgress(i + 1, allProjects.length, project.name)
      }

      try {
        const migrated = await migrateSingleProject(project, onProgress)

        if (migrated) {
          migratedCount++
        } else {
          skippedCount++
        }
      } catch (error) {
        console.error(`[DataMigration] Error migrating project ${project.name}:`, error)
        failedCount++
      }
    }

    const result = {
      total: allProjects.length,
      migrated: migratedCount,
      skipped: skippedCount,
      failed: failedCount
    }

    console.log('[DataMigration] Migration completed:', result)

    // 标记迁移完成
    if (migratedCount > 0) {
      markMigrationCompleted()
    }

    return result
  } catch (error) {
    console.error('[DataMigration] Migration failed:', error)
    throw error
  }
}

/**
 * 显示迁移进度 | Show migration progress
 * @param {string} message - 进度消息
 * @param {number} current - 当前进度
 * @param {number} total - 总数
 */
function showMigrationProgress(message, current, total) {
  // 移除旧的消息
  const oldMessage = document.getElementById('migration-progress-message')
  if (oldMessage) {
    oldMessage.remove()
  }

  // 创建新的进度消息
  const messageEl = document.createElement('div')
  messageEl.id = 'migration-progress-message'
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--bg-secondary, #fff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    max-width: 400px;
    font-size: 14px;
  `

  messageEl.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
      <div class="spinner" style="
        width: 20px;
        height: 20px;
        border: 2px solid var(--accent-color, #3b82f6);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      "></div>
      <strong style="color: var(--text-primary, #1f2937);">数据迁移中</strong>
    </div>
    <div style="color: var(--text-secondary, #6b7280);">${message}</div>
    <div style="margin-top: 8px; height: 4px; background: var(--bg-tertiary, #f3f4f6); border-radius: 2px; overflow: hidden;">
      <div style="
        width: ${(current / total) * 100}%;
        height: 100%;
        background: var(--accent-color, #3b82f6);
        transition: width 0.3s ease;
      "></div>
    </div>
    <div style="margin-top: 4px; font-size: 12px; color: var(--text-secondary, #6b7280); text-align: right;">
      ${current} / ${total}
    </div>
  `

  // 添加旋转动画样式
  if (!document.getElementById('migration-progress-style')) {
    const style = document.createElement('style')
    style.id = 'migration-progress-style'
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
  }

  document.body.appendChild(messageEl)
}

/**
 * 隐藏迁移进度 | Hide migration progress
 */
function hideMigrationProgress() {
  const messageEl = document.getElementById('migration-progress-message')
  if (messageEl) {
    messageEl.remove()
  }
}

/**
 * 自动迁移（带 UI 反馈）| Auto migrate with UI feedback
 * @returns {Promise<object>} 迁移结果
 */
export async function autoMigrateWithUI() {
  try {
    // 检查是否已经迁移过
    const hasMigrated = await checkMigrationStatus()
    if (hasMigrated) {
      console.log('[DataMigration] Already migrated, skipping')
      return {
        total: 0,
        migrated: 0,
        skipped: 0,
        failed: 0
      }
    }

    console.log('[DataMigration] Starting auto migration...')

    // 执行迁移并显示进度
    const result = await migrateAllProjects((current, total, projectName) => {
      showMigrationProgress(`正在迁移项目: ${projectName}`, current, total)
    })

    // 隐藏进度消息
    hideMigrationProgress()

    // 显示完成消息
    if (result.migrated > 0) {
      const completeMessage = document.createElement('div')
      completeMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        animation: slideIn 0.3s ease;
      `
      completeMessage.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">✅ 迁移完成！</div>
        <div style="font-size: 14px; opacity: 0.9;">
          已迁移 ${result.migrated} 个项目，
          跳过 ${result.skipped} 个项目
          ${result.failed > 0 ? `，失败 ${result.failed} 个项目` : ''}
        </div>
      `
      document.body.appendChild(completeMessage)

      // 3秒后自动移除
      setTimeout(() => {
        completeMessage.style.animation = 'slideOut 0.3s ease forwards'
        setTimeout(() => completeMessage.remove(), 300)
      }, 3000)

      // 添加动画样式
      if (!document.getElementById('migration-animation-style')) {
        const style = document.createElement('style')
        style.id = 'migration-animation-style'
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
        `
        document.head.appendChild(style)
      }
    }

    return result
  } catch (error) {
    hideMigrationProgress()

    // 显示错误消息
    const errorMessage = document.createElement('div')
    errorMessage.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      z-index: 9999;
    `
    errorMessage.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">❌ 迁移失败</div>
      <div style="font-size: 14px; opacity: 0.9;">${error.message || '未知错误'}</div>
    `
    document.body.appendChild(errorMessage)

    setTimeout(() => errorMessage.remove(), 5000)

    throw error
  }
}
