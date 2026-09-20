# Open Phu Quoc V3 - Chat continuation handoff

Ngày cập nhật: 20/09/2026

Tài liệu này là điểm tiếp quản cho luồng Chat khi Work hết quota. Không yêu cầu người dùng kể lại lịch sử. Hãy đọc file này, kiểm tra `main` mới nhất và tiếp tục từ mục "Việc tiếp theo".

## 1. Trạng thái repo và môi trường

- Repo: `kenzuko/jotrip-home`
- Nhánh V3 ban đầu: `feat/openpq-superapp-v3`
- PR #2 đã được người dùng cho phép merge để test chung. PR hiện đã merged và closed.
- Nhánh đang nhận các bản sửa kiểm thử: `main`
- Commit chức năng gần nhất trước tài liệu này: `0fc1f32f954317837d68b557c2ccc1428045bec6`
- Worker: `openphuquoc-v3`
- URL dùng để QA bản mới nhất của `main`: `https://main-openphuquoc-v3.kenzuko.workers.dev/`
- `https://openphuquoc-v3.kenzuko.workers.dev/` có thể vẫn là bản Worker production được ghim cũ. Không ép cập nhật URL này.
- Không dùng Netlify.
- Không đổi production DNS trước khi visual QA đạt và người dùng duyệt.

## 2. Hướng sản phẩm đã khóa

Open Phu Quoc là một hệ điều hành điểm đến nhỏ cho người đang đi, sắp đi hoặc đang ở Phú Quốc:

`Search + Today + Live + Map + Utilities + Destination Knowledge`

Không quay lại dạng landing page dài theo chuỗi `hero -> section -> section -> gallery -> footer`.

- Desktop là app shell.
- Mobile là luồng sử dụng riêng, không phải desktop thu nhỏ.
- Operational và live đứng trước editorial.
- Editorial tạo bối cảnh và cảm xúc, không che cảnh báo vận hành.

## 3. Quy tắc dữ liệu không được phá

- Một entity chỉ có một canonical ID.
- Search, Explore, Today, Place Detail và Map phải dùng cùng ID.
- Handbook R3 chỉ là editorial seed và context.
- Giá, giờ diễn, thời tiết, sân bay, tàu, phà và vận hành không lấy handbook làm current truth.
- Official hoặc live source ưu tiên hơn handbook.
- Không hiển thị raw handbook corpus như data model của giao diện.
- Không tự đặt current price, lịch diễn, số vé, tọa độ hay live status.
- Model không được gọi là quan trắc.
- Dữ liệu thiếu hoặc stale không được gọi là bình thường hay đang hoạt động.
- Cano, tàu cao tốc và phà là ba trạng thái độc lập. Không suy trạng thái cano từ thời tiết, tàu cao tốc hoặc phà.
- Weather chuyên môn thuộc JoTrip Lab Weather V2. Open Phu Quoc chỉ trình bày kết quả phân loại.

## 4. Brand và ngôn ngữ

- Logo duy nhất: `assets/logo-master.png`
- Logo nền trong suốt, tâm Melo Orange, giữ đúng master, không redraw.
- Màu chính: Sea Ink, Melo Orange, Pearl Ivory, Shell Mint.
- Viết tiếng Việt tự nhiên cho khách. Tránh từ nội bộ như data layer, AutoSync, entity, handbook note trong giao diện khách.
- Không dùng chữ quá nhỏ. Nội dung phụ quan trọng nên từ 13px trở lên; nhãn uppercase có thể 11-12px nhưng phải rõ.
- Không dùng em dash trong copy mới. Dùng dấu gạch nối thông thường hoặc viết lại câu.

## 5. Các phần đã hoàn thành

### Nền tảng

- Entity layer chuẩn hóa, 296 entity và ID duy nhất.
- Handbook coverage 17/17.
- Search index từ entity layer.
- Search result grouping theo entity graph đã hoạt động.
- Today engine, Weather V2 contract, Explore, Place Detail và Utilities đã nối dữ liệu thật.
- Validation scripts và Cloudflare build đang chạy.

### Trang chủ và hệ sinh thái

