import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { exhaustMap, finalize, forkJoin, Subscription, switchMap, takeWhile, timer } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { getErrorMessage } from '../../core/http/error-message';
import { AcademicYearPickerComponent } from './academic-year-picker.component';
import {
  AdminApiService,
  AdminCombination,
  AdminDeletedHighSchool,
  AdminDocument,
  AdminDraftGroup,
  AdminHighSchool,
  AdminUser,
  HighSchoolOption,
  Province,
  SchoolCodeSuggestion,
  SubjectGroupDraft
} from './admin-api.service';

type AdminTab = 'documents' | 'schools' | 'users' | 'combinations';

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
  readonly deletedDocuments = signal<AdminDocument[]>([]);
  readonly draftGroups = signal<DraftGroupState[]>([]);
  readonly users = signal<AdminUser[]>([]);
  readonly combinations = signal<AdminCombination[]>([]);
  readonly managedSchools = signal<AdminHighSchool[]>([]);
  readonly deletedManagedSchools = signal<AdminDeletedHighSchool[]>([]);
  readonly schools = signal<HighSchoolOption[]>([]);
  readonly provinces = signal<Province[]>([]);
  readonly schoolCodeSuggestion = signal<SchoolCodeSuggestion | null>(null);
  readonly editSchoolCodeSuggestion = signal<SchoolCodeSuggestion | null>(null);
  readonly loadingProvinces = signal(false);
  readonly provincesError = signal('');
  readonly schoolsError = signal('');
  readonly schoolCodeSuggestionError = signal('');
  readonly editSchoolCodeSuggestionError = signal('');

  readonly loadingDocuments = signal(false);
  readonly loadingDeletedDocuments = signal(false);
  readonly loadingDraftGroups = signal(false);
  readonly loadingUsers = signal(false);
  readonly loadingCombinations = signal(false);
  readonly loadingManagedSchools = signal(false);
  readonly loadingDeletedManagedSchools = signal(false);
  readonly documentsError = signal('');
  readonly deletedDocumentsError = signal('');
  readonly draftGroupsError = signal('');
  readonly usersError = signal('');
  readonly combinationsError = signal('');
  readonly managedSchoolsError = signal('');
  readonly deletedManagedSchoolsError = signal('');

  readonly documentsHasNext = signal(false);
  readonly draftGroupsHasNext = signal(false);
  readonly usersHasNext = signal(false);
  readonly combinationsHasNext = signal(false);
  readonly managedSchoolsHasNext = signal(false);
  readonly deletedManagedSchoolsHasNext = signal(false);
  readonly documentsCursor = signal('');
  readonly deletedDocumentsCursor = signal('');
  readonly deletedDocumentsHasNext = signal(false);
  readonly draftGroupsCursor = signal('');
  readonly usersCursor = signal('');
  readonly combinationsCursor = signal('');
  readonly managedSchoolsCursor = signal('');
  readonly deletedManagedSchoolsCursor = signal('');
  readonly archiveConfirmationId = signal('');
  readonly draftDeleteConfirmationId = signal('');
  readonly deleteSchoolConfirmationCode = signal('');

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
  managedSchoolCode = '';
  managedSchoolName = '';
  managedSchoolProvinceCode = '';
  editingManagedSchoolCode = '';
  private lastSuggestedManagedSchoolCode = '';
  private readonly graphSyncPolls = new Map<string, Subscription>();
  private readonly pendingGraphSyncMessages = new Map<string, string>();
  private readonly schoolGraphSyncPolls = new Map<string, Subscription>();
  private readonly pendingSchoolGraphSyncMessages = new Map<string, string>();

  editingDocument: AdminDocument | null = null;
  editTitle = '';
  editAcademicYear = '';
  rejectingDraftId = '';
  rejectNote = '';

  ngOnInit(): void {
    this.loadDocuments();
    if (this.auth.isSuperAdmin) this.loadDeletedDocuments();
    this.loadDraftGroups();
    this.loadSchoolOptions();
  }

  selectTab(tab: AdminTab): void {
    this.tab = tab;
    if (tab === 'schools') {
      this.loadManagedSchools();
      if (this.auth.isSuperAdmin) this.loadDeletedManagedSchools();
    }
    if (tab === 'users') this.loadUsers();
    if (tab === 'combinations') this.loadCombinations();
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
        this.resumePendingGraphSync(data.items);
      },
      error: (error: unknown) => this.documentsError.set(getErrorMessage(error, 'Không tải được danh sách tài liệu.'))
    });
  }

  loadDeletedDocuments(cursor?: string): void {
    if (!this.auth.isSuperAdmin) return;
    this.loadingDeletedDocuments.set(true);
    this.deletedDocumentsError.set('');
    this.api.deletedDocuments(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingDeletedDocuments.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.deletedDocuments.set(cursor ? [...this.deletedDocuments(), ...data.items] : data.items);
        this.deletedDocumentsHasNext.set(data.hasNext);
        this.deletedDocumentsCursor.set(data.nextCursor);
        this.resumePendingGraphSync(data.items);
      },
      error: (error: unknown) => this.deletedDocumentsError.set(getErrorMessage(error, 'KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch tÃ i liá»‡u Ä‘Ã£ xÃ³a.'))
    });
  }

  isGraphSyncPending(document: AdminDocument): boolean {
    return document.graphSyncStatus === 'PENDING' || document.graphSyncStatus === 'RUNNING'
      || document.graphSyncStatus === 'RETRY';
  }

  unpublishDeletedDocument(document: AdminDocument): void {
    this.busy.set(true);
    this.api.unpublishDocument(document.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.messageIsError.set(false);
        this.message.set(data.graphSyncStatus === 'SYNCED'
          ? 'Đã ngừng công bố các nhóm môn của tài liệu.'
          : 'Đã ghi nhận yêu cầu. Neo4j đang đồng bộ; theo dõi log terminal của worker.');
        this.loadDeletedDocuments();
        if (data.graphSyncJobId && data.graphSyncStatus !== 'SYNCED') {
          this.startGraphSyncPolling(data.documentId, data.graphSyncJobId, 'Đã ngừng công bố các nhóm môn của tài liệu.');
        }
      },
      error: (error: unknown) => this.setError(error, 'Không thể ngừng công bố tài liệu.')
    });
  }

  restoreDeletedDocument(document: AdminDocument): void {
    this.busy.set(true);
    this.api.restoreDocument(document.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.messageIsError.set(false);
        this.message.set(data.graphSyncStatus === 'SYNCED'
          ? 'Đã khôi phục tài liệu và công bố lại các nhóm môn.'
          : 'Đã khôi phục PostgreSQL/MinIO. Neo4j đang đồng bộ; theo dõi log terminal của worker.');
        this.loadDocuments();
        this.loadDeletedDocuments();
        this.loadDraftGroups();
        if (data.graphSyncJobId && data.graphSyncStatus !== 'SYNCED') {
          this.startGraphSyncPolling(data.documentId, data.graphSyncJobId, 'Đã khôi phục tài liệu và công bố lại các nhóm môn.');
        }
      },
      error: (error: unknown) => this.setError(error, 'Không thể khôi phục tài liệu.')
    });
  }

  private resumePendingGraphSync(documents: AdminDocument[]): void {
    if (this.busy()) return;
    documents.filter((document) => this.isGraphSyncPending(document) && document.graphSyncJobId
      && !this.graphSyncPolls.has(document.graphSyncJobId))
      .forEach((document) => this.startGraphSyncPolling(document.id, document.graphSyncJobId!));
  }

  private startGraphSyncPolling(documentId: string, jobId: string, completedMessage?: string): void {
    if (completedMessage) this.pendingGraphSyncMessages.set(jobId, completedMessage);
    if (this.graphSyncPolls.has(jobId)) return;
    const poll = timer(0, 2500).pipe(
      exhaustMap(() => this.api.documentGraphSyncStatus(documentId, jobId)),
      takeWhile(({ data }) => data.graphSyncStatus !== 'SYNCED', true),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.graphSyncPolls.delete(jobId))
    ).subscribe({
      next: ({ data }) => {
        const update = (items: AdminDocument[]) => items.map((document) => document.id === documentId
          ? {
            ...document, graphPublicationStatus: data.graphPublicationStatus,
            graphSyncStatus: data.graphSyncStatus, graphSyncJobId: data.graphSyncJobId
          } : document);
        this.documents.update(update);
        this.deletedDocuments.update(update);
        if (data.graphSyncStatus === 'SYNCED') {
          const successMessage = this.pendingGraphSyncMessages.get(jobId);
          if (successMessage) {
            this.messageIsError.set(false);
            this.message.set(successMessage);
          }
          this.pendingGraphSyncMessages.delete(jobId);
          this.loadDocuments();
          if (this.auth.isSuperAdmin) this.loadDeletedDocuments();
          this.loadDraftGroups();
        }
      },
      error: () => {
        if (this.pendingGraphSyncMessages.has(jobId)) {
          this.messageIsError.set(true);
          this.message.set('Chưa xác nhận được trạng thái Neo4j; worker vẫn có thể thử lại. Xem log terminal rồi làm mới danh sách.');
        }
      }
    });
    this.graphSyncPolls.set(jobId, poll);
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
    const message = this.auth.isSuperAdmin
      ? 'Đã xóa mềm tài liệu. Các nhóm môn vẫn được công bố.'
      : 'Đã gửi yêu cầu xóa tài liệu để SUPER_ADMIN duyệt.';
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
      STORAGE_OBJECT_MISSING: 'Không tìm thấy tệp trong kho lưu trữ đang sử dụng. Tệp có thể vẫn nằm trong kho lưu trữ đã dùng trước đó.',
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

  loadManagedSchools(cursor?: string): void {
    this.loadingManagedSchools.set(true);
    this.managedSchoolsError.set('');
    this.api.adminHighSchools(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingManagedSchools.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.managedSchools.set(cursor ? [...this.managedSchools(), ...data.items] : data.items);
        this.managedSchoolsHasNext.set(data.hasNext);
        this.managedSchoolsCursor.set(data.nextCursor);
        if (this.auth.isSuperAdmin) this.resumePendingSchoolGraphSync(data.items);
      },
      error: (error: unknown) => this.managedSchoolsError.set(getErrorMessage(error, 'Không tải được danh sách trường THPT.'))
    });
  }

  loadDeletedManagedSchools(cursor?: string): void {
    if (!this.auth.isSuperAdmin) return;
    this.loadingDeletedManagedSchools.set(true);
    this.deletedManagedSchoolsError.set('');
    this.api.adminDeletedHighSchools(cursor).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingDeletedManagedSchools.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.deletedManagedSchools.set(cursor ? [...this.deletedManagedSchools(), ...data.items] : data.items);
        this.deletedManagedSchoolsHasNext.set(data.hasNext);
        this.deletedManagedSchoolsCursor.set(data.nextCursor);
        this.resumePendingSchoolGraphSync(data.items);
      },
      error: (error: unknown) => this.deletedManagedSchoolsError.set(
        getErrorMessage(error, 'Không tải được danh sách trường đã xóa mềm.'))
    });
  }

  isSchoolGraphSyncPending(school: Pick<AdminHighSchool, 'graphSyncStatus'>): boolean {
    return school.graphSyncStatus === 'PENDING' || school.graphSyncStatus === 'RUNNING'
      || school.graphSyncStatus === 'RETRY';
  }

  restoreManagedSchool(school: AdminDeletedHighSchool): void {
    if (!this.auth.isSuperAdmin) return;
    this.busy.set(true);
    this.api.restoreHighSchool(school.code).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))
    ).subscribe({
      next: ({ data }) => {
        this.messageIsError.set(false);
        this.message.set(data.graphSyncStatus === 'SYNCED'
          ? 'Đã khôi phục trường và nhóm môn. Tài liệu liên quan vẫn cần khôi phục riêng.'
          : 'Đã khôi phục trường và nhóm môn; graph đang đồng bộ. Tài liệu liên quan vẫn cần khôi phục riêng.');
        this.loadManagedSchools();
        this.loadDeletedManagedSchools();
        this.loadSchoolOptions();
        if (data.graphSyncJobId && data.graphSyncStatus !== 'SYNCED') {
          this.startSchoolGraphSyncPolling(data.schoolCode, data.graphSyncJobId,
            'Đã khôi phục trường và nhóm môn. Tài liệu liên quan vẫn cần khôi phục riêng.');
        }
      },
      error: (error: unknown) => this.setError(error, 'Không khôi phục được trường THPT.')
    });
  }

  private resumePendingSchoolGraphSync(schools: Array<AdminHighSchool | AdminDeletedHighSchool>): void {
    schools.filter((school) => this.isSchoolGraphSyncPending(school) && school.graphSyncJobId
      && !this.schoolGraphSyncPolls.has(school.graphSyncJobId))
      .forEach((school) => this.startSchoolGraphSyncPolling(school.code, school.graphSyncJobId!));
  }

  private startSchoolGraphSyncPolling(code: string, jobId: string, completedMessage?: string): void {
    if (completedMessage) this.pendingSchoolGraphSyncMessages.set(jobId, completedMessage);
    if (this.schoolGraphSyncPolls.has(jobId)) return;
    const poll = timer(0, 2500).pipe(
      exhaustMap(() => this.api.highSchoolGraphSyncStatus(code, jobId)),
      takeWhile(({ data }) => data.graphSyncStatus !== 'SYNCED', true),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.schoolGraphSyncPolls.delete(jobId))
    ).subscribe({
      next: ({ data }) => {
        const update = (school: AdminHighSchool): AdminHighSchool => school.code === code
          ? { ...school, graphSyncStatus: data.graphSyncStatus, graphSyncJobId: data.graphSyncJobId } : school;
        this.managedSchools.update((schools) => schools.map(update));
        this.deletedManagedSchools.update((schools) => schools.map((school) => school.code === code
          ? { ...school, graphSyncStatus: data.graphSyncStatus, graphSyncJobId: data.graphSyncJobId } : school));
        if (data.graphSyncStatus === 'SYNCED') {
          const successMessage = this.pendingSchoolGraphSyncMessages.get(jobId);
          if (successMessage) {
            this.messageIsError.set(false);
            this.message.set(successMessage);
          }
          this.pendingSchoolGraphSyncMessages.delete(jobId);
          this.loadManagedSchools();
          this.loadDeletedManagedSchools();
        }
      },
      error: () => {
        if (this.pendingSchoolGraphSyncMessages.has(jobId)) {
          this.messageIsError.set(true);
          this.message.set('Chưa xác nhận được trạng thái Neo4j; worker có thể tiếp tục thử lại. Hãy xem log terminal rồi làm mới danh sách.');
        }
      }
    });
    this.schoolGraphSyncPolls.set(jobId, poll);
  }

  onManagedSchoolNameChanged(): void {
    if (this.editingManagedSchoolCode || !this.managedSchoolName.trim() || !this.managedSchoolProvinceCode) return;
    this.api.suggestSchoolCode(this.managedSchoolName.trim(), this.managedSchoolProvinceCode).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ data }) => {
        if (!this.managedSchoolCode || this.managedSchoolCode === this.lastSuggestedManagedSchoolCode) {
          this.managedSchoolCode = data.suggestedCode;
        }
        this.lastSuggestedManagedSchoolCode = data.suggestedCode;
      },
      error: () => { this.lastSuggestedManagedSchoolCode = ''; }
    });
  }

  editManagedSchool(school: AdminHighSchool): void {
    this.editingManagedSchoolCode = school.code;
    this.managedSchoolCode = school.code;
    this.managedSchoolName = school.name;
    this.managedSchoolProvinceCode = this.provinces().find((province) => province.name === school.location)?.code ?? '';
    this.lastSuggestedManagedSchoolCode = '';
  }

  cancelManagedSchoolEdit(): void {
    this.editingManagedSchoolCode = '';
    this.managedSchoolCode = '';
    this.managedSchoolName = '';
    this.managedSchoolProvinceCode = '';
    this.lastSuggestedManagedSchoolCode = '';
  }

  saveManagedSchool(form: NgForm): void {
    form.control.markAllAsTouched();
    if (form.invalid) return;
    const value = {
      code: this.managedSchoolCode.trim() || undefined,
      name: this.managedSchoolName.trim(),
      provinceCode: this.managedSchoolProvinceCode
    };
    const editingCode = this.editingManagedSchoolCode;
    const request = editingCode
      ? this.api.updateHighSchool(editingCode, value)
      : this.api.createHighSchool(value);
    this.run(request, editingCode ? 'Đã cập nhật trường THPT.' : 'Đã tạo trường THPT.', () => {
      this.cancelManagedSchoolEdit();
      form.resetForm();
      this.loadManagedSchools();
      if (this.auth.isSuperAdmin) this.loadDeletedManagedSchools();
      this.loadSchoolOptions();
    });
  }

  deleteManagedSchool(school: AdminHighSchool): void {
    if (this.deleteSchoolConfirmationCode() !== school.code) {
      this.deleteSchoolConfirmationCode.set(school.code);
      return;
    }
    this.run(this.api.deleteHighSchool(school.code), 'Đã xóa mềm trường THPT, nhóm môn và bản nháp liên quan.', () => {
      this.deleteSchoolConfirmationCode.set('');
      this.loadManagedSchools();
      if (this.auth.isSuperAdmin) this.loadDeletedManagedSchools();
      this.loadSchoolOptions();
      this.loadDraftGroups();
      this.loadDocuments();
    });
  }

  cancelDeleteManagedSchool(): void {
    this.deleteSchoolConfirmationCode.set('');
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
