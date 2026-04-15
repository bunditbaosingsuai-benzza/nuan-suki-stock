'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../context/BranchContext'
import { useUser } from '../context/UserContext' 
import OrderPreviewModal from '../components/OrderPreviewModal' 

interface ProductInfo { name: string; unit: string; hide_used: boolean | null; min_limit: number | null; max_limit: number | null; raw_material_id: number | null; order_interval_days: number; categories?: { name: string } | null; }
interface HistoryItem { id: number; product_id: number; check_date: string; yesterday_balance: number; incoming: number; evening_counted: number | null; actual_order_qty?: number | null; products: ProductInfo; }

export default function HistoryPage() {
  const { currentBranch } = useBranch()
  const { profile } = useUser()

  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editYest, setEditYest] = useState('')
  const [editInc, setEditInc] = useState('')
  const [editEve, setEditEve] = useState('')
  
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [editOrderQty, setEditOrderQty] = useState<string>('')

  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewItems, setPreviewItems] = useState<any[]>([])
  const [isTelegramSubmitting, setIsTelegramSubmitting] = useState(false) 
  const [telegramModal, setTelegramModal] = useState<{isOpen: boolean, type: 'success' | 'error', message: string}>({isOpen: false, type: 'success', message: ''})

  const [activeCategory, setActiveCategory] = useState<string>('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const horizontalScrollRef = useRef<HTMLDivElement>(null)
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const fetchHistory = async () => {
    if (!currentBranch || !selectedDate) return;
    const { data } = await supabase
      .from('daily_stock_checks')
      .select('*, products(name, unit, hide_used, min_limit, max_limit, raw_material_id, order_interval_days, categories(name))')
      .eq('check_date', selectedDate)
      .eq('branch_id', currentBranch.id)
      .order('id', { ascending: true })
      
    if (data) setHistoryData(data as HistoryItem[])
  }

  useEffect(() => { if(currentBranch) fetchHistory(); categoryRefs.current = {}; }, [selectedDate, currentBranch])

  const handleSaveEdit = async (id: number) => {
    try {
      const itemToEdit = historyData.find(item => item.id === id);
      if (!itemToEdit || !currentBranch) return;

      const newYest = editYest === '' ? 0 : parseFloat(editYest);
      const newInc = editInc === '' ? 0 : parseFloat(editInc);
      const newEve = editEve === '' ? null : parseFloat(editEve);

      const { error } = await supabase.from('daily_stock_checks').update({ yesterday_balance: newYest, incoming: newInc, evening_counted: newEve }).eq('id', id)
      if (error) throw error

      if (newEve !== null) {
        const parts = itemToEdit.check_date.split('-');
        const currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        currentDate.setDate(currentDate.getDate() + 1);
        const nextDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        await supabase.from('daily_stock_checks').update({ yesterday_balance: newEve }).eq('product_id', itemToEdit.product_id).eq('branch_id', currentBranch.id).eq('check_date', nextDateStr);
      }
      setEditingId(null); fetchHistory(); setTelegramModal({ isOpen: true, type: 'success', message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error: any) { setTelegramModal({ isOpen: true, type: 'error', message: 'อัปเดตไม่สำเร็จ: ' + error.message }) }
  }

  const handleSaveOrderQty = async (checkId: number) => {
    const qty = editOrderQty === '' ? null : parseFloat(editOrderQty);
    try {
      await supabase.from('daily_stock_checks').update({ actual_order_qty: qty }).eq('id', checkId);
      setEditingOrderId(null); fetchHistory();
    } catch (e) { setTelegramModal({ isOpen: true, type: 'error', message: 'อัปเดตไม่สำเร็จ' }); }
  }

  const handleStartTelegramProcess = () => {
    if (historyData.length === 0) return setTelegramModal({ isOpen: true, type: 'error', message: 'ไม่มีข้อมูลในวันที่เลือกครับ' })
    
    const preparedData = historyData.map(item => {
      const total = Number((item.yesterday_balance + item.incoming).toFixed(1));
      const eveningCounted = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : '-';
      const usedAmount = (item.evening_counted !== null && !item.products?.hide_used) ? Number((total - item.evening_counted).toFixed(1)) : '-';

      let totalCombinedStock = item.evening_counted !== null ? item.evening_counted : total;
      const linkedItems = historyData.filter(r => r.products?.raw_material_id === item.product_id);
      linkedItems.forEach(linked => { totalCombinedStock += linked.evening_counted !== null ? linked.evening_counted : (linked.yesterday_balance + linked.incoming); });

      let calcOrderAmt = 0;
      if (item.evening_counted !== null && item.products?.min_limit !== null && item.products?.max_limit !== null) {
        if (totalCombinedStock <= item.products.min_limit) calcOrderAmt = Math.ceil(item.products.max_limit - totalCombinedStock);
      }

      const finalOrderAmt = item.actual_order_qty ?? calcOrderAmt;
      let needsOrder = finalOrderAmt > 0;

      return {
        product_id: item.product_id, check_id: item.id, actual_order_qty: item.actual_order_qty,
        name: item.products?.name || 'ไม่ทราบชื่อ', category: item.products?.categories?.name || 'ไม่มีหมวดหมู่', unit: item.products?.unit || '',
        yesterday: item.yesterday_balance, incoming: item.incoming, evening: eveningCounted, used: usedAmount,
        orderAmount: needsOrder ? `+${finalOrderAmt}` : '-', needsOrder: needsOrder
      };
    });

    setPreviewItems(preparedData)
    setIsPreviewOpen(true)
  }

  const handleConfirmAndSend = async (finalOrderItems: any[]) => {
    setIsTelegramSubmitting(true)
    try {
      const d = new Date(selectedDate)
      const formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

      for (const item of finalOrderItems) {
        const qty = Number(item.orderAmount.replace('+', ''));
        if (item.check_id) { await supabase.from('daily_stock_checks').update({ actual_order_qty: qty }).eq('id', item.check_id); }
      }
      fetchHistory();

      const dataToSend = previewItems.map(originalItem => {
        const editedItem = finalOrderItems.find(f => f.product_id === originalItem.product_id);
        if (editedItem) return { ...originalItem, orderAmount: editedItem.orderAmount, needsOrder: Number(editedItem.orderAmount.replace('+','')) > 0 };
        return originalItem;
      });

      const res = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportDate: formattedDate, branchName: currentBranch?.name || 'ไม่ระบุสาขา', fullReportData: dataToSend, senderName: profile?.full_name || 'ผู้ดูแลระบบ' })
      })

      const result = await res.json()
      if (result.success) {
        setIsPreviewOpen(false)
        setTelegramModal({ isOpen: true, type: 'success', message: 'บันทึกยอดสั่งจริงลงระบบ และส่ง Telegram สำเร็จแล้วครับ!' })
      } else { setTelegramModal({ isOpen: true, type: 'error', message: result.error || 'เกิดข้อผิดพลาด' }) }
    } catch (error) { setTelegramModal({ isOpen: true, type: 'error', message: 'เชื่อมต่อ Telegram ไม่ได้' }) } finally { setIsTelegramSubmitting(false) }
  }

  const handleScroll = () => { if (!tableContainerRef.current) return; const scrollPosition = tableContainerRef.current.scrollTop + 80; let currentActive = ''; for (const cat of Object.keys(historyData.reduce((acc, item) => { const cat = item.products?.categories?.name || 'ไม่มีหมวดหมู่'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, HistoryItem[]>))) { const el = categoryRefs.current[cat]; if (el && el.offsetTop <= scrollPosition) currentActive = cat; } if (currentActive && currentActive !== activeCategory) setActiveCategory(currentActive); };
  const scrollToCategory = (cat: string) => { const el = categoryRefs.current[cat]; if (el && tableContainerRef.current) { tableContainerRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 75), behavior: 'smooth' }); setActiveCategory(cat); } };

  useEffect(() => {
    if (activeCategory && horizontalScrollRef.current && categoryBtnRefs.current[activeCategory]) {
      const container = horizontalScrollRef.current; const button = categoryBtnRefs.current[activeCategory];
      if (button) { const scrollPos = button.offsetLeft - (container.offsetWidth / 2) + (button.offsetWidth / 2); container.scrollTo({ left: scrollPos, behavior: 'smooth' }); }
    }
  }, [activeCategory]);

  if (!currentBranch) return <div className="p-8 text-center text-gray-500">กำลังโหลดสาขา...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">ประวัติการทำรายการ <span className="text-gray-500 text-lg ml-2">({currentBranch.name})</span></h1>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
          <div className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 transition-colors focus-within:border-[#df2323] focus-within:ring-1 focus-within:ring-[#df2323] w-full sm:w-fit"><span className="text-gray-500">📅</span><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-sm font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer w-full" /></div>
          <button onClick={handleStartTelegramProcess} disabled={isTelegramSubmitting} className="bg-[#0088cc] hover:bg-[#0077b5] text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50">{isTelegramSubmitting ? 'กำลังส่งบอท...' : <><span>✈️</span> ส่งรายงานเข้า Telegram</>}</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[75vh] min-h-[500px]">
        <div ref={horizontalScrollRef} className="bg-white border-b border-gray-100 flex overflow-x-auto custom-scrollbar flex-shrink-0 relative z-20 shadow-sm p-2 gap-2 px-4 items-center scroll-smooth">
          {Object.keys(historyData.reduce((acc, item) => { const cat = item.products?.categories?.name || 'ไม่มีหมวดหมู่'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, HistoryItem[]>)).map(cat => (
            <button key={cat} ref={(el) => { categoryBtnRefs.current[cat] = el; }} onClick={() => scrollToCategory(cat)} className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-all border border-transparent ${activeCategory === cat ? 'bg-[#df2323] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}>{cat}</button>
          ))}
        </div>
        <div ref={tableContainerRef} onScroll={handleScroll} className="overflow-auto flex-1 custom-scrollbar scroll-smooth bg-gray-50/30">
          <table className="w-full text-center border-collapse">
            <thead className="sticky top-0 z-30 shadow-sm">
              <tr className="text-sm border-b border-gray-200">
                <th className="p-2 sm:p-4 text-left font-bold text-gray-700 sticky left-0 top-0 z-40 bg-white border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[110px] min-w-[110px] sm:w-auto sm:min-w-[200px] whitespace-normal sm:whitespace-nowrap leading-snug">รายการสินค้า<br className="sm:hidden" />(หน่วย)</th>
                <th className="p-4 bg-yellow-50 text-[#854d0e] border-x border-yellow-100 whitespace-nowrap">ยอดเหลือล่าสุด</th>
                <th className="p-4 bg-yellow-50 text-[#854d0e] border-r border-yellow-100 whitespace-nowrap">รับเข้าวันนี้</th>
                <th className="p-4 bg-yellow-100 text-[#854d0e] font-bold border-r border-yellow-200 whitespace-nowrap">รวมมีของ</th>
                <th className="p-4 bg-blue-50 text-blue-700 font-bold border-r border-blue-100 w-48 whitespace-nowrap">นับได้ตอนเย็น</th>
                <th className="p-4 bg-white text-gray-600 border-r border-gray-200 whitespace-nowrap">ถูกใช้ไป</th>
                <th className="p-4 bg-red-50 text-[#df2323] font-bold border-l border-red-100 whitespace-nowrap">ต้องสั่งเพิ่ม</th>
                <th className="p-4 font-bold text-gray-700 bg-white whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {historyData.length === 0 ? (<tr><td colSpan={8} className="p-12 text-gray-400">ไม่มีข้อมูลบันทึกในวันที่เลือก</td></tr>) : (
                Object.entries(historyData.reduce((acc, item) => { const cat = item.products?.categories?.name || 'ไม่มีหมวดหมู่'; if (!acc[cat]) acc[cat] = []; acc[cat].push(item); return acc; }, {} as Record<string, HistoryItem[]>)).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr ref={(el) => { categoryRefs.current[category] = el; }} className="bg-gray-100 border-y border-gray-200"><td className="p-2 sm:p-3 pl-4 sm:pl-6 text-left font-bold text-gray-800 text-xs sm:text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">📂 {category}</td><td colSpan={7} className="bg-gray-100"></td></tr>
                    {items.map((item, index) => {
                      const total = Number((item.yesterday_balance + item.incoming).toFixed(1));
                      const eveningCounted = item.evening_counted !== null ? Number(item.evening_counted.toFixed(1)) : '-';
                      const used = (item.evening_counted !== null && !item.products?.hide_used) ? Number((total - item.evening_counted).toFixed(1)) : '-';
                      const isEditing = editingId === item.id
                      
                      let totalCombinedStock = item.evening_counted !== null ? item.evening_counted : total;
                      const linkedItems = historyData.filter(r => r.products?.raw_material_id === item.product_id);
                      const hasLinkedItems = linkedItems.length > 0;
                      linkedItems.forEach(linked => { totalCombinedStock += linked.evening_counted !== null ? linked.evening_counted : (linked.yesterday_balance + linked.incoming); });
                      
                      let calcOrderAmt = 0;
                      if (item.evening_counted !== null && item.products?.min_limit !== null && item.products?.max_limit !== null) { if (totalCombinedStock <= item.products.min_limit) calcOrderAmt = Math.ceil(item.products.max_limit - totalCombinedStock); }
                      
                      const finalOrderAmt = item.actual_order_qty ?? calcOrderAmt;
                      let needsOrder = finalOrderAmt > 0;

                      return (
                        <tr key={item.id} ref={(el) => { if(index === 0) categoryRefs.current[category] = el; }} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors group">
                          <td className="p-2 sm:p-4 text-left font-semibold text-gray-800 bg-white group-hover:bg-gray-50/80 sticky left-0 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors w-[110px] min-w-[110px] sm:w-auto sm:min-w-[200px] whitespace-normal break-words sm:whitespace-nowrap">
                            <div className="text-[13px] sm:text-[15px] leading-tight">{item.products?.name}</div>
                            <div className="text-[9px] sm:text-[11px] text-gray-500 font-normal mt-1 flex flex-col sm:flex-row sm:gap-2 leading-none sm:leading-normal">
                              <span>Max: {item.products?.max_limit !== null ? Number(Number(item.products?.max_limit).toFixed(1)) : '-'}</span>
                              <span>Min: {item.products?.min_limit !== null ? Number(Number(item.products?.min_limit).toFixed(1)) : '-'}</span>
                            </div>
                          </td>
                          {isEditing ? (<><td className="p-2 bg-[#fefce8]"><input type="number" step="any" className="w-16 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editYest} onChange={e => setEditYest(e.target.value)} /></td><td className="p-2 bg-[#fefce8]"><input type="number" step="any" className="w-16 border-2 border-yellow-400 rounded-lg p-2 text-center font-bold" value={editInc} onChange={e => setEditInc(e.target.value)} /></td><td className="p-4 font-bold text-xl text-white bg-[#eab308]">{total}</td><td className="p-2 bg-[#eff6ff]"><input type="number" step="any" className="w-16 border-2 border-blue-400 rounded-lg p-2 text-center font-bold" value={editEve} onChange={e => setEditEve(e.target.value)} /></td></>) : (<><td className="p-2 sm:p-4 text-yellow-700 font-semibold bg-[#fefce8] text-sm sm:text-base">{item.yesterday_balance}</td><td className="p-2 sm:p-4 text-yellow-700 font-semibold bg-[#fefce8] text-sm sm:text-base">{item.incoming}</td><td className="p-2 sm:p-4 text-white font-bold text-lg sm:text-xl bg-[#eab308]">{total}</td><td className="p-2 sm:p-4 text-blue-600 font-bold text-lg sm:text-xl bg-[#eff6ff]">{eveningCounted}</td></>)}
                          <td className="p-2 sm:p-4 text-gray-600 font-semibold text-lg sm:text-xl">{used}</td>
                          
                          <td className={`p-2 sm:p-4 font-bold text-lg bg-red-50/20 border-l border-[#fecaca] align-middle ${needsOrder ? 'text-[#df2323]' : 'text-gray-400'}`}>
                            {editingOrderId === item.id ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <input type="number" step="any" autoFocus className="w-14 sm:w-16 border-2 border-[#df2323] rounded-lg p-1 sm:p-1.5 text-center font-bold text-[#df2323] focus:outline-none shadow-sm text-sm sm:text-base" value={editOrderQty} onChange={(e) => setEditOrderQty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveOrderQty(item.id)} />
                                  <div className="flex gap-1">
                                    <button onClick={() => handleSaveOrderQty(item.id)} className="bg-[#df2323] text-white text-[10px] px-2 py-1 rounded font-bold shadow-sm">บันทึก</button>
                                    <button onClick={() => setEditingOrderId(null)} className="bg-gray-200 text-gray-700 text-[10px] px-2 py-1 rounded font-bold shadow-sm">ยกเลิก</button>
                                  </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <span className={needsOrder ? "text-xl sm:text-2xl" : "text-lg"}>{needsOrder ? `+${finalOrderAmt}` : '-'}</span>
                                  <button onClick={() => { setEditingOrderId(item.id); setEditOrderQty(finalOrderAmt === 0 ? '' : String(finalOrderAmt)); }} className={`mt-1.5 text-[10px] sm:text-xs bg-white border px-2.5 sm:px-3 py-1 rounded-full font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1 w-fit mx-auto ${needsOrder ? 'border-red-200 text-[#be123c] hover:bg-red-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    ✏️ {needsOrder ? 'แก้ไข' : 'สั่งเพิ่ม'}
                                  </button>
                                  
                                  {needsOrder && <div className="text-[9px] sm:text-[10px] bg-[#df2323] text-white px-2 py-0.5 rounded-full inline-block mt-1.5 font-bold shadow-sm border border-[#c21e1e]">สั่งของ!</div>}
                                  {hasLinkedItems && item.evening_counted !== null && (<div className="text-[9px] sm:text-[10px] text-gray-500 font-medium mt-1 leading-tight">รวมยอดเตรียม<br/>({Number(totalCombinedStock.toFixed(1))} {item.products?.unit})</div>)}
                                </div>
                            )}
                          </td>

                          <td className="p-2 sm:p-4">{isEditing ? (<div className="flex flex-col gap-1.5 items-center justify-center"><button onClick={() => handleSaveEdit(item.id)} className="bg-[#059669] hover:bg-[#047857] text-white text-[10px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-lg font-bold shadow-sm w-12 sm:w-16">บันทึก</button><button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-600 text-[10px] sm:text-xs px-3 sm:px-4 py-1.5 rounded-lg font-bold shadow-sm w-12 sm:w-16">ยกเลิก</button></div>) : (<button onClick={() => { setEditingId(item.id); setEditYest(String(item.yesterday_balance)); setEditInc(String(item.incoming)); setEditEve(item.evening_counted !== null ? String(item.evening_counted) : '') }} className="bg-white border border-yellow-300 hover:bg-yellow-50 text-yellow-700 text-[9px] sm:text-[11px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-semibold shadow-sm transition-colors">✏️ แก้ไข</button>)}</td>
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

      {telegramModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className={`bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center border-t-8 ${telegramModal.type === 'success' ? 'border-green-500' : 'border-red-500'}`}><div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${telegramModal.type === 'success' ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>{telegramModal.type === 'success' ? (<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>) : (<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>)}</div><h3 className="text-2xl font-bold text-gray-900 mb-2">{telegramModal.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3><p className="text-gray-600 mb-8 text-sm">{telegramModal.message}</p><button onClick={() => setTelegramModal({ ...telegramModal, isOpen: false })} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition-colors ${telegramModal.type === 'success' ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#df2323] hover:bg-[#be123c]'}`}>ตกลง</button></div></div>
      )}

      <OrderPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} onConfirm={handleConfirmAndSend} items={previewItems} isLoading={isTelegramSubmitting} />
    </div>
  )
}