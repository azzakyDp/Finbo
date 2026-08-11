// api/index.js
// Vercel memanggil file di folder api/ sebagai serverless function.
// Express app itu sendiri sudah kompatibel dengan signature (req, res)
// yang Vercel harapkan, jadi cukup di-export langsung tanpa wrapper lain.
module.exports = require("../src/server");
