import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { finalize, forkJoin, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { getErrorMessage } from '../../core/http/error-message';
import { AcademicYearPickerComponent } from './academic-year-picker.component';
import {
  AdminApiService,
  AdminDraftGroup,
  AdminCombination,
  AdminDocument,
  AdminUser,
  HighSchoolOption,
  LlmConfiguration,
  Province,
  SchoolCodeSuggestion,
  SubjectGroupDraft
} from './admin-api.service';

type AdminTab = 'documents' | 'users' | 'combinations' | 'llm';

interface DraftGroupState extends AdminDraftGroup {
  expanded: boolean;
  loaded: boolean;
  loading: boolean;
  error: string;
  drafts: SubjectGroupDraft[];
  sources: DraftSourceDocument[];
  hasNext: boolean;
  cursor: string;
  reviewConfirmed: boolean;
}

interface DraftSourceDocument {
  documentVersionId: string;
  versionNumber: number;
  title: string;
  filename: string;
  status: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, AcademicYearPickerComponent],
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
  readonly fileError = signal('');
  readonly documents = signal<AdminDocument[]>([]);
  readonly draftGroups = signal<DraftGroupState[]>([]);
  readonly users = signal<AdminUser[]>([]);
  readonly combinations = signal<AdminCombination[]>([]);
  readonly llmConfigurations = signal<LlmConfiguration[]>([]);
  readonly schools = signal<HighSchoolOption[]>([]);
  readonly provinces = signal<Province[]>([]);
  readonly schoolCodeSuggestion = signal<SchoolCodeSuggestion | null>(null);
  readonly editSchoolCodeSuggestion = signal<SchoolCodeSuggestion | null>(null);
  readonly loadingProvinces = signal(false);
  readonly provincesError = signal('');
  readonly schoolsError = signal('');
  readonly schoolCodeSuggestionError = signal('');
  readonly editSchoolCodeSuggestionError = signal('');
  readonly editingLlmPurpose = signal<LlmConfiguration['purpose'] | null>(null);

  readonly loadingDocuments = signal(false);
  readonly loadingDraftGroups = signal(false);
  readonly loadingUsers = signal(false);
  readonly loadingCombinations = signal(false);
  readonly loadingLlm = signal(false);
  readonly documentsError = signal('');
  readonly draftGroupsError = signal('');
  readonly usersError = signal('');
  readonly combinationsError = signal('');
  readonly llmError = signal('');

  readonly documentsHasNext = signal(false);
  readonly draftGroupsHasNext = signal(false);
  readonly usersHasNext = signal(false);
  readonly combinationsHasNext = signal(false);
  readonly documentsCursor = signal('');
  readonly draftGroupsCursor = signal('');
  readonly usersCursor = signal('');
  readonly combinationsCursor = signal('');
  readonly archiveConfirmationId = signal('');
  readonly draftDeleteConfirmationId = signal('');

  tab: AdminTab = 'documents';
  file: File | null = null;
  uploadTitle = '';
  academicYear = '';
  schoolCode = '';
  schoolType: 'existing' | 'new' = 'existing';
  proposedSchoolName = '';
  provinceCode = '';
  proposedSchoolCode = '';
  editProposedSchoolName = '';
  editProvinceCode = '';
  editProposedSchoolCode = '';
  private schoolCodeManuallyEdited = false;
  private editSchoolCodeManuallyEdited = false;
  private schoolCodeSuggestionKey = '';
  private editSchoolCodeSuggestionKey = '';
  editExistingSchoolCode = '';
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
    this.loadDraftGroups();
    this.loadSchoolOptions();
  }

  selectTab(tab: AdminTab): void {
    this.tab = tab;
    if (tab === 'users') this.loadUsers();
    if (tab === 'combinations') this.loadCombinations();
    if (tab === 'llm') this.loadLlm();
  }

  onFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set(this.file ? this.validateFile(this.file) : '');
    if (this.file && !this.fileError()) this.uploadAttempted.set(false);
  }

  updateDraftSubjects(draft: SubjectGroupDraft, value: string): void {
    draft.subjectCodes = value.split(',').map((item) => item.trim());
  }

  upload(form: NgForm): void {
    this.uploadAttempted.set(true);
    form.control.markAllAsTouched();
    if (form.invalid || !this.file || this.fileError()) return;
    if (this.schoolType === 'new' && !this.isSchoolCodeSuggestionCurrent()) {
      this.setError(new Error('Hãy nhập tên trường và tỉnh/thành phố, sau đó kiểm tra mã trường.'), 'Vui lòng kiểm tra mã trường.');
      return;
    }

    this.run(
      this.api.uploadDocument(
        this.file,
        this.uploadTitle,
        this.academicYear,
        this.schoolType === 'existing' ? this.schoolCode : '',
        this.schoolType === 'new' ? this.proposedSchoolName : '',
        this.schoolType === 'new' ? this.provinceCode : '',
        this.schoolType === 'new' ? this.proposedSchoolCode : ''
      ),
      'Đã tải tài liệu và tạo job trích xuất.',
      () => {
        this.file = null;
        this.fileError.set('');
        this.uploadAttempted.set(false);
        form.resetForm();
        this.schoolType = 'existing';
        this.schoolCode = '';
        this.proposedSchoolName = '';
        this.provinceCode = '';
        this.proposedSchoolCode = '';
        this.schoolCodeSuggestion.set(null);
        this.schoolCodeSuggestionKey = '';
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

  loadDraftGroups(cursor?: string): void {
    this.loadingDraftGroups.set(true);
    this.draftGroupsError.set('');
    this.api.draftGroups(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingDraftGroups.set(false))
    ).subscribe({
      next: ({ data }) => {
        const groups = data.items.map((group): DraftGroupState => ({
        ...group, expanded: false, loaded: false, loading: false, error: '', drafts: [], sources: [],
        hasNext: false, cursor: '', reviewConfirmed: false
        }));
        this.draftGroups.set(cursor ? [...this.draftGroups(), ...groups] : groups);
        this.draftGroupsHasNext.set(data.hasNext);
        this.draftGroupsCursor.set(data.nextCursor);
      },
      error: (error: unknown) => this.draftGroupsError.set(getErrorMessage(error, 'Không tải được danh sách nhóm bản nháp.'))
    });
  }

  toggleDraftGroup(group: DraftGroupState): void {
    this.draftGroups.update((groups) => groups.map((item) =>
      item.groupKey === group.groupKey && item.academicYear === group.academicYear
        ? { ...item, expanded: !item.expanded } : item));
    const current = this.findDraftGroup(group);
    if (current?.expanded && !current.loaded) this.loadGroupDrafts(current);
  }

  loadGroupDrafts(group: DraftGroupState, cursor?: string): void {
    this.updateDraftGroup(group, (current) => ({ ...current, loading: true, error: '', reviewConfirmed: false }));
    this.api.drafts(group.groupKey, group.academicYear, cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updateDraftGroup(group, (current) => ({ ...current, loading: false })))
    ).subscribe({
      next: ({ data }) => this.updateDraftGroup(group, (current) => {
        const drafts = cursor ? [...current.drafts, ...data.items] : data.items;
        return {
          ...current,
          loaded: true,
          drafts,
          sources: this.buildSourceDocuments(drafts),
          hasNext: data.hasNext,
          cursor: data.nextCursor,
          error: ''
        };
      }),
      error: (error: unknown) => this.updateDraftGroup(group, (current) => ({
        ...current, error: getErrorMessage(error, 'Không tải được bản nháp của trường này.')
      }))
    });
  }

  sourceDocuments(group: DraftGroupState): DraftSourceDocument[] {
    return group.sources;
  }

  private buildSourceDocuments(drafts: SubjectGroupDraft[]): DraftSourceDocument[] {
    const documents = new Map<string, DraftSourceDocument>();
    for (const draft of drafts) {
      if (!documents.has(draft.documentVersionId)) documents.set(draft.documentVersionId, {
        documentVersionId: draft.documentVersionId, versionNumber: draft.documentVersionNumber,
        title: draft.documentTitle, filename: draft.documentFilename,
        status: draft.documentStatus
      });
    }
    return Array.from(documents.values());
  }

  draftsForSource(group: DraftGroupState, documentVersionId: string): SubjectGroupDraft[] {
    return group.drafts.filter((draft) => draft.documentVersionId === documentVersionId);
  }

  isDraftLocked(draft: SubjectGroupDraft): boolean {
    return draft.documentStatus === 'DELETE_REQUESTED' || draft.documentStatus === 'DELETED';
  }

  allDraftsPublishable(group: DraftGroupState): boolean {
    return group.drafts.length > 0
      && group.drafts.every((draft) => draft.status === 'DRAFT' || draft.status === 'SUBMITTED');
  }

  canPublishDraftGroup(group: DraftGroupState): boolean {
    return this.auth.isSuperAdmin && !this.busy() && group.loaded && !group.loading && !group.hasNext
      && this.allDraftsPublishable(group) && group.reviewConfirmed && !group.drafts.some((draft) => this.isDraftLocked(draft));
  }

  resetGroupReview(group: DraftGroupState): void {
    group.reviewConfirmed = false;
  }

  private findDraftGroup(group: Pick<AdminDraftGroup, 'groupKey' | 'academicYear'>): DraftGroupState | undefined {
    return this.draftGroups().find((item) => item.groupKey === group.groupKey && item.academicYear === group.academicYear);
  }

  private updateDraftGroup(group: Pick<AdminDraftGroup, 'groupKey' | 'academicYear'>,
      update: (current: DraftGroupState) => DraftGroupState): void {
    this.draftGroups.update((groups) => groups.map((item) =>
      item.groupKey === group.groupKey && item.academicYear === group.academicYear ? update(item) : item));
  }

  requestDelete(document: AdminDocument): void {
    const message = this.auth.isSuperAdmin ? 'Đã xóa mềm tài liệu và các bản nháp chưa công bố.' : 'Đã gửi yêu cầu xóa tài liệu.';
    this.run(this.api.deleteDocument(document.id), message, () => {
      this.loadDocuments();
      this.loadDraftGroups();
    });
  }

  editDocument(document: AdminDocument): void {
    this.editingDocument = document;
    this.editTitle = document.title;
    this.editAcademicYear = document.academicYear.match(/^(?:19|20|21)\d{2}/)?.[0] ?? document.academicYear;
    this.editProposedSchoolName = document.proposedSchoolName ?? '';
    this.editProvinceCode = this.provinces().find((province) => province.name === document.proposedSchoolLocation)?.code ?? '';
    this.editProposedSchoolCode = document.proposedSchoolCode ?? '';
    this.editSchoolCodeManuallyEdited = false;
    this.editSchoolCodeSuggestionKey = '';
    this.editExistingSchoolCode = '';
    this.editSchoolCodeSuggestion.set(null);
    this.editSchoolCodeSuggestionError.set('');
  }

  cancelEditDocument(): void {
    this.editingDocument = null;
  }

  saveDocumentEdit(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid || !this.editingDocument) return;
    const proposedSchool = this.editingDocument.schoolCode == null
      ? {
        schoolCode: this.editExistingSchoolCode || undefined,
        proposedSchoolName: this.editProposedSchoolName.trim(),
        provinceCode: this.editProvinceCode,
        proposedSchoolCode: this.editProposedSchoolCode.trim()
      }
      : undefined;
    if (proposedSchool && !this.isSchoolCodeSuggestionCurrent(true)) {
      this.setError(new Error('Hãy kiểm tra lại mã trường.'), 'Vui lòng kiểm tra mã trường.');
      return;
    }

    const document = this.editingDocument;
    this.run(this.api.updateDocument(document.id, this.editTitle.trim(), this.editAcademicYear.trim(), proposedSchool),
      'Đã cập nhật tài liệu.', () => {
        this.editingDocument = null;
        this.loadDocuments();
      });
  }

  changeSchoolType(type: 'existing' | 'new'): void {
    this.schoolType = type;
    this.schoolCode = '';
    this.proposedSchoolName = '';
    this.provinceCode = '';
    this.proposedSchoolCode = '';
    this.schoolCodeSuggestion.set(null);
    this.schoolCodeSuggestionKey = '';
    this.schoolCodeManuallyEdited = false;
  }

  onProposedSchoolNameChanged(): void {
    this.proposedSchoolCode = '';
    this.schoolCodeManuallyEdited = false;
    this.schoolCodeSuggestion.set(null);
    this.schoolCodeSuggestionKey = '';
  }

  onProvinceChanged(): void {
    this.proposedSchoolCode = '';
    this.schoolCodeManuallyEdited = false;
    this.schoolCodeSuggestion.set(null);
    this.schoolCodeSuggestionKey = '';
    this.loadSchoolCodeSuggestion();
  }

  onProposedSchoolCodeChanged(): void {
    this.schoolCodeManuallyEdited = true;
    this.schoolCodeSuggestion.set(null);
    this.schoolCodeSuggestionKey = '';
  }

  onEditSchoolNameChanged(): void {
    this.editProposedSchoolCode = '';
    this.editSchoolCodeManuallyEdited = false;
    this.editSchoolCodeSuggestionKey = '';
    this.editSchoolCodeSuggestion.set(null);
    this.editExistingSchoolCode = '';
    this.editSchoolCodeSuggestionError.set('');
  }

  onEditProvinceChanged(): void {
    this.editProposedSchoolCode = '';
    this.editSchoolCodeManuallyEdited = false;
    this.editSchoolCodeSuggestionKey = '';
    this.editSchoolCodeSuggestion.set(null);
    this.editExistingSchoolCode = '';
    this.loadSchoolCodeSuggestion(false, true);
  }

  onEditSchoolCodeChanged(): void {
    this.editSchoolCodeManuallyEdited = true;
    this.editSchoolCodeSuggestionKey = '';
    this.editSchoolCodeSuggestion.set(null);
    this.editExistingSchoolCode = '';
    this.editSchoolCodeSuggestionError.set('');
  }

  loadSchoolCodeSuggestion(checkCustomCode = false, editing = false): void {
    const schoolName = editing ? this.editProposedSchoolName.trim() : this.proposedSchoolName.trim();
    const provinceCode = editing ? this.editProvinceCode : this.provinceCode;
    if (!schoolName || !provinceCode) return;
    const manuallyEdited = editing ? this.editSchoolCodeManuallyEdited : this.schoolCodeManuallyEdited;
    const rawCode = editing ? this.editProposedSchoolCode.trim() : this.proposedSchoolCode.trim();
    const customCode = checkCustomCode && manuallyEdited ? rawCode : undefined;
    this.api.suggestSchoolCode(schoolName, provinceCode, customCode).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ data }) => {
        if (editing) {
          this.editSchoolCodeSuggestion.set(data);
          if (!manuallyEdited) this.editProposedSchoolCode = data.suggestedCode;
          this.editSchoolCodeSuggestionKey = this.codeSuggestionKey(schoolName, provinceCode,
            manuallyEdited ? rawCode : data.suggestedCode);
          this.editSchoolCodeSuggestionError.set('');
        } else {
          this.schoolCodeSuggestion.set(data);
          if (!manuallyEdited) this.proposedSchoolCode = data.suggestedCode;
          this.schoolCodeSuggestionKey = this.codeSuggestionKey(schoolName, provinceCode,
            manuallyEdited ? rawCode : data.suggestedCode);
          this.schoolCodeSuggestionError.set('');
        }
      },
      error: (error: unknown) => {
        const message = getErrorMessage(error, 'Không kiểm tra được mã trường.');
        if (editing) this.editSchoolCodeSuggestionError.set(message);
        else this.schoolCodeSuggestionError.set(message);
      }
    });
  }

  useSuggestedExistingSchool(): void {
    const code = this.schoolCodeSuggestion()?.existingSchoolCode;
    if (!code) return;
    this.changeSchoolType('existing');
    this.schoolCode = code;
  }

  useSuggestedExistingSchoolForEdit(): void {
    const code = this.editSchoolCodeSuggestion()?.existingSchoolCode;
    if (!code) return;
    this.editExistingSchoolCode = code;
    this.editSchoolCodeSuggestionKey = this.codeSuggestionKey(
      this.editProposedSchoolName, this.editProvinceCode, this.editProposedSchoolCode);
  }

  private loadSchoolOptions(): void {
    this.api.highSchools().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => this.schools.set(data),
      error: (error: unknown) => this.schoolsError.set(getErrorMessage(error, 'Không tải được danh sách trường THPT.'))
    });
    this.loadingProvinces.set(true);
    this.api.provinces().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingProvinces.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.provinces.set(data);
        if (this.editingDocument) {
          this.editProvinceCode = data.find((province) => province.name === this.editingDocument?.proposedSchoolLocation)?.code ?? '';
        }
      },
      error: (error: unknown) => this.provincesError.set(getErrorMessage(error, 'Không tải được danh sách tỉnh/thành phố.'))
    });
  }

  private codeSuggestionKey(name: string, provinceCode: string, code: string): string {
    return `${name.trim()}|${provinceCode}|${code.trim()}`;
  }

  private isSchoolCodeSuggestionCurrent(editing = false): boolean {
    const name = editing ? this.editProposedSchoolName : this.proposedSchoolName;
    const provinceCode = editing ? this.editProvinceCode : this.provinceCode;
    const code = editing ? this.editProposedSchoolCode : this.proposedSchoolCode;
    const key = editing ? this.editSchoolCodeSuggestionKey : this.schoolCodeSuggestionKey;
    const suggestion = this.schoolCodeSuggestion();
    const matches = key === this.codeSuggestionKey(name, provinceCode, code);
    if (editing && this.editExistingSchoolCode) return matches;
    return matches && (editing ? !!this.editSchoolCodeSuggestion()?.available : !!suggestion?.available);
  }

  retryExtraction(document: AdminDocument): void {
    this.run(this.api.retryDocumentExtraction(document.id), 'Đã xếp lại job trích xuất.', () => this.loadDocuments());
  }

  extractionError(code: string | null): string {
    const labels: Record<string, string> = {
      MODEL_IMAGE_UNSUPPORTED: 'Model trích xuất chưa đọc được ảnh. Hãy cấu hình model hỗ trợ ảnh rồi thử lại.',
      LLM_CONFIG_MISSING: 'Thiếu cấu hình AI cho trích xuất.',
      LLM_CONFIG_ERROR: 'Không lấy được cấu hình AI.',
      LLM_TIMEOUT: 'Model xử lý quá thời gian.',
      OCR_EMPTY: 'Không đọc được văn bản. Kiểm tra ảnh hoặc PDF có rõ và đúng chiều không.',
      OCR_ENGINE_ERROR: 'Bộ OCR không xử lý được tài liệu này.',
      OCR_TIMEOUT: 'Đọc văn bản mất quá nhiều thời gian. Hãy thử lại.',
      NO_VALID_GROUPS: 'Không tìm thấy nhóm môn hợp lệ trong tài liệu.',
      IMAGE_INVALID: 'Ảnh không đọc được.',
      IMAGE_PIXEL_LIMIT: 'Ảnh vượt giới hạn 20 megapixel.',
      IMAGE_LIMIT: 'Ảnh vượt giới hạn 10 MB.',
      INVALID_LLM_SCHEMA: 'Model trả về dữ liệu không hợp lệ.'
    };
    return labels[code ?? ''] ?? 'Trích xuất thất bại. Kiểm tra tài liệu hoặc cấu hình AI rồi thử lại.';
  }

  private validateFile(file: File): string {
    const limits: Record<string, number> = {
      'application/pdf': 50 * 1024 * 1024,
      'image/png': 10 * 1024 * 1024,
      'image/jpeg': 10 * 1024 * 1024,
      'image/webp': 10 * 1024 * 1024
    };
    if (!(file.type in limits)) return 'Chỉ chấp nhận PDF, PNG, JPEG hoặc WebP.';
    if (!file.size || file.size > limits[file.type]) return 'Tệp rỗng hoặc vượt giới hạn dung lượng.';
    return '';
  }

  approveDelete(document: AdminDocument): void {
    this.run(this.api.approveDocumentDelete(document.id), 'Đã duyệt xóa mềm tài liệu và các bản nháp chưa công bố.', () => {
      this.loadDocuments();
      this.loadDraftGroups();
    });
  }

  hardDeleteDraft(draft: SubjectGroupDraft): void {
    if (this.draftDeleteConfirmationId() !== draft.id) {
      this.draftDeleteConfirmationId.set(draft.id);
      return;
    }
    this.run(this.api.deleteDraft(draft.id), 'Đã xóa bản nháp; tài liệu nguồn vẫn được giữ.', () => {
      this.draftDeleteConfirmationId.set('');
      this.loadDraftGroups();
    });
  }

  cancelHardDeleteDraft(): void {
    this.draftDeleteConfirmationId.set('');
  }

  download(document: AdminDocument): void {
    this.api.downloadUrl(document.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => window.open(data, '_blank', 'noopener'),
      error: (error: unknown) => this.setError(error, 'Không lấy được liên kết tải tài liệu.')
    });
  }

  publishDraftGroup(group: DraftGroupState): void {
    if (!this.canPublishDraftGroup(group)) return;
    this.busy.set(true);
    this.message.set('');
    const saveEdits = forkJoin(group.drafts.map((draft) => this.api.editDraft(draft.id, draft)));
    saveEdits.pipe(
      switchMap(() => this.api.publishDraftGroup(group.groupKey, group.academicYear,
        group.drafts.map((draft) => draft.id))),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.messageIsError.set(false);
        this.message.set(`Đã công bố ${data.publishedGroupCount} nhóm môn. Đang đồng bộ dữ liệu gợi ý.`);
        this.loadDraftGroups();
        this.loadDocuments();
      },
      error: (error: unknown) => this.setError(error, 'Không công bố được toàn bộ nhóm môn. Hãy tải lại danh sách để rà soát lại.')
    });
  }

  submitDraft(draft: SubjectGroupDraft): void {
    this.run(this.api.editDraft(draft.id, draft), 'Đã lưu chỉnh sửa.', () =>
      this.run(this.api.submitDraft(draft.id), 'Đã gửi SUPER_ADMIN duyệt.', () => this.loadDraftGroups())
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
      this.loadDraftGroups();
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

  configureLlm(item: LlmConfiguration): void {
    this.llmPurpose = item.purpose;
    this.llmEndpoint = item.endpoint;
    this.llmModel = item.model;
    this.llmKey = '';
    this.llmActive = item.active;
    this.editingLlmPurpose.set(item.purpose);
  }

  cancelLlmConfiguration(): void {
    this.editingLlmPurpose.set(null);
    this.llmKey = '';
  }

  saveLlm(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid || !this.editingLlmPurpose()) return;
    const usesEnvironmentKey = !this.llmKey.trim();
    this.run(this.api.saveLlmConfiguration({
      purpose: this.llmPurpose,
      endpoint: this.llmEndpoint.trim(),
      model: this.llmModel.trim(),
      apiKey: this.llmKey,
      active: this.llmActive
    }), usesEnvironmentKey
      ? 'Đã lưu cấu hình. API key sẽ được lấy từ biến môi trường.'
      : 'Đã lưu cấu hình và mã hóa API key.', () => {
      this.llmKey = '';
      this.editingLlmPurpose.set(null);
      form.resetForm({ purpose: this.llmPurpose, endpoint: this.llmEndpoint, model: this.llmModel, active: this.llmActive });
      this.loadLlm();
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Bản nháp', SUBMITTED: 'Chờ SUPER_ADMIN duyệt',
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

  graphSyncLabel(status: string): string {
    if (status === 'SYNCED') return 'Đã đồng bộ';
    if (status === 'RETRY') return 'Đang thử lại đồng bộ';
    if (status === 'RUNNING') return 'Đang đồng bộ';
    return 'Đang chờ đồng bộ';
  }

  purposeLabel(purpose: string): string {
    const labels: Record<string, string> = {
      EXTRACTION: 'Trích xuất tài liệu', CHAT: 'Trò chuyện'
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
