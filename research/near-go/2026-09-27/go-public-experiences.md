# GO public-experience curation - 27/09/2026

Đối chiếu 83 hồ sơ nghiên cứu cũ với GO đang chạy: phần lớn đã tồn tại trong canonical hoặc thuộc Transit/các dịch vụ chưa có lịch theo ngày. Không biến 83 hồ sơ thành 83 gợi ý GO để tránh lặp/trá hình số liệu.

3 lựa chọn mới có thể gợi ý có điều kiện:
- **Sunset Town - dạo khu phố mở**: đã có lịch mở không gian công cộng từ nguồn operator ngày 21/09/2026; 75 phút tham quan, không hàm ý Cầu Hôn, show hoặc nhà hàng mở cùng giờ. Sun World xác nhận các hoạt động Thị trấn Hoàng Hôn vẫn mở ngay khi cáp và Aquatopia đóng bảo trì tháng 3/2026: https://sunworld.vn/vi/hon-thom/tin-tuc-sunworld/thong-bao-tam-ngung-mot-so-dich-vu-tai-dao-hon-thom-de-bao-tri-he-thong-cap-treo-17744
- **Bãi Trường - hoàng hôn**: 15:00–18:00 chỉ là khung ngắm cảnh gợi ý, không phải giờ mở cửa bãi biển hay quyền xuống bờ qua resort. Cần thời tiết và lưu ý đoạn đường/bãi cụ thể; `map.precision=area_anchor`, không được gọi là cổng bãi.
- **Cửa Cạn - làng/sông**: 08:30–17:00 chỉ là gợi ý tham quan cảnh ven sông; không ngụ ý kayak, đường thuyền, hoặc khu vực ven bờ riêng tư có thể vào. Đặc khu Phú Quốc công bố giới thiệu sông và làng Cửa Cạn tháng 9/2026: https://phuquoc.angiang.gov.vn/cua-can-dong-song-tho-mong

**Không đưa vào GO lúc này**: Aquatopia/Exotica vì GO chưa buộc chuyến cáp đi và về riêng cho trải nghiệm phụ trên đảo; nhà tù/điểm suối vì chưa có giờ đón khách 2026 được xác nhận; Hàm Ninh vì chưa có zone Đông đảo/travel matrix riêng, không được gán giả bờ Tây; Rạch Vẹm còn cần độ chắc đường vào và thời tiết theo mùa.

Chỉ chỉnh `data/go-config.json`; giữ 17 tùy chọn cũ, thêm 3 = **20**. Không đổi động cơ quyết định, không thay bản đồ/cổng hoặc logic thời tiết/cano/phà. `scripts/test-go-engine.mjs` kiểm thử cả ba trường hợp thực và nhãn cảnh báo.