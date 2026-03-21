'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import { SidebarProvider } from './context/SidebarContext'
import { AuthProvider } from './context/AuthContext'
import { usePathname } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  return (
    <html lang="th">
      <body className={`${inter.className} flex h-full overflow-hidden bg-[#f8f9fa]`}>
        <AuthProvider>
          {isLoginPage ? (
            // 🔴 ถ้าเป็นหน้า Login ให้โชว์แค่เนื้อหาเพียวๆ ไม่มีเมนู
            <main className="flex-1 w-full h-full">{children}</main>
          ) : (
            // 🟢 ถ้าล็อกอินแล้ว โชว์เมนู Sidebar และ TopBar ตามปกติ
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
        </AuthProvider>
      </body>
    </html>
  )
}