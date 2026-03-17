'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ProductPage() {
  const [products, setProducts] = useState<any[]>([])
  
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [unit, setUnit] = useState('')
  const [maxLimit, setMaxLimit] = useState('')
  const [minLimit, setMinLimit] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories ( name )
      `)
      .order('id', { ascending: false })
    
    if (data) setProducts(data)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let categoryId = null

      if (categoryName) {
        const { data: existingCat } = await supabase
          .from('categories')
          .select('id')
          .eq('name', categoryName)
          .single()

        if (existingCat) {
          categoryId = existingCat.id
        } else {
          const { data: newCat, error: catError } = await supabase
            .from('categories')
            .insert([{ name: categoryName }])
            .select('id')
            .single()
            
          if (catError) throw catError
          if (newCat) categoryId = newCat.id
        }
      }

      const { error: prodError } = await supabase
        .from('products')
        .insert([{
          name,
          category_id: categoryId,
          unit,
          max_limit: maxLimit ? parseInt(maxLimit) : null,
          min_limit: minLimit ? parseInt(minLimit) : null
        }])

      if (prodError) throw prodError

      setName('')
      setCategoryName('')
      setUnit('')
      setMaxLimit('')
      setMinLimit('')
      fetchProducts()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 🔴 ฟังก์ชันใหม่: สำหรับลบสินค้า
  const handleDelete = async (id: number, productName: string) => {
    const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ "${productName}"?`)
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      // พอลบเสร็จ ก็สั่งให้ดึงข้อมูลใหม่มาแสดง
      fetchProducts()
    } catch (error: any) {
      console.error('Error deleting:', error)
      alert('❌ ไม่สามารถลบได้: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center mb-8">
          <h1 className="text-2xl font-bold text-red-600 mr-4">รายการสินค้า</h1>
          <span className="bg-white px-4 py-1 rounded-full border border-gray-200 text-sm shadow-sm">
            จัดการฐานข้อมูลสินค้า
          </span>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-bold mb-4">เพิ่มสินค้าใหม่</h2>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
            
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm text-gray-600 mb-1">ชื่อสินค้า</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:border-red-500" 
                placeholder="เช่น น้ำมันพืช" />
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm text-gray-600 mb-1">หมวดหมู่</label>
              <input type="text" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:border-red-500" 
                placeholder="เช่น เครื่องปรุง" />
            </div>

            <div className="w-24">
              <label className="block text-sm text-gray-600 mb-1">หน่วยนับ</label>
              <input type="text" required value={unit} onChange={(e) => setUnit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:border-red-500" 
                placeholder="แกลลอน" />
            </div>

            <div className="w-24">
              <label className="block text-sm text-gray-600 mb-1">ห้ามเกิน</label>
              <input type="number" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:border-red-500" />
            </div>

            <div className="w-24">
              <label className="block text-sm text-gray-600 mb-1">ขั้นต่ำ</label>
              <input type="number" required value={minLimit} onChange={(e) => setMinLimit(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:border-red-500" />
            </div>

            <button type="submit" disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
              {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตาราง'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-sm">
                <th className="p-4 font-medium">ชื่อสินค้า</th>
                <th className="p-4 font-medium">หมวดหมู่</th>
                <th className="p-4 font-medium">หน่วย</th>
                <th className="p-4 font-medium text-center">ห้ามเกิน</th>
                <th className="p-4 font-medium text-center">ขั้นต่ำ</th>
                <th className="p-4 font-medium text-center">จัดการ</th> {/* 🔴 เพิ่มคอลัมน์จัดการ */}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">ยังไม่มีรายการสินค้า</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4 font-medium">{product.name}</td>
                    <td className="p-4 text-gray-600">{product.categories?.name || '-'}</td>
                    <td className="p-4 text-gray-600">{product.unit}</td>
                    <td className="p-4 text-center text-blue-500 font-medium">{product.max_limit || '-'}</td>
                    <td className="p-4 text-center text-red-500 font-medium">{product.min_limit || '-'}</td>
                    <td className="p-4 text-center">
                      {/* 🔴 เพิ่มปุ่มลบรายการ */}
                      <button 
                        onClick={() => handleDelete(product.id, product.name)}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
                        ลบรายการ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}