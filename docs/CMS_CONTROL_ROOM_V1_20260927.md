# OPEN PHU QUOC CMS - CONTROL ROOM V1

Ngày: 27/09/2026
Trạng thái: Feature branch, chưa merge hoặc triển khai production.
Repo: kenzuko/jotrip-home
Branch: feat/cms-control-room-v1-20260927

## Mục tiêu

Nâng cấp Admin thành bàn làm việc cùng ADN với Open Phu Quoc: màu Sea Ink,
nền giấy sáng, logo gốc, chữ đủ đọc, ưu tiên thao tác thực tế. Mỗi lần mở CMS,
người quản trị thấy việc cần xác minh, PR đang chờ và bản nháp ngay trên thiết bị.

Đây là lớp điều phối giao diện, không phải engine vận hành mới.

## Những gì V1 làm

- Mặc định mở /admin/ vào Bàn làm việc, vẫn giữ deep link ?module=... hiện tại.
- Dashboard chỉ đọc GET /api/cms/quality và GET /api/cms/reviews, tải song song,
  có xử lý lỗi độc lập. Không tự tải Analytics vì endpoint có thể đồng bộ nguồn.
- Hiển thị số việc chưa xử lý, số đề xuất CMS mở, số bản nháp localStorage theo tài khoản.
  Không biến lỗi nguồn thành số 0; không gọi dữ liệu mô phỏng là live.
- Điều hướng phân nhóm theo read permission của cms/schema.json; Analytics chỉ dành cho admin.
- Mỗi việc có thể mở đường dẫn tới module, hồ sơ và trường nếu phù hợp.
- Khi rời module đang sửa: lưu nháp trên thiết bị trước khi hỏi xác nhận.
  Nếu SHA của bản nháp khác GitHub, giữ bản nháp nhưng không tự áp dụng.
- Chặn kết quả tải module cũ ghi đè giao diện module mới sau khi đổi mục nhanh.
- Trang Cần kiểm chứng và Hàng đợi duyệt dùng cùng logo và điều hướng CMS.
- CSS riêng cho Control Room và hai trang phụ, không đổi stylesheet public.

## Ranh giới bất biến

- Không ghi trực tiếp vào main, không tự merge PR, không cập nhật DNS/production.
- Giữ nguyên cơ chế GitHub OAuth, cookie HttpOnly, whitelist module và quy trình
  tạo PR của backend. Frontend không giữ token mới.
- Không chỉnh logic Weather, Airport, Transit, Cano, GO, Near Me và không sao chép
  dữ liệu vận hành sang hệ thống thứ hai.
- Không sử dụng Analytics như phép đo live tổng hợp nếu chưa có source/freshness.
- Danh sách nguồn lỗi của Quality là tín hiệu rule engine, không phải toàn bộ
  thực tế trên đảo. PR đã merge không đồng nghĩa đã xác nhận triển khai.
- Bản nháp localStorage không đồng bộ giữa các thiết bị và không phải bản sao lưu dài hạn.

## Kiểm thử và phát hành

- Unit: node scripts/test-cms-control-room.mjs
- Browser có mock backend: node scripts/visual-qa-cms-control-room.mjs
- Workflow riêng: .github/workflows/cms-control-room-qa.yml (PR)
- Kiểm tra desktop 1440x900, mobile 390x844, không overflow, quyền editor/admin,
  điều hướng tới editor, trạng thái lỗi một nguồn, không có POST khi tải dashboard.
- Tiếp tục chạy V3 Validation trên PR. Không merge khi một check bắt buộc còn đỏ.
- Sau khi owner duyệt PR và Cloudflare quyền triển khai được xác minh mới xét merge
  và kiểm tra source SHA trên cms.openphuquoc.com.
- Cloudflare Pages preview phải được bảo vệ nếu mở quyền truy cập bên ngoài;
  QA CI chỉ dùng static server localhost và mock APIs.
- Không diễn giải "đã merge" hay "upload thành công" thành "đã xuất bản" trước live QA.

## Mở rộng sau V1

- Xem trước bản nháp thực sự theo nội dung PR (không dùng link live để giả preview).
- Danh sách bài viết theo bản ghi và tìm kiếm xuyên module với contract riêng.
- Tình trạng deploy đối chiếu SHA, nhật ký thay đổi và cảnh báo theo nguồn.
- Cross-device draft chỉ khi đã thiết kế quyền, khóa và xử lý xung đột an toàn.
