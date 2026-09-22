import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Spinner from '@/components/Spinner'

export default function Settings() {
  const { user } = useAuth()
  const [shopName, setShopName] = useState('')
  const [shopPhone, setShopPhone] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      const { data } = await supabase.from('shop_settings').select('*').maybeSingle()
      if (cancelled) return
      if (data) {
        setShopName(data.shop_name ?? '')
        setShopPhone(data.shop_phone ?? '')
        setShopAddress(data.shop_address ?? '')
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error } = await supabase.from('shop_settings').upsert({
      user_id: user.id,
      shop_name: shopName || 'ร้านของฉัน',
      shop_phone: shopPhone || null,
      shop_address: shopAddress || null,
    })

    if (error) setError(error.message)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">ตั้งค่าร้าน</h1>
        <p className="text-sm text-ink-muted">ข้อมูลนี้จะแสดงบนหัวบิลทุกใบที่คุณสร้าง</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">ชื่อร้าน</span>
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="ร้านของฉัน"
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">เบอร์โทรร้าน</span>
          <input
            value={shopPhone}
            onChange={(e) => setShopPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">ที่อยู่ร้าน</span>
          <textarea
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
            rows={2}
            className="resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Spinner className="size-4 text-white" />}
          {saved ? 'บันทึกแล้ว ✓' : 'บันทึกการตั้งค่า'}
        </button>
      </form>
    </div>
  )
}
