'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface ProductInfo {
  name: string;
  unit: string;
  hide_used: boolean | null;
  categories?: { name: string } | null;
}
interface HistoryItem {
  id: number;
  product_id: number;
  check_date: string;
  yesterday_balance: number;
  incoming: number;
  evening_counted: number | null;
  products: ProductInfo; 
}
interface MonthlySummary {
  id: number;
  name: string;
  unit: string;
  category: string;
  hide_used: boolean | null;
  total_incoming: number;
  total_used: number | string;
  latest_balance: number;
}

export default function HistoryPage() {
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')
  const [dates, setDates] = useState<Date[]>([])
  const [months, setMonths] = useState<Date[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editYest, setEditYest] = useState('')
  const [editInc, setEditInc] = useState('')
  const [editEve, setEditEve] = useState('')

  const [successModal, setSuccessModal] = useState(false)
  const today = new Date()

  const [activeCategory, setActiveCategory] = useState<string>('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  useEffect(() => {
    const tempDates = []
    for (let i = 0; i < 31; i++) { const d = new Date(); d.setDate(d.getDate() - i); tempDates.push(d) }
    setDates(tempDates); setSelectedDate(tempDates[0].toLocaleDateString('en-CA'))

    const tempMonths = []
    for (let i = 0; i < 12; i++) { const d = new Date(); d.setDate(1); d.setMonth(today.getMonth() - i); tempMonths.push(d) }
    setMonths(tempMonths); setSelectedMonth(`${tempMonths[0].getFullYear()}-${String(tempMonths[0].getMonth() + 1).padStart(2, '0')}`)
  }, [])

  const fetchHistory = async () => {
    if (viewMode === 'daily' && selectedDate) {
      const { data } = await supabase.from('daily_stock_checks').select('*, products(name, unit, hide_used, categories(name))').eq('check_date', selectedDate).order('id', { ascending: true })
      if (data) setHistoryData(data as HistoryItem[])
    } 
    else if (viewMode === 'monthly' && selectedMonth) {
      const [year, month] = selectedMonth.split('-')
      const start = `${selectedMonth}-01`
      const end = new Date(parseInt(year), parseInt(month), 0).toLocaleDateString('en-CA')
      const { data } = await supabase.from('daily_stock_checks').select('*, products(name, unit, hide_used, categories(name))').gte('check_date', start).lte('check_date', end).order('check_date', { ascending: true }) 
      if (data) setHistoryData(data as HistoryItem[])
    }
  }

  useEffect(() => { fetchHistory(); categoryRefs.current = {}; }, [viewMode, selectedDate, selectedMonth])

  const handleSaveEdit = async (id: number) => {
    try {
      const { error } = await supabase.from('daily_stock_checks').update({ yesterday_balance: editYest === '' ? 0 : parseFloat(editYest), incoming: editInc === '' ? 0 : parseFloat(editInc), evening_counted: editEve === '' ? null : parseFloat(editEve) }).eq('id', id)
      if (error) throw error
      setEditingId(null); fetchHistory(); setSuccessModal(true)
    } catch (error: any) { alert('❌ อัปเดตไม่สำเร็จ: ' + error.message) }
  }

  const getMonthlySummary = (): MonthlySummary[] => {
    const summaryMap: Record<number, MonthlySummary> = {}
    historyData.forEach(item => {
      const pid = item.product_id
      if (!summaryMap[pid]) {
        summaryMap[pid] = { id: pid, name: item.products?.name || 'ไม่ระบุ', unit: item.products?.unit || '-', category: item.products?.categories?.name || 'ไม่มีหมวดหมู่', hide_used: item.products?.hide_used || false, total_incoming: 0, total_used: 0, latest_balance: 0 }
      }
      const totalAvailable = Number((item.yesterday_balance + item.incoming).toFixed(1));
      const used = (item.evening_counted !== null && !item.products?.hide_used) ? Number((totalAvailable - item.evening_counted).toFixed(1)) : 0;
      
      summaryMap[pid].total_incoming = Number((summaryMap[pid].total_incoming + item.incoming).toFixed(1));
      if(summaryMap[pid].total_used !== '-') summaryMap[pid].total_used = Number((Number(summaryMap[pid].total_used) + used).toFixed(1));
      summaryMap[pid].latest_balance = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : summaryMap[pid].latest_balance;
    })
    return Object.values(summaryMap).map(s => ({ ...s, total_used: s.hide_used ? '-' : s.total_used }));
  }

  const monthlySummaryData = getMonthlySummary()
  const groupedDailyHistory = historyData.reduce((acc, item) => { const cat = item.products?.categories?.name || 'ไม่มีหมวดหมู่'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, HistoryItem[]>);
  const groupedMonthlySummary = monthlySummaryData.reduce((acc, item) => { const cat = item.category; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, MonthlySummary[]>);

  const categoriesList = viewMode === 'daily' ? Object.keys(groupedDailyHistory) : Object.keys(groupedMonthlySummary);

  const handleScroll = () => {
    if (!tableContainerRef.current) return;
    const container = tableContainerRef.current;
    const scrollPosition = container.scrollTop + 60; 

    let currentActive = '';
    for (const cat of categoriesList) {
      const el = categoryRefs.current[cat];
      if (el && el.offsetTop <= scrollPosition) currentActive = cat;
    }
    
    if (currentActive && currentActive !== activeCategory) setActiveCategory(currentActive);
  };

  const scrollToCategory = (cat: string) => {
    const el = categoryRefs.current[cat];
    if (el && tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: el.offsetTop - 50, behavior: 'smooth' });
      setActiveCategory(cat);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">ประวัติการทำรายการ</h1>
          <div className="bg-white px-4 sm:px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit">{today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        <div className="flex bg-gray-200/80 rounded-full p-1 shadow-inner w-fit">
          <button onClick={() => setViewMode('daily')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'daily' ? 'bg-white text-[#df2323] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📅 ดูตามวัน</button>
          <button onClick={() => setViewMode('monthly')} className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'monthly' ? 'bg-white text-[#df2323] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🗓️ สรุปรายเดือน</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-3">
          {viewMode === 'daily' ? (
            dates.map((d, idx) => {
              const dateStr = d.toLocaleDateString('en-CA')
              return <button key={idx} onClick={() => setSelectedDate(dateStr)} className={`flex-shrink-0 px-5 py-2.5 rounded-xl border font-semibold transition-all ${selectedDate === dateStr ? 'border-[#df2323] text-[#df2323] bg-[#fef2f2] shadow-sm' : 'border-gray-200 text-gray-500'}`}>{d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</button>
            })
          ) : (
            months.map((d, idx) => {
              const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              return <button key={idx} onClick={() => setSelectedMonth(monthStr)} className={`flex-shrink-0 px-6 py-2.5 rounded-xl border font-bold transition-all ${selectedMonth === monthStr ? 'border-[#df2323] text-[#df2323] bg-[#fef2f2] shadow-sm' : 'border-gray-200 text-gray-500'}`}>{d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</button>
            })
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[70vh] min-h-[500px]">
        
        <div className="bg-white border-b border-gray-100 flex overflow-x-auto custom-scrollbar flex-shrink-0 relative z-20 shadow-sm p-2 gap-2 px-4 items-center">
          {categoriesList.map(cat => (
            <button 
              key={cat}
              onClick={() => scrollToCategory(cat)}
              className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-all border border-transparent ${activeCategory === cat ? 'bg-[#df2323] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div 
          ref={tableContainerRef}
          onScroll={handleScroll}
          className="overflow-auto flex-1 custom-scrollbar relative bg-gray-50/30 scroll-smooth"
        >
          {viewMode === 'daily' ? (
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="text-sm border-b border-gray-200 bg-white">
                  {/* 🔴 เพิ่ม min-w-[140px] เพื่อไม่ให้คอลัมน์แรกโดนบีบในมือถือ */}
                  <th className="p-4 font-bold text-gray-700 text-left sticky left-0 z-30 bg-white border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] sm:min-w-[200px]">รายการสินค้า (หน่วย)</th>
                  <th className="p-4 font-bold text-yellow-700 bg-yellow-50/90">เหลือเมื่อวาน</th>
                  <th className="p-4 font-bold text-yellow-700 bg-yellow-50/90">รับเข้า</th>
                  <th className="p-4 font-bold text-yellow-800 bg-yellow-100/90">รวมมีของ</th>
                  <th className="p-4 font-bold text-blue-700 bg-blue-50/90">นับได้ตอนเย็น</th>
                  <th className="p-4 font-bold text-gray-700 bg-white">ถูกใช้ไป</th>
                  <th className="p-4 font-bold text-[#df2323] bg-white">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {historyData.length === 0 ? (<tr><td colSpan={7} className="p-12 text-gray-400">ไม่มีข้อมูลบันทึกในวันที่เลือก</td></tr>) : (
                  Object.entries(groupedDailyHistory).map(([category, items]) => (
                    <React.Fragment key={category}>
                      <tr 
                        ref={(el) => { categoryRefs.current[category] = el; }} 
                        className="bg-gray-100 border-y border-gray-200"
                      >
                        {/* 🔴 เพิ่ม whitespace-nowrap เพื่อไม่ให้หมวดหมู่ตัดขึ้นบรรทัดใหม่ */}
                        <td className="p-3 pl-6 text-left font-bold text-gray-800 text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                          📂 {category}
                        </td>
                        <td colSpan={6} className="bg-gray-100"></td>
                      </tr>
                      {items.map((item, index) => {
                        const total = Number((item.yesterday_balance + item.incoming).toFixed(1));
                        const eveningCounted = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : '-';
                        const used = (item.evening_counted !== null && !item.products?.hide_used) ? Number((total - item.evening_counted).toFixed(1)) : '-';
                        const isEditing = editingId === item.id

                        return (
                          <tr 
                            key={item.id} 
                            ref={(el) => { if(index === 0) categoryRefs.current[category] = el; }}
                            className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors group"
                          >
                            <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                              <div className="font-bold text-gray-800 text-[15px]">{item.products?.name}</div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                  {item.products?.unit}
                                </span>
                                {item.products?.hide_used && (
                                  <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 shadow-sm">
                                    🚫 ซ่อนยอด
                                  </span>
                                )}
                              </div>
                            </td>
                            {isEditing ? (
                              <>
                                <td className="p-2"><input type="number" step="any" className="w-20 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editYest} onChange={e => setEditYest(e.target.value)} /></td>
                                <td className="p-2"><input type="number" step="any" className="w-20 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editInc} onChange={e => setEditInc(e.target.value)} /></td>
                                <td className="p-4 font-bold text-xl text-yellow-800 bg-yellow-50">{total}</td>
                                <td className="p-2"><input type="number" step="any" className="w-20 border-2 border-blue-400 rounded-lg p-2 text-center font-bold" value={editEve} onChange={e => setEditEve(e.target.value)} /></td>
                              </>
                            ) : (
                              <>
                                <td className="p-4 text-yellow-700 font-semibold">{item.yesterday_balance}</td>
                                <td className="p-4 text-yellow-700 font-semibold">{item.incoming}</td>
                                <td className="p-4 text-yellow-900 font-bold text-lg bg-yellow-50/30">{total}</td>
                                <td className="p-4 text-blue-600 font-bold text-lg">{eveningCounted}</td>
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
                                <button onClick={() => { setEditingId(item.id); setEditYest(String(item.yesterday_balance)); setEditInc(String(item.incoming)); setEditEve(item.evening_counted !== null ? String(item.evening_counted) : '') }} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs px-4 py-2 rounded-full font-semibold shadow-sm transition-colors">✏️ แก้ไข</button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 z-20 shadow-sm">
                <tr className="text-sm border-b border-gray-200 bg-white">
                  {/* 🔴 เพิ่ม min-w-[140px] สำหรับตารางรายเดือน */}
                  <th className="p-5 font-bold text-gray-700 text-left sticky left-0 z-30 bg-white border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] sm:min-w-[200px]">รายการสินค้า</th>
                  <th className="p-5 font-bold text-[#059669] bg-green-50/90">รับเข้าทั้งหมด (เดือนนี้)</th>
                  <th className="p-5 font-bold text-[#df2323] bg-red-50/90">ถูกใช้ไปทั้งหมด (เดือนนี้)</th>
                  <th className="p-5 font-bold text-[#2563eb] bg-blue-50/90">ยอดคงเหลือล่าสุด</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {monthlySummaryData.length === 0 ? (<tr><td colSpan={4} className="p-12 text-gray-400">ไม่มีความเคลื่อนไหวสต๊อกในเดือนที่เลือก</td></tr>) : (
                  Object.entries(groupedMonthlySummary).map(([category, items]) => (
                    <React.Fragment key={category}>
                      <tr 
                        ref={(el) => { categoryRefs.current[category] = el; }} 
                        className="bg-gray-100 border-y border-gray-200"
                      >
                        <td className="p-3 pl-6 text-left font-bold text-gray-800 text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                          📂 {category}
                        </td>
                        <td colSpan={3} className="bg-gray-100"></td>
                      </tr>
                      
                      {items.map((item, index) => (
                        <tr 
                          key={index} 
                          ref={(el) => { if(index === 0) categoryRefs.current[category] = el; }}
                          className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors group"
                        >
                          <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                            <div className="font-bold text-gray-800 text-[15px]">{item.name}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                                {item.unit}
                              </span>
                              {item.hide_used && (
                                <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 shadow-sm">
                                  🚫 ซ่อนยอด
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-5 text-[#059669] font-bold text-lg bg-green-50/30">+{item.total_incoming}</td>
                          <td className="p-5 text-[#df2323] font-bold text-lg bg-red-50/30">{item.total_used !== '-' ? `-${item.total_used}` : '-'}</td>
                          <td className="p-5 text-[#2563eb] font-bold text-xl bg-blue-50/30">{item.latest_balance}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">สำเร็จ!</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">อัปเดตข้อมูลย้อนหลังเรียบร้อยแล้ว</p>
            <button onClick={() => setSuccessModal(false)} className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">ตกลง</button>
          </div>
        </div>
      )}
    </div>
  )
}