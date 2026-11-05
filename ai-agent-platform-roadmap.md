# AI Agent Engineering Platform -- Đề xuất kiến trúc và roadmap triển khai

## 1. Mục tiêu dự án

Xây dựng một nền tảng AI Agent hỗ trợ công việc lập trình (AI Agent
Engineering Platform), có khả năng tiếp nhận tài liệu yêu cầu, phân tích
codebase, lập kế hoạch, coding, build, test, tự sửa lỗi và tạo báo cáo.

Mục tiêu dài hạn là có một trang quản trị cho phép:

-   Quản lý nhiều project/repository.
-   Tạo và quản lý các job.
-   Thiết kế workflow bằng giao diện kéo thả.
-   Cấu hình các agent, prompt, công cụ và điều kiện thực thi.
-   Theo dõi log, trạng thái và kết quả từng bước theo thời gian thực.
-   Quản lý kết quả code, Git diff, test report và approval.

**Nguyên tắc triển khai:** Xây dựng một Coding Agent có thể hoàn thành
một nhiệm vụ thực tế trước. Sau đó mới mở rộng thành hệ thống
multi-agent và nền tảng quản lý workflow.

------------------------------------------------------------------------

## 2. Kiến trúc tổng thể

Hệ thống được chia thành ba lớp chính.

### 2.1. Management Platform

Lớp giao diện và quản lý:

-   Dashboard: tổng quan job, trạng thái và hiệu suất.
-   Project Management: quản lý repository.
-   Job Management: tạo, sửa, chạy, hủy job.
-   Workflow Builder: thiết kế flow thực thi.
-   Agent Management: cấu hình agent và system prompt.
-   Monitoring: log, lịch sử và báo cáo.
-   Approval Management: duyệt các hành động quan trọng.

Management Platform không trực tiếp thực hiện coding. Nó chịu trách
nhiệm quản lý và điều phối.

### 2.2. Agent Orchestration Engine

Lớp điều phối quy trình:

-   Nhận job và workflow definition.
-   Xác định node tiếp theo cần chạy.
-   Phân công nhiệm vụ cho agent hoặc worker.
-   Quản lý trạng thái từng node và toàn workflow.
-   Retry khi lỗi.
-   Điều khiển nhánh điều kiện.
-   Pause, resume, cancel.
-   Chờ người dùng phê duyệt khi cần.

**Nguyên tắc quan trọng:** Workflow Engine điều khiển luồng; AI Agent
thực hiện nhiệm vụ của node. Không nên để LLM tự quyết định toàn bộ
workflow vì sẽ khó kiểm soát, debug và theo dõi chi phí.

### 2.3. Execution & Integration

Lớp thực thi:

-   Claude Code / Claude Agent SDK: runtime cho coding agent.
-   Docker Sandbox: môi trường chạy job độc lập.
-   Git Integration: clone, checkout branch, diff, commit.
-   Build & Test: chạy lệnh build, unit test, integration test.
-   Artifact Storage: lưu báo cáo và kết quả thực thi.

### 2.4. Sơ đồ logic

``` text
Management Platform
  ├── Dashboard
  ├── Project Manager
  ├── Job Manager
  ├── Workflow Builder
  └── Monitoring
          |
          v
Agent Orchestration Engine
  ├── Workflow State Machine
  ├── Scheduler / Queue
  ├── Retry & Approval
  └── Agent Dispatcher
          |
          v
Agent Runtime / Workers
  ├── Requirement Agent
  ├── Architect Agent
  ├── Coding Agent
  ├── Testing Agent
  └── Review / Fix Agent
          |
          v
Execution Environment
  ├── Docker Sandbox
  ├── Git Repository
  ├── Build & Test
  └── Artifacts / Reports
```

------------------------------------------------------------------------

