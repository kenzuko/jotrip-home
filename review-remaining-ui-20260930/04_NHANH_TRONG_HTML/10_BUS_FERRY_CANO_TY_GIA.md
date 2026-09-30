# CÁC MODULE VẬN HÀNH - BUS_FERRY_CANO_TY_GIA

**CHỈ RÀ CHỮ HIỂN THỊ.** Những module này có hệ thống dữ liệu và các luồng UI khác đang được nâng cấp. Không tự sửa dự báo, thông số, cập nhật trực tiếp, trạng thái tàu/chuyến bay, cảnh báo, nguồn hay API. Mục nào đã duyệt ở luồng module riêng thì ghi GIỮ NGUYÊN.

## bus/index.html

### 1. Tiêu đề

Xe buýt & xe trung chuyển

### 2. Đoạn giải thích

Phú Quốc · tuyến 17 · 19 · 20

### 3. Nhãn hiển thị

Đang xem...

### 4. Tiêu đề

Biết tuyến nào đi qua, / và xe đang gần đâu.

### 5. Đoạn giải thích

Lịch chạy và vị trí xe được tách riêng. Nếu chưa thấy vị trí xe từ VinBus, trang chỉ hiện lịch và không tự đoán xe đang ở đâu.

### 6. Tiêu đề

Vị trí xe trực tiếp

### 7. Đoạn giải thích

Đang xem VinBus có gửi vị trí xe lúc này không...

### 8. Tiêu đề

Tuyến 17

### 9. Nhãn hiển thị

Lịch từ VinBus

### 10. Đoạn giải thích

GPS từ OpenStreetMap là vị trí tham khảo. Với trạm hai chiều hoặc trạm chưa có pin, hãy xác nhận trên bản đồ VinBus trước khi tới. Dữ liệu bản đồ: © OpenStreetMap contributors (ODbL) .

### 11. Tiêu đề

Xe có gần điểm này không?

### 12. Đoạn giải thích

Chọn một trạm để xem xe gần nhất khi VinBus có gửi vị trí xe. Nếu chưa có, mình chỉ hiện lịch tuyến.

### 13. Tiêu đề

Xe trung chuyển nội khu

### 14. Đoạn giải thích

Nhóm tuyến phục vụ các khu nghỉ dưỡng và Phú Quốc United Center.

## ferry/index.html

### 1. Tiêu đề

Tàu & Phà

### 2. Đoạn giải thích

Phú Quốc · giờ chạy & tình hình vé

### 3. Nhãn hiển thị

Thạnh Thới · Superdong · Phú Quốc Express

### 4. Tiêu đề

Chọn tuyến trước, / rồi chọn hãng.

### 5. Đoạn giải thích

Chọn đúng ngày để xem giờ chạy, hãng và tình hình vé. Nếu hãng không công bố số ghế, trang cũng không tự đoán.

### 6. Tiêu đề

Đọc bảng này thế nào?

### 7. Đoạn giải thích

Mở bán nghĩa là hãng đang nhận đặt vé. Theo lịch chỉ nói chuyến có trong lịch, chưa chắc còn chỗ. Khi hãng có thông tin, Open Phu Quoc chỉ báo mức chung như Còn nhiều / Còn ít / Gần hết / Hết chỗ.

### 8. Tiêu đề

Cano, tàu cao tốc và phà được xem riêng.

### 9. Nhãn hiển thị

Đang xem tình hình hôm nay...

### 10. Nhãn hiển thị

Đang xem

### 11. Nhãn hiển thị

Cano được xem riêng

### 12. Nhãn hiển thị

Xem riêng cho hôm nay

### 13. Nhãn hiển thị

Tàu cao tốc

### 14. Tiêu đề

Lịch hôm nay

### 15. Đoạn giải thích

Chọn một chuyến để xem giờ, giá và mở trang hãng.

### 16. Tiêu đề

Đặt vé chính thức

### 17. Đoạn giải thích

