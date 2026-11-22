import { buildApp } from '../app.js';

// Chỉ dùng cho VT14. Dữ liệu demo có phản hồi nguồn cố định và không dùng thông tin xác thực.
const app = buildApp();
await app.listen({ host: '127.0.0.1', port: 3900 });
console.log('VT14 load target: http://127.0.0.1:3900');
