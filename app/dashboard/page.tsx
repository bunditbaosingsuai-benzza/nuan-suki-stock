'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Category {
  name: string;
}

interface Product {
  id: number;
  name: string;
  unit: string;
  min_limit: number | null;
  max_limit: number | null;
  raw_material_id: number | null;
  categories?: Category | null;
}

interface DailyCheck {
  id: number;
  product_id: number;
  check_date: string;
  yesterday_balance: number;
  incoming: number;
  evening_counted: number | null;
}

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [todayChecks, setTodayChecks] = useState<DailyCheck[]>([])
  const [latestPastChecks, setLatestPastChecks] = useState<Record<number, DailyCheck>>({})
  const [isLoading, setIsLoading] = useState(true)
  
  // 🔴 State สำหรับตัวกรองหมวดหมู่ในตารางสั่งของ
  const [orderFilter, setOrderFilter] = useState('ทั้งหมด')

  const today = new Date()
  const todayForDB = today.toLocaleDateString('en-CA')

  const fetchData = async () => {
    setIsLoading(true)
    const { data: pData } = await supabase.from('products').select('*, categories(name)').order('id', { ascending: true })
    if (pData) setProducts(pData as Product[])

    const { data: tData } = await supabase.from('daily_stock_checks').select('*').eq('check_date', todayForDB)
    if (tData) setTodayChecks(tData as DailyCheck[])

    const { data: pastData } = await supabase.from('daily_stock_checks').select('*').lt('check_date', todayForDB).order('check_date', { ascending: false }).limit(3000)
    const latestMap: Record<number, DailyCheck> = {}
    if (pastData) {
      pastData.forEach((check: any) => {
        if (!latestMap[check.product_id]) latestMap[check.product_id] = check as DailyCheck
      })
    }
    setLatestPastChecks(latestMap)
    setIsLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const dashboardRows = products.map(product => {
    const tCheck = todayChecks.find(c => c.product_id === product.id)
    const latestCheck = latestPastChecks[product.id]

    let defaultLatestBalance = 0;
    if (latestCheck) {
      defaultLatestBalance = latestCheck.evening_counted !== null ? latestCheck.evening_counted : (latestCheck.yesterday_balance + latestCheck.incoming);
    }

    const yBalance = tCheck ? tCheck.yesterday_balance : defaultLatestBalance;
    const incoming = tCheck ? tCheck.incoming : 0;
    const eveningCounted = tCheck ? tCheck.evening_counted : null;

    return {
      ...product,
      categoryName: product.categories?.name || 'ไม่มีหมวดหมู่',
      yesterday_balance: Number(yBalance.toFixed(1)),
      incoming: Number(incoming.toFixed(1)),
      evening_counted: eveningCounted !== null ? Number(eveningCounted.toFixed(1)) : null,
      totalAvailable: Number((yBalance + incoming).toFixed(1)),
      usedAmount: eveningCounted !== null ? Number(((yBalance + incoming) - eveningCounted).toFixed(1)) : null
    }
  })

  const groupedRows = dashboardRows.reduce((acc, row) => {
    const cat = row.categoryName;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {} as Record<string, typeof dashboardRows>);

  // คำนวณยอดสั่งของแบบมีของเหยา
  const itemsToOrder: any[] = [];
  
  dashboardRows.forEach(row => {
    if (row.min_limit !== null && row.max_limit !== null) {
      let totalCombinedStock = row.evening_counted !== null ? row.evening_counted : row.totalAvailable;
      let hasPrepItem = false;

      const linkedPrepItems = dashboardRows.filter(p => p.raw_material_id === row.id);
      
      if (linkedPrepItems.length > 0) {
        linkedPrepItems.forEach(prepItem => {
          const prepStock = prepItem.evening_counted !== null ? prepItem.evening_counted : prepItem.totalAvailable;
          totalCombinedStock += prepStock;
          hasPrepItem = true;
        });
      }

      if (totalCombinedStock <= row.min_limit) {
        itemsToOrder.push({
          name: row.name,
          category: row.categoryName,
          currentStock: Number(totalCombinedStock.toFixed(1)),
          unit: row.unit,
          orderAmount: Number((row.max_limit - totalCombinedStock).toFixed(1)),
          isCombined: hasPrepItem 
        });
      }
    }
  });

  // 🔴 ดึงรายชื่อหมวดหมู่เฉพาะที่มีของต้องสั่ง (เอาตัวซ้ำออก)
  const orderCategories = Array.from(new Set(itemsToOrder.map(item => item.category)));

  // 🔴 กรองข้อมูลตารางสั่งของตามที่ผู้ใช้เลือก (Filter)
  const filteredOrderItems = orderFilter === 'ทั้งหมด' 
    ? itemsToOrder 
    : itemsToOrder.filter(item => item.category === orderFilter);

  const itemsReceivedToday = dashboardRows.filter(row => row.incoming > 0).map(row => ({ name: row.name, category: row.categoryName, incoming: row.incoming, unit: row.unit }));
  const totalProductsCount = products.length;
  const checkedProductsCount = dashboardRows.filter(r => r.evening_counted !== null).length;
  const progressPercent = totalProductsCount > 0 ? Math.round((checkedProductsCount / totalProductsCount) * 100) : 0;

  if (isLoading) return <div className="p-8 flex justify-center items-center text-gray-500">กำลังโหลดข้อมูล...</div>

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">แดชบอร์ด</h1>
        <div className="bg-white px-4 sm:px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit">
          {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-4xl">📋</div>
          <div><h3 className="text-gray-500 font-semibold mb-2">ความคืบหน้าเช็คสต๊อกวันนี้</h3><div className="text-4xl font-bold text-gray-800 mb-2">{checkedProductsCount} <span className="text-lg text-gray-400 font-medium">/ {totalProductsCount} รายการ</span></div></div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mt-4"><div className="bg-[#df2323] h-2.5 rounded-full transition-all" style={{ width: `${progressPercent}%` }}></div></div>
        </div>
        <div className="bg-[#ecfdf5] rounded-2xl p-6 border border-[#a7f3d0] shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-20 text-4xl">📦</div>
          <div><h3 className="text-[#059669] font-semibold mb-2">รายการรับของเข้าวันนี้</h3><div className="text-4xl font-bold text-[#047857] mb-2">{itemsReceivedToday.length} <span className="text-lg opacity-70 font-medium">รายการ</span></div></div>
          <p className="text-sm text-[#059669] mt-2 font-medium">อัปเดตยอดเข้าสต๊อกเรียบร้อยแล้ว</p>
        </div>
        <div className="bg-[#fef2f2] rounded-2xl p-6 border border-[#fecaca] shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-20 text-4xl">⚠️</div>
          <div><h3 className="text-[#be123c] font-semibold mb-2">สินค้าต่ำกว่าเกณฑ์</h3><div className="text-4xl font-bold text-[#e11d48] mb-2">{itemsToOrder.length} <span className="text-lg opacity-70 font-medium">รายการ</span></div></div>
          <p className="text-sm text-[#be123c] mt-2 font-medium">โปรดตรวจสอบและสั่งซื้อ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-[#fecaca] overflow-hidden flex flex-col h-[400px]">
          
          {/* 🔴 ส่วนหัวของตารางสั่งของ + ตัวกรองหมวดหมู่ */}
          <div className="bg-[#e11d48] p-4 px-6 text-white font-bold flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">🛒 สรุปสั่งของ ประจำวัน</div>
            <div className="flex items-center gap-2">
              <select 
                value={orderFilter} 
                onChange={(e) => setOrderFilter(e.target.value)}
                className="text-xs bg-[#be123c] text-white border border-white/20 rounded-full py-1.5 pl-3 pr-8 focus:outline-none shadow-inner font-medium cursor-pointer hover:bg-[#a40f32] transition-colors appearance-none"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                  backgroundRepeat: 'no-repeat', 
                  backgroundPosition: 'right 0.5rem center', 
                  backgroundSize: '1em 1em' 
                }}
              >
                <option value="ทั้งหมด" className="bg-white text-gray-800">ทั้งหมด</option>
                {orderCategories.map(cat => (
                  <option key={cat} value={cat} className="bg-white text-gray-800">{cat}</option>
                ))}
              </select>
              <div className="text-xs bg-[#be123c] px-3 py-1.5 rounded-full">{filteredOrderItems.length} รายการ</div>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm"><tr className="text-sm border-b border-gray-100"><th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้า</th><th className="p-4 font-bold text-gray-700">เหลืออยู่</th><th className="p-4 font-bold text-[#e11d48]">ต้องสั่งเพิ่ม</th></tr></thead>
              <tbody>
                {/* 🔴 วนลูปจาก filteredOrderItems แทน itemsToOrder */}
                {filteredOrderItems.length === 0 ? (<tr><td colSpan={3} className="p-12 text-gray-400">✅ ไม่มีสินค้าที่ต้องสั่งเพิ่มในหมวดนี้</td></tr>) : (
                  filteredOrderItems.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-red-50/30">
                      <td className="p-4 text-left">
                        <div className="font-bold text-gray-800">{item.name}</div>
                        {item.isCombined ? <div className="text-[11px] text-[#df2323] font-semibold mt-0.5">(รวมยอดของเหยาแล้ว)</div> : <div className="text-xs text-gray-500 mt-0.5">{item.category}</div>}
                      </td>
                      <td className="p-4"><div className="font-bold text-gray-700 text-lg">{item.currentStock}</div><div className="text-xs text-gray-500">{item.unit}</div></td>
                      <td className="p-4 bg-red-50/50"><div className="font-bold text-[#df2323] text-2xl">+{item.orderAmount}</div><div className="text-xs text-[#df2323]">{item.unit}</div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#a7f3d0] overflow-hidden flex flex-col h-[400px]">
          <div className="bg-[#059669] p-4 px-6 text-white font-bold flex items-center justify-between"><div className="flex items-center gap-2">📦 รายการของเข้าวันนี้</div><div className="text-xs bg-[#047857] px-3 py-1 rounded-full">{itemsReceivedToday.length} รายการ</div></div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm"><tr className="text-sm border-b border-gray-100"><th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้า</th><th className="p-4 font-bold text-gray-700">หมวดหมู่</th><th className="p-4 font-bold text-[#059669] text-right">จำนวนที่เข้า</th></tr></thead>
              <tbody>
                {itemsReceivedToday.length === 0 ? (<tr><td colSpan={3} className="p-12 text-gray-400">ยังไม่มีรายการรับของเข้า</td></tr>) : (
                  itemsReceivedToday.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-green-50/30"><td className="p-4 text-left font-bold text-gray-800">{item.name}</td><td className="p-4 text-gray-600 text-sm">{item.category}</td><td className="p-4 text-right bg-green-50/50"><span className="font-bold text-[#059669] text-xl mr-1">+{item.incoming}</span><span className="text-xs text-gray-500">{item.unit}</span></td></tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 px-6 border-b border-gray-200 flex justify-between items-center">
          <div className="font-bold text-gray-700 flex items-center gap-2"><span className="text-xl">📊</span> ภาพรวมสต๊อกทั้งหมด <span className="font-normal text-sm text-gray-500 hidden sm:inline">(อิงจากข้อมูลล่าสุด)</span></div>
          <div className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold shadow-inner">{totalProductsCount} รายการ</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="text-sm border-b border-gray-200 bg-white"><th className="p-5 font-bold text-gray-700 text-left">รายการสินค้า</th><th className="p-5 font-bold text-yellow-700 bg-yellow-50/50 border-l border-yellow-100">ยอดเหลือล่าสุด</th><th className="p-5 font-bold text-yellow-700 bg-yellow-50/50">รับเข้าวันนี้</th><th className="p-5 font-bold text-yellow-800 bg-yellow-100/50 border-r border-yellow-200">รวมมีของ</th><th className="p-5 font-bold text-blue-700 bg-blue-50/50 border-r border-blue-100">นับตอนเย็น</th><th className="p-5 font-bold text-gray-700 bg-gray-50/50">ถูกใช้ไป</th></tr>
            </thead>
            <tbody>
              {dashboardRows.length === 0 ? (<tr><td colSpan={6} className="p-16 text-gray-400">ยังไม่มีรายการสินค้าในระบบ</td></tr>) : (
                Object.entries(groupedRows).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr className="bg-gray-100 border-y border-gray-200"><td colSpan={6} className="p-3 pl-6 text-left font-bold text-gray-800 text-sm">📂 หมวดหมู่: {category}</td></tr>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50"><td className="p-5 text-left font-bold text-gray-800">{item.name} <span className="text-xs text-gray-500 ml-1 font-normal">({item.unit})</span></td><td className="p-5 text-yellow-700 font-semibold bg-yellow-50/30 border-l border-yellow-50">{item.yesterday_balance}</td><td className="p-5 text-yellow-700 font-semibold bg-yellow-50/30">{item.incoming > 0 ? <span className="text-[#059669] font-bold">+{item.incoming}</span> : '0'}</td><td className="p-5 text-yellow-900 font-bold text-lg bg-yellow-100/30 border-r border-yellow-100">{item.totalAvailable}</td><td className="p-5 text-blue-600 font-bold text-lg bg-blue-50/30 border-r border-blue-50">{item.evening_counted !== null ? item.evening_counted : '-'}</td><td className="p-5 text-gray-600 font-semibold bg-gray-50/30">{item.usedAmount !== null ? item.usedAmount : '-'}</td></tr>
                    ))}
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