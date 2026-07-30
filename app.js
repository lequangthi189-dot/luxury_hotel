/* Dữ liệu nghiệp vụ được tải từ Supabase. */
let HOTELS = [];
let ROOMS = [];
let bookings = [];
let serviceOrders = [];
let SERVICES = {};
let bookingCounter = 0;
let invoiceCounter = 45;

// Trạng thái làm việc hiện tại
let searchState = {location:'TP. Hồ Chí Minh', checkin:'', checkout:'', guests:2};
let selectedHotelId = null;
let selectedRoomId = null;
let ciBooking = null;

function mapHotel(row){
  const imageByHotel = {
    KS01: 'hotel-central',
    KS02: 'hotel-lotus',
    KS03: 'hotel-riverside',
  };
  return {
    id: row.makhachsan,
    name: row.tenkhachsan,
    shortName: row.tenkhachsan,
    address: row.diachi || '',
    city: cityKeyFromText(row.diachi || ''),
    stars: Number(row.sosao || 0),
    rating: `${Number(row.diemdanhgia || 0).toLocaleString('vi-VN')}/10`,
    reviews: Number(row.soluotdanhgia || 0),
    amenities: '',
    img: imageByHotel[row.makhachsan] || 'hotel-central',
  };
}
function mapRoom(row){
  const normalizedType = removeDiacritics(row.loaiphong || '').toLowerCase();
  let imageClass = 'room-deluxe';
  if (normalizedType.includes('superior') || normalizedType.includes('standard')) imageClass = 'room-superior';
  if (normalizedType.includes('suite')) imageClass = 'room-suite';
  return {
    id: row.maphong,
    hotelId: row.makhachsan,
    name: row.tenphong,
    type: row.loaiphong,
    price: Number(row.giaphongtrungbinh || 0),
    bedType: row.loaigiuong || '',
    bedCount: Number(row.soluonggiuong || 0),
    beds: `${Number(row.soluonggiuong || 0)} ${row.loaigiuong || 'giường'}`,
    capacity: Number(row.sokhachtoida || 1),
    area: Number(row.dientich || 0),
    desc: '',
    services: row.dichvudikem || '',
    amenities: [],
    status: row.trangthaiphong || 'Trống',
    img: imageClass,
  };
}
function mapBooking(row, customers){
  const customer = customers.find(x => x.makhachhang === row.makhachhang) || {};
  const room = ROOMS.find(x => x.id === row.maphong);
  const nights = Number(row.sodemo || nightsBetween(row.ngayden, row.ngaydi));
  const roomTotal = nights * Number(room?.price || 0);
  const vat = roomTotal * 0.1;
  return {
    code: row.madatphong,
    hotelId: room?.hotelId || '',
    roomId: row.maphong,
    name: customer.hoten || row.tenkhachdaidien || '',
    phone: customer.sodienthoai || '',
    cccd: customer.socccd || row.socccddaidien || '',
    email: '',
    checkin: row.ngayden,
    checkout: row.ngaydi,
    guests: 1,
    note: '',
    status: row.trangthaidon,
    nights,
    roomTotal,
    vat,
    total: roomTotal + vat,
    key: row.machiakhoa || '',
  };
}
async function loadDatabaseData(){
  const [hotelResult, roomResult, customerResult, bookingResult] = await Promise.all([
    window.supabaseClient.from('khach_san').select('*'),
    window.supabaseClient.from('phong').select('*'),
    window.supabaseClient.from('khach_hang').select('*'),
    window.supabaseClient.from('dat_phong').select('*'),
  ]);
  const firstError = [hotelResult, roomResult, customerResult, bookingResult].find(x => x.error)?.error;
  if (firstError) throw firstError;

  HOTELS = (hotelResult.data || []).map(mapHotel);
  ROOMS = (roomResult.data || []).map(mapRoom);
  bookings = (bookingResult.data || []).map(row => mapBooking(row, customerResult.data || []));
  bookingCounter = bookings.length;
}

/* ============================================================
   TIỆN ÍCH
   ============================================================ */
function fmt(n){ return Math.round(n).toLocaleString('vi-VN') + 'đ'; }
function removeDiacritics(str){
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi, m => m === 'Đ' ? 'D' : 'd');
}
// Nhận diện tên thành phố người dùng gõ (có dấu/không dấu/viết tắt đều ra cùng 1 mã)
function cityKeyFromText(text){
  const t = removeDiacritics(text || '').toLowerCase();
  if (t.includes('ho chi minh') || t.includes('hcm') || t.includes('sai gon')) return 'hcm';
  if (t.includes('ha noi') || t.includes('hn')) return 'hn';
  if (t.includes('da nang')) return 'dn';
  return t.trim();
}
function nightsBetween(ci, co){
  const d1 = new Date(ci), d2 = new Date(co);
  return Math.round((d2 - d1) / 86400000);
}
function localDateValue(date){
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function getHotel(id){ return HOTELS.find(h => h.id === id); }
function getRoom(id){ return ROOMS.find(r => r.id === id); }
function hotelRooms(hotelId){ return ROOMS.filter(r => r.hotelId === hotelId); }

// Một phòng được coi là TRỐNG trong khoảng ngày [ci, co) nếu không trùng
// với bất kỳ đặt phòng nào đang còn hiệu lực (chưa trả phòng / chưa hủy).
function isRoomAvailable(roomId, ci, co, ignoreCode){
  const room = getRoom(roomId);
  if (!room || room.status === 'Bảo trì' || room.status === 'Đang sửa chữa') return false;
  return !bookings.some(b =>
    b.roomId === roomId &&
    b.code !== ignoreCode &&
    b.status !== 'Đã trả phòng' &&
    b.status !== 'Hoàn tất' &&
    b.status !== 'Đã hủy' &&
    (new Date(ci) < new Date(b.checkout)) && (new Date(co) > new Date(b.checkin))
  );
}
function availableCount(hotelId, ci, co){
  return hotelRooms(hotelId).filter(r => isRoomAvailable(r.id, ci, co)).length;
}
function showToast(msg, danger){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('danger', !!danger);
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove('show'), 3200);
}
function imgClass(img){ return 'img' + (img ? ' ' + img : ''); }

