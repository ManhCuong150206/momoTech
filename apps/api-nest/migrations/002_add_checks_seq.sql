-- Thứ tự chèn đơn điệu. created_at có thể trùng khi hai lần lưu rất sát nhau,
-- nên danh sách và việc giữ N bản ghi mới nhất sắp theo seq.
alter table checks add column seq bigserial;
create index checks_device_seq_idx on checks (device_hash, seq desc);