/**
 * Data Migration Utility
 * Handles migration from old API key system to new provider system
 */

import { PRESET_PROVIDERS } from '@/config/imageProviders'
import { providers, addCustomProvider, updateProvider, toggleModel } from '@/stores/providers'

const MIGRATION_VERSION = 'v1'
const MIGRATION_KEY = 'dream-canvas_migration_version'

/**
 * Check if migration is needed
 */
export function needsMigration() {
  const currentVersion = localStorage.getItem(MIGRATION_KEY)

  // Check if user has old API key configuration
  const oldApiKey = localStorage.getItem('apiKey')
  const oldBaseUrl = localStorage.getItem('baseUrl')

  // Migration is needed if:
  // 1. Not yet migrated (no migration version)
  // 2. Has old API configuration
  // 3. No providers configured yet
  return !currentVersion && (oldApiKey || oldBaseUrl) && providers.value.length === 0
}

/**
 * Perform migration from old system to new provider system
 */
export function migrateToProviderSystem() {
  if (!needsMigration()) {
    console.log('[Migration] No migration needed')
    return
  }

  console.log('[Migration] Starting migration to provider system...')

  try {
    // Get old configuration
    const oldApiKey = localStorage.getItem('apiKey')
    const oldBaseUrl = localStorage.getItem('baseUrl') || 'https://api.openai.com/v1'
    const oldModel = localStorage.getItem('model') || 'dall-e-3'

    // Detect which provider to use based on base URL
    let targetProvider = null

    // Check if base URL matches any preset provider
    for (const preset of PRESET_PROVIDERS) {
      if (oldBaseUrl.includes(preset.baseUrl) || preset.baseUrl.includes(oldBaseUrl)) {
        targetProvider = preset
        break
      }
    }

    // If no match, create a custom provider
    if (!targetProvider) {
      console.log('[Migration] Creating custom provider from old configuration')
      const customId = addCustomProvider({
        name: '迁移的供应商',
        baseUrl: oldBaseUrl
      })

      // Update with API key
      updateProvider(customId, {
        apiKey: oldApiKey
      })

      console.log('[Migration] Custom provider created:', customId)
    } else {
      // Update preset provider with old API key
      console.log('[Migration] Migrating to preset provider:', targetProvider.name)
      updateProvider(targetProvider.id, {
        apiKey: oldApiKey,
        baseUrl: oldBaseUrl
      })

      // Enable the model that was previously selected
      const provider = providers.value.find(p => p.id === targetProvider.id)
      if (provider && provider.models) {
        const modelToEnable = provider.models.find(m => m.id === oldModel)
        if (modelToEnable && !modelToEnable.enabled) {
          toggleModel(targetProvider.id, oldModel, true)
          console.log('[Migration] Enabled previously selected model:', oldModel)
        }
      }
    }

    // Mark migration as complete
    localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION)

    // Don't delete old keys immediately - keep them as backup
    // Users can manually delete them later if needed
    console.log('[Migration] Migration completed successfully')

    return true
  } catch (error) {
    console.error('[Migration] Migration failed:', error)
    throw new Error(`数据迁移失败: ${error.message}`)
  }
}

/**
 * Rollback migration (for testing/debugging)
 */
export function rollbackMigration() {
  localStorage.removeItem(MIGRATION_KEY)
  console.log('[Migration] Migration rollback complete')
}

/**
 * Get migration status
 */
export function getMigrationStatus() {
  const version = localStorage.getItem(MIGRATION_KEY)
  const hasOldData = !!(localStorage.getItem('apiKey') || localStorage.getItem('baseUrl'))

  return {
    migrated: !!version,
    version,
    hasOldData,
    needsMigration: needsMigration()
  }
}

/**
 * Auto-migrate on application init
 * Should be called in main.js or App.vue
 */
export function initMigration() {
  if (needsMigration()) {
    console.log('[Migration] Auto-migration triggered')
    try {
      migrateToProviderSystem()
      // Show success message to user
      if (typeof window !== 'undefined' && window.$message) {
        window.$message.success('已自动迁移到新的供应商配置系统')
      }
    } catch (error) {
      console.error('[Migration] Auto-migration failed:', error)
      // Show error message to user
      if (typeof window !== 'undefined' && window.$message) {
        window.$message.warning(`数据迁移失败: ${error.message}`)
      }
    }
  }
}

export default {
  needsMigration,
  migrateToProviderSystem,
  rollbackMigration,
  getMigrationStatus,
  initMigration
}
