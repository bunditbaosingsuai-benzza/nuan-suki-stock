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
  max_limit: number | null;
  min_limit: number | null;
  category_id: number | null;
  raw_material_id: number | null; // 🔴 เพิ่มฟิลด์เชื่อมโยงของเหยา
  categories: Category | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [unit, setUnit] = useState('')
  const [maxLimit, setMaxLimit] = useState('')
  const [minLimit, setMinLimit] = useState('')
  const [rawMaterialId, setRawMaterialId] = useState<string>('') // 🔴 State ของเหยา
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editMaxLimit, setEditMaxLimit] = useState('')
  const [editMinLimit, setEditMinLimit] = useState('')
  const [editRawMaterialId, setEditRawMaterialId] = useState<string>('') // 🔴 State แก้ไขของเหยา

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
    
    if (data) setProducts(data as Product[])
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
        const { data: existingCat } = await supabase.from('categories').select('id').eq('name', categoryName).single()
        if (existingCat) {
          categoryId = existingCat.id
        } else {
          const { data: newCat, error: catError } = await supabase.from('categories').insert([{ name: categoryName }]).select('id').single()
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
          max_limit: maxLimit ? parseFloat(maxLimit) : null,
          min_limit: minLimit ? parseFloat(minLimit) : null,
          raw_material_id: rawMaterialId ? parseInt(rawMaterialId) : null // 🔴 บันทึกค่าที่เชื่อมกัน
        }])

      if (prodError) throw prodError

      setName('')
      setCategoryName('')
      setUnit('')
      setMaxLimit('')
      setMinLimit('')
      setRawMaterialId('')
      fetchProducts()
      
    } catch (error: any) {
      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveProduct = async (id: number) => {
    try {
      let categoryId = null

      if (editCategoryName) {
        const { data: existingCat } = await supabase.from('categories').select('id').eq('name', editCategoryName).single()
        if (existingCat) {
          categoryId = existingCat.id
        } else {
          const { data: newCat, error: catError } = await supabase.from('categories').insert([{ name: editCategoryName }]).select('id').single()
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
          max_limit: editMaxLimit === '' ? null : parseFloat(editMaxLimit),
          min_limit: editMinLimit === '' ? null : parseFloat(editMinLimit),
          raw_material_id: editRawMaterialId === '' ? null : parseInt(editRawMaterialId) // 🔴 อัปเดตค่าเชื่อมโยง
        })
        .eq('id', id)

      if (error) throw error

      setEditingProductId(null)
      fetchProducts()
    } catch (error: any) {
      alert('❌ อัปเดตไม่สำเร็จ: ' + error.message)
    }
  }

  const confirmDelete = (id: number, productName: string) => {
    setDeleteModal({ isOpen: true, id: id, name: productName })
  }

  const executeDelete = async () => {
    if (!deleteModal.id) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', deleteModal.id)
      if (error) throw error
      setDeleteModal({ isOpen: false, id: null, name: '' })
      fetchProducts()
    } catch (error: any) {
      alert('❌ ไม่สามารถลบได้: ' + error.message)
    }
  }

  const groupedProducts = products.reduce((acc, product) => {
    const cat = product.categories?.name || 'ไม่มีหมวดหมู่';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // 🔴 ดึงเฉพาะรายการสินค้าหลักมาให้เลือกเป็น "ของสด"
  const rawMaterialOptions = products.filter(p => p.min_limit !== null)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">รายการสินค้า</h1>
        <div className="bg-white px-4 sm:px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit">
          {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">เพิ่มสินค้าใหม่</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-4 lg:gap-6">
          <div className="flex-1 min-w-full sm:min-w-[200px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อสินค้า</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] focus:ring-1 focus:ring-[#df2323] transition-colors text-sm sm:text-base" placeholder="เช่น น้ำมันพืช" />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">หมวดหมู่</label>
            <input type="text" required value={categoryName} onChange={(e) => setCategoryName(e.target.value)}
              className="w-full border border-[#df2323] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#df2323] transition-colors text-sm sm:text-base" placeholder="เช่น เครื่องปรุง" />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">หน่วยนับ</label>
            <input type="text" required value={unit} onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-[#df2323] rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#df2323] transition-colors text-sm sm:text-base" placeholder="เช่น แกลลอน" />
          </div>

          <div className="w-full sm:w-32">
            <label className="block text-sm font-bold text-gray-700 mb-2">ห้ามเกิน</label>
            <input type="number" step="any" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm sm:text-base" placeholder="15" />
          </div>

          <div className="w-full sm:w-32">
            <label className="block text-sm font-bold text-gray-700 mb-2">ขั้นต่ำ</label>
            <input type="number" step="any" value={minLimit} onChange={(e) => setMinLimit(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm sm:text-base" placeholder="5" />
          </div>

          {/* 🔴 Dropdown ให้เลือกผูกของสดกับของเหยา */}
          <div className="flex-1 min-w-full sm:min-w-[200px]">
            <label className="block text-sm font-bold text-blue-600 mb-2">ผูกกับของสด (ถ้าเป็นของเหยา)</label>
            <select value={rawMaterialId} onChange={(e) => setRawMaterialId(e.target.value)}
              className="w-full border border-blue-200 bg-blue-50/50 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors text-sm sm:text-base text-gray-700">
              <option value="">-- ไม่มีการผูก --</option>
              {rawMaterialOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={isSubmitting}
            className="bg-[#059669] hover:bg-[#047857] text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[52px] w-full lg:w-full">
            {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตาราง'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="text-sm border-b border-gray-200 bg-[#f8f9fa]">
                <th className="p-5 font-bold text-gray-700 text-left">ชื่อสินค้า / หมวดหมู่</th>
                <th className="p-5 font-bold text-gray-700">หน่วย</th>
                <th className="p-5 font-bold text-blue-600">ผูกกับของสด</th>
                <th className="p-5 font-bold text-gray-700">ห้ามเกิน / ขั้นต่ำ</th>
                <th className="p-5 font-bold text-gray-700 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-gray-400">ยังไม่มีรายการสินค้าในระบบ</td></tr>
              ) : (
                Object.entries(groupedProducts).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr className="bg-gray-100 border-y border-gray-200">
                      <td colSpan={5} className="p-3 pl-6 text-left font-bold text-gray-800 text-sm">📂 {category}</td>
                    </tr>
                    {items.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                        {editingProductId === product.id ? (
                          <>
                            <td className="p-3 text-left">
                              <input type="text" className="w-full border-2 border-blue-400 rounded-lg p-2 font-bold focus:outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} />
                              <input type="text" className="w-full border-2 border-blue-200 rounded-lg p-2 mt-2 text-xs focus:outline-none" placeholder="หมวดหมู่..." value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
                            </td>
                            <td className="p-3"><input type="text" className="w-20 border-2 border-blue-400 rounded-lg p-2 text-center focus:outline-none" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} /></td>
                            
                            {/* 🔴 แก้ไขการผูกของสด */}
                            <td className="p-3">
                              <select value={editRawMaterialId} onChange={(e) => setEditRawMaterialId(e.target.value)} className="w-full border-2 border-blue-300 bg-blue-50 rounded-lg p-2 text-sm focus:outline-none text-gray-700">
                                <option value="">-- ไม่ผูก --</option>
                                {rawMaterialOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </td>

                            <td className="p-3 flex gap-2 justify-center">
                              <input type="number" step="any" className="w-16 border-2 border-blue-400 rounded-lg p-2 text-center text-[#3b82f6] focus:outline-none" placeholder="Max" value={editMaxLimit} onChange={(e) => setEditMaxLimit(e.target.value)} />
                              <input type="number" step="any" className="w-16 border-2 border-[#df2323] rounded-lg p-2 text-center text-[#df2323] focus:outline-none" placeholder="Min" value={editMinLimit} onChange={(e) => setEditMinLimit(e.target.value)} />
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex flex-col gap-1 items-end">
                                <button onClick={() => handleSaveProduct(product.id)} className="bg-blue-600 text-white text-[11px] px-3 py-1.5 rounded-lg font-bold w-16">บันทึก</button>
                                <button onClick={() => setEditingProductId(null)} className="bg-gray-200 text-gray-600 text-[11px] px-3 py-1.5 rounded-lg font-bold w-16">ยกเลิก</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-5 text-left">
                              <div className="font-bold text-gray-800">{product.name}</div>
                              <div className="text-xs text-gray-500">{generateItemCode(product.id)}</div>
                            </td>
                            <td className="p-5 font-semibold text-gray-600">{product.unit}</td>
                            
                            {/* 🔴 แสดงว่าผูกกับของสดตัวไหนอยู่ */}
                            <td className="p-5 font-semibold text-blue-600">
                              {product.raw_material_id ? products.find(p => p.id === product.raw_material_id)?.name || '-' : '-'}
                            </td>

                            <td className="p-5 font-bold">
                              <span className="text-[#3b82f6] mr-2">Max: {product.max_limit !== null ? product.max_limit : '-'}</span>
                              <span className="text-[#df2323]">Min: {product.min_limit !== null ? product.min_limit : '-'}</span>
                            </td>
                            <td className="p-5 text-right">
                              <div className="flex flex-col gap-1.5 items-end">
                                <button onClick={() => { setEditingProductId(product.id); setEditName(product.name); setEditCategoryName(product.categories?.name || ''); setEditUnit(product.unit || ''); setEditMaxLimit(product.max_limit !== null ? String(product.max_limit) : ''); setEditMinLimit(product.min_limit !== null ? String(product.min_limit) : ''); setEditRawMaterialId(product.raw_material_id !== null ? String(product.raw_material_id) : ''); }} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs px-4 py-1.5 rounded-full font-semibold">✏️ แก้ไข</button>
                                <button onClick={() => confirmDelete(product.id, product.name)} className="bg-[#be123c] text-white hover:bg-[#9f1239] text-xs px-4 py-1.5 rounded-full font-semibold">ลบรายการ</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ลบรายการสินค้า?</h3>
            <p className="text-gray-500 mb-8">คุณแน่ใจหรือไม่ที่จะลบ<br /><span className="font-bold text-[#df2323] text-lg">"{deleteModal.name}"</span></p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDeleteModal({ isOpen: false, id: null, name: '' })} className="flex-1 bg-gray-100 font-bold py-3.5 rounded-xl">ยกเลิก</button>
              <button onClick={executeDelete} className="flex-1 bg-[#df2323] text-white font-bold py-3.5 rounded-xl">ลบเลย!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}