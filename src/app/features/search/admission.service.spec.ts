import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { AdmissionService } from './admission.service';

describe('AdmissionService searchBySubjects', () => {
  let service: AdmissionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AdmissionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts selected subject codes to the admission search endpoint', () => {
    const request = {
      subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'INFORMATICS']
    };
    service.searchBySubjects(request).subscribe();

    const call = http.expectOne(
      (item) => item.url.endsWith('/api/v1/admissions/search-by-subjects')
    );
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush({ success: true, data: {
      totalCombinations: 0, possibleCombinations: [],
      totalMajors: 0, totalUniversities: 0, universities: [], majors: []
    } });
  });
});
