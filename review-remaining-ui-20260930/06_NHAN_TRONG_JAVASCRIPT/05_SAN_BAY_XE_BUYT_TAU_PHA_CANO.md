# CÂU CHỮ TRONG CODE - SAN BAY XE BUYT TAU PHA CANO

**Review-only.** Đặc biệt các câu liên quan Airport/Transit/Cano là thông báo vận hành, không được sửa logic xác định trạng thái hay dữ liệu thực tế. Nội dung nếu đã duyệt ở luồng chuyên biệt thì giữ nguyên.

## airport/app-copy.js

### 1. Nhãn / câu ngắn

Chuyến bay · tự cập nhật

### 2. Nhãn / câu ngắn

Cập nhật tự động

### 3. Nhãn / câu ngắn

Chưa lấy được thông tin chuyến bay lúc này.

### 4. Nhãn / câu ngắn

Cập nhật trực tiếp đang tạm gián đoạn - trang đang hiển thị bản gần nhất đã lưu.

### 5. Nhãn / câu ngắn

Giờ thực tế đã được ghi nhận.

### 6. Nhãn / câu ngắn

Nguồn ghi:

### 7. Nhãn / câu ngắn

Tình trạng theo thông tin hiện có.

### 8. Nhãn / câu ngắn

Giờ cập nhật theo thông tin chuyến bay.

### 9. Nhãn / câu ngắn

Nguồn chuyến bay

### 10. Nhãn / câu ngắn

Bản gần nhất đã lưu

### 11. Nhãn / câu ngắn

THEO DÕI ·

### 12. Nhãn / câu ngắn

BẤT THƯỜNG

### 13. Nhãn / câu ngắn

CẦN CHÚ Ý

### 14. Nhãn / câu ngắn

CHƯA ĐẠT KIỂM TRA

### 15. Nhãn / câu ngắn

Nguồn cập nhật hiện chưa đạt kiểm tra chất lượng. Không nên dùng thông tin này để quyết định chuyến đi.

### 16. Nhãn / câu ngắn

BẢN GẦN NHẤT

### 17. Nhãn / câu ngắn

Cập nhật trực tiếp tạm không phản hồi. Trang đang hiển thị bản gần nhất đã lưu.

## bus/app.js

### 1. Nhãn / câu ngắn

Pin OSM tham khảo, chưa phải pin VinBus xác nhận

### 2. Nhãn / câu ngắn

Chưa xác định GPS trạm

### 3. Nội dung hiển thị

🚌 Tuyến '+r.id+'

### 4. Nhãn / câu ngắn

🚌 Tuyến

### 5. Nhãn / câu ngắn

Theo lịch VinBus

### 6. Nhãn / câu ngắn

Có vị trí xe

### 7. Nội dung hiển thị

Chưa thấy vị trí xe cho tuyến '+state.current+'.

### 8. Nhãn / câu ngắn

Hiện trang chỉ có lịch chạy. Khi VinBus gửi vị trí xe, mình sẽ hiện ngay ở đây.

### 9. Nhãn / câu ngắn

Đang chạy

### 10. Nội dung hiển thị

TRỰC TIẾP

### 11. Nhãn / câu ngắn

Vị trí trực tiếp

### 12. Nhãn / câu ngắn

Lịch công bố

### 13. Nhãn / câu ngắn

Đang có vị trí xe trực tiếp.

### 14. Nhãn / câu ngắn

Chưa thấy vị trí xe lúc này. Lịch tuyến vẫn có, nhưng trang không tự đoán xe đang ở đâu.

### 15. Nhãn / câu ngắn

Lịch xem lại

### 16. Nhãn / câu ngắn

Chưa mở được

### 17. Nhãn / câu ngắn

Trang xe buýt chưa mở được lúc này. Thử lại sau một chút nhé.

## ferry/app.js

### 1. Nhãn / câu ngắn

Tàu cao tốc

### 2. Nhãn / câu ngắn

Đang mở bán

### 3. Nhãn / câu ngắn

Chưa có thông tin chỗ

### 4. Nhãn / câu ngắn

Đang chạy

### 5. Nhãn / câu ngắn

