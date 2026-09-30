# CÁC MODULE VẬN HÀNH - WEATHER_AIRPORT_TRANSIT

**CHỈ RÀ CHỮ HIỂN THỊ.** Những module này có hệ thống dữ liệu và các luồng UI khác đang được nâng cấp. Không tự sửa dự báo, thông số, cập nhật trực tiếp, trạng thái tàu/chuyến bay, cảnh báo, nguồn hay API. Mục nào đã duyệt ở luồng module riêng thì ghi GIỮ NGUYÊN.

## weather/index.html

### 1. Nhãn hiển thị

Thời tiết & Biển

### 2. Nhãn hiển thị

Phú Quốc · Dự báo JoTrip

### 3. Nhãn hiển thị

TIN NHANH · TOÀN ĐẢO

### 4. Nhãn hiển thị

Hiển thị tối đa 6 mục trước; mở rộng để xem các cảnh báo còn lại. Quan trắc, tín hiệu ngắn hạn và dự báo mô hình được ghi riêng. Khi dữ liệu mất kết nối, không coi là thời tiết an toàn.

### 5. Nhãn hiển thị

Chọn một điểm, các mục bên dưới sẽ cùng hiển thị theo điểm đó.

### 6. Nhãn hiển thị

Xem thời tiết hiện tại và các mốc còn lại trong ngày tại điểm bạn chọn.

### 7. Tiêu đề

Dương Đông

### 8. Đoạn giải thích

Đang cập nhật quan trắc và phân tích tại Phú Quốc...

### 9. Nhãn hiển thị

mm/h · ước tính tại điểm

### 10. Nhãn hiển thị

km/h · JoTrip

### 11. Nhãn hiển thị

Đang tìm số liệu có nguồn

### 12. Nhãn hiển thị

m Hs · mô hình biển

### 13. Tiêu đề

Bạn đang thấy thực tế thế nào?

### 14. Đoạn giải thích

Phản hồi sẽ gắn với điểm bạn đang xem.

### 15. Nhãn hiển thị

Mưa nhiều hơn

### 16. Nhãn hiển thị

Mưa ít hơn

### 17. Nhãn hiển thị

Gió mạnh hơn

### 18. Nhãn hiển thị

Gió yếu hơn

### 19. Nhãn hiển thị

JoTrip không nhận vị trí GPS của bạn. Phản hồi chỉ gắn với điểm đang xem.

### 20. Tiêu đề

Mưa gió những giờ còn lại

### 21. Đoạn giải thích

Đang đọc các mốc thời tiết còn lại hôm nay...

### 22. Nhãn hiển thị

Sóng nền hiển thị riêng theo chu kỳ biển, không thay cho dự báo sóng từng giờ.

### 23. Nhãn hiển thị

Dự báo JoTrip · ECMWF · mốc 3 giờ

### 24. Tiêu đề

Đang đo được gì ngoài kia?

### 25. Nhãn hiển thị

Số đo từ các trạm đang hoạt động giúp bạn so sánh với dự báo JoTrip.

### 26. Tiêu đề

Quan trắc thực tế

### 27. Nhãn hiển thị

ĐANG TẢI

### 28. Nhãn hiển thị

Mưa quan trắc: trạng thái có/không mưa dựa trên chênh lệch giữa hai mẫu đo liên tiếp. Lượng mưa ghi bằng mm trong đúng cửa sổ quan trắc; cường độ được quy đổi về mm/h theo chuẩn biến quan trắc WMO.

### 29. Tiêu đề

Lên kế hoạch 10 ngày

### 30. Nhãn hiển thị

Xem xu hướng để lên kế hoạch; hãy kiểm tra lại khi gần ngày đi.

### 31. Tiêu đề

10 ngày tới theo khu vực

### 32. Đoạn giải thích

Ba ngày đầu có nhiều mốc dự báo hơn. Từ ngày thứ tư, hãy xem đây là xu hướng và kiểm tra lại khi gần ngày đi.

### 33. Đoạn giải thích

Các mốc dưới đây lấy trực tiếp từ Dự báo JoTrip tại điểm đang chọn.

### 34. Tiêu đề

Radar & bản đồ

### 35. Nhãn hiển thị

Khi có mưa hoặc mây đối lưu, dùng bản đồ để nhìn vị trí và hướng di chuyển.

### 36. Tiêu đề

Mưa đang ở đâu?

### 37. Tiêu đề

Thời tiết toàn đảo theo không gian

### 38. Nhãn hiển thị

Thông tin mây

### 39. Nhãn hiển thị

Himawari IR

