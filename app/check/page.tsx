'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../context/BranchContext' // 🔴 เรียกใช้ Context

interface Product { id: number; name: string; unit: string; min_limit: number | null; max_limit: number | null; hide_used: boolean | null; raw_material_id: number | null; categories?: { name: string } | null; }
interface DailyCheck { id: number; product_id: number; check_date: string; yesterday_balance: number; incoming: number; evening_counted: number | null; }

export default function DailyCheckPage() {
  const { currentBranch } = useBranch() // 🔴 ดึงสาขาปัจจุบัน

  const [products, setProducts] = useState<Product[]>([])
  const [todayChecks, setTodayChecks] = useState<DailyCheck[]>([])
  const [latestPastChecks, setLatestPastChecks] = useState<Record<number, DailyCheck>>({})
  
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedProductName, setSelectedProductName] = useState('')
  const [yesterdayBalance, setYesterdayBalance] = useState('')
  const [incoming, setIncoming] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [editingIncomingId, setEditingIncomingId] = useState<number | null>(null)
  const [editIncomingCount, setEditIncomingCount] = useState<string>('') 
  const [editingEveningId, setEditingEveningId] = useState<number | null>(null)
  const [editEveningCount, setEditEveningCount] = useState<string>('')

  const [activeCategory, setActiveCategory] = useState<string>('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const today = new Date()
  const todayForDB = today.toLocaleDateString('en-CA')

  const fetchData = async () => {
    if (!currentBranch) return; // 🔴 ป้องกันโหลดผิดสาขา
    // 🔴 แนบ eq('branch_id') ทุกๆ ข้อมูลที่ดึง
    const { data: pData } = await supabase.from('products').select('*, categories(name)').eq('branch_id', currentBranch.id).order('id', { ascending: true })
    if (pData) setProducts(pData as Product[])

    const { data: tData } = await supabase.from('daily_stock_checks').select('*').eq('check_date', todayForDB).eq('branch_id', currentBranch.id)
    if (tData) setTodayChecks(tData as DailyCheck[])

    const { data: pastData } = await supabase.from('daily_stock_checks').select('*').lt('check_date', todayForDB).eq('branch_id', currentBranch.id).order('check_date', { ascending: false }).limit(3000)
    const latestMap: Record<number, DailyCheck> = {}
    if (pastData) { pastData.forEach((check: any) => { if (!latestMap[check.product_id]) latestMap[check.product_id] = check as DailyCheck }) }
    setLatestPastChecks(latestMap)
  }

  // 🔴 โหลดใหม่เมื่อเปลี่ยนสาขา
  useEffect(() => { if (currentBranch) fetchData() }, [currentBranch])

  const tableRows = products.map(product => {
    const tCheck = todayChecks.find(c => c.product_id === product.id)
    const latestCheck = latestPastChecks[product.id]
    let defaultLatestBalance = 0;
    if (latestCheck) { if (latestCheck.evening_counted !== null) defaultLatestBalance = latestCheck.evening_counted; else defaultLatestBalance = latestCheck.yesterday_balance + latestCheck.incoming; }

    return { id: product.id, name: product.name, categoryName: product.categories?.name || 'ไม่มีหมวดหมู่', unit: product.unit, min_limit: product.min_limit, max_limit: product.max_limit, hide_used: product.hide_used, raw_material_id: product.raw_material_id, check_id: tCheck?.id || null, yesterday_balance: tCheck ? tCheck.yesterday_balance : defaultLatestBalance, incoming: tCheck ? tCheck.incoming : 0, evening_counted: tCheck ? tCheck.evening_counted : null, }
  })

  const groupedRows = tableRows.reduce((acc, row) => { const cat = row.categoryName; if (!acc[cat]) acc[cat] = []; acc[cat].push(row); return acc; }, {} as Record<string, typeof tableRows>);
  const categoriesList = Object.keys(groupedRows);

  const handleScroll = () => { if (!tableContainerRef.current) return; const container = tableContainerRef.current; const scrollPosition = container.scrollTop + 80; let currentActive = ''; for (const cat of categoriesList) { const el = categoryRefs.current[cat]; if (el && el.offsetTop <= scrollPosition) { currentActive = cat; } } if (currentActive && currentActive !== activeCategory) { setActiveCategory(currentActive); } };
  const scrollToCategory = (cat: string) => { const el = categoryRefs.current[cat]; if (el && tableContainerRef.current) { tableContainerRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 75), behavior: 'smooth' }); setActiveCategory(cat); } };

  const handleSelectProductFromModal = (id: number, name: string) => { setSelectedProductId(String(id)); setSelectedProductName(name); setIsModalOpen(false); setSearchQuery(''); const row = tableRows.find(r => r.id === id); if (row) { setYesterdayBalance(String(row.yesterday_balance)); setIncoming(String(row.incoming === 0 ? '' : row.incoming)) } }

  const handleMorningSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) return alert('กรุณาเลือกสินค้า')
    if (!currentBranch) return alert('ไม่พบข้อมูลสาขา')
    setIsSubmitting(true)
    try {
      // 🔴 แนบ branch_id ไปตอนบันทึกด้วย
      const { error } = await supabase.from('daily_stock_checks').upsert({ product_id: parseInt(selectedProductId), check_date: todayForDB, yesterday_balance: yesterdayBalance ? parseFloat(yesterdayBalance) : 0, incoming: incoming ? parseFloat(incoming) : 0, branch_id: currentBranch.id }, { onConflict: 'check_date, product_id' })
      if (error) throw error
      setSelectedProductId(''); setSelectedProductName(''); setYesterdayBalance(''); setIncoming('')
      fetchData()
    } catch (error: any) { alert('❌ บันทึกไม่สำเร็จ: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const handleSaveIncoming = async (productId: number, currentYestBal: number, currentEvening: number | null) => {
    if (!currentBranch) return;
    try {
      const { error } = await supabase.from('daily_stock_checks').upsert({ product_id: productId, check_date: todayForDB, yesterday_balance: currentYestBal, incoming: editIncomingCount === '' ? 0 : parseFloat(editIncomingCount), evening_counted: currentEvening, branch_id: currentBranch.id }, { onConflict: 'check_date, product_id' })
      if (error) throw error; setEditingIncomingId(null); fetchData()
    } catch (error: any) { alert('❌ อัปเดตไม่สำเร็จ: ' + error.message) }
  }

  const handleSaveEvening = async (productId: number, currentYestBal: number, currentInc: number) => {
    if (!currentBranch) return;
    try {
      const { error } = await supabase.from('daily_stock_checks').upsert({ product_id: productId, check_date: todayForDB, yesterday_balance: currentYestBal, incoming: currentInc, evening_counted: editEveningCount === '' ? null : parseFloat(editEveningCount), branch_id: currentBranch.id }, { onConflict: 'check_date, product_id' })
      if (error) throw error; setEditingEveningId(null); fetchData()
    } catch (error: any) { alert('❌ อัปเดตไม่สำเร็จ: ' + error.message) }
  }

  const filteredModalProducts = tableRows.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) );
  const groupedModalProducts = filteredModalProducts.reduce((acc, row) => { const cat = row.categoryName; if (!acc[cat]) acc[cat] = []; acc[cat].push(row); return acc; }, {} as Record<string, typeof tableRows>);

  if (!currentBranch) return <div className="p-8 text-center text-gray-500">กำลังโหลดสาขา...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">เช็คสต๊อกรายวัน <span className="text-gray-500 text-lg ml-2">({currentBranch.name})</span></h1>
          <div className="bg-white px-4 sm:px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit">{today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="bg-[#facc15] p-3 sm:p-4 px-4 sm:px-8 text-white font-bold flex items-center gap-2 sm:gap-3 border-b border-[#eab308]">
            <span className="text-xl sm:text-2xl">☀️</span> <span className="text-sm sm:text-base">บันทึกยอดตอนเช้า (เปิดร้าน / รับของเข้า)</span>
          </div>
          <form onSubmit={handleMorningSubmit} className="p-4 sm:p-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-4 sm:gap-6">
            <div className="flex-1 min-w-full sm:min-w-[250px]"><label className="block text-sm font-semibold text-gray-700 mb-1.5">เลือกสินค้า</label><div onClick={() => setIsModalOpen(true)} className="w-full border border-gray-200 rounded-xl p-3 sm:p-3.5 focus:outline-none focus:border-[#facc15] bg-white shadow-inner transition-colors text-sm sm:text-base cursor-pointer flex justify-between items-center"><span className={selectedProductName ? 'text-gray-900 font-bold' : 'text-gray-400'}>{selectedProductName ? `🛒 ${selectedProductName}` : '-- คลิกเพื่อเลือกสินค้า --'}</span><span className="text-gray-400">🔍</span></div></div>
            <div className="w-full sm:w-40"><label className="block text-sm font-semibold text-gray-700 mb-1.5">ยอดเหลือล่าสุด</label><input type="number" step="any" value={yesterdayBalance} onChange={(e) => setYesterdayBalance(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 sm:p-3.5 focus:outline-none focus:border-[#facc15] shadow-inner transition-colors bg-gray-50 text-sm sm:text-base" placeholder="0" /></div>
            <div className="w-full sm:w-40"><label className="block text-sm font-semibold text-gray-700 mb-1.5">ของเข้าวันนี้</label><input type="number" step="any" required value={incoming} onChange={(e) => setIncoming(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 sm:p-3.5 focus:outline-none focus:border-[#facc15] shadow-inner transition-colors text-sm sm:text-base" placeholder="รับมา" /></div>
            <button type="submit" disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[50px] sm:h-[58px] w-full sm:w-auto flex-shrink-0">{isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตาราง'}</button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[75vh] min-h-[500px]">
          <div className="bg-[#2563eb] p-4 px-8 text-white font-bold flex items-center justify-between gap-3 flex-shrink-0 relative z-20"><div className="flex items-center gap-3"><span className="text-2xl">🌙</span> ตารางเช็คของตอนเย็น (ปิดร้าน)</div><div className="text-sm bg-[#1d4ed8] px-4 py-1.5 rounded-full shadow-inner font-medium">{tableRows.length} รายการ</div></div>
          <div className="bg-white border-b border-gray-100 flex overflow-x-auto custom-scrollbar flex-shrink-0 relative z-20 shadow-sm p-2 gap-2 px-4 items-center">
            {categoriesList.map(cat => (<button key={cat} onClick={() => scrollToCategory(cat)} className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-all border border-transparent ${activeCategory === cat ? 'bg-[#2563eb] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}>{cat}</button>))}
          </div>

          <div ref={tableContainerRef} onScroll={handleScroll} className="overflow-auto flex-1 custom-scrollbar relative bg-gray-50/30 scroll-smooth">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 z-30 bg-white shadow-sm"><tr className="text-sm border-b border-gray-200"><th className="p-4 text-left font-bold text-gray-700 sticky left-0 top-0 z-40 bg-white border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] sm:min-w-[200px] whitespace-nowrap">รายการสินค้า (หน่วย)</th><th className="p-4 bg-yellow-50 text-[#854d0e] border-x border-yellow-100 whitespace-nowrap">ยอดเหลือล่าสุด</th><th className="p-4 bg-yellow-50 text-[#854d0e] border-r border-yellow-100 whitespace-nowrap">รับเข้าวันนี้</th><th className="p-4 bg-yellow-100 text-[#854d0e] font-bold border-r border-yellow-200 whitespace-nowrap">รวมมีของ</th><th className="p-4 bg-blue-50 text-blue-700 font-bold border-r border-blue-100 w-48 whitespace-nowrap">นับได้ตอนเย็น</th><th className="p-4 bg-white text-gray-600 border-r border-gray-200 whitespace-nowrap">ถูกใช้ไป</th><th className="p-4 bg-red-50 text-[#df2323] font-bold border-l border-red-100 whitespace-nowrap">ต้องสั่งเพิ่ม</th></tr></thead>
              <tbody className="bg-white">
                {tableRows.length === 0 ? (<tr><td colSpan={7} className="p-16 text-gray-400">ยังไม่มีรายการสินค้าในระบบ</td></tr>) : (
                  Object.entries(groupedRows).map(([category, items]) => (
                    <React.Fragment key={category}>
                      <tr ref={(el) => { categoryRefs.current[category] = el; }} className="bg-gray-100 border-y border-gray-200"><td className="p-3 pl-6 text-left font-bold text-gray-800 text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">📂 {category}</td><td colSpan={6} className="bg-gray-100"></td></tr>
                      {items.map((item) => {
                        const totalAvailable = Number((item.yesterday_balance + item.incoming).toFixed(1));
                        const eveningCounted = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : '-';
                        const usedAmount = (item.evening_counted !== null && !item.hide_used) ? Number((totalAvailable - item.evening_counted).toFixed(1)) : '-';
                        let totalCombinedStock = item.evening_counted !== null ? item.evening_counted : totalAvailable;
                        let hasLinkedItems = false;
                        const linkedItems = tableRows.filter(r => r.raw_material_id === item.id);
                        if (linkedItems.length > 0) { hasLinkedItems = true; linkedItems.forEach(linked => { const linkedStock = linked.evening_counted !== null ? linked.evening_counted : (linked.yesterday_balance + linked.incoming); totalCombinedStock += linkedStock; }); }
                        let orderAmount: number | string = '-'; let needsOrder = false;
                        if (item.evening_counted !== null && item.min_limit !== null && item.max_limit !== null) { if (totalCombinedStock <= item.min_limit) { orderAmount = Number((item.max_limit - totalCombinedStock).toFixed(1)); needsOrder = orderAmount > 0; } else { orderAmount = 0; } }

                        return (
                          <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors group">
                            <td className="p-4 text-left font-semibold text-gray-800 bg-white group-hover:bg-gray-50/80 sticky left-0 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors whitespace-nowrap"><div className="text-[15px]">{item.name}</div><div className="text-[11px] text-gray-500 font-normal mt-1.5 flex gap-2"><span>Max: {item.max_limit !== null ? Number(item.max_limit.toFixed(1)) : '-'}</span><span>Min: {item.min_limit !== null ? Number(item.min_limit.toFixed(1)) : '-'}</span></div></td>
                            <td className="p-4 text-yellow-900 font-semibold bg-yellow-50/30">{Number(item.yesterday_balance.toFixed(1))}</td>
                            <td className="p-4 text-yellow-900 font-semibold bg-yellow-50/30">
                              {editingIncomingId === item.id ? (<div className="flex flex-col items-center gap-2"><input type="number" step="any" autoFocus className="w-20 border-2 border-[#facc15] rounded-xl p-2 text-center font-bold text-gray-900 focus:outline-none shadow-sm" value={editIncomingCount} onChange={(e) => setEditIncomingCount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveIncoming(item.id, item.yesterday_balance, item.evening_counted)} /><div className="flex gap-1"><button onClick={() => handleSaveIncoming(item.id, item.yesterday_balance, item.evening_counted)} className="bg-yellow-600 text-white text-[11px] px-2 py-1 rounded-md font-bold">บันทึก</button><button onClick={() => setEditingIncomingId(null)} className="bg-yellow-100 text-yellow-800 text-[11px] px-2 py-1 rounded-md font-bold">ยกเลิก</button></div></div>) : (<div className="flex flex-col items-center justify-center"><span className="text-lg">+{item.incoming}</span><button onClick={() => { setEditingIncomingId(item.id); setEditIncomingCount(String(item.incoming)); }} className="mt-1 bg-white border border-yellow-300 text-yellow-700 hover:bg-yellow-100 text-[10px] px-3 py-1 rounded-full transition-colors flex items-center gap-1 font-semibold shadow-sm">✏️ แก้ไข</button></div>)}
                            </td>
                            <td className="p-4 text-yellow-950 font-bold text-xl bg-yellow-100/40">{totalAvailable}</td>
                            <td className="p-4 bg-blue-50/20 text-blue-700">
                              {editingEveningId === item.id ? (<div className="flex flex-col items-center gap-2"><input type="number" step="any" autoFocus className="w-24 border-2 border-blue-400 rounded-xl p-2.5 text-center font-bold text-gray-900 focus:outline-none shadow-md" value={editEveningCount} onChange={(e) => setEditEveningCount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveEvening(item.id, item.yesterday_balance, item.incoming)} /><div className="flex gap-2 mt-1"><button onClick={() => handleSaveEvening(item.id, item.yesterday_balance, item.incoming)} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-bold">บันทึก</button><button onClick={() => setEditingEveningId(null)} className="bg-gray-200 text-gray-600 text-xs px-4 py-2 rounded-lg font-bold">ยกเลิก</button></div></div>) : (<div className="flex flex-col items-center justify-center">{item.evening_counted === null ? (<button onClick={() => { setEditingEveningId(item.id); setEditEveningCount(''); }} className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-5 py-2 rounded-full transition-colors flex items-center gap-2 font-bold shadow-sm">✍️ ลงยอดนับ</button>) : (<><span className="text-3xl font-bold text-blue-700 mb-1">{eveningCounted}</span><button onClick={() => { setEditingEveningId(item.id); setEditEveningCount(String(item.evening_counted)); }} className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-[11px] px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 font-semibold shadow-sm">✏️ แก้ไขยอด</button></>)}</div>)}
                            </td>
                            <td className="p-4 text-gray-700 font-semibold text-xl">{usedAmount}</td>
                            <td className={`p-4 font-bold text-xl bg-red-50/20 border-l border-[#fecaca] ${needsOrder ? 'text-[#df2323]' : 'text-gray-400'}`}>
                              {needsOrder ? `+${orderAmount}` : (orderAmount === '-' ? '-' : orderAmount)}
                              {needsOrder && <div className="text-[10px] bg-[#df2323] text-white px-3 py-1 rounded-full inline-block mt-2 font-bold shadow-md border border-[#c21e1e]">ต้องสั่งของ!</div>}
                              {hasLinkedItems && item.evening_counted !== null && (<div className="text-[10px] text-gray-500 font-medium mt-1 leading-tight">รวมยอดของเตรียมแล้ว<br/>({Number(totalCombinedStock.toFixed(1))} {item.unit})</div>)}
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

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className="bg-[#f8f9fa] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"><div className="bg-[#4f46e5] p-5 px-6 flex justify-between items-center text-white flex-shrink-0"><h2 className="text-xl font-bold flex items-center gap-2">📦 เลือกรายการสินค้า</h2><button onClick={() => setIsModalOpen(false)} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button></div><div className="p-4 bg-white border-b border-gray-200 flex-shrink-0"><div className="relative"><span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">🔍</span><input type="text" placeholder="ค้นหารายการสินค้า, หมวดหมู่..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#4f46e5] text-gray-700 font-medium" autoFocus /></div></div><div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Object.keys(groupedModalProducts).length === 0 ? (<div className="col-span-full py-12 text-center text-gray-400 font-bold">ไม่พบสินค้าที่คุณค้นหา</div>) : (Object.entries(groupedModalProducts).map(([category, items]) => (<div key={category} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-fit"><div className="bg-gray-50 border-b border-gray-200 px-4 py-3 font-bold text-gray-700 text-sm flex items-center gap-2"><span className="text-[#4f46e5]">📚</span> หมวดหมู่: {category}</div><div className="p-2 flex flex-col gap-1">{items.map(item => (<button key={item.id} onClick={() => handleSelectProductFromModal(item.id, item.name)} className="flex justify-between items-center w-full px-4 py-3 rounded-xl hover:bg-indigo-50 transition-colors group text-left"><span className="font-bold text-gray-800 group-hover:text-indigo-700">{item.name}</span><span className="bg-[#4f46e5] text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-sm group-hover:bg-indigo-600 transition-colors">เลือก</span></button>))}</div></div>)))}</div></div></div></div>
        )}
    </div>
  )
}