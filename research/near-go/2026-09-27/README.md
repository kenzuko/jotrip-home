# Near Me expansion - 27/09/2026

Đợt đầu **59** hồ sơ được nhập ở PR #120. Đợt này lọc thêm **47** điểm OSM từ backlog ngày 25/09/2026: 13 ATM, 10 ngân hàng/điểm giao dịch, 16 cửa hàng thiết yếu, 2 bưu cục/chuyển phát, 4 cây xăng, 1 điểm sửa xe và 1 cửa hàng điện thoại/điện máy.

Phân bố: 16 khu Dương Đông, 10 khu Bãi Trường/bờ Tây, 9 khu Gành Dầu, 2 khu Bắc đảo khác, 8 khu Nam đảo, 2 khu Hàm Ninh/Đông đảo. Hàm Ninh chưa có zone Near Me riêng, nên đặt `zone_id=null` và tìm qua địa chỉ/toàn đảo. Không tự gắn nhầm sang bờ Tây.

Không nhập thêm nhà thuốc chưa đối chiếu giấy phép, cây xăng quá gần địa điểm khác chưa thể tách biệt, cửa hàng chỉ bán online, WC/bãi xe chưa rõ quyền vào, hoặc trạm sạc chưa có POI mới. Tuyển dụng WinMart+ năm 2026 cho thấy chuỗi đang mở rộng trên đảo nhưng không chứng minh chính xác từng địa chỉ, nên chỉ giữ làm đầu mối nghiên cứu.

Tất cả 47 địa điểm có `verified=false`, `operational_status=UNKNOWN`, `publication_status=COMMUNITY_CANDIDATE`; `map.precision=site_centroid` mang nghĩa điểm cộng đồng tham khảo. Không gán giờ, khả dụng, khả năng rút tiền hoặc cổng vào.

Bản trích xuất công khai `data/open/osm-nearme-phuquoc-2026-09-25.json` cập nhật thành 89 POI, ghi © OpenStreetMap contributors, ODbL 1.0, và URL từng node/way. Hồ sơ đang nghiên cứu trong `research/` không đi vào bộ dữ liệu xuất bản.

Ưu tiên xác minh địa điểm chính thức mới: sạc, cây xăng vùng xa, ATM ngoài resort và WinMart+ trên đảo.