### 40. Nhãn hiển thị

Windy Gió

### 41. Nhãn hiển thị

Windy Mưa

### 42. Nhãn hiển thị

Windy Sóng

### 43. Nhãn hiển thị

Ảnh Himawari cho biết độ cao và nhiệt độ đỉnh mây, qua đó giúp theo dõi mây đang phát triển ra sao. Ảnh này không cho biết xác suất mưa hay sét.

### 44. Nhãn hiển thị

Nguồn đối chiếu

### 45. Tiêu đề

Các con số thời tiết nói gì?

### 46. Đoạn giải thích

Mưa, gió, sóng, bụi và thủy triều là những tín hiệu riêng. Xem từng chỉ số cùng giờ cập nhật và khu vực áp dụng.

### 47. Đoạn giải thích

Đây là hướng dẫn cách đọc các chỉ số, không phải cảnh báo theo thời gian thực. Nếu định ra biển, hãy xem cùng lúc gió, sóng và khuyến cáo trong ngày.

### 48. Nhãn hiển thị

XEM SÂU HƠN Phân tích kỹ thuật theo điểm 72 giờ, dự báo theo điểm, gió/biển nâng cao, tổng hợp nhiều mô hình, AQI, triều và độ tin cậy nguồn

### 49. Nhãn hiển thị

Đổi điểm để xem toàn bộ phân tích kỹ thuật tương ứng.

### 50. Nhãn hiển thị

Tự đi theo điểm đã chọn ở đầu trang.

### 51. Tiêu đề

Biểu đồ theo điểm

### 52. Nhãn hiển thị

Phần này dành cho ai muốn xem diễn biến chi tiết và mức chênh lệch giữa các dự báo.

### 53. Tiêu đề

Gió 72 giờ

### 54. Nhãn hiển thị

72 giờ tới · Giờ Phú Quốc UTC+7

### 55. Nhãn hiển thị

🌡️ Nhiệt độ

### 56. Nhãn hiển thị

↕️ Triều

### 57. Nhãn hiển thị

Số liệu hiện tại và dự báo 72 giờ được trình bày riêng.

### 58. Nhãn hiển thị

Bảng số liệu gốc theo giờ (mở khi cần)

### 59. Tiêu đề

Chi tiết mô hình tại Dương Đông

### 60. Nhãn hiển thị

Đây là các thông số kỹ thuật của mô hình, không phải quan trắc trực tiếp.

### 61. Nhãn hiển thị

Gió và biển hiện tại - thông số mô hình

### 62. Nhãn hiển thị

m · giá trị ước tính khi cần

### 63. Tiêu đề

Tổng hợp nhiều mô hình & chi tiết vùng

### 64. Nhãn hiển thị

Xem dự báo chi tiết theo giờ

### 65. Nhãn hiển thị

JoTrip tính dự báo theo khu vực như thế nào?

### 66. Tiêu đề

AQI & bụi mịn

### 67. Tiêu đề

Triều & đổi nước

### 68. Nhãn hiển thị

Độ tin cậy thông tin

### 69. Tiêu đề

Nguồn & phần còn thiếu

### 70. Nhãn hiển thị

Giải thích các chỉ số kỹ thuật

### 71. Tiêu đề

Một hệ thống thời tiết được xây riêng cho Phú Quốc

### 72. Đoạn giải thích

JoTrip Weather là dự án thời tiết dành riêng cho Phú Quốc. Chúng tôi không lấy nguyên kết quả của một mô hình rồi hiển thị lại. Hệ thống tập hợp dữ liệu đo thực tế, radar - vệ tinh, các mô hình khí quyển và biển, sau đó đối chiếu chúng với điều kiện trên đảo để tạo ra lớp phân tích và dự báo riêng của JoTrip.

### 73. Tiêu đề

Cách chúng tôi xây hệ thống

### 74. Đoạn giải thích

Cách làm này lấy cảm hứng từ quy trình dự báo thời tiết hiện đại: trước tiên xây bức tranh hiện tại từ quan trắc mặt đất, radar và vệ tinh; sau đó mới kết hợp các mô hình số và dự báo tổ hợp để đánh giá những gì có thể xảy ra tiếp theo. NOAA/NWS cũng vận hành theo nguyên tắc nhiều lớp dữ liệu như vậy. JoTrip không phải NOAA và không sao chép hệ thống của NOAA - chúng tôi chỉ áp dụng cùng tư duy đó ở quy mô nhỏ, tập trung riêng cho điều kiện thời tiết rất đặc thù của Phú Quốc.

