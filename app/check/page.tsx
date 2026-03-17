'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function DailyCheckPage() {
  const [products, setProducts] = useState<any[]>([])
  const [dailyChecks, setDailyChecks] = useState<any[]>([])
  
  // State สำหรับฟอร์มรอบเช้า
  const [selectedProductId, setSelectedProductId] = useState('')
  const [yesterdayBalance, setYesterdayBalance] = useState('')
  const [incoming, setIncoming] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 🔴 State สำหรับจัดการการ Edit รอบเย็น
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editEveningCount, setEditEveningCount] = useState<string>('')

  const today = new Date()
  const formattedDate = today.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const todayForDB = today.toLocaleDateString('en-CA')

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, unit')
      .order('name', { ascending: true })
    if (data) setProducts(data)
  }

  const fetchDailyChecks = async () => {
    const { data, error } = await supabase
      .from('daily_stock_checks')
      .select(`*, products ( name, unit, min_limit, max_limit )`)
      .eq('check_date', todayForDB)
      .order('id', { ascending: false })

    if (!error) setDailyChecks(data || [])
  }

  useEffect(() => {
    fetchProducts()
    fetchDailyChecks()
  }, [])

  const handleMorningSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) return alert('กรุณาเลือกสินค้า')
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .upsert({
          product_id: parseInt(selectedProductId),
          yesterday_balance: yesterdayBalance ? parseInt(yesterdayBalance) : 0,
          incoming: incoming ? parseInt(incoming) : 0,
        }, { onConflict: 'check_date, product_id' })

      if (error) throw error

      setSelectedProductId('')
      setYesterdayBalance('')
      setIncoming('')
      fetchDailyChecks()
    } catch (error: any) {
      alert('❌ บันทึกไม่สำเร็จ: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 🔴 ฟังก์ชันบันทึกยอดนับตอนเย็น
  const handleSaveEveningCount = async (id: number) => {
    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .update({ 
          // ถ้าลบว่างเปล่าไว้ จะบันทึกเป็น null (รอนับ) แต่ถ้ามีเลขก็แปลงเป็นตัวเลข
          evening_counted: editEveningCount === '' ? null : parseInt(editEveningCount) 
        })
        .eq('id', id)

      if (error) throw error

      setEditingId(null) // ปิดโหมด Edit
      fetchDailyChecks() // ดึงข้อมูลใหม่มาโชว์ (ให้มันคำนวณใหม่)
    } catch (error: any) {
      alert('❌ อัปเดตไม่สำเร็จ: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center mb-8">
          <h1 className="text-2xl font-bold text-red-600 mr-4">เช็คสต๊อกรายวัน</h1>
          <span className="bg-white px-4 py-1 rounded-full border border-gray-200 text-sm shadow-sm font-medium">
            {formattedDate}
          </span>
        </div>

        {/* ฟอร์มรอบเช้า */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="bg-yellow-500 p-3 px-6 text-white font-bold flex items-center">
            <span className="mr-2">☀️</span> บันทึกยอดตอนเช้า (เปิดร้าน / รับของเข้า)
          </div>
          <form onSubmit={handleMorningSubmit} className="p-6 flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">เลือกสินค้า</label>
              <select required value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:border-yellow-500 bg-white">
                <option value="" disabled>-- เลือกรายการสินค้า --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">เหลือเมื่อวาน</label>
              <input type="number" value={yesterdayBalance} onChange={(e) => setYesterdayBalance(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:border-yellow-500" placeholder="ยอดเก่า" />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 mb-1">ของเข้าวันนี้</label>
              <input type="number" required value={incoming} onChange={(e) => setIncoming(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:border-yellow-500" placeholder="รับมา" />
            </div>
            <button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium">
              {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตารางวันนี้'}
            </button>
          </form>
        </div>

        {/* ตารางรอบเย็น */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-500 p-3 px-6 text-white font-bold flex items-center justify-between">
            <div><span className="mr-2">🌙</span> ตารางเช็คของตอนเย็น (ปิดร้าน)</div>
            <div className="text-sm bg-blue-600 px-3 py-1 rounded-full">{dailyChecks.length} รายการ</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-sm border-b border-gray-200">
                  <th className="p-4 text-left bg-white w-1/4">รายการสินค้า (หน่วย)</th>
                  <th className="p-4 bg-yellow-500 text-white border-r border-yellow-600">เหลือเมื่อวาน</th>
                  <th className="p-4 bg-yellow-500 text-white border-r border-yellow-600">รับเข้า</th>
                  <th className="p-4 bg-yellow-600 text-white font-bold border-r border-yellow-700">รวมมีของ</th>
                  <th className="p-4 bg-blue-500 text-white font-bold border-r border-blue-600 w-40">นับได้ตอนเย็น</th>
                  <th className="p-4 bg-gray-100 text-gray-700">ถูกใช้ไป</th>
                  <th className="p-4 bg-red-50 text-red-600 font-bold border-l border-red-100">ต้องสั่งเพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {dailyChecks.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-gray-400">ยังไม่มีการบันทึกข้อมูลของวันนี้</td></tr>
                ) : (
                  dailyChecks.map((item) => {
                    // Logic คำนวณอัตโนมัติ
                    const totalAvailable = item.yesterday_balance + item.incoming;
                    const eveningCounted = item.evening_counted !== null ? item.evening_counted : '-';
                    const usedAmount = item.evening_counted !== null ? (totalAvailable - item.evening_counted) : '-';
                    
                    let orderAmount: number | string = '-';
                    let needsOrder = false;
                    
                    if (item.evening_counted !== null && item.products.min_limit !== null && item.products.max_limit !== null) {
                      if (item.evening_counted <= item.products.min_limit) {
                        orderAmount = item.products.max_limit - item.evening_counted;
                        needsOrder = orderAmount > 0;
                      } else {
                        orderAmount = 0; 
                      }
                    }

                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4 text-left font-medium bg-white">
                          {item.products.name}
                          <div className="text-xs text-gray-500 font-normal mt-1">
                            ห้ามเกิน: {item.products.max_limit || '-'} ขั้นต่ำ: {item.products.min_limit || '-'}
                          </div>
                        </td>
                        <td className="p-4 text-yellow-700 font-medium bg-yellow-50/50">{item.yesterday_balance}</td>
                        <td className="p-4 text-yellow-700 font-medium bg-yellow-50/50">+{item.incoming}</td>
                        <td className="p-4 text-yellow-800 font-bold text-lg bg-yellow-100/50">{totalAvailable}</td>
                        
                        {/* 🔴 ส่วนการแก้ไขนับได้ตอนเย็น */}
                        <td className="p-4 bg-blue-50 text-blue-600">
                          {editingId === item.id ? (
                            <div className="flex flex-col items-center gap-2">
                              <input
                                type="number"
                                autoFocus
                                className="w-20 border-2 border-blue-400 rounded p-1 text-center font-bold text-gray-800 focus:outline-none"
                                value={editEveningCount}
                                onChange={(e) => setEditEveningCount(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEveningCount(item.id)}
                              />
                              <div className="flex gap-1">
                                <button onClick={() => handleSaveEveningCount(item.id)} className="bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700">บันทึก</button>
                                <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-300">ยกเลิก</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-2xl font-bold">{eveningCounted === '-' ? <span className="text-gray-300 text-sm font-normal">รอนับ</span> : eveningCounted}</span>
                              <button 
                                onClick={() => {
                                  setEditingId(item.id)
                                  setEditEveningCount(item.evening_counted !== null ? String(item.evening_counted) : '')
                                }}
                                className="mt-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] px-3 py-1 rounded-full transition-colors flex items-center gap-1 font-medium shadow-sm">
                                ✏️ แก้ไข
                              </button>
                            </div>
                          )}
                        </td>
                        
                        <td className="p-4 text-gray-600 font-medium text-lg bg-gray-50">{usedAmount}</td>
                        
                        <td className={`p-4 font-bold text-lg bg-red-50/30 ${needsOrder ? 'text-red-600' : 'text-gray-400'}`}>
                          {needsOrder ? `+${orderAmount}` : (orderAmount === '-' ? '-' : orderAmount)}
                          {needsOrder && <div className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full inline-block mt-1">ต้องสั่งของ!</div>}
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