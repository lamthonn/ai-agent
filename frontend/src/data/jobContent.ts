// Detail content for the jobs the screens open most: log, diff, test results, plan.
// Other jobs get a short generated log from their trace.
import type { Job } from './types';
import { projectById, steps } from './sample';

export interface LogLine { t: string; node: string; level: 'info' | 'warn' | 'error'; msg: string }
export interface TestResult { total: number; passed: number; failed: { name: string; file: string; message: string }[]; skipped: number; duration: string }
export interface PlanFile { path: string; change: 'Thêm' | 'Sửa'; why: string }
export interface Plan { goal: string; criteria: string[]; files: PlanFile[]; steps: string[]; risks: string[]; questions: string[] }

const log148: LogLine[] = [
  { t: '10:31:04', node: 'analyze', level: 'info', msg: 'Đọc requirements/dong-bo-ton-kho-theo-lo.md (3 mục tiêu, 5 tiêu chí nghiệm thu)' },
  { t: '10:34:12', node: 'plan', level: 'info', msg: 'Kế hoạch: sửa 4 file, thêm 1 file test. Đã duyệt bởi Nguyễn Minh Anh lúc 10:40' },
  { t: '10:40:31', node: 'code', level: 'info', msg: 'Edit src/QLKho.Application/Inventory/InventoryLotService.cs (+86 −12)' },
  { t: '10:51:02', node: 'code', level: 'info', msg: 'Write tests/QLKho.Tests/Inventory/InventoryLotTests.cs (+142)' },
  { t: '10:59:47', node: 'build_test', level: 'info', msg: '$ dotnet build → exit 0 (38 s)' },
  { t: '11:01:15', node: 'build_test', level: 'error', msg: '$ dotnet test → exit 1: 208 đạt, 4 lỗi' },
  { t: '11:05:40', node: 'fix', level: 'warn', msg: 'Vòng 1/3: sửa so sánh ngày hết hạn theo múi giờ UTC+7' },
  { t: '11:10:03', node: 'build_test', level: 'error', msg: '$ dotnet test → exit 1: 210 đạt, 2 lỗi' },
  { t: '11:17:22', node: 'fix', level: 'warn', msg: 'Vòng 2/3: gộp lô cùng mã khi SoLuong = 0' },
  { t: '11:21:48', node: 'build_test', level: 'error', msg: '$ dotnet test → exit 1: 210 đạt, 2 lỗi' },
  { t: '11:29:10', node: 'fix', level: 'warn', msg: 'Vòng 3/3: thêm khóa (MaVatTu, SoLo) khi gộp' },
  { t: '11:33:36', node: 'build_test', level: 'error', msg: '$ dotnet test → exit 1: 210 đạt, 2 lỗi' },
  { t: '11:36:00', node: 'fix', level: 'error', msg: 'Đã dùng hết 3/3 lần sửa. Dừng job, giữ branch và workspace để người xử lý tiếp' },
];

const diff148 = `diff --git a/src/QLKho.Application/Inventory/InventoryLotService.cs b/src/QLKho.Application/Inventory/InventoryLotService.cs
@@ -41,12 +41,31 @@ public sealed class InventoryLotService : IInventoryLotService
-    public async Task SyncAsync(Guid khoId, CancellationToken ct)
+    public async Task<SyncResult> SyncAsync(Guid khoId, DateOnly ngay, CancellationToken ct)
     {
-        var lots = await _repo.GetLotsAsync(khoId, ct);
-        foreach (var lot in lots)
-            lot.SoLuong = await _ledger.SumAsync(lot.Id, ct);
+        var lots = await _repo.GetLotsAsync(khoId, ct);
+        var merged = lots
+            .GroupBy(l => (l.MaVatTu, l.SoLo))
+            .Select(g => g.Aggregate(InventoryLot.Merge))
+            .ToList();
+
+        foreach (var lot in merged)
+        {
+            lot.SoLuong = await _ledger.SumAsync(lot.Id, ngay, ct);
+            lot.HetHan = lot.NgayHetHan < ngay;
+        }
+
+        await _repo.ReplaceLotsAsync(khoId, merged, ct);
+        return new SyncResult(lots.Count, merged.Count);
     }`;

const tests148: TestResult = {
  total: 212, passed: 210, skipped: 0, duration: '1 phút 26 giây',
  failed: [
    { name: 'InventoryLotTests.Sync_MergesLotsWithSameCode_KeepsEarliestExpiry', file: 'tests/QLKho.Tests/Inventory/InventoryLotTests.cs:88', message: 'Expected NgayHetHan 2026-12-01 but found 2027-02-15' },
    { name: 'InventoryLotTests.Sync_ExpiredLot_IsExcludedFromAvailable', file: 'tests/QLKho.Tests/Inventory/InventoryLotTests.cs:121', message: 'Expected SoLuongKhaDung 40 but found 55' },
  ],
};

