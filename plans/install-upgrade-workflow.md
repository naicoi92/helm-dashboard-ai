# Tối ưu Workflow Install/Upgrade & Diff Reload

## Bối cảnh (Context)

Logic Yaml Editor cho install/upgrade hiện có nhiều vấn đề:
- **BUG nghiêm trọng — diff "xóa toàn bộ content"**: khi modal mở, diff chạy TRƯỚC khi default value + user value load xong → manifest rỗng (`undefined`) → diff hiển thị **xóa toàn bộ content**. Đây là logic sai cốt lõi.
- **"Diff change reload không phù hợp"**: mỗi keystroke → cascade 2 roundtrip API (helm template render + diff compute) → diff panel reload/flash liên tục, diff cả khi chưa đủ thông tin hợp lệ.
- **Workflow rắc rối**: 2 modal trùng lặp ~80% logic; state values có 2 nguồn sự thật.

**Quyết định user:** Chỉ render diff **SAU khi** default value (`chartValues`) VÀ user value (`releaseValues`/`values`) load thành công. Chưa có data → không diff (không hiện diff "xóa hết"). Refresh phải **mượt** (giữ diff cũ + badge "updating", không flash spinner toàn panel).

---

## Phân tích vấn đề (đã xác nhận trong code)

### Chuỗi cascade hiện tại — MỖI keystroke (sau debounce 500ms)
```
User gõ → setUserDefinedValues (state nội bộ editor)
  → useDebounce 500ms → onValuesChange → parent setUserValues
  → useVersionData refetch  ← POST helm template render (preview=true) — ĐẮT!
  → selectedVerData thay đổi
  → useDiffData refetch      ← POST /diff
  → ManifestDiff useEffect → diff2htmlUi.draw() (redraw DOM thủ công)
```
= **2 roundtrip tuần tự/keystroke**, roundtrip đầu là helm template render rất nặng. ManifestDiff thay toàn bộ panel bằng spinner → **flash**.

### Vấn đề 0 — Diff "xóa toàn bộ content" khi data chưa sẵn sàng (BUG NGHIÊM TRỌNG — root cause)

`useDiffData` (`API/shared.ts:48`) có `enabled: Boolean(selectedVerData)` — nhưng `selectedVerData` default là `{}` (truthy!) → **diff LUÔN enabled**.

Khi modal mở, manifest chưa load xong:
- `selectedVerData` = `{}` (default) → `selectedVerData.manifest` = `undefined`
- `formData.append("b", undefined)` → FormData convert thành string `"undefined"`
- Diff so sánh `currentVerManifest` (manifest đầy đủ đang chạy) vs `"undefined"` → **hiển thị xóa toàn bộ content**

Ngoài ra `useVersionData` (`API/releases.ts`) không có gate readiness — chạy ngay cả khi `releaseValues` chưa load (values `""`) → render manifest với values rỗng → manifest sai.

**Fix cốt lõi:** gate diff trên **data readiness** (đã load xong default value + user value + cả 2 manifest không rỗng), KHÔNG chỉ check `Boolean(object)`.

### Vấn đề 1 — Format-on-mount trigger diff THỪA
`UserDefinedValuesEditor` chạy `formatYaml(initialValue)` ngay khi mount. Prettier reformat → string khác `releaseValues` gốc → `onValuesChange(formatted)` → `setUserValues` → **toàn bộ cascade chạy lại dù user chưa đụng gì**.
Trên modal mở, `useVersionData` chạy **2 lần**: (1) raw releaseValues, (2) formatted. → diff tính 2 lần không cần thiết.

### Vấn đề 2 — Không có readiness/validity gate
`useVersionData` chạy ngay cả khi `chartAddress=""`, `version=""`, hoặc values rỗng (chưa load) → diff trên input không hợp lệ → **diff sai** (xem Vấn đề 0). `useVersionData` nhận CẢ `userValues` VÀ `releaseValues` → 2 nguồn sự thật, trigger thừa. `useDiffData` enabled check sai (`Boolean({}) = true`).

### Vấn đề 3 — ManifestDiff render imperative & flash
Dùng `Diff2HtmlUI` (class thao tác DOM) + ref. Khi `isLoading` → hiện spinner thay toàn panel → flash mỗi lần.

### Vấn đề 4 — Code trùng lặp 2 modal
`InstallReleaseChartModal` & `InstallRepoChartModal`: version selection, URL mode, chartAddress, useVersionData, useDiffData, mutation FormData — gần như identical.

