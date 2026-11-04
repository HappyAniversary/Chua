# Kế hoạch cải thiện môi trường Chùa Thanh Tịnh 3D

Ngày lập: 03/11/2026. Phạm vi: **cả desktop và điện thoại**, theo xác nhận của người dùng.

Mục tiêu là làm cảnh chùa có chiều sâu, vật liệu rõ và ánh sáng dễ chịu, đồng thời giữ hình ảnh ổn định khi đi bộ, xoay camera, lên cầu và dịch chuyển nhanh. Thứ tự thực hiện: **đo hiện trạng → sửa hình học và camera → giảm chi phí render → nâng mỹ thuật → kiểm tra chuyển động trên thiết bị thật**.

Trạng thái: bản kế hoạch ghi lại source trước triển khai. Phần thay đổi đã thực hiện, kiểm tra và giới hạn hiện tại xem tại [kết quả triển khai](environment-implementation.md). Các mô tả hiện trạng và dẫn chiếu dòng bên dưới là mốc trước sửa; không dùng chúng để kết luận lỗi vẫn còn trong source mới.

## 1. Luồng render và những phần nên giữ

Luồng đang được sử dụng là `App → TempleScene → MainSanctuary + TempleCourtyard → TempleOuterComplex`, cùng local/remote avatar và vòng tương tác. `Phase3CourtyardStage.tsx` không có nơi import trong source hiện tại; không dùng cảnh này để đánh giá hoặc tối ưu thay cho cảnh chính.

Dependency đã cài: Three.js `0.169.0`, React Three Fiber `8.18.0`, Drei `9.122.0`. Đối chiếu API với các phiên bản này khi triển khai.

Các nền tảng đã có và nên giữ:

- Transform, input và camera dùng ref trong `useFrame`; HUD/network nhận cập nhật theo nhịp riêng. Giữ chuyển động ngoài React state mỗi frame.
- Camera đã dùng damping theo delta time; nhiều component đã có `React.memo`/`useMemo`.
- Đèn đá, tre và sen đã có instancing. Mở rộng cách làm này sang các nhóm còn lặp nhiều.
- Texture procedural đã có cache, sRGB, mipmap, lọc trilinear và anisotropy 8. Chuẩn hóa mật độ và nội dung texture trên nền này.
- Đã có `low / balanced / high`, cùng `day / sunset / night`; cần hoàn thiện chính sách chất lượng xuyên suốt cảnh.

## 2. Các điểm cần xử lý từ source

P0: ảnh hưởng trực tiếp tính đúng của hình học hoặc camera. P1: ổn định chuyển động và chi phí render. P2: nâng mỹ thuật sau khi có ngân sách.

