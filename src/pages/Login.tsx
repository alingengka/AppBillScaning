import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import Spinner from '@/components/Spinner'

export default function Login() {
  const { session, signInWithPassword, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const result = mode === 'signin' ? await signInWithPassword(email, password) : await signUp(email, password)

    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setInfo('สมัครสำเร็จ! กรุณายืนยันอีเมลของคุณแล้วเข้าสู่ระบบ (หากตั้งค่า Supabase ให้ยืนยันอีเมล)')
    }
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
            <ScanIcon className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">BillScan</h1>
          <p className="text-sm text-ink-muted">
            ถ่ายภาพหรือแคปหน้าจอสินค้า แล้วสร้างบิลส่งเดลิเวอรีได้ในไม่กี่วินาที
          </p>
        </div>

        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ยังไม่ได้ตั้งค่า Supabase — คัดลอก <code>.env.example</code> เป็น <code>.env.local</code> แล้วใส่
            ค่า URL/anon key ของโปรเจกต์ (ดูวิธีใน README)
          </p>
        )}

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-md py-2 transition ${
                mode === 'signin' ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-muted'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-md py-2 transition ${
                mode === 'signup' ? 'bg-surface text-brand-700 shadow-sm' : 'text-ink-muted'
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">อีเมล</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">รหัสผ่าน</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            {info && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting && <Spinner className="size-4 text-white" />}
              {mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M18 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M6 20H4a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}
