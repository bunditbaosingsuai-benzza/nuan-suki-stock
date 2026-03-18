'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  
  // State สำหรับฟอร์มเพิ่มสินค้าใหม่
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [unit, setUnit] = useState('')
  const [maxLimit, setMaxLimit] = useState('')
  const [minLimit, setMinLimit] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State สำหรับโหมดแก้ไขในตาราง
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editMaxLimit, setEditMaxLimit] = useState('')
  const [editMinLimit, setEditMinLimit] = useState('')

  // 🔴 State สำหรับ Pop-up ยืนยันการลบ
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null; name: string }>({
    isOpen: false,
    id: null,
    name: ''
  })

  const today = new Date()

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`*, categories ( name )`)
      .order('id', { ascending: false })
    
    if (data) setProducts(data)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const generateItemCode = (id: number) => {
    return `ITM-${String(id).padStart(3, '0')}`
  }

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

  const handleSaveProduct = async (id: number) => {
    try {
      let categoryId = null

      if (editCategoryName) {
        const { data: existingCat } = await supabase
          .from('categories')
          .select('id')
          .eq('name', editCategoryName)
          .single()

        if (existingCat) {
          categoryId = existingCat.id
        } else {
          const { data: newCat, error: catError } = await supabase
            .from('categories')
            .insert([{ name: editCategoryName }])
            .select('id')
            .single()
            
          if (catError) throw catError
          if (newCat) categoryId = newCat.id
        }
      }

      const { error } = await supabase
        .from('products')
        .update({
          name: editName,
          category_id: categoryId,
          unit: editUnit,
          max_limit: editMaxLimit === '' ? null : parseInt(editMaxLimit),
          min_limit: editMinLimit === '' ? null : parseInt(editMinLimit)
        })
        .eq('id', id)

      if (error) throw error

      setEditingProductId(null)
      fetchProducts()
    } catch (error: any) {
      alert('❌ อัปเดตไม่สำเร็จ: ' + error.message)
    }
  }

  // 🔴 1. ฟังก์ชันเปิด Pop-up แทนการใช้ alert ของเบราว์เซอร์
  const confirmDelete = (id: number, productName: string) => {
    setDeleteModal({ isOpen: true, id: id, name: productName })
  }

  // 🔴 2. ฟังก์ชันทำการลบจริงๆ (จะถูกเรียกเมื่อกด "ใช่, ลบเลย!" ใน Pop-up)
  const executeDelete = async () => {
    if (!deleteModal.id) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteModal.id)

      if (error) throw error
      
      // ลบเสร็จให้ปิด Pop-up และดึงข้อมูลใหม่
      setDeleteModal({ isOpen: false, id: null, name: '' })
      fetchProducts()
    } catch (error: any) {
      console.error('Error deleting:', error)
      alert('❌ ไม่สามารถลบได้: ' + error.message)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      
      {/* ส่วนหัว */}
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-[#df2323]">รายการสินค้า</h1>
        <div className="bg-white px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm">
          {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* ฟอร์มเพิ่มสินค้า */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">เพิ่มสินค้าใหม่</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อสินค้า</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] focus:ring-1 focus:ring-[#df2323] transition-colors" 
              placeholder="เช่น น้ำมันพืช" />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">หมวดหมู่</label>
            <input type="text" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)}
              className="w-full border border-[#df2323] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#df2323] transition-colors" 
              placeholder="เช่น เครื่องปรุง" />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">หน่วยนับ</label>
            <input type="text" required value={unit} onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-[#df2323] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#df2323] transition-colors" 
              placeholder="เช่น แกลลอน" />
          </div>

          <div className="w-32">
            <label className="block text-sm font-bold text-gray-700 mb-2">ห้ามเกิน</label>
            <input type="number" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors" placeholder="15" />
          </div>

          <div className="w-32">
            <label className="block text-sm font-bold text-gray-700 mb-2">ขั้นต่ำ</label>
            <input type="number" required value={minLimit} onChange={(e) => setMinLimit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors" placeholder="5" />
          </div>

          <button type="submit" disabled={isSubmitting}
            className="bg-[#059669] hover:bg-[#047857] text-white px-8 py-3.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[52px]">
            {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตาราง'}
          </button>
        </form>
      </div>

      {/* ตารางสินค้า */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="text-sm border-b border-gray-200 bg-[#f8f9fa]">
                <th className="p-5 font-bold text-gray-700">รหัส</th>
                <th className="p-5 font-bold text-gray-700 text-left">ชื่อสินค้า</th>
                <th className="p-5 font-bold text-gray-700">หมวดหมู่</th>
                <th className="p-5 font-bold text-gray-700">หน่วย</th>
                <th className="p-5 font-bold text-gray-700">ห้ามเกิน</th>
                <th className="p-5 font-bold text-gray-700">ขั้นต่ำ</th>
                <th className="p-5 font-bold text-gray-700">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-gray-400">ยังไม่มีรายการสินค้าในระบบ</td></tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    
                    {editingProductId === product.id ? (
                      <>
                        <td className="p-3 font-semibold text-gray-500 bg-gray-50">{generateItemCode(product.id)}</td>
                        <td className="p-3 text-left">
                          <input type="text" className="w-full border-2 border-blue-400 rounded-lg p-2 font-bold text-gray-900 focus:outline-none shadow-sm" 
                            value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </td>
                        <td className="p-3">
                          <input type="text" className="w-full border-2 border-blue-400 rounded-lg p-2 font-medium text-gray-900 focus:outline-none shadow-sm" 
                            value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
                        </td>
                        <td className="p-3">
                          <input type="text" className="w-24 border-2 border-blue-400 rounded-lg p-2 text-center font-medium text-gray-900 focus:outline-none shadow-sm" 
                            value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                        </td>
                        <td className="p-3">
                          <input type="number" className="w-20 border-2 border-blue-400 rounded-lg p-2 text-center font-bold text-[#3b82f6] focus:outline-none shadow-sm" 
                            value={editMaxLimit} onChange={(e) => setEditMaxLimit(e.target.value)} />
                        </td>
                        <td className="p-3">
                          <input type="number" className="w-20 border-2 border-[#df2323] rounded-lg p-2 text-center font-bold text-[#df2323] focus:outline-none shadow-sm" 
                            value={editMinLimit} onChange={(e) => setEditMinLimit(e.target.value)} />
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleSaveProduct(product.id)} className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-sm">บันทึก</button>
                            <button onClick={() => setEditingProductId(null)} className="bg-gray-200 text-gray-600 text-xs px-3 py-2 rounded-lg hover:bg-gray-300 font-bold shadow-sm">ยกเลิก</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-5 font-semibold text-gray-600">{generateItemCode(product.id)}</td>
                        <td className="p-5 font-bold text-gray-800 text-left">{product.name}</td>
                        <td className="p-5 font-semibold text-gray-600">{product.categories?.name || '-'}</td>
                        <td className="p-5 font-semibold text-gray-600">{product.unit}</td>
                        <td className="p-5 font-bold text-[#3b82f6] text-lg">{product.max_limit || '-'}</td>
                        <td className="p-5 font-bold text-[#df2323] text-lg">{product.min_limit || '-'}</td>
                        <td className="p-5 text-right flex items-center justify-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingProductId(product.id);
                              setEditName(product.name);
                              setEditCategoryName(product.categories?.name || '');
                              setEditUnit(product.unit || '');
                              setEditMaxLimit(product.max_limit ? String(product.max_limit) : '');
                              setEditMinLimit(product.min_limit ? String(product.min_limit) : '');
                            }}
                            className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs px-4 py-2 rounded-full font-semibold shadow-sm transition-colors"
                          >
                            ✏️ แก้ไข
                          </button>
                          
                          {/* 🔴 3. เปลี่ยนให้ปุ่มลบมาเรียกใช้งาน Pop-up ของเราแทน */}
                          <button 
                            onClick={() => confirmDelete(product.id, product.name)}
                            className="bg-[#be123c] hover:bg-[#9f1239] text-white text-xs px-4 py-2 rounded-full font-semibold shadow-sm transition-colors"
                          >
                            ลบรายการ
                          </button>
                        </td>
                      </>
                    )}

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🔴 ส่วนดีไซน์ Pop-up ยืนยันการลบ (จะโชว์ก็ต่อเมื่อ isOpen เป็น true) */}
      {/* ========================================================= */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            
            {/* ไอคอนเตือนถังขยะ */}
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ลบรายการสินค้า?</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              คุณแน่ใจหรือไม่ที่จะลบ<br />
              <span className="font-bold text-[#df2323] text-lg">"{deleteModal.name}"</span> <br />
              ออกจากระบบ? (ข้อมูลนี้จะถูกลบถาวร)
            </p>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setDeleteModal({ isOpen: false, id: null, name: '' })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors shadow-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 bg-[#df2323] hover:bg-[#b91c1c] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors"
              >
                ใช่, ลบเลย!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}