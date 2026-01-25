# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Canvas (梦幻画布) - A visual AI creation canvas based on Vue Flow, supporting node-based orchestration of AI workflows including text-to-image and video generation.

**Live Demo**: https://marketing.chatfire.site/huobao-canvas/

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
- **`projects.js`**: Multi-project management with localStorage persistence
- **`api.js`**: API configuration (base URL, API key, model selection) - **DEPRECATED**, see providers below
- **`theme.js`**: Dark/light theme switching
- **`models.js`**: Available AI models configuration - **DEPRECATED**, see providers below
- **`providers.js`**: Multi-provider system with API key management, model configuration, and custom model support

### Multi-Provider System

**Key Files**:
- `/src/config/imageProviders.js`: Preset provider configurations and model type definitions
- `/src/stores/providers.js`: Provider state management with localStorage persistence
- `/src/api/providers/`: Adapter implementations for different providers
  - `base.js`: Base adapter class
  - `openai.js`: OpenAI DALL-E adapter
  - `doubao.js`: Doubao (ByteDance) adapter
  - `gemini.js`: Google Gemini adapter
  - `index.js`: Adapter factory

**Features**:
- **Multiple Providers**: Support for OpenAI, Gemini, Banana-pro, Doubao, and custom providers
- **Model Types**: Three model categories (text, image, video) for filtering
- **Custom Models**: Users can add their own models with configurable API format (openai/gemini/doubao)
- **Automatic Provider Detection**: System auto-detects which provider to use based on selected model
- **Reference Images**: Different providers handle reference images differently (OpenAI rejects them, Doubao uses `image_url`, Gemini uses base64 inlineData)
- **Backward Compatibility**: Auto-migrates old API key configuration to new provider system

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

The canvas uses a node-based architecture with 5 core node types defined in `/src/components/nodes/`:

1. **TextNode**: Input/edit prompt text
2. **ImageConfigNode**: Configure image generation parameters (model, size, quantity)
3. **ImageNode**: Display generated images or upload local images
4. **VideoConfigNode**: Configure video generation parameters (supports first/last frame images)
5. **VideoNode**: Display generated videos

Each node has:
- Input/output handles for connections
- Auto-execution capability (`autoExecute` flag)
- Result tracking (`executed`, `outputNodeId`)
- Error handling

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

## File Structure Notes

```
src/
├── api/           # API client functions (image, video, chat)
├── components/
│   ├── nodes/     # 5 node type components
│   ├── edges/     # Custom edge components
│   ├── ApiSettings.vue      # API config modal
│   └── WorkflowPanel.vue    # Workflow template selector
├── hooks/         # Composables (useWorkflowOrchestrator, useApi, etc.)
├── stores/        # State management (canvas, projects, api, theme)
├── config/        # Configuration (models, workflows)
├── utils/         # Utilities (request, constants, schema validation)
└── views/         # Page components
```

## Notes

- All user-facing text is in Chinese
- Uses OpenAI-compatible API format (not OpenAI directly)
- Canvas state auto-saves but requires explicit project switching to persist
- Undo/redo only affects current session, not across project reloads
- Dark mode preference persists to localStorage
