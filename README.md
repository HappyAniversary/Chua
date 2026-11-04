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
npm run build
```

Bản cập nhật ngày 04/11/2026 đã đạt 20 test model, 40 test môi trường, typecheck và build. Android/iPhone thật, multiplayer cloud và benchmark thiết bị mục tiêu chưa được kiểm.

## Model và pipeline

`public/models/figures` chứa 21 model với hai mức chi tiết, tổng cộng 42 GLB. Các generator nằm trong `scripts/figures`.

```sh
npm run bake:models
npm run validate:figures
```

`bake:models` xuất model vào staging, kiểm geometry, rig, socket và manifest rồi mới thay bộ asset đang dùng. Pipeline đã được chạy bằng Node v26.3.1.

Mở ứng dụng với `?figure-lab` để xem các model, đổi LOD, màu áo và thử sáu hành động của nhân vật. Thêm `?renderStats=1` trong cảnh game để xem số đo render.

Xem [kế hoạch sửa model](docs/plans/character-model-fix-plan.md) và [tổng quan môi trường](docs/plans/environment-implementation.md). Ảnh, video, log và bản sao trước sửa được tạo trong `outputs/` ở máy cục bộ; thư mục này không được đưa lên Git.
