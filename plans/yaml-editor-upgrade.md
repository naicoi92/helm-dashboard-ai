# Nâng cấp YAML Editor cho Helm Dashboard

## Bối cảnh (Context)

Dự án Helm Dashboard hiện có trải nghiệm chỉnh sửa/xem YAML kém:
- **Phần chỉnh sửa duy nhất** (`UserDefinedValues.tsx` trong modal Install/Upgrade) chỉ là một `<textarea>` thô — không có syntax highlighting, không số dòng, không auto-indent, không format code.
- Các **viewer read-only** (`ChartValues.tsx`, `DescribeResource` trong `RevisionResource.tsx`, view mode trong `RevisionDiff.tsx`) dùng `highlight.js` + `<pre>` + `dangerouslySetInnerHTML` — chỉ tô màu cú pháp, không có trải nghiệm editor (không fold, không search...).
- **Diff** dùng `diff2html` + `highlight.js` (`ManifestDiff.tsx`, diff mode trong `RevisionDiff.tsx`).

**Mục tiêu:** Thay toàn bộ trải nghiệm YAML bằng **CodeMirror 6** (một thư viện code-editor chuyên nghiệp, nhẹ) cho cả editor chỉnh sửa và các viewer read-only. Editor chỉnh sửa sẽ **thêm tính năng format code** bằng Prettier chạy client-side, với nút bấm + phím tắt `Ctrl+Shift+F`.

**Quyết định đã chốt (theo user):**
- Phạm vi: **cả editor + viewers** (đồng nhất toàn app).
- Thư viện: **CodeMirror 6** (`@uiw/react-codemirror`) — nhẹ (~150-200KB gzip), phù hợp app nhúng binary Go.
- Format: **Prettier trình duyệt** (`prettier/standalone` + `prettier/plugins/yaml`).

## Kiến trúc & Giải pháp

### 1. Tạo component tái sử dụng `YamlEditor`
Đặt tại `frontend/src/components/common/YamlEditor/`:
- `YamlEditor.tsx` — wrapper quanh `@uiw/react-codemirror`.
- Props:
  - `value: string` — nội dung YAML.
  - `onChange?: (value: string) => void` — callback khi chỉnh sửa (bỏ qua nếu `readOnly`).
  - `readOnly?: boolean` — chế độ viewer (ẩn nút format, không cho edit).
  - `height?: string` — chiều cao (mặc định `"330px"` khớp `max-h-[330px]` hiện tại của ChartValues).
  - `className?: string` — class bao ngoài.
- Cấu hình CodeMirror extensions:
  - `yaml()` từ `@codemirror/lang-yaml` (highlight + indent).
  - `githubLight` theme từ `@uiw/codemirror-theme-github` (khớp giao diện sáng hiện tại; thay highlight.js).
  - Basic setup có sẵn của `@uiw/react-codemirror`: số dòng, code folding, bracket matching, search (Ctrl+F), auto-indent.
- **Toolbar format (chỉ khi `!readOnly`):** nút "Format" + phím tắt `Ctrl+Shift+F` gọi hàm `formatYaml()` từ `utils/yaml.ts`, cập nhật giá trị editor.

### 2. Tiện ích format `formatYaml`
Đặt tại `frontend/src/utils/yaml.ts` (mới):
```ts
import { format } from "prettier/standalone";
import * as prettierPluginYaml from "prettier/plugins/yaml";

export async function formatYaml(value: string): Promise<string> {
  if (!value.trim()) return value;
  return format(value, { parser: "yaml", plugins: [prettierPluginYaml] });
}
```
Hoàn toàn client-side, không thay đổi backend.

### 3. Cập nhật các component hiện tại

