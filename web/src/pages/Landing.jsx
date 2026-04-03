// Landing.jsx - 서비스 소개 페이지 (첫 화면)
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';

function Landing() {
  const { user } = useAuth();
  const t = useT();

  const features = [
    { icon: '✍️', title: t.landing_feature_q_title,       desc: t.landing_feature_q_desc },
    { icon: '🤖', title: t.landing_feature_ai_title,      desc: t.landing_feature_ai_desc },
    { icon: '💌', title: t.landing_feature_forever_title, desc: t.landing_feature_forever_desc },
  ];

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={styles.header}>
        <span style={styles.logo}>{t.app_name}</span>
        <div style={styles.headerRight}>
          {user ? (
            <Link to="/dashboard" style={styles.btnPrimary}>{t.landing_to_dashboard}</Link>
          ) : (
            <Link to="/login" style={styles.btnPrimary}>{t.landing_start}</Link>
          )}
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section style={styles.hero}>
        <p style={styles.eyebrow}>{t.landing_hero_title}</p>
        <h1 style={styles.heroTitle}>
          {t.landing_hero_sub1}<br />{t.landing_hero_sub2}
        </h1>
        <p style={styles.heroDesc}>{t.landing_hero_desc}</p>
        <Link to="/login" style={styles.btnHero}>
          {t.landing_start_btn}
        </Link>
      </section>

      {/* 기능 소개 */}
      <section style={styles.features}>
        {features.map((item) => (
          <div key={item.title} style={styles.featureCard}>
            <span style={styles.featureIcon}>{item.icon}</span>
            <h3 style={styles.featureTitle}>{item.title}</h3>
            <p style={styles.featureDesc}>{item.desc}</p>
          </div>
        ))}
      </section>

      {/* 푸터 */}
      <footer style={styles.footer}>
        <p>{t.landing_footer}</p>
      </footer>
    </div>
  );
}

// 인라인 스타일 (색상 팔레트: 따뜻한 베이지/브라운)
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f7f3ee',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    color: '#5c4a3a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 40px',
    borderBottom: '1px solid #e8e0d8',
  },
  logo: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '22px',
    fontWeight: '700',
    color: '#5c4a3a',
    letterSpacing: '2px',
  },
  headerRight: {},
  btnPrimary: {
    padding: '10px 24px',
    backgroundColor: '#5c4a3a',
    color: '#fffdf9',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
  },
  hero: {
    textAlign: 'center',
    padding: '100px 20px 80px',
    maxWidth: '700px',
    margin: '0 auto',
  },
  eyebrow: {
    fontSize: '13px',
    letterSpacing: '3px',
    color: '#c4956a',
    marginBottom: '16px',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '42px',
    fontWeight: '700',
    lineHeight: '1.4',
    marginBottom: '24px',
    color: '#3d2e22',
  },
  heroDesc: {
    fontSize: '17px',
    lineHeight: '1.8',
    color: '#7a6355',
    marginBottom: '40px',
  },
  btnHero: {
    display: 'inline-block',
    padding: '16px 40px',
    backgroundColor: '#c4956a',
    color: '#fffdf9',
    borderRadius: '50px',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '600',
    letterSpacing: '1px',
  },
  features: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    padding: '60px 40px',
    flexWrap: 'wrap',
  },
  featureCard: {
    backgroundColor: '#fffdf9',
    borderRadius: '16px',
    padding: '36px 28px',
    textAlign: 'center',
    width: '240px',
    boxShadow: '0 2px 16px rgba(92,74,58,0.08)',
  },
  featureIcon: {
    fontSize: '36px',
    display: 'block',
    marginBottom: '16px',
  },
  featureTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '18px',
    marginBottom: '12px',
    color: '#3d2e22',
  },
  featureDesc: {
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#7a6355',
    whiteSpace: 'pre-line',
  },
  footer: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '13px',
    color: '#a89080',
    borderTop: '1px solid #e8e0d8',
  },
};

export default Landing;
