# OPEN PHU QUOC CMS - EDITOR WORKFLOW V1.3

Ngày: 27/09/2026 | Repo: \`kenzuko/jotrip-home\` | Phạm vi: CMS Admin
Chủ dự án đã đồng ý triển khai V1.3. Chỉ dùng nhánh chuyên biệt và PR; không đụng
engine /weather, /airport, /transit, Marine, GO, Near Me, DNS hay build settings.

## Những vấn đề được giải quyết

**1. Xem bài chưa xuất bản** - Mỗi bài trong CMS có nút "Xem bài đang soạn".
Bản xem trước dựng trực tiếp từ \`currentData\` trên trình duyệt, gồm tiêu đề,
mô tả, mở bài, các đoạn, ảnh và nguồn. Có nhãn "ĐANG XEM BẢN THẢO".
Đây là bố cục editorial mô phỏng, không phải bản sao pixel của trang công khai
và tuyệt đối không gửi bản nháp ra API. Nút "Trang đã công bố" cũ được giữ
riêng với giải thích rằng chưa bao gồm những thay đổi đang sửa.

**2. Bản lưu riêng từng bài** - Hệ thống V1.3 bổ sung những checkpoint nằm
trong localStorage với khóa theo login / article ID / Git blob SHA. Snapshot
chỉ được tạo cho bài có ID không trùng. Bài mới chưa có ID vẫn được lưu trong
bản nháp toàn module hiện hữu, không khôi phục qua chỉ số mảng có thể thay đổi.
Khi mở lại, editor có thể chọn khôi phục đúng bài, tải JSON hoặc xóa một
checkpoint sau xác nhận. Chỉ phục hồi tự động nếu SHA hiện hành và phiên bản
bài gốc đều khớp. Khác phiên bản chỉ cho tải JSON để đối chiếu thủ công.
Khi PR tạo thành công, xóa đúng checkpoint chứa dữ liệu đã gửi; bản lưu cũ
không liên quan được giữ lại.

**3. Cảnh báo xung đột trước PR** - Endpoint GET-only
\`/api/cms/edit-state?path=...\` kiểm tra phiên bản SHA hiện tại và
các PR do CMS tạo còn mở đang sửa **cùng tệp JSON**. Phân quyền lại dựa trên
\`cms/users.json\` tại mỗi lần đọc, yêu cầu phiên đăng nhập mã hóa hiện hành.
Chỉ truy vấn đường dẫn có trong allowlist; tối đa 20 CMS PR, tối đa ba
truy vấn danh sách tệp song song. Nếu GitHub trả về nhiều trang hoặc không
thể kiểm tra hết, trả \`complete:false\` và chặn gửi duyệt từ UI. Backend
\`/api/cms/publish\` hiện hữu vẫn là cổng cuối với kiểm tra SHA và PR.

Sự kiện \`storage\` trên cùng trình duyệt báo khi tab khác lưu cùng module.
Tab hiện tại được lưu thành bản riêng thay vì ghi đè bản của tab kia;
yêu cầu người dùng tải JSON và đối chiếu. **Không tuyên bố phát hiện được
bản chưa gửi của người khác trên thiết bị khác**. Không tạo D1 lease,
không mở cơ chế lock dùng chung và không tự gộp hai bộ nội dung.

## Giới hạn và an toàn

- Bản nháp trong localStorage không phải cloud backup. Dữ liệu chỉ nằm
  trên trình duyệt / thiết bị hiện tại và có thể mất khi xóa dữ liệu duyệt web.
- Không gửi dữ liệu bản thảo qua công cụ bên thứ ba, không tự xuất bản.
- API edit-state trả Cache-Control private/no-store và không trả OAuth token.
- Không để lộ giá trị OAuth secret hoặc tài khoản trong URL/link báo lỗi.
- Mọi ảnh web trong modal chỉ chấp nhận HTTPS hoặc đường \`/assets/\`.
- PR chỉ được gửi khi preflight đọc đủ và SHA khớp. Backend vẫn có thể trả
  409 nếu nội dung thay đổi trong khoảng trễ sau preflight; phải giữ nháp.
- CMS đang dùng JSON theo **tệp**, không phải transaction theo record.
  Hai bài khác nhau trong cùng tệp vẫn có thể xung đột PR.

## Cổng QA, build và phát hành

- Một commit gộp gồm frontend Admin, endpoint GET-only, test và tài liệu.
  Không chỉnh workflows, trigger, Wrangler, tokens hoặc secrets.
- Tận dụng QA hiện có: \`scripts/test-cms-control-room.mjs\` gọi thêm
  \`scripts/test-cms-editor-workflow.mjs\` và
  \`scripts/test-cms-edit-state.mjs\`.
- Playwright mock: xác minh xem bài đang soạn và bản lưu thực tế; xung đột
  PR ngăn POST; iPhone không tràn ngang; bản demo tĩnh không gọi API CMS.
- Tĩnh: \`/admin/editor-workflow-preview.html\` dùng dữ liệu giả,
  rõ nhãn minh họa, noindex và không chạy OAuth.
- Cổng bắt buộc: 4 checks CI/Cloudflare thành công, hình ảnh desktop + mobile,
  xem diff chỉ CMS, PR ở trạng thái Draft khi chờ QA.
- Sau khi chủ dự án duyệt và release gate đạt mới merge vào main;
  xác nhận source SHA thực tế trên \`cms.openphuquoc.com\`.
- Rollback chỉ commit V1.3 với sự đồng ý của chủ dự án. Bản nháp vẫn
  thuộc quyền quản lý của trình duyệt người biên tập.
