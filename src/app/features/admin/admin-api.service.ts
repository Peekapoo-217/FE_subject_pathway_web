import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/auth/auth.models';

export interface CursorPage<T> { items: T[]; hasNext: boolean; nextCursor: string; }
export interface AdminDocument { id: string; title: string; academicYear: string; status: string; schoolName: string; filename: string; }
export interface SubjectGroupDraft { id: string; groupCode: string; groupName: string; subjectCodes: string[]; sourcePages: number[]; academicYear: string; schoolName: string; }
export interface AdminUser { id: string; username: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'; active: boolean; }
export interface AdminCombination { id: string; display: string; componentCount: number; active: boolean; }
export interface LlmConfiguration { id: string; purpose: string; endpoint: string; model: string; active: boolean; keyConfigured: boolean; }

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
  drafts(cursor?: string): Observable<ApiEnvelope<CursorPage<SubjectGroupDraft>>> {
    let params = new HttpParams().set('size', 20);
    if (cursor) params = params.set('cursor', cursor);
    return this.http.get<ApiEnvelope<CursorPage<SubjectGroupDraft>>>(`${this.base}/documents/drafts`, { params });
  }
  uploadDocument(file: File, title: string, academicYear: string, schoolCode: string, proposedSchoolName: string, proposedSchoolLocation: string): Observable<ApiEnvelope<AdminDocument>> {
    const form = new FormData();
    form.append('file', file); form.append('title', title); form.append('academicYear', academicYear);
    if (schoolCode) form.append('schoolCode', schoolCode);
    if (proposedSchoolName) form.append('proposedSchoolName', proposedSchoolName);
    if (proposedSchoolLocation) form.append('proposedSchoolLocation', proposedSchoolLocation);
    return this.http.post<ApiEnvelope<AdminDocument>>(`${this.base}/documents`, form);
  }
  requestDocumentDelete(id: string): Observable<ApiEnvelope<void>> { return this.http.delete<ApiEnvelope<void>>(`${this.base}/documents/${id}`); }
  updateDocument(id: string, title: string, academicYear: string): Observable<ApiEnvelope<void>> { return this.http.put<ApiEnvelope<void>>(`${this.base}/documents/${id}`, { title, academicYear }); }
  addDocumentVersion(id: string, file: File): Observable<ApiEnvelope<unknown>> { const form = new FormData(); form.append('file', file); return this.http.post<ApiEnvelope<unknown>>(`${this.base}/documents/${id}/versions`, form); }
  approveDocumentDelete(id: string): Observable<ApiEnvelope<void>> { return this.http.post<ApiEnvelope<void>>(`${this.base}/documents/${id}/approve-delete`, {}); }
  approveDraft(id: string): Observable<ApiEnvelope<void>> { return this.http.patch<ApiEnvelope<void>>(`${this.base}/documents/drafts/${id}/approve`, {}); }
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
