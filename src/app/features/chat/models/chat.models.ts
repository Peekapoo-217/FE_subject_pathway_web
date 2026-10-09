export type MessageRole = 'user' | 'assistant';

export interface ChatHistoryItem {
  role: MessageRole;
  content: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export interface ChatConfig {
  ragApiUrl: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
}

export interface ChatRequest {
  user_message: string;
  context: ChatHistoryItem[];
  chat_history?: ChatHistoryItem[];
  override_config?: {
    api_key?: string;
    model?: string;
    base_url?: string;
  };
}

export interface ChatResponse {
  status: 'ready' | 'incomplete' | 'success' | string;
  message: string;
  data?: Record<string, unknown> | null;
}