/* ============================================================
   ĐIỀU HƯỚNG MÀN HÌNH
   ============================================================ */
const meta = {
  home:['Trang chủ','Tìm kiếm khách sạn và phòng phù hợp'],
  hotels:['Danh sách khách sạn','Lọc và so sánh kết quả'],
  rooms:['Danh sách phòng còn trống','Chọn phòng phù hợp tại khách sạn'],
  roomdetail:['Thông tin phòng','Xem chi tiết, tiện ích và dịch vụ đi kèm'],
  booking:['Đặt phòng','Nhập thông tin và xác nhận'],
  checkin:['Tra cứu / Check-in','Tra cứu đơn và phân phòng'],
  service:['Dịch vụ phòng','Ghi nhận dịch vụ phát sinh'],
  checkout:['Trả và kiểm tra phòng','Hoàn tất quy trình trả phòng'],
  invoice:['Hóa đơn','Tổng hợp và thanh toán'],
  review:['Đánh giá','Đánh giá sạch sẽ và đăng bài'],
  report:['Báo cáo','Thống kê hiệu quả vận hành'],
};
function show(id){
  document.querySelectorAll('.screen').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(x => x.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const navBtn = document.querySelector(`.nav button[data-page="${id}"]`);
  if (navBtn) navBtn.classList.add('active');
  document.getElementById('title').textContent = meta[id][0];
  document.getElementById('sub').textContent = meta[id][1];
  window.scrollTo(0,0);
  if (id === 'hotels') renderHotels();
  if (id === 'rooms') renderRooms();
  if (id === 'roomdetail') renderRoomDetail();
  if (id === 'report') renderReport();
}
document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => show(b.dataset.page));

/* ============================================================
   1) TÌM PHÒNG (Trang chủ)
   ============================================================ */
function renderFeatured(){
  document.getElementById('featured-hotels').innerHTML = HOTELS.map(h => `
    <article class="card hotel">
      <div class="${imgClass(h.img)}"></div>
      <div class="body">
        <small>${h.address}</small>
        <h4>${h.name}</h4>
        <p>${'★'.repeat(h.stars)} · ${h.reviews} đánh giá</p>
        <div class="price">${fmt(Math.min(...hotelRooms(h.id).map(r=>r.price)))} / đêm</div>
      </div>
    </article>`).join('') || '<p>Chưa có khách sạn trong database.</p>';
}

const today = localDateValue(new Date());
const tomorrowDate = new Date();
tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = localDateValue(tomorrowDate);
document.getElementById('hs-checkin').min = today;
document.getElementById('hs-checkout').min = tomorrow;
document.getElementById('hs-checkin').value = today;
document.getElementById('hs-checkout').value = tomorrow;
searchState = {
  ...searchState,
  checkin: today,
  checkout: tomorrow,
};

document.getElementById('btn-home-search').onclick = () => {
  const loc = document.getElementById('hs-location').value.trim();
  const ci = document.getElementById('hs-checkin').value;
  const co = document.getElementById('hs-checkout').value;
  const guests = parseInt(document.getElementById('hs-guests').value);
  const err = document.getElementById('home-error');
  if (!ci || !co || ci < today || new Date(co) <= new Date(ci)) {
    err.textContent = 'Ngày nhận hoặc ngày trả phòng không hợp lệ. Vui lòng kiểm tra và thử lại.';
    return;
  }
  err.textContent = '';
  searchState = {location: loc, checkin: ci, checkout: co, guests};
  show('hotels');
};

/* ============================================================
   2) DANH SÁCH KHÁCH SẠN (lọc theo kết quả tìm kiếm)
   ============================================================ */
