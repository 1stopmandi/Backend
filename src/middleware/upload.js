const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/i;
  const ext = path.extname(file.originalname) || '';
  const mimeOk = allowed.test(file.mimetype);
  const extOk = allowed.test(ext.slice(1));
  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, png) and PDF are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: 'outlet_image', maxCount: 1 },
  { name: 'gst_cert', maxCount: 1 },
  { name: 'fssai_cert', maxCount: 1 },
]);

const uploadOrderImage = upload.single('image');
const uploadProductRequestImage = upload.single('image');

module.exports = { upload, uploadFields, uploadOrderImage, uploadProductRequestImage };
