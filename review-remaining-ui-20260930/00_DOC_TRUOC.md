# OPEN PHU QUOC - BỘ MARKDOWN CUỐI CHO NHỮNG ĐOẠN CHƯA DUYỆT
Ngày xuất: 30/09/2026 · Nguồn: nhánh PR #281 cộng phần chưa sửa của website.

**ĐÚNG PHẠM VI:** Bộ **150 bài Cẩm nang đã duyệt hôm qua** và **39 thẻ Khám phá vừa duyệt** được giữ nguyên, KHÔNG xuất lại và không nhờ luồng biên tập khác làm lại.

## Mở những file này trước
1. `01_CHI_TIET_KHAM_PHA/`: **29 bài giải thích sâu** ở trang chi tiết dưới các ô Chọn nhanh / Hợp khi / Trước khi đi. Đây chính là phần dài mà cậu khoanh trong ảnh Symphony of the Sea, KHÁC với tóm tắt 39 thẻ đã chốt.
2. `05_FOOTER/00_FOOTER_TONG_HOP_DE_SUA.md`: bản **footer tổng hợp** để cậu sửa một lần, không phải dò khắp trang.
3. `03_CAU_CHU_CAC_TRANG/`: trang chủ, Về chúng tôi, Ẩm thực, Câu chuyện, Điểm tham quan, Khách sạn, GO, Tiện ích, Quanh đây.
4. `02_NHAN_GIAO_DIEN/01_NHAN_CHUNG_VA_CHI_TIET.md`: nhãn tiêu đề/nút giao diện, trong đó có phần "Vì sao nơi này đáng hiểu" như ảnh.
5. `04_NHANH_TRONG_HTML/` và `06_NHAN_TRONG_JAVASCRIPT/`: **vòng đối chiếu sau cùng**, một số đoạn có thể trùng hoặc mang tính vận hành. Khi trùng với bộ đã duyệt, chỉ đánh dấu GIỮ NGUYÊN. Không cần viết lại để cho có.
6. `05_FOOTER/01_...` đến `03_...`: kiểm tra các footer nằm trực tiếp trong HTML (khác footer dữ liệu đã tổng hợp).

## Những phần KHÔNG làm lại
- 150/150 bài Cẩm nang đã duyệt.
- 39/39 thẻ Khám phá và trải nghiệm: giới thiệu ngắn, Hợp khi, Trước khi đi, mẹo.
- Nội dung ba vùng, chọn khách sạn/lịch trình, 8 tình huống Cẩm nang và Hero đã được duyệt ở PR #281.
- Dữ liệu GPS, bản đồ, nguồn ảnh và điều kiện dùng ảnh; giá/giờ vận hành, dữ liệu động, thông tin đã được duyệt ở luồng Weather/Airport/Transit.
- Bản dịch các ngôn ngữ khác để ở đợt riêng sau khi chốt tiếng Việt.

## 29 bài giải thích sâu có nghĩa là sao?
Hệ thống có 39 thẻ nhưng hiện chỉ có 29 bản bài giải thích sâu trong `data/i18n/vi/place-explainers.json`. **11 thẻ chưa có bài giải thích sâu riêng** (lớp "các suối khác" là bài gom nhóm). Đây là khoảng trống về độ phủ, KHÔNG tự sinh bài hư cấu cho đủ số; danh sách ở `DANH_SACH_CON_THIEU.md`.

## Quy tắc biên tập
- Giữ nguyên phong cách gần gũi của cậu, chỉ chỉnh câu chữ thật sự cần. Không lạm dụng sửa lại từ đầu.
- Giữ tên file, thứ tự và dòng `ENTITY_ID`. Đừng gộp bài hoặc xóa đề mục.
- Khi thấy lỗi địa lý, lịch sử, thời tiết, giá, lịch diễn, quy định hay mâu thuẫn, viết vào `GHI_CHU_CAN_XAC_MINH.md` thay vì tự đặt thông tin mới.
- Các bản trích câu HTML/JavaScript là **chỉ rà chữ**, không được nhập tự động bằng tìm-thay nếu có bản trùng hoặc câu vận hành.
- Toàn bộ phần mapping kỹ thuật và mã nguồn chuẩn được lưu ở **nhánh GitHub**. Không cần mở lúc biên tập.

## Bàn giao
Cậu có thể gửi toàn bộ ZIP đã chỉnh hoặc chỉ gửi 5 file `01_CHI_TIET_KHAM_PHA` + `05_FOOTER/00_FOOTER_TONG_HOP_DE_SUA.md` trước. Tớ đối chiếu **latest main**, PR #281, source SHA trước khi tạo bản vá; **không merge/deploy** chỉ vì đã sửa Markdown.
