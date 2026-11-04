# Kết quả triển khai môi trường Chùa Thanh Tịnh 3D

Ngày cập nhật: 03/11/2026. Đã triển khai bằng bốn sub-agent GPT-6.1 Sol, với phần ghép và sửa cuối ở agent chính. Phạm vi hỗ trợ cả desktop và điện thoại.

## Các thay đổi đã có trong source

| Phần | Thay đổi |
| --- | --- |
| Hồ và nền | Thành hồ rỗng, đáy riêng, mặt nước và sen đúng cao độ. Đã bỏ hồ sen nhỏ phía Tây sát đầu cầu Quan Âm: gỡ nước/sen/thành hồ/va chạm và lấp lại nền. Các hồ sân còn lại dùng chung cấu hình cho rendering, khoét nền và collider. |
| Mặt đi bộ | Geometry cầu và chân nhân vật dùng chung mặt trên; đầu cầu nối về nền. Cầu Cửu Khúc có một mặt gỗ không chồng lên đảo đá; lan can theo biên ngoài, thông các đoạn rẽ và hai đầu cầu, trụ/lan can bám đúng dốc đầu cầu. |
| Camera | Theo yêu cầu mới, camera đi xuyên vật thể, bám vị trí/góc nhìn với damping và không bị cây, cột, tường hoặc mái đẩy thu vào. Cache geometry/spatial grid/BVH tiếp tục phục vụ che khuất nhãn; helper va chạm vẫn có thể dùng riêng khi truyền collision world. |
| Teleport | Reset vị trí camera và điểm nhìn qua `resetVersion`, cùng cao độ đích; giữ Canvas đang chạy. |
| Chuyển động | Va chạm chia bước nhỏ; animation chân theo quãng đường thực, đứng yên khi bị chặn; remote bám mặt cầu. Cập nhật theo thứ tự simulation → avatar → camera → nhãn. |
| Mái | Diềm và đấu củng từ 172 mesh thành 4 batch instancing mỗi tầng. Riêng ba tầng mái chánh điện: 516 → 12 mesh của hai nhóm này. Đây là số đếm source, không phải mức giảm draw calls toàn cảnh. |
| Chi tiết xa | Hysteresis và fade cho trang trí nhỏ; giữ silhouette kiến trúc và collider. Tính lại bounds sau cập nhật instance. |
| Vật liệu | Texture procedural có seed cố định, giảm tương phản vân, sửa mật độ UV mái; thêm normal/roughness nhẹ cho một số mặt gạch/đá ở balanced/high. Mipmap và anisotropy theo giới hạn GPU. |
| Ánh sáng | Preset ngày/hoàng hôn/đêm được cân lại. Pool đèn phụ cố định 2/4/6 slot theo quality, chọn theo vị trí người chơi, fade khi đổi nguồn; xoay camera không đổi trọng tâm chiếu sáng. |
| Hiệu ứng | Khói hương gom thành một draw với hạt mềm; mật độ theo preset. Quy ước depth cho nước, khói và hào quang; chuẩn bị shader khi đổi quality/thời điểm. |
| Nhãn và màn hình hẹp | Nhãn giữ cỡ chữ màn hình, giới hạn khoảng cách và che khuất bởi công trình. Chat thu gọn mặc định dưới 640px, nút mở gọn để không che joystick. |
| Công cụ đo | Chỉ bật bằng `?renderStats=1`: nhịp Canvas p50/p95/p99, calls/triangles, bộ đếm tài nguyên, DPR, số đèn. GPU timing dùng query bất đồng bộ khi có extension; không hỗ trợ thì ghi N/A. |

Cache va chạm chỉ dựng lại khi cấu trúc kiến trúc thay đổi. Thêm/bớt avatar, nhãn và nhóm được đánh dấu bỏ qua không dựng lại toàn bộ proxy. Các geometry tùy biến có cleanup; texture dùng chung giữ quyền sở hữu ở cache.

## Kiểm tra đã thực hiện

