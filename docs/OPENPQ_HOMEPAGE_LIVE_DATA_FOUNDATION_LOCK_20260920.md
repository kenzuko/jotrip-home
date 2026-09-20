# OPEN PHU QUOC - HOMEPAGE, LIVE & DATA FOUNDATION LOCK

Date: 20/09/2026

Purpose: Chuẩn hoá Homepage, Live, Near Me và nền dữ liệu để tiếp tục phát triển Open Phu Quoc mà không làm thay đổi ADN sản phẩm.

## 1. PRODUCT DNA

Open Phu Quoc không phải tourism landing page thông thường.

Mục tiêu dài hạn là một hệ thống sống giúp người dùng:

1. Hiểu Phú Quốc đang diễn ra thế nào.
2. Quyết định hôm nay nên làm gì.
3. Tìm nhanh thứ mình cần.
4. Khám phá Phú Quốc sâu hơn qua địa điểm, văn hóa, câu chuyện và huyền tích.
5. Sau này có thể dùng cùng data foundation cho web, app và AI.

Ba lớp phải cùng tồn tại:

### LIVE & USEFUL
- Weather
- Sea
- Airport
- Transit
- Activity status
- Alerts
- Utilities

### LOCAL KNOWLEDGE
- Places
- Food
- Practical
- Culture
- History
- Stories

### MEMORY & DISCOVERY
- Lore
- Huyền tích
- Visual Archive
- Timeline
- Then/Now
- Lost Phu Quoc
- Curiosity

Không để Open Phu Quoc biến thành dashboard khô cứng.

Nhưng cũng không để homepage trở thành blog với quá nhiều bài text.

## 2. HOMEPAGE ROLE

Homepage không chứa toàn bộ Open Phu Quoc.

Homepage phải làm tốt ba việc:

> Understand now. Decide today. Discover more.

Nó trả lời nhanh:

- Phú Quốc lúc này có gì đáng chú ý?
- Hôm nay tôi làm gì được?
- Tôi cần gì quanh đây?
- Có gì mới hoặc đáng biết?
- Có câu chuyện gì khiến tôi muốn khám phá tiếp?

## 3. HOMEPAGE STRUCTURE

Homepage nên có khoảng 7-8 vùng lớn.

Không hiểu 7-8 vùng là 7-8 card.

Mỗi vùng là một chức năng lớn, bên trong có thể chứa nhiều thông tin nhỏ.

### 3.1 SEARCH / HERO

Search là cửa vào chính.

Search hướng tới tìm được:

- Places
- Activities
- Food
- Hotels
- Weather
- Airport
- Transit
- Utilities
- Stories
- Lore
- Practical information

Không cần AI ở phase hiện tại.

### 3.2 ISLAND PULSE

Một summary rất ngắn:

> Phú Quốc lúc này thế nào?

Có thể gồm:

- Weather
- Sea
- Airport
- Transit
- Major operational state
- Important disruption/event

Mỗi item chỉ gồm:

- status
- một dòng context
- freshness
- CTA Detail

Ví dụ:

```text
SEA
Normal operations
Cano An Thoi currently operating
Updated 08:35
```

## IMPLEMENTATION PRECEDENCE

- File này là lock có thẩm quyền cao hơn các homepage hierarchy cũ nếu có xung đột.
- Không tự diễn giải thêm các phần chưa được khoá trong tài liệu này.
- Live/current luôn cần nguồn và freshness.
- Missing/stale không được hiển thị như normal.
- Forecast/model không được gọi là observation.
- Cano, fast boat và ferry là các trạng thái vận hành độc lập.
- Weather engine vẫn thuộc JoTrip Lab Weather V2; Open Phu Quoc chỉ consume và present.
- Homepage phải giữ cân bằng giữa utility, local knowledge và memory/discovery.
