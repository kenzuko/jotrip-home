# Near Me - batch 2026-09-27b (23 điểm cộng đồng)

Tập nguồn: 208 POI ứng viên OSM trong `OPENPQ_NEARME_TINH_GON_KHOI_QUAN_TRONG_CHO_DUYET_2026-09-25.xlsx`, đối chiếu với các file `research/near-go/2026-09-26/{prior-nearme,osm-nearme-extra}.json` và 89 POI OSM đã phát hành. Trong 119 mục còn thiếu so với dữ liệu canonical, đã chọn **23 POI có ID, tên, vị trí OSM, nguồn truy vết**, ưu tiên các nhu cầu thường nhật và vùng còn ít kết quả. Mỗi POI có `verified=false`, `operational_status=UNKNOWN`, `publication_status=COMMUNITY_CANDIDATE`.

Cấu trúc batch: **5 cây xăng, 7 điểm điện thoại/SIM/điện máy, 3 ATM, 2 tiệm giặt ủi, 6 minimart/siêu thị**. Nhóm PHONE_SIM được đưa tạm vào `ELECTRONICS`, nhóm SUPERMARKET vào `MINIMART` để tương thích UI hiện tại mà không mở danh mục mới chưa có lọc/CTA. Sheet vẫn giữ nhóm gốc để tách category khi UI sẵn sàng.

Phân bố dựa trên tọa độ OSM: An Thới 4, Bắc Đông đảo 1, Gành Dầu/Bắc đảo 4, Dương Đông/Cửa Dương 8, Dương Tơ/Bãi Trường 6. 100% có tọa độ OSM nhưng **không hồ sơ nào có cổng đã khảo sát**; không dùng để xếp khoảng cách GPS xác thực hoặc xác nhận cơ sở đang mở.

Giữ ngoài đợt này: Thế Giới Di Động OSM Gành Dầu ở rất gần Điện Máy Xanh (khoảng 20m), cần phân biệt có 2 cửa hàng hay POI chung; Petrolimex OSM gần Mỹ Anh khoảng 50m; trạm KTC Gành Dầu trùng chính pin Nhi Phụng; POI Shell chưa có chứng cứ thương hiệu hiện tại; ATM tại casino chưa rõ quyền vào công cộng. Dữ liệu nhà thuốc chưa đủ giấy phép, WC/bãi đỗ chưa rõ công cộng và văn phòng công ty vẫn giữ riêng, không auto-publish.

**Release gate:** source ODbL trích xuất công khai phải tăng từ 89 lên **112 POI**; location-index phải từ 315 lên **338 tài liệu (149 utility)**; map coverage từ 187/359 lên **210/382**, missing 172 giữ nguyên; V3 và Visual QA kiểm đủ chức năng cũ trước khi merge. Sheet V3 sẽ cập nhật batch mới với đường dẫn nguồn và nhãn review minh bạch.