function renderHotels(){
  const nights = nightsBetween(searchState.checkin, searchState.checkout);
  document.getElementById('hotels-daterange').textContent =
    `Đang tìm phòng: ${searchState.checkin} → ${searchState.checkout} (${nights} đêm) · ${searchState.guests} khách${searchState.location ? ' · ' + searchState.location : ''}`;

  const textFilter = document.getElementById('h-search').value.trim().toLowerCase();
  const starsFilter = parseInt(document.getElementById('h-stars').value);
  const sortMode = document.getElementById('h-sort').value;
  const locationKey = cityKeyFromText(searchState.location);

  let list = HOTELS.filter(h => {
    const matchesLocation = !locationKey || h.city === locationKey || removeDiacritics((h.name + h.address)).toLowerCase().includes(locationKey);
    const matchesText = !textFilter || (h.name + h.address).toLowerCase().includes(textFilter);
    const matchesStars = !starsFilter || h.stars === starsFilter;
    return matchesLocation && matchesText && matchesStars;
  });

  list = list.map(h => {
    const suitableRooms = hotelRooms(h.id).filter(r =>
      r.capacity >= searchState.guests &&
      isRoomAvailable(r.id, searchState.checkin, searchState.checkout)
    );
    return {
      ...h,
      minPrice: suitableRooms.length ? Math.min(...suitableRooms.map(r => r.price)) : 0,
      free: suitableRooms.length,
    };
  }).filter(h => h.free > 0);

  if (sortMode === 'low') list.sort((a,b)=>a.minPrice-b.minPrice);
  else if (sortMode === 'high') list.sort((a,b)=>b.minPrice-a.minPrice);

  document.getElementById('hotels-list').innerHTML = list.length ? list.map(h => `
    <article class="card rowcard" data-hotel="${h.id}" style="cursor:pointer">
      <div class="thumb ${imgClass(h.img)}"></div>
      <div class="rowinfo">
        <div>
          <small>${h.address}</small>
          <h3>${h.name}</h3>
          <p>${h.amenities}</p>
          <span class="badge ${h.free>0?'success':'danger'}">${h.free>0 ? 'Còn ' + h.free + ' phòng' : 'Hết phòng'}</span>
        </div>
        <div>
          <h3>${fmt(h.minPrice)}</h3>
          <button class="primary" data-hotel="${h.id}">Xem phòng</button>
        </div>
      </div>
    </article>`).join('') : `<p style="color:var(--muted)">Rất tiếc, không tìm thấy phòng trống nào phù hợp với yêu cầu của bạn. Vui lòng thay đổi thời gian hoặc tiêu chí khác.</p>`;

  // Nhấn vào bất kỳ đâu trên thẻ khách sạn (hoặc riêng nút "Xem phòng") đều mở danh sách phòng
  document.querySelectorAll('#hotels-list [data-hotel]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    selectedHotelId = el.dataset.hotel;
    show('rooms');
  });
}
document.getElementById('btn-hotel-filter').onclick = renderHotels;
document.getElementById('rooms-back').onclick = () => show('hotels');

/* ============================================================
   3) XEM PHÒNG
   ============================================================ */
function renderRooms(){
  const hotel = getHotel(selectedHotelId) || HOTELS[0];
  selectedHotelId = hotel.id;
  document.getElementById('rooms-hotel-card').innerHTML = `
    <div style="display:flex;gap:16px;align-items:center">
      <div class="${imgClass(hotel.img)}" style="width:110px;height:80px;border-radius:12px;flex:none"></div>
      <div>
        <small style="color:var(--muted)">${hotel.address}</small>
        <h3 style="margin:4px 0">${hotel.name}</h3>
        <p style="margin:0;color:var(--muted)">${hotel.amenities}</p>
      </div>
    </div>`;
  document.getElementById('rooms-sub').textContent =
    `Trống trong khoảng ${searchState.checkin} → ${searchState.checkout} · ${searchState.guests} khách`;

  const rooms = hotelRooms(hotel.id).filter(r =>
    r.capacity >= searchState.guests &&
    isRoomAvailable(r.id, searchState.checkin, searchState.checkout)
  );
  document.getElementById('rooms-list').innerHTML = rooms.map(r => {
    return `
    <article class="card hotel">
      <div class="${imgClass(r.img)}"></div>
      <div class="body">
        <span class="badge success">Còn trống</span>
        <h4>${r.name}</h4>
        <p>${r.type} · ${r.area}m² · ${r.beds} · tối đa ${r.capacity} khách</p>
        <div class="price">${fmt(r.price)} / đêm</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="primary" data-detail="${r.id}" style="width:100%">Xem thông tin phòng</button>
        </div>
      </div>
    </article>`;
  }).join('') || `<p style="color:var(--muted)">Rất tiếc, không tìm thấy phòng trống nào phù hợp với yêu cầu của bạn. Vui lòng thay đổi thời gian hoặc tiêu chí khác.</p>`;

  document.querySelectorAll('#rooms-list [data-detail]').forEach(b => b.onclick = () => {
    selectedRoomId = b.dataset.detail;
    show('roomdetail');
  });
}

