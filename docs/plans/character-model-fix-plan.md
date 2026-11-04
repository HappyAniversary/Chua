# Kế hoạch sửa model nhân vật và tượng trong cảnh chùa

Ngày lập: 04/11/2026. Phong cách đã thống nhất: **cách điệu nhẹ, đồng bộ cảnh chùa**. Phạm vi gồm 21 model: nhân vật người chơi, Phật Thích Ca, Quan Âm và 18 vị La Hán; mỗi model có LOD0 và LOD1, tổng cộng 42 file GLB hiện có.

Mục tiêu là tạo hình dễ nhận biết, khuôn mặt hiền hòa hoặc biểu cảm phù hợp từng vị, thân thể liền lạc, áo có nếp lớn rõ ràng và chuyển động ổn định. Thứ tự thực hiện: **sửa bộ sinh hình học → sửa công cụ xem mẫu → hoàn thiện nhân vật → Phật Thích Ca và Quan Âm → bộ mẫu La Hán → toàn bộ 18 vị → tích hợp và nghiệm thu**.

Trạng thái cập nhật ngày 04/11/2026: **ĐÃ TRIỂN KHAI VÀ KIỂM TRA CỤC BỘ**. Xem báo cáo triển khai và bằng chứng (`outputs/character-model-fix/README.md`, bằng chứng cục bộ). Ma trận dưới đây được cập nhật theo bằng chứng đã có; Android, iPhone thật, multiplayer cloud và benchmark thiết bị vẫn chưa thực hiện.

## Hiện trạng và nguyên nhân cần xử lý

| Vấn đề | Căn cứ hiện có | Hướng xử lý |
| --- | --- | --- |
| Áo và bàn tay nhân vật có bề mặt nhọn, lởm chởm; mắt trông như hốc rỗng | Quan sát ảnh người dùng. Generator có phép khoét hốc mắt; chưa có phép so sánh mesh chưa rig với mesh đang animation để tách từng nguyên nhân | Sửa hình học chung trước, sau đó khuôn mặt, bàn tay, nếp áo và trọng số xương |
| Bộ phận tượng La Hán trông rời nhau, thân chia tầng | Quan sát ảnh và source. Kiểm mesh ngoại tuyến xác nhận `arhat_01` có đầu và hai tay thành các phần rời thân; `arhat_03` có khoảng hở giữa các phần thân và đầu | Dùng chung mốc giải phẫu cho đầu, cổ, vai, ngực, hông và tay; nối hình khối trước khi thêm chi tiết |
| Hàm nón cụt trả khoảng cách sai | Kiểm tra trực tiếp: trường hợp hai bán kính bằng 0.2, nửa chiều cao 0.4, điểm `[0.2, 0, 0]` phải nằm trên mặt trụ; hàm hiện trả khoảng 0.144 thay vì 0 | Sửa phép chiếu trong `sdCappedCone`, thêm kiểm tra độc lập cho trường hợp nón và trụ |
| Hàm ellipsoid trả giá trị không hữu hạn tại tâm | `sdEllipsoid([0,0,0], [0.2,0.3,0.2])` trả `NaN` | Xử lý điểm suy biến; chặn dữ liệu không hữu hạn trước khi xuất mesh |
| Những chấm vàng phía trên đầu nhân vật | Source gắn sáu dấu trang trí vào `head_socket`; socket đặt cao hơn đỉnh đầu theo tọa độ hiện tại | Đặt lại điểm neo và vị trí dấu trên bề mặt đầu, kiểm cả khi cúi và quay đầu |
| Công cụ Figure Lab có thể cho kết quả khác runtime | Lab clone scene thông thường, sửa material dùng chung, nút màu áo chưa áp dụng màu, marker socket không cập nhật theo animation | Sửa Lab thành công cụ kiểm tra đáng tin cậy trước khi dùng làm cửa nghiệm thu |
| Vật liệu có thể ảnh hưởng lẫn nhau giữa các bản model | `FigureModel` clone object nhưng tiếp tục sửa material tham chiếu chung; model tượng Phật và Quan Âm hiện có skeleton | Quản lý rõ quyền sở hữu material; quyết định rõ mesh tĩnh hay clone skeleton đúng cách |
| Avatar có nhánh bỏ qua clone geometry khi tạo nhiều bản sao | Effect lưu `originalColors` lên geometry cache rồi mới clone; avatar tiếp theo thấy dấu đã có nên có thể sửa geometry dùng chung. Đã tái hiện bằng hai scene clone ngoại tuyến | Clone geometry trước mọi thay đổi theo avatar, giữ bản màu gốc bất biến và thu hồi tài nguyên đúng chủ sở hữu |

