# OPEN PHU QUOC CMS - ADMIN V2 WORKSPACE
Ngày triển khai phát triển: 27/09/2026 | Phạm vi: cms.openphuquoc.com/admin
Repo: kenzuko/jotrip-home | Branch riêng / Pull Request để QA.

## Nguyên tắc
Đây là lần nâng cấp tổng thể trong **phạm vi CMS**, không phải viết lại
Weather, Airport, Transit, Marine, GO, Near Me hoặc nền dữ liệu của chúng.
Giao diện theo ADN trang chủ đã duyệt: Sea Ink #123D3B, Melo Coral #D85B3F,
nền giấy ấm, chữ dễ đọc và tác vụ cụ thể. 80% công cụ, 20% địa phương.
Không dùng homepage stylesheet hơn 170KB trong Admin; token V2 nằm riêng.

## I. Ba cửa làm việc
**Bàn làm việc / Biên tập:** vẫn dùng Control Room V1.3 và editor hiện hữu,
được bổ sung cùng một hệ token CSS, cỡ chữ/form dễ đọc và bộ điều hướng
toàn CMS (Ctrl/Cmd+K, tìm không dấu, lọc đúng role). Phím "/" tìm trong
module hiện tại, dashboard mở bảng điều hướng. Không có API mới cho menu.

**Cần kiểm chứng:** tìm không dấu qua tên, ID, nguồn, mô tả, người phụ trách;
lọc Đang mở, Ưu tiên, Đang làm, Của tôi, Quá hạn và Đã xử lý.
Hiển thị từng nhóm 10, tên thực thể làm tiêu đề thay vì mã nội bộ.
Khi D1 chưa hoạt động, không giả số 0 cho trạng thái phân công và không
hiện controls ghi. Nút Nhận việc, Lưu hạn, Đã xử lý và Ẩn 7 ngày chỉ dành
cho quyền quản lý và khi có D1; cần xác nhận khi đánh dấu xử lý hoặc tạm ẩn.

**Hàng đợi duyệt:** tìm không dấu bằng tiêu đề, người gửi, số PR; lọc
PR đang mở/PR nháp, xem thêm 8 việc mỗi lượt. Tự mở đúng PR khi đi từ
Control Room. Diff ghi rõ "so sánh với main hiện tại", không phải trạng
thái tại thời điểm PR được tạo. Chỉ tóm tắt ba việc Quality đầu để tránh
nhân đôi hàng đợi. Rollback tạo PR mới, không ghi đè tức thì.

## II. Sửa lỗi vận hành thực tế
Trang Quality cũ gọi load() khi busy=true sau POST và hàm tải lại lập
tức thoát. Sau khi ghi thành công, V2 buộc tải lại từ API, không giữ
trạng thái DOM lạc hậu. Backend Quality SQL cũ cập nhật status/owner
nhưng **không cập nhật due_at** khi ON CONFLICT; V2 thêm đúng cột này,
giữ owner cũ khi người quản trị chỉ sửa hạn hoặc đánh dấu lại và kiểm
tra ngày YYYY-MM-DD hợp lịch. Không đổi schema D1/migrations hay xóa
bất kỳ lịch sử kiểm toán nào.

Lưu ý: bộ lọc theo deadline/owner chỉ phản ánh chính xác dữ liệu trả
về từ /api/cms/quality. Dữ liệu nguồn vẫn phải xác minh thực địa,
hệ thống không tự hoàn thành nội dung chỉ vì bấm "Đã xử lý".

## III. Giới hạn và ranh giới
- V1.3 giữ nháp riêng theo bài trên cùng thiết bị, không phải cloud sync.
- API publish vẫn dùng **whole-file GitHub SHA và PR conflict**.
  Hai bài khác nhau trong data/content.json vẫn xung đột khi có PR đang
  chờ ở cùng tệp. Không bật tự gộp tự merge, không dùng production DB
  làm nơi viết nội dung mới trong V2.
- /weather, /airport, /transit, marine_ops, GO, Near Me, apps, DNS,
  shared Workers, Wrangler, trigger, Cloudflare secret/chi phí: không sửa.
- Giữ GitHub OAuth HttpOnly session, phân quyền read/write phía backend.
  Các công cụ lọc trên frontend không thay thế authorization trên API.
