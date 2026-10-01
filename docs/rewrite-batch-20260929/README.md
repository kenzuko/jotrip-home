# Open Phu Quoc - Batch Rewrite 29/09/2026

Mục tiêu: rà lại toàn bộ prose tiếng Việt hiện tại theo lô lớn, không làm từng bài.

## Phạm vi

- Stories: 34 bài
- Knowledge/Cẩm nang: 150 record
- Food: 32 món
- Tổng: 216 record

## Thứ tự xử lý

1. stories-01.md
2. stories-02.md
3. knowledge-01.md
4. knowledge-02.md
5. knowledge-03.md
6. knowledge-04.md
7. knowledge-05.md
8. food-01.md
9. food-02.md

## Prompt dùng cho Perplexity

Dán nguyên nội dung một pack và gửi kèm yêu cầu:

> Chỉ điền phần [REWRITE] ... [/REWRITE] cho tất cả BLOCK.
> Giữ nguyên ID, POINTER, HASH, LOCKS và ORIGINAL.
> Viết lại tiếng Việt tự nhiên, gọn, hữu ích, như người hiểu Phú Quốc đang giải thích cho du khách.
> Không thêm fact mới, không đổi nghĩa, không quảng cáo hóa, không dùng en dash hoặc em dash.
> Nếu câu gốc đã tự nhiên, chỉ sửa khi bản mới thực sự trôi chảy hơn.
> Trả lại toàn bộ pack, không bỏ bất kỳ BLOCK nào.

Perplexity không cần xuất file. Copy toàn bộ text trả về và gửi lại cho ChatGPT để kiểm ID, khóa fact, source drift và diff trước khi áp dụng.

## An toàn

Toàn bộ pack nằm trên branch feat/rewrite-queue-prototype.
Không sửa main.
Không deploy Cloudflare.
Không tự publish.