Tạm dừng

### 6. Nhãn / câu ngắn

Chưa biết chắc

### 7. Nhãn / câu ngắn

Có cập nhật riêng cho hôm nay

### 8. Nhãn / câu ngắn

Cập nhật ngày

### 9. Nhãn / câu ngắn

· mỗi nhóm xem riêng

### 10. Nhãn / câu ngắn

Thông tin gần nhất là của ngày trước, hôm nay chưa biết chắc

### 11. Nội dung hiển thị

Tất cả tuyến

### 12. Nội dung hiển thị

Tất cả hãng

### 13. Nhãn / câu ngắn

Chưa lấy đủ lịch

### 14. Nhãn / câu ngắn

Lịch còn mới

### 15. Nhãn / câu ngắn

Nên xem lại

### 16. Nhãn / câu ngắn

Cập nhật

### 17. Nhãn / câu ngắn

Chưa biết lần cập nhật gần nhất · nên mở lại trang hãng

### 18. Nhãn / câu ngắn

chuyến ·

### 19. Nội dung hiển thị

Đến '+time(r.arrival_time)+'

### 20. Nhãn / câu ngắn

Lịch hãng

### 21. Nội dung hiển thị

Ngày này chưa có lịch để hiện ở đây. Bạn có thể mở thẳng trang hãng bên dưới để xem.

### 22. Nội dung hiển thị

Chưa mở được lịch tàu và phà lúc này. Trước khi ra bến, bạn nên mở lại trang hãng.

### 23. Nội dung hiển thị

';$("#health").textContent="Chưa có lịch";$("#updatedAt").textContent="Chưa lấy được lịch mới từ các hãng"}}catch(e){$("#rows").innerHTML='

### 24. Nhãn / câu ngắn

Chưa có lịch

### 25. Nhãn / câu ngắn

Chưa lấy được lịch mới từ các hãng

## cano/app.js

### 1. Nhãn / câu ngắn

Đang chạy

### 2. Nhãn / câu ngắn

Tạm dừng

### 3. Nhãn / câu ngắn

Ghi nhận trực tiếp

### 4. Nhãn / câu ngắn

Có ghi nhận

### 5. Nhãn / câu ngắn

Giấy phép rời cảng

### 6. Nhãn / câu ngắn

Đơn vị phụ trách

### 7. Nhãn / câu ngắn

Nguồn ghi nhận hôm nay

### 8. Nhãn / câu ngắn

Ghi nhận ngày đó

### 9. Nhãn / câu ngắn

Cập nhật ngày

### 10. Nhãn / câu ngắn

Hôm nay chưa có tin mới

### 11. Nhãn / câu ngắn

ghi nhận

### 12. Nhãn / câu ngắn

Hôm nay mình chưa biết chắc cano có chạy không.

### 13. Nhãn / câu ngắn

Mình đang chờ thêm thông tin từ thực địa hoặc đầu mối cano. Tàu cao tốc và phà có chạy cũng không dùng để đoán cano.

### 14. Nhãn / câu ngắn

Thông tin gần nhất là của ngày trước, nên hôm nay mình không dùng lại để kết luận.

### 15. Nhãn / câu ngắn

Tình hình này chỉ áp dụng cho cano tour đảo hôm nay.

### 16. Nội dung hiển thị

Chưa biết chắc

### 17. Nội dung hiển thị

Hôm nay chưa có ghi nhận đủ chắc

### 18. Nội dung hiển thị

Không lấy tình trạng tàu hoặc phà để đoán cano.

### 19. Nhãn / câu ngắn

Tour 3 đảo An Thới

### 20. Nhãn / câu ngắn

Chưa tải được

### 21. Nhãn / câu ngắn

Chưa xem được tình hình cano hôm nay.

### 22. Nội dung hiển thị

Nguồn cập nhật tạm thời không truy cập được.

### 23. Nhãn / câu ngắn

Đồng bộ đến

### 24. Nhãn / câu ngắn

Chưa tải được lịch sử mới

### 25. Nhãn / câu ngắn

Chưa mở được

### 26. Nội dung hiển thị

Chưa xem được tình hình cano lúc này.

