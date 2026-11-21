-- Lịch sử tra cứu. Mỗi dòng thuộc về một thiết bị (băm của mã ẩn danh trong cookie).
-- Không lưu email, tên hay số điện thoại. Nội dung lời mời có trong `invitation_text`
-- nên bản ghi tự hết hạn theo `expires_at` và người dùng xóa được bất kỳ lúc nào.
create table checks (
  id                uuid primary key default gen_random_uuid(),
  device_hash       text not null,
  mode              text not null check (mode in ('simulated', 'live')),
  title             text not null,
  invitation_text   text not null,
  job_url           text,
  confirmed         jsonb not null,
  result            jsonb not null,
  job_status        text not null,
  location_status   text not null,
  invitation_status text not null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null
);

create index checks_device_created_idx on checks (device_hash, created_at desc);
create index checks_expires_idx on checks (expires_at);