| File | Thay đổi |
|------|----------|
| `components/modal/InstallChartModal/UserDefinedValues.tsx` | Thay `<textarea>` bằng `<YamlEditor>` (editable + format). Giữ pattern `useState` + `useDebounce` 500ms hiện tại để gọi `onValuesChange`. |
| `components/modal/InstallChartModal/ChartValues.tsx` | Thay `highlight.js` + `<pre dangerouslySetInnerHTML>` bằng `<YamlEditor readOnly>`. Bỏ import `hljs`/`yaml`. |
| `components/revision/RevisionResource.tsx` (`DescribeResource`) | Thay block `hljs.highlight` + `<pre dangerouslySetInnerHTML>` bằng `<YamlEditor readOnly>`. Bỏ import `hljs`/`yaml`. |
| `components/revision/RevisionDiff.tsx` | **Chỉ view mode (`VIEW_MODE_VIEW_ONLY`)**: thay `hljs.highlight` + `<pre>{parse(content)}` bằng `<YamlEditor readOnly>`. **Diff mode giữ nguyên `diff2html`** (vì cần side-by-side diff). |

### Giữ nguyên
- `highlight.js` + `diff2html`: vẫn dùng cho phần diff (`ManifestDiff.tsx`, diff mode của `RevisionDiff.tsx`) qua `diff2htmlUi.highlightCode()`. **Không xóa** để tránh hỏng diff view.
- Cấu trúc modal `DefinedValues` (hai cột `UserDefinedValues` + `ChartValues` cạnh nhau, mỗi cột `w-1/2`) — giữ nguyên, chỉ cần đảm bảo chiều cao hai editor khớp nhau.

## Dependencies cần thêm (frontend)

Thêm vào `dependencies` trong `frontend/package.json`:
- `@uiw/react-codemirror` (`^4.25.10`) — React wrapper.
- `@codemirror/lang-yaml` (`^6.1.3`) — YAML language support.
- `@uiw/codemirror-theme-github` (`^4.25.10`) — theme sáng GitHub.
- `prettier` — chuyển từ `devDependencies` sang `dependencies` (cần `prettier/standalone` + `prettier/plugins/yaml` ở runtime). Phiên bản `^3.8.4` hiện có.

> Lưu ý Vite bundling: thêm các package CodeMirror vào `rollupOptions.output.manualChunks` nếu bundle chính quá lớn, để tách chunk riêng.

## Files sẽ sửa/tạo

**Tạo mới:**
- [ ] `frontend/src/components/common/YamlEditor/YamlEditor.tsx` — component chính.
- [ ] `frontend/src/components/common/YamlEditor/YamlEditor.stories.tsx` — Storybook story (editable + readOnly variants), theo pattern `.stories.tsx` hiện có.
- [ ] `frontend/src/utils/yaml.ts` — `formatYaml()` tiện ích.

**Sửa:**
- [ ] `frontend/src/components/modal/InstallChartModal/UserDefinedValues.tsx` — textarea → YamlEditor.
- [ ] `frontend/src/components/modal/InstallChartModal/ChartValues.tsx` — highlight.js → YamlEditor readOnly.
- [ ] `frontend/src/components/revision/RevisionResource.tsx` — DescribeResource highlight.js → YamlEditor readOnly.
- [ ] `frontend/src/components/revision/RevisionDiff.tsx` — view mode highlight.js → YamlEditor readOnly.
- [ ] `frontend/package.json` — thêm 3 package CodeMirror + chuyển prettier sang dependencies.

**Có thể cần chỉnh thêm:**
- `frontend/src/index.css` — nếu muốn tinh chỉnh style CodeMirror (canh lề, font `--font-sf-mono` đã có sẵn).
- `frontend/vite.config.ts` — tách chunk CodeMirror trong `manualChunks` nếu cần.

## Các bước triển khai (Steps)