## 3. Công nghệ đề xuất

  -----------------------------------------------------------------------
  Thành phần              Công nghệ đề xuất       Vai trò
  ----------------------- ----------------------- -----------------------
  Frontend                ReactJS + Ant Design    Giao diện quản trị

  Workflow UI             React Flow / xyflow     Kéo thả và kết nối node

  Backend                 ASP.NET Core 8          API quản lý project,
                                                  job, workflow

  Agent Runtime           Python                  Chạy Claude Agent SDK
                                                  và công cụ AI

  Agent SDK               Claude Agent SDK        Agent loop, tool use,
                                                  coding

  Database                PostgreSQL              Lưu project, job,
                                                  workflow, execution

  Workflow Engine         Temporal hoặc custom    Điều phối workflow dài
                          State Machine           hạn

  Message Queue           RabbitMQ (nếu cần)      Phân phối task tới
                                                  worker

  Execution               Docker                  Cô lập môi trường thực
                                                  thi

  Source Control          Git                     Quản lý branch và thay
                                                  đổi code

  Realtime                SignalR                 Đẩy trạng thái và log
                                                  về UI

  Monitoring              Prometheus + Grafana    Theo dõi worker và hệ
                                                  thống
  -----------------------------------------------------------------------

### 3.1. Vì sao chọn Claude Code / Claude Agent SDK?

Claude Code có thể hỗ trợ các tác vụ:

-   Đọc và phân tích repository.
-   Tìm kiếm file và symbol liên quan.
-   Tạo và chỉnh sửa source code.
-   Chạy terminal command.
-   Chạy build và test.
-   Sử dụng subagents.
-   Tích hợp công cụ ngoài thông qua MCP.
-   Kiểm soát quyền thực thi thông qua permission controls và hooks.

Tài liệu tham khảo:

-   Claude Agent SDK: https://code.claude.com/docs/en/agent-sdk/overview
-   Python SDK: https://github.com/anthropics/claude-agent-sdk-python
-   TypeScript SDK:
    https://github.com/anthropics/claude-agent-sdk-typescript

### 3.2. Lưu ý về Claude Pro và API

Claude Pro không mặc nhiên đồng nghĩa với Anthropic API credits. Trước
khi thiết kế backend chạy nhiều worker, cần xác minh phương thức xác
thực được SDK hỗ trợ và điều khoản sử dụng hiện hành.

Cần tính đến:

-   Phương thức xác thực phù hợp cho ứng dụng.
-   Giới hạn sử dụng và concurrency.
-   Chi phí API hoặc subscription phù hợp.
-   Cơ chế giới hạn số lượt gọi và ngân sách mỗi job.

Không nên thiết kế hệ thống phụ thuộc vào một phiên đăng nhập Claude Pro
duy nhất khi chưa xác minh khả năng sử dụng trong mô hình
backend/worker.

------------------------------------------------------------------------

## 4. Pipeline phát triển dự án

Dự án được chia thành sáu phase. Nên triển khai tuần tự, tránh xây dựng
giao diện quản lý quá sớm khi Agent Runtime chưa hoạt động.

## Phase 1 -- Coding Agent MVP

**Mục tiêu:** Có một agent nhận yêu cầu và tự thực hiện coding trên một
repository.

### Pipeline

``` text
Requirement Input
      |
      v
Requirement Analyzer
      |
      v
Codebase Analyzer
      |
      v
Implementation Planner
      |
      v
Coding Agent
      |
      v
Build & Test
      |
      v
Bug Fix Loop
      |
      v
Final Report
```

### Mô tả từng bước

1.  **Requirement Input**
    -   Nhận yêu cầu từ Markdown, TXT, DOCX hoặc PDF.
    -   Nhận đường dẫn repository.
    -   Nhận cấu hình build/test command.
2.  **Requirement Analyzer**
    -   Đọc và phân tích yêu cầu.
    -   Xác định mục tiêu, phạm vi và tiêu chí nghiệm thu.
    -   Ghi nhận điểm chưa rõ để hỏi người dùng.
3.  **Codebase Analyzer**
    -   Phân tích cấu trúc thư mục.
    -   Nhận diện ngôn ngữ, framework và kiến trúc.
    -   Tìm các module/file liên quan.
    -   Xác định quy ước code hiện tại.
