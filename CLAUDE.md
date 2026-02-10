# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Canvas (梦幻画布) - A visual AI creation canvas based on Vue Flow, supporting node-based orchestration of AI workflows including text-to-image and video generation.

**GitHub**: https://github.com/tfdetang/dream-canvas

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (runs on default Vite port, typically :5173)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Technology Stack

- **Frontend Framework**: Vue 3.5 + Vite 5.2
- **Canvas Engine**: Vue Flow (node-based visual canvas)
- **UI Library**: Naive UI
- **Styling**: Tailwind CSS
- **Icons**: @vicons/ionicons5
- **Routing**: Vue Router
- **HTTP Client**: Axios

## Architecture Overview

### State Management (Pinia-style Composition API)

The project uses Vue's Composition API for state management instead of Pinia, with reactive stores in `/src/stores/`:

- **`canvas.js`**: Core canvas state (nodes, edges, viewport), undo/redo history, project loading/saving
- **`projects.js`**: Multi-project management with **IndexedDB persistence** (async operations)
- **`api.js`**: API configuration (base URL, API key, model selection) - **DEPRECATED**, see providers below
- **`theme.js`**: Dark/light theme switching
- **`models.js`**: Available AI models configuration - **DEPRECATED**, see providers below
- **`providers.js`**: Multi-provider system with localStorage persistence, debouncing, and plain object conversion

**CRITICAL**: `projects.js` uses IndexedDB (async), while `providers.js` uses localStorage (sync). See Performance Considerations below.

### IndexedDB Storage System

**Key File**: `/src/utils/indexedDB.js`

The project uses IndexedDB for project storage to support unlimited projects and large base64 images without quota errors.

**Storage Capacity**:
- IndexedDB: 50MB - 1GB+ (device dependent)
- Old localStorage: 5-10MB limit (deprecated for projects)

**Key Functions** (all async):
```javascript
// Initialize DB and perform migration if needed
await initIndexedDB()

// CRUD operations
await getAllProjects()
await getProject(id)
await saveProject(project)
await saveProjects(projects)
await deleteProject(id)
await clearAllProjects()

// Storage info
await getStorageInfo()
```

**Critical Pattern - Plain Object Conversion**:
```javascript
// IndexedDB cannot clone Vue Proxy objects
const toPlainObject = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

// Before saving to IndexedDB:
const plainProject = toPlainObject(project)
await db.put(plainProject)
```

**Migration**:
- Auto-migrates from localStorage on first load
- Migration flag: `ai-canvas-indexeddb-migrated`
- Preserves old localStorage data as backup

**IMPORTANT**: All project CRUD operations in `/src/stores/projects.js` are async and must be awaited.

### Multi-Provider System

**Key Files**:
- `/src/config/imageProviders.js`: Preset provider configurations and model type definitions
- `/src/stores/providers.js`: Provider state management with localStorage persistence, debouncing, and performance optimizations
- `/src/stores/lastUsedModels.js`: Smart model selection - remembers last used model per node type
- `/src/api/providers/`: Adapter implementations for different providers
  - `base.js`: Base adapter class
  - `openai.js`: OpenAI DALL-E adapter (supports multi-image edits via native fetch)
  - `doubao.js`: Doubao (ByteDance) adapter (supports reference images)
  - `gemini.js`: Google Gemini adapter (base64 inline data)
  - `index.js`: Adapter factory

**Features**:
- **Multiple Providers**: Support for OpenAI, Gemini, Banana-pro, Doubao, and custom providers
- **Model Types**: Three model categories (text, image, video) for filtering
- **Smart Model Selection**: When creating nodes, automatically uses last selected model (per node type) or first available from configured providers
- **Custom Models**: Users can add their own models with configurable API format (openai/gemini/doubao)
- **Automatic Provider Detection**: System auto-detects which provider to use based on selected model
- **Reference Images**: OpenAI uses `/images/edits` endpoint with FormData, Doubao uses `image_url`, Gemini uses base64 inlineData
- **Multi-Image Support**: OpenAI adapter supports multiple reference images via FormData
- **Backward Compatibility**: Auto-migrates old API key configuration to new provider system

**Smart Model Selection Pattern**:
```javascript
// In node component onMounted
const defaultModel = getDefaultModel('imageConfig', modelOptions.value, MODEL_TYPES.IMAGE)
if (defaultModel) {
  localModel.value = defaultModel
  updateNode(props.id, { model: defaultModel })
}

// When user selects model
const handleModelSelect = (key) => {
  setLastUsedModel('imageConfig', key)  // Remember for next time
  localModel.value = key
  updateNode(props.id, { model: key })
}
```

