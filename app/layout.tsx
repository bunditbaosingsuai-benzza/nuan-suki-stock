'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import { SidebarProvider } from './context/SidebarContext'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BranchProvider } from './context/BranchContext'
import { UserProvider } from './context/UserContext'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  // 🔴 เพิ่มยามฝั่งหน้าบ้าน (Client-side Check)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      // ถ้าไม่มี Token (ล็อกเอาท์ไปแล้ว) และไม่ได้อยู่หน้า Login -> เตะออกทันที
      if (!session && !isLoginPage) {
        window.location.replace('/login')
      }
    }

    checkAuth()

    // 🔴 ดักจับการเปลี่ยนแปลง (ถ้าเปิดเว็บ 2 แท็บ แท็บนึงกดล็อกเอาท์ อีกแท็บจะโดนเตะออกตามอัตโนมัติ!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !isLoginPage) {
        window.location.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [isLoginPage])

  return (
    <html lang="th">
      <body className={`${inter.className} flex h-full overflow-hidden bg-[#f8f9fa]`}>
        {/* 🔴 ครอบ BranchProvider ไว้ตรงนี้ เพื่อให้ทุกหน้ารู้จักสาขาที่เลือก! */}
        <UserProvider>
        <BranchProvider>
          {isLoginPage ? (
            <main className="flex-1 w-full h-full">{children}</main>
          ) : (
            <SidebarProvider>
              <Sidebar />
              <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
                <TopBar />
                <main className="flex-1 overflow-y-auto bg-[#f8f9fa] custom-scrollbar">
                  {children}
                </main>
              </div>
            </SidebarProvider>
          )}
        </BranchProvider>
        </UserProvider>
      </body>
    </html>
  )
}