Các kiểm tra trên là kiểm tra ảnh, source và tính toán ngoại tuyến. Mẫu sphere đơn giản đã cho mesh kín và hướng mặt đúng; chưa đủ cơ sở quy toàn bộ lỗi cho chiều tam giác của mesher. Cần tách lỗi SDF, bước làm mịn, rig và ánh sáng bằng các mẫu đối chứng.

## Quy chuẩn tạo hình

| Nhóm | Kết quả cần đạt |
| --- | --- |
| Nhân vật game | Đầu tròn, má và cằm mềm; mắt có mí và khối mắt rõ, miệng nhẹ; cổ nối vào thân; áo rủ thành mảng lớn, tay và dép gọn, silhouette rõ khi nhìn từ camera chơi |
| Phật Thích Ca | Giữ hướng tạo hình ngồi thiền của dự án; tỷ lệ đầu, vai, thân, chân xếp bằng cân đối; khuôn mặt an hòa, tai và tóc đọc được; tư thế tay thống nhất với mẫu tham chiếu; áo và đài sen tách lớp rõ |
| Quan Âm | Giữ hướng tượng đứng áo trắng của dự án; dáng thanh thoát, khuôn mặt dịu; khăn và tà áo có độ rủ; bàn tay, bình và cành hiện có nhận biết được; thân, chân và đài sen tiếp xúc hợp lý |
| 18 La Hán | Chung chất lượng tạo hình nhưng phân biệt được bằng dáng, biểu cảm và đạo cụ; tránh chỉ đổi đạo cụ trên 18 bản sao giống nhau; tên, ID, tư thế và vị trí trưng bày khớp danh mục được chọn cho dự án |

Chi tiết nhỏ phải còn đọc được ở kích thước camera chơi. Nếp vải lớn thuộc hình học; chi tiết quá nhỏ có thể giản lược hoặc chuyển sang normal/material nếu cần. Không tăng số polygon đồng loạt để bù lỗi hình khối.

Chuẩn bị bảng tham chiếu mặt trước, bên và sau cho từng nhóm trước khi hoàn thiện chi tiết. Hướng phong cách đã chốt; mẫu khuôn mặt, tư thế tay và danh mục biểu tượng từng vị vẫn **TBD** cho đến khi có tham chiếu cụ thể. Tên La Hán trong metadata hiện tại là danh mục kỹ thuật của dự án, chưa phải xác nhận tính chuẩn xác của một hệ tượng truyền thống cụ thể.

## Các gói công việc và điều kiện chuyển bước

| ID | Ưu tiên | Công việc | Phụ thuộc | Kết quả để chuyển bước |
| --- | --- | --- | --- | --- |
| MODEL 01 | P0 | Lưu baseline và hợp đồng asset | Không | Có ảnh trước sửa, bản sao 42 GLB và manifest, inventory và danh sách kiểm |
| MODEL 02 | P0 | Sửa SDF, kết nối hình khối và an toàn mesher | MODEL 01 | Fixture hình học đạt; xác định được lỗi có trước hay sau rig |
| MODEL 03 | P0 | Sửa Figure Lab và vòng đời asset runtime | MODEL 01 | Cùng một asset có pose, màu, socket và hình dạng nhất quán giữa Lab và game |
| MODEL 04 | P1 | Hoàn thiện nhân vật game | MODEL 02, MODEL 03 | Cả hai LOD và sáu hành động đạt kiểm hình, không ảnh hưởng màu avatar khác |
| MODEL 05 | P1 | Hoàn thiện Phật Thích Ca và Quan Âm | MODEL 02, MODEL 03 | Hai tượng đạt mẫu tạo hình, tiếp xúc bệ và ánh sáng trong game |
| MODEL 06 | P1 | Làm mẫu La Hán đứng và ngồi | MODEL 02, MODEL 03 | Hai cấu trúc cơ thể đạt trước khi nhân rộng |
| MODEL 07 | P1 | Hoàn thiện đủ 18 La Hán | MODEL 06 | Đủ 18 ID, khác biệt rõ, đạt hai LOD, đặt đúng hai dãy |
| MODEL 08 | P1 | Tối ưu và nghiệm thu tổng thể | MODEL 04, MODEL 05, MODEL 07 | Đạt kiểm hình, tương tác, cấu hình ánh sáng và ngân sách thiết bị đã chốt |

