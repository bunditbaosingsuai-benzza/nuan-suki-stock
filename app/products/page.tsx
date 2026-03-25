'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Category { name: string; }
interface Product {
  id: number;
  name: string;
  unit: string;
  max_limit: number | null;
  min_limit: number | null;
  category_id: number | null;
  raw_material_id: number | null; 
  hide_used: boolean | null;
  categories: Category | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [unit, setUnit] = useState('')
  const [maxLimit, setMaxLimit] = useState('')
  const [minLimit, setMinLimit] = useState('')
  const [rawMaterialId, setRawMaterialId] = useState<string>('') 
  const [hideUsed, setHideUsed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 🔴 State สำหรับ Popup เลือกหมวดหมู่ และ หน่วยนับ
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false)
  const [newUnitInput, setNewUnitInput] = useState('')

  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editMaxLimit, setEditMaxLimit] = useState('')
  const [editMinLimit, setEditMinLimit] = useState('')
  const [editRawMaterialId, setEditRawMaterialId] = useState<string>('') 
  const [editHideUsed, setEditHideUsed] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null; name: string }>({ isOpen: false, id: null, name: '' })
  const today = new Date()

  const [activeCategory, setActiveCategory] = useState<string>('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select(`*, categories ( name )`).order('id', { ascending: false })
    if (data) setProducts(data as Product[])
  }

  useEffect(() => { fetchProducts() }, [])

  const generateItemCode = (id: number) => `ITM-${String(id).padStart(3, '0')}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryName) return alert('กรุณาเลือกหรือกรอกหมวดหมู่')
    if (!unit) return alert('กรุณาเลือกหรือกรอกหน่วยนับ')
    
    setIsSubmitting(true)
    try {
      let categoryId = null
      if (categoryName) {
        const { data: existingCat } = await supabase.from('categories').select('id').eq('name', categoryName).single()
        if (existingCat) categoryId = existingCat.id
        else {
          const { data: newCat, error: catError } = await supabase.from('categories').insert([{ name: categoryName }]).select('id').single()
          if (catError) throw catError; if (newCat) categoryId = newCat.id
        }
      }
      const { error: prodError } = await supabase.from('products').insert([{ name, category_id: categoryId, unit, max_limit: maxLimit ? parseFloat(maxLimit) : null, min_limit: minLimit ? parseFloat(minLimit) : null, raw_material_id: rawMaterialId ? parseInt(rawMaterialId) : null, hide_used: hideUsed }])
      if (prodError) throw prodError
      setName(''); setCategoryName(''); setUnit(''); setMaxLimit(''); setMinLimit(''); setRawMaterialId(''); setHideUsed(false);
      fetchProducts()
    } catch (error: any) { alert('❌ เกิดข้อผิดพลาด: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const handleSaveProduct = async (id: number) => {
    try {
      let categoryId = null
      if (editCategoryName) {
        const { data: existingCat } = await supabase.from('categories').select('id').eq('name', editCategoryName).single()
        if (existingCat) categoryId = existingCat.id
        else {
          const { data: newCat, error: catError } = await supabase.from('categories').insert([{ name: editCategoryName }]).select('id').single()
          if (catError) throw catError; if (newCat) categoryId = newCat.id
        }
      }
      const { error } = await supabase.from('products').update({ name: editName, category_id: categoryId, unit: editUnit, max_limit: editMaxLimit === '' ? null : parseFloat(editMaxLimit), min_limit: editMinLimit === '' ? null : parseFloat(editMinLimit), raw_material_id: editRawMaterialId === '' ? null : parseInt(editRawMaterialId), hide_used: editHideUsed }).eq('id', id)
      if (error) throw error
      setEditingProductId(null)
      fetchProducts()
    } catch (error: any) { alert('❌ อัปเดตไม่สำเร็จ: ' + error.message) }
  }

  const executeDelete = async () => {
    if (!deleteModal.id) return
    try {
      await supabase.from('products').delete().eq('id', deleteModal.id)
      setDeleteModal({ isOpen: false, id: null, name: '' })
      fetchProducts()
    } catch (error: any) { alert('❌ ไม่สามารถลบได้: ' + error.message) }
  }

  const groupedProducts = products.reduce((acc, product) => {
    const cat = product.categories?.name || 'ไม่มีหมวดหมู่';
    if (!acc[cat]) acc[cat] = []; acc[cat].push(product); return acc;
  }, {} as Record<string, Product[]>);

  const rawMaterialOptions = products.filter(p => p.min_limit !== null)
  
  // ดึงรายการหมวดหมู่และหน่วยนับที่มีอยู่แล้วในระบบเพื่อมาโชว์ใน Popup
  const categoriesList = Object.keys(groupedProducts).filter(c => c !== 'ไม่มีหมวดหมู่');
  const uniqueUnits = Array.from(new Set(products.map(p => p.unit).filter(Boolean)));

  const handleScroll = () => {
    if (!tableContainerRef.current) return;
    const container = tableContainerRef.current;
    const scrollPosition = container.scrollTop + 60; 

    let currentActive = '';
    for (const cat of Object.keys(groupedProducts)) {
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">รายการสินค้า</h1>
        <div className="bg-white px-4 sm:px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit">{today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-4 lg:gap-6">
          <div className="flex-1 min-w-full sm:min-w-[200px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อสินค้า</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] focus:ring-1 focus:ring-[#df2323] transition-colors text-sm sm:text-base" placeholder="เช่น น้ำมันพืช" />
          </div>

          {/* 🔴 เปลี่ยน Input หมวดหมู่ เป็นปุ่มเปิด Popup */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">หมวดหมู่</label>
            <div 
              onClick={() => setIsCategoryModalOpen(true)}
              className={`w-full border rounded-xl p-3 cursor-pointer transition-colors text-sm sm:text-base flex justify-between items-center ${categoryName ? 'border-[#df2323] bg-white text-gray-900 font-bold' : 'border-[#df2323] bg-white text-gray-400'}`}
            >
              <span>{categoryName || 'เลือกหมวดหมู่...'}</span>
              <span className="text-gray-400 text-xs">▼</span>
            </div>
          </div>

          {/* 🔴 เปลี่ยน Input หน่วยนับ เป็นปุ่มเปิด Popup */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-2">หน่วยนับ</label>
            <div 
              onClick={() => setIsUnitModalOpen(true)}
              className={`w-full border rounded-xl p-3 cursor-pointer transition-colors text-sm sm:text-base flex justify-between items-center ${unit ? 'border-[#df2323] bg-white text-gray-900 font-bold' : 'border-[#df2323] bg-white text-gray-400'}`}
            >
              <span>{unit || 'เลือกหน่วยนับ...'}</span>
              <span className="text-gray-400 text-xs">▼</span>
            </div>
          </div>

          <div className="w-full sm:w-24">
            <label className="block text-sm font-bold text-gray-700 mb-2">ห้ามเกิน</label>
            <input type="number" step="any" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm sm:text-base" placeholder="Max" />
          </div>
          <div className="w-full sm:w-24">
            <label className="block text-sm font-bold text-gray-700 mb-2">ขั้นต่ำ</label>
            <input type="number" step="any" value={minLimit} onChange={(e) => setMinLimit(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm sm:text-base" placeholder="Min" />
          </div>
          <div className="flex-1 min-w-full sm:min-w-[150px]">
            <label className="block text-sm font-bold text-blue-600 mb-2">ผูกกับของสด</label>
            <select value={rawMaterialId} onChange={(e) => setRawMaterialId(e.target.value)} className="w-full border border-blue-200 bg-blue-50/50 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors text-sm sm:text-base text-gray-700">
              <option value="">-- ไม่มีการผูก --</option>
              {rawMaterialOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="w-full lg:w-auto flex items-center gap-2 bg-gray-50 px-4 py-3.5 rounded-xl border border-gray-200 h-[52px]">
            <input type="checkbox" id="hideUsedCheckbox" checked={hideUsed} onChange={(e) => setHideUsed(e.target.checked)} className="w-5 h-5 text-[#df2323] rounded border-gray-300 focus:ring-[#df2323] cursor-pointer" />
            <label htmlFor="hideUsedCheckbox" className="text-sm font-bold text-gray-700 cursor-pointer select-none">ซ่อนยอดใช้ไป</label>
          </div>
          <button type="submit" disabled={isSubmitting} className="bg-[#059669] hover:bg-[#047857] text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[52px] w-full xl:w-auto">
            {isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตาราง'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[75vh] min-h-[500px]">
        <div className="bg-white border-b border-gray-100 flex overflow-x-auto custom-scrollbar flex-shrink-0 relative z-50 shadow-sm p-2 gap-2 px-4 items-center">
          {Object.keys(groupedProducts).map(cat => (
            <button 
              key={cat}
              onClick={() => scrollToCategory(cat)}
              className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-all border border-transparent ${activeCategory === cat ? 'bg-[#df2323] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div ref={tableContainerRef} onScroll={handleScroll} className="overflow-auto flex-1 custom-scrollbar relative bg-gray-50/30 scroll-smooth">
          <table className="w-full text-center border-collapse">
            <thead className="sticky top-0 z-30 shadow-sm">
              <tr className="text-sm border-b border-gray-200 bg-[#f8f9fa]">
                <th className="p-5 font-bold text-gray-700 text-left sticky left-0 z-40 bg-[#f8f9fa] border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">รายการสินค้า</th>
                <th className="p-5 font-bold text-gray-700 bg-[#f8f9fa]">หน่วย</th>
                <th className="p-5 font-bold text-blue-600 bg-[#f8f9fa]">ผูกกับของสด</th>
                <th className="p-5 font-bold text-gray-700 bg-[#f8f9fa]">ห้ามเกิน / ขั้นต่ำ</th>
                <th className="p-5 font-bold text-gray-700 text-right bg-[#f8f9fa]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {products.length === 0 ? (<tr><td colSpan={5} className="p-12 text-gray-400">ยังไม่มีรายการสินค้าในระบบ</td></tr>) : (
                Object.entries(groupedProducts).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr ref={(el) => { categoryRefs.current[category] = el; }} className="bg-gray-100 border-y border-gray-200">
                      <td className="p-3 pl-6 text-left font-bold text-gray-800 text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">📂 {category}</td>
                      <td colSpan={4} className="bg-gray-100"></td>
                    </tr>
                    {items.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors group">
                        {editingProductId === product.id ? (
                          <>
                            <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                              <input type="text" className="w-full border-2 border-blue-400 rounded-lg p-2 font-bold focus:outline-none mb-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
                              <div className="flex gap-2">
                                <input type="text" className="w-1/3 border-2 border-blue-200 rounded-lg p-2 text-xs focus:outline-none" placeholder="หมวดหมู่..." value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
                                <input type="text" className="w-1/3 border-2 border-blue-200 rounded-lg p-2 text-xs text-center focus:outline-none" placeholder="หน่วยนับ..." value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                                <label className="flex items-center justify-center gap-1.5 cursor-pointer bg-red-50 px-2 py-1 rounded-lg border border-red-100 w-1/3">
                                  <input type="checkbox" checked={editHideUsed} onChange={(e) => setEditHideUsed(e.target.checked)} className="w-3.5 h-3.5 text-[#df2323] rounded focus:ring-[#df2323]" />
                                  <span className="text-[10px] font-bold text-red-600">ซ่อนยอด</span>
                                </label>
                              </div>
                            </td>
                            <td className="p-3"><input type="text" className="w-20 border-2 border-blue-400 rounded-lg p-2 text-center focus:outline-none" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} /></td>
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
                            <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors">
                              <div className="font-bold text-gray-800 text-[15px]">{product.name}</div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">{product.unit}</span>
                                {product.hide_used && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 shadow-sm">🚫 ซ่อนยอด</span>}
                              </div>
                            </td>
                            <td className="p-4 font-semibold text-gray-600">{product.unit}</td>
                            <td className="p-4 font-semibold text-blue-600">{product.raw_material_id ? products.find(p => p.id === product.raw_material_id)?.name || '-' : '-'}</td>
                            <td className="p-4 font-bold"><span className="text-[#3b82f6] mr-2">Max: {product.max_limit !== null ? product.max_limit : '-'}</span><span className="text-[#df2323]">Min: {product.min_limit !== null ? product.min_limit : '-'}</span></td>
                            <td className="p-4 text-right">
                              <div className="flex flex-col gap-1.5 items-end">
                                <button onClick={() => { setEditingProductId(product.id); setEditName(product.name); setEditCategoryName(product.categories?.name || ''); setEditUnit(product.unit || ''); setEditMaxLimit(product.max_limit !== null ? String(product.max_limit) : ''); setEditMinLimit(product.min_limit !== null ? String(product.min_limit) : ''); setEditRawMaterialId(product.raw_material_id !== null ? String(product.raw_material_id) : ''); setEditHideUsed(product.hide_used || false); }} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs px-4 py-1.5 rounded-full font-semibold">✏️ แก้ไข</button>
                                <button onClick={() => setDeleteModal({ isOpen: true, id: product.id, name: product.name })} className="bg-[#be123c] text-white hover:bg-[#9f1239] text-xs px-4 py-1.5 rounded-full font-semibold">ลบรายการ</button>
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

      {/* Popup ยืนยันการลบ */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity">
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

      {/* ========================================================= */}
      {/* 🔴 Modal เลือกหมวดหมู่ (Theme สีน้ำเงิน) */}
      {/* ========================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200">
            {/* Header */}
            <div className="bg-[#4f46e5] p-4 px-6 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">📚 เลือกหมวดหมู่</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-4">หมวดหมู่ที่มีอยู่ในระบบ:</p>
                <div className="flex flex-wrap gap-2.5">
                  {categoriesList.length === 0 ? <span className="text-sm text-gray-400">ยังไม่มีหมวดหมู่ในระบบ</span> : categoriesList.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => { setCategoryName(cat); setIsCategoryModalOpen(false); }} 
                      className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:border-[#4f46e5] hover:text-[#4f46e5] hover:bg-indigo-50 font-bold bg-white shadow-sm transition-all text-sm"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm font-bold text-gray-700 mb-3">สร้างหมวดหมู่ใหม่</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={newCategoryInput} 
                  onChange={(e) => setNewCategoryInput(e.target.value)} 
                  placeholder="พิมพ์หมวดหมู่ใหม่..." 
                  className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4f46e5] font-medium" 
                />
                <div className="flex gap-2">
                  <button onClick={() => setNewCategoryInput('')} className="bg-[#df2323] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors">
                    <span className="text-lg leading-none">⛔</span> ลบ
                  </button>
                  <button 
                    onClick={() => { 
                      if(newCategoryInput.trim()) { setCategoryName(newCategoryInput.trim()); setIsCategoryModalOpen(false); setNewCategoryInput(''); } 
                    }} 
                    className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <span className="text-lg leading-none">➕</span> เพิ่ม
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🔴 Modal เลือกหน่วยนับ (Theme สีเขียว) */}
      {/* ========================================================= */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200">
            {/* Header */}
            <div className="bg-[#059669] p-4 px-6 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">⚖️ เลือกหน่วยนับ</h2>
              <button onClick={() => setIsUnitModalOpen(false)} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-4">หน่วยนับที่มีอยู่ในระบบ:</p>
                <div className="flex flex-wrap gap-2.5">
                  {uniqueUnits.length === 0 ? <span className="text-sm text-gray-400">ยังไม่มีหน่วยนับในระบบ</span> : uniqueUnits.map(u => (
                    <button 
                      key={u}
                      onClick={() => { setUnit(u); setIsUnitModalOpen(false); }} 
                      className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:border-[#059669] hover:text-[#059669] hover:bg-emerald-50 font-bold bg-white shadow-sm transition-all text-sm"
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm font-bold text-gray-700 mb-3">สร้างหน่วยนับใหม่</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={newUnitInput} 
                  onChange={(e) => setNewUnitInput(e.target.value)} 
                  placeholder="พิมพ์หน่วยนับใหม่..." 
                  className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#059669] font-medium" 
                />
                <div className="flex gap-2">
                  <button onClick={() => setNewUnitInput('')} className="bg-[#df2323] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors">
                    <span className="text-lg leading-none">⛔</span> ลบ
                  </button>
                  <button 
                    onClick={() => { 
                      if(newUnitInput.trim()) { setUnit(newUnitInput.trim()); setIsUnitModalOpen(false); setNewUnitInput(''); } 
                    }} 
                    className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <span className="text-lg leading-none">➕</span> เพิ่ม
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}