Đi thẳng tới hệ thống hãng, không đi qua link trung gian.

### 18. Nhãn hiển thị

Đặt vé chính thức ↗

### 19. Đoạn giải thích

Tàu cao tốc Rạch Giá / Hà Tiên ↔ Phú Quốc.

### 20. Nhãn hiển thị

Kiểm tra phà ↗

### 21. Đoạn giải thích

Phà chở khách, xe và hàng.

### 22. Nhãn hiển thị

Kiểm tra lịch ↗

### 23. Đoạn giải thích

Xem lịch công bố và tình trạng đặt vé trực tiếp từ hãng.

## cano/index.html

### 1. Tiêu đề

Cano & Tour đảo

### 2. Đoạn giải thích

An Thới · cano tour đảo hôm nay

### 3. Nhãn hiển thị

JoTrip · tình hình cano Nam đảo

### 4. Tiêu đề

Đang xem hôm nay cano có chạy không.

### 5. Đoạn giải thích

Cano tour đảo được xem riêng. Tàu cao tốc hay phà có chạy cũng không có nghĩa cano chắc chắn chạy.

### 6. Tiêu đề

Khi chưa biết chắc

### 7. Đoạn giải thích

Nghĩa là mình chưa có thông tin đủ chắc để nói cano chạy hay dừng. Đừng hiểu “chưa biết” thành “bị cấm” hoặc “đang chạy”.

### 8. Tiêu đề

Cano hôm nay

### 9. Đoạn giải thích

Chỉ nói riêng cano tour đảo ở An Thới.

### 10. Tiêu đề

Lịch sử cano

### 11. Đoạn giải thích

Ba ngày được xác nhận gần nhất; lịch sử đầy đủ nằm ở trang riêng.

### 12. Nhãn hiển thị

Đang đồng bộ

### 13. Đoạn giải thích

Đang mở lịch sử…

### 14. Tiêu đề

Tour 3 đảo An Thới

## currency/index.html

### 1. Tiêu đề

Đổi tiền, xem tỷ giá / hôm nay.

### 2. Đoạn giải thích

Xem tỷ giá Vietcombank, tính nhanh số tiền cần đổi và tra lại biến động trong 30 ngày.

### 3. Tiêu đề

Đổi ngoại tệ

### 4. Nhãn hiển thị

Ngoại tệ → VND

### 5. Nhãn hiển thị

VND → Ngoại tệ

### 6. Nhãn hiển thị

Theo tỷ giá mua tiền mặt của Vietcombank.

### 7. Nhãn hiển thị

Tiền mặt

### 8. Nhãn hiển thị

Chuyển khoản

### 9. Đoạn giải thích

Tỷ giá tại quầy hoặc điểm đổi tiền thực tế có thể khác.

### 10. Đoạn giải thích

TỶ GIÁ HÔM NAY

### 11. Tiêu đề

Tỷ giá phổ biến

### 12. Đoạn giải thích

SO SÁNH NHANH

### 13. Tiêu đề

Hôm nay so với trước đây

### 14. Đoạn giải thích

Nếu Vietcombank không có giá mua tiền mặt, bảng sẽ dùng giá mua chuyển khoản và ghi rõ.

### 15. Tiêu đề

Diễn biến tỷ giá

### 16. Tiêu đề

So sánh mức tăng giảm

### 17. Đoạn giải thích

Để so sánh công bằng giữa các đồng tiền có mệnh giá khác nhau, mỗi đồng được quy về 100 ở đầu kỳ. Phần này chỉ cho biết mức tăng hoặc giảm tương đối so với VND.

### 18. Đoạn giải thích

NHIỀU LOẠI TIỀN

### 19. Tiêu đề

Cộng và quy đổi

### 20. Nhãn hiển thị

+ Thêm ngoại tệ

### 21. Nhãn hiển thị

Theo tỷ giá mua tiền mặt.

### 22. Nhãn hiển thị

Nguồn: Vietcombank