function ratingLabel(ratingStr){
  const num = parseFloat((ratingStr || '0').replace(',', '.'));
  let word = 'Khá';
  if (num >= 9) word = 'Xuất sắc';
  else if (num >= 8) word = 'Rất tốt';
  else if (num >= 7) word = 'Tốt';
  return `${num.toFixed(1)} - ${word}`;
}
function renderRoomDetail(){
  const r = getRoom(selectedRoomId), h = getHotel(r.hotelId);
  document.getElementById('rd-img-main').className = imgClass(r.img);
  document.getElementById('rd-rating').textContent = ratingLabel(h.rating);
  document.getElementById('rd-hotel').textContent = h.name.toUpperCase();
  document.getElementById('rd-name').textContent = r.name;
  document.getElementById('rd-desc').textContent = r.desc;
  document.getElementById('rd-area').textContent = r.area + ' m²';
  document.getElementById('rd-avgprice').textContent = fmt(r.price);
  document.getElementById('rd-bedtype').textContent = r.bedType;
  document.getElementById('rd-capacity').textContent = r.capacity + ' khách';
  document.getElementById('rd-bedcount').textContent = r.bedCount + ' giường';
  document.getElementById('rd-hotelshort').textContent = h.shortName;
  document.getElementById('rd-roomname2').textContent = r.id;
  document.getElementById('rd-amenities').innerHTML = r.amenities.map(a=>`<span class="chip">${a}</span>`).join('');
  document.getElementById('rd-services').textContent = r.services;

  document.getElementById('rd-checkin').value = searchState.checkin;
  document.getElementById('rd-checkout').value = searchState.checkout;
  document.getElementById('rd-guests').value = `${Math.min(searchState.guests || 1, r.capacity)} người`;
  document.getElementById('rd-error').textContent = '';
  updateRoomDetailPricing();
}
function updateRoomDetailPricing(){
  const r = getRoom(selectedRoomId);
  const ci = document.getElementById('rd-checkin').value;
  const co = document.getElementById('rd-checkout').value;
  const validDates = ci && co && new Date(co) > new Date(ci);
  const free = validDates && isRoomAvailable(r.id, ci, co);
  const statusEl = document.getElementById('rd-status');
  statusEl.textContent = free ? 'Còn phòng' : 'Hết phòng';
  statusEl.style.color = free ? 'var(--success)' : 'var(--danger)';
  const nights = validDates ? nightsBetween(ci, co) : 0;
  const roomTotal = nights * r.price;
  const vat = roomTotal * 0.10;
  document.getElementById('rd-priceline').textContent = `${fmt(r.price)} x ${nights} đêm`;
  document.getElementById('rd-roomtotal').textContent = nights ? fmt(roomTotal) : '—';
  document.getElementById('rd-vat').textContent = nights ? fmt(vat) : '—';
  document.getElementById('rd-total').textContent = nights ? fmt(roomTotal + vat) : '—';
  document.getElementById('rd-book').disabled = !free;
}
['rd-checkin','rd-checkout','rd-guests'].forEach(id =>
  document.getElementById(id).addEventListener('change', updateRoomDetailPricing));
document.getElementById('rd-book').onclick = () => {
  const r = getRoom(selectedRoomId);
  const ci = document.getElementById('rd-checkin').value;
  const co = document.getElementById('rd-checkout').value;
  const guests = parseInt(document.getElementById('rd-guests').value) || 1;
  const err = document.getElementById('rd-error');
  if (!ci || !co || ci < today || new Date(co) <= new Date(ci)) {
    err.textContent = 'Ngày nhận hoặc ngày trả phòng không hợp lệ. Vui lòng kiểm tra và thử lại.';
    return;
  }
  if (guests > r.capacity) { err.textContent = `Phòng chỉ phục vụ tối đa ${r.capacity} khách.`; return; }
  if (!isRoomAvailable(r.id, ci, co)) { err.textContent = 'Phòng đã hết trong khoảng ngày này.'; return; }
  err.textContent = '';
  searchState = {...searchState, checkin: ci, checkout: co, guests};
  goToBooking(r.id);
};
document.getElementById('rd-back').onclick = () => show('rooms');
function closeModal(){ document.getElementById('modal-overlay').classList.remove('show'); }
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });

/* ============================================================
   4) ĐẶT PHÒNG
   ============================================================ */
function goToBooking(roomId){
  selectedRoomId = roomId;
  const r = getRoom(roomId), h = getHotel(r.hotelId);
  document.getElementById('booking-room-note').textContent = `Bạn đang đặt: ${r.name} (${r.type}) tại ${h.name}, ${h.address}`;
  document.getElementById('bk-roomtype').value = `${r.name} · ${fmt(r.price)}/đêm`;
  document.getElementById('bk-guests').value = Math.min(searchState.guests || 2, r.capacity);
  document.getElementById('bk-guests').max = r.capacity;
  document.getElementById('bk-checkin').value = searchState.checkin;
  document.getElementById('bk-checkout').value = searchState.checkout;
  document.getElementById('booking-error').textContent = '';
  updateBookingSummary();
  show('booking');
}
function updateBookingSummary(){
  const r = getRoom(selectedRoomId);
  if (!r) return;
  const h = getHotel(r.hotelId);
  const ci = document.getElementById('bk-checkin').value;
  const co = document.getElementById('bk-checkout').value;
  const n = (ci && co && new Date(co) > new Date(ci)) ? nightsBetween(ci, co) : 0;
  const roomTotal = n * r.price;
  const vat = roomTotal * 0.10;
  document.getElementById('sum-hotel').textContent = h.name;
  document.getElementById('sum-roomtype').textContent = r.type;
  document.getElementById('sum-nights').textContent = n || '—';
  document.getElementById('sum-roomtotal').textContent = n ? fmt(roomTotal) : '—';
  document.getElementById('sum-vat').textContent = n ? fmt(vat) : '—';
  document.getElementById('sum-total').textContent = n ? fmt(roomTotal + vat) : '—';
}
['bk-checkin','bk-checkout'].forEach(id => document.getElementById(id).addEventListener('change', updateBookingSummary));

