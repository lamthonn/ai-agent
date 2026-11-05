// Bug and test-case files linked to a project (Google Sheet or Excel).
// The worker reads the bug file every few minutes: each new row is triaged by an agent and either waits for a person
// to run it ("suggest") or becomes a job on its own ("auto"). Results are written back to the sheet.
// The test-case file feeds the "Test cases" workflow, which runs the listed cases and never writes tests to the repo.
// Sample rows below stand in for the real file the team will send.
import type { Text } from '../i18n';

export type BugField = 'id' | 'title' | 'steps' | 'severity' | 'status' | 'reporter';
export type CaseField = 'id' | 'module' | 'title' | 'steps' | 'expected';
export interface SheetLink { url: string; tab: string; columns: Record<string, string>; lastSync?: string }
export interface BugSource extends SheetLink { filter: string; mode: 'suggest' | 'auto'; autoWorkflow: string; maxPerDay: number; writeBack: boolean }
export interface ProjectSources { bugs: BugSource | null; cases: SheetLink | null }

/** Shared with this address (read, plus edit for write-back) so the worker can open the sheet; no personal login. */
export const SERVICE_ACCOUNT = 'codesloop-reader@codes-tech.iam.gserviceaccount.com';
export const bugFields: { key: BugField; label: Text }[] = [
  { key: 'id', label: { vi: 'Mã bug', en: 'Bug ID' } }, { key: 'title', label: { vi: 'Mô tả', en: 'Description' } },
  { key: 'steps', label: { vi: 'Bước tái hiện', en: 'Steps to reproduce' } }, { key: 'severity', label: { vi: 'Mức độ', en: 'Severity' } },
  { key: 'status', label: { vi: 'Trạng thái', en: 'Status' } }, { key: 'reporter', label: { vi: 'Người báo', en: 'Reporter' } },
];
export const caseFields: { key: CaseField; label: Text }[] = [
  { key: 'id', label: { vi: 'Mã test case', en: 'Case ID' } }, { key: 'module', label: { vi: 'Chức năng', en: 'Module' } },
  { key: 'title', label: { vi: 'Tên test case', en: 'Case title' } }, { key: 'steps', label: { vi: 'Các bước', en: 'Steps' } },
  { key: 'expected', label: { vi: 'Kết quả mong đợi', en: 'Expected result' } },
];

export const sources: Record<string, ProjectSources> = {
  qlkho: {
    bugs: { url: 'https://docs.google.com/spreadsheets/d/1qLkHo-bug-log-mau/edit', tab: 'Bug', lastSync: '2026-11-05 14:15',
      columns: { id: 'A', title: 'B', steps: 'C', severity: 'D', status: 'E', reporter: 'F' },
      filter: 'Trạng thái = Mới', mode: 'suggest', autoWorkflow: 'quick-fix', maxPerDay: 1, writeBack: true },
    cases: { url: 'https://docs.google.com/spreadsheets/d/1qLkHo-test-case-mau/edit', tab: 'Test case', lastSync: '2026-11-05 14:15',
      columns: { id: 'A', module: 'B', title: 'C', steps: 'D', expected: 'E' } },
  },
  web: { bugs: null, cases: null },
};

export type Triage = 'ready' | 'need-info' | 'duplicate' | 'job';
export interface BugRow { id: string; project: string; row: number; title: string; severity: 'high' | 'medium' | 'low'; reporter: string; triage: Triage; workflow?: string; note?: Text; job?: string }
export const bugRows: BugRow[] = [
  { id: 'BUG-034', project: 'qlkho', row: 36, title: 'Phiếu nhập: đơn giá làm tròn sai khi số lượng có phần lẻ', severity: 'high', reporter: 'Kế toán kho', triage: 'ready', workflow: 'quick-fix',
    note: { vi: 'Đủ bước tái hiện; lỗi nằm ở một hàm tính tiền, hợp với Sửa lỗi nhanh.', en: 'Steps are complete; the bug sits in one pricing function, a fit for Quick fix.' } },
  { id: 'BUG-033', project: 'qlkho', row: 35, title: 'Xuất Excel tồn kho thiếu cột Đơn vị tính', severity: 'medium', reporter: 'Thủ kho HN', triage: 'ready', workflow: 'quick-fix',
    note: { vi: 'Rõ ràng, phạm vi nhỏ.', en: 'Clear and small in scope.' } },
  { id: 'BUG-032', project: 'qlkho', row: 34, title: 'Bộ lọc kho theo chi nhánh không ra kết quả cho chi nhánh HN', severity: 'medium', reporter: 'Thủ kho HN', triage: 'duplicate',
    note: { vi: 'Trùng BUG-028 (đang chờ sửa). Đã ghi vào sheet.', en: 'Duplicate of BUG-028 (awaiting a fix). Written to the sheet.' } },
  { id: 'BUG-031', project: 'qlkho', row: 33, title: 'Lỗi khi lưu', severity: 'low', reporter: 'Thủ kho ĐN', triage: 'need-info',
    note: { vi: 'Không có bước tái hiện và màn hình nào. Đã ghi "Cần thêm thông tin" vào sheet.', en: 'No steps and no screen named. "Needs more info" written to the sheet.' } },
];

export interface CaseRow { id: string; project: string; module: string; title: string; steps: number; last: 'pass' | 'fail' | 'none' }
export const caseRows: CaseRow[] = [
  { id: 'TC-001', project: 'qlkho', module: 'Đăng nhập', title: 'Đăng nhập đúng tài khoản thủ kho', steps: 3, last: 'pass' },
  { id: 'TC-002', project: 'qlkho', module: 'Đăng nhập', title: 'Sai mật khẩu 5 lần thì khóa 15 phút', steps: 4, last: 'pass' },
  { id: 'TC-010', project: 'qlkho', module: 'Phiếu nhập', title: 'Tạo phiếu nhập nhiều dòng vật tư', steps: 6, last: 'pass' },
  { id: 'TC-011', project: 'qlkho', module: 'Phiếu nhập', title: 'Đơn giá × số lượng lẻ làm tròn 0 chữ số', steps: 5, last: 'fail' },
  { id: 'TC-020', project: 'qlkho', module: 'Chuyển kho', title: 'Chuyển kho giữa hai chi nhánh cập nhật tồn cả hai bên', steps: 7, last: 'pass' },
  { id: 'TC-030', project: 'qlkho', module: 'Báo cáo', title: 'Xuất Excel tồn kho đủ cột theo mẫu', steps: 4, last: 'fail' },
  { id: 'TC-031', project: 'qlkho', module: 'Báo cáo', title: 'Lọc tồn kho theo chi nhánh', steps: 4, last: 'none' },
];
