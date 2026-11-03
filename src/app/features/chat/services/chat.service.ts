import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { getErrorMessage } from '../../../core/http/error-message';
import { ChatHistoryItem, ChatMessage, ChatRequest, ChatResponse } from '../models/chat.models';

const WELCOME_TEXT = `Xin chào bạn! 🎓
Mình có thể giúp em tìm hiểu nhóm môn THPT, đối chiếu nhóm môn theo sở thích và năng lực, hoặc tra cứu tổ hợp và ngành có liên kết trong dữ liệu.`;

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
      .slice(-40)
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

    const history = this.getHistoryForApi();

    // Keep the current message separate; the API adds it after its conversation context.
    this.messages.update((prev) => [...prev, userMsg]);
    this.isLoading.set(true);
    this.error.set(null);

    const endpoint = environment.RAG_API_URL || 'http://localhost:8000/api/chat';
    const requestPayload: ChatRequest = {
      user_message: trimmed,
      context: history
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
      const errorMessage = getErrorMessage(
        err,
        'Không thể kết nối đến máy chủ tư vấn. Vui lòng thử lại sau.'
      );

      this.error.set(errorMessage);

      const errorMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'assistant',
        content: `⚠️ **Lỗi kết nối:** ${errorMessage}\n\nEm thử gửi lại sau ít phút nhé.`,
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