- App shell desktop và navigation mobile đã được dựng.
- Homepage đã giảm cảm giác landing page, ưu tiên Search, Today, Live và các lối vào theo nhu cầu.
- Logo master đã được rà toàn bộ HTML.
- Clock Việt Nam và footer dùng chung qua `island-clock.js` đã được cải thiện.
- Practical information trên homepage đã được bố cục lại và tăng cỡ chữ.
- Airport internal route đã có cơ chế live-first, snapshot fallback và ngôn ngữ rõ hơn.

### Search QA

Các truy vấn chính đã pass:

- `hon thom`, `hòn thơm`
- `cau hon`, `Cầu Hôn`
- `HB`
- `visa`
- `Regent`
- `tau cao toc`
- `APEC`
- `Kiss of the Sea`
- `gia hon thom`

Hòn Thơm và Cầu Hôn đã có cluster kết quả thay vì danh sách phẳng.

### Hotels

- Danh sách khách sạn hiện có luồng chọn ba bước.
- Đã ẩn nhóm phân loại nội bộ "Khác / cần rà" khỏi khách.
- Có best-for tags và lời giải thích phân loại thân thiện hơn.
- Bài riêng cho khách sạn 3 sao trở lên chưa làm vì người dùng sẽ gửi danh sách sau.
- Khi nhận danh sách, chỉ lấy ảnh và thông tin từ website chính thức của từng khách sạn, ghi nguồn và không tự suy tiện ích.

### Transport và live

- Có `data/views/live-bindings.json`:
  - `access_air -> live_airport`
  - `access_airport_transfer -> live_airport`
  - `access_fast_boat -> live_transport`, category `fast_boat`
  - `access_ferry -> live_transport`, category `ferry`
- Trang Ferry có ba thẻ vận hành độc lập: Cano, Tàu cao tốc, Phà.
- URL filter hỗ trợ `date`, `route`, `operator`, `mode`.
- Phu Quoc Express đã có trong dữ liệu và lối dẫn chính thức.
- Trạng thái vé hiện chỉ ở mức tổng hợp nếu có bằng chứng: còn, gần hết, hết. Không giả số ghế.
- Bus chỉ hiển thị lịch và nguồn công khai. Không tuyên bố bus live khi chưa có feed vị trí được phép sử dụng.

### Địa điểm và giá

- `data/views/place-planning-levels.json` phân vai điểm đến.
- Aquatopia là Vai trò 2 - Trải nghiệm chủ đích, nên ghép trong ngày Hòn Thơm.
- Detail có thể kế thừa tham chiếu giá từ cụm trải nghiệm cha khi không có giá trực tiếp.
- Giao diện nhắc kiểm tra ngày, chiều cao, tuổi và quyền lợi trước khi thanh toán.
- Không tạo giá mới nếu nguồn chưa xác nhận.

### Readability vừa sửa

- `live-module-v2.css` tăng cỡ chữ cho Ferry, Bus, Cano và các module dùng chung.
- Explore, Places, Place Detail, Food đã nạp baseline này.
- Stories đã tăng cỡ chữ cho card, metadata, caption, source, note và footer.
- Stories đã thay lời kỹ thuật về live data bằng hướng dẫn tự nhiên cho khách.

## 6. Trạng thái cano và bản tin biển

Người dùng xác nhận cano An Thới lúc 06:00 là "Đang hoạt động" và cung cấp bản tin dự báo biển của cơ quan chức năng ngày 20/09/2026. Người dùng nói thông báo vận hành có thể chỉ đi kèm bản tin, không có tài liệu riêng.

Tuy nhiên:

- Không dùng bản tin thời tiết một mình để suy cano hoạt động.
- Marine Ops hiện vẫn có thể trả `FIELD_REQUIRED` hoặc `Cần xác nhận` nếu chưa lưu được bằng chứng xác nhận vận hành rõ ràng.
- Nếu cập nhật JoTrip Lab, phải lưu nguồn do người dùng xác nhận, thời điểm 06:00, ngày 20/09/2026, phạm vi An Thới và mô tả bằng chứng ngắn.
- Chỉ đưa lên Open Phu Quoc khi record marine_ops đã hợp lệ. Nếu chưa cập nhật được source layer, giữ `Cần xác nhận`.
- Bản tin biển có ngày có, ngày không. Nếu có thì lưu để đối chiếu dự báo sau này. Không ép ngày nào cũng phải có.
- Luồng xác nhận 06:00 nên thực hiện trong Chat theo mong muốn của người dùng.

