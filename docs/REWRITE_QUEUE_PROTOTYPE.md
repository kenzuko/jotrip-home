# Open Phu Quoc - Rewrite Queue Prototype

Mục tiêu: đưa nội dung tiếng Việt ra cho một model bên ngoài viết lại, nhưng không cho model sửa cấu trúc dữ liệu hoặc tự publish.

## Nguyên tắc an toàn

- File nguồn là read-only trong bước import.
- Mỗi block có ID, pointer và SHA-256 của ORIGINAL.
- Nếu nội dung nguồn đã thay đổi sau khi export, import bị chặn.
- Các dữ kiện khóa như URL, giờ, ngày, số đo và tên record xuất hiện trong đoạn phải còn nguyên.
- Không chấp nhận en dash hoặc em dash.
- Rewrite rỗng được bỏ qua.
- Import chỉ tạo candidate JSON khi có `--out`; không có chế độ ghi đè file canonical.

## Export

Ví dụ với gỏi cá trích:

```bash
node scripts/rewrite-export.mjs \
  --source data/i18n/vi/food.json \
  --record-path dishes \
  --id goi-ca-trich \
  --fields intro,origin,how_to_eat,allergy_note,tips.0,tips.1,tips.2 \
  --out .tmp/goi-ca-trich.rewrite.md
```

Đưa file Markdown cho model ngoài với yêu cầu chỉ điền phần `[REWRITE] ... [/REWRITE]`.

## Check và import

Chỉ kiểm tra:

```bash
node scripts/rewrite-import.mjs \
  --source data/i18n/vi/food.json \
  --input .tmp/goi-ca-trich.rewrite.md
```

Tạo candidate để review:

```bash
node scripts/rewrite-import.mjs \
  --source data/i18n/vi/food.json \
  --input .tmp/goi-ca-trich.rewrite.md \
  --out .tmp/food.candidate.json
```

Sau đó candidate đi qua draft/review/diff hiện có của CMS. Không publish tự động.

## Hướng mở rộng

Crawler sau này chỉ cần tạo record có source URL, raw text, normalized facts và trạng thái `needs_rewrite`. Cùng exporter có thể tạo Rewrite Pack từ record đó. Writer engine có thể là Perplexity, GPT, Claude hoặc thao tác thủ công mà không đổi pipeline CMS.