## transit/app.js

### 1. Nhãn / câu ngắn

Thạnh Thới

### 2. Nhãn / câu ngắn

Phú Quốc Express

### 3. Nhãn / câu ngắn

Tàu cao tốc

### 4. Nhãn / câu ngắn

Cập nhật

### 5. Nhãn / câu ngắn

Tần suất

### 6. Nhãn / câu ngắn

Cập nhật theo ngày

### 7. Nhãn / câu ngắn

Liên tuyến

### 8. Nhãn / câu ngắn

Còn hạn chế

### 9. Nhãn / câu ngắn

Có thể đặt vé

### 10. Nhãn / câu ngắn

Chưa xác định

### 11. Nhãn / câu ngắn

Tất cả tuyến

### 12. Nhãn / câu ngắn

Tất cả hãng

### 13. Nhãn / câu ngắn

Giờ chạy, hãng, tàu/phà và giá cho đúng ngày bạn chọn.

### 14. Nhãn / câu ngắn

Xem đúng ngày đi, không lấy lịch tháng điền vào cho đủ.

### 15. Nhãn / câu ngắn

Chuyến phà theo ngày, có giá người và giá xe khi hãng công bố.

### 16. Nhãn / câu ngắn

Tuyến và tần suất theo lịch. Vị trí xe chỉ hiện khi có thật.

### 17. Nhãn / câu ngắn

Xem tuyến bên dưới

### 18. Nhãn / câu ngắn

Chưa có chuyến sắp tới

### 19. Nhãn / câu ngắn

Chưa lấy được lịch

### 20. Nhãn / câu ngắn

Lịch chưa có cập nhật mới

### 21. Nhãn / câu ngắn

Còn thiếu vài hãng

### 22. Nhãn / câu ngắn

Chưa lấy được từ hãng

### 23. Nhãn / câu ngắn

Chưa biết lần cập nhật gần nhất

### 24. Nhãn / câu ngắn

Đã lấy được lịch

### 25. Nhãn / câu ngắn

Các hãng cần xem đã có lịch

### 26. Nhãn / câu ngắn

Vẫn còn hãng chưa có lịch cho ngày này

### 27. Nhãn / câu ngắn

Còn thiếu

### 28. Nội dung hiển thị

Theo ngày thực tế

### 29. Nội dung hiển thị

Không dùng lịch tháng để khẳng định chuyến trong ngày

### 30. Nhãn / câu ngắn

chưa có lịch chắc cho đúng ngày này, nên chưa đưa vào bảng chuyến.

### 31. Nội dung hiển thị

Theo tuyến

### 32. Nội dung hiển thị

'; const f=fareFor(r);if(!f.adult)return compact?"Kiểm tra hãng":'

### 33. Nội dung hiển thị

Kiểm tra hãng

### 34. Nội dung hiển thị

Chưa có giá để hiện

### 35. Nhãn / câu ngắn

Theo lịch công bố

### 36. Nội dung hiển thị

Chưa có chuyến phù hợp với ngày hoặc bộ lọc này. Mình không lấy lịch tháng điền vào cho đủ.

### 37. Nội dung hiển thị

Theo lịch

### 38. Nội dung hiển thị

Kiểm tra vé

### 39. Nhãn / câu ngắn

Lịch theo ngày

### 40. Nhãn / câu ngắn

Vé người lớn

### 41. Nội dung hiển thị

Theo lịch tuyến

### 42. Nhãn / câu ngắn

Mở trang hãng để xem lại

### 43. Nhãn / câu ngắn

Chỉ báo mức chung, không hiện số ghế cụ thể.

### 44. Nhãn / câu ngắn

Chưa biết chắc còn vé hay không. Mở trang hãng để xem lại nhé.

### 45. Nội dung hiển thị

Liên hệ / kiểm tra ↗

### 46. Nhãn / câu ngắn

Chưa tải được

### 47. Nhãn / câu ngắn

Chưa lấy được lịch mới từ các hãng

### 48. Nội dung hiển thị

Chưa mở được lịch lúc này. Bạn có thể kiểm tra trực tiếp với hãng.

