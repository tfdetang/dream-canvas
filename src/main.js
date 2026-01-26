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

// Initialize providers first
initProviders()

// Then run migration if needed
initMigration()

// Migrate images to IndexedDB for performance
autoMigrateWithUI().catch(error => {
  console.error('[Main] Failed to migrate images:', error)
  // 迁移失败不影响应用启动，只记录错误
})

const app = createApp(App)

app.use(router)
app.mount('#app')
