/**
 * Text Generation Hook | 文本生成 Hook
 * Supports multiple API formats (OpenAI, Gemini, etc.)
 */

import { ref } from 'vue'
import { providers, activeProviderId } from '@/stores/providers'
import { createAdapterForModel } from '@/api/providers'
import { useApiState } from './useApi'

/**
 * Text generation composable | 文本生成组合式函数
 * @param {Object} options - { model, systemPrompt, customParams }
 */
export const useTextGeneration = (options = {}) => {
  const { loading, error, status, reset, setLoading, setError, setSuccess } = useApiState()

  const currentResponse = ref('')
  let abortController = null

  /**
   * Generate text | 生成文本
   * @param {string} prompt - 用户输入的提示词
   * @param {Object} options - 选项 { stream, customParams }
   */
  const generate = async (prompt, generateOptions = {}) => {
    setLoading(true)
    currentResponse.value = ''

    try {
      const model = options.model || 'gpt-4o-mini'
      const stream = generateOptions.stream !== false // 默认流式
      const customParams = generateOptions.customParams || options.customParams || {}

      // 获取当前激活的供应商
      const providerId = activeProviderId.value
      const provider = providers.value.find(p => p.id === providerId)

      if (!provider) {
        throw new Error('未找到供应商配置')
      }

      // 创建适配器（会根据模型的 apiFormat 自动选择）
      const adapter = createAdapterForModel(providerId, model, {
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        models: provider.models
      })

      // 检查适配器是否支持 generateText 方法
      if (typeof adapter.generateText === 'function') {
        // 使用适配器的 generateText 方法（支持 Gemini 等格式）
        const fullPrompt = options.systemPrompt
          ? `${options.systemPrompt}\n\n${prompt}`
          : prompt

        const result = await adapter.generateText({
          prompt: fullPrompt,
          model,
          customParams
        })

        currentResponse.value = result
        setSuccess()
        return result
      } else {
        // 回退到 OpenAI 格式（使用 chat API）
        const { streamChatCompletions } = await import('@/api/chat')

        const msgList = [
          ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt }
        ]

        if (stream) {
          status.value = 'streaming'
          abortController = new AbortController()
          let fullResponse = ''

          for await (const chunk of streamChatCompletions(
            {
              model,
              messages: msgList,
              providerConfig: {
                apiKey: provider.apiKey,
                baseUrl: provider.baseUrl
              }
            },
            abortController.signal
          )) {
            fullResponse += chunk
            currentResponse.value = fullResponse
          }

          setSuccess()
          return fullResponse
        } else {
          // 非流式请求
          const { chatCompletions } = await import('@/api/chat')
          const response = await chatCompletions({
            model,
            messages: msgList
          })

          const result = response.choices?.[0]?.message?.content || ''
          currentResponse.value = result
          setSuccess()
          return result
        }
      }
    } catch (err) {
      setError(err)
      throw err
    }
  }

  const stop = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const clear = () => {
    currentResponse.value = ''
    reset()
  }

  return {
    loading,
    error,
    status,
    currentResponse,
    generate,
    stop,
    clear,
    reset
  }
}

export default useTextGeneration
