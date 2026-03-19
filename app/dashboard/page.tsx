'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// 🔴 1. สร้างแม่พิมพ์ข้อมูล (Interface) เพื่อแทนที่การใช้ any
interface Product {
  id: number;
  name: string;
  unit: string;
  min_limit: number | null;
  max_limit: number | null;
  categories?: { name: string };
}

interface DailyCheck {
  id: number;
  product_id: number;
  check_date: string;
  yesterday_balance: number;
  incoming: number;
  evening_counted: number | null;
}

interface OrderItem {
  name: string;
  category: string | undefined;
  currentStock: number;
  unit: string;
  orderAmount: number;
}

interface ReceivedItem {
  name: string;
  category: string | undefined;
  incoming: number;
  unit: string;
}

export default function DashboardPage() {
  // 🔴 2. ใส่ Type ให้ useState แทน <any[]>
  const [products, setProducts] = useState<Product[]>([])
  const [dailyChecks, setDailyChecks] = useState<DailyCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const today = new Date()
  const todayForDB = today.toLocaleDateString('en-CA')

  const fetchData = async () => {
    setIsLoading(true)
    const { data: pData } = await supabase.from('products').select('*, categories(name)')
    if (pData) setProducts(pData as unknown as Product[])

    const { data: dData } = await supabase.from('daily_stock_checks').select('*').eq('check_date', todayForDB)
    if (dData) setDailyChecks(dData as DailyCheck[])
    
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 🔴 3. ใส่ Type ให้ reduce เพื่อให้ item รู้จักตัวเอง
  const itemsToOrder = products.reduce<OrderItem[]>((acc, product) => {
    const checkRecord = dailyChecks.find(c => c.product_id === product.id)
    if (checkRecord && checkRecord.evening_counted !== null && product.min_limit !== null && product.max_limit !== null) {
      if (checkRecord.evening_counted <= product.min_limit) {
        const orderAmount = product.max_limit - checkRecord.evening_counted
        if (orderAmount > 0) {
          acc.push({
            name: product.name,
            category: product.categories?.name,
            currentStock: checkRecord.evening_counted,
            unit: product.unit,
            orderAmount: orderAmount
          })
        }
      }
    }
    return acc
  }, [])

  const itemsReceivedToday = products.reduce<ReceivedItem[]>((acc, product) => {
    const checkRecord = dailyChecks.find(c => c.product_id === product.id)
    if (checkRecord && checkRecord.incoming > 0) {
      acc.push({
        name: product.name,
        category: product.categories?.name,
        incoming: checkRecord.incoming,
        unit: product.unit
      })
    }
    return acc
  }, [])

  const totalProductsCount = products.length
  const checkedProductsCount = dailyChecks.filter(c => c.evening_counted !== null).length
  const progressPercent = totalProductsCount > 0 ? Math.round((checkedProductsCount / totalProductsCount) * 100) : 0

  if (isLoading) {
    return <div className="p-8 flex justify-center items-center h-full text-gray-500">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      {/* ส่วนหัว */}
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-[#df2323]">แดชบอร์ด</h1>
        <div className="bg-white px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm">
          {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* 3 การ์ดสรุปยอดด้านบน */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 text-4xl">📋</div>
          <div>
            <h3 className="text-gray-500 font-semibold mb-2">ความคืบหน้าเช็คสต๊อกวันนี้</h3>
            <div className="text-4xl font-bold text-gray-800 mb-2">
              {checkedProductsCount} <span className="text-lg text-gray-400 font-medium">/ {totalProductsCount} รายการ</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mt-4">
            <div className="bg-[#df2323] h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <div className="bg-[#ecfdf5] rounded-2xl p-6 border border-[#a7f3d0] shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-20 text-4xl">📦</div>
          <div>
            <h3 className="text-[#059669] font-semibold mb-2">รายการรับของเข้าวันนี้</h3>
            <div className="text-4xl font-bold text-[#047857] mb-2">
              {itemsReceivedToday.length} <span className="text-lg opacity-70 font-medium">รายการ</span>
            </div>
          </div>
          <p className="text-sm text-[#059669] mt-2 font-medium">อัปเดตยอดเข้าสต๊อกเรียบร้อยแล้ว</p>
        </div>

        <div className="bg-[#fef2f2] rounded-2xl p-6 border border-[#fecaca] shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-20 text-4xl">⚠️</div>
          <div>
            <h3 className="text-[#be123c] font-semibold mb-2">สินค้าต่ำกว่าเกณฑ์ (ต้องสั่งเพิ่ม)</h3>
            <div className="text-4xl font-bold text-[#e11d48] mb-2">
              {itemsToOrder.length} <span className="text-lg opacity-70 font-medium">รายการ</span>
            </div>
          </div>
          <p className="text-sm text-[#be123c] mt-2 font-medium">โปรดตรวจสอบและสั่งซื้อ</p>
        </div>
      </div>

      {/* 2 ตารางหลัก (แบ่งครึ่งซ้าย-ขวา) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ตารางซ้าย: ต้องสั่งเพิ่ม (สีแดง) */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#fecaca] overflow-hidden flex flex-col h-[500px]">
          <div className="bg-[#e11d48] p-4 px-6 text-white font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">🛒 สรุปสั่งของ ประจำวัน</div>
            <div className="text-xs bg-[#be123c] px-3 py-1 rounded-full">{itemsToOrder.length} รายการ</div>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="text-sm border-b border-gray-100">
                  <th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้ารายการ</th>
                  <th className="p-4 font-bold text-gray-700">เหลืออยู่</th>
                  <th className="p-4 font-bold text-[#e11d48]">ปริมาณที่ต้องสั่งเพิ่ม</th>
                </tr>
              </thead>
              <tbody>
                {itemsToOrder.length === 0 ? (
                  <tr><td colSpan={3} className="p-12 text-gray-400">✅ ไม่มีสินค้าที่ต้องสั่งเพิ่มในขณะนี้</td></tr>
                ) : (
                  itemsToOrder.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-red-50/30 transition-colors">
                      <td className="p-4 text-left">
                        <div className="font-bold text-gray-800">{item.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{item.category || 'ไม่มีหมวดหมู่'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-gray-700 text-lg">{item.currentStock}</div>
                        <div className="text-xs text-gray-500">{item.unit}</div>
                      </td>
                      <td className="p-4 bg-red-50/50">
                        <div className="font-bold text-[#df2323] text-2xl">+{item.orderAmount}</div>
                        <div className="text-xs text-[#df2323]">{item.unit}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ตารางขวา: ของเข้าวันนี้ (สีเขียว) */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#a7f3d0] overflow-hidden flex flex-col h-[500px]">
          <div className="bg-[#059669] p-4 px-6 text-white font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">📦 รายการของเข้าวันนี้</div>
            <div className="text-xs bg-[#047857] px-3 py-1 rounded-full">{itemsReceivedToday.length} รายการ</div>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-center border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="text-sm border-b border-gray-100">
                  <th className="p-4 text-left font-bold text-gray-700">ชื่อสินค้า</th>
                  <th className="p-4 font-bold text-gray-700">หมวดหมู่</th>
                  <th className="p-4 font-bold text-[#059669] text-right">จำนวนที่เข้า</th>
                </tr>
              </thead>
              <tbody>
                {itemsReceivedToday.length === 0 ? (
                  <tr><td colSpan={3} className="p-12 text-gray-400">ยังไม่มีรายการรับของเข้าในวันนี้</td></tr>
                ) : (
                  itemsReceivedToday.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-green-50/30 transition-colors">
                      <td className="p-4 text-left font-bold text-gray-800">{item.name}</td>
                      <td className="p-4 text-gray-600 text-sm">{item.category || '-'}</td>
                      <td className="p-4 text-right bg-green-50/50">
                        <span className="font-bold text-[#059669] text-xl mr-1">+{item.incoming}</span>
                        <span className="text-xs text-gray-500">{item.unit}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  )
}