**Model Types**:
```javascript
MODEL_TYPES = {
  TEXT: 'text',    // Text generation models
  IMAGE: 'image',  // Image generation models
  VIDEO: 'video'   // Video generation models
}
```

**Provider Configuration**:
Each provider has:
- `id`: Unique identifier
- `name`: Display name
- `baseUrl`: API endpoint
- `apiKey`: Authentication key
- `models`: Array of model configurations
  - `id`: Model identifier
  - `name`: Display name
  - `type`: One of MODEL_TYPES
  - `enabled`: Whether model is available
  - `apiFormat`: API compatibility format (openai/gemini/doubao)
  - `sizes` (for image models): Supported image sizes

**Adapter Pattern**:
All providers extend `BaseProviderAdapter` and implement:
- `validateConfig(config)`: Validate provider configuration
- `validateParams(params)`: Validate generation parameters
- `generateImage(params)`: Generate images with provider-specific logic
- `sendRequest(endpoint, data, headers)`: Send HTTP requests
- `enhanceError(error)`: Convert technical errors to user-friendly messages

**Adapter Factory**:
```javascript
// Create adapter by provider
createProviderAdapter(providerId, config)

// Create adapter by model (supports model-level API format)
createAdapterForModel(providerId, modelId, config)
```

**Data Migration**:
- `/src/utils/migration.js`: Handles migration from old API key system
- Auto-detects old configuration
- Creates appropriate provider
- Preserves existing settings
- Runs on application init

### Node System

The canvas uses a node-based architecture with 6 core node types defined in `/src/components/nodes/`:

1. **TextNode**: Input/edit prompt text with model selection and AI polish
   - Supports multiple text models (configurable via providers)
   - AI polish feature with reference image support
   - Streaming response support

2. **ImageConfigNode**: Configure image generation parameters (model, size, quantity, custom params)
3. **ImageNode**: Display generated images or upload local images with inpainting/overlay support
   - Supports image-to-image generation workflow
   - Image upload from local files
   - IndexedDB storage for large images

4. **VideoConfigNode**: Configure video generation parameters (supports first/last frame images)
5. **VideoNode**: Display generated videos
6. **ImageBlendNode**: Blend images using alpha channel masking
   - Base image + alpha image → blended result
   - Used for overlay/masking effects

Each node has:
- Input/output handles for connections
- Auto-execution capability (`autoExecute` flag)
- Result tracking (`executed`, `outputNodeId`)
- Error handling
- Dynamic resize support (except VideoNode)

### Text Generation Hook

**Key File**: `/src/hooks/useTextGeneration.js`

Supports multiple text generation models with streaming:
- **Model Agnostic**: Works with OpenAI, Gemini, and custom formats
- **Adapter Pattern**: Uses `createAdapterForModel()` to automatically select correct API format
- **Streaming**: Supports streaming responses for real-time feedback
- **Reference Images**: Text polish can accept connected images as context

**Usage Pattern**:
```javascript
const { loading, error, generate } = useTextGeneration({
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant...'
})

const result = await generate(userInput, {
  stream: true,
  customParams: { temperature: 0.7 }
})
```

### Workflow Orchestration

**Key File**: `/src/hooks/useWorkflowOrchestrator.js`

The workflow orchestrator implements 4 workflow types:

1. **`text_to_image`**: Simple text → image generation
2. **`text_to_image_to_video`**: Text → image → video (sequential with dependency tracking)
3. **`storyboard`**: Character reference → multiple scene generation
4. **`multi_angle_storyboard`**: Character → 4-angle views (front, side, back, top)

**Critical Pattern**: Serial execution with callbacks
- Uses `waitForConfigComplete(nodeId)` to wait for config nodes to finish
- Uses `waitForOutputReady(nodeId)` to ensure output nodes have results
- Implements Promise-based watchers with timeouts (5 minutes)
- Auto-connects nodes and manages dependencies

### Workflow Templates

**Key File**: `/src/config/workflows.js`

Pre-built workflow templates that can be added to canvas with one click:
- Multi-angle storyboard
- E-commerce product image set (model, side view, top view, exploded view)
- Drama character design
- Multi-timeframe scene backgrounds

Each template defines a `createNodes(startPosition)` function that returns `{ nodes, edges }`.

### Edge Types

Custom edge types in `/src/components/edges/`:
- **`PromptOrderEdge`**: Connects text nodes to config nodes with ordering
- **`ImageOrderEdge`**: Connects image nodes to config nodes with ordering

Edges support `promptOrder` and `imageOrder` metadata for multi-input scenarios.

### API Integration

**Provider System**: `/src/api/providers/` directory

The project uses a provider adapter pattern for API integration:

