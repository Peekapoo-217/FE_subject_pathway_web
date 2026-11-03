import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { ChatResponse } from '../models/chat.models';
import { environment } from '../../../../environments/environment';

describe('ChatService', () => {
  let service: ChatService;
  let http: HttpTestingController;
  const endpoint = environment.RAG_API_URL || 'http://localhost:8000/api/chat';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ChatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends prior turns once and keeps the current question outside context', async () => {
    const firstSend = service.sendMessage('Tôi thích Toán');
    const firstRequest = http.expectOne(endpoint);
    expect(firstRequest.request.body).toEqual({ user_message: 'Tôi thích Toán', context: [] });
    firstRequest.flush({ status: 'incomplete', message: 'Em cho biết thêm trường nhé.' } satisfies ChatResponse);
    await firstSend;

    const secondSend = service.sendMessage('Trường Tôn Đức Thắng');
    const secondRequest = http.expectOne(endpoint);
    expect(secondRequest.request.body).toEqual({
      user_message: 'Trường Tôn Đức Thắng',
      context: [
        { role: 'user', content: 'Tôi thích Toán' },
        { role: 'assistant', content: 'Em cho biết thêm trường nhé.' }
      ]
    });
    secondRequest.flush({ status: 'no_data', message: 'Chưa có dữ liệu.' } satisfies ChatResponse);
    await secondSend;

    expect(service.messages().at(-1)?.content).toBe('Chưa có dữ liệu.');
  });

  it('does not send blank input and clears conversation state', async () => {
    await service.sendMessage('   ');
    http.expectNone(endpoint);

    service.clearMessages();

    expect(service.messages()).toHaveSize(1);
    expect(service.error()).toBeNull();
  });

  it('sends no more than the 40 prior turns accepted by the API', async () => {
    service.messages.set(Array.from({ length: 45 }, (_, index) => ({
      id: `history-${index}`,
      role: 'user' as const,
      content: `prior turn ${index}`,
      timestamp: new Date()
    })));

    const send = service.sendMessage('current turn');
    const request = http.expectOne(endpoint);
    expect(request.request.body.context).toHaveSize(40);
    expect(request.request.body.context[0].content).toBe('prior turn 5');
    request.flush({ status: 'success', message: 'answer' } satisfies ChatResponse);
    await send;
  });

  it('shows a user friendly connection error without infrastructure commands', async () => {
    const send = service.sendMessage('Xin chào');
    const request = http.expectOne(endpoint);
    request.flush({ message: 'unavailable' }, { status: 503, statusText: 'Unavailable' });
    await send;

    const lastMessage = service.messages().at(-1);
    expect(lastMessage?.isError).toBeTrue();
    expect(lastMessage?.content).not.toContain('docker');
    expect(lastMessage?.content).not.toContain('localhost');
    expect(service.isLoading()).toBeFalse();
  });
});