## 7. Visual QA đã làm và chưa làm

Đã kiểm tra trực tiếp trên Worker:

- Ferry desktop: ba trạng thái độc lập, deep link mode hoạt động, không overflow.
- Aquatopia detail desktop: role, watchout và giá kế thừa hiển thị đúng, không overflow.
- Homepage desktop đã được xem ở kích thước xấp xỉ 1366px và bố cục được sửa theo feedback.

Chưa được coi là pass hoàn toàn:

- Desktop 1366 x 768 và 1440 x 900 cần một vòng chụp/soát cuối trên commit mới nhất.
- Mobile 390 x 844 và 430 x 932 chưa được visual QA đầy đủ bằng viewport thật.
- Cần kiểm tra Search dropdown, Today cards, status rail, Explore filters và Place Detail trên mobile.
- Không được ghi Definition of Done là hoàn tất trước khi các mục này pass.

## 8. Việc tiếp theo theo thứ tự

1. Kiểm tra CI của commit mới nhất trên `main`.
2. Mở `https://main-openphuquoc-v3.kenzuko.workers.dev/` và visual QA:
   - `/`
   - `/explore/`
   - `/places/`
   - `/places/detail?id=aquatopia`
   - `/food/`
   - `/stories/`
   - một bài `/stories/article.html?id=...`
   - `/ferry/`
   - `/bus/`
   - `/cano/`
3. Kiểm tra không horizontal overflow và cỡ chữ thực tế.
4. Audit những chuỗi kỹ thuật còn lộ ra UI bằng:
   - `rg -n "handbook|entity|data layer|AutoSync|READY|QA PASS|FIELD_REQUIRED" --glob '*.{html,js,css,json}'`
   - Chỉ sửa chuỗi hiển thị cho khách, không xóa metadata/provenance cần thiết trong data.
5. Audit footer và logo tại About, Stories, Weather, Airport, Bus, Cano và Ferry.
6. Bổ sung ảnh chỉ khi xác định đúng địa điểm và có quyền/nguồn phù hợp.
7. Chờ danh sách khách sạn từ người dùng trước khi làm bài riêng.
8. Chuẩn hóa tọa độ trước Map:
   - `lat`
   - `lon`
   - `map_precision`
   - `source`
   Hiện chỉ có rất ít entity đủ tọa độ tin cậy. Không dựng map giả.

## 9. Lệnh kiểm tra

Chạy tại root repo:

```bash
node scripts/build-search-index.mjs
node scripts/validate-data.mjs
node scripts/test-search.mjs
node scripts/build-cloudflare.mjs
git diff --check
```

Kiểm tra syntax cho file JS vừa sửa bằng `node --check <file>`.

## 10. Definition of Done còn mở

- [ ] Desktop visual QA pass ở cả hai viewport yêu cầu
- [ ] Mobile visual QA pass ở cả hai viewport yêu cầu
- [x] Search query list pass
- [x] Explore filter logic pass ở mức code và browser cơ bản
- [x] Place Detail logic pass ở mức code và browser desktop cơ bản
- [ ] Weather freshness wording pass toàn bộ trang
- [ ] Airport missing-data behavior pass lần cuối trên live URL
- [ ] Ferry missing-data behavior pass lần cuối
- [ ] Không horizontal overflow mobile
- [ ] User duyệt visual
- [ ] Không đổi production DNS trước khi user duyệt

## 11. Những việc không làm

- Không dùng Netlify.
- Không đổi production DNS.
- Không fork Weather engine.
- Không scrape gây tải hoặc vượt điều khoản của nguồn bus, vé hay khách sạn.
- Không fake live data.
- Không gọi stale là live/current.
- Không invent tọa độ, giá, lịch, số vé.
- Không tạo một bộ entity hoặc search index song song.
- Không redraw logo.
- Không biến mobile thành desktop thu nhỏ.

