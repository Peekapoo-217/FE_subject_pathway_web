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
      subjectCodes: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'INFORMATICS']
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
