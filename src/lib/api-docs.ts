/**
 * api-docs.ts — Nguồn dữ liệu cho trang tài liệu API /document
 *
 * Mỗi endpoint được mô tả đầy đủ: method, path, query params, body fields,
 * response mẫu, ví dụ curl và ví dụ fetch (JS).
 *
 * Placeholder dùng chung:
 *   {{BASE}}  → base URL của server (thay bằng domain thật khi render)
 *   {{PASS}}  → giá trị APP_PASSWORD
 */

export type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';

export type FieldDoc = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  example?: string;
};

export type ApiDoc = {
  id: string;
  group: string;
  method: HttpMethod;
  path: string;
  title: string;
  summary: string;
  /** 'none' | 'bearer' | 'cookie' */
  auth: 'none' | 'bearer' | 'cookie';
  note?: string;
  query?: FieldDoc[];
  body?: FieldDoc[];
  response?: string;
  errors?: { status: number; message: string }[];
  curl?: string;
  js?: string;
};

export const API_GROUPS = [
  'Authentication',
  'Objects',
  'Folders',
  'Upload',
  'Download & Proxy',
  'Storage',
] as const;

export const API_DOCS: ApiDoc[] = [
  // ─────────────────────────── Authentication ───────────────────────────
  {
    id: 'login',
    group: 'Authentication',
    method: 'POST',
    path: '/api/login',
    title: 'Đăng nhập (set cookie phiên)',
    summary:
      'Kiểm tra mật khẩu và set cookie "site_auth" để mở khóa giao diện quản trị. Cookie sống 7 ngày.',
    auth: 'none',
    note:
      'Sau khi đăng nhập thành công, mọi request tới trang (trừ /api/*) đều được middleware cho qua.',
    body: [
      {
        name: 'password',
        type: 'string',
        required: true,
        description: 'Mật khẩu ứng dụng (biến môi trường APP_PASSWORD).',
        example: '123123123@@',
      },
    ],
    response: `{
  "ok": true
}`,
    errors: [
      { status: 401, message: 'Sai mật khẩu → { "ok": false }' },
    ],
    curl: `curl -X POST "{{BASE}}/api/login" \\
  -H "Content-Type: application/json" \\
  -d '{"password":"{{PASS}}"}'`,
    js: `const res = await fetch('{{BASE}}/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: '{{PASS}}' }),
});
const data = await res.json(); // { ok: true }`,
  },
  {
    id: 'health',
    group: 'Authentication',
    method: 'GET',
    path: '/api/health',
    title: 'Health check',
    summary: 'Kiểm tra server còn sống. Không cần auth, không tốn tài nguyên R2.',
    auth: 'none',
    response: `{
  "ok": true
}`,
    curl: `curl "{{BASE}}/api/health"`,
    js: `const res = await fetch('{{BASE}}/api/health');
console.log(await res.json()); // { ok: true }`,
  },

  // ─────────────────────────── Objects ───────────────────────────
  {
    id: 'objects-list',
    group: 'Objects',
    method: 'GET',
    path: '/api/objects',
    title: 'Liệt kê object / folder',
    summary:
      'Liệt kê object trong bucket theo prefix. Có phân trang bằng continuationToken. Dùng delimiter "/" nên trả về cả file và thư mục con (CommonPrefixes).',
    auth: 'bearer',
    note:
      'Đây là hàm ListObjectsV2 của S3 nên response giữ nguyên shape chuẩn AWS (Contents, CommonPrefixes, IsTruncated, NextContinuationToken…).',
    query: [
      {
        name: 'prefix',
        type: 'string',
        description: 'Tiền tố đường dẫn. Bỏ trống = root. Ví dụ "Images/Sex/".',
        example: 'Images/Cast/',
      },
      {
        name: 'continuationToken',
        type: 'string',
        description:
          'Token phân trang lấy từ response trước (NextContinuationToken). Bỏ trống = trang đầu.',
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Số object tối đa mỗi trang (MaxKeys).',
        example: '1000',
      },
    ],
    response: `{
  "Contents": [
    {
      "Key": "Images/Cast/1777061136872-miu_suzuha150.jpg",
      "LastModified": "2026-04-24T20:05:39.942Z",
      "ETag": "84ec3db1e69b615df1737d68c340c3f1",
      "Size": 79279,
      "StorageClass": "STANDARD"
    }
  ],
  "CommonPrefixes": [
    { "Prefix": "Images/Cast/" }
  ],
  "IsTruncated": false,
  "NextContinuationToken": "1ueGcxLPRx1c/X6ExCXnhSpYL1veB2Lt...",
  "KeyCount": 1,
  "Prefix": "Images/Cast/",
  "MaxKeys": 1000
}`,
    curl: `curl "{{BASE}}/api/objects?prefix=Images/Cast/&limit=1000" \\
  -H "Authorization: Bearer {{PASS}}"`,
    js: `const params = new URLSearchParams({ prefix: 'Images/Cast/', limit: '1000' });
const res = await fetch(\`{{BASE}}/api/objects?\${params}\`, {
  headers: { Authorization: \`Bearer {{PASS}}\` },
});
const data = await res.json();
console.log(data.Contents, data.CommonPrefixes);`,
  },
  {
    id: 'objects-delete',
    group: 'Objects',
    method: 'DELETE',
    path: '/api/objects',
    title: 'Xóa object',
    summary: 'Xóa một hoặc nhiều object theo key (hỗ trợ batch tới 1000 key/request).',
    auth: 'bearer',
    body: [
      {
        name: 'keys',
        type: 'string[]',
        required: true,
        description: 'Danh sách key đầy đủ cần xóa.',
        example: '["Images/Cast/1777061136872-miu_suzuha150.jpg"]',
      },
    ],
    response: `{
  "Deleted": [
    { "Key": "Images/Cast/1777061136872-miu_suzuha150.jpg" }
  ],
  "Errors": []
}`,
    curl: `curl -X DELETE "{{BASE}}/api/objects" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"keys":["Images/Cast/1777061136872-miu_suzuha150.jpg"]}'`,
    js: `await fetch('{{BASE}}/api/objects', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ keys: ['Images/Cast/1777061136872-miu_suzuha150.jpg'] }),
});`,
  },
  {
    id: 'objects-exists',
    group: 'Objects',
    method: 'POST',
    path: '/api/objects/exists',
    title: 'Kiểm tra object tồn tại',
    summary:
      'Kiểm tra hàng loạt key có tồn tại trong bucket hay không (dùng HeadObject). Trả về map key → boolean.',
    auth: 'bearer',
    body: [
      {
        name: 'keys',
        type: 'string[]',
        required: true,
        description: 'Danh sách key cần kiểm tra.',
        example: '["Images/Cast/a.jpg","Images/Cast/b.jpg"]',
      },
    ],
    response: `{
  "exists": {
    "Images/Cast/a.jpg": true,
    "Images/Cast/b.jpg": false
  }
}`,
    errors: [
      { status: 400, message: 'keys không phải array → { "error": "keys must be an array" }' },
      { status: 500, message: 'Lỗi R2/S3' },
    ],
    curl: `curl -X POST "{{BASE}}/api/objects/exists" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"keys":["Images/Cast/a.jpg","Images/Cast/b.jpg"]}'`,
    js: `const res = await fetch('{{BASE}}/api/objects/exists', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ keys: ['Images/Cast/a.jpg'] }),
});
const { exists } = await res.json();`,
  },
  {
    id: 'objects-rename',
    group: 'Objects',
    method: 'POST',
    path: '/api/objects/rename',
    title: 'Đổi tên / di chuyển object',
    summary:
      'Copy object sang key mới rồi xóa key cũ (giống move). Không thay đổi nội dung file.',
    auth: 'bearer',
    body: [
      {
        name: 'sourceKey',
        type: 'string',
        required: true,
        description: 'Key nguồn.',
        example: 'Images/Cast/a.jpg',
      },
      {
        name: 'targetKey',
        type: 'string',
        required: true,
        description: 'Key đích.',
        example: 'Images/Cast/renamed-a.jpg',
      },
    ],
    response: `{
  "ok": true
}`,
    curl: `curl -X POST "{{BASE}}/api/objects/rename" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"sourceKey":"Images/Cast/a.jpg","targetKey":"Images/Cast/renamed-a.jpg"}'`,
    js: `await fetch('{{BASE}}/api/objects/rename', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({
    sourceKey: 'Images/Cast/a.jpg',
    targetKey: 'Images/Cast/renamed-a.jpg',
  }),
});`,
  },
  {
    id: 'objects-signed-get',
    group: 'Objects',
    method: 'POST',
    path: '/api/objects/signed-get',
    title: 'Tạo signed URL tải file',
    summary:
      'Trả về URL có chữ ký (presigned GET) để tải 1 object. URL hết hạn sau URL_TTL_SECONDS (mặc định 900s = 15 phút).',
    auth: 'bearer',
    body: [
      {
        name: 'key',
        type: 'string',
        required: true,
        description: 'Key của object cần tải.',
        example: 'Images/Cast/a.jpg',
      },
    ],
    response: `{
  "url": "https://storages.d4a15171fc12622c9292f8aa0d897594.r2.cloudflarestorage.com/Images%2FCast%2Fa.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&..."
}`,
    curl: `curl -X POST "{{BASE}}/api/objects/signed-get" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"key":"Images/Cast/a.jpg"}'`,
    js: `const res = await fetch('{{BASE}}/api/objects/signed-get', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ key: 'Images/Cast/a.jpg' }),
});
const { url } = await res.json();`,
  },
  {
    id: 'objects-search',
    group: 'Objects',
    method: 'GET',
    path: '/api/objects/search',
    title: 'Tìm kiếm toàn bucket',
    summary:
      'Tìm object có key chứa chuỗi tìm kiếm (không phân biệt hoa thường). Quét tuần tự toàn bucket tới khi đủ limit.',
    auth: 'bearer',
    note:
      'Không dùng được trên bucket rất lớn — tốc độ phụ thuộc tổng số object. Giữ limit nhỏ (mặc định 1000).',
    query: [
      {
        name: 'q',
        type: 'string',
        description: 'Chuỗi tìm kiếm (substring của key). Rỗng → trả về mảng rỗng.',
        example: 'suzuha',
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Số kết quả tối đa (1 → 10000). Mặc định 1000.',
        example: '1000',
      },
    ],
    response: `{
  "Contents": [
    {
      "Key": "Images/Cast/1777061136872-miu_suzuha150.jpg",
      "Size": 79279,
      "LastModified": "2026-04-24T20:05:39.942Z"
    }
  ]
}`,
    curl: `curl "{{BASE}}/api/objects/search?q=suzuha&limit=100" \\
  -H "Authorization: Bearer {{PASS}}"`,
    js: `const res = await fetch('{{BASE}}/api/objects/search?q=suzuha&limit=100', {
  headers: { Authorization: \`Bearer {{PASS}}\` },
});
const { Contents } = await res.json();`,
  },
  {
    id: 'objects-count',
    group: 'Objects',
    method: 'GET',
    path: '/api/objects/count',
    title: 'Đếm số object trong prefix',
    summary:
      'Đếm tổng số file (không tính thư mục con) bên trong một prefix. Dùng để tính chính xác tổng số trang cho phân trang giao diện.',
    auth: 'bearer',
    note:
      'Quét tuần tự toàn bộ nội dung của prefix nên có thể chậm với bucket lớn. Kết quả được cache phía client theo prefix.',
    query: [
      {
        name: 'prefix',
        type: 'string',
        description: 'Tiền tố key cần đếm. Bỏ trống → đếm toàn bộ bucket.',
        example: 'Images/Sex/',
      },
    ],
    response: `{
  "count": 4910,
  "truncated": false
}`,
    curl: `curl "{{BASE}}/api/objects/count?prefix=Images/Sex/" \\
  -H "Authorization: Bearer {{PASS}}"`,
    js: `const res = await fetch('{{BASE}}/api/objects/count?prefix=Images/Sex/', {
  headers: { Authorization: \`Bearer {{PASS}}\` },
});
const { count } = await res.json();`,
  },

  // ─────────────────────────── Folders ───────────────────────────
  {
    id: 'folders-create',
    group: 'Folders',
    method: 'POST',
    path: '/api/folders',
    title: 'Tạo folder',
    summary:
      'Tạo "folder" bằng cách tạo object 0 byte với key kết thúc bằng "/" và Content-Type application/x-directory.',
    auth: 'bearer',
    body: [
      {
        name: 'parentPrefix',
        type: 'string',
        description:
          'Thư mục cha. Bỏ trống hoặc "" = tạo ở root. Slash thừa được tự chuẩn hoá.',
        example: 'Images/Cast',
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'Tên folder. Không chứa "..".',
        example: 'NewFolder',
      },
    ],
    response: `{
  "ok": true,
  "prefix": "Images/Cast/NewFolder/"
}`,
    errors: [
      { status: 400, message: 'Thiếu tên folder / tên chứa ".."' },
      { status: 500, message: 'Lỗi R2/S3' },
    ],
    curl: `curl -X POST "{{BASE}}/api/folders" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"parentPrefix":"Images/Cast","name":"NewFolder"}'`,
    js: `const res = await fetch('{{BASE}}/api/folders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ parentPrefix: 'Images/Cast', name: 'NewFolder' }),
});
console.log(await res.json()); // { ok: true, prefix: "Images/Cast/NewFolder/" }`,
  },
  {
    id: 'folders-delete',
    group: 'Folders',
    method: 'DELETE',
    path: '/api/folders',
    title: 'Xóa folder (kèm toàn bộ nội dung)',
    summary:
      'Xóa đệ quy mọi object có tiền tố prefix (tự thêm dấu "/" nếu thiếu). Xóa theo batch 1000 key/request.',
    auth: 'bearer',
    note: 'Không thể hoàn tác — toàn bộ file bên trong folder sẽ mất.',
    body: [
      {
        name: 'prefix',
        type: 'string',
        required: true,
        description: 'Prefix của folder cần xóa.',
        example: 'Images/Cast/Old',
      },
    ],
    response: `{
  "ok": true,
  "deleted": 128
}`,
    errors: [
      { status: 400, message: 'Thiếu prefix' },
      { status: 500, message: 'Lỗi R2/S3' },
    ],
    curl: `curl -X DELETE "{{BASE}}/api/folders" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"prefix":"Images/Cast/Old"}'`,
    js: `const res = await fetch('{{BASE}}/api/folders', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ prefix: 'Images/Cast/Old' }),
});
console.log(await res.json()); // { ok: true, deleted: 128 }`,
  },
  {
    id: 'folders-stats',
    group: 'Folders',
    method: 'GET',
    path: '/api/folders/stats',
    title: 'Thống kê folder',
    summary:
      'Đếm số object và tổng dung lượng (bytes) bên trong một prefix. Duyệt đệ quy toàn bộ nội dung.',
    auth: 'bearer',
    query: [
      {
        name: 'prefix',
        type: 'string',
        description: 'Prefix cần thống kê. Bỏ trống = toàn bucket.',
        example: 'Images/Cast/',
      },
    ],
    response: `{
  "count": 1046,
  "totalSize": 212737147
}`,
    errors: [{ status: 500, message: 'Lỗi R2/S3' }],
    curl: `curl "{{BASE}}/api/folders/stats?prefix=Images/Cast/" \\
  -H "Authorization: Bearer {{PASS}}"`,
    js: `const res = await fetch('{{BASE}}/api/folders/stats?prefix=Images/Cast/', {
  headers: { Authorization: \`Bearer {{PASS}}\` },
});
const { count, totalSize } = await res.json();`,
  },

  // ─────────────────────────── Upload ───────────────────────────
  {
    id: 'uploads-presign',
    group: 'Upload',
    method: 'POST',
    path: '/api/uploads/presign',
    title: 'Presigned PUT (upload thẳng lên R2)',
    summary:
      'Nhận danh sách file và trả về URL PUT có chữ ký để client tự upload thẳng lên R2, không đi qua server.',
    auth: 'bearer',
    note:
      'BẮT BUỘC passkey. Gửi theo 1 trong 3 cách: header "Authorization: Bearer <APP_PASSWORD>", header "x-api-key: <APP_PASSWORD>", hoặc cookie "site_auth=<APP_PASSWORD>". Thiếu/sai → 401.\n\nKhi PUT, header Content-Type PHẢI khớp chính xác với contentType đã khai báo, và Content-Length phải khớp size — nếu không R2 sẽ trả lỗi SignatureDoesNotMatch.',
    body: [
      {
        name: 'files',
        type: 'array<{key,contentType,size}>',
        required: true,
        description: 'Danh sách file cần upload.',
      },
      {
        name: 'files[].key',
        type: 'string',
        required: true,
        description: 'Key đích trên R2.',
        example: 'Images/Uploads/photo.jpg',
      },
      {
        name: 'files[].contentType',
        type: 'string',
        required: true,
        description: 'MIME type sẽ ghi kèm object.',
        example: 'image/jpeg',
      },
      {
        name: 'files[].size',
        type: 'number',
        required: true,
        description: 'Kích thước file (bytes).',
        example: '79279',
      },
    ],
    response: `{
  "urls": [
    "https://storages.d4a15171fc12622c9292f8aa0d897594.r2.cloudflarestorage.com/Images%2FUploads%2Fphoto.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&..."
  ]
}`,
    curl: `# 1) Lấy presigned URL
curl -X POST "{{BASE}}/api/uploads/presign" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"files":[{"key":"Images/Uploads/photo.jpg","contentType":"image/jpeg","size":79279}]}'

# 2) Upload thẳng lên R2 (Content-Type phải khớp)
curl -X PUT "<presigned-url>" \\
  -H "Content-Type: image/jpeg" \\
  --data-binary @photo.jpg`,
    js: `// 1) Lấy presigned URL
const presign = await fetch('{{BASE}}/api/uploads/presign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({
    files: [{ key: 'Images/Uploads/photo.jpg', contentType: 'image/jpeg', size: 79279 }],
  }),
}).then((r) => r.json());

// 2) PUT thẳng lên R2 — contentType phải khớp chính xác
await fetch(presign.urls[0], {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: fileBlob,
});`,
  },
  {
    id: 'uploads-direct',
    group: 'Upload',
    method: 'POST',
    path: '/api/uploads/direct',
    title: 'Upload trực tiếp qua server',
    summary:
      'Upload file hoặc import file từ URL, server tải về rồi đẩy lên R2. Giữ nguyên đuôi file (kiểm tra magic bytes để chống file sai đuôi).',
    auth: 'bearer',
    note:
      'BẮT BUỘC passkey. Gửi theo 1 trong 3 cách: header "Authorization: Bearer <APP_PASSWORD>", header "x-api-key: <APP_PASSWORD>", hoặc cookie "site_auth=<APP_PASSWORD>". Thiếu/sai → 401.',
    body: [
      {
        name: 'file / files',
        type: 'File | File[]',
        description:
          '(multipart/form-data) File cần upload. Field lặp lại "file" hoặc "files".',
      },
      {
        name: 'url / urls',
        type: 'string | string[]',
        description:
          '(multipart hoặc JSON) URL nguồn để server tải về và upload. Hỗ trợ cả hai chế độ.',
      },
      {
        name: 'key / keys',
        type: 'string | string[]',
        description:
          'Key đích tùy chọn (ghép theo thứ tự file/url). Nếu bỏ trống sẽ suy ra từ tên file.',
      },
      {
        name: 'folder',
        type: 'string',
        description: 'Thư mục đích (alias của prefix). Bỏ trống = root.',
        example: 'Images/Uploads',
      },
      {
        name: 'prefix',
        type: 'string',
        description: 'Alias của folder.',
      },
    ],
    response: `{
  "uploaded": [
    "Images/Uploads/photo.jpg"
  ],
  "urls": [
    "https://cf-vng.com/Images/Uploads/photo.jpg"
  ],
  "count": 1
}`,
    errors: [
      { status: 401, message: 'Thiếu hoặc sai passkey → { "error": "Unauthorized" }' },
      { status: 400, message: 'Không có file/url → { "error": "No files or urls provided" }' },
      { status: 500, message: 'Không tải được URL nguồn hoặc lỗi R2' },
    ],
    curl: `# Upload 1 file
curl -X POST "{{BASE}}/api/uploads/direct" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -F "file=@photo.jpg" \\
  -F "folder=Images/Uploads"

# Import từ URL
curl -X POST "{{BASE}}/api/uploads/direct" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"url":"https://example.com/a.gif","folder":"Images/Uploads"}'`,
    js: `// (a) multipart — file
const form = new FormData();
form.append('file', fileBlob, 'photo.jpg');
form.append('folder', 'Images/Uploads');

const res = await fetch('{{BASE}}/api/uploads/direct', {
  method: 'POST',
  headers: { Authorization: \`Bearer {{PASS}}\` },
  body: form,
});
const { uploaded, urls } = await res.json();

// (b) JSON — import từ URL
await fetch('{{BASE}}/api/uploads/direct', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({
    url: 'https://example.com/a.gif',
    folder: 'Images/Uploads',
  }),
});`,
  },

  // ─────────────────── Download & Proxy ───────────────────
  {
    id: 'download-links',
    group: 'Download & Proxy',
    method: 'POST',
    path: '/api/download',
    title: 'Lấy link tải (nhiều file)',
    summary:
      'Trả về danh sách link tải cho nhiều key. Nếu có CLOUDFLARE_BUCKET_URL sẽ trả link public, ngược lại trả presigned URL.',
    auth: 'bearer',
    body: [
      {
        name: 'keys',
        type: 'string[]',
        required: true,
        description: 'Danh sách key cần link.',
        example: '["Images/Cast/a.jpg"]',
      },
    ],
    response: `{
  "mode": "public",
  "links": [
    "https://cf-vng.com/Images/Cast/a.jpg"
  ]
}`,
    note:
      'mode = "signed" nếu không cấu hình CLOUDFLARE_BUCKET_URL — khi đó link có chữ ký và hết hạn sau URL_TTL_SECONDS.',
    curl: `curl -X POST "{{BASE}}/api/download" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"keys":["Images/Cast/a.jpg"]}'`,
    js: `const res = await fetch('{{BASE}}/api/download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ keys: ['Images/Cast/a.jpg'] }),
});
const { mode, links } = await res.json();`,
  },
  {
    id: 'download-file',
    group: 'Download & Proxy',
    method: 'GET',
    path: '/api/download/file',
    title: 'Tải file (streaming qua server)',
    summary:
      'Stream object từ R2 về client với header Content-Disposition attachment. Dùng khi cần tải file có tên đẹp hoặc file private.',
    auth: 'bearer',
    query: [
      {
        name: 'key',
        type: 'string',
        required: true,
        description: 'Key của object cần tải.',
        example: 'Images/Cast/a.jpg',
      },
    ],
    response: `HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Disposition: attachment; filename*=UTF-8''a.jpg
Content-Length: 79279

<binary data>`,
    errors: [
      { status: 400, message: 'Thiếu key' },
      { status: 500, message: 'Lỗi tải từ R2' },
    ],
    curl: `curl -OJ "{{BASE}}/api/download/file?key=Images%2FCast%2Fa.jpg" \\
  -H "Authorization: Bearer {{PASS}}"`,
    js: `const res = await fetch('{{BASE}}/api/download/file?key=' + encodeURIComponent(key));
const blob = await res.blob();
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'a.jpg';
a.click();`,
  },
  {
    id: 'fetch-file',
    group: 'Download & Proxy',
    method: 'POST',
    path: '/api/fetch-file',
    title: 'Proxy tải file từ URL ngoài',
    summary:
      'Server tải một URL bất kỳ rồi trả lại nội dung. Bỏ qua CORS của nguồn. Có kiểm tra magic bytes cho GIF/PNG/JPEG.',
    auth: 'bearer',
    body: [
      {
        name: 'url',
        type: 'string',
        required: true,
        description: 'URL nguồn cần tải.',
        example: 'https://example.com/a.gif',
      },
    ],
    response: `HTTP/1.1 200 OK
Content-Type: image/gif
Content-Length: 4308
Cache-Control: no-cache
X-Original-Filename: a.gif

<binary data>`,
    errors: [
      { status: 400, message: 'Thiếu url' },
      { status: 400, message: 'URL nguồn trả về lỗi HTTP' },
      { status: 500, message: 'Lỗi nội bộ' },
    ],
    curl: `curl -X POST "{{BASE}}/api/fetch-file" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{PASS}}" \\
  -d '{"url":"https://example.com/a.gif"}' \\
  -o a.gif`,
    js: `const res = await fetch('{{BASE}}/api/fetch-file', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer {{PASS}}\`,
  },
  body: JSON.stringify({ url: 'https://example.com/a.gif' }),
});
const blob = await res.blob();`,
  },

  // ─────────────────────────── Storage ───────────────────────────
  {
    id: 'r2-usage',
    group: 'Storage',
    method: 'GET',
    path: '/api/r2/usage',
    title: 'Dung lượng & quota bucket',
    summary:
      'Gọi Cloudflare R2 Usage API để lấy payload size, metadata size, số object và số lần upload. Yêu cầu CLOUDFLARE_API_TOKEN.',
    auth: 'bearer',
    note:
      'Đây là endpoint DUY NHẤT bắt buộc đúng header Authorization: Bearer <APP_PASSWORD>. Thiếu/sai → 401.',
    response: `{
  "payloadSize": 10453206329,
  "metadataSize": 1048576,
  "totalSize": 10454254905,
  "objectCount": 188227,
  "uploadCount": 203511,
  "end": "2026-10-21T00:00:00.000Z"
}`,
    errors: [
      { status: 401, message: 'Thiếu/sai Authorization header' },
      { status: 500, message: 'Thiếu CLOUDFLARE_API_TOKEN hoặc lỗi Cloudflare API' },
    ],
    curl: `curl "{{BASE}}/api/r2/usage" \\
  -H "Authorization: Bearer {{PASS}}"`,
    js: `const res = await fetch('{{BASE}}/api/r2/usage', {
  headers: { Authorization: \`Bearer {{PASS}}\` },
});
console.log(await res.json());`,
  },
];

export const API_COUNT = API_DOCS.length;
