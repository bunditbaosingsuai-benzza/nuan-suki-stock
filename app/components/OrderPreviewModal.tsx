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
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar bg-gray-50/50">
          {editableItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400 font-bold text-sm bg-white rounded-2xl border border-dashed border-gray-200">ไม่มีรายการที่ต้องสั่งเพิ่มครับ</div>
          ) : (
            <div className="flex flex-col gap-3">
              {editableItems.map((item, idx) => (
                <div key={idx} className="bg-white shadow-sm border border-gray-100 rounded-2xl p-3 sm:p-4 flex flex-row items-center justify-between gap-4 transition-all hover:shadow-md hover:border-[#0088cc]/30">
                  
                  {/* ฝั่งซ้าย: ชื่อสินค้า และ หมวดหมู่ */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="font-bold text-gray-800 text-sm sm:text-base leading-tight truncate">{item.name}</div>
                    <div className="text-[10px] sm:text-[11px] text-[#0088cc] font-semibold mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded-md border border-blue-100">
                      🏷️ {item.category}
                    </div>
                  </div>

                  {/* ฝั่งขวา: ช่องกรอกตัวเลข และ หน่วย */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <input 
                      type="number"
                      step="any" 
                      className="w-16 sm:w-20 md:w-24 border-2 border-gray-200 rounded-xl p-2 sm:p-2.5 text-center font-black text-[#df2323] text-sm sm:text-base md:text-lg focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/20 focus:outline-none transition-all bg-gray-50 hover:bg-white shadow-inner"
                      value={item.orderAmount.replace('+', '')}
                      onChange={(e) => handleUpdateAmount(idx, e.target.value)}
                    />
                    <span className="text-[11px] sm:text-xs font-bold text-gray-500 min-w-[40px] sm:min-w-[50px] truncate">
                      {item.unit}
                    </span>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 bg-white border-t border-gray-100 flex gap-3 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={onClose} className="w-1/3 sm:flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm sm:text-base font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition-colors">ยกเลิก</button>
          <button 
            disabled={isLoading || editableItems.length === 0}
            onClick={() => onConfirm(editableItems)} 
            className="w-2/3 sm:flex-[2] bg-[#0088cc] hover:bg-[#0077b5] text-white text-sm sm:text-base font-bold py-3 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-lg shadow-[#0088cc]/30 transition-all flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            {isLoading ? 'กำลังส่งข้อมูล...' : <><span>✈️</span> ยืนยันส่ง Telegram</>}
          </button>
        </div>
      </div>
    </div>
  )
}