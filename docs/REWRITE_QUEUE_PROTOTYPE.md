# Open Phu Quoc - Rewrite Queue Prototype

Mục tiêu: đưa nội dung tiếng Việt ra cho một model bên ngoài viết lại, nhưng không cho model sửa cấu trúc dữ liệu hoặc tự publish.

## Trạng thái

- Branch thử: `feat/rewrite-queue-prototype`
- Không chạm `main`
- Không deploy Cloudflare
- Không tự publish
- Chưa mở PR để tránh kích hoạt validation nặng trong lúc Cloudflare đang giới hạn build

## Script

Dùng một file duy nhất:

`scripts/rewrite-queue-prototype.mjs`

Ba chế độ:

- `export` - tạo Markdown Rewrite Pack
- `import` - kiểm tra file trả về và chỉ tạo candidate JSON
- `test` - self-test logic khi chạy trong môi trường Node

## Guard an toàn

Mỗi block có:

- ID ổn định
- JSON pointer trỏ đúng field
- SHA-256 của ORIGINAL
- LOCKS cho dữ kiện cần giữ nguyên

Import bị chặn nếu:

- field nguồn đã đổi sau lúc export
- pointer không còn hợp lệ
- model làm mất dữ kiện khóa
- model dùng en dash hoặc em dash

Rewrite rỗng được bỏ qua.

Import không có chế độ ghi đè file canonical. Nếu muốn nhận kết quả, phải chỉ định file candidate bằng `--out`. Candidate sau đó mới đi qua draft/review/diff của CMS.

## Ví dụ export gỏi cá trích

```bash
node scripts/rewrite-queue-prototype.mjs export \
  --source data/i18n/vi/food.json \
  --record-path dishes \
  --id goi-ca-trich \
  --fields intro,origin,how_to_eat,allergy_note,tips.0,tips.1,tips.2 \
  --out .tmp/goi-ca-trich.rewrite.md
```

File sinh ra có dạng:

```md
## BLOCK 001
<!-- ID:dishes.goi-ca-trich.intro -->
<!-- POINTER:dishes.0.intro -->
<!-- HASH:... -->
<!-- LOCKS:[...] -->
[ORIGINAL]
...
[/ORIGINAL]
[REWRITE]

[/REWRITE]
```

Đưa nguyên file đó cho Perplexity hoặc model khác với yêu cầu:

> Chỉ điền nội dung giữa [REWRITE] và [/REWRITE]. Không sửa ID, ORIGINAL, metadata hoặc dữ kiện bị khóa. Viết lại tiếng Việt tự nhiên, gọn, hữu ích, không thêm fact mới.

## Kiểm tra file trả về

```bash
node scripts/rewrite-queue-prototype.mjs import \
  --source data/i18n/vi/food.json \
  --input .tmp/goi-ca-trich.rewrite.md
```

Lệnh này chỉ kiểm tra. Không ghi file nguồn.

## Tạo candidate để review

```bash
node scripts/rewrite-queue-prototype.mjs import \
  --source data/i18n/vi/food.json \
  --input .tmp/goi-ca-trich.rewrite.md \
  --out .tmp/food.candidate.json
```

Sau đó candidate mới đi qua draft/review/diff hiện có của CMS.

## Hướng mở rộng

Crawler sau này chỉ cần tạo record gồm source URL, raw text, normalized facts và trạng thái `needs_rewrite`. Cùng cơ chế Rewrite Pack xử lý record đó. Writer engine có thể là Perplexity, GPT, Claude hoặc thao tác thủ công mà không đổi pipeline CMS.