### Vấn đề 5 — `window.location.reload()` (chỉ release modal)
Nặng & không nhất quán. Codebase đã có pattern `queryClient.invalidateQueries`.

---

## Approach (Giải pháp)

### Nguyên tắc cốt lõi
> **Diff CHỈ render khi: (1) default value + user value đã load thành công, (2) cả 2 manifest (before/after) không rỗng, (3) values hợp lệ. Chưa sẵn sàng → không diff (không hiện "xóa hết"). Khi sẵn sàng → refresh mượt.**

### Thiết kế mới cho data flow

```
Load phase:
  chartValues (default)  ──┐
  releaseValues (user)   ──┴── both loaded? → init values (format 1 lần)
  currentVerManifest     ───── loaded? (upgrade only)

Diff phase (chỉ chạy khi data sẵn sàng):
  values (state duy nhất)
    → useDebounce 500ms → debouncedValues
    → readiness check: chartAddress + version + values loaded + valid YAML
    → useVersionData(enabled: ready) [placeholderData: keepPreviousData]
    → readiness check: selectedVerData.manifest non-empty
    → useDiffData(enabled: ready)    [placeholderData: keepPreviousData]
    → ManifestDiff (isFetching badge, giữ diff cũ)
```

### 1. Một nguồn sự thật duy nhất cho values (loại bỏ duality)

**Hiện tại:** `userValues` (parent, bắt đầu `""`) + `userDefinedValues` (editor nội bộ) + `releaseValues` truyền vào queryKey.

**Mới:** Parent sở hữu `values` (state duy nhất). Editor là controlled component.
- Khi `releaseValues` load xong (upgrade) → format **một lần** → `setValues(formatted)`. Đây là giá trị khởi đầu, **không phải user edit** → không gây double fetch.
- `useVersionData` nhận **chỉ** `debouncedValues` (bỏ `releaseValues` khỏi queryKey/params).

```ts
// Trong modal/hook
const [values, setValues] = useState("");
const debouncedValues = useDebounce(values, 500); // reuse hooks/useDebounce.tsx

// Khởi tạo 1 lần khi releaseValues sẵn sàng (upgrade flow)
useEffect(() => {
  if (isUpgrade && releaseValues && !valuesInitialized.current) {
    formatYaml(releaseValues).then(setValues).catch(() => setValues(releaseValues));
    valuesInitialized.current = true;
  }
}, [releaseValues, isUpgrade]);
```

**Loại bỏ:** `UserDefinedValuesEditor` (component con với `useState` + format-on-mount + debounce nội bộ). `UserDefinedValues` chỉ render `<YamlEditor value={values} onChange={setValues} />` — đơn giản, controlled.

### 2. Readiness gate — chỉ diff khi data đã load xong (FIX BUG "xóa toàn bộ")

**Fix `useDiffData` (`API/shared.ts`):** đổi `enabled` từ `Boolean(selectedVerData)` (sai — `{}` là truthy) sang check manifest thật sự có nội dung:
```ts
// Trước (BUG): enabled: Boolean(selectedVerData)  ← {} luôn true
// Sau:
enabled:
  Boolean(selectedVerData?.manifest) &&   // after-side manifest KHÔNG rỗng
  Boolean(currentVerManifest) &&           // before-side manifest KHÔNG rỗng (upgrade)
  !versionsError,                          // không có lỗi load version
```

**Fix `useVersionData` (`API/releases.ts`):** thêm gate readiness — không fetch manifest khi values chưa load:
```ts
const isDataReady =
  Boolean(chartAddress) &&
  Boolean(selectedVersion) &&
  valuesReady;  // releaseValues đã load (upgrade) hoặc user đã nhập values (install)

useVersionData({ ..., enabled: isDataReady })
```

**Trong ManifestDiff:** khi data chưa sẵn sàng → hiện "Loading..." / spinner, **KHÔNG hiện diff**. Tránh hoàn toàn trường hợp diff "xóa toàn bộ".

Thêm helper `isLikelyValidYaml` trong `utils/yaml.ts` (parse nhanh client-side) — nếu user đang gõ dở YAML không hợp lệ → **skip diff**, giữ diff cũ (nhờ keepPreviousData).

### 3. Smooth refresh — giữ diff cũ, badge "updating" (không flash)

