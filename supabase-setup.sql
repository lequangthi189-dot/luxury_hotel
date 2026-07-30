-- Chạy phần này SAU script tạo bảng LAB 3.
-- Bổ sung quyền cho đúng 3 luồng: đặt phòng, tra cứu/check-in và trả phòng.
-- Các policy dưới đây phù hợp cho prototype môn học dùng anon key.

alter table public.khach_hang enable row level security;
alter table public.dat_phong enable row level security;

grant select, insert, update on public.khach_hang to anon, authenticated;
grant select, insert, update on public.dat_phong to anon, authenticated;
grant update on public.phong to anon, authenticated;

drop policy if exists "doc_khach_hang" on public.khach_hang;
create policy "doc_khach_hang"
on public.khach_hang
for select
to anon, authenticated
using (true);

drop policy if exists "them_khach_hang" on public.khach_hang;
create policy "them_khach_hang"
on public.khach_hang
for insert
to anon, authenticated
with check (true);

drop policy if exists "sua_khach_hang" on public.khach_hang;
create policy "sua_khach_hang"
on public.khach_hang
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "doc_dat_phong" on public.dat_phong;
create policy "doc_dat_phong"
on public.dat_phong
for select
to anon, authenticated
using (true);

drop policy if exists "them_dat_phong" on public.dat_phong;
create policy "them_dat_phong"
on public.dat_phong
for insert
to anon, authenticated
with check (true);

drop policy if exists "sua_dat_phong" on public.dat_phong;
create policy "sua_dat_phong"
on public.dat_phong
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "sua_trang_thai_phong" on public.phong;
create policy "sua_trang_thai_phong"
on public.phong
for update
to anon, authenticated
using (true)
with check (true);

-- Dữ liệu khách sạn demo
insert into public.khach_san (
  makhachsan,
  tenkhachsan,
  loaihinhkhachsan,
  giaphongtrungbinh,
  sophongtrongconlai,
  sosao,
  diemdanhgia,
  soluotdanhgia,
  diachi
) values
  ('KS01', 'Central Palace Hotel', 'Hotel', 2166666.67, 3, 5, 9.20, 1254, 'Quận 1, TP. Hồ Chí Minh'),
  ('KS02', 'Lotus Boutique Hotel', 'Hotel', 1450000.00, 2, 4, 8.70, 874, 'Quận 3, TP. Hồ Chí Minh'),
  ('KS03', 'Riverside Grand', 'Hotel', 2300000.00, 2, 5, 9.00, 649, 'Thủ Đức, TP. Hồ Chí Minh')
on conflict (makhachsan) do update set
  tenkhachsan = excluded.tenkhachsan,
  loaihinhkhachsan = excluded.loaihinhkhachsan,
  giaphongtrungbinh = excluded.giaphongtrungbinh,
  sophongtrongconlai = excluded.sophongtrongconlai,
  sosao = excluded.sosao,
  diemdanhgia = excluded.diemdanhgia,
  soluotdanhgia = excluded.soluotdanhgia,
  diachi = excluded.diachi;

-- Dữ liệu phòng demo
insert into public.phong (
  maphong,
  makhachsan,
  tenphong,
  loaiphong,
  dientich,
  giaphongtrungbinh,
  sokhachtoida,
  soluonggiuong,
  loaigiuong,
  dichvudikem,
  trangthaiphong
) values
  ('P1201', 'KS01', 'Deluxe City View', 'Deluxe', 32, 1850000, 2, 1, 'King', 'Buffet sáng, hồ bơi, phòng gym, dọn phòng hằng ngày', 'Trống'),
  ('P1202', 'KS01', 'Superior Twin', 'Superior', 28, 1450000, 2, 2, 'Single', 'Buffet sáng, hồ bơi, dọn phòng hằng ngày', 'Trống'),
  ('P1301', 'KS01', 'Suite Sky Garden', 'Suite', 55, 3200000, 3, 1, 'King', 'Buffet sáng, hồ bơi, phòng gym, đưa đón sân bay', 'Trống'),
  ('P2101', 'KS02', 'Boutique Standard', 'Standard', 24, 1250000, 2, 1, 'Double', 'Buffet sáng, dọn phòng hằng ngày', 'Trống'),
  ('P2102', 'KS02', 'Boutique Deluxe Garden', 'Deluxe', 30, 1650000, 2, 1, 'Queen', 'Buffet sáng, dọn phòng hằng ngày, xe đưa đón', 'Trống'),
  ('P3101', 'KS03', 'Riverside Deluxe', 'Deluxe', 30, 1650000, 2, 1, 'Queen', 'Buffet sáng, hồ bơi vô cực, dọn phòng hằng ngày', 'Trống'),
  ('P3201', 'KS03', 'Riverside Suite', 'Suite', 50, 2950000, 4, 1, 'King', 'Buffet sáng, hồ bơi vô cực, phòng gym, dọn phòng hằng ngày', 'Trống')
on conflict (maphong) do update set
  makhachsan = excluded.makhachsan,
  tenphong = excluded.tenphong,
  loaiphong = excluded.loaiphong,
  dientich = excluded.dientich,
  giaphongtrungbinh = excluded.giaphongtrungbinh,
  sokhachtoida = excluded.sokhachtoida,
  soluonggiuong = excluded.soluonggiuong,
  loaigiuong = excluded.loaigiuong,
  dichvudikem = excluded.dichvudikem,
  trangthaiphong = excluded.trangthaiphong;

select * from public.khach_san order by makhachsan;
select * from public.phong order by maphong;
