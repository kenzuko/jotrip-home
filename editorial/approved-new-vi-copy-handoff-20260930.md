# OPEN PHU QUOC - BẢN DUYỆT CHỈ BỔ SUNG NỘI DUNG MỚI - 30/09/2026

## Phạm vi được phép

Bộ **150 bài Cẩm nang đã được duyệt trước đó** được đóng băng trong lần này. Không xuất lại, không viết lại và **không chỉnh `data/knowledge/objects.json`**, stories hoặc food.

Chỉ đưa các phần được chủ dự án gửi và duyệt thêm vào nguồn tiếng Việt:

- **Khám phá:** 27 thẻ địa điểm + 12 thẻ trải nghiệm, các câu Hợp khi / Trước khi đi, các nhãn Chọn nhanh và chữ trên trang.
- **Cẩm nang:** chữ giới thiệu giao diện, ba vùng, khách sạn và món ăn, dữ liệu gợi ý nơi ở và lịch trình, 8 ô tình huống và câu trả lời khi bấm.
- **HTML/JS trực tiếp:** Hero của /guide và /explore, fallback tĩnh và 8 câu trả lời trong /guide. Không đổi mã bộ lọc, điều hướng hoặc liên kết.

## Các chỉnh sửa nhỏ theo phản hồi đã duyệt

Chỉnh đúng các lỗi từng phát hiện về thuật ngữ, thông tin và khả năng gây hiểu nhầm, gồm: Safari (quy mô Việt Nam), VinWonders (không chốt giờ ngừng trò chơi chung), Rạch Vẹm (nước nông không bảo đảm an toàn), Dinh Cậu (câu thiếu 'ở' và không gán nhãn di tích chưa kiểm chứng), Chợ Dương Đông (bỏ khẳng định cung cấp chính), Suối Tiên (không khẳng định hướng khi chưa xác minh), chó xoáy (giống chó bản địa), Bãi Khem (phân biệt lối xuống bãi với tiện ích resort), Aquatopia (không mô tả là nơi tránh nắng), Cầu Hôn (vé lẻ/combo), mùa vụ vườn tiêu, scuba, seawalker, vùng câu cá, tour 3 đảo và cách diễn đạt linh hoạt thời tiết/giá/visa/khoảng cách di chuyển.

- **Bản gia đình 3N2Đ:** dùng phiên bản gửi sau trong phần lịch trình, đồng bộ giữa `guide/data.json` và `data/itineraries.json`; ngày về phải xét giờ bay.
- **BX2/FX2:** không khẳng định điều kiện tối thiểu 2 đêm áp dụng cho mọi gói; kiểm tra từng hợp đồng.
- **Sắc Màu Venice:** bài giới thiệu không gợi ý đi xem lúc show đang tạm dừng. Không đóng cứng ngày mở lại trong nội dung lâu dài. Hiển thị cảnh báo từ nguồn vận hành riêng.

## Giữ nguyên kỹ thuật

Không đổi ID, slug, tọa độ GPS, mức chính xác GPS, địa chỉ, giá tham chiếu, lịch vận hành, nguồn nghiên cứu, quan hệ entity, cấu trúc API, nhãn tình trạng xuất bản, nguồn thực địa, trạng thái weather/airport/transit hoặc dữ liệu của 150 bài đã duyệt.

Các thay đổi lên `data/views/place-planning-levels.json` là nội dung gợi ý biên tập dành cho hiển thị, **không thay level, entity_id hoặc quy tắc xếp nhóm**.

## Các điểm phải kiểm tra trước merge

1. **Visual QA mobile và desktop:** tiêu đề dài, 8 câu trả lời tình huống dài, số dòng trên thẻ Khám phá và thanh thông tin.
2. **Thông báo vận hành:** `data/operational-notices.json` đang chứa thông báo Sắc Màu Venice tạm dừng từ 28/09/2026 và 2 thông báo bảo trì Exotica. Website chính của VinWonders vẫn có trang giới thiệu lịch show thông thường; không dùng trang giới thiệu đó để ghi đè thông báo tạm ngưng. Đối chiếu thêm nếu có thông báo mới trước merge.
3. **Suối Tiên:** hướng và lối vào công khai chưa xác minh; không tạo pin giả.
4. **Đa ngôn ngữ:** chỉ áp dụng tiếng Việt mới trong PR này; rà bản dịch và localization sau khi chốt tiếng Việt, không tự đẩy dữ liệu mới chưa duyệt sang các locale khác.
5. **Điều kiện BX2/FX2:** xác nhận nhà cung cấp theo chương trình cụ thể, không gán điều kiện tuyệt đối.

## Trạng thái

Nhánh ứng viên, chưa merge vào main, chưa deploy Cloudflare. CI và visual QA phải đạt trước khi lên production. Nếu main thay đổi, đối chiếu latest main trước khi merge.
