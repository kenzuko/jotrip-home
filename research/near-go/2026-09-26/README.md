# Open Phu Quoc - đợt nhập Near Me và GO ngày 26/09/2026

## Mục tiêu
Chỉ giữ dữ liệu có giá trị trực tiếp cho cư dân và du khách. Địa chỉ, tên, nguồn và mức tin cậy được lưu ngay; GPS cửa vào hoàn thiện sau. Dữ liệu đang nghiên cứu nằm trong `research/`, không đi vào Cloudflare public bundle.

## Kho và kết quả
- 218 hồ sơ tiện ích từ bản tổng kho tinh gọn 260 (gồm 38 ID đã có trên canonical tại thời điểm đối chiếu).
- 70 hồ sơ OSM mới sau khi so trùng ID với 208 ứng viên tiện ích OSM đã nghiên cứu.
- 36 WC và 7 bãi xe chờ xác minh quyền sử dụng và lối vào.
- 83 bản ghi điểm đến/trải nghiệm dành cho việc mở rộng GO; không tự động tạo thêm lựa chọn GO nếu thiếu lịch/thời lượng.
- 52 hồ sơ nguồn nhà thuốc (gồm 5 Long Châu đã tồn tại và 3 Long Châu mới công bố).
- Riêng 134 trạm xe buýt OSM chỉ để đối chiếu Transit; không nhập lại thành pin Near Me.

## Danh mục đã chọn vào canonical trong nhánh
36 bản ghi thiết yếu, gồm 17 hồ sơ đã đối chiếu danh bạ/nguồn công bố và 19 POI cộng đồng chưa xác minh vận hành. Thành phần: 3 Long Châu, 7 cây xăng, 4 ứng viên sạc VinFast, 4 cơ sở y tế, 5 điểm điện thoại, 1 giặt ủi, 3 dịch vụ giữ hành lý đặt trước, 1 điểm ATM khu sân bay, 3 cửa hàng tiện lợi và 5 gara.

3 Long Châu mới có địa chỉ từ trang operator: Hàm Ninh, ĐT45 - ngã tư Nghĩa trang Liệt sĩ, 487 Nguyễn Trung Trực - Chợ Bến Tràm. Không tạo tọa độ hoặc tình trạng `OPEN` từ lịch giờ chung của chuỗi.

Cây xăng Petrolimex và 4 ứng viên sạc có tọa độ node OSM, lưu `verified=false`, `operational_status=UNKNOWN`, `map.precision=site_centroid`, không có giờ mở cửa giả định. Giao diện phải ghi rõ chỉ là vị trí tham khảo; không tính khoảng cách từ GPS OSM chưa xác minh. Sạc phải dẫn người dùng đến hướng dẫn chính thức VinFast/V-Green để kiểm tra điều kiện sử dụng và trạng thái trạm. Trạm xăng Petrolimex tại Nam đảo gần cây xăng Mỹ Anh và một điểm KTC Gành Dầu trùng pin Nhi Phụng **chưa nhập canonical** để tránh gắn nhầm cùng cơ sở.

## Quy tắc nguồn và xuất bản
- OPERATOR / REGULATOR mới: có thể đưa tên, địa chỉ vào danh bạ; không suy thành xác nhận đang mở, hết đóng hoặc còn chỗ.
- OSM: ghi rõ ODbL 1.0, `© OpenStreetMap contributors`, URL đối tượng, thời điểm 25/09/2026; không khẳng định đúng cổng, giờ hay quyền truy cập. Trước khi phát hành cần rà nghĩa vụ ODbL với dữ liệu phát sinh.
- Danh bạ cũ/GPP duy trì: giữ kho nghiên cứu, không suy thành giấy phép hiện còn hiệu lực hoặc `OPEN`. Hồ sơ thu hồi giấy phép và tên trùng nằm trong `pharmacy-blocklist.json`.
- GPS thiếu: danh bạ vẫn giữ bản ghi nhưng chỉ mở Google Maps theo tên/địa chỉ hoặc gắn vị trí OSM là **tham khảo**; không suy tọa độ từ trung tâm khu.
- Giữ nhận xét khách ở lớp đề xuất/cần kiểm chứng, không tự cho phép feedback sửa địa chỉ hay trạng thái đang mở.

## Hạn chế trước khi merge
1. Derived map cũ có 123 hotel pins, trong khi canonical hiện chỉ có 63 khách sạn có tọa độ. Lệnh xây dựng lại sẽ không khôi phục 60 pin đã bị bỏ khỏi canonical. Đây là thay đổi độ phủ bản đồ cần QA, không tự coi tất cả pin cũ là đúng.
2. Index cũ có pin Long Châu Suối Đá trùng Gành Dầu. Index mới chỉ giữ pin Long Châu Nguyễn Trung Trực đủ nguồn; các chi nhánh khác vẫn tìm được theo địa chỉ nhưng không gắn GPS không xác minh.
3. GO engine vẫn 17 lựa chọn, chưa biến 83 hồ sơ nghiên cứu thành hoạt động thiếu lịch.
4. Chạy workflow validation, kiểm tra cả tính năng cũ Near Me / GO, tìm kiếm, CMS và hành vi hiển thị ứng viên trước khi merge; không đẩy production bằng PR này.

Nguồn: bộ Excel tinh gọn 25/09/2026, hồ sơ nhà thuốc 26/09/2026, trang nhà thuốc Long Châu chính thức, POI OSM ngày 25/09/2026, website VinFast/V-Green.
