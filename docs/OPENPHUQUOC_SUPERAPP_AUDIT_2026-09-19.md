# OPEN PHU QUOC - SUPER APP AUDIT & REBUILD PLAN

Cập nhật: 19/09/2026

## 1. Kết luận nhanh

Hiện Open Phu Quoc **chưa phải super app hoàn chỉnh**. Bản mobile đã đi đúng hướng hơn, nhưng bản desktop vẫn có cảm giác của một landing page dài: hero lớn, các section xếp dọc, nhiều card mang tính giới thiệu, ít cảm giác “mở lên để dùng”.

Ba việc phải đổi ngay:

1. **Dữ liệu sổ tay phải được bóc đủ thành dữ liệu sản phẩm**, không chỉ giữ vài mục tóm tắt.
2. **Weather dùng nguyên nguồn/logic V2 JoTrip Weather** thay cho bản weather phổ thông rút gọn.
3. **Homepage desktop chuyển từ landing page sang app shell**, ưu tiên trạng thái hiện tại, tìm kiếm, module, bản đồ/định hướng và thao tác nhanh.

## 2. Sổ tay 2027 - trạng thái dữ liệu

Nguồn master đang dùng:

`PhuQuoc_SoTayDuLich_2027_IslandEditorial_R3.pptx`

Đã ingest toàn bộ phần text đọc được của R3 vào repo:

- `data/handbook-r3-corpus.json`
- `data/handbook-r3-index.json`

Corpus hiện có khoảng **74.941 ký tự**, **97 chunk nội dung**, index thành **17 nhóm nội dung**.

### Chưa đủ ở lớp sản phẩm

`guide/data.json` hiện mới là bản rút gọn, chủ yếu có 3 vùng, nhịp Bắc đảo, tier khách sạn, một số khu khách sạn, vài nhóm món và 3 itinerary.

Như vậy **chưa thể gọi là đã cào đủ dữ liệu sổ tay lên UI**.

Phần còn phải normalize:

- đến đảo
- tàu/phà
- sân bay/cảng -> khách sạn
- chọn khu ở đầy đủ
- ma trận loại khách -> khu ở
- khách sạn theo vùng / phân khúc
- meal plan / booking tips
- khoảng cách và thời gian di chuyển
- khách quốc tế / visa / thanh toán / ứng xử
- điểm Bắc đảo đầy đủ
- điểm trung tâm & bờ Tây
- điểm Nam đảo
- tour biển / snorkeling / scuba / seawalker
- câu cá / câu mực
- rừng / suối
- ẩm thực theo món / nhóm
- itinerary 2N / 3N / 4N / 5N
- bảng giá tham khảo
- an toàn
- văn hóa nghề đảo
- lịch sử phát triển 2000 -> APEC 2027

Mỗi mục nên tách thành data có thể query/search/filter/map, không nhét nguyên text ebook vào UI.

## 3. Utilities

`data/utilities.json` đã có lớp thực dụng tốt: emergency, hotline địa phương, sân bay, Lost & Found, tàu/phà, vui chơi, y tế, giá/show tham khảo, travel time, transport choice và checklist.

Nhưng AutoSync còn `PARTIAL`. Nguồn official/live luôn phải ưu tiên hơn dữ liệu đóng trong sổ tay.

## 4. Weather

Không dùng tiếp bản `/weather/` rút gọn cũ.

Đã port **JoTrip Weather V2** sang `/weather/`, mang theo V2 UI/logic, Quick Alert, Actual/Estimated/Model distinction, VVPQ, VRain, AQI, tide, island watch, JoTrip Forecast, marine/wave logic và source health.

Nguyên tắc:

**Open Phu Quoc là lớp trải nghiệm. Weather Lab là nguồn dữ liệu và engine.**

Không fork thành hai pipeline weather độc lập.

## 5. Infographic / đọc hiểu

Nếu người làm sản phẩm còn phải đọc lại mới hiểu thì infographic đang sai nhiệm vụ.

Quy tắc mới:

**1 câu hỏi -> 1 câu trả lời chính -> 1 hành động tiếp theo**

Không dùng chart chỉ để trông “data”.

Ví dụ travel time nên hiện trực tiếp:

- Sân bay -> Dương Đông: **15-25 phút**
- Sân bay -> Sunset Town: **25-35 phút**
- Dương Đông -> Grand World: **35-50 phút**
- Bắc đảo -> Nam đảo: **70-100 phút**