- [ ] **Bước 1:** Cài dependencies (`npm install @uiw/react-codemirror @codemirror/lang-yaml @uiw/codemirror-theme-github`, chuyển `prettier` sang `dependencies`).
- [ ] **Bước 2:** Tạo `utils/yaml.ts` với hàm `formatYaml()`.
- [ ] **Bước 3:** Tạo component `YamlEditor` (`editable` + `readOnly` mode, toolbar format, phím tắt Ctrl+Shift+F, theme GitHub light).
- [ ] **Bước 4:** Thêm Storybook story cho `YamlEditor` (2 biến thể).
- [ ] **Bước 5:** Refactor `UserDefinedValues.tsx` (textarea → YamlEditor, giữ useDebounce).
- [ ] **Bước 6:** Refactor `ChartValues.tsx` (highlight.js → YamlEditor readOnly).
- [ ] **Bước 7:** Refactor `DescribeResource` trong `RevisionResource.tsx` (highlight.js → YamlEditor readOnly).
- [ ] **Bước 8:** Refactor view mode trong `RevisionDiff.tsx` (highlight.js → YamlEditor readOnly; giữ diff2html cho diff mode).
- [ ] **Bước 9:** (Tuỳ chọn) tách chunk CodeMirror trong `vite.config.ts` nếu bundle phình to.

## Kiểm tra (Verification)

- [ ] **Type-check:** `cd frontend && npm run tsc` — không lỗi type.
- [ ] **Lint/Format:** `npm run lint` và `npm run prettier` — không lỗi.
- [ ] **Build:** `npm run build` — build thành công, kiểm tra `stats.html` (bundle size CodeMirror hợp lý ~150-200KB gzip).
- [ ] **Dev:** `npm run dev` và kiểm tra thủ công:
  - **Install/Upgrade modal:** editor có syntax highlighting, số dòng, fold, search (Ctrl+F). Gõ YAML → cập nhật diff manifest sau debounce. Bấm "Format" / `Ctrl+Shift+F` → YAML được định dạng lại. Cột "Chart Value Reference" hiển thị readOnly cùng chiều cao.
  - **Revision > Resources > Describe** (Drawer): YAML resource hiển thị readOnly với highlighting, fold, search.
  - **Revision > Manifest/Values** (view mode): YAML hiển thị readOnly. Chuyển sang "Diff with previous" → diff2html vẫn hoạt động bình thường.
- [ ] **Storybook:** `npm run storybook` → xem 2 biến thể editable/readOnly của YamlEditor.

---

## Fix bug sau triển khai

### Vấn đề
- **Bug 1:** `UserDefinedValues` không hiện giá trị khi load lần đầu (phải mở lại lần 2 mới hiện). Root cause: component được render ngay khi đang loading với `initialValue=""`, và `useState(initialValue)` chụp giá trị rỗng đó.
- **Bug 2:** Giá trị không được format khi mở modal.

### Root cause tổng quát (theo feedback)
Vấn đề cốt lõi là dự án cho phép hiển thị editor **trước khi load xong**. Approach đúng: trong khi loading → hiện Spinner; chỉ khi đã có đủ thông tin (load xong) → mới hiển thị editor để edit.

### Cách sửa
- Truyền prop `loading` từ `DefinedValues` xuống `UserDefinedValues` (hiện đã có sẵn `loading` ở `DefinedValues` nhưng chỉ truyền cho `ChartValues`).
- `UserDefinedValues.tsx`:
  - Khi `loading === true` → hiển thị `<Spinner />` (không mount editor).
  - Khi load xong → mount `<YamlEditor>` với `useState(initialValue)` (lúc này `initialValue` đã có giá trị thật → init đúng, không cần patch state).
  - Format giá trị khi mount: vì editor chỉ mount khi data sẵn sàng, thêm `useEffect` mount gọi `formatYaml(initialValue)` để định dạng đẹp ngay từ đầu.
- File sửa:
  - `frontend/src/components/modal/InstallChartModal/UserDefinedValues.tsx` (thêm prop `loading`, Spinner, format khi mount).
  - `frontend/src/components/modal/InstallChartModal/DefinedValues.tsx` (truyền `loading` xuống `UserDefinedValues`).

## Decisions Log

- **Rejected:** Dùng `useEffect` đồng bộ `initialValue` → state để patch giá trị khi API trả về. **Why:** User feedback cho rằng vấn đề cốt lõi là app hiển thị editor trước khi load xong; approach đúng là hiện Spinner khi loading và chỉ mount editor khi data sẵn sàng — clean hơn và giải quyết triệt để cả 2 bug.
