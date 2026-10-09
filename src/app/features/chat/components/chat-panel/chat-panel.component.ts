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
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe],
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.css'
})
export class ChatPanelComponent {
  protected readonly chatService = inject(ChatService);

  @ViewChild('chatMessages') private chatMessagesRef?: ElementRef<HTMLDivElement>;

  protected readonly inputText = signal<string>('');

  constructor() {
    afterNextRender(() => {
      this.scrollToBottom();
    });
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
