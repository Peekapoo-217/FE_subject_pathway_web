import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { SessionCoordinator } from './session-coordinator.service';

describe('SessionCoordinator browser primitives', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));
  it('serializes independent coordinators that share the same browser lock', async () => {
    const first = TestBed.runInInjectionContext(() => new SessionCoordinator());
    const second = TestBed.runInInjectionContext(() => new SessionCoordinator());
    const order: string[] = [];
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const a = first.run(async () => { order.push('first'); entered(); await gate; order.push('released'); });
    await started;
    const b = second.run(async () => { order.push('second'); });
    expect(order).toEqual(['first']);
    release();
    await Promise.all([a, b]);
    expect(order).toEqual(['first', 'released', 'second']);
  });

  it('broadcasts session events between independent coordinators without tokens', async () => {
    const first = TestBed.runInInjectionContext(() => new SessionCoordinator());
    const second = TestBed.runInInjectionContext(() => new SessionCoordinator());
    const received = firstValueFrom(second.events.pipe(timeout(2000)));
    first.notify('logout');
    expect(await received).toBe('logout');
  });
});
