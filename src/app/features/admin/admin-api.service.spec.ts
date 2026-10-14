import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService document workflow', () => {
  let api: AdminApiService;
  let http: HttpTestingController;
  const base = `${environment.API_URL}/api/v1/admin/documents`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    api = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('routes the role-specific document delete action through DELETE', () => {
    api.deleteDocument('doc-1').subscribe();

    const request = http.expectOne(`${base}/doc-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, data: null });
  });

  it('loads school/year summaries through the dedicated cursor endpoint', () => {
    api.draftGroups('next-groups').subscribe();

    const request = http.expectOne((candidate) => candidate.url === `${base}/draft-groups`
      && candidate.params.get('size') === '20'
      && candidate.params.get('cursor') === 'next-groups');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { items: [], hasNext: false, nextCursor: '' } });
  });

  it('loads drafts for one group with its keyset cursor', () => {
    api.drafts('S:SCHOOL', '2026-2027', 'next-drafts').subscribe();

    const request = http.expectOne((candidate) => candidate.url === `${base}/draft-groups/drafts`
      && candidate.params.get('groupKey') === 'S:SCHOOL'
      && candidate.params.get('academicYear') === '2026-2027'
      && candidate.params.get('cursor') === 'next-drafts');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { items: [], hasNext: false, nextCursor: '' } });
  });

  it('hard-deletes an individual draft without calling the document delete endpoint', () => {
    api.deleteDraft('draft-1').subscribe();

    const request = http.expectOne(`${base}/drafts/draft-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, data: null });
  });

  it('publishes the reviewed set for one school and academic year in one request', () => {
    api.publishDraftGroup('S:SCHOOL', '2026-2027', ['draft-1', 'draft-2']).subscribe();

    const request = http.expectOne(`${base}/draft-groups/publish`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      groupKey: 'S:SCHOOL', academicYear: '2026-2027', reviewedDraftIds: ['draft-1', 'draft-2']
    });
    request.flush({ success: true, data: {
      batchId: 'batch-1', publishedGroupCount: 2, graphSyncStatus: 'PENDING'
    } });
  });

  it('uploads the selected year, province and normalized school code for a new school', () => {
    api.uploadDocument(new File(['pdf'], 'groups.pdf', { type: 'application/pdf' }),
      'Nhóm môn', '2026', '', 'Trường THPT Tôn Đức Thắng', '66', 'TĐT').subscribe();

    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.has('proposedSchoolName')).toBeTrue();
    expect(request.request.body.get('academicYear')).toBe('2026');
    expect(request.request.body.get('provinceCode')).toBe('66');
    expect(request.request.body.get('proposedSchoolCode')).toBe('TĐT');
    request.flush({ success: true, data: {
      id: 'doc-1', title: 'Nhóm môn', academicYear: '2026', status: 'UPLOADED', schoolName: 'Trường mới',
      filename: 'groups.pdf', errorCode: null, graphSyncStatus: null
    } });
  });

  it('loads provinces and requests a code suggestion using the selected province', () => {
    api.provinces().subscribe();
    const provinces = http.expectOne(`${base}/provinces`);
    expect(provinces.request.method).toBe('GET');
    provinces.flush({ success: true, data: [{ code: '66', name: 'Tỉnh Đắk Lắk' }] });

    api.suggestSchoolCode('Trường THPT Tôn Đức Thắng', '66').subscribe();
    const suggestion = http.expectOne((candidate) => candidate.url === `${base}/school-code-suggestion`
      && candidate.params.get('schoolName') === 'Trường THPT Tôn Đức Thắng'
      && candidate.params.get('provinceCode') === '66');
    expect(suggestion.request.method).toBe('GET');
    suggestion.flush({ success: true, data: {
      suggestedCode: 'TĐT', available: true, canReuseExistingSchool: false,
      existingSchoolCode: null, existingSchoolName: null, existingSchoolLocation: null
    } });
  });
});