- `npm run typecheck`: **PASS**.
- `npm run test:environment`: **40/40 PASS**. Bao gồm camera tự do, geometry, nhãn, mặt đi bộ, mái/vật liệu và bồn Bồ Đề. Phần Quan Âm kiểm nền/collider sau khi bỏ hồ nhỏ, toàn tuyến đi từ sân tới đảo, mặt cầu không chồng đảo, lan can không chắn đường và cao độ trụ/tay vịn. Test helper camera khi truyền collision world vẫn được giữ; đây không còn là chế độ camera đang dùng trong app.
- `npm run build`: **PASS**.
- Browser smoke: chạy production build cục bộ, chế độ Local Auth/Demo và NPC mô phỏng; kiểm tra các tổ hợp `3 quality × 3 thời điểm` ở desktop và viewport 390 × 844 CSS pixel. Console không ghi nhận lỗi/warning trong lượt kiểm tra.
- Đã thao tác đi lên/xuống cầu, joystick, kéo camera, đổi preset/thời điểm và teleport qua bản đồ; có ảnh lưu tại thư mục evidence. Các thao tác này là kiểm tra mẫu, không thay cho toàn bộ 10 tuyến nghiệm thu trong plan.

Ví dụ một cửa sổ đo ngắn trong trình duyệt trên máy hiện tại khi đi cầu: p50 khoảng 16.7 ms, p95 khoảng 18.8 ms, GPU khoảng 4.27 ms. Kết quả phụ thuộc góc nhìn, preset và trạng thái tải. Một số lần đổi preset có spike biên dịch/tạo tài nguyên; các snapshot trong matrix có thể còn thuộc cửa sổ đo một giây trước đó. **Không dùng những snapshot này để kết luận FPS trên điện thoại hoặc mức tăng hiệu năng toàn cảnh.**

Các file `baseline-*-stats.txt`, `desktop-matrix.json` và `mobile-matrix.json` lưu quan sát thô. Baseline được thêm cùng công cụ đo trong bản scratch ở `/tmp`; không dùng so sánh này làm benchmark vì số tab và thời điểm lấy mẫu khác nhau. Instancing có thể tăng lượng hình được gửi ở một số góc do bounds theo cụm, dù giảm số mesh nguồn; cần đo lại cùng tuyến khi chốt ngân sách thiết bị.

## Evidence và cách chạy

Ảnh và snapshot: outputs/environment-optimization (`outputs/environment-optimization`, bằng chứng cục bộ).

Các lệnh:

```sh
npm run typecheck
npm run test:environment
npm run build
npm run preview -- --host 127.0.0.1
```

Mở URL preview với `?renderStats=1` để bật công cụ đo. Không có query này thì không tạo overlay, GPU query hay snapshot debug.

## Phần cần nghiệm thu tiếp trên thiết bị mục tiêu

| Phần | Trạng thái |
| --- | --- |
| Android và iPhone thật, cảm ứng đa điểm, đổi hướng màn hình | UNEXECUTED |
| Chạy nóng 10 phút, DPR/GPU thực, ngân sách 30/60 FPS theo máy | UNEXECUTED; model máy và browser version vẫn TBD |
| Toàn bộ ENV-01 đến ENV-10 có video trước/sau và so sánh cùng tuyến | Chưa hoàn tất; smoke đã chạy không được coi là PASS toàn bộ |
| Multiplayer cloud giữa hai thiết bị, jitter và mất mẫu | UNEXECUTED; mới kiểm logic grounded/collision và NPC Local |

Remote vẫn dùng dữ liệu mạng hiện hành. Khi hai mẫu thưa nằm hai bên vật cản, avatar remote có thể bị chặn cho tới mẫu tới được; chưa thêm giao thức snapshot/path mới. Auto quality và hiệu ứng hậu kỳ nặng là các nhánh có điều kiện trong plan, chưa bật khi chưa có benchmark thiết bị.

Thư mục hiện không có Git repository; thay đổi nằm trực tiếp trong workspace và chưa tạo commit.

Lỗi sọc tại gốc Bồ Đề đã được người dùng phát hiện sau smoke ban đầu. Xem chẩn đoán và ảnh trước/sau (`outputs/bodhi-render-fix/README.md`, bằng chứng cục bộ); việc không có lỗi console trong smoke không chứng minh không có lỗi hình ảnh.

Camera hiện cho phép đi xuyên vật thể theo yêu cầu mới của người dùng, thay thế cơ chế chống vật cản trước đó. Xem thay đổi và kiểm tra hiện tại (`outputs/camera-through-objects/README.md`, bằng chứng cục bộ). Báo cáo camera-follow-fix (`outputs/camera-follow-fix/README.md`, bằng chứng cục bộ) lưu kết quả của chế độ cũ.
