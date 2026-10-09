import {
  Component,
  ElementRef,
  ViewChild,
  afterNextRender,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.css'
})
export class ChatWidgetComponent {
  protected readonly chatService = inject(ChatService);

  @ViewChild('chatMessages') private chatMessagesRef?: ElementRef<HTMLDivElement>;

  protected readonly isOpen = signal<boolean>(false);
  protected readonly inputText = signal<string>('');

  constructor() {
    afterNextRender(() => {
      if (this.isOpen()) {
        this.scrollToBottom();
      }
    });
  }

  protected toggleChat(): void {
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);
    if (nextState) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  protected closeChat(): void {
    this.isOpen.set(false);
  }

  protected async send(): Promise<void> {
    const text = this.inputText().trim();
    if (!text || this.chatService.isLoading()) {
      return;
    }

    this.inputText.set('');
    setTimeout(() => this.scrollToBottom(), 50);

    await this.chatService.sendMessage(text);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  protected handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  protected clear(): void {
    this.chatService.clearMessages();
  }

  private scrollToBottom(): void {
    if (this.chatMessagesRef?.nativeElement) {
      const el = this.chatMessagesRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