Sau MODEL 02 và MODEL 03, có thể triển khai nhân vật, hai tượng chính và mẫu La Hán song song. Một đầu mối giữ các thay đổi chung ở SDF, material, manifest và bộ xuất để tránh mỗi nhóm sửa một quy ước khác nhau.

### MODEL 01 Lưu baseline và hợp đồng asset

- Chụp nhân vật và từng tượng trong game ở mặt trước, nghiêng và sau; có một lượt ánh sáng trung tính để nhìn hình khối. Lưu thêm ảnh toàn dãy La Hán để so sánh tương quan tỷ lệ.
- Sao lưu 42 GLB cùng manifest trước lần bake đầu tiên; lưu checksum và cấu hình bake. Thư mục hiện không có Git repository nên cần bản sao rõ ràng để hoàn nguyên.
- Ghi hợp đồng gồm trục trước, đơn vị đo, điểm gốc chân hoặc đáy bệ, chiều cao, tên xương, tên socket, vùng đổi màu và quy ước LOD. Số xương phải lấy từ asset thực; tránh dùng nhãn “22 bones” đang không khớp một số dữ liệu hiện tại.
- Đo baseline cùng tuyến, camera, preset và số avatar: dung lượng tải, số tam giác đang vẽ, draw calls, frame time p50/p95 và số tài nguyên. Lưu cấu hình máy và trình duyệt.

Inventory ngoại tuyến hiện tại: 21 model, 42 file, tổng **19,807,200 byte**; tổng số tam giác của mọi file LOD0 là **450,512**, của mọi file LOD1 là **175,272**. Số đếm tam giác trong manifest khớp file GLB. Đây là tổng asset, không phải số tam giác được render trong một khung hình.

### MODEL 02 Sửa hình học dùng chung

- Sửa công thức `sdCappedCone` và trường hợp suy biến của `sdEllipsoid`; kiểm thêm capsule, smooth union và subtraction tại biên và tâm. Không để `NaN` hoặc `Infinity` đi vào lưới.
- Chạy các mẫu sphere, ellipsoid, trụ, nón cụt và hai khối nối nhau; kiểm dấu trong và ngoài, khoảng cách tại mặt, hướng mặt, cạnh hở, cạnh có hơn hai mặt và tam giác suy biến. Thêm mẫu có nếp áo và khối mảnh để tránh chỉ kiểm các mặt trơn.
- So sánh bốn bước: SDF không có chi tiết → mesh chưa làm mịn → mesh sau làm mịn → mesh có rig. Giới hạn bước chiếu lại bề mặt và dịch chuyển đỉnh khi hàm khoảng cách chỉ là xấp xỉ; bảo vệ cổ, mí mắt, ngón và nếp áo.
- Định nghĩa chung các mốc thân thể theo từng tư thế. Truyền các mốc ấy cho đầu, cổ, vai, thân và tay; rà lại local space và world space của tai, khăn, tay áo và đạo cụ. Tăng hệ số blend chỉ sau khi các khối đã đặt đúng và có tiếp xúc.
- Điều chỉnh bounds theo toàn bộ hình và đạo cụ; chi tiết mảnh phải phù hợp kích thước ô lấy mẫu. Thân thể cần liên tục ở các mối nối; mắt, hạt, đạo cụ và trang trí có thể là mesh rời có chủ đích.

Điều kiện hoàn tất: không có dữ liệu không hữu hạn, lỗi topology ngoài các phần tách đã khai báo hoặc bộ phận bị cắt bởi bounds; mẫu chưa rig và bind pose sau rig khớp nhau trong sai số đã định nghĩa. Không yêu cầu toàn bộ tượng và đạo cụ phải thành một mesh kín duy nhất.

### MODEL 03 Sửa Figure Lab và runtime

