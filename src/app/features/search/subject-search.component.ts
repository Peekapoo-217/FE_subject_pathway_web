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
import { firstValueFrom } from 'rxjs';

import {
  AdmissionService,
  HighSchoolDto,
  SubjectDto,
  SubjectGroupDto,
  SubjectGroupRecommendationsResponse,
  SubjectSearchResponse
} from './admission.service';

/**
 * Controller của tính năng Tra cứu tổ hợp xét tuyển kết hợp ScrollSpy TOC.
 * Luồng 3 bước: Chọn Trường THPT → Chọn Nhóm môn → Tự động tra cứu.
 * Component chỉ quản lý UI state (Signals); mọi logic API nằm ở AdmissionService.
 */
import { ChatPanelComponent } from '../chat/components/chat-panel/chat-panel.component';

@Component({
  selector: 'app-subject-search',
  standalone: true,
  imports: [ChatPanelComponent],
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
    { id: 'ai-advisor', title: 'Trợ Lý AI Tuyển Sinh' },
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
  protected readonly academicYears = signal<readonly string[]>([]);
  protected readonly selectedAcademicYear = signal('');

  /** Bước 2 — nhóm môn của trường đang chọn. */
  protected readonly subjectGroups = signal<readonly SubjectGroupDto[]>([]);
  protected readonly showGroupComparison = false;
  protected readonly groupFilter = signal('');
  protected readonly comparedGroupCodes = signal<readonly string[]>([]);
  protected readonly filteredSubjectGroups = computed(() => {
    const query = this.groupFilter().trim().toLocaleLowerCase();
    if (!query) return this.subjectGroups();
    return this.subjectGroups().filter((group) =>
      `${group.groupCode} ${group.groupName} ${group.subjects.map((subject) => subject.name).join(' ')}`
        .toLocaleLowerCase().includes(query));
  });
  protected readonly comparedGroups = computed(() => {
    const selected = new Set(this.comparedGroupCodes());
    return this.subjectGroups().filter((group) => selected.has(group.groupCode)).slice(0, 3);
  });
  protected readonly isGroupsLoading = signal(false);
  protected readonly groupsError = signal<string | null>(null);
  protected readonly selectedGroup = signal<SubjectGroupDto | null>(null);
  protected readonly preferredSubjectCodes = signal<readonly string[]>([]);
  protected readonly confidenceBySubjectCode = signal<Record<string, number>>({});
  protected readonly recommendations = signal<SubjectGroupRecommendationsResponse | null>(null);
  protected readonly isRecommendationLoading = signal(false);
  protected readonly recommendationError = signal<string | null>(null);

  /** Bước 3 — kết quả tra cứu. */
  protected readonly searchResult = signal<SubjectSearchResponse | null>(null);
  protected readonly isSearchLoading = signal(false);
  protected readonly searchError = signal<string | null>(null);
  private searchRequestId = 0;

  /** Chống memory leak: mọi subscribe của search đều route qua Subject này. */

  /** True khi có ít nhất 1 trong 3 API đang chạy — điều khiển spinner toàn cục. */
  protected readonly isBusy = computed(
      () => this.isSchoolsLoading() || this.isGroupsLoading() || this.isSearchLoading() || this.isRecommendationLoading()
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

  /** Cờ tạm khóa ScrollSpy khi người dùng chủ động click TOC để cuộn trang mượt mà. */
  private isManualScrolling = false;
  private manualScrollTimer: ReturnType<typeof setTimeout> | null = null;

  /** Khởi tạo ScrollSpy theo dõi phân vùng đang hiển thị để highlight mục lục chính xác và mượt mà. */
  private initScrollSpy(): void {
    if (!this.isBrowser) {
      return;
    }

    let ticking = false;

    const onScrollOrResize = () => {
      if (this.isManualScrolling) {
        return;
      }
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.updateActiveSection();
          ticking = false;
        });
        ticking = true;
      }
    };

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', onScrollOrResize, { passive: true });
      window.addEventListener('resize', onScrollOrResize, { passive: true });
    });

    // Cập nhật phân vùng active ban đầu
    this.updateActiveSection();

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (this.manualScrollTimer) {
        clearTimeout(this.manualScrollTimer);
      }
    });
  }

  /** Tính toán phân vùng hiện tại dựa theo vị trí cuộn và toạ độ các section trong DOM. */
  private updateActiveSection(): void {
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // 1. Khi người dùng cuộn tới gần cuối trang -> highlight mục cuối cùng (faq)
    if (scrollY + viewportHeight >= docHeight - 80) {
      const lastId = this.tocMenus[this.tocMenus.length - 1].id;
      if (this.activeSection() !== lastId) {
        this.activeSection.set(lastId);
      }
      return;
    }

    // 2. Khi ở sát đỉnh trang -> highlight mục đầu tiên (hero)
    if (scrollY <= 80) {
      const firstId = this.tocMenus[0].id;
      if (this.activeSection() !== firstId) {
        this.activeSection.set(firstId);
      }
      return;
    }

    // 3. Quét các section theo thứ tự xuất hiện trong tocMenus
    // Scanline là 140px từ mép trên viewport (ngay dưới tầm nhìn mắt người và header)
    const scanOffset = 140;
    let targetId = this.tocMenus[0].id;

    for (const menu of this.tocMenus) {
      const el = document.getElementById(menu.id);
      if (!el) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.top <= scanOffset) {
        targetId = menu.id;
      }
    }

    if (this.activeSection() !== targetId) {
      this.activeSection.set(targetId);
    }
  }

  /** Cuộn mượt đến section tương ứng khi người dùng click vào TOC. */
  protected scrollTo(id: string): void {
    if (!this.isBrowser) {
      return;
    }
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    // Khóa tạm scroll spy để không bị giật highlight qua các section trung gian khi đang lướt
    this.isManualScrolling = true;
    this.activeSection.set(id);

    if (this.manualScrollTimer) {
      clearTimeout(this.manualScrollTimer);
    }
    this.manualScrollTimer = setTimeout(() => {
      this.isManualScrolling = false;
    }, 800);

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const yearsResponse = await firstValueFrom(this.admissionService.getAcademicYears(schoolCode));
      const years = yearsResponse?.data ?? [];
      this.academicYears.set(years);
      const selectedYear = years[0] ?? '';
      this.selectedAcademicYear.set(selectedYear);
      const response = selectedYear
        ? await firstValueFrom(this.admissionService.getSubjectGroupsBySchool(schoolCode, selectedYear))
        : await firstValueFrom(this.admissionService.getSubjectGroupsBySchool(schoolCode));
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
    this.groupFilter.set('');
    this.comparedGroupCodes.set([]);
    this.academicYears.set([]);
    this.selectedAcademicYear.set('');
    this.selectedGroup.set(null);
    this.searchResult.set(null);
    this.searchError.set(null);
    this.searchRequestId++;
    this.isSearchLoading.set(false);
    this.recommendations.set(null);
    this.recommendationError.set(null);
    this.preferredSubjectCodes.set([]);
    this.confidenceBySubjectCode.set({});
    this.groupsError.set(null);

    if (schoolCode === '') {
      this.isGroupsLoading.set(false);
      return;
    }

    void this.loadSubjectGroups(schoolCode);
  }

  protected async onAcademicYearChange(event: Event): Promise<void> {
    const year = (event.target as HTMLSelectElement).value;
    this.selectedAcademicYear.set(year);
    const schoolCode = this.selectedSchoolCode();
    this.selectedGroup.set(null);
    this.searchResult.set(null);
    this.searchError.set(null);
    this.searchRequestId++;
    this.isSearchLoading.set(false);
    this.recommendations.set(null);
    this.comparedGroupCodes.set([]);
    this.isGroupsLoading.set(true);
    try {
      const response = await firstValueFrom(this.admissionService.getSubjectGroupsBySchool(schoolCode, year));
      this.subjectGroups.set(response.data ?? []);
    } catch (error: unknown) {
      this.subjectGroups.set([]);
      this.groupsError.set(this.admissionService.extractErrorMessage(error));
    } finally {
      this.isGroupsLoading.set(false);
    }
  }

  protected togglePreferredSubject(code: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.preferredSubjectCodes.update((codes) => checked
      ? [...new Set([...codes, code])]
      : codes.filter((item) => item !== code));
  }

  protected onGroupFilter(event: Event): void {
    this.groupFilter.set((event.target as HTMLInputElement).value);
  }

  protected toggleCompare(group: SubjectGroupDto, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.comparedGroupCodes.update((codes) => {
      if (checked && codes.length >= 3) return codes;
      return checked ? [...codes, group.groupCode] : codes.filter((code) => code !== group.groupCode);
    });
  }

  protected onConfidenceChange(code: string, event: Event): void {
    const rawValue = (event.target as HTMLSelectElement).value;
    this.confidenceBySubjectCode.update((scores) => {
      if (!rawValue) {
        const { [code]: _removed, ...remaining } = scores;
        return remaining;
      }
      return { ...scores, [code]: Number(rawValue) };
    });
  }

  protected async requestRecommendations(): Promise<void> {
    const schoolCode = this.selectedSchoolCode();
    if (!schoolCode || (!this.preferredSubjectCodes().length && !Object.keys(this.confidenceBySubjectCode()).length)) {
      this.recommendationError.set('Hãy chọn ít nhất một môn yêu thích hoặc tự đánh giá mức độ tự tin.');
      return;
    }
    this.isRecommendationLoading.set(true);
    this.recommendationError.set(null);
    try {
      const response = await firstValueFrom(this.admissionService.recommendSubjectGroups(schoolCode, {
        academicYear: this.selectedAcademicYear(),
        preferredSubjectCodes: [...this.preferredSubjectCodes()],
        confidenceBySubjectCode: this.confidenceBySubjectCode(),
        topK: 3
      }));
      this.recommendations.set(response.data);
    } catch (error: unknown) {
      this.recommendationError.set(this.admissionService.extractErrorMessage(error));
    } finally {
      this.isRecommendationLoading.set(false);
    }
  }

  /** Chọn nhóm để xem chi tiết; gợi ý Top 3 chỉ chạy khi học sinh bấm nút riêng. */
  protected onGroupSelect(group: SubjectGroupDto): void {
    this.selectedGroup.set(group);
    this.recommendations.set(null);
    void this.fetchSearchResult(group);
  }

  private async fetchSearchResult(group: SubjectGroupDto): Promise<void> {
    const requestId = ++this.searchRequestId;
    this.isSearchLoading.set(true);
    this.searchResult.set(null);
    this.searchError.set(null);
    try {
      const response = await firstValueFrom(this.admissionService.searchBySubjects({
        subjectCodes: group.subjects.map((subject) => subject.code)
      }));
      if (requestId === this.searchRequestId) this.searchResult.set(response.data);
    } catch (error: unknown) {
      if (requestId === this.searchRequestId) {
        this.searchError.set(this.admissionService.extractErrorMessage(error));
      }
    } finally {
      if (requestId === this.searchRequestId) this.isSearchLoading.set(false);
    }
  }

  /** Format tên đầy đủ của nhóm môn (dùng cho aria-label). */
  protected trackGroup(index: number): number {
    return index;
  }
}
