import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { getErrorMessage } from '../../core/http/error-message';
import {
  AdminApiService,
  AdminCombination,
  AdminDocument,
  AdminUser,
  LlmConfiguration,
  SubjectGroupDraft
} from './admin-api.service';

type AdminTab = 'documents' | 'users' | 'combinations' | 'llm';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly busy = signal(false);
  readonly uploadAttempted = signal(false);
  readonly documents = signal<AdminDocument[]>([]);
  readonly drafts = signal<SubjectGroupDraft[]>([]);
  readonly users = signal<AdminUser[]>([]);
  readonly combinations = signal<AdminCombination[]>([]);
  readonly llmConfigurations = signal<LlmConfiguration[]>([]);

  readonly loadingDocuments = signal(false);
  readonly loadingDrafts = signal(false);
  readonly loadingUsers = signal(false);
  readonly loadingCombinations = signal(false);
  readonly loadingLlm = signal(false);
  readonly documentsError = signal('');
  readonly draftsError = signal('');
  readonly usersError = signal('');
  readonly combinationsError = signal('');
  readonly llmError = signal('');

  readonly documentsHasNext = signal(false);
  readonly draftsHasNext = signal(false);
  readonly usersHasNext = signal(false);
  readonly combinationsHasNext = signal(false);
  readonly documentsCursor = signal('');
  readonly draftsCursor = signal('');
  readonly usersCursor = signal('');
  readonly combinationsCursor = signal('');
  readonly archiveConfirmationId = signal('');

  tab: AdminTab = 'documents';
  file: File | null = null;
  uploadTitle = '';
  academicYear = '';
  schoolCode = '';
  proposedSchoolName = '';
  proposedSchoolLocation = '';
  newUsername = '';
  newPassword = '';
  newRole: AdminUser['role'] = 'USER';
  combinationDisplay = '';
  combinationSubjects = '';
  llmPurpose = 'EXTRACTION';
  llmEndpoint = '';
  llmModel = '';
  llmKey = '';
  llmActive = true;

  editingDocument: AdminDocument | null = null;
  editTitle = '';
  editAcademicYear = '';
  rejectingDraftId = '';
  rejectNote = '';

  ngOnInit(): void {
    this.loadDocuments();
    this.loadDrafts();
  }

  selectTab(tab: AdminTab): void {
    this.tab = tab;
    if (tab === 'users') this.loadUsers();
    if (tab === 'combinations') this.loadCombinations();
    if (tab === 'llm') this.loadLlm();
  }

  onFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (this.file) this.uploadAttempted.set(false);
  }

  updateDraftSubjects(draft: SubjectGroupDraft, value: string): void {
    draft.subjectCodes = value.split(',').map((item) => item.trim());
  }

  upload(form: NgForm): void {
    this.uploadAttempted.set(true);
    form.control.markAllAsTouched();
    if (form.invalid || !this.file) return;

    this.run(
      this.api.uploadDocument(
        this.file,
        this.uploadTitle,
        this.academicYear,
        this.schoolCode,
        this.proposedSchoolName,
        this.proposedSchoolLocation
      ),
      'Đã tải PDF và tạo job trích xuất.',
      () => {
        this.file = null;
        this.uploadAttempted.set(false);
        form.resetForm();
        this.loadDocuments();
      }
    );
  }

  loadDocuments(cursor?: string): void {
    this.loadingDocuments.set(true);
    this.documentsError.set('');
    this.api.documents(undefined, cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingDocuments.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.documents.set(cursor ? [...this.documents(), ...data.items] : data.items);
        this.documentsHasNext.set(data.hasNext);
        this.documentsCursor.set(data.nextCursor);
      },
      error: (error: unknown) => this.documentsError.set(getErrorMessage(error, 'Không tải được danh sách tài liệu.'))
    });
  }

  loadDrafts(cursor?: string): void {
    this.loadingDrafts.set(true);
    this.draftsError.set('');
    this.api.drafts(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingDrafts.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.drafts.set(cursor ? [...this.drafts(), ...data.items] : data.items);
        this.draftsHasNext.set(data.hasNext);
        this.draftsCursor.set(data.nextCursor);
      },
      error: (error: unknown) => this.draftsError.set(getErrorMessage(error, 'Không tải được bản nháp.'))
    });
  }

  requestDelete(document: AdminDocument): void {
    this.run(this.api.requestDocumentDelete(document.id), 'Đã gửi yêu cầu xóa tài liệu.', () => this.loadDocuments());
  }

  editDocument(document: AdminDocument): void {
    this.editingDocument = document;
    this.editTitle = document.title;
    this.editAcademicYear = document.academicYear;
  }

  cancelEditDocument(): void {
    this.editingDocument = null;
  }

  saveDocumentEdit(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid || !this.editingDocument) return;

    const document = this.editingDocument;
    this.run(this.api.updateDocument(document.id, this.editTitle.trim(), this.editAcademicYear.trim()),
      'Đã cập nhật tài liệu.', () => {
        this.editingDocument = null;
        this.loadDocuments();
      });
  }

  uploadVersion(document: AdminDocument, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.run(this.api.addDocumentVersion(document.id, file), 'Đã lưu phiên bản mới và tạo job trích xuất.', () => this.loadDocuments());
    (event.target as HTMLInputElement).value = '';
  }

  approveDelete(document: AdminDocument): void {
    this.run(this.api.approveDocumentDelete(document.id), 'Đã duyệt xóa mềm tài liệu.', () => this.loadDocuments());
  }

  download(document: AdminDocument): void {
    this.api.downloadUrl(document.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => window.open(data, '_blank', 'noopener'),
      error: (error: unknown) => this.setError(error, 'Không lấy được liên kết tải PDF.')
    });
  }

  approveDraft(draft: SubjectGroupDraft): void {
    this.run(this.api.editDraft(draft.id, draft), 'Đã lưu chỉnh sửa.', () =>
      this.run(this.api.approveDraft(draft.id), 'Đã công bố nhóm môn.', () => {
        this.loadDrafts();
        this.loadDocuments();
      })
    );
  }

  submitDraft(draft: SubjectGroupDraft): void {
    this.run(this.api.editDraft(draft.id, draft), 'Đã lưu chỉnh sửa.', () =>
      this.run(this.api.submitDraft(draft.id), 'Đã gửi SUPER_ADMIN duyệt.', () => this.loadDrafts())
    );
  }

  startRejectDraft(draft: SubjectGroupDraft): void {
    this.rejectingDraftId = draft.id;
    this.rejectNote = '';
  }

  cancelRejectDraft(): void {
    this.rejectingDraftId = '';
    this.rejectNote = '';
  }

  rejectDraft(draft: SubjectGroupDraft): void {
    this.run(this.api.rejectDraft(draft.id, this.rejectNote.trim()), 'Đã từ chối bản nháp.', () => {
      this.cancelRejectDraft();
      this.loadDrafts();
    });
  }

  loadUsers(cursor?: string): void {
    this.loadingUsers.set(true);
    this.usersError.set('');
    this.api.users(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingUsers.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.users.set(cursor ? [...this.users(), ...data.items] : data.items);
        this.usersHasNext.set(data.hasNext);
        this.usersCursor.set(data.nextCursor);
      },
      error: (error: unknown) => this.usersError.set(getErrorMessage(error, 'Không tải được tài khoản.'))
    });
  }

  createUser(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid) return;
    this.run(this.api.createUser(this.newUsername.trim(), this.newPassword, this.newRole), 'Đã tạo tài khoản.', () => {
      this.newUsername = '';
      this.newPassword = '';
      this.loadUsers();
      form.resetForm({ newRole: this.newRole });
    });
  }

  saveUser(user: AdminUser): void {
    this.run(this.api.updateUser(user), 'Đã cập nhật tài khoản và thu hồi refresh token cũ.', () => this.loadUsers());
  }

  loadCombinations(cursor?: string): void {
    this.loadingCombinations.set(true);
    this.combinationsError.set('');
    this.api.combinations(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingCombinations.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.combinations.set(cursor ? [...this.combinations(), ...data.items] : data.items);
        this.combinationsHasNext.set(data.hasNext);
        this.combinationsCursor.set(data.nextCursor);
      },
      error: (error: unknown) => this.combinationsError.set(getErrorMessage(error, 'Không tải được tổ hợp.'))
    });
  }

  createCombination(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid) return;
    const codes = this.combinationSubjects.split(',').map((value) => value.trim()).filter(Boolean);
    this.run(this.api.createCombination(this.combinationDisplay.trim(), codes), 'Đã tạo tổ hợp.', () => {
      this.combinationDisplay = '';
      this.combinationSubjects = '';
      form.resetForm();
      this.loadCombinations();
    });
  }

  saveCombination(item: AdminCombination): void {
    this.run(this.api.updateCombination(item.id, item.display.trim()), 'Đã cập nhật tên hiển thị.', () => this.loadCombinations());
  }

  archiveCombination(item: AdminCombination): void {
    if (this.archiveConfirmationId() !== item.id) {
      this.archiveConfirmationId.set(item.id);
      return;
    }
    this.run(this.api.archiveCombination(item.id), 'Đã lưu trữ tổ hợp; liên kết tuyển sinh được giữ lại.', () => {
      this.archiveConfirmationId.set('');
      this.loadCombinations();
    });
  }

  cancelArchiveCombination(): void {
    this.archiveConfirmationId.set('');
  }

  loadLlm(): void {
    this.loadingLlm.set(true);
    this.llmError.set('');
    this.api.llmConfigurations().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingLlm.set(false))
    ).subscribe({
      next: ({ data }) => this.llmConfigurations.set(data),
      error: (error: unknown) => this.llmError.set(getErrorMessage(error, 'Không tải được cấu hình AI.'))
    });
  }

  saveLlm(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid) return;
    this.run(this.api.saveLlmConfiguration({
      purpose: this.llmPurpose,
      endpoint: this.llmEndpoint.trim(),
      model: this.llmModel.trim(),
      apiKey: this.llmKey,
      active: this.llmActive
    }), 'Đã lưu cấu hình AI được mã hóa.', () => {
      this.llmKey = '';
      form.resetForm({ purpose: this.llmPurpose, endpoint: this.llmEndpoint, model: this.llmModel, active: this.llmActive });
      this.loadLlm();
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      UPLOADED: 'Đã tải lên', PROCESSING: 'Đang xử lý', DRAFT_READY: 'Đã trích xuất',
      NEEDS_REVIEW: 'Cần kiểm tra', PUBLISHED: 'Đã công bố', REJECTED: 'Đã từ chối',
      DELETE_REQUESTED: 'Chờ duyệt xóa', DELETED: 'Đã xóa', FAILED: 'Xử lý thất bại'
    };
    return labels[status] ?? status;
  }

  statusClass(status: string): string {
    if (status === 'PUBLISHED') return 'status-badge--success';
    if (status === 'PROCESSING' || status === 'DRAFT_READY') return 'status-badge--info';
    if (status === 'NEEDS_REVIEW' || status === 'DELETE_REQUESTED') return 'status-badge--warning';
    if (status === 'FAILED' || status === 'REJECTED') return 'status-badge--danger';
    return 'status-badge--muted';
  }

  purposeLabel(purpose: string): string {
    const labels: Record<string, string> = {
      EXTRACTION: 'Trích xuất tài liệu', INTENT: 'Nhận diện yêu cầu', CHAT: 'Trò chuyện'
    };
    return labels[purpose] ?? purpose;
  }

  private run<T>(request: import('rxjs').Observable<T>, success: string, after?: () => void): void {
    this.busy.set(true);
    this.message.set('');
    request.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: () => {
        this.messageIsError.set(false);
        this.message.set(success);
        after?.();
      },
      error: (error: unknown) => this.setError(error, 'Thao tác thất bại. Hãy thử lại.')
    });
  }

  private setError(error: unknown, fallback: string): void {
    this.messageIsError.set(true);
    this.message.set(getErrorMessage(error, fallback));
  }
}