4.  **Implementation Planner**
    -   Tạo kế hoạch triển khai.
    -   Liệt kê file dự kiến thay đổi.
    -   Xác định các bước và rủi ro.
    -   Có thể yêu cầu người dùng duyệt kế hoạch trước khi coding.
5.  **Coding Agent**
    -   Chỉnh sửa source code.
    -   Tạo hoặc cập nhật test nếu phù hợp.
    -   Tuân thủ coding convention của repository.
6.  **Build & Test**
    -   Chạy build.
    -   Chạy unit test và các test được cấu hình.
    -   Lưu stdout, stderr và exit code.
7.  **Bug Fix Loop**
    -   Đọc lỗi build/test.
    -   Phân tích nguyên nhân.
    -   Sửa code.
    -   Chạy lại test.
    -   Giới hạn số vòng sửa, ví dụ tối đa 3 lần.
8.  **Final Report**
    -   Tổng hợp yêu cầu đã xử lý.
    -   Liệt kê file thay đổi.
    -   Đính kèm Git diff.
    -   Báo cáo build/test.
    -   Liệt kê lỗi còn tồn tại và việc cần người dùng xử lý.

### Acceptance Criteria

-   [ ] Nhận requirement từ file Markdown.
-   [ ] Nhận đường dẫn repository.
-   [ ] Tạo Git branch riêng cho job.
-   [ ] Phân tích source code.
-   [ ] Tạo implementation plan.
-   [ ] Thực hiện coding.
-   [ ] Chạy build và test.
-   [ ] Tự fix lỗi tối đa 3 lần.
-   [ ] Tạo báo cáo Markdown.
-   [ ] Lưu Git diff.
-   [ ] Không tác động đến branch gốc.

### Ví dụ cấu hình job ban đầu

``` yaml
job:
  name: Add user management API
  repository: ./QLKho
  branch: feature/ai-user-management

  requirement:
    file: requirements/user-management.md

  execution:
    max_fix_attempts: 3
    build_command: dotnet build
    test_command: dotnet test

  output:
    - code_changes
    - test_report
    - execution_log
    - git_diff
```

Ở phase này chỉ cần một Agent Runtime. Chưa cần xây dựng multi-agent,
frontend, RabbitMQ hay workflow builder.

------------------------------------------------------------------------

## Phase 2 -- Multi-Agent

**Mục tiêu:** Chia nhiệm vụ thành các vai trò chuyên biệt khi Coding
Agent MVP đã hoạt động ổn định.

  -----------------------------------------------------------------------
  Agent                   Nhiệm vụ                Quyền hạn gợi ý
  ----------------------- ----------------------- -----------------------
  Requirement Agent       Phân tích tài liệu yêu  Read
                          cầu                     

  Architect Agent         Phân tích kiến trúc,    Read
                          thiết kế giải pháp      

  Coding Agent            Viết và sửa code        Read/Write

  Testing Agent           Viết test, chạy test    Read/Write trong phạm
                                                  vi cho phép

  Review Agent            Review code, tìm bug    Read

  Fix Agent               Sửa lỗi từ kết quả      Read/Write
                          test/review             
  -----------------------------------------------------------------------

### Workflow tham khảo

``` text
Requirement Agent
        |
        v
Architect Agent
        |
        v
Coding Agent
        |
        v
Testing Agent
        |
        v
Review Agent
        |
        +---- Có lỗi ----> Fix Agent
        |                     |
        |                     +----> Testing Agent
        |
        +---- Đạt yêu cầu --> Complete
```

Không nhất thiết mỗi vai trò phải là một process hoặc model riêng. Có
thể dùng Claude Code Subagents cho các vai trò. Chỉ tách thành worker
riêng khi cần chạy song song, cô lập tài nguyên hoặc quản lý vòng đời
độc lập.

------------------------------------------------------------------------

## Phase 3 -- Agent Management Backend

**Mục tiêu:** Xây dựng backend quản lý project, job, agent, workflow và
execution.

