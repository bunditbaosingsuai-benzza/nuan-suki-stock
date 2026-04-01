'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SendReportModal from '../components/SendReportModal'
import { useBranch } from '../context/BranchContext'
import { useUser } from '../context/UserContext' 

interface Category { name: string; }
interface Product { id: number; name: string; unit: string; min_limit: number | null; max_limit: number | null; raw_material_id: number | null; hide_used: boolean | null; categories?: Category | null; }
interface DailyCheck { id: number; product_id: number; check_date: string; yesterday_balance: number; incoming: number; evening_counted: number | null; }

export default function DashboardPage() {
  const { currentBranch } = useBranch() 
  const { profile } = useUser() 

  const [products, setProducts] = useState<Product[]>([])
  const [todayChecks, setTodayChecks] = useState<DailyCheck[]>([])
  const [latestPastChecks, setLatestPastChecks] = useState<Record<number, DailyCheck>>({})
  const [isLoading, setIsLoading] = useState(true)
  
  const [orderFilter, setOrderFilter] = useState('ทั้งหมด')
  const [incomingFilter, setIncomingFilter] = useState('ทั้งหมด') 
  const [balanceFilter, setBalanceFilter] = useState('ทั้งหมด')
  const [usedFilter, setUsedFilter] = useState('ทั้งหมด')

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [currentFilterTarget, setCurrentFilterTarget] = useState<'order' | 'incoming' | 'balance' | 'used' | null>(null)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const [isTelegramSubmitting, setIsTelegramSubmitting] = useState(false)
  
  // 🔴 เพิ่ม State สำหรับ Popup แจ้งเตือน Telegram แบบสวยงาม
  const [telegramModal, setTelegramModal] = useState<{isOpen: boolean, type: 'success' | 'error', message: string}>({isOpen: false, type: 'success', message: ''})

  const fetchData = async () => {
    if (!currentBranch) return; 
    setIsLoading(true)

    const { data: pData } = await supabase.from('products').select('*, categories(name)').eq('branch_id', currentBranch.id).order('id', { ascending: true })
    if (pData) setProducts(pData as Product[])

    const { data: tData } = await supabase.from('daily_stock_checks').select('*').eq('check_date', selectedDate).eq('branch_id', currentBranch.id)
    if (tData) setTodayChecks(tData as DailyCheck[])

    const { data: pastData } = await supabase.from('daily_stock_checks').select('*').lt('check_date', selectedDate).eq('branch_id', currentBranch.id).order('check_date', { ascending: false }).limit(3000)
    const latestMap: Record<number, DailyCheck> = {}
    if (pastData) { pastData.forEach((check: any) => { if (!latestMap[check.product_id]) latestMap[check.product_id] = check as DailyCheck }) }
    setLatestPastChecks(latestMap)
    
    setIsLoading(false)
  }

  useEffect(() => { if (currentBranch) fetchData() }, [selectedDate, currentBranch]) 

  const dashboardRows = products.map(product => {
    const tCheck = todayChecks.find(c => c.product_id === product.id)
    const latestCheck = latestPastChecks[product.id]
    
    let defaultLatestBalance = 0;
    if (latestCheck) { defaultLatestBalance = latestCheck.evening_counted !== null ? Number(latestCheck.evening_counted) : Number((latestCheck.yesterday_balance || 0) + (latestCheck.incoming || 0)); }

    const yBalance = tCheck ? Number(tCheck.yesterday_balance || 0) : defaultLatestBalance;
    const incoming = tCheck ? Number(tCheck.incoming || 0) : 0;
    const eveningCounted = tCheck && tCheck.evening_counted !== null ? Number(tCheck.evening_counted) : null;
    
    const totalAvailable = Number((yBalance + incoming).toFixed(1));
    const usedAmount = (eveningCounted !== null && !product.hide_used) ? Number((totalAvailable - eveningCounted).toFixed(1)) : null;

    return { 
      ...product, 
      categoryName: product.categories?.name || 'ไม่มีหมวดหมู่', 
      yesterday_balance: Number(yBalance.toFixed(1)), 
      incoming: Number(incoming.toFixed(1)), 
      evening_counted: eveningCounted !== null ? Number(eveningCounted.toFixed(1)) : null, 
      totalAvailable, 
      usedAmount 
    }
  })

  const fullReportData = dashboardRows.map(row => {
    let orderAmount: number | string = '-'; let needsOrder = false;
    if (row.evening_counted !== null && row.min_limit !== null && row.max_limit !== null) {
      let totalCombinedStock = row.evening_counted;
      const linkedPrepItems = dashboardRows.filter(p => p.raw_material_id === row.id);
      linkedPrepItems.forEach(prepItem => { totalCombinedStock += (prepItem.evening_counted !== null ? prepItem.evening_counted : prepItem.totalAvailable); });
      
      totalCombinedStock = Number(totalCombinedStock.toFixed(1));
      if (totalCombinedStock <= row.min_limit) { 
        orderAmount = Math.ceil(row.max_limit - totalCombinedStock); 
        needsOrder = orderAmount > 0; 
      } else { orderAmount = 0; }
    }
    return { name: row.name, category: row.categoryName, unit: row.unit, yesterday: row.yesterday_balance, incoming: row.incoming, evening: row.evening_counted !== null ? row.evening_counted : '-', used: row.usedAmount !== null ? row.usedAmount : '-', orderAmount: needsOrder ? `+${orderAmount}` : (orderAmount === 0 ? '-' : '-'), needsOrder: needsOrder };
  });

  const itemsToOrder = fullReportData.filter(item => item.needsOrder).map(item => ({ ...item, currentStock: item.evening, isCombined: false }));
  const orderCategories = Array.from(new Set(itemsToOrder.map(item => item.category)));
  const filteredOrderItems = orderFilter === 'ทั้งหมด' ? itemsToOrder : itemsToOrder.filter(item => item.category === orderFilter);

  const itemsReceivedToday = dashboardRows.filter(row => row.incoming > 0).map(row => ({ name: row.name, category: row.categoryName, incoming: row.incoming, unit: row.unit }));
  const incomingCategories = Array.from(new Set(itemsReceivedToday.map(item => item.category)));
  const filteredIncomingItems = incomingFilter === 'ทั้งหมด' ? itemsReceivedToday : itemsReceivedToday.filter(item => item.category === incomingFilter);

  const balanceItems = dashboardRows.map(row => ({ name: row.name, category: row.categoryName, unit: row.unit, balance: row.evening_counted !== null ? row.evening_counted : row.totalAvailable }));
  const balanceCategories = Array.from(new Set(balanceItems.map(item => item.category)));
  const filteredBalanceItems = balanceFilter === 'ทั้งหมด' ? balanceItems : balanceItems.filter(item => item.category === balanceFilter);

  const usedItems = dashboardRows.filter(row => row.usedAmount !== null && row.usedAmount > 0).map(row => ({ name: row.name, category: row.categoryName, unit: row.unit, used: row.usedAmount }));
  const usedCategories = Array.from(new Set(usedItems.map(item => item.category)));
  const filteredUsedItems = usedFilter === 'ทั้งหมด' ? usedItems : usedItems.filter(item => item.category === usedFilter);

  const totalProductsCount = products.length;
  const checkedProductsCount = dashboardRows.filter(r => r.evening_counted !== null).length;
  const progressPercent = totalProductsCount > 0 ? Math.round((checkedProductsCount / totalProductsCount) * 100) : 0;

  const openFilterModal = (target: 'order' | 'incoming' | 'balance' | 'used') => { setCurrentFilterTarget(target); setIsFilterModalOpen(true); };
  const handleSelectFilter = (cat: string) => { if (currentFilterTarget === 'order') setOrderFilter(cat); if (currentFilterTarget === 'incoming') setIncomingFilter(cat); if (currentFilterTarget === 'balance') setBalanceFilter(cat); if (currentFilterTarget === 'used') setUsedFilter(cat); setIsFilterModalOpen(false); };

  const handleSendTelegram = async () => {
    setIsTelegramSubmitting(true)
    try {
      const d = new Date(selectedDate)
      const formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

      const res = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportDate: formattedDate,
          branchName: currentBranch?.name || 'ไม่ระบุสาขา',
          fullReportData: fullReportData, 
          senderName: profile?.full_name || 'ผู้ดูแลระบบ' 
        })
      })

      const result = await res.json()
      if (result.success) {
        // 🔴 เรียกใช้ Popup สวยๆ แทนการใช้ alert
        setTelegramModal({ isOpen: true, type: 'success', message: 'ส่งรายงานสรุปสั่งของเข้า Telegram สำเร็จแล้วครับ!' })
      } else {
        setTelegramModal({ isOpen: true, type: 'error', message: result.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล' })
      }
    } catch (error) {
      setTelegramModal({ isOpen: true, type: 'error', message: 'ไม่สามารถเชื่อมต่อระบบ Telegram ได้ กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setIsTelegramSubmitting(false)
    }
  }

  let currentModalCategories: string[] = []; let currentSelectedFilter = ''; let filterTitle = ''; let themeColor = ''; let themeBg = '';
  if (currentFilterTarget === 'order') { currentModalCategories = orderCategories; currentSelectedFilter = orderFilter; filterTitle = 'กรองหมวดหมู่: สั่งของ'; themeColor = '#be123c'; themeBg = 'bg-[#e11d48]'; } 
  else if (currentFilterTarget === 'incoming') { currentModalCategories = incomingCategories; currentSelectedFilter = incomingFilter; filterTitle = 'กรองหมวดหมู่: ของเข้า'; themeColor = '#047857'; themeBg = 'bg-[#059669]'; } 
  else if (currentFilterTarget === 'balance') { currentModalCategories = balanceCategories; currentSelectedFilter = balanceFilter; filterTitle = 'กรองหมวดหมู่: คงเหลือ'; themeColor = '#1d4ed8'; themeBg = 'bg-[#2563eb]'; } 
  else if (currentFilterTarget === 'used') { currentModalCategories = usedCategories; currentSelectedFilter = usedFilter; filterTitle = 'กรองหมวดหมู่: ถูกใช้ไป'; themeColor = '#ca8a04'; themeBg = 'bg-[#eab308]'; }

  if (!currentBranch) return <div className="p-8 text-center text-gray-500">กำลังโหลดสาขา...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">แดชบอร์ด <span className="text-gray-500 text-lg ml-2">({currentBranch.name})</span></h1>
          <div className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 transition-colors focus-within:border-[#df2323] focus-within:ring-1 focus-within:ring-[#df2323]">
            <span className="text-gray-500">📅</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-sm font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer" />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
          <button onClick={handleSendTelegram} disabled={isTelegramSubmitting} className="bg-[#0088cc] hover:bg-[#0077b5] text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50">
            {isTelegramSubmitting ? 'กำลังส่งบอท...' : <><span>✈️</span> ส่งรายงานเข้า Telegram</>}
          </button>
          <button onClick={() => setIsReportModalOpen(true)} className="bg-[#df2323] hover:bg-[#be123c] text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto">
            <span>🚀</span> ส่งรายงานเอกสาร
          </button>
        </div>
      </div>

      {isLoading ? (<div className="p-16 flex flex-col justify-center items-center text-gray-500"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>กำลังโหลดข้อมูลวันที่ {selectedDate}...</div>) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-10 text-4xl">📋</div><div><h3 className="text-gray-500 font-semibold mb-2">ความคืบหน้าเช็คสต๊อก</h3><div className="text-4xl font-bold text-gray-800 mb-2">{checkedProductsCount} <span className="text-lg text-gray-400 font-medium">/ {totalProductsCount} รายการ</span></div></div><div className="w-full bg-gray-100 rounded-full h-2.5 mt-4"><div className="bg-[#df2323] h-2.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }}></div></div></div>
            <div className="bg-[#ecfdf5] rounded-2xl p-6 border border-[#a7f3d0] shadow-sm flex flex-col justify-between relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-20 text-4xl">📦</div><div><h3 className="text-[#059669] font-semibold mb-2">รายการรับของเข้า</h3><div className="text-4xl font-bold text-[#047857] mb-2">{itemsReceivedToday.length} <span className="text-lg opacity-70 font-medium">รายการ</span></div></div><p className="text-sm text-[#059669] mt-2 font-medium">อัปเดตยอดเข้าสต๊อกเรียบร้อยแล้ว</p></div>
            <div className="bg-[#fef2f2] rounded-2xl p-6 border border-[#fecaca] shadow-sm flex flex-col justify-between relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-20 text-4xl">⚠️</div><div><h3 className="text-[#be123c] font-semibold mb-2">สินค้าต่ำกว่าเกณฑ์</h3><div className="text-4xl font-bold text-[#e11d48] mb-2">{itemsToOrder.length} <span className="text-lg opacity-70 font-medium">รายการ</span></div></div><p className="text-sm text-[#be123c] mt-2 font-medium">โปรดตรวจสอบและสั่งซื้อ</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-[#fecaca] overflow-hidden flex flex-col h-[400px]">
              <div className="bg-[#e11d48] p-4 px-6 text-white font-bold flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">🛒 สรุปสั่งของประจำวัน</div><div className="flex items-center gap-2"><button onClick={() => openFilterModal('order')} className="text-xs bg-[#be123c] text-white border border-white/20 rounded-full py-1.5 px-4 focus:outline-none shadow-inner font-medium cursor-pointer hover:bg-[#a40f32] transition-colors flex items-center gap-1.5"><span>{orderFilter}</span><span className="text-[10px]">▼</span></button><div className="text-xs bg-[#be123c] px-3 py-1.5 rounded-full">{filteredOrderItems.length} รายการ</div></div></div>
              <div className="overflow-y-auto flex-1 custom-scrollbar"><table className="w-full text-center border-collapse"><thead className="sticky top-0 bg-white shadow-sm"><tr className="text-sm border-b border-gray-100"><th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้ารายการ</th><th className="p-4 font-bold text-gray-700">เหลืออยู่</th><th className="p-4 font-bold text-[#e11d48] bg-red-50/50">ต้องสั่งเพิ่ม</th></tr></thead><tbody>{filteredOrderItems.length === 0 ? (<tr><td colSpan={3} className="p-12 text-gray-400">✅ ไม่มีสินค้าที่ต้องสั่งเพิ่มในหมวดนี้</td></tr>) : (filteredOrderItems.map((item, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-red-50/30"><td className="p-4 text-left"><div className="font-bold text-gray-800">{item.name}</div><div className="flex gap-1 mt-1"><span className="text-[10px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-md">🏷️ {item.category}</span></div></td><td className="p-4"><div className="font-bold text-gray-700 text-lg">{item.currentStock}</div><div className="text-xs text-gray-500">{item.unit}</div></td><td className="p-4 bg-red-50/50"><div className="font-bold text-[#df2323] text-2xl">{item.orderAmount}</div><div className="text-xs text-[#df2323]">{item.unit}</div></td></tr>)))}</tbody></table></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-[#a7f3d0] overflow-hidden flex flex-col h-[400px]">
              <div className="bg-[#059669] p-4 px-6 text-white font-bold flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">📦 รายการของเข้า</div><div className="flex items-center gap-2"><button onClick={() => openFilterModal('incoming')} className="text-xs bg-[#047857] text-white border border-white/20 rounded-full py-1.5 px-4 focus:outline-none shadow-inner font-medium cursor-pointer hover:bg-[#065f46] transition-colors flex items-center gap-1.5"><span>{incomingFilter}</span><span className="text-[10px]">▼</span></button><div className="text-xs bg-[#065f46] px-3 py-1.5 rounded-full">{filteredIncomingItems.length} รายการ</div></div></div>
              <div className="overflow-y-auto flex-1 custom-scrollbar"><table className="w-full text-center border-collapse"><thead className="sticky top-0 bg-white shadow-sm"><tr className="text-sm border-b border-gray-100"><th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้ารายการ</th><th className="p-4 font-bold text-[#059669] bg-green-50/50">จำนวนที่เข้า</th></tr></thead><tbody>{filteredIncomingItems.length === 0 ? (<tr><td colSpan={2} className="p-12 text-gray-400">ยังไม่มีรายการรับของเข้าในหมวดนี้</td></tr>) : (filteredIncomingItems.map((item, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-green-50/30"><td className="p-4 text-left"><div className="font-bold text-gray-800">{item.name}</div><div className="flex mt-1"><span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">🏷️ {item.category}</span></div></td><td className="p-4 bg-green-50/50"><div className="font-bold text-[#059669] text-2xl">+{item.incoming}</div><div className="text-xs text-gray-500">{item.unit}</div></td></tr>)))}</tbody></table></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-[#bfdbfe] overflow-hidden flex flex-col h-[400px]">
              <div className="bg-[#2563eb] p-4 px-6 text-white font-bold flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">📊 สต๊อกคงเหลือปัจจุบัน</div><div className="flex items-center gap-2"><button onClick={() => openFilterModal('balance')} className="text-xs bg-[#1d4ed8] text-white border border-white/20 rounded-full py-1.5 px-4 focus:outline-none shadow-inner font-medium cursor-pointer hover:bg-[#1e40af] transition-colors flex items-center gap-1.5"><span>{balanceFilter}</span><span className="text-[10px]">▼</span></button><div className="text-xs bg-[#1d4ed8] px-3 py-1.5 rounded-full">{filteredBalanceItems.length} รายการ</div></div></div>
              <div className="overflow-y-auto flex-1 custom-scrollbar"><table className="w-full text-center border-collapse"><thead className="sticky top-0 bg-white shadow-sm"><tr className="text-sm border-b border-gray-100"><th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้ารายการ</th><th className="p-4 font-bold text-[#2563eb] bg-blue-50/50">ยอดคงเหลือ</th></tr></thead><tbody>{filteredBalanceItems.length === 0 ? (<tr><td colSpan={2} className="p-12 text-gray-400">ยังไม่มีรายการสินค้าในหมวดนี้</td></tr>) : (filteredBalanceItems.map((item, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-blue-50/30"><td className="p-4 text-left"><div className="font-bold text-gray-800">{item.name}</div><div className="flex mt-1"><span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">🏷️ {item.category}</span></div></td><td className="p-4 bg-blue-50/50"><div className="font-bold text-[#2563eb] text-2xl">{item.balance}</div><div className="text-xs text-gray-500">{item.unit}</div></td></tr>)))}</tbody></table></div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-[#fef08a] overflow-hidden flex flex-col h-[400px]">
              <div className="bg-[#eab308] p-4 px-6 text-white font-bold flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">📉 ปริมาณที่ถูกใช้ไป</div><div className="flex items-center gap-2"><button onClick={() => openFilterModal('used')} className="text-xs bg-[#ca8a04] text-white border border-white/20 rounded-full py-1.5 px-4 focus:outline-none shadow-inner font-medium cursor-pointer hover:bg-[#a16207] transition-colors flex items-center gap-1.5"><span>{usedFilter}</span><span className="text-[10px]">▼</span></button><div className="text-xs bg-[#ca8a04] px-3 py-1.5 rounded-full">{filteredUsedItems.length} รายการ</div></div></div>
              <div className="overflow-y-auto flex-1 custom-scrollbar"><table className="w-full text-center border-collapse"><thead className="sticky top-0 bg-white shadow-sm"><tr className="text-sm border-b border-gray-100"><th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้ารายการ</th><th className="p-4 font-bold text-[#ca8a04] bg-yellow-50/50">ปริมาณที่ถูกใช้ไป</th></tr></thead><tbody>{filteredUsedItems.length === 0 ? (<tr><td colSpan={2} className="p-12 text-gray-400">ยังไม่มีประวัติการใช้วัตถุดิบในหมวดนี้</td></tr>) : (filteredUsedItems.map((item, idx) => (<tr key={idx} className="border-b border-gray-50 hover:bg-yellow-50/30"><td className="p-4 text-left"><div className="font-bold text-gray-800">{item.name}</div><div className="flex mt-1"><span className="text-[10px] font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-md">🏷️ {item.category}</span></div></td><td className="p-4 bg-yellow-50/50"><div className="font-bold text-[#ca8a04] text-2xl">-{item.used}</div><div className="text-xs text-gray-500">{item.unit}</div></td></tr>)))}</tbody></table></div>
            </div>
          </div>
        </>
      )}

      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-200">
            <div className={`${themeBg} p-4 px-6 flex justify-between items-center text-white`}><h2 className="text-lg font-bold flex items-center gap-2">🔍 {filterTitle}</h2><button onClick={() => setIsFilterModalOpen(false)} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>
            <div className="p-6">
              <p className="text-sm font-bold text-gray-700 mb-4">เลือกหมวดหมู่ที่ต้องการดู:</p>
              <div className="flex flex-wrap gap-2.5">
                <button onClick={() => handleSelectFilter('ทั้งหมด')} className={`px-4 py-2 border rounded-xl font-bold shadow-sm transition-all text-sm ${currentSelectedFilter === 'ทั้งหมด' ? 'border-transparent text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-100 bg-white'}`} style={currentSelectedFilter === 'ทั้งหมด' ? { backgroundColor: themeColor } : {}}>รวมทั้งหมด</button>
                {currentModalCategories.map(cat => (
                  <button key={cat} onClick={() => handleSelectFilter(cat)} className={`px-4 py-2 border rounded-xl font-bold shadow-sm transition-all text-sm ${currentSelectedFilter === cat ? 'border-transparent text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-100 bg-white'}`} style={currentSelectedFilter === cat ? { backgroundColor: themeColor } : {}}>{cat}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 ส่วนของ Popup แบบสวยงาม */}
      {telegramModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center border-t-8 ${telegramModal.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${telegramModal.type === 'success' ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
              {telegramModal.type === 'success' ? (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{telegramModal.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-gray-600 mb-8 text-sm">{telegramModal.message}</p>
            <button onClick={() => setTelegramModal({ ...telegramModal, isOpen: false })} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition-colors ${telegramModal.type === 'success' ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#df2323] hover:bg-[#be123c]'}`}>
              ตกลง
            </button>
          </div>
        </div>
      )}

      <SendReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} selectedDate={selectedDate} onDateChange={setSelectedDate} fullReportData={fullReportData} />
    </div>
  )
}