- Clone skeleton độc lập cho asset có rig; clone material trước khi chỉnh wireframe, tint hoặc độ nhám. Với avatar, clone geometry trước khi lưu hoặc sửa màu theo từng instance; giữ buffer nguồn bất biến và có cleanup tương ứng.
- Khôi phục bind pose từ transform gốc khi chọn chế độ tĩnh. Cho xem lưới trước rig và sau rig; chỉ hiện animation phù hợp với loại model.
- Làm nút màu áo hoạt động, marker socket theo xương từng frame và đúng hệ tọa độ; thống kê đủ mọi mesh. Chuẩn hóa tọa độ socket của hai tượng chính: vị trí trong không gian model phải được chuyển sang offset của xương trước khi gắn. Hiện bounds, hướng trước, ID model và LOD để tránh kiểm nhầm asset.
- Chốt hai tượng chính dùng mesh tĩnh hay có rig. Với nhu cầu trưng bày hiện tại, ưu tiên xuất mesh tĩnh ở pose cuối nếu không cần cử động; cập nhật manifest và socket theo cùng quyết định. Nếu giữ rig, runtime và Lab đều phải clone skeleton đúng cách.
- Thêm vùng vật liệu rõ ràng cho da, áo, viền, tóc, vàng, áo trắng và đạo cụ; đối chiếu slot thực trong GLB với manifest, vì danh sách tên trong manifest chưa chứng minh GLB đã có các material riêng. Nhân vật đổi màu theo vùng hoặc material ID ổn định, thay cho dò RGB gần đúng; cả LOD0 và LOD1 phải giữ quy ước này.
- Xử lý riêng trạng thái đang tải và lỗi tải model bằng fallback dễ nhận biết; kiểm load lại và đổi model không tăng tài nguyên liên tục.

### MODEL 04 Hoàn thiện nhân vật game

- Làm lại tỷ lệ đầu, mí mắt, mũi, miệng và tai; giảm cảm giác hốc mắt rỗng. Đặt dấu trang trí đầu sát bề mặt phù hợp phong cách đã chọn.
- Làm áo theo mảng chính gồm thân, tay áo, vạt chéo và gấu; giảm các nếp nhỏ gây gai. Làm bàn tay gọn ở khoảng cách chơi; kiểm khoảng hở ngón ở góc cận.
- Căn rig theo hình mới; khoanh vùng ảnh hưởng của tay áo, thân áo và chân để tránh kéo nhầm đỉnh. Không gán trọng số chỉ theo xương gần nhất trên mọi bộ phận.
- Kiểm đủ `idle`, `walking`, `praying`, `wooden_fish`, `bell`, `fortune`, cùng các chuyển tiếp về đứng yên; giữ tay và đạo cụ khớp nhau khi cúi, xoay và đi.
- Giữ các tên socket đang dùng; nếu đổi vị trí thì cập nhật cả tay, gậy mõ, ống xăm, nhang và dấu trên đầu. Kiểm đủ năm màu áo, ít nhất ba avatar đồng thời có màu và hành động khác nhau, cùng thao tác đổi màu lặp lại.

Điều kiện hoàn tất: không rách hoặc nhọn bất thường ở áo, không hở cổ và cổ tay, chân đặt đúng mặt đi; đạo cụ đi theo bàn tay và chỉ hiện đúng hành động; màu của một avatar không đổi màu avatar khác. Mẫu multiplayer cục bộ và kiểm hai client mạng thật phải ghi kết quả riêng.

### MODEL 05 Hoàn thiện Phật Thích Ca và Quan Âm

Phật Thích Ca: sửa nền hình đầu, cổ, ngực và chân xếp bằng trước; sau đó hoàn thiện khuôn mặt, tai, tóc, tư thế tay, nếp cà sa và đài sen. Phối màu vàng ấm có độ nhám đủ đọc khối, giữ sắc độ khác nhau giữa các vùng. Đối chiếu tỷ lệ với bệ và hào quang hiện có trong chánh điện.

Quan Âm: sửa đường nối đầu, cổ, vai, thân và chân; kiểm lại tọa độ khăn, tóc và tay áo. Hoàn thiện khuôn mặt, tư thế tay, bình và cành theo mẫu chọn. Dùng áo trắng ngà có sắc độ để đọc nếp, điểm vàng tiết chế; kiểm silhouette từ hướng cầu và quanh đảo.

Hai tượng cần kiểm tiếp xúc giữa đài sen trong GLB với bệ dựng trong scene để tránh chồng hai lớp đài sen, nổi khỏi bệ hoặc lún vào bệ. Căn hào quang theo model cuối, thay vì dùng scale để che lỗi tỷ lệ.

### MODEL 06 và MODEL 07 Hoàn thiện 18 La Hán

Làm trước một mẫu đứng và một mẫu ngồi, ưu tiên mẫu có tay nâng hoặc vươn và mẫu có đạo cụ lớn. Mỗi mẫu cần đạt tỷ lệ, mối nối, khuôn mặt, áo và hai LOD trong Lab lẫn hành lang. Khi hai mẫu đạt mới áp dụng cấu trúc chung cho các vị còn lại.