### 75. Đoạn giải thích

Dự án được mở miễn phí và không có kế hoạch thu phí. Nếu bạn đang ở Phú Quốc, một phản hồi ngắn về mưa, gió hoặc dông tại nơi mình đứng sẽ rất hữu ích để chúng tôi kiểm tra lại hệ thống. Nếu trang có ích, bạn có thể chia sẻ cho người khác cùng theo dõi và góp ý.

### 76. Nhãn hiển thị

Chia sẻ JoTrip Weather

## airport/index.html

### 1. Tiêu đề

Sân bay Phú Quốc

### 2. Đoạn giải thích

PQC · chuyến bay hôm nay

### 3. Nhãn hiển thị

VI EN 한국 RU 中文

### 4. Tiêu đề

Hôm nay tại Phú Quốc

### 5. Đoạn giải thích

Xem nhanh tình hình sân bay hôm nay.

### 6. Tiêu đề

Chuyến cần chú ý

### 7. Đoạn giải thích

Thay đổi đang còn hiệu lực

### 8. Tiêu đề

Bảng thông tin chuyến bay

### 9. Đoạn giải thích

Giờ bay dự kiến và thực tế, tình trạng chuyến, cửa khởi hành, quầy làm thủ tục và băng chuyền hành lý.

### 10. Nhãn hiển thị

Chuyến đi

### 11. Nhãn hiển thị

Chuyến đến

### 12. Tiêu đề

Chuyến bay hôm nay

### 13. Nhãn hiển thị

Tìm chuyến

### 14. Nhãn hiển thị

3 giờ tới

### 15. Nhãn hiển thị

Có thay đổi

### 16. Nhãn hiển thị

Xem thêm

### 17. Tiêu đề

Đừng vội chạy xuyên đảo.

### 18. Đoạn giải thích

Từ sân bay, thời gian di chuyển còn tùy giờ hạ cánh, hướng đi và nơi bạn ở.

### 19. Nhãn hiển thị

15-25 phút về Dương Đông

### 20. Nhãn hiển thị

Grand World và Sunset Town nằm ở hai hướng khác nhau.

### 21. Nhãn hiển thị

Chọn khu trước, chọn điểm sau.

### 22. Nhãn hiển thị

Chọn một ngày khám phá Bắc đảo, một ngày cho Nam đảo sẽ đỡ mất công chạy xe hơn.

### 23. Nhãn hiển thị

Cần hỗ trợ ở sân bay?

### 24. Nhãn hiển thị

Số hỗ trợ hành lý thất lạc và các số khẩn cấp được để cùng một chỗ.

### 25. Tiêu đề

Tình trạng cập nhật

### 26. Nhãn hiển thị

ĐANG KIỂM TRA

### 27. Đoạn giải thích

Đang kiểm tra nguồn và thời điểm cập nhật chuyến bay.

### 28. Nhãn hiển thị

⌂ Lúc này

### 29. Nhãn hiển thị

✈ Chuyến bay

### 30. Nhãn hiển thị

↻ Làm mới

## transit/index.html

### 1. Tiêu đề

Di chuyển

### 2. Đoạn giải thích

Tàu cao tốc · Phà · Xe buýt Phú Quốc

### 3. Nhãn hiển thị

Đang xem lịch từ các hãng...

### 4. Tiêu đề

Đi chuyến nào, lúc mấy giờ?

### 5. Đoạn giải thích

Chọn ngày đi để xem lịch của ngày đó. Lịch tháng chỉ giúp bạn tham khảo, không xác nhận chuyến sẽ chạy.

### 6. Nhãn hiển thị

ngày đã chọn

### 7. Nhãn hiển thị

Chưa có chuyến

### 8. Nhãn hiển thị

đang có lịch

### 9. Nhãn hiển thị

Tuyến Tất cả tuyến

### 10. Nhãn hiển thị

Hãng Tất cả hãng

### 11. Nhãn hiển thị

Tìm nhanh

### 12. Nhãn hiển thị

Tàu & phà

### 13. Nhãn hiển thị

Tàu cao tốc

### 14. Đoạn giải thích

Giờ chạy, hãng, tàu/phà và giá cho đúng ngày bạn chọn.

### 15. Tiêu đề

Theo đúng ngày bạn chọn

### 16. Tiêu đề

Chỉ kiểm tra khi cần.

### 17. Đoạn giải thích

Trang không hiển thị số ghế cụ thể. Khi bạn chọn Kiểm tra vé , trang chỉ báo mức chung như Còn vé / Còn ít / Hết vé và giờ vừa kiểm tra.

