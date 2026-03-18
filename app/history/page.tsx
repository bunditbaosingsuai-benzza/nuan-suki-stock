'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<any[]>([])
  
  // 🔴 State สำหรับจัดการโหมดแสดงผล (วัน / เดือน)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')
  
  // สร้างรายการวันที่ย้อนหลัง 31 วัน และ 12 เดือน
  const [dates, setDates] = useState<Date[]>([])
  const [months, setMonths] = useState<Date[]>([])
  
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // State สำหรับแก้ไขข้อมูล (ใช้ได้เฉพาะโหมดรายวัน)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editYest, setEditYest] = useState('')
  const [editInc, setEditInc] = useState('')
  const [editEve, setEditEve] = useState('')

  const [successModal, setSuccessModal] = useState(false)
  const today = new Date()

  useEffect(() => {
    // สร้าง array 31 วันย้อนหลัง
    const tempDates = []
    for (let i = 0; i < 31; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      tempDates.push(d)
    }
    setDates(tempDates)
    setSelectedDate(tempDates[0].toLocaleDateString('en-CA'))

    // สร้าง array 12 เดือนย้อนหลัง
    const tempMonths = []
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setDate(1) // ตั้งเป็นวันที่ 1 ป้องกันบั๊กข้ามเดือน
      d.setMonth(today.getMonth() - i)
      tempMonths.push(d)
    }
    setMonths(tempMonths)
    setSelectedMonth(`${tempMonths[0].getFullYear()}-${String(tempMonths[0].getMonth() + 1).padStart(2, '0')}`)
  }, [])

  const fetchHistory = async () => {
    if (viewMode === 'daily' && selectedDate) {
      const { data } = await supabase
        .from('daily_stock_checks')
        .select('*, products(name, unit)')
        .eq('check_date', selectedDate)
        .order('id', { ascending: true })
      if (data) setHistoryData(data)
    } 
    else if (viewMode === 'monthly' && selectedMonth) {
      // ค้นหาตั้งแต่วันแรก ถึงวันสุดท้ายของเดือนที่เลือก
      const [year, month] = selectedMonth.split('-')
      const start = `${selectedMonth}-01`
      const end = new Date(parseInt(year), parseInt(month), 0).toLocaleDateString('en-CA')
      
      const { data } = await supabase
        .from('daily_stock_checks')
        .select('*, products(name, unit)')
        .gte('check_date', start)
        .lte('check_date', end)
        .order('check_date', { ascending: true }) // เรียงตามวันที่เพื่อหายอดล่าสุด
      if (data) setHistoryData(data)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [viewMode, selectedDate, selectedMonth])

  const handleSaveEdit = async (id: number) => {
    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .update({
          yesterday_balance: editYest === '' ? 0 : parseInt(editYest),
          incoming: editInc === '' ? 0 : parseInt(editInc),
          evening_counted: editEve === '' ? null : parseInt(editEve)
        })
        .eq('id', id)

      if (error) throw error

      setEditingId(null)
      fetchHistory()
      setSuccessModal(true)
    } catch (error: any) {
      alert('❌ อัปเดตไม่สำเร็จ: ' + error.message)
    }
  }

  // 🔴 ฟังก์ชันคำนวณสรุปยอดรายเดือน
  const getMonthlySummary = () => {
    const summaryMap: Record<string, any> = {}
    
    historyData.forEach(item => {
      const pid = item.product_id
      if (!summaryMap[pid]) {
        summaryMap[pid] = {
          id: pid,
          name: item.products.name,
          unit: item.products.unit,
          total_incoming: 0,
          total_used: 0,
          latest_balance: 0
        }
      }
      
      const totalAvailable = item.yesterday_balance + item.incoming
      const used = item.evening_counted !== null ? totalAvailable - item.evening_counted : 0
      
      summaryMap[pid].total_incoming += item.incoming
      summaryMap[pid].total_used += used
      summaryMap[pid].latest_balance = item.evening_counted !== null ? item.evening_counted : summaryMap[pid].latest_balance
    })

    return Object.values(summaryMap)
  }

  const monthlySummaryData = getMonthlySummary()

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      
      {/* ส่วนหัว และ ปุ่ม Toggle โหมด (ตามดีไซน์) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-[#df2323]">ประวัติการทำรายการ</h1>
          <div className="bg-white px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm">
            {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div className="flex bg-gray-200/80 rounded-full p-1 shadow-inner">
          <button 
            onClick={() => setViewMode('daily')} 
            className={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${
              viewMode === 'daily' ? 'bg-white text-[#df2323] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 ดูตามวัน
          </button>
          <button 
            onClick={() => setViewMode('monthly')} 
            className={`px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${
              viewMode === 'monthly' ? 'bg-white text-[#df2323] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🗓️ สรุปรายเดือน
          </button>
        </div>
      </div>

      {/* เลือกวันที่ หรือ เลือกเดือน */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {viewMode === 'daily' ? 'เลือกวันที่ต้องการดู' : 'เลือกเดือนที่ต้องการดู'}
        </div>
        
        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-3">
          {viewMode === 'daily' ? (
            /* 🔴 โชว์ปุ่ม 31 วัน */
            dates.map((d, idx) => {
              const dateStr = d.toLocaleDateString('en-CA')
              const isSelected = selectedDate === dateStr
              return (
                <button key={idx} onClick={() => setSelectedDate(dateStr)}
                  className={`flex-shrink-0 px-5 py-2.5 rounded-xl border font-semibold transition-all ${
                    isSelected ? 'border-[#df2323] text-[#df2323] bg-[#fef2f2] shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </button>
              )
            })
          ) : (
            /* 🔴 โชว์ปุ่ม 12 เดือน */
            months.map((d, idx) => {
              const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              const isSelected = selectedMonth === monthStr
              return (
                <button key={idx} onClick={() => setSelectedMonth(monthStr)}
                  className={`flex-shrink-0 px-6 py-2.5 rounded-xl border font-bold transition-all ${
                    isSelected ? 'border-[#df2323] text-[#df2323] bg-[#fef2f2] shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ตารางข้อมูล */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 px-6 border-b border-gray-200 flex justify-between items-center">
          <div className="font-bold text-gray-700 flex items-center gap-2">
            <span>🗂️</span> {viewMode === 'daily' 
              ? `ข้อมูลประจำวันที่: ${new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : `สรุปยอดเดือน: ${new Date(selectedMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`
            }
          </div>
          <div className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
            {viewMode === 'daily' ? historyData.length : monthlySummaryData.length} รายการ
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'daily' ? (
            /* ======================================= */
            /* 🔴 ตารางแบบรายวัน (แก้ข้อมูลได้) */
            /* ======================================= */
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-sm border-b border-gray-200 bg-white">
                  <th className="p-4 font-bold text-gray-700 text-left">รายการสินค้า (หน่วย)</th>
                  <th className="p-4 font-bold text-yellow-700 bg-yellow-50/50">เหลือเมื่อวาน</th>
                  <th className="p-4 font-bold text-yellow-700 bg-yellow-50/50">รับเข้า</th>
                  <th className="p-4 font-bold text-yellow-800 bg-yellow-100/50">รวมมีของ</th>
                  <th className="p-4 font-bold text-blue-700 bg-blue-50/50">นับได้ตอนเย็น</th>
                  <th className="p-4 font-bold text-gray-700">ถูกใช้ไป</th>
                  <th className="p-4 font-bold text-[#df2323]">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {historyData.length === 0 ? (
                  <tr><td colSpan={7} className="p-12 text-gray-400">ไม่มีข้อมูลบันทึกในวันที่เลือก</td></tr>
                ) : (
                  historyData.map((item) => {
                    const total = item.yesterday_balance + item.incoming
                    const used = item.evening_counted !== null ? total - item.evening_counted : '-'
                    const isEditing = editingId === item.id

                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-left font-bold text-gray-800">{item.products.name}</td>
                        {isEditing ? (
                          <>
                            <td className="p-2"><input type="number" className="w-20 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editYest} onChange={e => setEditYest(e.target.value)} /></td>
                            <td className="p-2"><input type="number" className="w-20 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editInc} onChange={e => setEditInc(e.target.value)} /></td>
                            <td className="p-4 font-bold text-xl text-yellow-800 bg-yellow-50">{total}</td>
                            <td className="p-2"><input type="number" className="w-20 border-2 border-blue-400 rounded-lg p-2 text-center font-bold" value={editEve} onChange={e => setEditEve(e.target.value)} /></td>
                          </>
                        ) : (
                          <>
                            <td className="p-4 text-yellow-700 font-semibold">{item.yesterday_balance}</td>
                            <td className="p-4 text-yellow-700 font-semibold">{item.incoming}</td>
                            <td className="p-4 text-yellow-900 font-bold text-lg bg-yellow-50/30">{total}</td>
                            <td className="p-4 text-blue-600 font-bold text-lg">{item.evening_counted ?? '-'}</td>
                          </>
                        )}
                        <td className="p-4 text-gray-600 font-semibold">{used}</td>
                        <td className="p-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 items-center justify-center">
                              <button onClick={() => handleSaveEdit(item.id)} className="bg-[#059669] hover:bg-[#047857] text-white text-xs px-4 py-1.5 rounded-lg font-bold shadow-sm w-16">บันทึก</button>
                              <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-600 text-xs px-4 py-1.5 rounded-lg font-bold shadow-sm w-16">ยกเลิก</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingId(item.id); setEditYest(String(item.yesterday_balance)); setEditInc(String(item.incoming)); setEditEve(item.evening_counted !== null ? String(item.evening_counted) : '') }}
                              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs px-4 py-2 rounded-full font-semibold shadow-sm transition-colors">
                              ✏️ แก้ไข
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ======================================= */
            /* 🔴 ตารางแบบสรุปรายเดือน (โชว์ยอดสรุป) */
            /* ======================================= */
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-sm border-b border-gray-200 bg-white">
                  <th className="p-5 font-bold text-gray-700 text-left">รายการสินค้า (หน่วย)</th>
                  <th className="p-5 font-bold text-[#059669] bg-green-50/50">รับเข้าทั้งหมด (เดือนนี้)</th>
                  <th className="p-5 font-bold text-[#df2323] bg-red-50/50">ถูกใช้ไปทั้งหมด (เดือนนี้)</th>
                  <th className="p-5 font-bold text-[#2563eb] bg-blue-50/50">ยอดคงเหลือล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaryData.length === 0 ? (
                  <tr><td colSpan={4} className="p-12 text-gray-400">ไม่มีความเคลื่อนไหวสต๊อกในเดือนที่เลือก</td></tr>
                ) : (
                  monthlySummaryData.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-5 text-left font-bold text-gray-800">{item.name} <span className="text-xs text-gray-500 ml-1 font-normal">({item.unit})</span></td>
                      <td className="p-5 text-[#059669] font-bold text-lg bg-green-50/30">+{item.total_incoming}</td>
                      <td className="p-5 text-[#df2323] font-bold text-lg bg-red-50/30">-{item.total_used}</td>
                      <td className="p-5 text-[#2563eb] font-bold text-xl bg-blue-50/30">{item.latest_balance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pop-up แจ้งเตือนสำเร็จ */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">สำเร็จ!</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">อัปเดตข้อมูลย้อนหลังเรียบร้อยแล้ว</p>
            <button onClick={() => setSuccessModal(false)} className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  )
}