Lập bảng cho từng `arhat_01` đến `arhat_18`: tên trong dự án, tư thế, biểu cảm, đạo cụ, mẫu tham chiếu, bounds, vị trí và hướng đặt. Danh mục hình tượng cần được thống nhất trước khi làm chi tiết; các đặc điểm như rồng, hổ, tượng hoặc tháp phải theo danh mục đó.

Chia các vị còn lại theo ba nhóm công việc để tái sử dụng cấu trúc có kiểm soát: đứng và vươn tay; ngồi và cầm đạo cụ nhỏ; có linh vật hoặc đạo cụ lớn. Mỗi vị vẫn có hình đầu, biểu cảm hoặc dáng chính riêng. Duy trì ledger đủ 18 dòng, trạng thái ban đầu **UNEXECUTED**; chỉ đánh dấu đạt khi có ảnh riêng và kiểm trong dãy.

Điều kiện hoàn tất: đủ 18 ID duy nhất, không tráo model, nhận biết được dáng và đặc điểm chính, đầu và tay nối thân, đạo cụ không nổi vô cớ; đủ chín vị mỗi bên hành lang, hướng mặt và tiếp xúc bệ đúng. Kiểm khoảng hở với cột, mái và tượng kế bên.

### MODEL 08 Tích hợp LOD và nghiệm thu

LOD0 và LOD1 hiện được xuất thành file riêng nhưng game đang gọi trực tiếp LOD0. Cần bổ sung lựa chọn LOD theo khoảng cách và chất lượng, có hysteresis để tránh đổi liên tục ở ngưỡng. Kiểm điểm gốc, scale, màu và silhouette nhất quán; không để mất mặt, tay hoặc đạo cụ chính khi đổi LOD. Với avatar, việc đổi LOD phải giữ pose, màu và các đạo cụ gắn socket.

Bake ra thư mục staging, kiểm đủ file và metadata rồi thay bộ asset cùng manifest trong một lần. Dùng version hoặc URL có phiên bản để tránh cache giữ hình cũ. Chỉ bật nén geometry hoặc texture sau khi đo và có kiểm tra khả năng giải mã trên thiết bị mục tiêu.

## Ma trận nghiệm thu

| Mã | Phạm vi và cách kiểm | Tiêu chí đạt | Trạng thái |
| --- | --- | --- | --- |
| CHAR 01 | 21 model × 2 LOD, kiểm dữ liệu GLB | Load được; metadata khớp; dữ liệu hữu hạn, index và weight hợp lệ, bounds chứa đủ hình | PASS 42/42 GLB |
| CHAR 02 | Mỗi model, sáu hướng và góc cận mặt, ánh sáng trung tính | Không hở mối nối hoặc gai bất thường; mặt và chi tiết chính đọc được; giữ silhouette | PASS render cục bộ |
| CHAR 03 | Nhân vật, sáu hành động và chuyển tiếp | Không kéo rách áo, xuyên tay nghiêm trọng, chân trượt do rig hoặc đạo cụ trôi | PASS 72 pose CPU và video hai LOD |
| CHAR 04 | Nhân vật, năm màu và ít nhất ba bản sao; tạo, hủy và đổi màu theo nhiều thứ tự | Vùng đổi màu đúng; màu, skeleton và hành động độc lập; đổi màu lặp không tăng tài nguyên không giới hạn | PASS unit và smoke Local |
| CHAR 05 | Phật Thích Ca và Quan Âm tại vị trí thực | Tạo hình đúng mẫu đã chọn, tỷ lệ hợp cảnh, tiếp xúc bệ và hào quang hợp lý | PASS kiểm tra cục bộ |
| CHAR 06 | Đủ 18 La Hán trong Lab và hai hành lang | Đúng ID, dáng và đạo cụ theo bảng; không nổi đầu, rời tay hoặc xuyên cột; đủ chín vị mỗi bên | PASS asset và render; vị trí đủ 9 mỗi bên đã đối chiếu scene |
| CHAR 07 | Bốn nhóm model × low, balanced, high × ngày, hoàng hôn, đêm | Hình không mất chi tiết chính, vàng không cháy khối, áo trắng không bệt; không lỗi khi đổi preset | PASS smoke desktop và viewport điện thoại |
| CHAR 08 | Đi gần và xa, đổi LOD liên tục ở ngưỡng | Không nhảy vị trí hoặc pose, mất socket, đổi màu hay nhấp nháy silhouette rõ ở camera chơi | PASS unit, đồng bộ pose và smoke đổi LOD |
| CHAR 09 | Tải chậm, lỗi model, mở đóng Lab và đổi model lặp | Fallback đúng trạng thái, không crash, tài nguyên trở về mức ổn định | PASS unit cleanup và mô phỏng 404 rồi tải lại |
| CHAR 10 | Cùng tuyến benchmark và số avatar trước và sau | Đạt ngân sách frame time, bộ nhớ và tải đã thống nhất theo máy; phân tích mọi mức tăng | UNEXECUTED; benchmark và ngân sách thiết bị TBD |
| CHAR 11 | Android và iPhone thật, nhiều client mạng thật | Chất lượng và hành vi đạt trên cấu hình ghi rõ; kết quả riêng với giả lập viewport và NPC | UNEXECUTED |

