import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Subject } from 'rxjs';

export type SessionEvent = 'changed' | 'logout';

/** Same-origin browser tabs serialize every operation that changes the refresh cookie. */
@Injectable({ providedIn: 'root' })
export class SessionCoordinator {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly channel = this.browser && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('subject-pathway.auth') : null;
  private readonly eventsSubject = new Subject<SessionEvent>();
  readonly events = this.eventsSubject.asObservable();

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'changed' || event.data === 'logout') this.eventsSubject.next(event.data);
      };
    }
    inject(DestroyRef).onDestroy(() => {
      this.channel?.close();
      this.eventsSubject.complete();
    });
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.browser || !navigator.locks) {
      return Promise.reject(new Error('Browser session coordination requires HTTPS and Web Locks.'));
    }
    return await navigator.locks.request('subject-pathway.auth-cookie', operation);
  }

  notify(event: SessionEvent): void { this.channel?.postMessage(event); }
}