- **`base.js`**: Base adapter class with common functionality
- **`openai.js`**: OpenAI DALL-E adapter (standard text-to-image)
- **`doubao.js`**: Doubao/ByteDance adapter (supports reference images)
- **`gemini.js`**: Google Gemini adapter (base64 inline data)
- **`index.js`**: Adapter factory for creating instances

**Legacy API Files** (deprecated but still functional):
- **`image.js`**: Text-to-image generation (uses old system)
- **`video.js`**: Image-to-video generation (uses old system)
- **`chat.js`**: AI chat completions for intent analysis and prompt optimization

**Provider Configuration**:
- All providers configured via `/src/components/ApiSettings.vue`
- Supports multiple providers simultaneously
- Each provider can have multiple models
- Models are filtered by type (text/image/video) in node dropdowns
- Custom models can be added with configurable API format

**Error Handling**:
- All adapters provide user-friendly Chinese error messages
- HTTP status codes mapped to actionable messages
- Parameter validation before API calls
- Response validation after API calls

### Intent Analysis System

When "Auto Execute" mode is enabled:
1. User input is sent to GPT-4o with system prompt from `INTENT_ANALYSIS_PROMPT`
2. AI analyzes intent and returns JSON with workflow type and optimized prompts
3. Orchestrator automatically creates and executes appropriate workflow
4. Supports keyword detection for workflow routing (e.g., "视频" → text_to_image_to_video)

### Project Persistence

- Projects stored in localStorage via `/src/stores/projects.js`
- Each project contains: name, canvas data (nodes/edges/viewport), creation/update timestamps
- Auto-save with 500ms debounce on canvas changes
- Undo/redo with 50-step history limit

### Undo/Redo Implementation

Located in `/src/stores/canvas.js`:
- History snapshots saved after node/edge add/remove/duplicate operations
- Uses deep cloning to capture state
- `isRestoring` flag prevents infinite loops during undo/redo
- Keyboard shortcuts handled in canvas view

## Important Patterns

### Performance Optimization - Computed Caching

**Critical**: When multiple computed properties need to access the same expensive data (like filtering edges/nodes), cache the result in a single computed:

```javascript
// ❌ BAD - Repeated traversal
const connectedPrompts = computed(() => getConnectedInputs().prompts)
const connectedRefImages = computed(() => getConnectedInputs().refImages)

// ✅ GOOD - Single traversal, cached
const connectedInputs = computed(() => getConnectedInputs())
const connectedPrompts = computed(() => connectedInputs.value.prompts)
const connectedRefImages = computed(() => connectedInputs.value.refImages)
```

**Benefits**:
- Reduces filter/find operations by 50-67%
- Prevents lag during canvas pan/zoom
- Leverages Vue's computed cache effectively

### Avoiding Race Conditions in Node Initialization

**Critical Pattern**: When nodes have both `onMounted` and `watch with immediate: true`, they can create race conditions causing nodes to disappear or state corruption.

```javascript
// ❌ BAD - Race condition
onMounted(() => {
  updateNode(props.id, { model: defaultModel })
})
watch(() => props.data?.autoExecute, (val) => {
  if (val) {
    updateNode(props.id, { autoExecute: false })  // Conflicts with onMounted!
  }
}, { immediate: true })

// ✅ GOOD - Sequential execution
onMounted(async () => {
  // 1. Initialize model
  updateNode(props.id, { model: defaultModel })

  // 2. Wait for DOM updates
  await nextTick()

  // 3. Initialize dependent state
  initializeCustomParams()

  // 4. Wait again, then check autoExecute
  await nextTick()

  // 5. Manually trigger autoExecute if needed
  if (props.data?.autoExecute) {
    updateNode(props.id, { autoExecute: false })
    setTimeout(() => handleGenerate(), 100)
  }
})

// Watch without immediate - only responds to runtime changes
watch(() => props.data?.autoExecute, (val) => {
  if (val) {
    updateNode(props.id, { autoExecute: false })
    setTimeout(() => handleGenerate(), 100)
  }
})
```

### No Side Effects in Computed Properties

**Critical**: Computed properties must be pure - no modifying reactive state:

```javascript
// ❌ BAD - Side effect in computed
const customParamsList = computed(() => {
  modelConfig.customParams.forEach(param => {
    if (!customParamsValues.value[param.key]) {
      customParamsValues.value[param.key] = defaultValue  // ❌ Mutation!
    }
  })
  return modelConfig.customParams.map(...)
})

// ✅ GOOD - Pure computed + separate initialization
const customParamsList = computed(() => {
  return modelConfig.customParams.map(param => ({
    key: param.key,
    options: param.options
  }))
})

// Initialize in watch or onMounted
watch(() => localModel.value, () => {
  initializeCustomParams()  // ✅ Separate function
})
```

