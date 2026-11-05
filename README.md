# Chùa Thanh Tịnh 3D

Web game đi chùa 3D xây dựng bằng React, TypeScript, Three.js và React Three Fiber. Dự án có nhân vật chú tiểu, các hoạt động trong sân chùa, Phật Thích Ca, Quan Âm và 18 La Hán.

## Chạy cục bộ

```sh
npm ci
npm run dev
```

Ứng dụng dùng Local Auth khi chưa cấu hình Firebase. Để dùng Firebase, sao chép `.env.example` thành `.env.local` rồi điền thông tin dự án của bạn. File môi trường cá nhân không được đưa vào Git.

```sh
npm run build
npm run preview
```

## Kiểm tra

```sh
npm run typecheck
npm run test:figures
npm run test:environment
npm run test:multiplayer
npm run build
```

Bản cập nhật ngày 04/11/2026 đã đạt 20 test model, 40 test môi trường, typecheck và build. Android/iPhone thật, multiplayer cloud và benchmark thiết bị mục tiêu chưa được kiểm.

Bộ model ngày 05/11/2026 dùng các bề mặt được dựng riêng để tạo khuôn mặt, lớp áo, tay áo, nếp vải và đài sen mượt hơn. Nhân vật giữ 23 xương và các điểm neo tương tác; tượng dùng vật liệu đồng, vàng và sứ ngà. Xem `?figure-lab` để kiểm tra hai LOD và các cử động trước khi đưa bản thay đổi lên website.

## Model và pipeline

`public/models/figures` chứa 21 model với hai mức chi tiết, tổng cộng 42 GLB. Các generator nằm trong `scripts/figures`.

`monk-sculpt.ts` và `statue-sculpt.ts` dựng bộ model đang dùng. Các phần áo và chi tiết được ghép có chủ đích, khai báo số thành phần và được kiểm tra topology riêng qua vòng xuất/đọc GLB. Các hàm SDF cũ được giữ cho dữ liệu tư thế và kiểm tra hồi quy; chúng không còn tạo mesh production.

```sh
npm run bake:models
npm run validate:figures
```

`bake:models` xuất model vào staging, kiểm geometry, rig, socket và manifest rồi mới thay bộ asset đang dùng. Pipeline đã được chạy bằng Node v26.3.1.

Mở ứng dụng với `?figure-lab` để xem các model, đổi LOD, màu áo và thử sáu hành động của nhân vật. Thêm `?renderStats=1` trong cảnh game để xem số đo render.

Xem [kế hoạch sửa model](docs/plans/character-model-fix-plan.md) và [tổng quan môi trường](docs/plans/environment-implementation.md). Ảnh, video, log và bản sao trước sửa được tạo trong `outputs/` ở máy cục bộ; thư mục này không được đưa lên Git.

## Multiplayer giữa các thiết bị

Để chơi trên hai máy hoặc hai điện thoại, cần cấu hình Firebase Web theo `.env.example`, bật Authentication với Email/Password, tạo Cloud Firestore và triển khai `firestore.rules`. Phần đồng bộ hiện tại dùng **Cloud Firestore**; Realtime Database được khởi tạo trong cấu hình nhưng không phải transport multiplayer đang dùng.

Trên Cloudflare, thêm các biến `VITE_FIREBASE_*` vào **build variables**, sau đó tạo build mới từ `main`. Các giá trị Vite được đóng vào JavaScript trong bước build; chỉ thêm biến runtime vào Worker sẽ không cập nhật client. Không đưa service-account key vào các biến `VITE_*`.

Khi chưa cấu hình Firebase, ứng dụng chạy cục bộ và chỉ đồng bộ tab cùng trình duyệt. NPC không đại diện cho người chơi thật. Tài khoản cục bộ không tự chuyển thành tài khoản Firebase; cần đăng ký hoặc đăng nhập tài khoản Cloud. Để kiểm tra hai tài khoản riêng, dùng hai browser context hoặc hai thiết bị độc lập.

`npm run test:multiplayer` kiểm tra client bằng Firebase SDK doubles, không tạo tài khoản hay ghi dữ liệu Cloud. `node scripts/repro-multiplayer-local.mjs --require-cross-device` là lệnh tái hiện có chủ đích: lệnh báo FAIL khi transport Local được yêu cầu kết nối hai trình duyệt độc lập. Test với Cloud thật vẫn cần hai phiên xác thực riêng và kiểm tra hiện diện, di chuyển, chat, lời nguyện và mất/kết nối lại.
