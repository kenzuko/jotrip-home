# OPEN PHU QUOC WEATHER - HUMAN LAYER MASTER LOCK V1

Ngày khóa: 2026-10-01  
Phạm vi: `openphuquoc.com/weather` và các bề mặt công khai tiêu thụ Weather Engine.

## 1. Vai trò

Human Layer không phải một weather engine thứ hai và không thay đổi ngưỡng quyết định của engine.

Nó là lớp biên tập cuối cùng:
- nhận semantic state đã được engine/contract xác định;
- chọn điều đáng nói;
- nói ngắn, đúng địa điểm, đúng thời điểm, đúng mức bằng chứng;
- giữ dữ liệu kỹ thuật và provenance ở lớp giải thích phía sau.

## 2. Câu hỏi mà Human Layer phải trả lời

Mỗi thông tin đưa lên lớp chính phải trả lời ít nhất một câu:
1. Có gì khác thường?
2. Có gì đang hoặc sắp thay đổi đáng kể?
3. Có điều gì có thể làm người dùng đổi quyết định?

Không qua một trong ba cửa trên thì không được tạo narrative chỉ để lấp chỗ trống.

## 3. Contract hiển thị chính

Dòng 1:
`[Khu vực] · khoảng [nhiệt độ hiện tại]`

- "khoảng" dùng cho `ESTIMATED_NOW`.
- Quan trắc sân bay định kỳ không được thay thế nhiệt độ hiện tại tại điểm.
- Khi estimate hiện tại không đủ mới, hiển thị `[Khu vực] · đang cập nhật`, không dùng số cũ giả làm "lúc này".

Dòng 2:
- Chỉ hiện hiện tượng có ý nghĩa: mưa cục bộ, mưa đang được ghi nhận, mây đối lưu gần, mây đi ngang, tiến vào, đi ra xa, gió/rủi ro đáng chú ý.
- Không nói các quy luật hiển nhiên như buổi tối mát hơn buổi chiều.
- Không đưa lời khuyên chung chung nếu không có trigger quyết định.

Dòng 3:
- Chỉ xuất hiện khi có diễn biến thứ hai thực sự đáng nói, ví dụ hướng di chuyển của vùng mây.
- Tối đa hai câu narrative cho trạng thái "lúc này".

Ví dụ chuẩn:

> Dương Đông · khoảng 28°C  
> Có mưa nhẹ cục bộ quanh khu vực. Vùng mây đối lưu đang ở gần nhưng chưa thấy tiến thẳng vào Dương Đông.

## 4. Evidence rules

- `ACTUAL` chỉ áp dụng đúng vị trí và thời điểm quan trắc.
- `ESTIMATED_NOW` không bao giờ được đổi nhãn thành `ACTUAL`.
- VVPQ METAR/SPECI là quan trắc sân bay định kỳ, không phải cảm biến liên tục và không đại diện trực tiếp cho điểm đang xem.
- SYNOP, VVPQ, VRain, Himawari, ECMWF, GEFS là evidence cho engine/contract; không phải danh sách bắt buộc phải đọc cho người dùng.
- Không ghép hai signal riêng thành quan hệ nhân quả nếu engine chưa chứng minh linkage về không gian/thời gian.
- Khi nguồn mâu thuẫn, giảm độ chắc của câu; không âm thầm chọn một nguồn và viết như chắc chắn.
- Mất dữ liệu không đồng nghĩa điều kiện thời tiết an toàn hoặc khô ráo.

## 5. Freshness rules cho Human Layer

- Local Now hiện tại: tối đa 45 phút cho câu "lúc này".
- Himawari motion: tối đa 60 phút cho câu về hướng di chuyển.
- Quan trắc cũ hơn ngưỡng của lớp chính vẫn có thể xuất hiện trong phần bằng chứng/provenance nếu được ghi rõ thời điểm.
- Freshness của model cycle không tự tạo cảnh báo lớn trên lớp Human Layer.

## 6. Motion wording

Thứ tự semantic:
1. MOVING_AWAY
2. PASSING_BY
3. NEARBY_NOT_APPROACHING
4. APPROACHING - chỉ khi track usable + predicted impact + approaching + ETA <= 120 phút
5. TRACK_UNCERTAIN

Không dùng "đang tiến vào" chỉ vì mây ở gần hoặc convective score cao.

## 7. Silence threshold

Human Layer phải biết im:
- biến động nhiệt nhỏ không tạo câu mới;
- thay đổi bình thường theo ngày/đêm không tạo insight;
- nguồn kỹ thuật thay đổi nhưng quyết định không đổi thì không đẩy narrative mới;
- trạng thái bình thường có thể chỉ là "Chưa có tín hiệu thời tiết đáng chú ý lúc này."

## 8. Presentation hierarchy

1. Human Layer - kết luận ngắn.
2. Các số chính phục vụ quyết định.
3. "Vì sao hệ thống nói vậy?" - evidence/provenance.
4. Quan trắc thực địa.
5. Dự báo hôm nay / 10 ngày.
6. Phân tích kỹ thuật sâu.

Tên nguồn, confidence số, residual, cloud-top, model cycle không cạnh tranh thị giác với kết luận chính.

## 9. Airport reference

Khối VVPQ:
- nằm cùng phần quan trắc thực địa;
- ghi rõ METAR/SPECI định kỳ;
- không nằm trong Human Layer chính;
- không dùng heat index sân bay để mô tả "cảm nhận ngoài trời" của Dương Đông/An Thới/Gành Dầu.

## 10. Hard prohibitions

Human Layer không được:
- tự thay threshold GO/HOLD/MODIFY/CANCEL;
- tự phán "an toàn";
- dùng số cũ làm "lúc này";
- suy nguyên nhân không có evidence;
- tạo lời khuyên mặc định như "mang áo mưa" chỉ để làm câu đầy hơn;
- kể lại mọi field của engine;
- dùng LLM free-form để tự nhìn raw fields rồi viết tùy ý.

Human Layer phải deterministic từ semantic state và có regression test.

## 11. Product principle

**Human Layer không cố nghe như con người. Nó phải nghĩ đúng như hệ thống, rồi nói bằng ngôn ngữ con người.**
