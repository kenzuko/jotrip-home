# CMS - sửa bài ngay khi đọc (27/09/2026)

Trang áp dụng: cms.openphuquoc.com/stories/article.html?id=.... Chỉ tài khoản admin/editor có phiên đăng nhập cùng miền thấy nút chỉnh sửa. Không cấp quyền công khai hay sử dụng OAuth trên miền khác.

Chọn Sửa đoạn này, soạn trực tiếp trong dòng đọc; bản xem ngay bên trên. Auto-save trên thiết bị, cùng localStorage key với CMS V1.3; chặn ghi đè nháp khác/tab khác và cung cấp nút tải bản sao JSON. Kiểm tra lại phiên bản bài trên CDN so với main trước khi sửa. Gửi duyệt bắt buộc gọi edit-state (complete, SHA, pending PR), xác nhận rồi gọi publish hiện hữu để tạo PR. Không tự merge, không tự xuất bản.

Bố cục bài, ảnh và nguồn nâng cao có liên kết mở đúng bài trong CMS Editor V2. Không thay đổi API hay D1. QA mới: unit và browser mock trên desktop/iPhone (đã đăng nhập và ẩn với khách); cần thử OAuth thực sau deploy.
