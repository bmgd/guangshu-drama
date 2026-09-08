<template>
  <div class="agent-copilot">
    <div class="copilot-header">
      <div class="copilot-title">
        <Bot :size="16" />
        <span>Agent 助手</span>
      </div>
      <button class="icon-btn" title="关闭面板" @click="toggleAssistantPanel">
        <X :size="16" />
      </button>
    </div>

    <div class="copilot-actions">
      <button class="action-btn" :disabled="busy" @click="emit('rewrite')">
        <FileText :size="14" /> 改写剧本
      </button>
      <button class="action-btn" :disabled="busy" @click="emit('extract')">
        <Users :size="14" /> 提取元素
      </button>
      <button class="action-btn" :disabled="busy" @click="emit('storyboard')">
        <Clapperboard :size="14" /> 拆解分镜
      </button>
      <button class="action-btn primary" :disabled="busy" @click="emit('pipeline')">
        <Zap :size="14" /> 一键流水线
      </button>
    </div>

    <div class="copilot-tasks" v-if="stats.total > 0">
      <div class="section-label">任务状态</div>
      <div class="task-stats">
        <span v-if="stats.running" class="stat running">{{ stats.running }} 运行中</span>
        <span v-if="stats.queued" class="stat queued">{{ stats.queued }} 排队</span>
        <span v-if="stats.completed" class="stat done">{{ stats.completed }} 完成</span>
        <span v-if="stats.failed" class="stat failed">{{ stats.failed }} 失败</span>
      </div>
    </div>

    <div class="copilot-chat">
      <div class="section-label">对话</div>
      <div class="chat-list" ref="chatListRef">
        <div v-if="!messages.length" class="chat-empty">输入问题，助手可查询角色/场景/剧本</div>
        <div v-for="(msg, i) in messages" :key="i" class="chat-msg" :class="msg.role">
          <div v-if="msg.toolCalls?.length" class="tool-steps">
            <span v-for="(t, j) in msg.toolCalls" :key="j" class="tool-chip">调用工具: {{ t }}</span>
          </div>
          <div class="chat-bubble">{{ msg.content }}</div>
        </div>
      </div>
      <div class="chat-input-row">
        <textarea
          v-model="input"
          rows="2"
          placeholder="问助手…（可查询角色、场景、剧本）"
          :disabled="chatLoading"
          @keydown.enter.exact.prevent="sendChat"
        />
        <button class="send-btn" :disabled="chatLoading || !input.trim()" @click="sendChat">
          {{ chatLoading ? '…' : '发送' }}
        </button>
      </div>
    </div>

    <div class="copilot-logs">
      <div class="section-label">
        <span>执行日志</span>
        <button v-if="logs.length" class="ghost clear-btn" @click="clearPipelineLogs">清空</button>
      </div>
      <div class="log-list" ref="logListRef">
        <div v-if="!logs.length" class="log-empty">
          <Bot :size="24" style="opacity:0.3" />
          <p>运行流水线后，日志将在此实时显示</p>
        </div>
        <div v-for="(log, i) in logs" :key="i" class="log-item" :class="log.step">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-step">[{{ log.step }}]</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bot, X, FileText, Users, Clapperboard, Zap } from 'lucide-vue-next'
import { useAgent } from '../../composables/useAgent'

const props = defineProps<{
  loading?: boolean
  dramaId?: number
  episodeId?: number
}>()

const emit = defineEmits<{
  rewrite: []
  extract: []
  storyboard: []
  pipeline: []
}>()

const { pipelineLogs: logs, clearPipelineLogs, toggleAssistantPanel } = useAppStore()
const { stats } = useTasksStore()
const agent = useAgent()

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: string[]
}

const messages = ref<ChatMsg[]>([])
const input = ref('')
const chatLoading = ref(false)
const logListRef = ref<HTMLElement>()
const chatListRef = ref<HTMLElement>()

const busy = computed(() => props.loading || chatLoading.value)