### Các module

  Module                Chức năng
  --------------------- -----------------------------------
  Project Management    Quản lý repository
  Job Management        Tạo, sửa, xóa, chạy và hủy job
  Workflow Management   Lưu và quản lý workflow
  Agent Management      Quản lý agent, prompt và cấu hình
  Execution Engine      Thực thi các node
  Execution History     Lưu lịch sử chạy
  Artifact Management   Lưu báo cáo, file, diff
  Approval Management   Chờ người dùng duyệt

### Database schema sơ bộ

``` text
projects
  id
  name
  repository_url
  default_branch
  created_at

agents
  id
  name
  agent_type
  system_prompt
  configuration_json
  created_at

workflows
  id
  name
  version
  definition_json
  created_at

workflow_nodes
  id
  workflow_id
  node_type
  configuration_json

jobs
  id
  project_id
  workflow_id
  status
  requirement
  created_at
  updated_at

job_executions
  id
  job_id
  status
  started_at
  completed_at
  error_message

execution_logs
  id
  execution_id
  node_id
  level
  message
  created_at

artifacts
  id
  execution_id
  artifact_type
  file_path
  metadata_json
  created_at

approvals
  id
  execution_id
  node_id
  status
  requested_at
  approved_at
  approved_by
```

Đây là schema khởi đầu; cần bổ sung index, foreign key, tenant/user
ownership, audit và retention policy khi thiết kế chi tiết.

### Lưu workflow dạng JSON

Workflow nên được lưu dưới dạng JSON để có thể thay đổi cấu hình mà
không cần sửa code backend.

Ví dụ:

``` json
{
  "name": "AI Coding Workflow",
  "nodes": [
    {
      "id": "analyze",
      "type": "agent",
      "agent": "requirement-analyzer"
    },
    {
      "id": "plan",
      "type": "agent",
      "agent": "architect"
    },
    {
      "id": "coding",
      "type": "agent",
      "agent": "coder"
    },
    {
      "id": "testing",
      "type": "command",
      "command": "dotnet test"
    },
    {
      "id": "review",
      "type": "agent",
      "agent": "code-reviewer"
    },
    {
      "id": "finish",
      "type": "output"
    }
  ],
  "edges": [
    {"from": "analyze", "to": "plan"},
    {"from": "plan", "to": "coding"},
    {"from": "coding", "to": "testing"},
    {"from": "testing", "to": "review"},
    {"from": "review", "to": "finish"}
  ]
}
```

Cần version hóa workflow. Mỗi job nên tham chiếu tới một phiên bản
workflow cụ thể để khi workflow thay đổi, các job cũ vẫn có thể truy vết
và tái hiện.

------------------------------------------------------------------------

## Phase 4 -- Workflow Builder

**Mục tiêu:** Cho phép người dùng thiết kế workflow bằng giao diện kéo
thả.

Công nghệ đề xuất: React Flow / xyflow.

Website: https://reactflow.dev/

### Các node cần hỗ trợ

  Node        Chức năng
  ----------- --------------------------
  Start       Bắt đầu workflow
  Agent       Gọi một AI Agent
  Condition   Rẽ nhánh theo điều kiện
  Command     Chạy command
  Git         Clone, checkout, commit
  Test        Chạy test
  Approval    Chờ người dùng duyệt
  Delay       Chờ một khoảng thời gian
  End         Kết thúc workflow

### Ví dụ workflow

``` text
             START
               |
        Requirement Agent
               |
         Architect Agent
               |
          Coding Agent
               |
          Build & Test
               |
          Build Success?
           /        \
         Yes         No
          |           |
       Code Review  Fix Agent
          |           |
      Review Pass?    |
       /      \       |
     Yes       No ----+
      |
     END
```

### Yêu cầu cho Workflow Builder

-   Kéo thả node từ danh sách.
-   Kết nối node bằng edge.
-   Cấu hình thuộc tính node.
-   Cấu hình điều kiện và nhánh.
-   Validate workflow trước khi lưu.
-   Lưu workflow dưới dạng JSON.
-   Version hóa workflow.
-   Cho phép chạy thử workflow.
-   Hiển thị trạng thái từng node khi job chạy.

------------------------------------------------------------------------