document.getElementById('btn-booking-cancel').onclick = () => show('rooms');

document.getElementById('confirm').onclick = async () => {
  const err = document.getElementById('booking-error');
  const r = getRoom(selectedRoomId);
  if (!r) { err.textContent = 'Vui lòng chọn một phòng trước khi đặt.'; return; }

  const name = document.getElementById('bk-name').value.trim();
  const phone = document.getElementById('bk-phone').value.trim();
  const cccd = document.getElementById('bk-cccd').value.trim();
  const email = document.getElementById('bk-email').value.trim();
  const guests = parseInt(document.getElementById('bk-guests').value) || 0;
  const ci = document.getElementById('bk-checkin').value;
  const co = document.getElementById('bk-checkout').value;
  const note = document.getElementById('bk-note').value.trim();

  if (!name) return err.textContent = 'Vui lòng nhập họ tên.';
  if (!/^0\d{9}$/.test(phone)) return err.textContent = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).';
  if (!/^\d{12}$/.test(cccd)) return err.textContent = 'Số CCCD không hợp lệ. Vui lòng nhập đúng 12 chữ số.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err.textContent = 'Email không hợp lệ.';
  if (!ci || !co || ci < today || new Date(co) <= new Date(ci)) return err.textContent = 'Ngày nhận hoặc ngày trả phòng không hợp lệ. Vui lòng kiểm tra và thử lại.';
  if (guests < 1 || guests > r.capacity) return err.textContent = `Số khách phải từ 1 đến ${r.capacity} (sức chứa phòng).`;
  if (!isRoomAvailable(r.id, ci, co)) return err.textContent = 'Rất tiếc, phòng vừa được đặt bởi khách khác trong khoảng ngày này.';

  err.textContent = '';
  const nights = nightsBetween(ci, co);
  const roomTotal = nights * r.price;
  const vat = roomTotal * 0.10;
  const total = roomTotal + vat;
  const orderDate = new Date();
  const datePart = `${String(orderDate.getFullYear()).slice(-2)}${String(orderDate.getMonth() + 1).padStart(2, '0')}${String(orderDate.getDate()).padStart(2, '0')}`;
  const codePrefix = `DP${datePart}`;
  const dailyOrder = bookings.filter(x => x.code.startsWith(codePrefix)).length + 1;
  const code = `${codePrefix}${String(dailyOrder).padStart(4, '0')}`;
  const customerId = `KH${cccd.slice(-8)}`;

  const { error: customerError } = await window.supabaseClient
    .from('khach_hang')
    .upsert({
      makhachhang: customerId,
      hoten: name,
      sodienthoai: phone,
      socccd: cccd,
    }, { onConflict: 'socccd' });
  if (customerError) {
    err.textContent = `Không thể lưu khách hàng: ${customerError.message}`;
    return;
  }

  const { error: bookingError } = await window.supabaseClient
    .from('dat_phong')
    .insert({
      madatphong: code,
      makhachhang: customerId,
      maphong: r.id,
      manhanvien: null,
      loaiphong: r.type,
      ngaydatphong: new Date().toISOString(),
      ngayden: ci,
      ngaydi: co,
      sodemo: nights,
      trangthaidon: 'Đã xác nhận',
      socccddaidien: null,
      tenkhachdaidien: null,
      machiakhoa: null,
      thoigiancheckinthucte: null,
    });
  if (bookingError) {
    err.textContent = `Không thể lưu đặt phòng: ${bookingError.message}`;
    return;
  }

  bookings.push({
    code, hotelId: r.hotelId, roomId: r.id, name, phone, cccd, email,
    checkin: ci, checkout: co, guests, note, status: 'Đã xác nhận',
    nights, roomTotal, vat, total, key: 'KEY-' + r.id,
  });

  showToast(`Đặt phòng thành công! Mã: ${code}`);
  document.getElementById('booking-room-note').textContent = `Đặt phòng thành công — Mã đặt phòng của bạn: ${code}. Vui lòng lưu lại để tra cứu / check-in.`;
  ['bk-name','bk-phone','bk-cccd','bk-email','bk-note'].forEach(id => document.getElementById(id).value = '');
  showBookingConfirmation(bookings[bookings.length - 1]);
};

/* ============================================================
   GIẤY XÁC NHẬN ĐẶT PHÒNG (hiện sau khi đặt phòng thành công)
   ============================================================ */