Thêm `placeholderData: keepPreviousData` (React Query 5, chưa dùng trong codebase) cho `useVersionData` và `useDiffData`:
```ts
useVersionData({ ..., options: { placeholderData: keepPreviousData } })
```
**ManifestDiff** refactor:
- Không thay panel bằng spinner khi `isFetching` (đang fetch nhưng có data cũ).
- Chỉ spinner khi **chưa có diff lần nào** (`isLoading` = fetch đầu, chưa có data).
- Badge nhỏ "● updating..." ở góc khi `isFetching` (dùng `useVersionData.isFetching || useDiffData.isFetching`).
- Pass thêm prop `isFetching` xuống ManifestDiff.

### 4. Loại bỏ format-on-mount trigger (đã giải quyết trong mục 1+2)
Format khởi đầu được set làm `values` khởi tạo → diff tính 1 lần với values đúng ngay từ đầu. Không có "raw rồi formatted" double fetch.

### 5. Trích hook dùng chung `useInstallUpgradeFlow` (giải quyết workflow rắc rối)

Gộp logic chung của 2 modal vào 1 hook tại `components/modal/InstallChartModal/useInstallUpgradeFlow.ts`:
- Version selection + URL mode toggle
- `chartAddress` computation
- `values` state + debounce + validity gate
- `useVersionData` + `useDiffData` cascade (với keepPreviousData)
- Mutation factory (FormData build)

2 modal trở thành **thin wrapper** cấu hình hook + render UI riêng:
- **Upgrade modal** (`InstallReleaseChartModal`): thêm `currentVerManifest` baseline, `releaseValues` init, `forceUpgrade`, `useChartReleaseValues`.
- **Install modal** (`InstallRepoChartModal`): `currentVerManifest=""`, không releaseValues, `enabled: Boolean(chartAddress)`.

### 6. (Khuyến nghị) Sửa ManifestDiff sang declarative
Thay `Diff2HtmlUI` (imperative class + ref + useEffect) bằng `diff2html` parse + `html()` (declarative), render qua `dangerouslySetInnerHTML`. Render đúng theo React lifecycle, không cần workaround ref.

### 7. (Khuyến nghị) Bỏ `window.location.reload()`
Thay bằng `queryClient.invalidateQueries` sau mutation thành công (pattern đã có ở `AddRepositoryModal.tsx:59`).

---

## Files sẽ sửa/tạo

| File | Thay đổi |
|------|----------|
| **TẠO** `InstallChartModal/useInstallUpgradeFlow.ts` | Hook dùng chung: values, debounce, validity gate, diff cascade (keepPreviousData), mutation factory |
| **TẠO** `utils/yaml.ts` (sửa) | Thêm `isLikelyValidYaml()` helper |
| **SỬA** `UserDefinedValues.tsx` | Bỏ `UserDefinedValuesEditor` con; `YamlEditor` controlled trực tiếp từ parent values |
| **SỬA** `InstallReleaseChartModal.tsx` | Dùng `useInstallUpgradeFlow`; bỏ `userValues`/`releaseValues` duality; values init từ releaseValues |
| **SỬA** `InstallRepoChartModal.tsx` | Dùng `useInstallUpgradeFlow`; values init `""` |
| **SỬA** `ManifestDiff.tsx` | Badge "updating" + giữ diff cũ khi isFetching; (tuỳ chọn) declarative render |
| **SỬA** `API/releases.ts` (`useVersionData`) | Bỏ `releaseValues` khỏi queryKey/params; thêm `enabled` gate; `placeholderData` |
| **SỬA** `API/shared.ts` (`useDiffData`) | Thêm `enabled` gate; `placeholderData` |
| **SỬA** `DefinedValues.tsx` | Truyền `values` + `onChange` xuống (thay `initialValue` + `onUserValuesChange`) |

## Reuse (code có sẵn)
- `useDebounce` (`hooks/useDebounce.tsx`) — debounce values feed diff.
- `formatYaml` (`utils/yaml.ts`) — format khởi đầu.
- `getVersionManifestFormData` (`API/shared.ts`) — giữ nguyên.
- `keepPreviousData` từ `@tanstack/react-query` v5 — smooth refresh.
- `useQueryClient` + `invalidateQueries` pattern (`modal/AddRepositoryModal.tsx:59`).

## Các bước triển khai (Steps)