Và thêm kết luận ngắn như:

`Đi cùng ngày Bắc + Nam? Không nên nếu lịch quá dày.`

## 6. Vì sao desktop giống landing page?

Pattern hiện tại:

`Hero -> section -> section -> section -> footer`

Đây là landing page.

Super app cần:

`App shell -> status -> search -> tasks -> live modules -> discovery -> deep content`

### Desktop đề nghị 3 cột logic

**Cột trái - Navigation**

- Hôm nay
- Live
- Khám phá
- Ăn uống
- Cẩm nang
- Tiện ích
- Weather
- Airport
- Ferry / Transport

**Trung tâm - Feed / workspace**

- Island status
- hôm nay
- weather alert
- airport disruption
- ferry status
- things to do
- khu vực
- editorial cards

**Cột phải - Context rail**

- weather now
- sunset
- airport next arrivals
- hotline
- quick map
- tối nay có gì

Desktop phải cho thấy nhiều tiện ích trong cùng một màn hình, không bắt kéo dài như brochure.

## 7. Homepage desktop V3

### Above the fold

Giảm hero xuống khoảng 32-40vh.

Phải thấy ngay:

- Search toàn đảo
- Weather now
- Airport
- Ferry / transport
- Tonight
- Emergency

Mục tiêu:

**3 giây đầu phải hiểu đây là công cụ cho Phú Quốc, không phải website quảng bá du lịch.**

### App launcher

Chỉ 6 tác vụ lớn:

- Tôi đang ở Phú Quốc
- Tôi sắp đến
- Đi đâu hôm nay?
- Ăn gì?
- Di chuyển
- Cần trợ giúp

### Live Island Status

- Weather
- Sea
- Airport
- Ferry
- Sunset
- Tonight

Không biến thành dashboard kỹ thuật.

### Today

Feed hỗn hợp:

- thời tiết
- show
- hoạt động
- vận hành
- gợi ý theo giờ
- sự kiện
- cảnh báo

### Explore

Browse theo:

- Bắc
- Trung tâm
- Nam
- Biển
- Gia đình
- Couple
- Local life
- Rainy day

## 8. Search là lõi super app

Search phải xuyên:

- địa điểm
- món ăn
- bài viết
- hotline
- khách sạn
- tour / trải nghiệm
- airport
- ferry
- weather
- utility
- itinerary
- khu vực

Ví dụ gõ `hon thom` phải trả được Hòn Thơm, cáp treo, Aquatopia, giá tham khảo, Weather Nam đảo, bài liên quan và cách đi.

## 9. Data architecture

```text
data/
  handbook/
    corpus.json
    index.json
    places.json
    hotels.json
    food.json
    itineraries.json
    practical.json
    culture.json
    history.json

  live/
    weather.json
    airport.json
    ferry.json
    transport.json
    events.json

  content/
    stories.json
    home.json

  utilities/
    directory.json
    emergency.json
    prices.json
```

Homepage chỉ đọc các view đã chuẩn hóa.

## 10. Thứ tự xử lý

### P0

1. Tạm ngừng thêm feature CMS.
2. Normalize đầy đủ dữ liệu R3.
3. Weather `/weather/` dùng V2 JoTrip Weather.
4. Redesign desktop thành app shell.
5. Rút gọn infographic khó hiểu.
6. Làm search xuyên module.

### P1

7. Explore theo vùng / intent.
8. Place detail.
9. Kết nối airport / transport / ferry.
10. Today feed.

### P2

11. Personal state nhẹ.
12. Itinerary builder.
13. Saved places.
14. Contextual map.

## 11. Definition of Done

Không gọi Open Phu Quoc là super app nếu chưa đạt:

- mở lên thấy ngay trạng thái đảo
- search được mọi nhóm dữ liệu
- Weather / Airport / Transport / Utility chạy thật
- dữ liệu handbook đủ sâu
- desktop không còn landing-page feel
- mobile không phải desktop thu nhỏ
- infographic đọc 3-5 giây hiểu
- module liên kết với nhau
- live data có freshness/source
- editorial và live không trộn lẫn

## 12. Kết luận

Cần đổi từ:

**“một website du lịch có nhiều section”**

sang:

**“một hệ điều hành nhỏ cho người đang đi Phú Quốc.”**

Lõi sản phẩm:

**Search + Today + Live + Map + Utilities + Destination Knowledge.**