Thiết bị mục tiêu, browser version, số avatar đồng thời và mục tiêu 30 hay 60 FPS: **TBD**. Viewport điện thoại trên desktop dùng để kiểm bố cục và góc nhìn; kết luận hiệu năng điện thoại cần thiết bị thật.

Kiểm code khi triển khai: `npm run typecheck`, `npm run test:environment`, `npm run build`, cùng các fixture hình học và asset validation bổ sung trong MODEL 02. Build thành công và test hình học không thay thế nghiệm thu hình ảnh. Mỗi lỗi ban đầu cần ảnh trước và sau cùng góc, thêm video cho lỗi chuyển động.

## Phân đợt bàn giao

1. **Đợt nền tảng:** baseline, sửa SDF và Figure Lab, có mẫu đối chứng chứng minh cổ, áo và mối nối ổn định.
2. **Đợt mẫu tạo hình:** một nhân vật, Phật Thích Ca, Quan Âm, một La Hán đứng và một La Hán ngồi, mỗi model đủ hai LOD. Kiểm mẫu trước khi mở rộng.
3. **Đợt đầy đủ:** hoàn thiện 18 La Hán, tích hợp LOD, material, cache và vị trí trong cảnh.
4. **Đợt nghiệm thu:** ảnh và video trước sau, ledger 21 model, kết quả kiểm thiết bị và benchmark, bộ asset có thể hoàn nguyên.

Thời lượng cụ thể: **TBD sau đợt nền tảng và mẫu tạo hình**, vì chưa biết mức phải tái tạo mesh, skin weight và chi tiết của từng vị. Nếu SDF sau sửa vẫn không cho khuôn mặt, bàn tay hoặc nếp áo đạt mẫu, chuyển phần khó sang mesh dựng và chỉnh ngoại tuyến, rồi xuất GLB theo cùng hợp đồng runtime. Giữ quyết định này ở cửa kiểm mẫu trước khi làm đủ 18 vị.

## Nguồn và bản đồ file cần sửa

| Phần | File chính |
| --- | --- |
| Primitive và nối SDF | [sdf.ts](../../scripts/figures/sdf.ts#L54), [mesher.ts](../../scripts/figures/mesher.ts#L45) |
| Nhân vật và rig | [samples.ts](../../scripts/figures/samples.ts#L65), [skeleton.ts](../../scripts/figures/skeleton.ts#L610), [MonkAvatar.tsx](../../src/components/player/MonkAvatar.tsx#L100) |
| Tượng chính và La Hán | [buddha.ts](../../scripts/figures/buddha.ts), [quanam.ts](../../scripts/figures/quanam.ts), [arhats.ts](../../scripts/figures/arhats.ts#L960) |
| Lab và runtime | [FigureLab.tsx](../../src/components/dev/FigureLab.tsx#L44), [FigureModel.tsx](../../src/components/world/FigureModel.tsx#L44) |
| Xuất asset và metadata | [bake_figures.ts](../../scripts/bake_figures.ts), [bake_arhats.ts](../../scripts/bake_arhats.ts), [exporter.ts](../../scripts/figures/exporter.ts), [types.ts](../../scripts/figures/types.ts), [manifest.json](../../public/models/figures/manifest.json) |
| Đặt tượng và hào quang | [MainSanctuary.tsx](../../src/components/world/MainSanctuary.tsx#L573), [TempleOuterComplex.tsx](../../src/components/world/TempleOuterComplex.tsx#L478) |

Ảnh đầu vào đã lưu tại nhân vật (`outputs/character-model-review/before-avatar.png`, bằng chứng cục bộ) và dãy La Hán (`outputs/character-model-review/before-arhats.png`, bằng chứng cục bộ). Kết quả kiểm tra tính toán và inventory tại offline-diagnostics.json (`outputs/character-model-review/offline-diagnostics.json`, bằng chứng cục bộ).
