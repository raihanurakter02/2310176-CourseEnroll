import React, { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../AuthContext';
import { ToastContext } from '../ToastContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [isLoading, setIsLoading] = useState(false);

  const auth = useContext(AuthContext);
  const toast = useContext(ToastContext);
  const navigate = useNavigate();

  if (auth?.user) {
    return <Navigate to={`/${auth.user.role}/dashboard`} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const actualRole = String(response.data.role).toLowerCase();

      // Strictly enforce that the selected role tab matches the user's account role
      if (actualRole !== selectedRole) {
        toast?.showToast(
          `Role mismatch! This account is registered as "${actualRole.toUpperCase()}", not "${selectedRole.toUpperCase()}". Please select the ${actualRole} tab.`,
          'error'
        );
        setIsLoading(false);
        return;
      }

      auth?.login(response.data.access_token);
      toast?.showToast(`Successfully logged in as ${actualRole}`, 'success');
      navigate(`/${actualRole}/dashboard`);
    } catch (err: any) {
      toast?.showToast(err.response?.data?.detail || 'Invalid email or password', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Nunito:wght@500;700;800&display=swap"
      />
      <style>{`
        .chalkboard-login input.f:focus {
          outline: none;
          border-bottom-color: #2f6f5e !important;
          background: #fff6c4 !important;
        }
        .chalkboard-login .hl {
          flex: 1;
          min-height: 44px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #3b4658;
          font: 700 15px 'Nunito', sans-serif;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .chalkboard-login .hl.on {
          background: #ffe98a;
          color: #1b2a3a;
        }
        .chalkboard-login .go:hover:not(:disabled) {
          background: #1d4a3e !important;
        }
        .chalkboard-login .go:disabled {
          opacity: 0.7;
          cursor: not-allowed !important;
        }
      `}</style>

      <div
        className="chalkboard-login"
        style={{
          position: 'relative',
          minHeight: '100vh',
          boxSizing: 'border-box',
          border: '18px solid #8a5a2f',
          background: '#1f2d2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          fontFamily: "'Nunito', system-ui, sans-serif",
          color: '#1b2a3a',
          overflow: 'hidden'
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.45"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="300" cy="420" rx="260" ry="120" fill="#ffffff" fillOpacity="0.03" stroke="none" />
          <text x="90" y="210" transform="rotate(-6 90 210)" fill="#ffffff" fillOpacity="0.5" stroke="none" fontFamily="Caveat, cursive" fontSize="64" fontWeight="700">
            E = mc²
          </text>
          <text x="980" y="170" transform="rotate(4 980 170)" fill="#ffffff" fillOpacity="0.5" stroke="none" fontFamily="Caveat, cursive" fontSize="54" fontWeight="700">
            a² + b² = c²
          </text>
          <text x="860" y="800" transform="rotate(-3 860 800)" fill="#ffffff" fillOpacity="0.45" stroke="none" fontFamily="Caveat, cursive" fontSize="42" fontWeight="700">
            x = (−b ± √(b² − 4ac)) / 2a
          </text>
          <text x="90" y="770" transform="rotate(5 90 770)" fill="#ffffff" fillOpacity="0.5" stroke="none" fontFamily="Caveat, cursive" fontSize="52" fontWeight="700">
            π ≈ 3.14159
          </text>
          <g transform="translate(1160 330)">
            <ellipse cx="0" cy="0" rx="70" ry="26" />
            <ellipse cx="0" cy="0" rx="70" ry="26" transform="rotate(60)" />
            <ellipse cx="0" cy="0" rx="70" ry="26" transform="rotate(120)" />
            <circle cx="0" cy="0" r="6" fill="#ffffff" fillOpacity="0.6" />
          </g>
          <path d="M120 330 q20 -30 40 0 t40 0 t40 0 t40 0" />
          <path d="M1010 640 l14 30 l32 4 l-24 22 l7 32 l-29 -16 l-29 16 l7 -32 l-24 -22 l32 -4z" />
          <path d="M200 560 L260 520 L320 560 L260 600Z" />
          <path d="M224 576 v28 q36 24 72 0 v-28" />
        </svg>

        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '460px',
            background: '#fffdf6',
            borderRadius: '8px',
            boxShadow: '0 30px 50px -16px rgba(0,0,0,0.6)',
            padding: '46px 40px 36px 80px',
            boxSizing: 'border-box'
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '56px',
              top: 0,
              bottom: 0,
              width: '2px',
              background: '#e57373'
            }}
          />

          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '20px',
              top: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '46px'
            }}
          >
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#1f2d2a' }} />
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#1f2d2a' }} />
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#1f2d2a' }} />
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#1f2d2a' }} />
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#1f2d2a' }} />
          </div>

          <span
            style={{
              display: 'block',
              marginBottom: '4px',
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#3b4658'
            }}
          >
            CourseEnroll
          </span>

          <h1
            style={{
              margin: '0 0 4px',
              fontFamily: "'Caveat', cursive",
              fontSize: '58px',
              lineHeight: 1,
              fontWeight: 700,
              color: '#1b2a3a'
            }}
          >
            Welcome back!
          </h1>

          <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#3b4658' }}>
            Class is about to start. Sign in below.
          </p>

          <div
            role="group"
            aria-label="Sign in as"
            style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}
          >
            <button
              className={`hl ${selectedRole === 'student' ? 'on' : ''}`}
              type="button"
              aria-pressed={selectedRole === 'student'}
              onClick={() => setSelectedRole('student')}
            >
              Student
            </button>
            <button
              className={`hl ${selectedRole === 'faculty' ? 'on' : ''}`}
              type="button"
              aria-pressed={selectedRole === 'faculty'}
              onClick={() => setSelectedRole('faculty')}
            >
              Faculty
            </button>
            <button
              className={`hl ${selectedRole === 'admin' ? 'on' : ''}`}
              type="button"
              aria-pressed={selectedRole === 'admin'}
              onClick={() => setSelectedRole('admin')}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <label htmlFor="e" style={{ display: 'block', fontSize: '14px', fontWeight: 800 }}>
              Email address
            </label>
            <input
              className="f"
              id="e"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@university.edu"
              style={{
                width: '100%',
                height: '48px',
                boxSizing: 'border-box',
                padding: '0 4px',
                marginBottom: '14px',
                border: 0,
                borderBottom: '2px solid #7d8cc0',
                borderRadius: 0,
                background: 'transparent',
                font: "600 16px 'Nunito', sans-serif",
                color: '#1b2a3a'
              }}
            />

            <label htmlFor="p" style={{ display: 'block', fontSize: '14px', fontWeight: 800 }}>
              Password
            </label>
            <input
              className="f"
              id="p"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: '100%',
                height: '48px',
                boxSizing: 'border-box',
                padding: '0 4px',
                marginBottom: '22px',
                border: 0,
                borderBottom: '2px solid #7d8cc0',
                borderRadius: 0,
                background: 'transparent',
                font: "600 16px 'Nunito', sans-serif",
                color: '#1b2a3a'
              }}
            />

            <button
              className="go"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '54px',
                border: 0,
                borderRadius: '10px',
                background: '#2f6f5e',
                color: '#ffffff',
                font: "800 17px 'Nunito', sans-serif",
                cursor: 'pointer'
              }}
            >
              {isLoading ? 'Signing in...' : `Sign in as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`}
            </button>
          </form>

          <p
            style={{
              margin: '18px 0 0',
              textAlign: 'center',
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#3b4658'
            }}
          >
            Need access? Contact your university administrator.
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;