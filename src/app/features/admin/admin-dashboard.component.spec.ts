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
      'documents', 'draftGroups', 'drafts', 'deleteDraft', 'deleteDocument', 'approveDocumentDelete',
      'users', 'createUser', 'updateDocument', 'combinations', 'archiveCombination', 'retryDocumentExtraction',
      'editDraft', 'submitDraft', 'rejectDraft', 'publishDraftGroup', 'highSchools', 'provinces', 'suggestSchoolCode'
    ]);
    api.documents.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403,
      error: { success: false, message: 'Không được phép xem tài liệu.' }
    })));
    api.draftGroups.and.returnValue(of({ success: true, data: { items: [], hasNext: false, nextCursor: '' } }));
    api.drafts.and.returnValue(of({ success: true, data: { items: [], hasNext: false, nextCursor: '' } }));
    api.users.and.returnValue(of({ success: true, data: { items: [], hasNext: false, nextCursor: '' } }));
    api.highSchools.and.returnValue(of({ success: true, data: [{ code: 'SCHOOL', name: 'Trường A' }] }));
    api.provinces.and.returnValue(of({ success: true, data: [{ code: '01', name: 'Thành phố Hà Nội' }] }));
    api.suggestSchoolCode.and.returnValue(of({ success: true, data: {
      suggestedCode: 'TDT', available: true, canReuseExistingSchool: false,
      existingSchoolCode: null, existingSchoolName: null, existingSchoolLocation: null
    } }));

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

  it('loads existing schools and provinces for the document form', () => {
    expect(api.highSchools).toHaveBeenCalled();
    expect(api.provinces).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-academic-year-picker[name="year"]'))
      .not.toBeNull();
  });

  it('lets an admin reuse a matching school instead of creating a duplicate', () => {
    const root = fixture.nativeElement as HTMLElement;
    const schoolType = root.querySelector<HTMLSelectElement>('select[name="schoolType"]');
    if (!schoolType) throw new Error('School type selector was not rendered');
    schoolType.value = 'new';
    schoolType.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    fixture.componentInstance.schoolCodeSuggestion.set({
      suggestedCode: 'TĐT', available: false, canReuseExistingSchool: true,
      existingSchoolCode: 'TONDUCTHANG', existingSchoolName: 'Trường THPT Tôn Đức Thắng',
      existingSchoolLocation: 'Tỉnh Đắk Lắk'
    });
    fixture.detectChanges();

    const chooseExisting = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Dùng trường đã có');
    if (!chooseExisting) throw new Error('Existing school reuse action was not rendered');
    chooseExisting.click();

    expect(fixture.componentInstance.schoolType).toBe('existing');
    expect(fixture.componentInstance.schoolCode).toBe('TONDUCTHANG');
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
      items: [{ id: 'doc-1', title: 'Phương án môn học', academicYear: '2026-2027', status: 'UPLOADED', schoolName: 'Trường A', schoolCode: 'SCHOOL', filename: 'plan.pdf', errorCode: null, graphSyncStatus: null }],
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

    expect(api.updateDocument).toHaveBeenCalledWith('doc-1', 'Phương án cập nhật', '2026', undefined);
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

  it('shows a safe image extraction error and retries the failed job', async () => {
    api.documents.and.returnValue(of({ success: true, data: {
      items: [{ id: 'doc-1', title: 'Nhóm môn', academicYear: '2026-2027', status: 'FAILED',
        schoolName: 'Trường A', filename: 'groups.png', errorCode: 'MODEL_IMAGE_UNSUPPORTED', graphSyncStatus: null }],
      hasNext: false, nextCursor: ''
    } }));
    api.retryDocumentExtraction.and.returnValue(of({ success: true, data: undefined }));
    fixture.componentInstance.loadDocuments();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Model trích xuất chưa đọc được ảnh');
    const retry = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Thử trích xuất lại');
    if (!retry) throw new Error('Extraction retry action was not rendered');
    retry.click();
    expect(api.retryDocumentExtraction).toHaveBeenCalledWith('doc-1');
  });

  it('explains OCR empty output, engine failure, and timeout safely', () => {
    expect(fixture.componentInstance.extractionError('OCR_EMPTY'))
      .toContain('Không đọc được văn bản');
    expect(fixture.componentInstance.extractionError('OCR_ENGINE_ERROR'))
      .toContain('Bộ OCR không xử lý được');
    expect(fixture.componentInstance.extractionError('OCR_TIMEOUT'))
      .toContain('Đọc văn bản mất quá nhiều thời gian');
  });

  it('shows drafts under a school and academic year and loads their source document on expand', async () => {
    api.draftGroups.and.returnValue(of({ success: true, data: { items: [{ groupKey: 'S:school-a', schoolName: 'Trường A',
      schoolCode: 'school-a', location: 'Hà Nội', academicYear: '2026-2027', draftCount: 1, sourceDocumentCount: 1 }],
      hasNext: false, nextCursor: '' } }));
    api.drafts.and.returnValue(of({ success: true, data: { items: [{ id: 'draft-1', documentId: 'doc-1', documentVersionId: 'version-1', documentVersionNumber: 1,
      documentTitle: 'Phương án nhóm môn', documentFilename: 'groups.pdf', schoolName: 'Trường A', schoolCode: 'school-a',
      academicYear: '2026-2027', documentStatus: 'DRAFT_READY', groupCode: 'A01', groupName: 'Nhóm A01',
      subjectCodes: ['MATH', 'LITERATURE', 'PHYSICS', 'CHEMISTRY'], sourcePages: [2], status: 'DRAFT',
      confidence: 0.9, createdAt: '2026-10-14T00:00:00Z' }], hasNext: false, nextCursor: '' } }));
    fixture.componentInstance.loadDraftGroups();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector<HTMLButtonElement>('.draft-group-toggle');
    expect(toggle?.textContent).toContain('Trường A');
    expect(toggle?.textContent).toContain('2026-2027');
    expect(api.drafts).not.toHaveBeenCalled();
    toggle?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.drafts).toHaveBeenCalledWith('S:school-a', '2026-2027', undefined);
    expect(root.textContent).toContain('groups.pdf');
    expect(root.textContent).toContain('Nhóm A01');
  });

  it('uses direct soft-delete action for SUPER_ADMIN and removes add-version UI', async () => {
    api.documents.and.returnValue(of({ success: true, data: { items: [{ id: 'doc-1', title: 'Nhóm môn',
      academicYear: '2026-2027', status: 'UPLOADED', schoolName: 'Trường A', filename: 'groups.pdf', errorCode: null, graphSyncStatus: null }],
      hasNext: false, nextCursor: '' } }));
    api.deleteDocument.and.returnValue(of({ success: true, data: undefined }));
    fixture.componentInstance.loadDocuments();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const softDelete = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Xóa mềm');
    expect(root.textContent).not.toContain('Thêm phiên bản');
    if (!softDelete) throw new Error('SUPER_ADMIN soft-delete action was not rendered');
    softDelete.click();

    expect(api.deleteDocument).toHaveBeenCalledWith('doc-1');
  });

  it('shows a delete request action to ADMIN', async () => {
    const auth = TestBed.inject(AuthService) as unknown as { user: { role: string; username: string } | null; isSuperAdmin: boolean };
    auth.user = { role: 'ADMIN', username: 'admin' };
    auth.isSuperAdmin = false;
    api.documents.and.returnValue(of({ success: true, data: { items: [{ id: 'doc-1', title: 'Nhóm môn',
      academicYear: '2026-2027', status: 'UPLOADED', schoolName: 'Trường A', filename: 'groups.pdf', errorCode: null, graphSyncStatus: null }],
      hasNext: false, nextCursor: '' } }));
    api.deleteDocument.and.returnValue(of({ success: true, data: undefined }));
    fixture.componentInstance.loadDocuments();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const request = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Yêu cầu xóa');
    expect(root.textContent).not.toContain('Xóa mềm');
    if (!request) throw new Error('ADMIN delete-request action was not rendered');
    request.click();

    expect(api.deleteDocument).toHaveBeenCalledWith('doc-1');
  });

  it('requires all pages and an explicit review confirmation before publishing the whole school-year batch', async () => {
    const draft = { id: 'draft-1', documentId: 'doc-1', documentVersionId: 'version-1', documentVersionNumber: 1,
      documentTitle: 'Phương án nhóm môn', documentFilename: 'groups.pdf', schoolName: 'Trường A', schoolCode: 'school-a',
      academicYear: '2026-2027', documentStatus: 'DRAFT_READY', groupCode: 'A01', groupName: 'Nhóm A01',
      subjectCodes: ['MATH'], sourcePages: [2], status: 'DRAFT' as const, confidence: 0.9,
      createdAt: '2026-10-14T00:00:00Z' };
    const secondDraft = { ...draft, id: 'draft-2', documentId: 'doc-2', documentVersionId: 'version-2',
      groupCode: 'B02', groupName: 'Nhóm B02', subjectCodes: ['PHYSICS'], status: 'SUBMITTED' as const };
    api.draftGroups.and.returnValue(of({ success: true, data: { items: [{ groupKey: 'S:school-a', schoolName: 'Trường A',
      schoolCode: 'school-a', location: null, academicYear: '2026-2027', draftCount: 2, sourceDocumentCount: 2 }],
      hasNext: false, nextCursor: '' } }));
    api.drafts.and.returnValues(
      of({ success: true, data: { items: [draft], hasNext: true, nextCursor: 'next-drafts' } }),
      of({ success: true, data: { items: [secondDraft], hasNext: false, nextCursor: '' } })
    );
    api.editDraft.and.returnValue(of({ success: true, data: undefined }));
    api.publishDraftGroup.and.returnValue(of({ success: true, data: {
      batchId: 'batch-1', publishedGroupCount: 1, graphSyncStatus: 'PENDING'
    } }));
    api.documents.and.returnValue(of({ success: true, data: { items: [], hasNext: false, nextCursor: '' } }));
    fixture.componentInstance.loadDraftGroups();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.draft-group-toggle')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const initialPublish = Array.from(root.querySelectorAll<HTMLButtonElement>('.review-publish-panel button'))
      .find((button) => button.textContent?.includes('Công bố tất cả'));
    const reviewed = root.querySelector<HTMLInputElement>('.review-publish-panel input[type="checkbox"]');
    if (!initialPublish || !reviewed) throw new Error('Batch review controls were not rendered');
    expect(initialPublish.disabled).toBeTrue();
    expect(root.textContent).not.toContain('Lưu và gửi duyệt');
    expect(reviewed.disabled).toBeTrue();

    root.querySelector<HTMLButtonElement>('.draft-group-content .load-more')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.drafts).toHaveBeenCalledWith('S:school-a', '2026-2027', 'next-drafts');

    const publish = Array.from(root.querySelectorAll<HTMLButtonElement>('.review-publish-panel button'))
      .find((button) => button.textContent?.includes('Công bố tất cả'));
    const reviewAfterAllPages = root.querySelector<HTMLInputElement>('.review-publish-panel input[type="checkbox"]');
    if (!publish || !reviewAfterAllPages) throw new Error('Batch review confirmation was not rendered after loading every page');
    expect(publish.disabled).toBeTrue();
    expect(reviewAfterAllPages.disabled).toBeFalse();
    reviewAfterAllPages.click();
    fixture.detectChanges();
    expect(publish.disabled).toBeFalse();
    publish.click();
    await fixture.whenStable();

    expect(api.editDraft).toHaveBeenCalledWith('draft-1', jasmine.objectContaining({ subjectCodes: ['MATH'] }));
    expect(api.editDraft).toHaveBeenCalledWith('draft-2', jasmine.objectContaining({ subjectCodes: ['PHYSICS'] }));
    expect(api.publishDraftGroup).toHaveBeenCalledWith('S:school-a', '2026-2027', ['draft-1', 'draft-2']);
    expect(root.textContent).toContain('Đang đồng bộ dữ liệu gợi ý');
  });

  it('requires a second action before SUPER_ADMIN hard-deletes one draft', async () => {
    api.draftGroups.and.returnValue(of({ success: true, data: { items: [{ groupKey: 'S:school-a', schoolName: 'Trường A',
      schoolCode: 'school-a', location: 'Hà Nội', academicYear: '2026-2027', draftCount: 1, sourceDocumentCount: 1 }],
      hasNext: false, nextCursor: '' } }));
    api.drafts.and.returnValue(of({ success: true, data: { items: [{ id: 'draft-1', documentId: 'doc-1', documentVersionId: 'version-1', documentVersionNumber: 1,
      documentTitle: 'Phương án nhóm môn', documentFilename: 'groups.pdf', schoolName: 'Trường A', schoolCode: 'school-a',
      academicYear: '2026-2027', documentStatus: 'DRAFT_READY', groupCode: 'A01', groupName: 'Nhóm A01',
      subjectCodes: ['MATH', 'LITERATURE', 'PHYSICS', 'CHEMISTRY'], sourcePages: [2], status: 'DRAFT',
      confidence: 0.9, createdAt: '2026-10-14T00:00:00Z' }], hasNext: false, nextCursor: '' } }));
    api.deleteDraft.and.returnValue(of({ success: true, data: undefined }));
    fixture.componentInstance.loadDraftGroups();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.draft-group-toggle')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
    buttons().find((button) => button.textContent?.trim() === 'Xóa nháp')?.click();
    fixture.detectChanges();
    buttons().find((button) => button.textContent?.trim() === 'Xác nhận xóa nháp')?.click();

    expect(api.deleteDraft).toHaveBeenCalledWith('draft-1');
  });

  it('rejects an unsupported upload before submitting', () => {
    const file = new File(['bad'], 'groups.txt', { type: 'text/plain' });
    fixture.componentInstance.onFile({ target: { files: [file] } } as unknown as Event);
    expect(fixture.componentInstance.fileError()).toContain('Chỉ chấp nhận PDF');
  });
});
