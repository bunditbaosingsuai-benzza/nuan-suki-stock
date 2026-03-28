'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../context/BranchContext'

interface ProductInfo { name: string; unit: string; hide_used: boolean | null; min_limit: number | null; max_limit: number | null; raw_material_id: number | null; categories?: { name: string } | null; }
interface HistoryItem { id: number; product_id: number; check_date: string; yesterday_balance: number; incoming: number; evening_counted: number | null; products: ProductInfo; }

export default function HistoryPage() {
  const { currentBranch } = useBranch()

  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editYest, setEditYest] = useState('')
  const [editInc, setEditInc] = useState('')
  const [editEve, setEditEve] = useState('')
  const [successModal, setSuccessModal] = useState(false)
  
  const [activeCategory, setActiveCategory] = useState<string>('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const fetchHistory = async () => {
    if (!currentBranch || !selectedDate) return;
    const { data } = await supabase
      .from('daily_stock_checks')
      .select('*, products(name, unit, hide_used, min_limit, max_limit, raw_material_id, categories(name))')
      .eq('check_date', selectedDate)
      .eq('branch_id', currentBranch.id)
      .order('id', { ascending: true })
      
    if (data) setHistoryData(data as HistoryItem[])
  }

  useEffect(() => { 
    if(currentBranch) fetchHistory(); 
    categoryRefs.current = {}; 
  }, [selectedDate, currentBranch])

  const handleSaveEdit = async (id: number) => {
    try {
      const itemToEdit = historyData.find(item => item.id === id);
      if (!itemToEdit || !currentBranch) return;

      const newYest = editYest === '' ? 0 : parseFloat(editYest);
      const newInc = editInc === '' ? 0 : parseFloat(editInc);
      const newEve = editEve === '' ? null : parseFloat(editEve);

      const { error } = await supabase.from('daily_stock_checks').update({ 
        yesterday_balance: newYest, 
        incoming: newInc, 
        evening_counted: newEve 
      }).eq('id', id)
      
      if (error) throw error

      if (newEve !== null) {
        const parts = itemToEdit.check_date.split('-');
        const currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        currentDate.setDate(currentDate.getDate() + 1);
        const nextDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

        await supabase.from('daily_stock_checks').update({
          yesterday_balance: newEve
        })
        .eq('product_id', itemToEdit.product_id)
        .eq('branch_id', currentBranch.id)
        .eq('check_date', nextDateStr);
      }

      setEditingId(null); 
      fetchHistory(); 
      setSuccessModal(true);
    } catch (error: any) { alert('❌ อัปเดตไม่สำเร็จ: ' + error.message) }
  }

  const groupedDailyHistory = historyData.reduce((acc, item) => { const cat = item.products?.categories?.name || 'ไม่มีหมวดหมู่'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, HistoryItem[]>);
  const categoriesList = Object.keys(groupedDailyHistory);

  const handleScroll = () => { if (!tableContainerRef.current) return; const scrollPosition = tableContainerRef.current.scrollTop + 80; let currentActive = ''; for (const cat of categoriesList) { const el = categoryRefs.current[cat]; if (el && el.offsetTop <= scrollPosition) currentActive = cat; } if (currentActive && currentActive !== activeCategory) setActiveCategory(currentActive); };
  const scrollToCategory = (cat: string) => { const el = categoryRefs.current[cat]; if (el && tableContainerRef.current) { tableContainerRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 75), behavior: 'smooth' }); setActiveCategory(cat); } };

  if (!currentBranch) return <div className="p-8 text-center text-gray-500">กำลังโหลดสาขา...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">
          ประวัติการทำรายการ <span className="text-gray-500 text-lg ml-2">({currentBranch.name})</span>
        </h1>
        <div className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 transition-colors focus-within:border-[#df2323] focus-within:ring-1 focus-within:ring-[#df2323] w-fit">
          <span className="text-gray-500">📅</span>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-sm font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[75vh] min-h-[500px]">
        <div className="bg-white border-b border-gray-100 flex overflow-x-auto custom-scrollbar flex-shrink-0 relative z-20 shadow-sm p-2 gap-2 px-4 items-center">
          {categoriesList.map(cat => (<button key={cat} onClick={() => scrollToCategory(cat)} className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-all border border-transparent ${activeCategory === cat ? 'bg-[#df2323] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}>{cat}</button>))}
        </div>

        <div ref={tableContainerRef} onScroll={handleScroll} className="overflow-auto flex-1 custom-scrollbar scroll-smooth bg-gray-50/30">
          <table className="w-full text-center border-collapse">
            <thead className="sticky top-0 z-30 shadow-sm">
              <tr className="text-sm border-b border-gray-200">
                <th className="p-3 bg-white sticky left-0 z-40 border-r border-gray-200 min-w-[140px] sm:min-w-[200px]"></th>
                <th colSpan={3} className="p-3 font-bold text-white bg-[#eab308] text-center border-r border-yellow-500 shadow-inner">☀️ รอบเช้า (เตรียมของ)</th>
                <th colSpan={1} className="p-3 font-bold text-white bg-[#3b82f6] text-center border-r border-blue-500 shadow-inner">🌙 รอบเย็น (นับของ)</th>
                <th colSpan={2} className="p-3 font-bold text-[#065f46] bg-[#d1fae5] text-center border-r border-green-200 shadow-inner">📊 สรุปยอด</th>
                <th className="p-3 bg-white"></th>
              </tr>
              <tr className="text-sm border-b border-gray-200">
                <th className="p-4 font-bold text-gray-700 text-left sticky left-0 z-40 bg-white border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">รายการสินค้า (หน่วย)</th>
                <th className="p-4 font-bold text-yellow-800 bg-[#fef08a] border-r border-yellow-200/50 whitespace-nowrap">เหลือเมื่อวาน</th>
                <th className="p-4 font-bold text-yellow-800 bg-[#fef08a] border-r border-yellow-200/50 whitespace-nowrap">รับเข้า</th>
                <th className="p-4 font-bold text-white bg-[#eab308] border-r border-yellow-500 whitespace-nowrap">รวมมีของ</th>
                <th className="p-4 font-bold text-blue-700 bg-[#dbeafe] border-r border-blue-200/50 whitespace-nowrap">นับได้ตอนเย็น</th>
                <th className="p-4 font-bold text-gray-700 bg-gray-50 border-r border-gray-200 whitespace-nowrap">ถูกใช้ไป</th>
                <th className="p-4 font-bold text-[#df2323] bg-red-50 border-r border-red-100 whitespace-nowrap">ต้องสั่งเพิ่ม</th>
                <th className="p-4 font-bold text-gray-700 bg-white whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {historyData.length === 0 ? (<tr><td colSpan={8} className="p-12 text-gray-400">ไม่มีข้อมูลบันทึกในวันที่เลือก</td></tr>) : (
                Object.entries(groupedDailyHistory).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr ref={(el) => { categoryRefs.current[category] = el; }} className="bg-gray-100 border-y border-gray-200"><td className="p-3 pl-6 text-left font-bold text-gray-800 text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">📂 {category}</td><td colSpan={7} className="bg-gray-100"></td></tr>
                    {items.map((item, index) => {
                      const total = Number((item.yesterday_balance + item.incoming).toFixed(1));
                      const eveningCounted = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : '-';
                      const used = (item.evening_counted !== null && !item.products?.hide_used) ? Number((total - item.evening_counted).toFixed(1)) : '-';
                      const isEditing = editingId === item.id

                      let totalCombinedStock = item.evening_counted !== null ? item.evening_counted : total;
                      let hasLinkedItems = false;

                      const linkedItems = historyData.filter(r => r.products?.raw_material_id === item.product_id);
                      if (linkedItems.length > 0) {
                        hasLinkedItems = true;
                        linkedItems.forEach(linked => {
                          const linkedStock = linked.evening_counted !== null ? linked.evening_counted : (linked.yesterday_balance + linked.incoming);
                          totalCombinedStock += linkedStock;
                        });
                      }

                      // 🔴 ปัดเศษขึ้นเป็นจำนวนเต็มทุกกรณี (Math.ceil)
                      let orderAmount: number | string = '-'; 
                      let needsOrder = false;
                      if (item.evening_counted !== null && item.products?.min_limit !== null && item.products?.max_limit !== null) {
                        if (totalCombinedStock <= item.products.min_limit) { 
                          orderAmount = Math.ceil(item.products.max_limit - totalCombinedStock);
                          needsOrder = orderAmount > 0; 
                        } else { orderAmount = 0; }
                      }

                      return (
                        <tr key={item.id} ref={(el) => { if(index === 0) categoryRefs.current[category] = el; }} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors group">
                          <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors whitespace-nowrap">
                            <div className="font-bold text-gray-800 text-[15px]">{item.products?.name}</div>
                            <div className="text-[11px] text-gray-500 mt-1 flex gap-2"><span>Min: {item.products?.min_limit || '-'}</span><span>Max: {item.products?.max_limit || '-'}</span></div>
                          </td>
                          {isEditing ? (
                            <>
                              <td className="p-2 bg-[#fefce8]"><input type="number" step="any" className="w-16 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editYest} onChange={e => setEditYest(e.target.value)} /></td>
                              <td className="p-2 bg-[#fefce8]"><input type="number" step="any" className="w-16 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editInc} onChange={e => setEditInc(e.target.value)} /></td>
                              <td className="p-4 font-bold text-xl text-white bg-[#eab308]">{total}</td>
                              <td className="p-2 bg-[#eff6ff]"><input type="number" step="any" className="w-16 border-2 border-blue-400 rounded-lg p-2 text-center font-bold" value={editEve} onChange={e => setEditEve(e.target.value)} /></td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 text-yellow-700 font-semibold bg-[#fefce8]">{item.yesterday_balance}</td>
                              <td className="p-4 text-yellow-700 font-semibold bg-[#fefce8]">{item.incoming}</td>
                              <td className="p-4 text-white font-bold text-lg bg-[#eab308]">{total}</td>
                              <td className="p-4 text-blue-600 font-bold text-lg bg-[#eff6ff]">{eveningCounted}</td>
                            </>
                          )}
                          <td className="p-4 text-gray-600 font-semibold">{used}</td>
                          <td className={`p-4 font-bold text-lg bg-red-50/20 ${needsOrder ? 'text-[#df2323]' : 'text-gray-400'}`}>
                            {needsOrder ? `+${orderAmount}` : (orderAmount === '-' ? '-' : 'พอขาย')}
                            {needsOrder && <div className="text-[10px] bg-[#df2323] text-white px-3 py-1 rounded-full inline-block mt-2 font-bold shadow-md border border-[#c21e1e]">ต้องสั่งของ!</div>}
                            {hasLinkedItems && item.evening_counted !== null && (
                              <div className="text-[10px] text-gray-500 font-medium mt-1 leading-tight">
                                รวมยอดของเตรียมแล้ว<br/>({Number(totalCombinedStock.toFixed(1))} {item.products?.unit})
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            {isEditing ? (
                              <div className="flex flex-col gap-1.5 items-center justify-center">
                                <button onClick={() => handleSaveEdit(item.id)} className="bg-[#059669] hover:bg-[#047857] text-white text-xs px-4 py-1.5 rounded-lg font-bold shadow-sm w-16">บันทึก</button>
                                <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-600 text-xs px-4 py-1.5 rounded-lg font-bold shadow-sm w-16">ยกเลิก</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingId(item.id); setEditYest(String(item.yesterday_balance)); setEditInc(String(item.incoming)); setEditEve(item.evening_counted !== null ? String(item.evening_counted) : '') }} className="bg-white border border-yellow-300 hover:bg-yellow-50 text-yellow-700 text-[11px] px-3 py-1.5 rounded-full font-semibold shadow-sm transition-colors">✏️ แก้ไข</button>
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
        </div>
      </div>

      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div><h3 className="text-2xl font-bold text-gray-900 mb-2">สำเร็จ!</h3><button onClick={() => setSuccessModal(false)} className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">ตกลง</button></div></div>
      )}
    </div>
  )
}