function showBookingConfirmation(b){
  const r = getRoom(b.roomId), h = getHotel(b.hotelId);
  const rowsData = [
    ['Mã số đặt phòng', b.code],
    ['Tên người đặt', b.name],
    ['Số ĐT', b.phone],
    ['Số CCCD/CMND', b.cccd],
    ['Tên khách sạn', h.name],
    ['Loại phòng', `${r.type} - ${r.name}`],
    ['Ngày đến', b.checkin],
    ['Ngày đi', b.checkout],
    ['Số đêm ở', b.nights],
    ['Trạng thái đơn', b.status],
  ];
  document.getElementById('modal-body').innerHTML = `
    <button class="modal-close" id="modal-close">Đóng ✕</button>
    <div class="section-head" style="margin-top:0"><div><h3>Giấy xác nhận đặt phòng</h3><p>Vui lòng lưu lại thông tin này để tra cứu / check-in</p></div></div>
    <table><tbody>
      ${rowsData.map(([label,val]) => `<tr><th style="width:45%;text-transform:none;font-size:14px;color:var(--text);font-weight:700">${label}</th><td>${val}</td></tr>`).join('')}
    </tbody></table>
    <div class="actions"><button class="secondary" onclick="window.print()">In phiếu</button><button class="secondary" id="modal-confirmation-email">Gửi qua email</button><button class="primary" id="modal-confirmation-close">Đóng</button></div>`;
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-confirmation-close').onclick = closeModal;
  document.getElementById('modal-confirmation-email').onclick = () => sendConfirmationEmail(b, rowsData);
}
function sendConfirmationEmail(b, rowsData){
  let email = (b.email || '').trim();
  if (!email) {
    email = (prompt('Nhập email nhận phiếu xác nhận:') || '').trim();
    if (!email) return;
    b.email = email;
  }
  const subject = encodeURIComponent(`Giấy xác nhận đặt phòng ${b.code}`);
  const body = encodeURIComponent(rowsData.map(([label,val]) => `${label}: ${val}`).join('\n'));
  window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  showToast(`Đã mở email để gửi phiếu xác nhận tới ${email}`);
}

/* ============================================================
   TRA CỨU / CHECK-IN
   ============================================================ */
document.getElementById('btn-ci-search').onclick = () => {
  const code = document.getElementById('ci-code').value.trim();
  const cccd = document.getElementById('ci-cccd').value.trim();
  const err = document.getElementById('ci-error');
  const multiCard = document.getElementById('ci-multi');

  if (!code && !cccd) {
    err.textContent = 'Vui lòng nhập mã phòng, mã đặt phòng hoặc số CCCD.';
    hideCiDetails();
    multiCard.style.display = 'none';
    return;
  }

  if (code) {
    // Có mã: tra cứu theo mã đặt phòng hoặc mã phòng.
    const matches = bookings.filter(x => x.code === code || x.roomId === code);
    multiCard.style.display = 'none';
    if (!matches.length) {
      err.textContent = 'Không tìm thấy phòng đã đặt với mã đã nhập.';
      hideCiDetails();
      return;
    }
    err.textContent = '';
    if (matches.length === 1) {
      loadCiBooking(matches[0]);
      return;
    }
    renderCiMatches(matches);
    return;
  }

  if (!/^\d{12}$/.test(cccd)) {
    err.textContent = 'Số CCCD không hợp lệ. Vui lòng nhập đúng 12 chữ số.';
    hideCiDetails();
    multiCard.style.display = 'none';
    return;
  }

  // Không có mã: liệt kê tất cả đơn theo CCCD để chọn.
  const matches = bookings.filter(x => x.cccd === cccd);
  if (!matches.length) {
    err.textContent = 'Không tìm thấy đặt phòng nào với số CCCD này.';
    hideCiDetails();
    multiCard.style.display = 'none';
    return;
  }
  err.textContent = '';
  hideCiDetails();
  if (matches.length === 1) {
    multiCard.style.display = 'none';
    loadCiBooking(matches[0]);
    return;
  }
  renderCiMatches(matches);
};
function renderCiMatches(matches){
  const multiCard = document.getElementById('ci-multi');
  hideCiDetails();
  multiCard.style.display = '';
  document.getElementById('ci-multi-list').innerHTML = matches.map(b => {
    const r = getRoom(b.roomId), h = getHotel(b.hotelId);
    return `
    <article class="card" data-code="${b.code}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <small style="color:var(--muted)">${b.code} · ${h.name}</small>
        <h4 style="margin:4px 0">${r.name}</h4>
        <p style="margin:0;color:var(--muted)">${b.checkin} → ${b.checkout} · ${b.name}</p>
      </div>
      <span class="badge">${b.status}</span>
    </article>`;
  }).join('');
  document.querySelectorAll('#ci-multi-list [data-code]').forEach(el => el.onclick = () => {
    const b = bookings.find(x => x.code === el.dataset.code);
    if (b) { multiCard.style.display = 'none'; loadCiBooking(b); }
  });
}
function hideCiDetails(){
  document.getElementById('ci-info').style.display = 'none';
  document.getElementById('ci-form').style.display = 'none';
  ciBooking = null;
}
function loadCiBooking(b){
  ciBooking = b;
  const r = getRoom(b.roomId);
  if (!b.key) b.key = `KEY-${b.roomId}`;
  document.getElementById('ci-name').textContent = b.name;
  document.getElementById('ci-roomtype').textContent = r.type;
  document.getElementById('ci-date').textContent = b.checkin;
  document.getElementById('ci-status').textContent = b.status;
  document.getElementById('ci-info').style.display = '';
  document.getElementById('ci-room').value = `${r.id} - ${r.type}`;
  document.getElementById('ci-key').value = b.key;
  document.getElementById('ci-cccd2').value = b.cccd;
  document.getElementById('ci-form').style.display = b.status === 'Đã xác nhận' ? '' : 'none';
  document.getElementById('btn-ci-confirm').dataset.code = b.code;
}
document.getElementById('btn-ci-confirmation').onclick = () => { if (ciBooking) showBookingConfirmation(ciBooking); };
document.getElementById('btn-ci-confirm').onclick = async function(){
  const b = bookings.find(x => x.code === this.dataset.code);
  if (!b) return;
  const { error: bookingError } = await window.supabaseClient
    .from('dat_phong')
    .update({
      socccddaidien: b.cccd,
      tenkhachdaidien: b.name,
      machiakhoa: b.key,
      thoigiancheckinthucte: new Date().toISOString(),
      trangthaidon: 'Đã nhận phòng',
    })
    .eq('madatphong', b.code);
  if (bookingError) {
    showToast(`Check-in thất bại: ${bookingError.message}`, true);
    return;
  }
  const { error: roomError } = await window.supabaseClient
    .from('phong')
    .update({ trangthaiphong: 'Đang sử dụng' })
    .eq('maphong', b.roomId);
  if (roomError) {
    showToast(`Không thể cập nhật trạng thái phòng: ${roomError.message}`, true);
    return;
  }
  b.status = 'Đã nhận phòng';
  const room = getRoom(b.roomId);
  if (room) room.status = 'Đang sử dụng';
  document.getElementById('ci-status').textContent = b.status;
  showToast(`Check-in thành công cho phòng ${b.roomId}`);
  document.getElementById('ci-form').style.display = 'none';
};

