# Open Phu Quoc - Public Trust Gate, 26/09/2026

## Mục đích

Open Phu Quoc là tiện ích độc lập dành cho người dân và du khách. Chất lượng thông tin, sự an toàn và quyền tự quyết của người dùng đứng trước mọi lợi ích quảng bá. Việc Kiến Xây hỗ trợ vị trí đặt QR không tạo ưu tiên tìm kiếm cho Kiến Xây; JoTrip cũng không được ưu tiên mặc định.

Đây là tiêu chuẩn chuẩn bị thử nghiệm QR, KHÔNG phải xác nhận đã đạt hoặc đã được triển khai. Không thay đổi DNS, production hay logic chuyên sâu đã ổn định của Weather/Airport.

## Ảnh chụp mã nguồn tại thời điểm lập tài liệu

- `data/entities/destination-venues.json`: 10/10 venue ACTIVE có tọa độ, nguồn tham chiếu và ngày kiểm tra venue. Cả 10 chưa có trọn bộ bằng chứng tọa độ: `coordinate_precision`, `coordinate_source_ref`, `coordinate_source_type`, `coordinate_observed_at`, `coordinate_confidence`. Không suy ngày kiểm tra venue là ngày kiểm tra cổng vào.
- Tập venue CMS này hiện là các điểm tham quan. Không sử dụng 32 entity món ăn trong `data/entities/food.json` để suy ra món đang bán tại quán cụ thể.
- CMS hiện có hàng đợi kiểm tra tọa độ, nguồn venue và quan hệ món-quán. Các quy tắc này chưa tương đương một chuẩn phát hành an toàn cho toàn bộ hệ thống.
- Các PR GO, Near Me và nội dung đang mở vào ngày 26/09 là các bản nháp riêng. Không coi việc CI pass là đã được xuất bản hoặc đã đạt QA thực địa.

## P0 - điều kiện bắt buộc trước khi đặt QR công khai

1. **Thông tin vận hành:** Mỗi thẻ về cano, tàu cao tốc, phà, chuyến bay và thời tiết phải tách `observed_at`, `source_updated_at`, `fetched_at`. Thiếu dữ liệu hoặc quá hạn thì hiển thị chưa xác nhận; không suy cano từ dự báo hoặc từ trạng thái tàu/phà. So sánh trang chủ và trang chi tiết trên cùng ngày.
2. **Pin và chỉ đường:** Với mỗi kết quả đề xuất có hành động chỉ đường, kiểm tra loại pin (cổng vào/tâm khu vực/tham khảo), nguồn và thời điểm quan sát. Pin chưa xác minh không được mô tả như cổng vào chính xác; mở Google Maps theo tên và địa chỉ khi chưa có tọa độ đủ tin cậy.
3. **Nội dung và ảnh:** Mọi thông tin có thể thay đổi (giờ mở, giá, lịch, tình trạng hoạt động) được kiểm tra tại nguồn vận hành; bài biên tập chỉ mang ngữ cảnh. Không giả chuyện đã trải nghiệm, không gắn ảnh nơi khác như ảnh thật của địa điểm, không dùng ảnh thiếu quyền sử dụng.
4. **Độc lập:** Kết quả tìm kiếm/gợi ý không ưu tiên nhà tài trợ hay đơn vị cùng chủ sở hữu. Nội dung tài trợ nếu có phải gắn nhãn riêng. Mã QR Kiến Xây chỉ dùng đo lượt vào tổng hợp theo chi nhánh, không điều chỉnh thứ tự gợi ý.
5. **An toàn khi phát hành:** Lỗi nghiêm trọng còn tồn tại không được đánh dấu hoàn tất hay ẩn khỏi bảng quản trị. Chỉ tự loại bỏ công việc khi điều kiện sinh lỗi đã được sửa tại nguồn. Mọi thay đổi cần đi qua PR, bài kiểm thử và khả năng quay lại bản trước.

## P1 - nghiệm thu trải nghiệm

- Di động 390x844 và 430x932; desktop 1366x768 và 1440x900. Không tràn ngang, nút chính dễ bấm, chữ đủ đọc, ảnh đúng nội dung và không khiến trang tải chậm quá mức.
- Mục tiêu đo ban đầu: p75 LCP <= 2,5 giây với mạng 4G thông thường và máy tầm trung. Đây là ngưỡng cần đo, không phải số liệu hiện có.
- Hỗ trợ phiên dùng không tài khoản; không yêu cầu GPS để khám phá. Nếu từ chối GPS, vẫn chọn vùng thủ công và có chỉ đường theo tên/địa chỉ.
- Các đường chuyển giữa Search, GO, Near Me, bản đồ và thông tin vận hành phải giữ đúng vùng đã chọn, nhưng không ghi tọa độ GPS chính xác vào URL.
- Tiếng Việt và tiếng Anh chỉ được quảng bá là hỗ trợ sau khi kiểm tra đủ các luồng thực tế, không căn cứ vào sự hiện diện của nút chọn ngôn ngữ.

## Thử nghiệm Kiến Xây

Bắt đầu tại một hoặc hai chi nhánh, với QR khác nhau để thống kê tổng hợp. Tình huống kiểm thử: khách lần đầu đến đảo vừa ăn xong, còn bốn tiếng, muốn biết đi đâu, đường đi, thời tiết và hoạt động còn kịp.

Thử ít nhất 20 người thuộc nhiều nhóm khách trên thiết bị thật. Mục tiêu nội bộ: ít nhất 80% hoàn tất nhiệm vụ chính trong 60 giây; không có thông tin sai nghiêm trọng về an toàn/vận hành/chỉ đường. Mẫu này chỉ phát hiện lỗi sử dụng, không phải nghiên cứu đại diện cho toàn bộ khách du lịch.

Nếu không đạt, sửa và kiểm tra lại. Chưa đặt QR đại trà cho đến khi đủ bằng chứng từ CI, QA giao diện, kiểm thử dữ liệu sống và thử nghiệm người dùng.

## Chủ sở hữu tiêu chuẩn

Tiêu chuẩn áp dụng ngang nhau cho các nhóm nội dung và đối tác. Người biên tập chịu trách nhiệm về ngữ cảnh và bằng chứng; nguồn chuyên trách chịu trách nhiệm về trạng thái vận hành; người quản trị chịu trách nhiệm về quyết định công bố và lưu vết.

## Hạng mục cần tiếp tục sau PR kỹ thuật này

- Chuẩn hóa nguồn/độ chính xác của 10 venue trước khi công bố pin như đã xác minh.
- Xem riêng mọi route có chỉ đường, bao gồm pin từ canonical location-index và tiện ích Near Me.
- Bổ sung kiểm tra ảnh/quyền sử dụng, nội dung động và source-freshness cho CMS quality queue.
- Rà soát các PR đang mở, hoàn tất CI và QA thực tế trước khi hợp nhất.
