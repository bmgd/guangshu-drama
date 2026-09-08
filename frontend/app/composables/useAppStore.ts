const ASSISTANT_PANEL_DEFAULT_WIDTH = 380
const ASSISTANT_PANEL_MIN = 320
const ASSISTANT_PANEL_MAX = 560

export function clampAssistantPanelWidth(width: number) {
  return Math.min(ASSISTANT_PANEL_MAX, Math.max(ASSISTANT_PANEL_MIN, width))
}

export function useAppStore() {
  const assistantPanelOpen = useState('assistantPanelOpen', () => true)
  const assistantPanelWidth = useState('assistantPanelWidth', () => ASSISTANT_PANEL_DEFAULT_WIDTH)
  const sidebarCollapsed = useState('sidebarCollapsed', () => false)
  const configReady = useState('configReady', () => true)
  const pipelineLogs = useState<Array<{ step: string; message: string; time: string }>>('pipelineLogs', () => [])

  function toggleAssistantPanel() {
    assistantPanelOpen.value = !assistantPanelOpen.value
  }

  function setAssistantPanelWidth(width: number) {
    assistantPanelWidth.value = clampAssistantPanelWidth(width)
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function addPipelineLog(step: string, message: string) {
    pipelineLogs.value.push({ step, message, time: new Date().toLocaleTimeString() })
  }

  function clearPipelineLogs() {
    pipelineLogs.value = []
  }

  return {
    assistantPanelOpen,
    assistantPanelWidth,
    sidebarCollapsed,
    configReady,
    pipelineLogs,
    toggleAssistantPanel,
    setAssistantPanelWidth,
    toggleSidebar,
    addPipelineLog,
    clearPipelineLogs,
    ASSISTANT_PANEL_DEFAULT_WIDTH,
    ASSISTANT_PANEL_MIN,
    ASSISTANT_PANEL_MAX,
  }
}
