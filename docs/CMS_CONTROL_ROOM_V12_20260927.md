# OPEN PHU QUOC CMS - CONTROL ROOM V1.2

Ngày: 27/09/2026. Phạm vi: frontend \`/admin\` trên nhánh riêng.
Trạng thái: chờ CI/QA và duyệt của chủ dự án, chưa merge production.

## Mục tiêu
Bàn làm việc cần giúp mở đúng hồ sơ nhanh, nhìn rõ việc đang làm và hạn xử lý.
Giữ ADN Open Phu Quoc - tiện ích rõ ràng trước, cảm xúc địa phương vừa đủ.
Không thiết kế thêm engine hoặc sao chép dữ liệu vận hành của hệ thống khác.

## Thay đổi V1.2
- Chỉ đọc các endpoint Quality và Reviews đang có.
- Hàng đợi được lọc phía trình duyệt: Tất cả / Ưu tiên / Đang làm /
  Của tôi / Quá hạn / Sắp hạn trong hai ngày lịch.
- Bộ lọc liên quan tới chủ việc và hạn xử lý chỉ bật khi API trả
  \`storage: "d1"\`. Nếu D1 chưa sẵn sàng, hiển thị thông tin thiếu
  thay vì báo con số 0 hoặc tạo cảm giác đã giao việc.
- Tên, mã hồ sơ, bằng chứng, bước tiếp theo, người phụ trách đều
  tìm được bằng ô tìm kiếm (hỗ trợ không dấu). Mặc định 5 việc,
  chỉ mở thêm từng nhóm 5 khi cần.
- Hạn xử lý được so sánh theo ngày lịch UTC+7, không theo múi giờ
  của máy người quản trị. Card hiện người phụ trách, quá hạn/sắp hạn.
- Liên kết FOOD_ARTICLE_GAP dựa trên \`rule_id\` từ Quality API,
  không đoán loại thực thể từ prefix ID. Các lỗi dữ liệu tổng quan
  không có hồ sơ cụ thể thì dẫn về trang Quality.
- Xem đề xuất đang mở cùng 3 PR CMS đã merge gần đây. Luôn ghi rõ
  merge chưa phải xác nhận đã triển khai và xuất hiện trên website.
- Toolbar biên tập đổi \`Xem website\` thành \`Trang đã công bố\`,
  ghi rõ các chỉnh sửa chưa gửi duyệt không có trong trang công khai.

## Quyền, dữ liệu và giới hạn
- Giữ nguyên GitHub OAuth, các quyền trong \`cms/schema.json\`,
  backend POST Quality và PR publishing. Dashboard không gửi POST.
- Khi D1 chưa nối, những dữ liệu owner/due được coi là không xác định.
  Không đặt giới hạn/đặt hạn trực tiếp từ dashboard; tác vụ này vẫn
  ở trang Quality với xác minh quyền và Origin tại backend.
- Bản nháp đang lưu tại trình duyệt, không đồng bộ giữa nhiều máy.
- Không giả preview nội dung PR bằng website đang public.
- Không đụng /weather, /airport, /transit, Cano, GO, Near Me,
  Wrangler, workflow, secrets, DNS hoặc cấu hình Cloudflare.

## QA và phát hành
- Gộp vào một commit trên nhánh chuyên biệt, một PR Draft.
- Unit: lọc D1, quyền xem, tìm kiếm không dấu, trang hóa, field
  deep-link đúng, API GET-only, thiếu D1 và demo zero-network.
- Browser Playwright: desktop/mobile, bộ lọc owner/due,
  tìm kiếm Enter, non-overflow và an toàn sidebar V1.1.
- V3 Validation, CMS Control Room QA, Cloudflare preview là
  cổng bắt buộc. Workers build phát sinh do trigger dự án hiện tại,
  không điều chỉnh trigger của luồng khác để tiết kiệm phút.
- Chỉ merge/deploy production sau khi chủ dự án duyệt bản xem trước;
  đối chiếu source SHA và kiểm tra lại live CMS sau đó.
- Rollback chỉ đúng commit V1.2 với sự đồng ý của chủ dự án.
