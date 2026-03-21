'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Product {
  id: number;
  name: string;
  unit: string;
  min_limit: number | null;
  max_limit: number | null;
  categories?: { name: string } | null;
}

interface DailyCheck {
  id: number;
  product_id: number;
  check_date: string;
  yesterday_balance: number;
  incoming: number;
  evening_counted: number | null;
}

export default function DailyCheckPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [todayChecks, setTodayChecks] = useState<DailyCheck[]>([])
  
  // 🔴 เปลี่ยนจากเก็บของเมื่อวาน เป็นเก็บ "ข้อมูลล่าสุด" ของแต่ละสินค้า
  const [latestPastChecks, setLatestPastChecks] = useState<Record<number, DailyCheck>>({})
  
  const [selectedProductId, setSelectedProductId] = useState('')
  const [yesterdayBalance, setYesterdayBalance] = useState('')
  const [incoming, setIncoming] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editingIncomingId, setEditingIncomingId] = useState<number | null>(null)
  const [editIncomingCount, setEditIncomingCount] = useState<string>('') 

  const [editingEveningId, setEditingEveningId] = useState<number | null>(null)
  const [editEveningCount, setEditEveningCount] = useState<string>('')

  const today = new Date()
  const todayForDB = today.toLocaleDateString('en-CA')

  const fetchData = async () => {
    // 1. ดึงสินค้าและหมวดหมู่
    const { data: pData } = await supabase.from('products').select('*, categories(name)').order('id', { ascending: true })
    if (pData) setProducts(pData as Product[])

    // 2. ดึงยอดของวันนี้
    const { data: tData } = await supabase.from('daily_stock_checks').select('*').eq('check_date', todayForDB)
    if (tData) setTodayChecks(tData as DailyCheck[])

    // 3. 🔴 ดึงยอดเช็คย้อนหลังทั้งหมด (ที่ก่อนหน้าวันนี้) แล้วเรียงจากใหม่ไปเก่า
    const { data: pastData } = await supabase
      .from('daily_stock_checks')
      .select('*')
      .lt('check_date', todayForDB)
      .order('check_date', { ascending: false })
      .limit(3000) // ดึงเผื่อไว้เยอะๆ กรณีร้านปิดหลายวัน

    // 4. 🔴 กรองเอาเฉพาะ "ยอดล่าสุด" ของสินค้านั้นๆ
    const latestMap: Record<number, DailyCheck> = {}
    if (pastData) {
      pastData.forEach((check: any) => {
        if (!latestMap[check.product_id]) {
          latestMap[check.product_id] = check as DailyCheck
        }
      })
    }
    setLatestPastChecks(latestMap)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const tableRows = products.map(product => {
    const tCheck = todayChecks.find(c => c.product_id === product.id)
    const latestCheck = latestPastChecks[product.id] // 🔴 ดึงยอดล่าสุดมาใช้

    // คำนวณยอดเหลือล่าสุด (ถ้านับตอนเย็นไว้ เอาตอนเย็นมาใช้ ถ้าไม่ได้นับเอายอดรวมมาใช้)
    let defaultLatestBalance = 0;
    if (latestCheck) {
      if (latestCheck.evening_counted !== null) {
        defaultLatestBalance = latestCheck.evening_counted;
      } else {
        defaultLatestBalance = latestCheck.yesterday_balance + latestCheck.incoming;
      }
    }

    return {
      id: product.id,
      name: product.name,
      categoryName: product.categories?.name || 'ไม่มีหมวดหมู่',
      unit: product.unit,
      min_limit: product.min_limit,
      max_limit: product.max_limit,
      check_id: tCheck?.id || null,
      yesterday_balance: tCheck ? tCheck.yesterday_balance : defaultLatestBalance, // 🔴 โชว์ยอดล่าสุด
      incoming: tCheck ? tCheck.incoming : 0,
      evening_counted: tCheck ? tCheck.evening_counted : null,
    }
  })

  // จัดกลุ่มตามหมวดหมู่
  const groupedRows = tableRows.reduce((acc, row) => {
    const cat = row.categoryName;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {} as Record<string, typeof tableRows>);

  const handleSelectProduct = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value
    setSelectedProductId(pid)
    
    const row = tableRows.find(r => r.id === parseInt(pid))
    if (row) {
      setYesterdayBalance(String(row.yesterday_balance))
      setIncoming(String(row.incoming === 0 ? '' : row.incoming))
    }
  }

  const handleMorningSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) return alert('กรุณาเลือกสินค้า')
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .upsert({
          product_id: parseInt(selectedProductId),
          check_date: todayForDB,
          yesterday_balance: yesterdayBalance ? parseFloat(yesterdayBalance) : 0,
          incoming: incoming ? parseFloat(incoming) : 0,
        }, { onConflict: 'check_date, product_id' })

      if (error) throw error

      setSelectedProductId('')
      setYesterdayBalance('')
      setIncoming('')
      fetchData()
    } catch (error: any) {
      alert('❌ บันทึกไม่สำเร็จ: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveIncoming = async (productId: number, currentYestBal: number, currentEvening: number | null) => {
    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .upsert({
          product_id: productId,
          check_date: todayForDB,
          yesterday_balance: currentYestBal,
          incoming: editIncomingCount === '' ? 0 : parseFloat(editIncomingCount),
          evening_counted: currentEvening 
        }, { onConflict: 'check_date, product_id' })

      if (error) throw error

      setEditingIncomingId(null)
      fetchData()
    } catch (error: any) {
      alert('❌ อัปเดตยอดรับเข้าไม่สำเร็จ: ' + error.message)
    }
  }

  const handleSaveEvening = async (productId: number, currentYestBal: number, currentInc: number) => {
    try {
      const { error } = await supabase
        .from('daily_stock_checks')
        .upsert({
          product_id: productId,
          check_date: todayForDB,
          yesterday_balance: currentYestBal, 
          incoming: currentInc, 
          evening_counted: editEveningCount === '' ? null : parseFloat(editEveningCount) 
        }, { onConflict: 'check_date, product_id' })

      if (error) throw error

      setEditingEveningId(null)
      fetchData()
    } catch (error: any) {
      alert('❌ อัปเดตยอดนับไม่สำเร็จ: ' + error.message)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold text-[#df2323]">เช็คสต๊อกรายวัน</h1>
          <div className="bg-white px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm">
            {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="bg-[#facc15] p-4 px-8 text-white font-bold flex items-center gap-3 border-b border-[#eab308]">
            <span className="text-2xl">☀️</span> บันทึกยอดตอนเช้า (เปิดร้าน / รับของเข้า)
          </div>
          <form onSubmit={handleMorningSubmit} className="p-8 flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">เลือกสินค้า</label>
              <select required value={selectedProductId} onChange={handleSelectProduct}
                className="w-full border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-[#facc15] bg-white shadow-inner transition-colors">
                <option value="" disabled>-- เลือกลงยอดรับเข้า --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div className="w-40">
              {/* 🔴 เปลี่ยนคำอธิบายเป็น "ยอดเหลือล่าสุด" */}
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ยอดเหลือล่าสุด</label>
              <input type="number" step="any" value={yesterdayBalance} onChange={(e) => setYesterdayBalance(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-[#facc15] shadow-inner transition-colors bg-gray-50" placeholder="0" />
            </div>
            <div className="w-40">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ของเข้าวันนี้</label>
              <input type="number" step="any" required value={incoming} onChange={(e) => setIncoming(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3.5 focus:outline-none focus:border-[#facc15] shadow-inner transition-colors" placeholder="รับมา" />
            </div>
            <button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[58px]">
              {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตารางวันนี้'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#2563eb] p-4 px-8 text-white font-bold flex items-center justify-between gap-3 border-b border-[#1d4ed8]">
            <div className="flex items-center gap-3"><span className="text-2xl">🌙</span> ตารางเช็คของตอนเย็น (ปิดร้าน)</div>
            <div className="text-sm bg-[#1d4ed8] px-4 py-1.5 rounded-full shadow-inner font-medium">{tableRows.length} รายการ</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="text-sm border-b border-gray-100">
                  <th className="p-5 text-left bg-gray-50/50 w-1/4 font-semibold text-gray-600">รายการสินค้า (หน่วย)</th>
                  {/* 🔴 เปลี่ยนหัวตาราง */}
                  <th className="p-5 bg-[#facc15] text-[#854d0e] border-r border-[#eab308]">ยอดเหลือล่าสุด</th>
                  <th className="p-5 bg-[#facc15] text-[#854d0e] border-r border-[#eab308]">รับเข้าวันนี้</th>
                  <th className="p-5 bg-[#eab308] text-[#854d0e] font-bold border-r border-[#ca8a04]">รวมมีของ</th>
                  <th className="p-5 bg-[#2563eb] text-white font-bold border-r border-[#1d4ed8] w-48">นับได้ตอนเย็น</th>
                  <th className="p-5 bg-gray-100 text-gray-600">ถูกใช้ไป</th>
                  <th className="p-5 bg-[#fef2f2] text-[#df2323] font-bold border-l border-[#fecaca]">ต้องสั่งเพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan={7} className="p-16 text-gray-400">ยังไม่มีรายการสินค้าในระบบ</td></tr>
                ) : (
                  Object.entries(groupedRows).map(([category, items]) => (
                    <React.Fragment key={category}>
                      <tr className="bg-gray-100 border-y border-gray-200">
                        <td colSpan={7} className="p-3 pl-6 text-left font-bold text-gray-800 text-sm">
                          📂 หมวดหมู่: {category}
                        </td>
                      </tr>
                      
                      {items.map((item) => {
                        const totalAvailable = Number((item.yesterday_balance + item.incoming).toFixed(1));
                        const eveningCounted = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : '-';
                        const usedAmount = item.evening_counted !== null ? Number((totalAvailable - item.evening_counted).toFixed(1)) : '-';
                        
                        let orderAmount: number | string = '-';
                        let needsOrder = false;
                        
                        if (item.evening_counted !== null && item.min_limit !== null && item.max_limit !== null) {
                          if (item.evening_counted <= item.min_limit) {
                            orderAmount = Number((item.max_limit - item.evening_counted).toFixed(1));
                            needsOrder = orderAmount > 0;
                          } else {
                            orderAmount = 0; 
                          }
                        }

                        return (
                          <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="p-5 text-left font-semibold text-gray-800 bg-white">
                              {item.name}
                              <div className="text-xs text-gray-500 font-normal mt-2 flex gap-3">
                                <span>Max: {item.max_limit !== null ? Number(item.max_limit.toFixed(1)) : '-'}</span> 
                                <span>Min: {item.min_limit !== null ? Number(item.min_limit.toFixed(1)) : '-'}</span>
                              </div>
                            </td>
                            <td className="p-5 text-yellow-900 font-semibold bg-yellow-50/50">{Number(item.yesterday_balance.toFixed(1))}</td>
                            
                            <td className="p-5 text-yellow-900 font-semibold bg-yellow-50/50">
                              {editingIncomingId === item.id ? (
                                <div className="flex flex-col items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="any"
                                    autoFocus
                                    className="w-20 border-2 border-[#facc15] rounded-xl p-2 text-center font-bold text-gray-900 focus:outline-none shadow-sm" 
                                    value={editIncomingCount} 
                                    onChange={(e) => setEditIncomingCount(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveIncoming(item.id, item.yesterday_balance, item.evening_counted)} 
                                  />
                                  <div className="flex gap-1">
                                    <button onClick={() => handleSaveIncoming(item.id, item.yesterday_balance, item.evening_counted)} className="bg-yellow-600 text-white text-[11px] px-2 py-1 rounded-md hover:bg-yellow-700 shadow-sm font-bold">บันทึก</button>
                                    <button onClick={() => setEditingIncomingId(null)} className="bg-yellow-100 text-yellow-800 text-[11px] px-2 py-1 rounded-md hover:bg-yellow-200 shadow-sm font-bold">ยกเลิก</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-lg">+{item.incoming}</span>
                                  <button 
                                    onClick={() => { 
                                      setEditingIncomingId(item.id); 
                                      setEditIncomingCount(String(item.incoming));
                                    }}
                                    className="mt-1 bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-100 text-[11px] px-3 py-1 rounded-full transition-colors flex items-center gap-1 font-semibold shadow-sm"
                                  >
                                    ✏️ แก้ไขรับเข้า
                                  </button>
                                </div>
                              )}
                            </td>

                            <td className="p-5 text-yellow-950 font-bold text-xl bg-yellow-100/50">{totalAvailable}</td>
                            
                            <td className="p-5 bg-blue-50/30 text-blue-700">
                              {editingEveningId === item.id ? (
                                <div className="flex flex-col items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="any"
                                    autoFocus 
                                    className="w-24 border-2 border-blue-400 rounded-xl p-2.5 text-center font-bold text-gray-900 focus:outline-none shadow-md" 
                                    value={editEveningCount} 
                                    onChange={(e) => setEditEveningCount(e.target.value)} 
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEvening(item.id, item.yesterday_balance, item.incoming)} 
                                  />
                                  <div className="flex gap-2 mt-1">
                                    <button onClick={() => handleSaveEvening(item.id, item.yesterday_balance, item.incoming)} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors font-bold">บันทึก</button>
                                    <button onClick={() => setEditingEveningId(null)} className="bg-gray-200 text-gray-600 text-xs px-4 py-2 rounded-lg hover:bg-gray-300 shadow-sm transition-colors font-bold">ยกเลิก</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center">
                                  {item.evening_counted === null ? (
                                    <button 
                                      onClick={() => { 
                                        setEditingEveningId(item.id); 
                                        setEditEveningCount('');
                                      }}
                                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-5 py-2.5 rounded-full transition-colors flex items-center gap-2 font-bold shadow-sm"
                                    >
                                      ✍️ ลงยอดนับ
                                    </button>
                                  ) : (
                                    <>
                                      <span className="text-3xl font-bold text-blue-700 mb-1">{eveningCounted}</span>
                                      <button 
                                        onClick={() => { 
                                          setEditingEveningId(item.id); 
                                          setEditEveningCount(String(item.evening_counted));
                                        }}
                                        className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5 font-semibold shadow-sm"
                                      >
                                        ✏️ แก้ไขยอดนับ
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                            
                            <td className="p-5 text-gray-700 font-semibold text-xl bg-gray-50/50">{usedAmount}</td>
                            
                            <td className={`p-5 font-bold text-xl bg-red-50/30 border-l border-[#fecaca] ${needsOrder ? 'text-[#df2323]' : 'text-gray-400'}`}>
                              {needsOrder ? `+${orderAmount}` : (orderAmount === '-' ? '-' : orderAmount)}
                              {needsOrder && <div className="text-[10px] bg-[#df2323] text-white px-3 py-1 rounded-full inline-block mt-2 font-bold shadow-md border border-[#c21e1e]">ต้องสั่งของ!</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

    </div>
  )
}