- Có PR CMS bài viết đang chờ ở cùng data/content.json thì chỉ cảnh báo
  trước khi gửi đề xuất mới; người quản trị tự duyệt/đóng PR đang mở.
- Không nâng Cloudflare plan, không dùng token trong log hoặc giao diện.

## IV. QA bắt buộc
- Unit: role-based palette, module search, XSS escaping, filter/links Quality,
  D1 UPSERT owner & deadline, lịch sử audit, review search.
- Playwright: desktop + iPhone 390px, từng trang, mở quick palette,
  Claim -> POST -> reload trạng thái thật (mock API), Lưu hạn -> kiểm tra
  ngày, tìm bài/PR không dấu, diff đúng main hiện tại, không tràn ngang.
- Regression: V1.1 sidebar, V1.2 work inbox, V1.3 preview/checkpoints,
  GitHub edit-state. Demo public vẫn chỉ là dữ liệu giả, không gọi API.
- Kiểm tra 4 gates: CMS QA, public V3 Validate, Pages preview và Worker
  build (nếu trigger hiện có tự chạy). Không sửa trigger để giảm chi phí.
- Một nhánh riêng, một commit nhóm. Không merge/main/deploy production
  khi QA chưa đủ hoặc có xung đột file từ luồng khác.
- Sau khi chủ dự án xác nhận preview: mới merge, xác nhận commit live,
  custom domain, pages và OAuth phiên người dùng sau deploy.

## V2.1 - hàng đợi chắc chắn hơn (27/09/2026)
- Sắp xếp toàn bộ việc theo mức độ ưu tiên, hạn xử lý rồi nhóm trước khi lấy từng trang 10 việc. Việc cần ưu tiên không bị chìm ở trang sau khi dữ liệu API chưa được sắp thứ tự.
- Sau thao tác D1, GET lại rồi xác minh task key, trạng thái hoặc hạn xử lý và dấu hiệu persistence D1. Nếu chỉ POST thành công nhưng GET thất bại hoặc trạng thái chưa khớp, thông báo chưa xác minh; không báo đã lưu chắc chắn và không tự động POST lần nữa.
- Cập nhật cách tách tên tiếng Việt khỏi evidence (tránh dùng word boundary ASCII ở cuối từ có dấu). Các thay đổi nằm trong CMS, không sửa D1 schema, OAuth, dữ liệu chuyên trách hoặc triggers.
- QA bổ sung tình huống việc ưu tiên nằm cuối danh sách hơn 10 việc và tình huống GET chưa xác minh được dữ liệu D1. Vẫn giữ Draft, không merge production khi chưa có xác nhận phát hành.

### QA fixture correction (27/09/2026)
Sau khi thêm kiểm tra POST → GET bền vững, mock Playwright phải phản ánh API thật: đánh dấu `persistence:"d1"` cho task ngay sau khi POST ghi thành công. Lần QA đầu phát hiện thiếu trường này ở fixture, không phải lỗi schema D1. Đây là sửa test, không thay đổi endpoint hoặc logic production.


## Editorial Desk UX - đọc, xem cấu trúc và sửa theo từng bài
Bài viết nay có thư viện riêng, tìm không dấu và chỉ render form đầy đủ của một bài được chọn. Mặc định mở **Đọc bài** để rà mạch nội dung, ảnh, chú thích và nguồn; **Cấu trúc** cho thấy các phần và nút đi thẳng tới đoạn cần sửa; **Biên tập** giữ nguyên trường dữ liệu và cơ chế lưu nháp/PR đang dùng. Mã bài, crop cover và thời gian đọc đưa vào khối nâng cao. Các nút xóa/nhân bản/di chuyển ẩn trong vùng Quản lý bài. Bài mới mở thẳng chế độ sửa, deep link record từ Quality mở đúng bài và trường. Mobile xếp danh sách bài phía trên, chỉ hiện danh sách ngắn có cuộn. Không đổi schema, API, OAuth, D1, trang public, CDN/Workers hay trigger.

Demo tĩnh: `/admin/story-desk-preview.html` - dữ liệu minh họa, không gọi CMS API. QA: Unit render/xss/chọn bài/tìm tiếng Việt + Playwright desktop/mobile, tích hợp trong cổng CMS QA hiện hữu.
