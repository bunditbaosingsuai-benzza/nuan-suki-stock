'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSidebar } from '../context/SidebarContext'
import { supabase } from '../../lib/supabase'
import { useUser } from '../context/UserContext' 

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen, setIsOpen } = useSidebar()
  const { isManager } = useUser() 

  const mainMenuItems = [
    { name: 'แดชบอร์ด', icon: '⊞', path: '/dashboard', show: true },
    { name: 'เช็คของรายวัน', icon: '📅', path: '/check', show: true },
    { name: 'ประวัติการทำรายการ', icon: '🕒', path: '/history', show: true },
    { name: 'ประวัติการส่งรายงาน', icon: '📋', path: '/reports', show: true },
    // 🔴 เปลี่ยนจาก isManager เป็น true เพื่อให้พนักงานทั่วไปเห็นปุ่มนี้ด้วย
    { name: 'รายการสินค้า', icon: '📦', path: '/products', show: true }, 
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* 🔴 เพิ่ม z-[150] เพื่อให้พื้นหลังสีดำทับทุกอย่างในหน้า */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[150] md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 🔴 เพิ่ม z-[160] เพื่อให้ตัว Sidebar ลอยอยู่บนสุด (เหนือพื้นหลังดำอีกที) */}
      <div className={`fixed inset-y-0 left-0 z-[160] w-64 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* โลโก้ */}
        <div className="h-16 md:h-20 flex items-center px-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#df2323] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
              นวล
            </div>
            <span className="text-[#df2323] font-bold text-xl tracking-wide">นวลสุกี้</span>
          </div>
        </div>

        {/* เมนูหลัก */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {mainMenuItems.map((item) => {
            if (!item.show) return null; 
            
            const isActive = pathname === item.path
            return (
              <Link
                key={item.name}
                href={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all font-semibold text-sm ${
                  isActive
                    ? 'bg-red-50 text-[#df2323] shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className={`text-lg ${isActive ? 'text-[#df2323]' : 'text-gray-400 grayscale opacity-70'}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* เมนูด้านล่าง (จัดการสมาชิก & ออกจากระบบ) */}
        <div className="p-4 border-t border-gray-100 flex flex-col gap-1.5 bg-gray-50/50">
          
          {isManager && (
            <Link
              href="/members"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm ${
                pathname === '/members'
                  ? 'bg-red-50 text-[#df2323] shadow-sm border border-red-100'
                  : 'text-gray-600 hover:bg-white hover:text-[#df2323] hover:shadow-sm'
              }`}
            >
              <span className="text-lg text-[#df2323]">👥</span>
              จัดการสมาชิก
            </Link>
          )}

          {/* ปุ่มออกจากระบบ */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-gray-500 hover:bg-red-50 hover:text-[#df2323] transition-all font-semibold w-full text-left text-sm"
          >
            <span className="text-lg opacity-70">🚪</span>
            ออกจากระบบ
          </button>

        </div>

      </div>
    </>
  )
}