- [x] **Bước 1:** Thêm `isLikelyValidYaml()` vào `utils/yaml.ts`.
- [x] **Bước 2:** Sửa `useDiffData` (`API/shared.ts`): đổi `enabled: Boolean(selectedVerData)` → `enabled: Boolean(selectedVerData?.manifest)`. Đây là FIX trực tiếp bug "xóa toàn bộ". Thêm `placeholderData: keepPreviousData`.
- [x] **Bước 3:** Sửa `useVersionData` (`API/releases.ts`): bỏ `releaseValues` khỏi queryKey/params; thêm gate readiness (`enabled` khi data sẵn sàng); thêm `placeholderData: keepPreviousData`.
- [x] **Bước 4:** Tạo `useInstallUpgradeFlow.ts` — gộp version selection, values state+debounce+validity gate, diff cascade, mutation factory.
- [x] **Bước 5:** Refactor `UserDefinedValues.tsx` — bỏ component con, YamlEditor controlled từ parent `values`.
- [x] **Bước 6:** Refactor `InstallReleaseChartModal.tsx` — dùng hook; init values từ releaseValues (format 1 lần); bỏ `window.location.reload()` → `invalidateQueries`.
- [x] **Bước 7:** Refactor `InstallRepoChartModal.tsx` — dùng hook; values init `""`.
- [x] **Bước 8:** Refactor `ManifestDiff.tsx` — badge "updating" (isFetching) + giữ diff cũ; chỉ spinner khi chưa có diff lần nào.
- [x] **Bước 10:** Fix error casting (`as unknown as string`) → proper `error?.message` (giải quyết qua hook `errorString`).
- [x] **Bước 11:** `cd frontend && npm run tsc` — không lỗi type.
- [x] **Bước 12:** `npm run lint && npm run prettier`.

## Verification
- [ ] `cd frontend && npm run tsc` — không lỗi type.
- [ ] `npm run lint && npm run prettier`.
- [ ] **Manual upgrade modal (TEST BUG FIX chính):**
  - Mở modal → **KHÔNG bao giờ hiện diff "xóa toàn bộ content"**. Khi data đang load → hiện loading/empty, KHÔNG hiện diff sai.
  - Khi default value + user value load xong → diff hiện đúng (so sánh manifest cũ vs mới).
  - Diff tính 1 lần (không double fetch do format-on-mount).
  - Gõ YAML → sau 500ms dừng gõ → diff cập nhật mượt (giữ diff cũ, badge "updating", không flash spinner).
  - Gõ YAML dở/không hợp lệ → diff **không recompute**, giữ diff cũ.
  - Bấm Install → navigate đúng, không full page reload.
- [ ] **Manual install modal:**
  - Chọn version + gõ values → diff chỉ hiện khi chart address + version + values hợp lệ.
  - Khi chưa chọn version/chưa có chart address → KHÔNG hiện diff (không hiện "xóa hết").
  - Install thành công → navigate đúng `/namespace/name/installed/revision/1`.
- [ ] Cypress component test (nếu có cho modal).

## Decisions Log
- **Rejected:** Diff với `enabled: Boolean(selectedVerData)` (check object truthy). **Why:** `selectedVerData` default `{}` luôn truthy → diff chạy khi manifest chưa load → `selectedVerData.manifest = undefined` → diff hiển thị "xóa toàn bộ content". User feedback: "chưa có default value thì diff toàn là xóa full content, đây là logic không tốt".
- **Rejected:** Compute/render diff trước khi default value + user value load xong. **Why:** diff trên data chưa sẵn sàng cho kết quả sai (toàn bộ content bị xóa). Chỉ render diff sau khi cả default value (`chartValues`) và user value (`releaseValues`/`values`) load thành công.
- **Chosen:** Readiness gate cho `useDiffData` (`Boolean(selectedVerData?.manifest) && Boolean(currentVerManifest)`) + `useVersionData` (`enabled` khi values loaded) — fix trực tiếp bug "xóa toàn bộ".
- **Chosen:** Auto-refresh mượt (keepPreviousData + isFetching badge) theo lựa chọn user.
- **Chosen:** Hook extraction (`useInstallUpgradeFlow`) — giải quyết "workflow rắc rối" + tập trung fix diff ở 1 chỗ.
- **Pending:** Bước 9 (declarative ManifestDiff) & Bước 10 (error casting) — tuỳ chọn, scope mở rộng.
