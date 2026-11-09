// The platforms a workspace can plug in. Only Google Sheets reads data today; the others are listed so people can see what is coming.
import type { Text } from '../i18n';

export interface Platform { id: string; name: string; chip: string; live: boolean; about: Text }

export const platforms: Platform[] = [
  { id: 'google-sheets', name: 'Google Sheets', chip: 'GS', live: true, about: { vi: 'Mỗi dòng trong bảng là một việc cần làm. Hệ thống đọc định kỳ, agent phân loại, workflow xử lý, trạng thái được ghi ngược vào bảng.', en: 'Each row in a sheet is a piece of work. It is read on a schedule, an agent triages it, a workflow handles it, and the status is written back to the sheet.' } },
  { id: 'google-docs', name: 'Google Docs', chip: 'GD', live: false, about: { vi: 'Mỗi tài liệu là một yêu cầu: đọc nội dung để chạy workflow, xuất kết quả ra tài liệu mới.', en: 'Each document is a request: read it to run a workflow, write the result to a new document.' } },
  { id: 'google-drive', name: 'Google Drive', chip: 'DR', live: false, about: { vi: 'File mới trong một thư mục là một việc cần làm; kết quả được lưu lại vào thư mục.', en: 'A new file in a folder is a piece of work; results are saved back to the folder.' } },
  { id: 'gmail', name: 'Gmail', chip: 'GM', live: false, about: { vi: 'Email gửi vào một hộp thư riêng trở thành việc cần làm.', en: 'Email sent to a dedicated mailbox becomes a piece of work.' } },
  { id: 'slack', name: 'Slack', chip: 'SL', live: false, about: { vi: 'Nhận việc từ một kênh và báo kết quả lại vào kênh.', en: 'Take work from a channel and report back to it.' } },
  { id: 'notion', name: 'Notion', chip: 'NT', live: false, about: { vi: 'Mỗi mục trong một database Notion là một việc cần làm.', en: 'Each item in a Notion database is a piece of work.' } },
];
