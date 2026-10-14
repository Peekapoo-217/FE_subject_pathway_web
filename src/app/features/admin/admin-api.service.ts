import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/auth/auth.models';

export interface CursorPage<T> { items: T[]; hasNext: boolean; nextCursor: string; }
export interface AdminDocument {
  id: string; title: string; academicYear: string; status: string; schoolName: string; filename: string;
  errorCode: string | null; graphSyncStatus: 'PENDING' | 'RUNNING' | 'RETRY' | 'SYNCED' | null;
  schoolCode?: string | null; proposedSchoolName?: string | null; proposedSchoolLocation?: string | null;
  proposedSchoolCode?: string | null; schoolLocation?: string | null;
}
export interface Province { code: string; name: string; }
export interface SchoolCodeSuggestion {
  suggestedCode: string; available: boolean; canReuseExistingSchool: boolean;
  existingSchoolCode: string | null; existingSchoolName: string | null; existingSchoolLocation: string | null;
}
export interface HighSchoolOption { code: string; name: string; }
export interface AdminDraftGroup { groupKey: string; schoolName: string; schoolCode: string | null; location: string | null; academicYear: string; draftCount: number; sourceDocumentCount: number; }
export interface AdminPublicationResult { batchId: string; publishedGroupCount: number; graphSyncStatus: 'PENDING' | 'RUNNING' | 'RETRY' | 'SYNCED'; }
export interface SubjectGroupDraft {
  id: string; documentId: string; documentVersionId: string; documentVersionNumber: number;
  documentTitle: string; documentFilename: string; schoolName: string;
  schoolCode: string | null; academicYear: string; documentStatus: string; groupCode: string; groupName: string;
  subjectCodes: string[]; sourcePages: number[]; status: 'DRAFT' | 'SUBMITTED'; confidence: number | null; createdAt: string;
}
export interface AdminUser { id: string; username: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'; active: boolean; }
export interface AdminCombination { id: string; display: string; componentCount: number; active: boolean; }
export interface LlmConfiguration {
  purpose: 'EXTRACTION' | 'CHAT'; endpoint: string; model: string; active: boolean;
  keyConfigured: boolean; keySource: 'ADMIN' | 'ENVIRONMENT'; environmentKeyConfigured: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.API_URL}/api/v1/admin`;

  documents(status?: string, cursor?: string): Observable<ApiEnvelope<CursorPage<AdminDocument>>> {
    let params = new HttpParams().set('size', 20);
    if (status) params = params.set('status', status);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiEnvelope<CursorPage<AdminDocument>>>(`${this.base}/documents`, { params });
  }
  draftGroups(cursor?: string): Observable<ApiEnvelope<CursorPage<AdminDraftGroup>>> {
    let params = new HttpParams().set('size', 20);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiEnvelope<CursorPage<AdminDraftGroup>>>(`${this.base}/documents/draft-groups`, { params });
  }
  drafts(groupKey: string, academicYear: string, cursor?: string): Observable<ApiEnvelope<CursorPage<SubjectGroupDraft>>> {
    let params = new HttpParams().set('size', 20).set('groupKey', groupKey).set('academicYear', academicYear);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiEnvelope<CursorPage<SubjectGroupDraft>>>(`${this.base}/documents/draft-groups/drafts`, { params });
  }
  uploadDocument(file: File, title: string, academicYear: string, schoolCode: string, proposedSchoolName: string,
      provinceCode: string, proposedSchoolCode: string): Observable<ApiEnvelope<AdminDocument>> {
    const form = new FormData();
    form.append('file', file); form.append('title', title); form.append('academicYear', academicYear);
    if (schoolCode) form.append('schoolCode', schoolCode);
    if (proposedSchoolName) form.append('proposedSchoolName', proposedSchoolName);
    if (provinceCode) form.append('provinceCode', provinceCode);
    if (proposedSchoolCode) form.append('proposedSchoolCode', proposedSchoolCode);
    return this.http.post<ApiEnvelope<AdminDocument>>(`${this.base}/documents`, form);
  }
  deleteDocument(id: string): Observable<ApiEnvelope<void>> { return this.http.delete<ApiEnvelope<void>>(`${this.base}/documents/${id}`); }
  updateDocument(id: string, title: string, academicYear: string,
      school?: { schoolCode?: string; proposedSchoolName?: string; provinceCode?: string; proposedSchoolCode?: string }): Observable<ApiEnvelope<void>> {
    return this.http.put<ApiEnvelope<void>>(`${this.base}/documents/${id}`, {
      title, academicYear, ...(school ?? {})
    });
  }
  provinces(): Observable<ApiEnvelope<Province[]>> {
    return this.http.get<ApiEnvelope<Province[]>>(`${this.base}/documents/provinces`);
  }
  suggestSchoolCode(schoolName: string, provinceCode: string, code?: string): Observable<ApiEnvelope<SchoolCodeSuggestion>> {
    let params = new HttpParams().set('schoolName', schoolName).set('provinceCode', provinceCode);
    if (code) params = params.set('code', code);
    return this.http.get<ApiEnvelope<SchoolCodeSuggestion>>(`${this.base}/documents/school-code-suggestion`, { params });
  }
  highSchools(): Observable<ApiEnvelope<HighSchoolOption[]>> {
    return this.http.get<ApiEnvelope<HighSchoolOption[]>>(`${environment.API_URL}/api/v1/high-schools`);
  }
  retryDocumentExtraction(id: string): Observable<ApiEnvelope<void>> { return this.http.post<ApiEnvelope<void>>(`${this.base}/documents/${id}/retry-extraction`, {}); }
  approveDocumentDelete(id: string): Observable<ApiEnvelope<void>> { return this.http.post<ApiEnvelope<void>>(`${this.base}/documents/${id}/approve-delete`, {}); }
  publishDraftGroup(groupKey: string, academicYear: string, reviewedDraftIds: string[]): Observable<ApiEnvelope<AdminPublicationResult>> {
    return this.http.post<ApiEnvelope<AdminPublicationResult>>(`${this.base}/documents/draft-groups/publish`, {
      groupKey, academicYear, reviewedDraftIds
    });
  }
  deleteDraft(id: string): Observable<ApiEnvelope<void>> { return this.http.delete<ApiEnvelope<void>>(`${this.base}/documents/drafts/${id}`); }
  submitDraft(id: string): Observable<ApiEnvelope<void>> { return this.http.post<ApiEnvelope<void>>(`${this.base}/documents/drafts/${id}/submit`, {}); }
  rejectDraft(id: string, note: string): Observable<ApiEnvelope<void>> { return this.http.patch<ApiEnvelope<void>>(`${this.base}/documents/drafts/${id}/reject`, null, { params: { note } }); }
  editDraft(id: string, draft: Pick<SubjectGroupDraft, 'groupCode' | 'groupName' | 'subjectCodes'>): Observable<ApiEnvelope<void>> {
    return this.http.put<ApiEnvelope<void>>(`${this.base}/documents/drafts/${id}`, draft, { params: { groupCode: draft.groupCode, groupName: draft.groupName, subjectCodes: JSON.stringify(draft.subjectCodes) } });
  }
  downloadUrl(id: string): Observable<ApiEnvelope<string>> { return this.http.get<ApiEnvelope<string>>(`${this.base}/documents/${id}/download-url`); }

  users(cursor?: string): Observable<ApiEnvelope<CursorPage<AdminUser>>> {
    let params = new HttpParams().set('size', 20); if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiEnvelope<CursorPage<AdminUser>>>(`${this.base}/users`, { params });
  }
  createUser(username: string, password: string, role: AdminUser['role']): Observable<ApiEnvelope<AdminUser>> {
    return this.http.post<ApiEnvelope<AdminUser>>(`${this.base}/users`, { username, password, role });
  }
  updateUser(user: AdminUser): Observable<ApiEnvelope<void>> { return this.http.put<ApiEnvelope<void>>(`${this.base}/users/${user.id}`, { role: user.role, active: user.active }); }

  combinations(cursor?: string): Observable<ApiEnvelope<CursorPage<AdminCombination>>> {
    let params = new HttpParams().set('size', 20); if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiEnvelope<CursorPage<AdminCombination>>>(`${this.base}/combinations`, { params });
  }
  createCombination(display: string, subjectCodes: string[]): Observable<ApiEnvelope<AdminCombination>> {
    return this.http.post<ApiEnvelope<AdminCombination>>(`${this.base}/combinations`, { display, subjectCodes });
  }
  updateCombination(id: string, display: string): Observable<ApiEnvelope<void>> { return this.http.put<ApiEnvelope<void>>(`${this.base}/combinations/${encodeURIComponent(id)}`, { display }); }
  archiveCombination(id: string): Observable<ApiEnvelope<void>> { return this.http.delete<ApiEnvelope<void>>(`${this.base}/combinations/${encodeURIComponent(id)}`); }

  llmConfigurations(): Observable<ApiEnvelope<LlmConfiguration[]>> { return this.http.get<ApiEnvelope<LlmConfiguration[]>>(`${this.base}/llm-configurations`); }
  saveLlmConfiguration(value: { purpose: string; endpoint: string; model: string; apiKey: string; active: boolean }): Observable<ApiEnvelope<void>> {
    return this.http.post<ApiEnvelope<void>>(`${this.base}/llm-configurations`, value);
  }
}
