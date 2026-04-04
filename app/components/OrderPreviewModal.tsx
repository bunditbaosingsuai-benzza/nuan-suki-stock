'use client'

import React, { useState, useEffect } from 'react'

interface OrderItem {
  product_id: number
  check_id?: number | null 
  name: string
  category: string
  unit: string
  yesterday: any
  incoming: any
  evening: any
  used: any
  orderAmount: string
  needsOrder: boolean
}

interface OrderPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (finalData: OrderItem[]) => void
  items: OrderItem[]
  isLoading: boolean
}

export default function OrderPreviewModal({ isOpen, onClose, onConfirm, items, isLoading }: OrderPreviewModalProps) {
  const [editableItems, setEditableItems] = useState<OrderItem[]>([])

  useEffect(() => {
    setEditableItems(items.filter(item => item.needsOrder))
  }, [items, isOpen])

  const handleUpdateAmount = (index: number, newVal: string) => {
    const updated = [...editableItems]
    updated[index].orderAmount = newVal.startsWith('+') ? newVal : `+${newVal}`
    setEditableItems(updated)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 max-h-[90vh]">
        <div className="bg-[#0088cc] p-4 sm:p-5 px-5 sm:px-6 flex justify-between items-center text-white flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl">🛒</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-none">ตรวจสอบยอดสั่งซื้อ</h2>
              <p className="text-[10px] sm:text-[11px] opacity-80 mt-1">กรุณาตรวจสอบและแก้ไขจำนวนที่ต้องการสั่งจริง</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center transition-colors text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar bg-gray-50/50">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-3 sm:px-4 pb-2">รายการสินค้า</th>
                <th className="px-3 sm:px-4 pb-2 text-center w-24 sm:w-32">จำนวนที่สั่ง</th>
              </tr>
            </thead>
            <tbody>
              {editableItems.length === 0 ? (
                <tr><td colSpan={2} className="text-center py-10 text-gray-400 font-bold text-sm">ไม่มีรายการที่ต้องสั่งเพิ่มครับ</td></tr>
              ) : (
                editableItems.map((item, idx) => (
                  <tr key={idx} className="bg-white shadow-sm rounded-xl overflow-hidden">
                    <td className="p-3 sm:p-4 rounded-l-xl border-y border-l border-gray-100">
                      <div className="font-bold text-gray-800 text-sm sm:text-base">{item.name}</div>
                      <div className="text-[9px] sm:text-[10px] text-indigo-600 font-bold mt-0.5">🏷️ {item.category}</div>
                    </td>
                    <td className="p-3 sm:p-4 rounded-r-xl border-y border-r border-gray-100">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <input 
                          type="number"
                          step="any" 
                          className="w-full border-2 border-indigo-100 rounded-lg p-1.5 sm:p-2 text-center font-black text-[#df2323] focus:border-[#0088cc] focus:outline-none transition-colors text-sm sm:text-base"
                          value={item.orderAmount.replace('+', '')}
                          onChange={(e) => handleUpdateAmount(idx, e.target.value)}
                        />
                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 whitespace-nowrap">{item.unit}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 🔴 ปรับขนาดปุ่มตรงนี้ให้พอดีมือถือ */}
        <div className="p-3 sm:p-5 bg-white border-t border-gray-100 flex gap-2 sm:gap-3 flex-shrink-0">
          <button onClick={onClose} className="w-1/3 sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm sm:text-base font-bold py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl transition-colors">ยกเลิก</button>
          <button 
            disabled={isLoading || editableItems.length === 0}
            onClick={() => onConfirm(editableItems)} 
            className="w-2/3 sm:flex-[2] bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm sm:text-base font-bold py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50"
          >
            {isLoading ? 'กำลังส่ง...' : <><span>✈️</span> ยืนยันส่ง Telegram</>}
          </button>
        </div>
      </div>
    </div>
  )
}