/* ============================================================
   DỊCH VỤ (đơn giản)
   ============================================================ */
function svUpdatePrice(){
  const unit = SERVICES[document.getElementById('sv-name').value] || 0;
  const qty = parseInt(document.getElementById('sv-qty').value) || 0;
  document.getElementById('sv-unit').value = fmt(unit);
  document.getElementById('sv-total').value = fmt(unit * qty);
}
document.getElementById('sv-name').onchange = svUpdatePrice;
document.getElementById('sv-qty').oninput = svUpdatePrice;
svUpdatePrice();
function renderServiceOrders(){
  document.getElementById('sv-list').innerHTML = serviceOrders.map(s => `
    <tr><td>${s.name}</td><td>${s.qty}</td><td>${fmt(s.total)}</td><td>${s.status}</td></tr>`).join('');
}
renderServiceOrders();
document.getElementById('btn-sv-save').onclick = () => {
  const code = document.getElementById('sv-code').value.trim();
  const err = document.getElementById('sv-error');
  const b = bookings.find(x => x.code === code && x.status !== 'Đã trả phòng' && x.status !== 'Hoàn tất' && x.status !== 'Đã hủy');
  if (!b) { err.textContent = 'Mã đặt phòng không tồn tại.'; return; }
  const name = document.getElementById('sv-name').value;
  const qty = Number(document.getElementById('sv-qty').value);
  if (!Number.isInteger(qty) || qty < 1) {
    err.textContent = 'Số lượng dịch vụ không hợp lệ. Vui lòng nhập số nguyên dương lớn hơn hoặc bằng 1.';
    return;
  }
  err.textContent = '';
  const unit = SERVICES[name];
  serviceOrders.push({code, name, qty, unit, total: unit*qty, status: 'Chờ xử lý'});
  renderServiceOrders();
  showToast('Đặt dịch vụ thành công');
};

/* ============================================================
   5) TRẢ PHÒNG
   ============================================================ */
