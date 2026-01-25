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

// Initialize providers first
initProviders()

// Then run migration if needed
initMigration()

const app = createApp(App)

app.use(router)
app.mount('#app')
