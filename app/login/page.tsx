'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorModal, setErrorModal] = useState(false) // State เปิด/ปิด Pop-up
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // 🔴 ถ้ารหัสผิด ให้เปิด Pop-up
      setErrorModal(true)
      setIsLoading(false)
    } else {
      // 🟢 ถ้าถูก เด้งไปหน้าแดชบอร์ด
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#df2323] rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4">นวล</div>
          <h1 className="text-3xl font-bold text-gray-900">นวลสุกี้</h1>
          <p className="text-gray-500 mt-2">ระบบจัดการสต๊อกสินค้า</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">อีเมลพนักงาน</label>
            <input 
              type="email" 
              required 
              className="w-full border-2 border-gray-200 rounded-xl p-4 focus:outline-none focus:border-[#df2323] transition-colors"
              placeholder="email@nuan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">รหัสผ่าน</label>
            <input 
              type="password" 
              required 
              className="w-full border-2 border-gray-200 rounded-xl p-4 focus:outline-none focus:border-[#df2323] transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#df2323] hover:bg-[#b91c1c] text-white font-bold text-lg p-4 rounded-xl shadow-md transition-colors mt-4 disabled:opacity-50"
          >
            {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-8">หากลืมรหัสผ่าน กรุณาติดต่อผู้จัดการร้าน</p>
      </div>

      {/* ======================================= */}
      {/* 🔴 Pop-up แจ้งเตือนรหัสผ่านผิด */}
      {/* ======================================= */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-10 h-10 text-[#df2323]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2">เข้าสู่ระบบไม่สำเร็จ!</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              อีเมลหรือรหัสผ่านไม่ถูกต้อง<br />กรุณาตรวจสอบและลองใหม่อีกครั้ง
            </p>
            
            <button
              onClick={() => setErrorModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 rounded-xl shadow-sm transition-colors"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  )
}