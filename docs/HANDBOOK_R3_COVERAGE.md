# Handbook R3 - Product Coverage Ledger

Updated: 2026-09-19

Source: `PhuQuoc_SoTayDuLich_2027_IslandEditorial_R3.pptx`

## Result

- 17/17 handbook groups have a structured product destination.
- Raw corpus remains the editorial source, not the UI data model.
- Operationally volatile content is marked for live handoff rather than frozen as truth.
- Search index is generated from normalized entities, not directly from handbook chunks.

## Coverage

- **Bắt đầu & hiểu đảo** - `COMPLETE`
  - `data/entities/island-basics.json`, `data/entities/zones.json`
  - Các khái niệm nền đã thành entity; nội dung dài vẫn giữ trong corpus để đọc sâu.
- **Đến đảo & di chuyển** - `COMPLETE_LIVE_HANDOFF`
  - `data/entities/access.json`, `data/entities/utilities.json`
  - Cách đến đảo là entity; lịch/chuyến/vận hành phải chuyển sang Airport/Ferry live.
- **Chọn nơi ở** - `COMPLETE`
  - `data/entities/stay-areas.json`, `data/entities/hotels.json`, `data/entities/stay-planning.json`
  - Khu ở, hotel seed, cohort, phân khúc, booking channel và meal plan đã tách riêng.
- **Di chuyển trên đảo** - `COMPLETE_LIVE_HANDOFF`
  - `data/entities/practical.json`
  - Travel time và cách chọn phương tiện đã cấu trúc; giá/availability phương tiện là dữ liệu động.
- **Khách quốc tế** - `COMPLETE_DYNAMIC_RULES`
  - `data/entities/practical.json`
  - Visa, thanh toán, ứng xử đã cấu trúc và đánh dấu nội dung cần kiểm tra live.
- **Nhịp chuyến đi** - `COMPLETE`
  - `data/entities/itineraries.json`
  - 2N-5N, template và thematic route đã cấu trúc.
- **Bắc đảo** - `COMPLETE`
  - `data/entities/places.json`, `data/entities/activities.json`
  - Các điểm Bắc đảo chính đã là entity.
- **Dương Đông & bờ Tây** - `COMPLETE`
  - `data/entities/places.json`, `data/entities/stay-areas.json`
  - Dương Đông, Dinh Cậu, chợ đêm, Bãi Trường và vùng lưu trú đã có cấu trúc.
- **Nam đảo** - `COMPLETE_LIVE_HANDOFF`
  - `data/entities/places.json`, `data/entities/activities.json`
  - Bãi biển, Sunset Town, Cầu Hôn, Hòn Thơm và show đã tách entity; giờ/giá là live check.
- **Biển & trải nghiệm** - `COMPLETE_LIVE_HANDOFF`
  - `data/entities/activities.json`
  - Tour đảo, snorkeling, scuba, seawalker, câu cá/câu mực đã cấu trúc; phụ thuộc weather/marine live.
- **Rừng & hương vị** - `COMPLETE`
  - `data/entities/places.json`, `data/entities/food.json`
  - Suối/rừng và các món địa phương chính đã cấu trúc.
- **Ghép thành hành trình** - `COMPLETE`
  - `data/entities/itineraries.json`
  - Template theo số ngày và route theo chủ đề đã có.
- **Giá, danh bạ & quyền lợi** - `COMPLETE_LIVE_HANDOFF`
  - `data/entities/prices.json`, `data/entities/utilities.json`, `data/entities/practical.json`
  - Bảng giá seed tách riêng và luôn đánh dấu dynamic; danh bạ/utility có source.
- **An toàn & liên hệ** - `COMPLETE_LIVE_HANDOFF`
  - `data/entities/practical.json`, `data/entities/utilities.json`
  - Checklist, biển, hotline đã cấu trúc; trạng thái vận hành phải ưu tiên live.
- **Nguồn cập nhật** - `COMPLETE`
  - `data/meta/sources.json`, `data/meta/freshness-rules.json`, `data/sources/handbook-r3/manifest.json`
  - Nguồn và freshness được tách khỏi nội dung editorial.
- **Văn hóa & nghề đảo** - `COMPLETE`
  - `data/entities/culture.json`, `data/entities/places.json`
  - Nước mắm, Dinh Cậu, hồ tiêu, Nhà tù đã tách lớp culture/place.
- **Mốc phát triển** - `COMPLETE_DYNAMIC_CONTEXT`
  - `data/entities/history.json`
  - Timeline đã thành entity; các mốc tương lai/dynamic như APEC 2027 phải kiểm tra nguồn mới trước khi hiển thị như hiện trạng.

## Guardrails

1. A COMPLETE status means the handbook topic has a structured product representation. It does not mean dynamic prices, schedules, transport or weather can be treated as current.
2. Handbook values are seed/editorial context. Official or live sources win for operational facts.
3. Future-facing history/development entries must not be presented as completed infrastructure until independently updated.
4. No UI component should render raw corpus chunks as its primary data model.
