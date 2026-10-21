const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Penstriman Video Tempatan (HTTP 206 Range)
app.get('/uploads/:filename', (req, res, next) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Fail tidak dijumpai.');

  const ext = path.extname(filePath).toLowerCase();
  const isVideo = ['.mp4', '.webm', '.mkv', '.mov'].includes(ext);

  if (!isVideo) return next();

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime'
  };
  const contentType = mimeTypes[ext] || 'video/mp4';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.mimetype.startsWith('video/') ? 'video4k' : 'poster';
    cb(null, `${prefix}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Format tidak disokong. Sila muat naik fail imej atau video sahaja.'));
    }
  }
});

const defaultSettings = {
  mosqueName: "Musolla Ibnu Sina",
  zone: "PHG02",
  layout: "vertical",
  tickerColor: "#334155",
  schoolSchedule: {
    enabled: true,
    zohorSolatTime: "13:30",
    asarSolatTime: "16:45"
  },
  iqamah: { subuh: 15, zohor: 10, asar: 10, maghrib: 10, isyak: 10 },
  silentDuration: 12,
  slideDuration: 10,
  tickers: [
    "Selamat datang ke Musolla Ibnu Sina SRITIF.",
    "Luruskan dan rapatkan saf. Pastikan telefon bimbit dimatikan atau berada dalam mod senyap."
  ],
  slides: [],
  updatedAt: new Date().toISOString()
};

function getSettings() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultSettings, null, 2), 'utf8');
    return defaultSettings;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return defaultSettings;
  }
}

function saveSettings(data) {
  const updated = { ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// Pengalihan automatik dari pautan utama ke paparan display
app.get('/', (req, res) => res.redirect('/display'));
app.get('/display', (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get('/api/settings', (req, res) => res.json(getSettings()));

app.post('/api/settings', (req, res) => {
  try {
    const current = getSettings();
    const newSettings = {
      mosqueName: req.body.mosqueName ?? current.mosqueName,
      zone: req.body.zone ?? current.zone,
      layout: req.body.layout ?? current.layout,
      tickerColor: req.body.tickerColor ?? current.tickerColor ?? "#334155",
      schoolSchedule: req.body.schoolSchedule ?? current.schoolSchedule ?? defaultSettings.schoolSchedule,
      iqamah: req.body.iqamah ?? current.iqamah,
      silentDuration: Number(req.body.silentDuration ?? current.silentDuration),
      slideDuration: Number(req.body.slideDuration ?? current.slideDuration),
      tickers: Array.isArray(req.body.tickers) ? req.body.tickers : current.tickers,
      slides: Array.isArray(req.body.slides) ? req.body.slides : current.slides
    };
    const saved = saveSettings(newSettings);
    res.json({ status: "berjaya", message: "Tetapan berjaya dikemaskini.", data: saved });
  } catch (err) {
    res.status(500).json({ status: "ralat", message: "Gagal menyimpan tetapan." });
  }
});

app.post('/api/upload', (req, res) => {
  upload.single('media')(req, res, (err) => {
    if (err) return res.status(400).json({ status: "ralat", message: err.message });
    if (!req.file) return res.status(400).json({ status: "ralat", message: "Tiada fail dimuat naik." });
    
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.json({
      status: "berjaya",
      url: `/uploads/${req.file.filename}`,
      type: mediaType,
      sizeMB: (req.file.size / (1024 * 1024)).toFixed(2)
    });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🕌 Pelayan TV MusollaSritif aktif pada port ${PORT}!`);
});