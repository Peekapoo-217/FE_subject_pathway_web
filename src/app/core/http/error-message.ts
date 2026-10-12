import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  message?: unknown;
  error?: { message?: unknown };
}

/** Returns a safe, user-facing message for HTTP and unexpected application errors. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.';
    if (error.status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';

    const body = error.error as ApiErrorBody | string | null;
    if (typeof body === 'object' && body !== null) {
      const message = typeof body.message === 'string'
        ? body.message
        : body.error?.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }

    if (error.status === 400) return 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.';
    if (error.status === 401) return 'Thông tin đăng nhập không hợp lệ hoặc phiên làm việc đã hết hạn.';
    if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status === 404) return 'Không tìm thấy dữ liệu được yêu cầu.';
    if (error.status === 409) return 'Dữ liệu bị trùng hoặc đã thay đổi. Vui lòng tải lại và thử lại.';
    if (error.status === 413) return 'Tệp tải lên vượt quá dung lượng cho phép.';
    if (error.status === 415) return 'Định dạng tệp không được hỗ trợ.';
    if (error.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.';
    return fallback;
  }

  return fallback;
}