### Node Resize with useNodeResize Hook

Nodes support dynamic resizing via the `useNodeResize` composable:

```javascript
import { useNodeResize } from '@/hooks'

const { nodeStyle, startResize } = useNodeResize(props.id, props.data, {
  minWidth: 180,
  minHeight: 200,
  maxWidth: 500,
  maxHeight: 600
})
```

**Template usage**:
```html
<div class="resizable-node" :style="nodeStyle">
  <!-- Content -->
  <div class="resize-handle" @mousedown="startResize">
    <!-- Handle icon -->
  </div>
</div>
```

**Key behaviors**:
- Uses temporary dimensions during resize (tempWidth/tempHeight)
- Persists to store on mouseup via `updateNode`
- Accounts for canvas zoom level
- Uses RAF throttling for smooth updates

### Node ID Generation
- Format: `node_${counter++}` for standard nodes
- Format: `workflow_node_${timestamp}_${counter++}` for workflow-generated nodes
- Counter persists across project loads by parsing existing max ID

### Auto-Execution Flow
1. Config node with `autoExecute: true` is created
2. Connected input nodes provide data (prompts, images)
3. Config node automatically triggers API call on data change
4. On success, config node creates output node (image/video)
5. Config node stores `outputNodeId` for workflow tracking

### Multi-Input Handling
Config nodes can accept multiple inputs:
- Multiple text inputs → prompts concatenated by `promptOrder`
- Multiple image inputs → reference images ordered by `imageOrder`
- Example: Product workflow uses product info + product image + specific prompt

### Error Handling
- Nodes track errors in `data.error` field
- Workflow orchestrator rejects promises on node errors
- Toast notifications via Naive UI's global `window.$message`

## Common Development Tasks

### Adding a New Node Type
1. Create component in `/src/components/nodes/YourNode.vue`
2. Add default data in `getDefaultNodeData()` in `/src/stores/canvas.js`
3. Register in main canvas view's node type mapping
4. Add handles for connections (left/right)

### Creating a New Workflow Template
1. Add template object to `WORKFLOW_TEMPLATES` in `/src/config/workflows.js`
2. Implement `createNodes(startPosition)` function
3. Return `{ nodes, edges }` with proper connections
4. Add cover image to `/src/assets/`

### Modifying API Endpoints
1. Update base URL in settings panel (stored in `/src/stores/api.js`)
2. API configuration persists to localStorage
3. All requests go through `/src/utils/request.js` Axios instance

### Testing Workflows
1. Use "Auto Execute" mode for end-to-end testing
2. Or manually create nodes and connect them
3. Check browser console for `[Workflow ...]` logs
4. Verify node `data.executed` and `data.outputNodeId` states

## Key Constraints

- Node connections validated by handle compatibility
- Config nodes require at least one prompt input
- Video generation requires image input
- Workflow timeouts set to 5 minutes per step
- History limited to 50 operations
- Project data stored in localStorage (browser limit ~5-10MB)

## Development Configuration

### Vite Configuration

**Path Aliases** (`vite.config.js`):
```javascript
alias: {
  '@': path.resolve(__dirname, 'src')
}
```
Use `@/` prefix for imports:
```javascript
import { useNodeResize } from '@/hooks'
import { providers } from '@/stores/providers'
```

**Proxy Setup**:
- Development server proxies `/v1` requests to `https://api.chatfire.site`
- Change origin for CORS handling

**Base Path**:
- Production builds use `/dream-canvas` base path
- Configure when deploying to subdirectories

## File Structure Notes

```
src/
├── api/           # API client functions (image, video, chat)
├── components/
│   ├── nodes/     # 6 node type components (text, image, imageConfig, video, videoConfig, imageBlend)
│   ├── edges/     # Custom edge components (PromptOrderEdge, ImageOrderEdge, ImageRoleEdge)
│   ├── ApiSettings.vue      # API config modal
│   ├── DownloadModal.vue    # Batch download modal
│   └── WorkflowPanel.vue    # Workflow template selector
├── hooks/         # Composables (useWorkflowOrchestrator, useApi, useNodeResize, etc.)
├── stores/        # State management (canvas, projects, providers, theme, lastUsedModels)
├── config/        # Configuration (imageProviders, workflows, customWorkflows)
├── utils/         # Utilities (request, indexedDB, imageStorage, migration, schema validation)
└── views/         # Page components (Home, Canvas)
```

## Notes

- All user-facing text is in Chinese
- Uses OpenAI-compatible API format (not OpenAI directly)
- Canvas state auto-saves but requires explicit project switching to persist
- Undo/redo only affects current session, not across project reloads
- Dark mode preference persists to localStorage
