# Open Phu Quoc - Gói Markdown để rà chữ

**Snapshot:** `b272d1513ccf98b0f4e4be205790d6394d5f65a1` (latest main khi xuất)

**Có:** 150 bài Cẩm nang; 39 thẻ Khám phá; trang /guide, /explore, thông tin nơi ở và lịch trình. Các bài chưa public có nhãn PUBLIC:false.

**Cách sửa:** mở các file `.md`, sửa chữ ngay giữa `<!-- OPQ-FIELD {...} -->` và `<!-- OPQ-END -->`. **Giữ nguyên** dấu marker, ID, JSON pointer, đầu mục và tên file. Có thể để nguyên phần đã ổn. Không sửa URL ảnh, GPS, giá, giờ hoạt động, lịch bảo trì hay thông tin nguồn trong gói này.

**Cách gửi:** nén lại thư mục `review-markdown` đã sửa rồi tải lên chat. Bản chỉnh là đề xuất, chưa tự cập nhật website. Tớ sẽ so từng trường với bản gốc đúng commit ở trên và latest main trước khi nhập; nếu dữ liệu gốc đổi sẽ đối chiếu, không ghi đè mù.

**Đọc trước:**
- `guide/01-guide-static-copy.md`: chữ đầu mục, tiêu đề và mô tả trên /guide.
- `guide/02-guide-data.md`: vùng, khách sạn, món ăn và mẫu lịch trình của trang /guide.
- `guide/03-stay-and-itineraries.md`: phần /guide lấy từ hai kho dữ liệu riêng.
- `guide/04-review-only-hardcoded.md`: hero và các câu trả lời còn ghi cứng trong code. **Chỉ duyệt chữ**, chưa tự động map JSON.
- `explore/01-explore-static-copy.md` và `explore/cards-*.md`: giao diện và nội dung thẻ.
- `knowledge/knowledge-*.md`: 150 bài để rà trọn bài, gồm bài trong ảnh Symphony of the Sea.

**Ranh giới:** những file trong thư mục này chỉ là bản xuất duyệt chữ. Main và website không thay đổi; dịch đa ngôn ngữ sẽ được xử lý từ bản tiếng Việt đã chốt sau.
