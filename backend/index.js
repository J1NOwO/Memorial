// index.js - Express 서버 진입점
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    // 개발 환경: localhost 모든 포트 허용
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // 프로덕션: 환경변수 FRONTEND_URL 사용
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    callback(new Error('CORS 차단: ' + origin));
  },
  credentials: true,
}));
app.use(express.json());

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Memorial 서버 정상 작동 중' });
});

// 라우트 연결
app.use('/api/connections', require('./routes/connections'));
app.use('/api/questions',   require('./routes/questions'));
app.use('/api/chat',        require('./routes/chat'));
app.use('/api/doll',        require('./routes/doll'));
app.use('/api/dev',         require('./routes/dev'));
app.use('/api/memorial-book',  require('./routes/memorialBook'));
app.use('/api/memory-album',  require('./routes/memoryAlbum'));

// 서버 시작
app.listen(PORT, () => {
  console.log(`Memorial 서버 실행 중: http://localhost:${PORT}`);
});
