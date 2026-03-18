'use client'

import { useSidebar } from '../context/SidebarContext'

export default function TopBar() {
  const { setIsOpen } = useSidebar() // 🔴 ดึงฟังก์ชันเปิดเมนูมาใช้

  return (
    <div className="h-16 md:h-20 w-full bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 transition-all shadow-sm">
      
      <div className="flex items-center flex-1 gap-3 md:gap-4 max-w-3xl">
        {/* 🔴 ปุ่มแฮมเบอร์เกอร์ (โชว์แค่มือถือ/แท็บเล็ตเล็ก) */}
        <button 
          onClick={() => setIsOpen(true)}
          className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-lg hover:bg-gray-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {/* ช่องค้นหา */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
            <svg className="h-4 w-4 md:h-5 md:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="ค้นหารายการ..."
            className="block w-full pl-9 md:pl-12 pr-4 py-2 md:py-3 text-sm md:text-base border border-gray-200 rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors bg-white shadow-inner"
          />
        </div>
      </div>

      {/* กระดิ่งแจ้งเตือน */}
      <div className="ml-3 md:ml-4 flex items-center">
        <button className="bg-gray-50 p-2 md:p-3 rounded-xl text-gray-600 hover:text-gray-800 border border-gray-200 shadow-sm transition-colors relative">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          <span className="absolute top-0 right-0 block h-2 md:h-2.5 w-2 md:w-2.5 rounded-full ring-2 ring-white bg-red-600"></span>
        </button>
      </div>
    </div>
  )
}