## Phase 5 -- Execution Engine và Docker Sandbox

**Mục tiêu:** Chạy nhiều job độc lập, an toàn và có thể mở rộng worker.

### Kiến trúc đề xuất

``` text
ASP.NET Core Backend
        |
        v
Workflow Engine
        |
        v
Message Queue (nếu cần)
        |
        v
Python Agent Workers
        |
        +--------------------+
        |                    |
        v                    v
  Docker Sandbox 1      Docker Sandbox 2
  Repository A          Repository B
  Claude Agent          Claude Agent
  Build / Test           Build / Test
        |                    |
        +---------+----------+
                  |
                  v
          Git Diff / Artifacts
                  |
                  v
           Execution Report
```

Mỗi job nên chạy trong một môi trường độc lập:

``` text
Job #001
  └── Docker Container
       ├── Workspace
       ├── Repository
       ├── Agent Runtime
       ├── Build
       └── Test

Job #002
  └── Docker Container
       ├── Workspace
       ├── Repository
       ├── Agent Runtime
       ├── Build
       └── Test
```

### Nguyên tắc bảo mật

-   Không chạy container với `--privileged`.
-   Giới hạn CPU, RAM, disk và thời gian chạy.
-   Không mount Docker socket vào container của agent.
-   Không đưa credential Git hoặc production vào container nếu không cần
    thiết.
-   Giới hạn quyền đọc/ghi repository.
-   Quản lý secret qua secret manager hoặc cơ chế cấp phát ngắn hạn.
-   Áp dụng network policy phù hợp; mặc định hạn chế kết nối không cần
    thiết.
-   Kiểm soát command bằng allowlist/policy và permission hooks.
-   Yêu cầu approval trước khi merge hoặc deploy.
-   Ghi audit log cho các hành động quan trọng.

Docker chỉ là một lớp cô lập, không tự động bảo đảm sandbox an toàn
tuyệt đối. Với workload không đáng tin cậy, cần đánh giá thêm cấu hình
kernel, user namespace, seccomp, AppArmor và giải pháp cô lập mạnh hơn.

------------------------------------------------------------------------

## Phase 6 -- Monitoring, đánh giá và mở rộng

**Mục tiêu:** Quan sát được toàn bộ hoạt động của agent và đánh giá chất
lượng đầu ra.

### Dashboard

Các chỉ số cần theo dõi:

-   Tổng số job.
-   Job đang chạy.
-   Job thành công/thất bại.
-   Thời gian chạy trung bình.
-   Tỷ lệ build/test thành công.
-   Số lần agent phải fix.
-   Số worker đang hoạt động.
-   Token usage và chi phí nếu có dữ liệu đáng tin cậy.

### Job Detail

Trang chi tiết job nên có:

-   Timeline từng node.
-   Log realtime.
-   Prompt và input của agent.
-   Tool calls đã thực thi.
-   Thời gian thực thi từng bước.
-   Token usage/chi phí nếu có.
-   Git diff.
-   Build/test result.
-   Artifact và báo cáo.
-   Nút Pause, Resume, Cancel.
-   Nút Approve/Reject.

### Đánh giá chất lượng agent

Không chỉ đánh giá job thành công hay thất bại. Nên lưu thêm:

-   Yêu cầu có được đáp ứng đầy đủ không?
-   Test mới có kiểm tra đúng hành vi không?
-   Có làm hỏng chức năng cũ không?
-   Có thay đổi ngoài phạm vi không?
-   Có vi phạm coding convention không?
-   Có cần con người sửa lại không?

------------------------------------------------------------------------

## 5. Các quyết định kiến trúc cần cân nhắc

### 5.1. RabbitMQ hay Temporal?

  -----------------------------------------------------------------------
  Tiêu chí                RabbitMQ                Temporal
  ----------------------- ----------------------- -----------------------
  Phân phối task          Rất tốt                 Có

  Retry                   Tự triển khai logic     Có hỗ trợ

  Workflow nhiều bước     Phải tự quản lý         Rất phù hợp

  Pause/Resume            Tự triển khai           Hỗ trợ workflow

  Khôi phục sau crash     Cần tự xây dựng         Durable execution
                          state/recovery          

  Độ phức tạp ban đầu     Thấp hơn                Cao hơn
  -----------------------------------------------------------------------

