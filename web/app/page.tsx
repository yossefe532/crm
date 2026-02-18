export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>CRM Doctor</h1>
      <a 
        href="/login" 
        style={{
          padding: '10px 20px',
          backgroundColor: '#2563eb',
          color: 'white',
          borderRadius: '5px',
          textDecoration: 'none'
        }}
      >
        تسجيل الدخول
      </a>
    </div>
  )
}
