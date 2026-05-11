import React, { useState } from 'react';
import { login, signup } from '../services/authService';
import styles from './LoginPage.module.css';
import LoginBackground from './LoginBackground';

const AVATARS = [
  { val: 'bunny', emoji: '🐰', label: 'Bunny' },
  { val: 'cat',   emoji: '🐱', label: 'Cat'   },
  { val: 'dog',   emoji: '🐶', label: 'Dog'   },
];
const MOODS = ['happy', 'chill', 'silly', 'tired'];
const PROPS = ['none', 'flower', 'glasses', 'cap', 'crown', 'bow'];

export default function LoginPage({ onAuth }) {
  const [tab,     setTab]     = useState('login');
  const [form,    setForm]    = useState({
    username: '', email: '', password: '',
    avatar: 'bunny', color: '#ffd1e8', prop: 'none', mood: 'happy',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } =
        tab === 'login'
          ? await login({ email: form.email, password: form.password })
          : await signup(form);
      localStorage.setItem('cc_token', data.token);
      localStorage.setItem('cc_user',  JSON.stringify(data.user));
      onAuth(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong 🥺');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <LoginBackground />
      <div className={styles.card}>

        {/* Cute character strip */}
        <div className={styles.charStrip}>
          {AVATARS.map((a) => (
            <div
              key={a.val}
              className={styles.char}
              style={{
                background:
                  a.val === 'bunny' ? '#ffd1e8' :
                  a.val === 'cat'   ? '#e8ddff' : '#d7fff1',
              }}
            >
              {a.emoji}
            </div>
          ))}
        </div>

        {/* Logo */}
        <div className={styles.logo}>
          <h1>Chatlings ✨</h1>
          <p>hand-drawn dreams & games</p>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button type="button"
            className={tab === 'login' ? styles.tabActive : styles.tab}
            onClick={() => { setTab('login'); setError(''); }}>
            Login
          </button>
          <button type="button"
            className={tab === 'signup' ? styles.tabActive : styles.tab}
            onClick={() => { setTab('signup'); setError(''); }}>
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Username — signup only */}
          {tab === 'signup' && (
            <div className={styles.field}>
              <label>Username</label>
              <input value={form.username} onChange={set('username')} required placeholder="CuteBunny" />
            </div>
          )}

          <div className={styles.field}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
          </div>

          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" />
          </div>

          {/* Avatar + customisation — signup only */}
          {tab === 'signup' && (
            <>
              <div className={styles.field}>
                <label>Choose your character</label>
                <div className={styles.avatarPicker}>
                  {AVATARS.map((a) => (
                    <button
                      key={a.val}
                      type="button"
                      className={`${styles.avatarChip} ${form.avatar === a.val ? styles.selected : ''}`}
                      onClick={() => setVal('avatar', a.val)}
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Mood</label>
                  <select value={form.mood} onChange={set('mood')}>
                    {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Color</label>
                  <input type="color" value={form.color} onChange={set('color')} className={styles.colorInput} />
                </div>
                <div className={styles.field}>
                  <label>Prop</label>
                  <select value={form.prop} onChange={set('prop')}>
                    {PROPS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Please wait...' : tab === 'login' ? '✨ Enter CuteChat' : '🐾 Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