**Đề xuất:** Nếu workflow chỉ đơn giản là phân phối task, RabbitMQ có
thể đủ. Nếu workflow dài hạn, có nhiều nhánh, retry, approval và cần
phục hồi sau crash, nên đánh giá Temporal.

Không nhất thiết dùng cả hai ngay từ đầu. Chọn một giải pháp
orchestration phù hợp với nhu cầu MVP, tránh tăng độ phức tạp không cần
thiết.

### 5.2. Có nên dùng RAG?

Chưa cần trong MVP.

Ban đầu, cho agent đọc source code trực tiếp bằng các công cụ của Claude
Code.

Khi repository lớn hoặc cần kiến thức dùng chung, có thể bổ sung:

-   Code indexing.
-   Embedding.
-   Vector database.
-   RAG để tìm đoạn code liên quan.
-   Knowledge base về kiến trúc và business rules.
-   Code graph/knowledge graph.

Graphify có thể được đánh giá như một lớp hỗ trợ phân tích codebase,
nhưng không phải thành phần bắt buộc của Agent Runtime.

### 5.3. Có nên cho agent tự động deploy?

Không nên bật ngay từ đầu.

  Hành động           Quyền đề xuất
  ------------------- -------------------------
  Đọc source          Tự động
  Tạo branch          Tự động
  Chỉnh sửa source    Tự động trong workspace
  Chạy build/test     Tự động
  Sửa bug             Tự động có giới hạn
  Commit              Theo cấu hình
  Push branch         Theo policy
  Merge PR            Cần approval
  Deploy production   Bắt buộc approval

### 5.4. Claude Pro có đủ không?

Có thể dùng Claude Code để thử nghiệm cá nhân theo phương thức Anthropic
hỗ trợ. Nhưng với backend nhiều worker, cần xác minh phương thức xác
thực, điều khoản, quota và concurrency.

Không nên giả định một tài khoản Pro có thể được chia sẻ tùy ý cho nhiều
worker hoặc được dùng như API key.

------------------------------------------------------------------------

## 6. Roadmap triển khai

  Giai đoạn   Công việc            Sản phẩm bàn giao
  ----------- -------------------- -------------------------------------
  Tuần 1      Coding Agent MVP     Agent chạy được trên một repository
  Tuần 2      Multi-Agent          Planner, Coder, Tester, Reviewer
  Tuần 3      Management Backend   API quản lý Project, Job, Execution
  Tuần 4      Workflow Builder     Giao diện React Flow
  Tuần 5      Docker Worker        Worker và sandbox độc lập
  Tuần 6      Monitoring           Log, báo cáo, dashboard

Đây là lịch mục tiêu cho MVP, không phải cam kết thời gian. Cần điều
chỉnh theo khả năng tích hợp Claude, độ phức tạp của sandbox và yêu cầu
phục hồi workflow.

------------------------------------------------------------------------

## 7. Cấu trúc repository đề xuất

``` text
ai-agent-platform/
│
├── frontend/
│   └── React + Ant Design
│
├── backend/
│   └── ASP.NET Core
│
├── agent-runtime/
│   ├── agents/
│   │   ├── planner/
│   │   ├── coder/
│   │   ├── tester/
│   │   └── reviewer/
│   │
│   ├── tools/
│   │   ├── git/
│   │   ├── terminal/
│   │   ├── filesystem/
│   │   └── testing/
│   │
│   ├── orchestration/
│   └── main.py
│
├── infrastructure/
│   ├── docker/
│   └── rabbitmq/
│
├── docs/
│
└── docker-compose.yml
```

Trong tuần đầu, chỉ cần triển khai `agent-runtime`. Chưa cần tạo
frontend, backend, RabbitMQ hoặc Workflow Builder.

------------------------------------------------------------------------

## 8. MVP đầu tiên: Autonomous Coding Agent

