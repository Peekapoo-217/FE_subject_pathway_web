import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ChatHistoryItem, ChatMessage, ChatRequest, ChatResponse } from '../models/chat.models';

const WELCOME_TEXT = `Xin chào bạn! 🎓
Mình là trợ lý tư vấn tuyển sinh đại học & định hướng môn học THPT. Bạn cần tìm hiểu về ngành học, trường đại học hay khối thi nào?`;

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);

  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: WELCOME_TEXT,
      timestamp: new Date()
    }
  ]);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /** Chuyển đổi danh sách tin nhắn hiện tại sang định dạng context cho API */
  private getHistoryForApi(): ChatHistoryItem[] {
    return this.messages()
      .filter((m) => !m.isError && m.id !== 'welcome-msg')
      .map((m) => ({
        role: m.role,
        content: m.content
      }));
  }

  async sendMessage(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed || this.isLoading()) {
      return;
    }

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-user',
      role: 'user',
      content: trimmed,
      timestamp: new Date()
    };

    // Cập nhật tin nhắn người dùng vào UI
    this.messages.update((prev) => [...prev, userMsg]);
    this.isLoading.set(true);
    this.error.set(null);

    const endpoint = environment.RAG_API_URL || 'http://localhost:8000/api/chat';
    const history = this.getHistoryForApi();

    const requestPayload: ChatRequest = {
      user_message: trimmed,
      context: history,
      chat_history: history
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    try {
      const response = await firstValueFrom(
        this.http.post<ChatResponse>(endpoint, requestPayload, { headers })
      );

      const botText = response?.message || 'Không nhận được câu trả lời từ hệ thống.';
      const botMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-bot',
        role: 'assistant',
        content: botText,
        timestamp: new Date()
      };

      this.messages.update((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Không thể kết nối đến máy chủ RAG. Vui lòng kiểm tra lại server backend (http://localhost:8000).';

      this.error.set(errorMessage);

      const errorMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'assistant',
        content: `⚠️ **Lỗi kết nối:** ${errorMessage}\n\n*Gợi ý:* Hãy kiểm tra lại backend Python RAG (\`docker compose up -d\` hoặc \`python rag_api/main_api.py\`).`,
        timestamp: new Date(),
        isError: true
      };

      this.messages.update((prev) => [...prev, errorMsg]);
    } finally {
      this.isLoading.set(false);
    }
  }

  clearMessages(): void {
    this.messages.set([
      {
        id: 'welcome-msg-' + Date.now(),
        role: 'assistant',
        content: WELCOME_TEXT,
        timestamp: new Date()
      }
    ]);
    this.error.set(null);
  }
}