async function sendChat() {
  const text = input.value.trim()
  if (!text || chatLoading.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  chatLoading.value = true
  try {
    const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
    const res = await agent.chat(history, props.dramaId, props.episodeId)
    const toolNames = [
      ...new Set([
        ...(res.toolCalls?.map((t) => t.toolName) || []),
        ...(res.steps?.flatMap((s) => s.toolCalls || []) || []),
      ]),
    ]
    messages.value.push({
      role: 'assistant',
      content: res.text || '（无回复）',
      toolCalls: toolNames,
    })
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: e instanceof Error ? e.message : '对话失败',
    })
  } finally {
    chatLoading.value = false
    nextTick(() => {
      if (chatListRef.value) chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    })
  }
}

watch(logs, () => {
  nextTick(() => {
    if (logListRef.value) {
      logListRef.value.scrollTop = logListRef.value.scrollHeight
    }
  })
}, { deep: true })
</script>

<style scoped>
.agent-copilot {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.copilot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-hairline-soft);
  flex-shrink: 0;
}
.copilot-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text);
}
.copilot-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 12px;
  border-bottom: 1px solid var(--color-hairline-soft);
  flex-shrink: 0;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-hairline);
  background: var(--color-surface);
  color: var(--color-text-2);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.action-btn:hover:not(:disabled) { background: var(--color-surface-hover); color: var(--color-text); }
.action-btn.primary {
  grid-column: span 2;
  background: linear-gradient(135deg, var(--color-accent), oklch(0.60 0.10 280));
  border-color: transparent;
  color: oklch(0.12 0 0);
  justify-content: center;
  font-weight: 600;
}
.copilot-tasks {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-hairline-soft);
  flex-shrink: 0;
}
.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.clear-btn { font-size: 11px; padding: 2px 6px; }
.task-stats { display: flex; flex-wrap: wrap; gap: 6px; }
.stat {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-hairline);
}
.stat.running { color: var(--color-accent); border-color: var(--color-accent-soft); }
.stat.done { color: var(--color-success); }
.stat.failed { color: var(--color-danger); }
.copilot-chat {
  flex: 1;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-hairline-soft);
}
.chat-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.chat-empty { font-size: 12px; color: var(--color-text-3); padding: 12px 0; text-align: center; }
.chat-msg { display: flex; flex-direction: column; gap: 4px; }
.chat-msg.user { align-items: flex-end; }
.chat-msg.assistant { align-items: flex-start; }
.chat-bubble {
  max-width: 92%;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg.user .chat-bubble {
  background: var(--color-accent-soft);
  color: var(--color-text);
}
.chat-msg.assistant .chat-bubble {
  background: var(--color-surface);
  border: 1px solid var(--color-hairline);
  color: var(--color-text-2);
}
.tool-steps { display: flex; flex-wrap: wrap; gap: 4px; }
.tool-chip {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: oklch(0.22 0.02 280);
  color: var(--color-accent);
  border: 1px solid var(--color-accent-soft);
}
.chat-input-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-shrink: 0;
}
.chat-input-row textarea {
  flex: 1;
  min-height: 48px;
  resize: none;
  font-size: 12px;
}
.send-btn {
  align-self: flex-end;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
}
.copilot-logs { flex: 0.8; min-height: 80px; display: flex; flex-direction: column; overflow: hidden; padding: 10px 14px; }
.log-list { flex: 1; overflow-y: auto; }
.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  color: var(--color-text-3);
  font-size: 12px;
  text-align: center;
}
.log-item {
  display: flex;
  gap: 6px;
  padding: 4px 0;
  font-size: 12px;
  line-height: 1.4;
  border-bottom: 1px solid var(--color-hairline-soft);
}
.log-time { color: var(--color-text-3); flex-shrink: 0; font-size: 11px; }
.log-step { color: var(--color-accent); flex-shrink: 0; font-weight: 500; }
.log-msg { color: var(--color-text-2); }
.log-item.error .log-step, .log-item.error .log-msg { color: var(--color-danger); }
.log-item.done .log-step { color: var(--color-success); }
</style>
