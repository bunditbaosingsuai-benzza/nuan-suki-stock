'use client'

import { useSidebar } from '../context/SidebarContext'
import BranchSelector from './BranchSelector'
import { useUser } from '../context/UserContext'

export default function TopBar() {
  const { setIsOpen } = useSidebar()
  const { profile } = useUser()

  const getInitial = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  return (
    <div className="h-16 md:h-20 w-full bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-8 flex-shrink-0 z-[100] relative transition-all shadow-sm">
      
      <div className="flex items-center flex-1 gap-2 md:gap-4 min-w-0">
        <button onClick={() => setIsOpen(true)} className="md:hidden p-1.5 -ml-1 text-gray-600 hover:text-gray-900 focus:outline-none rounded-lg hover:bg-gray-50 flex-shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* รูปโปรไฟล์: มือถือ 32px (w-8), คอม 40px (w-10) */}
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#df2323] text-white flex items-center justify-center font-bold text-sm md:text-xl shadow-sm border-2 border-white flex-shrink-0">
            {getInitial(profile?.full_name)}
          </div>
          <div className="flex flex-col min-w-0">
            {/* ชื่อ/อีเมล: มือถือตัวเล็กและตัดคำถ้ายาวเกิน 110px */}
            <span className="text-gray-900 font-bold text-xs md:text-base truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">
              {profile?.full_name || 'กำลังโหลด...'}
            </span>
            <span className={`text-[10px] md:text-xs font-semibold px-1.5 md:px-2 py-0.5 rounded-full w-fit mt-0.5 md:mt-0 truncate ${profile?.role === 'manager' ? 'bg-red-100 text-[#df2323]' : 'bg-gray-100 text-gray-600'}`}>
              {profile?.role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}
            </span>
          </div>
        </div>
      </div>

      <div className="ml-2 flex items-center flex-shrink-0">
        <BranchSelector />
      </div>

    </div>
  )
}