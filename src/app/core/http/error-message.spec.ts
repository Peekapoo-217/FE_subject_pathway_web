import { HttpErrorResponse } from '@angular/common/http';

import { getErrorMessage } from './error-message';

describe('getErrorMessage', () => {
  it('uses the message returned by the backend', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' }
    });

    expect(getErrorMessage(error, 'Fallback')).toBe('Mật khẩu phải có ít nhất 6 ký tự.');
  });

  it('maps common HTTP failures to user-facing messages', () => {
    expect(getErrorMessage(new HttpErrorResponse({ status: 403 }), 'Fallback'))
      .toBe('Bạn không có quyền thực hiện thao tác này.');
    expect(getErrorMessage(new HttpErrorResponse({ status: 413 }), 'Fallback'))
      .toBe('Tệp tải lên vượt quá dung lượng cho phép.');
    expect(getErrorMessage(new HttpErrorResponse({
      status: 503,
      error: { message: 'SQL connection failed at internal-host' }
    }), 'Fallback'))
      .toBe('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
  });

  it('uses the supplied fallback for non-HTTP failures', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'), 'Không tải được dữ liệu.'))
      .toBe('Không tải được dữ liệu.');
  });
});