## 12. Cách trả lời người dùng ở luồng Chat

- Tiếp tục làm việc từ repo và URL trên, không bắt người dùng kể lại.
- Báo ngắn theo kết quả đã làm, tránh danh sách kỹ thuật dài nếu chưa cần.
- Nếu không có quyền ghi repo hoặc browser, nói rõ giới hạn và đưa đúng bước tiếp theo có thể thực hiện.
- Khi một mục chỉ mới code-pass nhưng chưa visual-pass, phải nói đúng là chưa hoàn tất.

## 13. Feedback hình ảnh cuối cùng lúc chuyển sang Chat

Ảnh người dùng gửi lúc 17:05 ngày 20/09/2026 cho thấy homepage desktop tại `cms.openphuquoc.com` vẫn còn lỗi cân chỉnh ở cụm 5 lối vào theo nhu cầu:

- Hiện đang xếp thành 3 thẻ hàng trên và 2 thẻ hàng dưới.
- Hàng dưới để trống một ô bên phải nên toàn khối bị lệch, tạo khoảng trắng lớn và làm mạch đọc bị đứt.
- Cụm này nằm quá xa khối hero và context rail, chưa tạo cảm giác là navigation tiếp nối ngay sau Search/Live.
- Thẻ số và nội dung chưa thẳng hàng hoàn toàn theo một baseline.

Hướng sửa đã chốt và Work đã triển khai:

- Desktop từ 900px: 5 tab trên cùng một hàng, chia đều chiều rộng và cùng chiều cao.
- Tablet 761-899px: 3 + 2, hai thẻ hàng cuối cân giữa, không để ô trống lệch về một bên.
- Mobile: rail ngang 5 tab, snap từng thẻ, thao tác một tay; không ép thành lưới chữ nhỏ.
- Đã giảm khoảng trắng phía dưới cụm tab và nối gần hơn tới phần "Có gì hôm nay".
- Giữ thứ tự: Tôi đang ở Phú Quốc, Tôi sắp đến, Đi đâu hôm nay, Ăn gì, Di chuyển & trợ giúp.
- Không thêm tab thứ sáu chỉ để lấp chỗ trống.

Commit giao diện homepage: `d4afa4b12a598c1b9851375b00c4f3bdd8ea2c69`.

Commit trước đó gồm tối ưu `/airport`: tải nguồn trực tiếp và snapshot song song, fallback sau 2,5 giây, đồng thời đổi copy kỹ thuật thành ngôn ngữ khách hàng.

## 14. Phần giao cho luồng Chat tiếp tục

Luồng Chat có thể tiếp tục các phần không đòi hỏi thay đổi kiến trúc lớn:

1. Mở Worker sau khi Cloudflare build xong và QA trực quan homepage ở desktop và mobile.
2. So sánh ảnh mới với feedback tại mục 13, ghi rõ pass hoặc lỗi còn lại.
3. Rà ngôn ngữ khách hàng còn mang tính kỹ thuật và lập danh sách câu cần thay.
4. Rà mạch đọc giữa Search, Live, 5 lối vào, Today và phần nội dung phía dưới.
5. Chuẩn bị checklist nhận danh sách khách sạn, nhưng chưa viết bài khách sạn khi người dùng chưa gửi danh sách.
6. Chuẩn bị kế hoạch ảnh theo từng module, chỉ dùng ảnh xác định đúng địa điểm và có nguồn phù hợp.
7. Theo dõi trạng thái CI/Cloudflare và báo nếu build fail.

Những phần Chat không được tự làm nếu không có công cụ ghi repo hoặc nguồn xác minh:

- Không tự cập nhật live status.
- Không tự tạo giá, giờ vận hành, inventory vé hoặc tọa độ.
- Không thay Weather engine.
- Không đổi DNS hoặc Worker production.
- Không đánh dấu mobile visual QA pass nếu chưa thật sự mở đúng viewport.
