import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AdminApiService } from './admin-api.service';
import { AdminDashboardComponent } from './admin-dashboard.component';

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let api: jasmine.SpyObj<AdminApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'documents', 'drafts', 'users', 'createUser', 'updateDocument', 'combinations', 'archiveCombination'
    ]);
    api.documents.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403,
      error: { success: false, message: 'Không được phép xem tài liệu.' }
    })));
    api.drafts.and.returnValue(of({ success: true, data: { items: [], hasNext: false, nextCursor: '' } }));
    api.users.and.returnValue(of({ success: true, data: { items: [], hasNext: false, nextCursor: '' } }));

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        { provide: AdminApiService, useValue: api },
        { provide: AuthService, useValue: { user: null, isSuperAdmin: true } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows list errors with an accessible retry action', () => {
    const root = fixture.nativeElement as HTMLElement;
    const alert = root.querySelector('.error-state[role="alert"]');

    expect(alert?.textContent).toContain('Không được phép xem tài liệu.');
    expect(alert?.querySelector('button')?.textContent).toContain('Thử tải lại');
  });

  it('retries a failed list request from its inline error state', () => {
    const retry = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.error-state button');
    if (!retry) throw new Error('Retry button was not rendered');

    retry.click();

    expect(api.documents).toHaveBeenCalledTimes(2);
  });

  it('highlights an invalid new-user password before calling the API', async () => {
    const usersTab = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#tab-users');
    if (!usersTab) throw new Error('Users tab was not rendered');
    usersTab.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const username = root.querySelector<HTMLInputElement>('input[name="newUsername"]');
    const password = root.querySelector<HTMLInputElement>('input[name="newPassword"]');
    const form = root.querySelector<HTMLFormElement>('form.inline-form');
    if (!username || !password || !form) throw new Error('User form was not rendered');

    username.value = 'student';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = 'five5';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.createUser).not.toHaveBeenCalled();
    expect(password.classList.contains('ng-invalid')).toBeTrue();
    expect(password.classList.contains('ng-touched')).toBeTrue();
    expect(root.querySelector('#new-password-error')?.textContent).toContain('ít nhất 6 ký tự');
  });

  it('edits document metadata through the page form', async () => {
    api.documents.and.returnValue(of({ success: true, data: {
      items: [{ id: 'doc-1', title: 'Phương án môn học', academicYear: '2026-2027', status: 'UPLOADED', schoolName: 'Trường A', filename: 'plan.pdf' }],
      hasNext: false, nextCursor: ''
    } }));
    api.updateDocument.and.returnValue(of({ success: true, data: undefined }));
    fixture.componentInstance.loadDocuments();
    await fixture.whenStable();
    fixture.detectChanges();

    const edit = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.actions button'))
      .find((button) => button.textContent?.trim() === 'Sửa');
    if (!edit) throw new Error('Document edit action was not rendered');
    edit.click();
    fixture.detectChanges();
    const form = (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('.edit-panel form');
    const title = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="editTitle"]');
    if (!form || !title) throw new Error('Document edit form was not rendered');
    title.value = 'Phương án cập nhật';
    fixture.componentInstance.editTitle = title.value;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.updateDocument).toHaveBeenCalledWith('doc-1', 'Phương án cập nhật', '2026-2027');
  });

  it('asks for confirmation before archiving a combination', async () => {
    api.combinations.and.returnValue(of({ success: true, data: {
      items: [{ id: 'MATH_PHYSICS', display: 'Toán, Vật lý', componentCount: 2, active: true }],
      hasNext: false, nextCursor: ''
    } }));
    api.archiveCombination.and.returnValue(of({ success: true, data: undefined }));
    const tab = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#tab-combinations');
    if (!tab) throw new Error('Combination tab was not rendered');
    tab.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const archive = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.actions button'))
      .find((button) => button.textContent?.trim() === 'Lưu trữ');
    if (!archive) throw new Error('Archive action was not rendered');
    archive.click();
    fixture.detectChanges();
    expect(api.archiveCombination).not.toHaveBeenCalled();

    const confirm = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.actions button'))
      .find((button) => button.textContent?.trim() === 'Xác nhận');
    if (!confirm) throw new Error('Archive confirmation action was not rendered');
    confirm.click();

    expect(api.archiveCombination).toHaveBeenCalledWith('MATH_PHYSICS');
  });
});
