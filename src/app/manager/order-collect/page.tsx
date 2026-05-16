'use client';

export default function OrderCollectPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      color: '#666',
      fontFamily: 'Pretendard, sans-serif',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        SSG 주문수집
      </h1>
      <p style={{ fontSize: '14px', color: '#999' }}>
        Phase 6에서 제작 예정입니다.
      </p>
    </div>
  );
}