let checkoutBooking = null;
document.getElementById('btn-co-search').onclick = () => {
  const code = document.getElementById('co-code').value.trim();
  const err = document.getElementById('co-error');
  const b = bookings.find(x => (x.code === code || x.roomId === code) && x.status !== 'Đã trả phòng' && x.status !== 'Hoàn tất')
    || bookings.find(x => x.code === code || x.roomId === code);
  if (!b) { err.textContent = 'Không tìm thấy phòng đã đặt với mã đã nhập.'; hideCheckoutDetails(); return; }
  if (b.status === 'Đã trả phòng' || b.status === 'Hoàn tất') { err.textContent = 'Đặt phòng này đã được trả phòng trước đó.'; hideCheckoutDetails(); return; }
  if (b.status !== 'Đã nhận phòng') { err.textContent = 'Phòng chưa hoàn tất check-in nên chưa thể trả phòng.'; hideCheckoutDetails(); return; }
  err.textContent = '';
  checkoutBooking = b;
  const r = getRoom(b.roomId);
  document.getElementById('co-guest').value = b.name;
  document.getElementById('co-room').value = `${r.id} - ${r.type}`;
  document.getElementById('co-checkin').value = b.checkin;
  document.getElementById('co-checkout').value = b.checkout;
  document.getElementById('co-details').style.display = '';
  document.getElementById('co-check-card').style.display = '';
  updateCheckoutPreview();
};
function hideCheckoutDetails(){
  checkoutBooking = null;
  document.getElementById('co-details').style.display = 'none';
  document.getElementById('co-check-card').style.display = 'none';
}
document.getElementById('co-condition').onchange = function(){
  const damaged = this.value === 'Có hư hại';
  document.getElementById('co-fee').disabled = !damaged;
  if (!damaged) document.getElementById('co-fee').value = 0;
  updateCheckoutPreview();
};
document.getElementById('co-fee').oninput = updateCheckoutPreview;
function updateCheckoutPreview(){
  if (!checkoutBooking) return;
  const r = getRoom(checkoutBooking.roomId);
  const nights = nightsBetween(checkoutBooking.checkin, checkoutBooking.checkout);
  const roomCharge = nights * r.price;
  const fee = parseInt(document.getElementById('co-fee').value) || 0;
  const vat = (roomCharge + fee) * 0.10;
  const total = roomCharge + fee + vat;
  document.getElementById('co-nights').textContent = nights;
  document.getElementById('co-roomcharge').textContent = fmt(roomCharge);
  document.getElementById('co-feepreview').textContent = fmt(fee);
  document.getElementById('co-vatpreview').textContent = fmt(vat);
  document.getElementById('co-totalpreview').textContent = fmt(total);
}
document.getElementById('btn-co-confirm').onclick = async () => {
  if (!checkoutBooking) return;
  const b = checkoutBooking;
  const r = getRoom(b.roomId);
  const h = getHotel(b.hotelId);
  const nights = nightsBetween(b.checkin, b.checkout);
  const roomCharge = nights * r.price;
  const fee = parseInt(document.getElementById('co-fee').value) || 0;
  const svcTotal = serviceOrders.filter(s => s.code === b.code).reduce((a,s) => a + s.total, 0);
  const subtotal = roomCharge + fee + svcTotal;
  const vat = subtotal * 0.10;
  const total = subtotal + vat;

  const { error: bookingError } = await window.supabaseClient
    .from('dat_phong')
    .update({ trangthaidon: 'Hoàn tất' })
    .eq('madatphong', b.code);
  if (bookingError) {
    showToast(`Trả phòng thất bại: ${bookingError.message}`, true);
    return;
  }
  const { error: roomError } = await window.supabaseClient
    .from('phong')
    .update({ trangthaiphong: 'Trống' })
    .eq('maphong', b.roomId);
  if (roomError) {
    showToast(`Không thể cập nhật trạng thái phòng: ${roomError.message}`, true);
    return;
  }
  b.status = 'Hoàn tất';
  r.status = 'Trống';

  const invNumber = 'HD' + String(++invoiceCounter).padStart(9,'0');
  document.getElementById('inv-number').textContent = `Số ${invNumber}`;
  document.getElementById('inv-hotel').textContent = h.name;
  document.getElementById('inv-guest').textContent = b.name;
  document.getElementById('inv-cccd').textContent = b.cccd;
  document.getElementById('inv-room').textContent = r.id;
  document.getElementById('inv-date').textContent = new Date().toLocaleDateString('vi-VN');

  let lines = `<tr><td>Phòng ${r.type} (${nights} đêm)</td><td>${nights}</td><td>${fmt(r.price)}</td><td>${fmt(roomCharge)}</td></tr>`;
  serviceOrders.filter(s => s.code === b.code).forEach(s => {
    lines += `<tr><td>${s.name}</td><td>${s.qty}</td><td>${fmt(s.unit)}</td><td>${fmt(s.total)}</td></tr>`;
  });
  if (fee > 0) lines += `<tr><td>Phí đền bù hư hại</td><td>1</td><td>${fmt(fee)}</td><td>${fmt(fee)}</td></tr>`;
  document.getElementById('inv-lines').innerHTML = lines;
  document.getElementById('inv-subtotal').textContent = fmt(subtotal);
  document.getElementById('inv-vat').textContent = fmt(vat);
  document.getElementById('inv-total').textContent = fmt(total);

  showToast(`Trả phòng thành công! Tổng thanh toán: ${fmt(total)}`);
  hideCheckoutDetails();
  document.getElementById('co-code').value = '';
  show('invoice');
};
document.getElementById('btn-inv-pay').onclick = () => showToast('Đã xác nhận thanh toán hóa đơn.');

/* ============================================================
   BÁO CÁO (tổng hợp nhanh từ dữ liệu hiện có)
   ============================================================ */
function renderReport(){
  document.getElementById('rp-bookings').textContent = bookings.length;
  const revenue = bookings.filter(b => b.status === 'Đã trả phòng' || b.status === 'Hoàn tất').reduce((a,b)=>a+b.total,0);
  document.getElementById('rp-revenue').textContent = fmt(revenue);
}

/* Khởi tạo dữ liệu từ Supabase trước khi hiển thị các luồng. */
async function initializeApp(){
  try {
    await loadDatabaseData();
    renderFeatured();
    show('home');
  } catch (error) {
    console.error(error);
    document.getElementById('home-error').textContent =
      `Không thể tải dữ liệu từ database: ${error.message}`;
  }
}
initializeApp();
