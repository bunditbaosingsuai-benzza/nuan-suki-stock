'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function HistoryPage() {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [historyData, setHistoryData] = useState<any[]>([])
  const [datesList, setDatesList] = useState<{ display: string; value: string }[]>([])

  // State สำหรับโหมดแก้ไขข้อมูลย้อนหลัง (เผื่อลงเลขผิด)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBalance, setEditBalance] = useState<string>('')
  const [editIncoming, setEditIncoming] = useState<string>('')
  const [editEvening, setEditEvening] = useState<string>('')

  // 1. สร้างรายการวันที่ย้อนหลัง 14 วัน สำหรับแถบเมนู
  useEffect(() => {
    const dates = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      
      const value = d.toLocaleDateString('en-CA') // Format: YYYY-MM-DD สำหรับคุยกับ Database
      const display = d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
      dates.push({ display, value })
    }
    setDatesList(dates)
    setSelectedDate(dates[0].value) // ค่าเริ่มต้นคือเลือก "วันนี้"
  }, [])

  // 2. ดึงข้อมูลทุกครั้งที่เปลี่ยนวันที่
  useEffect(() => {
    if (selectedDate) {
      fetchHistoryData(selectedDate)
      setEditingId(null) // เปลี่ยนวันปุ๊บ ปิดโหมด Edit
    }
  }, [selectedDate])

  const fetchHistoryData = async (dateStr: string) => {
    const { data, error } = await supabase
      .from('daily_stock_checks')
      .select(`*, products ( name, unit, min_limit, max_limit )`)
      .eq('check_date', dateStr)
      .order('id', { ascending: false })

    if (error) {
      console.error('Error fetching history:', error)
    } else {
      setHistoryData(data || [])
    }
  }

  // 3. ฟังก์ชันบันทึกการแก้ไขข้อมูลย้อนหลัง
  const handleSaveEdit = async (id: number) => {
    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .update({
          yesterday_balance: editBalance === '' ? 0 : parseInt(editBalance),
          incoming: editIncoming === '' ? 0 : parseInt(editIncoming),
          evening_counted: editEvening === '' ? null : parseInt(editEvening)
        })
        .eq('id', id)

      if (error) throw error
      
      setEditingId(null)
      fetchHistoryData(selectedDate) // ดึงข้อมูลมาอัปเดตตารางใหม่
      alert('✅ อัปเดตข้อมูลย้อนหลังเรียบร้อย')
    } catch (error: any) {
      alert('❌ อัปเดตไม่สำเร็จ: ' + error.message)
    }
  }

  // ฟังก์ชันช่วยหาชื่อวันที่แบบสวยๆ
  const getDisplayDate = (val: string) => datesList.find(d => d.value === val)?.display || val

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center mb-8">
          <h1 className="text-2xl font-bold text-red-600 mr-4">ประวัติการทำรายการ</h1>
        </div>

        {/* แถบเลือกวันที่ย้อนหลัง */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center text-gray-700 font-medium mb-4">
            <span className="mr-2">📅</span> เลือกวันที่ต้องการดู
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {datesList.map((dateObj, index) => {
              const isActive = selectedDate === dateObj.value
              return (
                <button
                  key={dateObj.value}
                  onClick={() => setSelectedDate(dateObj.value)}
                  className={`whitespace-nowrap px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'border-red-500 text-red-600 bg-red-50' 
                      : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500'
                  }`}
                >
                  {index === 0 ? `วันนี้: ${dateObj.display}` : dateObj.display}
                </button>
              )
            })}
          </div>
        </div>

        {/* ตารางแสดงข้อมูลของวันที่เลือก */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-100 p-3 px-6 text-gray-700 font-bold flex items-center justify-between border-b border-gray-200">
            <div><span className="mr-2">🗓️</span> ข้อมูลประจำวันที่: <span className="text-red-600">{getDisplayDate(selectedDate)}</span></div>
            <div className="text-sm bg-gray-200 px-3 py-1 rounded-full">{historyData.length} รายการ</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-sm border-b border-gray-200">
                  <th className="p-4 text-left bg-white w-1/4">รายการสินค้า (หน่วย)</th>
                  <th className="p-4 bg-yellow-50 text-yellow-800 border-r border-yellow-100">เหลือเมื่อวาน</th>
                  <th className="p-4 bg-yellow-50 text-yellow-800 border-r border-yellow-100">รับเข้า</th>
                  <th className="p-4 bg-yellow-100 text-yellow-900 font-bold border-r border-yellow-200">รวมมีของ</th>
                  <th className="p-4 bg-blue-50 text-blue-800 font-bold border-r border-blue-100 w-40">นับได้ตอนเย็น</th>
                  <th className="p-4 bg-gray-50 text-gray-700">ถูกใช้ไป</th>
                  <th className="p-4 bg-red-50 text-red-600 font-bold">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {historyData.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-gray-400">ไม่มีการบันทึกข้อมูลในวันที่เลือก</td></tr>
                ) : (
                  historyData.map((item) => {
                    const isEditing = editingId === item.id

                    // คำนวณยอด
                    const totalAvailable = isEditing 
                      ? (Number(editBalance) || 0) + (Number(editIncoming) || 0)
                      : item.yesterday_balance + item.incoming;
                    
                    const eveningCounted = isEditing 
                      ? editEvening 
                      : (item.evening_counted !== null ? item.evening_counted : '-');
                      
                    const usedAmount = (!isEditing && item.evening_counted !== null) 
                      ? (totalAvailable - item.evening_counted) 
                      : (isEditing && editEvening !== '' ? totalAvailable - Number(editEvening) : '-');

                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4 text-left font-medium bg-white">
                          {item.products.name}
                        </td>
                        
                        {/* ช่อง: เหลือเมื่อวาน */}
                        <td className="p-4 text-yellow-700 bg-yellow-50/30">
                          {isEditing ? (
                            <input type="number" className="w-16 border rounded p-1 text-center" value={editBalance} onChange={e => setEditBalance(e.target.value)} />
                          ) : item.yesterday_balance}
                        </td>

                        {/* ช่อง: รับเข้า */}
                        <td className="p-4 text-yellow-700 bg-yellow-50/30">
                          {isEditing ? (
                            <input type="number" className="w-16 border rounded p-1 text-center" value={editIncoming} onChange={e => setEditIncoming(e.target.value)} />
                          ) : `+${item.incoming}`}
                        </td>

                        <td className="p-4 text-yellow-800 font-bold text-lg bg-yellow-50/50">{totalAvailable}</td>
                        
                        {/* ช่อง: นับได้ตอนเย็น */}
                        <td className="p-4 text-blue-600 font-bold bg-blue-50/30">
                          {isEditing ? (
                            <input type="number" className="w-16 border-2 border-blue-400 rounded p-1 text-center" value={editEvening} onChange={e => setEditEvening(e.target.value)} />
                          ) : (
                            <span className="text-xl">{eveningCounted}</span>
                          )}
                        </td>
                        
                        <td className="p-4 text-gray-600 font-medium text-lg bg-gray-50/50">{usedAmount}</td>
                        
                        {/* ช่อง: จัดการ */}
                        <td className="p-4 bg-white">
                          {isEditing ? (
                            <div className="flex flex-col gap-1 items-center">
                              <button onClick={() => handleSaveEdit(item.id)} className="bg-emerald-500 text-white text-xs px-3 py-1 rounded w-full hover:bg-emerald-600">บันทึก</button>
                              <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded w-full hover:bg-gray-300">ยกเลิก</button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingId(item.id)
                                setEditBalance(String(item.yesterday_balance))
                                setEditIncoming(String(item.incoming))
                                setEditEvening(item.evening_counted !== null ? String(item.evening_counted) : '')
                              }}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-full transition-colors flex items-center justify-center gap-1 w-full border border-gray-200">
                              ✏️ แก้ไขข้อมูล
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}