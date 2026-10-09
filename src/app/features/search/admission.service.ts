import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** Chuỗi mã môn học hợp lệ (khớp dữ liệu master của Backend). */
export type SubjectCode = string;

/** Mã tổ hợp xét tuyển (VD: A00, D01). */
export type CombinationCode = string;

/** Trường THPT phục vụ dropdown lựa chọn (Bước 1). */
export interface HighSchoolDto {
  code: string;
  name: string;
}

/** Môn học thành phần bên trong một nhóm môn (khớp JSON Backend). */
export interface SubjectDto {
  code: SubjectCode;
  name: string;
}

/** Nhóm môn học của một trường THPT (Bước 2). */
export interface SubjectGroupDto {
  academicYear: string;
  groupCode: string;
  groupName: string;
  subjects: SubjectDto[];
}

export interface SubjectGroupRecommendationRequest {
  academicYear: string;
  preferredSubjectCodes: string[];
  confidenceBySubjectCode: Record<string, number>;
  topK: number;
}

export interface SubjectGroupRecommendationDto extends SubjectGroupDto {
  score: number;
  matchedPreferredSubjects: SubjectDto[];
  lowConfidenceSubjects: SubjectDto[];
  explanations: string[];
}

export interface SubjectGroupRecommendationsResponse {
  schoolCode: string;
  academicYear: string;
  requestedTopK: number;
  eligibleGroupCount: number;
  recommendations: SubjectGroupRecommendationDto[];
}

/** Request body khi tra cứu tổ hợp xét tuyển theo danh sách môn (Bước 3). */
export interface SubjectSearchRequest {
  subjectCodes: SubjectCode[];
}

/** Tổ hợp xét tuyển trả về từ Backend (thông tin rút gọn). */
export interface CombinationDto {
  combinationId: CombinationCode;
  combinationDisplay: string;
  componentCount: number;
}

/** Kết quả thống kê tra cứu trả về từ Backend. */
export interface SubjectSearchResponse {
  totalCombinations: number;
  possibleCombinations: CombinationDto[];
  totalMajors: number;
  totalUniversities: number;
}

/** Phân loại môn học thành nhóm bắt buộc và tự chọn. */
export interface SubjectClassificationResponse {
  mandatorySubjects: SubjectDto[];
  electiveSubjects: SubjectDto[];
}

/** Envelope phản hồi chuẩn của Backend: { success, message?, data }. */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/** Lỗi nghiệp vụ chuẩn từ Backend (HTTP 4xx/5xx với body ApiResponse). */
interface ApiErrorBody {
  code?: number;
  message?: string;
}

/** Message thân thiện hiển thị khi request thất bại. */
const FRIENDLY_HTTP_ERROR = 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.';

/**
 * Service nghiệp vụ tra cứu tuyển sinh.
 * Chịu trách nhiệm duy nhất giao tiếp REST API Backend (SoC theo AGENTS.md).
 */
@Injectable({ providedIn: 'root' })
export class AdmissionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.API_URL;

  /** Bước 1: Lấy danh sách trường THPT. */
  getHighSchools(): Observable<ApiResponse<HighSchoolDto[]>> {
    return this.http.get<ApiResponse<HighSchoolDto[]>>(`${this.apiUrl}/api/v1/high-schools`);
  }

  /** Bước 2: Lấy danh sách nhóm môn của một trường THPT. */
  getSubjectGroupsBySchool(schoolCode: string, academicYear?: string): Observable<ApiResponse<SubjectGroupDto[]>> {
    const url = `${this.apiUrl}/api/v1/high-schools/${encodeURIComponent(schoolCode)}/subject-groups`;
    return this.http.get<ApiResponse<SubjectGroupDto[]>>(
      academicYear ? `${url}?academicYear=${encodeURIComponent(academicYear)}` : url
    );
  }

  getAcademicYears(schoolCode: string): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(
      `${this.apiUrl}/api/v1/high-schools/${encodeURIComponent(schoolCode)}/academic-years`
    );
  }

  recommendSubjectGroups(schoolCode: string, request: SubjectGroupRecommendationRequest): Observable<ApiResponse<SubjectGroupRecommendationsResponse>> {
    return this.http.post<ApiResponse<SubjectGroupRecommendationsResponse>>(
      `${this.apiUrl}/api/v1/high-schools/${encodeURIComponent(schoolCode)}/subject-groups/recommendations`,
      request
    );
  }

  /** Bước 3: Tra cứu tổ hợp xét tuyển theo danh sách mã môn của nhóm đã chọn. */
  searchBySubjects(request: SubjectSearchRequest): Observable<ApiResponse<SubjectSearchResponse>> {
    return this.http.post<ApiResponse<SubjectSearchResponse>>(
      `${this.apiUrl}/api/v1/admissions/search-by-subjects`,
      request
    );
  }

  /** Tra cứu phân loại môn học (môn bắt buộc & môn tự chọn). */
  getSubjectClassifications(): Observable<ApiResponse<SubjectClassificationResponse>> {
    return this.http.get<ApiResponse<SubjectClassificationResponse>>(
      `${this.apiUrl}/api/v1/subjects/classifications`
    );
  }

  /** Trích message lỗi thân thiện từ lỗi HTTP của Backend. */
  extractErrorMessage(error: unknown): string {
    if (this.isHttpErrorResponse(error)) {
      const body = error.error as ApiErrorBody | null;
      if (body && typeof body.message === 'string' && body.message.length > 0) {
        return body.message;
      }
    }
    return FRIENDLY_HTTP_ERROR;
  }

  private isHttpErrorResponse(error: unknown): error is { error: unknown } {
    return typeof error === 'object' && error !== null && 'error' in error;
  }
}
