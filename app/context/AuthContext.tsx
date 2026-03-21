'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)

      // ถ้าไม่มี User และไม่ได้อยู่หน้า Login -> เตะไปหน้า Login
      if (!session && pathname !== '/login') {
        router.push('/login')
      } 
      // ถ้ามี User แล้ว แต่พยายามเข้าหน้า Login -> เตะไปหน้า Dashboard
      else if (session && pathname === '/login') {
        router.push('/dashboard')
      }
    }
    checkUser()

    // ดักฟังการเปลี่ยนแปลง (เช่น ตอนกด Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session && pathname !== '/login') {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [pathname, router])

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-[#f8f9fa] text-[#df2323] font-bold text-xl">กำลังตรวจสอบสิทธิ์...</div>
  }

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)