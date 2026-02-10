<template>
  <n-modal v-model:show="showModal" preset="card" title="保存为工作流" style="width: 500px;">
    <n-form :model="formData" label-placement="left" label-width="80">

      <!-- 工作流名称 -->
      <n-form-item label="名称" required>
        <n-input
          v-model:value="formData.name"
          placeholder="例如：产品展示工作流"
          maxlength="50"
          show-count
        />
      </n-form-item>

      <!-- 工作流描述 -->
      <n-form-item label="描述">
        <n-input
          v-model:value="formData.description"
          type="textarea"
          placeholder="简要描述这个工作流的用途..."
          :autosize="{ minRows: 3, maxRows: 5 }"
          maxlength="200"
          show-count
        />
      </n-form-item>

      <!-- 节点统计 -->
      <n-form-item label="内容统计">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <div>节点数量：{{ nodeCount }}</div>
          <div>连线数量：{{ edgeCount }}</div>
          <div v-if="imageCount > 0">图片节点：{{ imageCount }} 个</div>
          <div v-if="textCount > 0">文本节点：{{ textCount }} 个</div>
        </div>
      </n-form-item>

    </n-form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <n-button @click="showModal = false">取消</n-button>
        <n-button
          type="primary"
          :disabled="!formData.name.trim()"
          @click="handleSave"
        >
          保存
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton } from 'naive-ui'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  nodes: {
    type: Array,
    default: () => []
  },
  edges: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:show', 'save'])

// Modal visibility
const showModal = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

// Form data
const formData = ref({
  name: '',
  description: ''
})

// 重置表单
watch(() => props.show, (val) => {
  if (val) {
    formData.value = {
      name: '',
      description: ''
    }
  }
})

// 节点统计
const nodeCount = computed(() => props.nodes.length)
const edgeCount = computed(() => props.edges.length)
const imageCount = computed(() => props.nodes.filter(n => n.type === 'image').length)
const textCount = computed(() => props.nodes.filter(n => n.type === 'text').length)

// 保存工作流
const handleSave = () => {
  if (!formData.value.name.trim()) {
    window.$message?.warning('请输入工作流名称')
    return
  }

  emit('save', {
    name: formData.value.name.trim(),
    description: formData.value.description.trim(),
    nodes: props.nodes,
    edges: props.edges
  })

  showModal.value = false
}
</script>

<style scoped>
/* 表单样式已由 Naive UI 提供 */
</style>
