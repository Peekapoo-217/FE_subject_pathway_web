import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  NgZone,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, tap } from 'rxjs';

import {
  AdmissionService,
  HighSchoolDto,
  SubjectDto,
  SubjectGroupDto,
  SubjectSearchResponse
} from './admission.service';

/**
 * Controller của tính năng Tra cứu tổ hợp xét tuyển kết hợp ScrollSpy TOC.
 * Luồng 3 bước: Chọn Trường THPT → Chọn Nhóm môn → Tự động tra cứu.
 * Component chỉ quản lý UI state (Signals); mọi logic API nằm ở AdmissionService.
 */
@Component({
  selector: 'app-subject-search',
  standalone: true,
  templateUrl: './subject-search.component.html',
  styleUrl: './subject-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubjectSearchComponent implements OnInit {
  private readonly admissionService = inject(AdmissionService);

  /** Cho phép gọi API và DOM API chỉ ở browser (SSR/prerender an toàn). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  /** ID của phân vùng đang xem (ScrollSpy TOC). */
  protected readonly activeSection = signal<string>('hero');

  /** Danh sách mục lục trượt dọc (Table of Contents - TOC). */
  protected readonly tocMenus = [
    { id: 'hero', title: 'Định Hướng Lớp 10' },
    { id: 'subject-info', title: 'Phân Loại Môn Học' },
    { id: 'search-tool', title: 'Công Cụ Trắc Nghiệm' },
    { id: 'results', title: 'Các Khối Thi Lớn' },
    { id: 'faq', title: 'Giải Đáp Thường Gặp' }
  ];

  /** Phân loại môn học GDPT 2018 (môn bắt buộc & môn tự chọn). */
  protected readonly mandatorySubjects = signal<SubjectDto[]>([]);
  protected readonly electiveSubjects = signal<SubjectDto[]>([]);
  protected readonly isSubjectsLoading = signal<boolean>(true);
  protected readonly subjectsError = signal<string | null>(null);

  /** Bước 1 — danh sách trường THPT. */
  protected readonly schools = signal<readonly HighSchoolDto[]>([]);
  protected readonly isSchoolsLoading = signal(true);
  protected readonly schoolsError = signal<string | null>(null);
  protected readonly selectedSchoolCode = signal<string>('');

  /** Bước 2 — nhóm môn của trường đang chọn. */
  protected readonly subjectGroups = signal<readonly SubjectGroupDto[]>([]);
  protected readonly isGroupsLoading = signal(false);
  protected readonly groupsError = signal<string | null>(null);
  protected readonly selectedGroup = signal<SubjectGroupDto | null>(null);

  /** Bước 3 — kết quả tra cứu. */
  protected readonly searchResult = signal<SubjectSearchResponse | null>(null);
  protected readonly isSearchLoading = signal(false);
  protected readonly searchError = signal<string | null>(null);

  /** Chống memory leak: mọi subscribe của search đều route qua Subject này. */
  private readonly searchSubject = new Subject<SubjectGroupDto>();
  /** Được init trong ngOnInit (SSR-safe), tự động hủy khi component destroyed. */
  private searchSubscription!: Subscription;

  /** True khi có ít nhất 1 trong 3 API đang chạy — điều khiển spinner toàn cục. */
  protected readonly isBusy = computed(
    () => this.isSchoolsLoading() || this.isGroupsLoading() || this.isSearchLoading()
  );

  constructor() {
    afterNextRender(() => {
      this.initScrollSpy();
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return; // SSR/prerender: chỉ render shell tĩnh, API chạy ở browser.
    }

    this.ngZone.runOutsideAngular(() => {
      this.searchSubscription = this.searchSubject
        .pipe(
          tap((group) => this.fetchSearchResult(group)),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe();
    });

    void this.loadHighSchools();
    this.loadSubjectClassifications();
  }

  /** Tải danh sách phân loại môn học GDPT 2018 (môn bắt buộc & môn tự chọn). */
  protected loadSubjectClassifications(): void {
    this.isSubjectsLoading.set(true);
    this.subjectsError.set(null);

    this.admissionService
      .getSubjectClassifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const data = response?.data;
          this.mandatorySubjects.set(data?.mandatorySubjects ?? []);
          this.electiveSubjects.set(data?.electiveSubjects ?? []);
          this.isSubjectsLoading.set(false);
        },
        error: (error: unknown) => {
          this.mandatorySubjects.set([]);
          this.electiveSubjects.set([]);
          this.subjectsError.set(this.admissionService.extractErrorMessage(error));
          this.isSubjectsLoading.set(false);
        }
      });
  }

  /** Khởi tạo IntersectionObserver quan sát các phân vùng .scroll-section (ScrollSpy). */
  private initScrollSpy(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            (entry.intersectionRatio >= 0.5 || entry.boundingClientRect.top <= window.innerHeight * 0.4)
          ) {
            this.activeSection.set(entry.target.id);
          }
        }
      },
      {
        root: null,
        threshold: [0.3, 0.5]
      }
    );

    const sections = document.querySelectorAll('.scroll-section');
    sections.forEach((section) => observer.observe(section));

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
    });
  }

  /** Cuộn mượt đến section tương ứng khi người dùng click vào TOC. */
  protected scrollTo(id: string): void {
    if (!this.isBrowser) {
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeSection.set(id);
    }
  }

  /** Bước 1: tải danh sách trường THPT khi mở trang. */
  protected async loadHighSchools(): Promise<void> {
    this.isSchoolsLoading.set(true);
    this.schoolsError.set(null);

    try {
      const response = await this.admissionService.getHighSchools().toPromise();
      const body = response?.data ?? [];
      this.schools.set(body);
    } catch (error) {
      this.schools.set([]);
      this.schoolsError.set(this.admissionService.extractErrorMessage(error));
    } finally {
      this.isSchoolsLoading.set(false);
    }
  }

  /** Bước 2: tải nhóm môn học theo mã trường THPT đã chọn. */
  private async loadSubjectGroups(schoolCode: string): Promise<void> {
    this.isGroupsLoading.set(true);
    this.groupsError.set(null);

    try {
      const response = await this.admissionService.getSubjectGroupsBySchool(schoolCode).toPromise();
      this.subjectGroups.set(response?.data ?? []);
    } catch (error) {
      this.subjectGroups.set([]);
      this.groupsError.set(this.admissionService.extractErrorMessage(error));
    } finally {
      this.isGroupsLoading.set(false);
    }
  }

  /** Bước 2: đổi trường → tải nhóm môn của trường đó, reset kết quả cũ. */
  protected onSchoolChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const schoolCode = selectElement.value;
    this.selectedSchoolCode.set(schoolCode);

    this.subjectGroups.set([]);
    this.selectedGroup.set(null);
    this.searchResult.set(null);
    this.searchError.set(null);
    this.groupsError.set(null);

    if (schoolCode === '') {
      this.isGroupsLoading.set(false);
      return;
    }

    void this.loadSubjectGroups(schoolCode);
  }

  /** Bước 3: chọn nhóm môn → trích mã môn → tự động tra cứu. */
  protected onGroupSelect(group: SubjectGroupDto): void {
    if (this.isSearchLoading()) {
      return;
    }
    this.selectedGroup.set(group);
    this.searchResult.set(null);
    this.searchError.set(null);
    this.searchSubject.next(group);
  }

  /** Gọi API tra cứu với danh sách subject_code của nhóm. */
  private fetchSearchResult(group: SubjectGroupDto): void {
    const subjectCodes = group.subjects.map((subject) => subject.code);

    this.isSearchLoading.set(true);
    this.admissionService
      .searchBySubjects({ subjectCodes })
      .subscribe({
        next: (response) => {
          this.searchResult.set(response.data);
          this.isSearchLoading.set(false);
        },
        error: (error: unknown) => {
          this.searchError.set(this.admissionService.extractErrorMessage(error));
          this.isSearchLoading.set(false);
        }
      });
  }

  /** Format tên đầy đủ của nhóm môn (dùng cho aria-label). */
  protected trackGroup(index: number): number {
    return index;
  }
}