const plan150: Plan = {
  goal: 'Cho phép kế toán chọn nhiều hóa đơn và tải về một file ZIP chứa PDF của từng hóa đơn.',
  criteria: [
    'Chọn tối đa 500 hóa đơn mỗi lần xuất',
    'Mỗi PDF giữ đúng mẫu hóa đơn và chữ ký số hiện có',
    'Xuất chạy nền, người dùng nhận link tải khi xong',
    'Hóa đơn chưa ký bị bỏ qua và được liệt kê trong file ket-qua.csv',
  ],
  files: [
    { path: 'src/HoaDon.Api/Controllers/InvoiceExportController.cs', change: 'Thêm', why: 'Endpoint POST /invoices/export và GET /exports/{id}' },
    { path: 'src/HoaDon.Application/Export/BulkPdfExportJob.cs', change: 'Thêm', why: 'Job nền tạo PDF và nén ZIP' },
    { path: 'src/HoaDon.Application/Pdf/InvoicePdfRenderer.cs', change: 'Sửa', why: 'Tách hàm render để dùng lại cho xuất hàng loạt' },
    { path: 'src/HoaDon.Infrastructure/Storage/ExportStorage.cs', change: 'Thêm', why: 'Lưu file ZIP 24 giờ rồi xóa' },
    { path: 'tests/HoaDon.Tests/Export/BulkPdfExportJobTests.cs', change: 'Thêm', why: 'Test giới hạn 500, bỏ qua hóa đơn chưa ký' },
  ],
  steps: [
    'Tách InvoicePdfRenderer.RenderAsync khỏi controller hiện tại, giữ nguyên đầu ra',
    'Thêm BulkPdfExportJob chạy trên hàng đợi Hangfire sẵn có',
    'Thêm 2 endpoint và kiểm tra quyền KeToan.XuatHoaDon',
    'Viết test cho job và endpoint, chạy dotnet test',
  ],
  risks: ['Render 500 PDF có thể mất khoảng 4 phút; cần timeout của job nền lớn hơn mức hiện tại (2 phút)'],
  questions: ['Link tải nên hết hạn sau 24 giờ hay 7 ngày?'],
};

const tests149: TestResult = { total: 148, passed: 148, skipped: 0, duration: '42 giây', failed: [] };
const diffStat149 = [
  { path: 'src/pages/TraCuuHoaDon/TraCuuHoaDon.tsx', add: 64, del: 31 },
  { path: 'src/api/invoices.ts', add: 22, del: 6 },
  { path: 'src/hooks/usePagedQuery.ts', add: 48, del: 0 },
  { path: 'src/pages/TraCuuHoaDon/TraCuuHoaDon.test.tsx', add: 57, del: 4 },
];
const review149 = 'Đạt. Không có thay đổi ngoài phạm vi. Gợi ý (không chặn): debounce ô tìm kiếm 300 ms để giảm số lần gọi API.';

export function contentFor(job: Job) {
  const p = projectById[job.project];
  if (job.id === 'JOB-0148') return { log: log148, diff: diff148, tests: tests148 };
  if (job.id === 'JOB-0149') return { log: genericLog(job), diffStat: diffStat149, tests: tests149, review: review149 };
  if (job.id === 'JOB-0150') return { log: genericLog(job), plan: plan150 };
  return { log: genericLog(job), tests: job.status === 'succeeded' ? { total: 0, passed: 0, failed: [], skipped: 0, duration: '—' } as TestResult : undefined, command: `${p.build} && ${p.test}` };
}

function genericLog(job: Job): LogLine[] {
  const out: LogLine[] = [];
  let t = job.start.getTime();
  const fmt = (ms: number) => new Date(ms).toTimeString().slice(0, 8);
  for (const s of job.trace) {
    if (s.state === 'pending' || s.state === 'skipped') continue;
    const label = steps.find((x) => x.id === s.step)!.label;
    const msg = s.state === 'waiting' ? `${label}: đang chờ người duyệt` : s.state === 'running' ? `${label}: đang chạy (${s.min} phút)` : `${label}: xong sau ${s.min} phút${s.rounds ? `, ${s.rounds} vòng` : ''}`;
    out.push({ t: fmt(t), node: s.step, level: s.state === 'failed' ? 'error' : 'info', msg });
    t += s.min * 60_000;
  }
  return out;
}