| Mức | Bằng chứng trong source | Hệ quả cần giải quyết hoặc kiểm chứng |
| --- | --- | --- |
| P0 | [Camera](../../src/components/player/ThirdPersonCamera.tsx#L30) chỉ tính orbit rồi lerp tới vị trí mong muốn | Chưa có kiểm tra tường, cột, mái và mặt đất cho camera; cần kiểm chứng các góc có thể nhìn xuyên công trình. |
| P0 | [Teleport](../../src/App.tsx#L390) đổi transform nhân vật; camera chỉ khởi tạo trực tiếp một lần | Camera tiếp tục nội suy từ vị trí cũ sau teleport; đường đi có thể xuyên cảnh. Cần reset camera và lookAt tại đích an toàn. |
| P0 | [Hồ sen](../../src/components/world/TempleCourtyard.tsx#L904) dùng cylinder đóng nắp, hai mặt trên cùng ở `y=0.44`; nước ở `0.38`, lá sen ở `0.39` | Hình học opaque nằm trên nước/lá. Cần làm thành hồ rỗng; ghi hình để xác nhận biểu hiện trước và sau sửa. |
| P0 | [Hồ non bộ](../../src/components/world/TempleOuterComplex.tsx#L1328) có nắp cylinder ở `y=0.325`, nước ở `0.28` | Cùng lỗi tổ chức lớp hình học; cần tách thành hồ, đáy và mặt nước. |
| P0 | [Mặt cầu](../../src/components/world/TempleOuterComplex.tsx#L68) dùng đường cong parabol cộng offset `0.18` và bản cầu dày `0.22`; [cao độ nhân vật](../../src/constants/templeLayout.ts#L713) dùng sin | Hai biểu diễn không cùng mặt đi bộ. Cần một nguồn cao độ dùng chung, tính cả mặt trên và các đoạn cầu nghiêng. |
| P1 | [Chi tiết diềm mái](../../src/components/world/PagodaRoofPrimitives.tsx#L332) và [đấu củng](../../src/components/world/PagodaRoofPrimitives.tsx#L423) tạo nhiều mesh riêng | Theo vòng lặp có 120 mesh diềm và 52 mesh đấu củng mỗi tầng. Chánh điện dùng ba tầng, tương ứng 516 mesh của riêng hai nhóm này; đây là số đếm tĩnh, chưa phải draw calls đo được. |
| P1 | [Chính sách quality](../../src/components/world/TempleScene.tsx#L288) chủ yếu điều chỉnh DPR, shadow và sao; quality chưa truyền vào courtyard/sanctuary | Low vẫn dựng phần lớn kiến trúc, đèn phụ và hiệu ứng như balanced/high. Cần ngân sách theo nhóm tài nguyên. |
| P1 | [Đèn đá](../../src/components/world/TempleCourtyard.tsx#L210) và nhiều đèn ở [hành lang](../../src/components/world/TempleOuterComplex.tsx#L1215) được bật theo buổi | Instancing hình học không giảm số nguồn sáng. Profile cảnh đêm, giới hạn đèn phụ đang hoạt động và chuyển đèn xa sang emissive. |
| P1 | [Các lớp nền](../../src/components/world/TempleCourtyard.tsx#L552) dùng nhiều mặt phủ nhau, một số chỉ cách nhau vài mm; [nước](../../src/components/world/TempleOuterComplex.tsx#L167) dùng alpha blending | Nguy cơ tranh chấp độ sâu và đổi thứ tự lớp trong suốt ở góc xiên. Chưa xác nhận nhấp nháy bằng runtime. |
| P1 | [Texture](../../src/utils/proceduralTextures.ts#L17) có mipmap/aniso; [mái](../../src/components/world/PagodaRoofPrimitives.tsx#L696) tiếp tục dùng repeat lớn trên UV đã có scale | Cần kiểm mật độ vân ngói/gạch và moiré khi di chuyển, thay vì tăng độ phân giải đại trà. `Math.random` trong texture chạy khi tạo/cache miss, không chạy mỗi frame. |
| P1 | [Remote avatar](../../src/components/player/RemoteMonksManager.tsx#L112) lerp Y tới mặt đất nhưng không chặn kết quả thấp hơn mặt đi bộ | Cần kiểm chân chìm khi lên cầu. Remote còn nội suy tới mẫu gần nhất; mạng chậm có thể tạo giật hoặc cắt góc. |
| P1 | [Walking](../../src/components/player/LocalPlayerController.tsx#L97) theo input; [chu kỳ chân](../../src/components/player/MonkAvatar.tsx#L212) theo thời gian cố định | Có thể bước tại chỗ sát tường và trượt chân ở tốc độ joystick thấp. Lấy vận tốc/quãng đường thực sau collision để điều khiển animation. |

Canvas hiện dựa vào mặc định của Fiber đã cài: antialias bật, ACES tone mapping và shadow mềm khi bật shadow. Không coi việc thiếu khai báo `gl` trong JSX là bằng chứng chưa có chống răng cưa hay tone mapping; cần kiểm tra context thực tế trên thiết bị.

## 3. Hướng hình ảnh đề xuất

Giữ phong cách chùa Việt cách điệu hiện có, ưu tiên đường nét mái và không khí tĩnh. Tập trung chất lượng ở tầm nhìn người chơi, với ba điểm nhìn chính: từ quảng trường qua cổng, từ sân hướng chánh điện, từ cầu nhìn hồ Quan Âm.

| Thành phần | Cải thiện cụ thể | Điều kiện ổn định khi di chuyển |
| --- | --- | --- |
| Gạch, đá, gỗ | Chuẩn hóa kích thước vân theo mét; giảm sắc đỏ nhân chồng giữa base color và texture; thêm roughness/normal nhẹ ở khu vực gần | Tránh vân có tương phản hoặc tần số quá cao; kiểm ở góc sát sàn và các mức DPR. |
| Mái và trang trí | Giữ dáng mái đao, sống mái, góc cong; biến thiên màu ngói nhẹ; giảm trang trí li ti ở xa | LOD giữ cùng silhouette/pivot, chuyển mức có hysteresis; không làm mái bật tắt khi tiến/lùi. |
| Cây và cảnh quan | Sắp tán cây thành cụm có khoảng trống, đá/rêu tập trung ở chân công trình; giữ trục đường đi dễ đọc | Tọa độ và seed cố định; giữ bounds đủ cho chuyển động tán cây. |
| Hồ và sen | Thành hồ rỗng, đáy thấp, nước dịu, gợn nhẹ; sen theo cùng mực nước | Giữ khoảng hở an toàn cả lúc nước dao động; kiểm lá, cá, nước từ hai phía cầu. |
| Ánh sáng | Một nguồn sáng chính; nền sáng dịu; đèn vàng tạo điểm nhấn buổi tối; cân fog gần màu chân trời | Độ sáng ổn định khi di chuyển; cập nhật light pool không tạo nhảy số nguồn sáng/shader liên tục. |
| Vùng tương tác | Giảm mật độ vòng và cột sáng xa; ưu tiên vùng đang gần người chơi; nhãn gọn hơn | Fade theo khoảng cách có vùng đệm; nhãn không hiện xuyên công trình, không chặn thao tác camera/joystick. |

Chốt sáu góc ảnh tham chiếu trước khi chỉnh mỹ thuật. Mỗi lần review cần có ảnh cùng camera và video cùng tuyến; ảnh đứng yên không đủ đánh giá yêu cầu này.

## 4. Các đợt triển khai

### Đợt 0 — Đo và tạo tuyến so sánh

- Thêm công cụ debug trong Canvas: frame interval p50/p95/p99, tỷ lệ frame vượt ngân sách, draw calls/triangles, số geometry/texture, số đèn và DPR thực. Lấy mẫu đều rồi tổng hợp khoảng mỗi giây, tránh cập nhật UI mỗi frame.
- HUD hiện đếm `requestAnimationFrame` riêng tại [HUD.tsx](../../src/components/ui/HUD.tsx#L87). Giữ giá trị đó như chỉ báo; đo nhịp render trong Canvas để đánh giá cảnh 3D. GPU timing chỉ ghi khi có extension hỗ trợ, nếu không ghi `N/A`.
- Ghi thiết bị, OS, browser, viewport, DPR, quality, time of day, số avatar và trạng thái mạng trong từng lần chạy. Số lượng texture/geometry là bộ đếm tài nguyên, không phải số MB VRAM chính xác.
- Seed cố định cho các phép so sánh procedural, vị trí NPC và mật độ hạt; không thay đổi ngẫu nhiên giữa hai bản A/B.
- Dùng production build để lấy baseline: warmup 30 giây, chạy cùng tuyến 3 phút, lặp ba lần. Ghi riêng hiện tượng khi tải lần đầu và sau khi chạy nóng 10 phút trên điện thoại.

**Đầu ra:** bảng baseline và video cho các tuyến ở mục 6. Máy cụ thể, browser version, tải multiplayer mục tiêu, ngân sách draw calls/triangles/memory: **TBD trước nghiệm thu**.

### Đợt 1 — Sửa hình học và mặt đi bộ

- Tách hồ sen và hồ non bộ thành thành hồ, đáy và mặt nước. Thành hồ cần có bề dày, mặt trong và vành; cylinder `openEnded` đơn lẻ chưa đủ mô tả hồ rỗng hoàn chỉnh.
- Tạo một mô tả mặt đi bộ dùng chung cho geometry cầu, `getGroundHeight`, local player, remote player và điểm teleport. Quy định rõ Y của chân avatar và Y mặt trên sàn.
- Giải cao độ theo chính mặt cầu đã dựng; làm chuyển tiếp hợp lệ ở hai đầu cầu và cầu cửu khúc/đảo. Không làm mượt Y theo cách khiến chân đi dưới mặt sàn.
- Rà thềm chánh điện theo collision hiện hành: nơi được phép đi phải có surface tương ứng, nơi bị chặn giữ đúng ranh giới. Không tự mở rộng khu đi bộ trong đợt mỹ thuật.
- Rà lớp nền/sàn trang trí: ưu tiên cắt bỏ phần phủ thừa hoặc gộp vào một material; dùng offset có kiểm soát cho decal cần thiết. Chỉnh near/far chỉ sau khi xác nhận các giới hạn camera và tầm nhìn.

**Cổng kiểm tra:** mặt nước và sen đúng thứ tự lớp; nhân vật bám mặt đi bộ ở cả hai chiều; không có nháy sàn ở các góc camera trong tuyến thử.

### Đợt 2 — Camera và chuyển động an toàn

- Bổ sung collision proxy 3D đơn giản cho tường, mái, cột, cây lớn và nền. Collider XZ hiện có cho nhân vật không đủ biểu diễn độ cao mái phục vụ camera.
- Camera dùng cơ chế thu khoảng cách khi có vật cản giữa điểm nhìn và vị trí mong muốn. Dùng kiểm tra thể tích nhỏ hoặc nhiều tia có xét vùng near plane; một tia giữa màn hình có thể bỏ sót mép tường.
- Thu camera nhanh khi gặp vật cản, nới trở lại có damping; kiểm tra cả vị trí và đường đi sau smoothing. Giữ khoảng an toàn với mặt đất và tránh rung khi bám mép cột.
- Teleport phát sự kiện rõ ràng để đặt lại cả camera position và lookAt ở đích đã kiểm tra. Giữ Canvas và tài nguyên; không remount toàn cảnh để reset camera.
- Chọn walking/idle và phase bước theo displacement thực sau collision, không chỉ theo input. Kiểm ở joystick nhỏ, dừng đột ngột và đi sát tường.
- Kiểm stall 100 ms, quay lại tab, resize và thao tác đa chạm. Nếu có tunneling, thêm substep/sweep có giới hạn; hiện `resolveMovement` kiểm endpoint, nhưng chưa có bằng chứng runtime rằng người chơi đang xuyên tường.

**Cổng kiểm tra:** camera không xuyên mặt opaque trong bộ tuyến thử; teleport không bay xuyên quần thể; chân và thân không nhảy cao độ ngoài chuyển động chủ đích.

### Đợt 3 — Giảm chi phí để dành ngân sách cho hình ảnh

- Instancing diềm ngói và đấu củng theo geometry/material dùng chung, trước tiên trên mái chánh điện. Mỗi nhóm trang trí chuyển từ nhiều mesh sang số ít batch, giữ nguyên hình dáng để so sánh A/B.
- Tiếp tục với cột, lan can, chi tiết đèn và tượng lặp khi profiling chứng minh có lợi. Merge phần tĩnh theo từng khu/material; giữ collider và vùng tương tác độc lập.
- Chia batch theo khu vực để culling có ích. Kiểm lại bounding box/sphere sau khi thay instance matrices; engine có thể tự tính sphere lần đầu, nhưng bounds đã cache cần được cập nhật khi transform thay đổi.
- Thêm LOD cho chi tiết nhỏ; giữ silhouette mái/cột chính. Điểm bắt đầu thử: chi tiết gần dưới 18 m, vừa 18–40 m, xa trên 40 m; hysteresis khoảng 10–15%, điều chỉnh theo kích thước vật và video thực tế.
- Tránh mount/unmount hoặc biên dịch shader đúng lúc người chơi qua ngưỡng LOD. Chuẩn bị các biến thể trước; đổi LOD không đổi collision hay surface height.
- Lập pool đèn phụ có số slot cố định theo preset, thay đổi cường độ êm khi đổi khu. Emissive và ánh sáng nền duy trì đèn xa; kiểm cả nhiều đèn chồng vùng ảnh hưởng.
- Giảm số nhóm hạt và tần suất animation ở xa; gộp khói/hạt phù hợp thay vì mỗi hạt một sphere/material. Khói hiện đã `depthWrite={false}`, cần giữ đúng chính sách này khi gộp.
- Profile React commit khi HUD, chat, wishes và multiplayer cập nhật; tách phần cảnh tĩnh khỏi props thay đổi thường xuyên nếu cần. Quản lý quyền sở hữu/dispose cho tài nguyên dùng chung, tránh giải phóng khi mesh khác còn dùng.

**Cổng kiểm tra:** draw calls của nhóm mái được chọn giảm rõ ở cùng camera; tổng frame time không xấu đi; không mất cụm mesh ở mép màn hình hoặc nhảy chi tiết khi đi lùi/tiến.

### Đợt 4 — Nâng vật liệu, ánh sáng và nước

- Tạo nhóm vật liệu chuẩn cho gạch, đá, gỗ, ngói, kim loại và nước; chuẩn hóa UV/repeat theo kích thước thế giới. Base color dùng sRGB; normal/roughness là dữ liệu phi màu, không gán sRGB như color map.
- Thêm roughness/normal nhẹ cho vật gần, ưu tiên gạch sân và đá cầu. Giảm phần sáng/tối vẽ sẵn quá mạnh trong color map nếu gây cảm giác ánh sáng đóng cứng.
- Anisotropy chọn theo preset và chặn bằng capability của renderer; giữ mipmap/trilinear. Seed texture cố định giúp tái lập hình ảnh giữa lần tải.
- Cân lại day/sunset/night bằng ảnh tham chiếu; giữ độ sáng vừa đủ dưới mái. Fog giúp chiều sâu, còn culling/LOD mới giảm workload tương ứng; chỉ tăng fog không làm cảnh rẻ đi.
- Tune shadow frustum theo vùng chơi cần bóng. Bắt đầu với shadow camera cố định và caster chọn lọc; nếu phải bám người chơi, dịch theo texel để giảm bóng rung. Tune `bias/normalBias` theo hình học và ánh sáng, không tăng mù gây bóng tách chân.
- Một nguồn chính đổ bóng realtime; đèn trang trí dùng emissive/đèn phụ không shadow. Low dùng tiếp xúc nhẹ theo đúng mặt sàn; không đóng băng shadow map toàn cục khi avatar vẫn di chuyển.
- Với nước: lựa chọn opaque nếu không cần nhìn cá/đáy; hồ cần nhìn xuyên thì alpha blending được kiểm tra riêng. Khói, halo, vòng sáng thường không ghi depth nhưng vẫn depth-test với công trình. Không áp dụng một giá trị `depthWrite` cho mọi material trong suốt.
- `renderOrder` chỉ dùng cho các lớp có thứ tự thực sự cố định. Tránh lấy nó hoặc tắt `depthTest` làm cách che lỗi hình học hồ/giao nhau.
- Chống răng cưa: xác nhận antialias thực tế; chỉ thêm SMAA/FXAA khi đo và so sánh cho thấy cần, kể cả khi dùng render target. Bloom nhẹ có thể thử ở high; các hiệu ứng phản xạ/temporal nặng chỉ đưa vào khi còn ngân sách và vượt được kiểm tra chuyển động.

**Cổng kiểm tra:** sáu góc ảnh được duyệt trên day/sunset/night; video không có moiré rõ, bóng bò/rung, đảo lớp nước hoặc vệt ảnh theo chuyển động.

### Đợt 5 — Hoàn thiện preset và multiplayer

Truyền cấu hình chất lượng nhất quán từ `TempleScene` xuống courtyard, sanctuary, outer complex, hiệu ứng và avatar. Bảng dưới là **cấu hình khởi điểm đề xuất**, chưa phải ngân sách đã benchmark:

| Tham số | Low | Balanced | High |
| --- | --- | --- | --- |
| DPR tối đa | 1.0 | 1.5 | 2.0 |
| Shadow nguồn chính | Tắt realtime, tiếp xúc nhẹ | 1024, caster chọn lọc | 2048, caster chọn lọc |
| Slot đèn phụ có ảnh hưởng thực | Tối đa 2 | Tối đa 4 | Tối đa 6 |
| Anisotropy mong muốn | 2 | 4 | 8 |
| Chi tiết nhỏ và hạt | LOD sớm, mật độ thấp | LOD vừa, mật độ vừa | LOD muộn, tăng có giới hạn |
| Vật liệu gần | Color + roughness đơn giản | Thêm normal chọn lọc | Normal/roughness chi tiết hơn |
| Post-processing | Chỉ khi AA thực tế cần | Chỉ khi còn ngân sách | Bloom nhẹ tùy kết quả đo |

- Các mức đều dùng cùng layout, collider, mặt đi bộ và vật thể tương tác. Hạ quality không được làm mất đường đi hoặc đổi cao độ.
- Nếu thêm Auto quality: lấy mẫu vài giây, có ngưỡng lên/xuống tách biệt và cooldown; giảm hiệu ứng/hạt trước, rồi giảm DPR từng nấc. Không liên tục đổi độ nét hoặc shadow chỉ vì nhân vật bắt đầu di chuyển. Tôn trọng lựa chọn quality thủ công.
- Remote hiện nhận mẫu vị trí được throttle; cloud có giới hạn 850 ms ngoài các cập nhật buộc gửi. Tách đo độ trễ mạng khỏi giật render. Nếu tuyến multiplayer cho thấy giật/cắt góc, bổ sung snapshot có timestamp, nội suy có độ trễ được ghi rõ, extrapolation có giới hạn và cờ teleport.
- Remote giải cao độ theo cùng surface sau khi nội suy XZ, đồng thời xét tuyến đi hợp lệ trên cầu. Chỉ clamp Y không ngăn được đi tắt ngang mặt nước.
- Nhãn HTML dùng khoảng cách và occlusion proxy có chọn lọc, có hysteresis để không chớp ở mép tường; hạn chế nhãn/chi tiết avatar xa theo tải đã đo.

**Cổng kiểm tra:** đổi quality không đổi trạng thái người chơi; Auto không dao động liên tục; multiplayer qua cầu/teleport không phát sinh lỗi hình ảnh trong tải mục tiêu đã chốt.

## 5. Thiết bị và ngân sách nghiệm thu

Máy cụ thể và version browser còn **TBD**. Ma trận tối thiểu đề xuất: Windows/Chrome, macOS/Safari, Android tầm trung/Chrome và iPhone/Safari. Mỗi nhóm phải có ít nhất một thiết bị thật; giả lập kích thước màn hình không thay cho kiểm tra GPU, cảm ứng và nhiệt độ điện thoại.

Mục tiêu ban đầu để hiệu chỉnh sau baseline, không phải số đo hiện tại:

| Nhóm | Mục tiêu khung hình sau warmup | Kiểm tra bổ sung |
| --- | --- | --- |
| Desktop ở preset đã chọn | Hướng tới 60 FPS trên màn 60 Hz; p95 frame interval ≤ 20 ms, p99 ≤ 33.3 ms | Đi qua vùng mái lớn và cảnh đêm; ghi cả frame spike thay vì chỉ FPS trung bình. |
| Điện thoại ở preset phù hợp | Hướng tới ít nhất 30 FPS; p95 ≤ 35 ms, p99 ≤ 50 ms | Chạy nóng 10 phút, xoay màn hình, vừa joystick vừa orbit. Máy đủ mạnh có thể đặt mục tiêu 60 FPS riêng. |
| Cả hai | Không regression frame time ngoài sai số giữa các lượt A/B; tài nguyên tiến tới trạng thái ổn định sau các vòng chạy | Ghi nhận tăng memory/tài nguyên liên tục, context lost, shader compile hoặc GC spike. |

Ngưỡng cuối cùng, player-count được hỗ trợ và dung lượng bộ nhớ là **TBD theo baseline và thiết bị thật**. Nếu một hiệu ứng làm vượt ngân sách, giảm hiệu ứng hoặc điều chỉnh preset rồi chạy lại đúng tuyến bị ảnh hưởng.

## 6. Bộ tuyến kiểm tra hình ảnh khi chuyển động

Bảng dưới là bộ tuyến nghiệm thu đầy đủ. Đã có smoke test một số thao tác trong [kết quả triển khai](environment-implementation.md); chưa đánh dấu PASS toàn tuyến khi chưa có đủ video, cấu hình máy và kết quả tương ứng.

| ID | Thao tác | Điều kiện đạt |
| --- | --- | --- |
| ENV-01 | Spawn `z=46` → cầu bán nguyệt → cổng → sân; đi hai chiều ở nhiều mức joystick | Chân bám mặt cầu, không chìm/nổi, không giật ở đầu cầu; dáng đi khớp vận tốc thực. |
| ENV-02 | Đi sát tường/cột/mái chánh điện và hành lang; orbit 360°, pitch thấp/cao, zoom từ 3.5 đến 18 m | Camera không xuyên mặt công trình hoặc mặt đất, không rung liên tục khi thu/nới. |
| ENV-03 | Đi cầu cửu khúc đến đảo Quan Âm; rẽ sát góc, dừng và đổi hướng | Không cắt góc ra nước, nhảy Y hoặc chìm mặt cầu; camera giữ tầm nhìn hợp lệ. |
| ENV-04 | Đi vòng hai hồ sen và hồ non bộ; hạ camera nhìn xiên qua nước/lá/cá | Thành, đáy, nước và sen đúng lớp; không biến mất hoặc đảo thứ tự theo góc nhìn. |
| ENV-05 | Đi dọc nền gạch/đá; nhìn xiên mái; tiến/lùi nhiều lần qua ngưỡng LOD | Không nháy sàn, moiré nổi bật, mất mesh hoặc đổi silhouette đột ngột. |
| ENV-06 | Teleport giữa các zone xa nhau rồi di chuyển ngay, lặp cả khi camera ở sát vật cản | Camera và lookAt đặt lại ở đích hợp lệ; không bay xuyên cảnh, không kẹt avatar ở đích. |
| ENV-07 | Đổi day/sunset/night và low/balanced/high lúc đứng, lúc đi, gần đèn/vòng tương tác | Hình học và vị trí giữ đúng; không khung hình đen, thiếu texture hoặc ánh sáng chớp do đổi cấu hình. |
| ENV-08 | Trên điện thoại: vừa joystick vừa kéo camera; xoay màn hình; chuyển tab rồi quay lại | Không kẹt input, nhảy camera hoặc bước chuyển động lớn gây xuyên cảnh. |
| ENV-09 | Hai thiết bị chạy multiplayer: qua cầu, rẽ góc, teleport; thử mạng có jitter | Remote không chìm cầu, đi tắt qua nước hay bị kéo dài từ vị trí cũ; ghi riêng độ trễ mạng. |
| ENV-10 | Lặp tuyến toàn khu, chat/wishes và tải avatar mục tiêu; chạy nóng ít nhất 10 phút | Đạt ngân sách preset/thiết bị; không tăng tài nguyên không giới hạn hoặc mất WebGL context. |

Chạy các tuyến cốt lõi trên ma trận **3 thời điểm × 3 quality** trên desktop và điện thoại. ENV-09/10 bổ sung tải multiplayer đã chốt; kiểm thêm mạng chậm trên các trường hợp có biểu hiện.

## 7. Cách chia thay đổi và quyết định hoàn tất

Chia thành các thay đổi dễ review: công cụ đo; hồ và mặt cầu; camera/teleport; instancing mái; LOD/đèn/preset; vật liệu/khí quyển; remote và nhãn nếu cần theo baseline. Mỗi thay đổi lưu video trước/sau, thông số đo, tuyến đã chạy và phần còn UNEXECUTED. Các biến thể hình ảnh mới nên có công tắc để so sánh và quay lại cấu hình trước.

Khi triển khai, test tự động tập trung vào logic có rủi ro: camera collision/reset, cùng nguồn surface height, biên LOD/hysteresis và motion khi stall. Kiểm tra typecheck/build là bắt buộc cho code thay đổi; chúng không thay được video trên GPU và thiết bị thật.

Nghiệm thu cuối cần hình ảnh tham chiếu được chấp nhận, các tuyến cốt lõi đạt trên thiết bị mục tiêu, không còn lỗi camera/hình học nghiêm trọng và bảng hiệu năng có số đo. Source đã được triển khai; trạng thái nghiệm thu thực tế được ghi riêng trong kết quả triển khai.

## 8. Tài liệu kỹ thuật đối chiếu

- [React Three Fiber — Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance): tái sử dụng tài nguyên, instancing, LOD và điều chỉnh chất lượng có ngưỡng; rendering theo nhu cầu cần cơ chế invalidate cho chuyển động liên tục.
- [Three.js — InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): instance matrices và cập nhật bounds.
- [Three.js — Material](https://threejs.org/docs/pages/Material.html): depth test/write, transparency và polygon offset; chính sách phải theo từng loại material.
- [Three.js — LightShadow](https://threejs.org/docs/pages/LightShadow.html): map size, bias/normalBias và cập nhật shadow cho vật chuyển động.
- [Three.js — Texture](https://threejs.org/docs/pages/Texture.html): color space, anisotropy và mipmap. Tài liệu online có thể thuộc bản mới hơn; source dependency đã cài là căn cứ xác nhận API khi thực hiện.
