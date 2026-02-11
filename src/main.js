/**
 * Main entry point | 主入口
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// Initialize provider system
import { initProviders } from './stores/providers'
import { initMigration } from './utils/migration'
import { autoMigrateWithUI } from './utils/dataMigration'
import { initCustomWorkflows } from './stores/customWorkflows'
import { initIndexedDB } from './utils/indexedDB'

// Async initialization function
const init = async () => {
  // Initialize providers first
  initProviders()

  // Initialize IndexedDB (creates object stores and runs migrations)
  // This MUST happen before initCustomWorkflows
  await initIndexedDB()

  // Initialize custom workflows from IndexedDB (after database is ready)
  await initCustomWorkflows()

  // Then run other migrations if needed
  initMigration()

  // Migrate images to IndexedDB for performance
  autoMigrateWithUI().catch(error => {
    console.error('[Main] Failed to migrate images:', error)
    // 迁移失败不影响应用启动，只记录错误
  })
}

// Run async initialization
init().catch(error => {
  console.error('[Main] Initialization failed:', error)
})

const app = createApp(App)

app.use(router)
app.mount('#app')
