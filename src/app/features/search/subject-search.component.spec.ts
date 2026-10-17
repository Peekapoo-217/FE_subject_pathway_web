import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import {
  AdmissionService,
  ApiResponse,
  SubjectGroupDto,
  SubjectSearchResponse
} from './admission.service';
import { SubjectSearchComponent } from './subject-search.component';
import { ChatPanelComponent } from '../chat/components/chat-panel/chat-panel.component';

@Component({ selector: 'app-chat-panel', standalone: true, template: '' })
class ChatPanelStubComponent {}

describe('SubjectSearchComponent group search', () => {
  let fixture: ComponentFixture<SubjectSearchComponent>;
  let service: jasmine.SpyObj<AdmissionService>;

  const groups: SubjectGroupDto[] = [
    {
      academicYear: '2026-2027',
      groupCode: 'G1',
      groupName: 'Nhóm 1',
      subjects: [
        { code: 'PHYSICS', name: 'Vật lí' },
        { code: 'CHEMISTRY', name: 'Hóa học' },
        { code: 'BIOLOGY', name: 'Sinh học' },
        { code: 'INFORMATICS', name: 'Tin học' }
      ]
    },
    {
      academicYear: '2026-2027',
      groupCode: 'G2',
      groupName: 'Nhóm 2',
      subjects: [
        { code: 'GEOGRAPHY', name: 'Địa lí' },
        { code: 'HISTORY', name: 'Lịch sử' },
        { code: 'ECONOMIC_LAW', name: 'GDKTPL' },
        { code: 'INFORMATICS', name: 'Tin học' }
      ]
    }
  ];

  function result(combinationId: string): ApiResponse<SubjectSearchResponse> {
    return {
      success: true,
      data: {
        totalCombinations: 1,
        possibleCombinations: [{
          combinationId,
          combinationDisplay: combinationId,
          componentCount: 3,
          labels: [{ code: combinationId, subjectDetails: 'Chi tiết môn' }]
        }],
        totalMajors: 0,
        totalUniversities: 0,
        universities: [],
        majors: []
      }
    };
  }

  async function chooseSchool(): Promise<void> {
    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Chọn trường THPT"]'
    ) as HTMLSelectElement;
    expect(select.querySelector('option[value="HS1"]')).not.toBeNull();
    select.value = 'HS1';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.getAcademicYears).toHaveBeenCalledWith('HS1');
    expect(service.getSubjectGroupsBySchool).toHaveBeenCalledWith('HS1', '2026-2027');
  }

  function chooseGroup(index: number): void {
    const buttons = fixture.nativeElement.querySelectorAll(
      'button.group-card'
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    buttons[index].click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj<AdmissionService>('AdmissionService', [
      'getHighSchools',
      'getSubjectClassifications',
      'getAcademicYears',
      'getSubjectGroupsBySchool',
      'searchBySubjects',
      'extractErrorMessage'
    ]);
    service.getHighSchools.and.returnValue(of({
      success: true, data: [{ code: 'HS1', name: 'THPT 1' }]
    }));
    service.getSubjectClassifications.and.returnValue(of({
      success: true, data: { mandatorySubjects: [], electiveSubjects: [] }
    }));
    service.getAcademicYears.and.returnValue(of({
      success: true, data: ['2026-2027']
    }));
    service.getSubjectGroupsBySchool.and.returnValue(of({
      success: true, data: groups
    }));
    service.extractErrorMessage.and.returnValue('Lỗi truy vấn');

    TestBed.configureTestingModule({
      imports: [SubjectSearchComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AdmissionService, useValue: service }
      ]
    });
    TestBed.overrideComponent(SubjectSearchComponent, {
      remove: { imports: [ChatPanelComponent] },
      add: { imports: [ChatPanelStubComponent] }
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(SubjectSearchComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('queries and renders combinations for the selected school group', async () => {
    service.searchBySubjects.and.returnValue(of(result('A00')));
    await chooseSchool();

    chooseGroup(0);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getSubjectGroupsBySchool).toHaveBeenCalledWith('HS1', '2026-2027');
    expect(service.searchBySubjects).toHaveBeenCalledOnceWith({
      subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'INFORMATICS'],
      schoolCode: 'HS1', academicYear: '2026-2027', groupCode: 'G1'
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('.combo-card__name')?.textContent)
      .toContain('A00');
  });

  it('ignores a late result from the previously selected group', async () => {
    const first = new Subject<ApiResponse<SubjectSearchResponse>>();
    const second = new Subject<ApiResponse<SubjectSearchResponse>>();
    service.searchBySubjects.and.returnValues(first, second);
    await chooseSchool();

    chooseGroup(0);
    chooseGroup(1);
    second.next(result('D01'));
    await Promise.resolve();
    fixture.detectChanges();
    first.next(result('A00'));
    await Promise.resolve();
    fixture.detectChanges();

    expect(service.searchBySubjects).toHaveBeenCalledTimes(2);
    expect(service.searchBySubjects.calls.mostRecent().args[0].subjectCodes)
      .toEqual(['GEOGRAPHY', 'HISTORY', 'ECONOMIC_LAW', 'INFORMATICS']);
    expect((fixture.nativeElement as HTMLElement).querySelector('.combo-card__name')?.textContent)
      .toContain('D01');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('A00 —');
  });

  async function chooseYear(year: string): Promise<void> {
    const select = fixture.nativeElement.querySelector('select[aria-label="Năm học áp dụng"]') as HTMLSelectElement;
    expect(select.disabled).toBeFalse();
    select.value = year;
    select.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('allows choosing another year and sends that context in combination and major requests', async () => {
    service.getAcademicYears.and.returnValue(of({ success: true, data: ['2026-2027', '2025-2026'] }));
    service.searchBySubjects.and.returnValue(of({
      ...result('A00'), data: { ...result('A00').data, universities: [{ universityCode: 'DQN', universityName: 'Quy Nhơn' }] }
    }));
    await chooseSchool();
    chooseGroup(0);
    await fixture.whenStable();

    const olderGroups = groups.map((group) => ({ ...group, academicYear: '2025-2026' }));
    service.getSubjectGroupsBySchool.and.returnValue(of({ success: true, data: olderGroups }));
    await chooseYear('2025-2026');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.getSubjectGroupsBySchool).toHaveBeenCalledWith('HS1', '2025-2026');
    expect(fixture.nativeElement.querySelector('.combo-card__name')).toBeNull();

    chooseGroup(0);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.searchBySubjects.calls.mostRecent().args[0]).toEqual({
      subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'INFORMATICS'],
      schoolCode: 'HS1', academicYear: '2025-2026', groupCode: 'G1'
    });

    // The major request must preserve the same year instead of returning to the default.
    const majorsTab = Array.from(fixture.nativeElement.querySelectorAll('button[role="tab"]') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Ngành đào tạo'))!;
    majorsTab.click();
    fixture.detectChanges();
    const university = fixture.nativeElement.querySelector('.university-filter select') as HTMLSelectElement;
    expect(university).not.toBeNull();
    university.value = 'DQN';
    university.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(service.searchBySubjects.calls.mostRecent().args[0]).toEqual({
      subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'INFORMATICS'],
      schoolCode: 'HS1', academicYear: '2025-2026', groupCode: 'G1', universityCode: 'DQN'
    });
  });

  it('keeps the year control visible after a load failure and allows retry', async () => {
    service.getAcademicYears.and.returnValue(throwError(() => new Error('500')));
    const school = fixture.nativeElement.querySelector('select[aria-label="Chọn trường THPT"]') as HTMLSelectElement;
    school.value = 'HS1';
    school.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
    const year = fixture.nativeElement.querySelector('select[aria-label="Năm học áp dụng"]') as HTMLSelectElement;
    expect(year).not.toBeNull();
    expect(year.disabled).toBeTrue();
    expect(service.getSubjectGroupsBySchool).not.toHaveBeenCalled();

    service.getAcademicYears.and.returnValue(of({ success: true, data: ['2026-2027'] }));
    (fixture.nativeElement.querySelector('.engine-alert__retry-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(year.disabled).toBeFalse();
    expect(year.value).toBe('2026-2027');
    expect(service.getSubjectGroupsBySchool).toHaveBeenCalledWith('HS1', '2026-2027');
  });

  it('ignores late groups and search results from a previously selected year', async () => {
    service.getAcademicYears.and.returnValue(of({ success: true, data: ['2026-2027', '2025-2026'] }));
    const oldSearch = new Subject<ApiResponse<SubjectSearchResponse>>();
    service.searchBySubjects.and.returnValue(oldSearch);
    await chooseSchool();
    chooseGroup(0);

    const olderGroups = new Subject<ApiResponse<SubjectGroupDto[]>>();
    const newerGroups = new Subject<ApiResponse<SubjectGroupDto[]>>();
    service.getSubjectGroupsBySchool.and.returnValues(olderGroups, newerGroups);
    await chooseYear('2025-2026');
    await chooseYear('2026-2027');
    newerGroups.next({ success: true, data: groups });
    await Promise.resolve();
    fixture.detectChanges();
    olderGroups.next({ success: true, data: [{ ...groups[0], academicYear: '2025-2026', groupName: 'Old year group' }] });
    oldSearch.next(result('OLD_RESULT'));
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button.group-card').length).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('Old year group');
    expect(fixture.nativeElement.querySelector('.combo-card__name')).toBeNull();
  });

  it('shows a search error for the selected group', async () => {
    service.searchBySubjects.and.returnValue(
      throwError(() => new Error('offline'))
    );
    await chooseSchool();

    chooseGroup(0);
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector(
      '.group-analysis .engine-alert--error'
    )?.textContent).toContain('Lỗi truy vấn');
  });
});
