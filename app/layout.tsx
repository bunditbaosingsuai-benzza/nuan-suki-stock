import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import { SidebarProvider } from './context/SidebarContext'

const inter = Inter({ subsets: ['latin', 'thai'] })

export const metadata: Metadata = {
  title: 'นวลสุกี้ - ระบบจัดการสต๊อก',
  description: 'ระบบเช็คสต๊อกรายวัน',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${inter.className} flex h-full overflow-hidden bg-[#f8f9fa]`}>
        {/* 🔴 เรียกใช้ Provider เพื่อให้เมนูคุยกับปุ่มด้านบนได้ */}
        <SidebarProvider>
          <Sidebar />

          <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
            <TopBar />
            
            <main className="flex-1 overflow-y-auto bg-[#f8f9fa] custom-scrollbar">
              {children}
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}