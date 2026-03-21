'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // สั่งให้พาไปหน้าล็อกอินทันทีที่เปิดเว็บมา
    router.push('/login')
  }, [router])

  // แสดงข้อความโหลดระหว่างรอเปลี่ยนหน้า
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <div className="text-xl font-bold text-[#df2323] animate-pulse">
        กำลังพาท่านเข้าสู่ระบบ...
      </div>
    </div>
  )
}