### 8.1. Mục tiêu

Xây dựng một Python application sử dụng Claude Agent SDK, nhận
requirement và repository path, sau đó tự phân tích, coding, build, test
và fix bug.

### 8.2. Input

-   Repository path.
-   Requirement file.
-   Build command.
-   Test command.
-   Số vòng fix tối đa.

### 8.3. Output

-   Source code đã thay đổi.
-   Git branch riêng.
-   Git diff.
-   Build result.
-   Test result.
-   Execution log.
-   Báo cáo Markdown.

### 8.4. Acceptance Criteria

-   [ ] Nhận requirement từ file Markdown.
-   [ ] Nhận đường dẫn repository.
-   [ ] Kiểm tra trạng thái Git trước khi thực thi.
-   [ ] Tạo branch riêng cho job.
-   [ ] Phân tích source code.
-   [ ] Tạo implementation plan.
-   [ ] Thực hiện coding.
-   [ ] Chạy build và test.
-   [ ] Tự fix lỗi tối đa 3 lần.
-   [ ] Tạo báo cáo Markdown.
-   [ ] Lưu Git diff.
-   [ ] Không tác động đến branch gốc.
-   [ ] Có giới hạn thời gian và quyền thực thi.

### 8.5. Lệnh chạy mục tiêu

``` bash
python main.py \
  --repo ./QLKho \
  --requirement ./requirements/task.md
```

### 8.6. Các bước triển khai MVP

1.  Tạo Python project.
2.  Cài và xác minh Claude Agent SDK.
3.  Tạo cấu hình runtime và permission policy.
4.  Xây dựng Git tool: kiểm tra trạng thái, tạo branch, diff.
5.  Xây dựng Requirement Analyzer.
6.  Xây dựng Codebase Analyzer và Planner.
7.  Xây dựng Coding Agent.
8.  Xây dựng Build/Test Runner.
9.  Xây dựng Bug Fix Loop có giới hạn.
10. Xây dựng Markdown Report Generator.
11. Chạy thử trên một repository không quan trọng.
12. Kiểm tra diff và test bằng người thật trước khi merge.

------------------------------------------------------------------------

## 9. Các rủi ro cần kiểm soát

  Rủi ro                             Cách giảm thiểu
  ---------------------------------- ------------------------------------------------
  Agent sửa ngoài phạm vi            Plan, giới hạn workspace, review diff
  Agent chạy command nguy hiểm       Permission policy, allowlist, sandbox
  Test không đầy đủ                  Yêu cầu test plan và kiểm tra coverage phù hợp
  Vòng lặp sửa lỗi vô hạn            Giới hạn số lần retry, token và thời gian
  Job bị gián đoạn                   Lưu execution state và log
  Hai job xung đột source            Workspace/container riêng
  Lộ secret                          Không đưa secret không cần thiết vào agent
  Chi phí tăng cao                   Budget, quota và usage tracking
  Workflow thay đổi làm sai job cũ   Version hóa workflow
  Agent tự ý deploy                  Approval bắt buộc

------------------------------------------------------------------------

## 10. Kết luận và thứ tự ưu tiên

Thứ tự triển khai được khuyến nghị:

1.  **Coding Agent MVP:** Chứng minh agent có thể hoàn thành một nhiệm
    vụ coding thực tế.
2.  **Multi-Agent:** Tách planner, coder, tester và reviewer khi cần.
3.  **Management Backend:** Quản lý project, job, workflow và execution.
4.  **Workflow Builder:** Cho phép người dùng tự thiết kế flow.
5.  **Execution Infrastructure:** Docker sandbox và worker.
6.  **Monitoring & Evaluation:** Theo dõi chất lượng, log và chi phí.

Điểm quan trọng nhất là không bắt đầu bằng việc xây dựng một Workflow
Builder thật đẹp khi phía sau chưa có agent làm được việc.

Hãy xây dựng một coding agent đáng tin cậy trước. Khi agent đã hoạt động
tốt, việc đưa nó vào một nền tảng quản lý job và workflow sẽ có cơ sở
vững chắc hơn.
