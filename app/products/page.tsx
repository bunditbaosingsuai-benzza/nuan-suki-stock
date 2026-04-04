'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../context/BranchContext' 

interface Category { name: string; }
interface Product { id: number; name: string; unit: string; max_limit: number | null; min_limit: number | null; category_id: number | null; raw_material_id: number | null; hide_used: boolean | null; order_interval_days: number; categories: Category | null; }

export default function ProductsPage() {
  const { currentBranch } = useBranch() 

  const [products, setProducts] = useState<Product[]>([])
  const [name, setName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [unit, setUnit] = useState('')
  const [maxLimit, setMaxLimit] = useState('')
  const [minLimit, setMinLimit] = useState('')
  const [rawMaterialId, setRawMaterialId] = useState<string>('') 
  const [hideUsed, setHideUsed] = useState(false)
  const [orderInterval, setOrderInterval] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false)
  const [newUnitInput, setNewUnitInput] = useState('')
  const [modalTarget, setModalTarget] = useState<'add' | 'edit'>('add')

  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editMaxLimit, setEditMaxLimit] = useState('')
  const [editMinLimit, setEditMinLimit] = useState('')
  const [editRawMaterialId, setEditRawMaterialId] = useState<string>('') 
  const [editHideUsed, setEditHideUsed] = useState(false)
  const [editOrderInterval, setEditOrderInterval] = useState('0')

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number | null; name: string }>({ isOpen: false, id: null, name: '' })
  const today = new Date()

  const [activeCategory, setActiveCategory] = useState<string>('')
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  
  const horizontalScrollRef = useRef<HTMLDivElement>(null)
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const fetchProducts = async () => {
    if (!currentBranch) return; 
    const { data } = await supabase.from('products').select(`*, categories ( name )`).eq('branch_id', currentBranch.id).order('id', { ascending: false })
    if (data) setProducts(data as Product[])
  }

  useEffect(() => { if (currentBranch) fetchProducts() }, [currentBranch])

  const generateItemCode = (id: number) => `ITM-${String(id).padStart(3, '0')}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryName) return alert('กรุณาเลือกหรือกรอกหมวดหมู่')
    if (!unit) return alert('กรุณาเลือกหรือกรอกหน่วยนับ')
    if (!currentBranch) return alert('ไม่พบข้อมูลสาขา')
    
    setIsSubmitting(true)
    try {
      let categoryId = null
      if (categoryName) {
        const { data: existingCat } = await supabase.from('categories').select('id').eq('name', categoryName).eq('branch_id', currentBranch.id).single()
        if (existingCat) categoryId = existingCat.id
        else {
          const { data: newCat, error: catError } = await supabase.from('categories').insert([{ name: categoryName, branch_id: currentBranch.id }]).select('id').single()
          if (catError) throw catError; if (newCat) categoryId = newCat.id
        }
      }
      const { error: prodError } = await supabase.from('products').insert([{ name, category_id: categoryId, unit, max_limit: maxLimit ? parseFloat(maxLimit) : null, min_limit: minLimit ? parseFloat(minLimit) : null, raw_material_id: rawMaterialId ? parseInt(rawMaterialId) : null, hide_used: hideUsed, order_interval_days: parseInt(orderInterval) || 0, branch_id: currentBranch.id }])
      if (prodError) throw prodError
      setName(''); setCategoryName(''); setUnit(''); setMaxLimit(''); setMinLimit(''); setRawMaterialId(''); setHideUsed(false); setOrderInterval('0');
      fetchProducts()
    } catch (error: any) { alert('❌ เกิดข้อผิดพลาด: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const handleSaveProduct = async (id: number) => {
    if (!currentBranch) return;
    try {
      let categoryId = null
      if (editCategoryName) {
        const { data: existingCat } = await supabase.from('categories').select('id').eq('name', editCategoryName).eq('branch_id', currentBranch.id).single()
        if (existingCat) categoryId = existingCat.id
        else {
          const { data: newCat, error: catError } = await supabase.from('categories').insert([{ name: editCategoryName, branch_id: currentBranch.id }]).select('id').single()
          if (catError) throw catError; if (newCat) categoryId = newCat.id
        }
      }
      const { error } = await supabase.from('products').update({ name: editName, category_id: categoryId, unit: editUnit, max_limit: editMaxLimit === '' ? null : parseFloat(editMaxLimit), min_limit: editMinLimit === '' ? null : parseFloat(editMinLimit), raw_material_id: editRawMaterialId === '' ? null : parseInt(editRawMaterialId), hide_used: editHideUsed, order_interval_days: parseInt(editOrderInterval) || 0 }).eq('id', id)
      if (error) throw error
      setEditingProductId(null)
      fetchProducts()
    } catch (error: any) { alert('❌ อัปเดตไม่สำเร็จ: ' + error.message) }
  }

  const executeDelete = async () => {
    if (!deleteModal.id) return
    try { await supabase.from('products').delete().eq('id', deleteModal.id); setDeleteModal({ isOpen: false, id: null, name: '' }); fetchProducts() } 
    catch (error: any) { alert('❌ ไม่สามารถลบได้: ' + error.message) }
  }

  const groupedProducts = products.reduce((acc, product) => { const cat = product.categories?.name || 'ไม่มีหมวดหมู่'; if (!acc[cat]) acc[cat] = []; acc[cat].push(product); return acc; }, {} as Record<string, Product[]>);
  const rawMaterialOptions = products.filter(p => p.min_limit !== null)
  const categoriesList = Object.keys(groupedProducts).filter(c => c !== 'ไม่มีหมวดหมู่');
  const uniqueUnits = Array.from(new Set(products.map(p => p.unit).filter(Boolean)));

  const handleScroll = () => { if (!tableContainerRef.current) return; const scrollPosition = tableContainerRef.current.scrollTop + 80; let currentActive = ''; for (const cat of Object.keys(groupedProducts)) { const el = categoryRefs.current[cat]; if (el && el.offsetTop <= scrollPosition) currentActive = cat; } if (currentActive && currentActive !== activeCategory) setActiveCategory(currentActive); };
  const scrollToCategory = (cat: string) => { const el = categoryRefs.current[cat]; if (el && tableContainerRef.current) { tableContainerRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 75), behavior: 'smooth' }); setActiveCategory(cat); } };

  useEffect(() => {
    if (activeCategory && horizontalScrollRef.current && categoryBtnRefs.current[activeCategory]) {
      const container = horizontalScrollRef.current;
      const button = categoryBtnRefs.current[activeCategory];
      if (button) {
        const scrollPos = button.offsetLeft - (container.offsetWidth / 2) + (button.offsetWidth / 2);
        container.scrollTo({ left: scrollPos, behavior: 'smooth' });
      }
    }
  }, [activeCategory]);

  const handleSelectCategory = (cat: string) => { if (modalTarget === 'add') setCategoryName(cat); else setEditCategoryName(cat); setIsCategoryModalOpen(false); }
  const handleSelectUnit = (u: string) => { if (modalTarget === 'add') setUnit(u); else setEditUnit(u); setIsUnitModalOpen(false); }

  if (!currentBranch) return <div className="p-8 text-center text-gray-500">กำลังโหลดสาขา...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">รายการสินค้า <span className="text-gray-500 text-lg ml-2">({currentBranch.name})</span></h1>
        <div className="bg-white px-4 sm:px-5 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit">{today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6">เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-4 lg:gap-6">
          <div className="flex-1 min-w-full sm:min-w-[200px]"><label className="block text-sm font-bold text-gray-700 mb-2">ชื่อสินค้า</label><input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] focus:ring-1 focus:ring-[#df2323] transition-colors text-sm sm:text-base" placeholder="เช่น น้ำมันพืช" /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-bold text-gray-700 mb-2">หมวดหมู่</label><div onClick={() => { setModalTarget('add'); setIsCategoryModalOpen(true); }} className={`w-full border rounded-xl p-3 cursor-pointer transition-colors text-sm sm:text-base flex justify-between items-center ${categoryName ? 'border-[#df2323] bg-white text-gray-900 font-bold' : 'border-[#df2323] bg-white text-gray-400'}`}><span>{categoryName || 'เลือกหมวดหมู่...'}</span><span className="text-gray-400 text-xs">▼</span></div></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-bold text-gray-700 mb-2">หน่วยนับ</label><div onClick={() => { setModalTarget('add'); setIsUnitModalOpen(true); }} className={`w-full border rounded-xl p-3 cursor-pointer transition-colors text-sm sm:text-base flex justify-between items-center ${unit ? 'border-[#df2323] bg-white text-gray-900 font-bold' : 'border-[#df2323] bg-white text-gray-400'}`}><span>{unit || 'เลือกหน่วยนับ...'}</span><span className="text-gray-400 text-xs">▼</span></div></div>
          <div className="w-full sm:w-24"><label className="block text-sm font-bold text-gray-700 mb-2">ห้ามเกิน</label><input type="number" step="any" value={maxLimit} onChange={(e) => setMaxLimit(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm sm:text-base" placeholder="Max" /></div>
          <div className="w-full sm:w-24"><label className="block text-sm font-bold text-gray-700 mb-2">ขั้นต่ำ</label><input type="number" step="any" value={minLimit} onChange={(e) => setMinLimit(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm sm:text-base" placeholder="Min" /></div>
          
          <div className="w-full sm:w-24"><label className="block text-sm font-bold text-blue-600 mb-2">เว้นระยะสั่ง</label><input type="number" value={orderInterval} onChange={(e) => setOrderInterval(e.target.value)} className="w-full border border-blue-200 bg-blue-50/30 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors text-sm sm:text-base" placeholder="วัน" /></div>

          <div className="flex-1 min-w-full sm:min-w-[150px]"><label className="block text-sm font-bold text-blue-600 mb-2">ผูกกับของสด</label><select value={rawMaterialId} onChange={(e) => setRawMaterialId(e.target.value)} className="w-full border border-blue-200 bg-blue-50/50 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors text-sm sm:text-base text-gray-700"><option value="">-- ไม่มีการผูก --</option>{rawMaterialOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="w-full lg:w-auto flex items-center gap-2 bg-gray-50 px-4 py-3.5 rounded-xl border border-gray-200 h-[52px]"><input type="checkbox" id="hideUsedCheckbox" checked={hideUsed} onChange={(e) => setHideUsed(e.target.checked)} className="w-5 h-5 text-[#df2323] rounded border-gray-300 focus:ring-[#df2323] cursor-pointer" /><label htmlFor="hideUsedCheckbox" className="text-sm font-bold text-gray-700 cursor-pointer select-none">ซ่อนยอดใช้ไป</label></div>
          <button type="submit" disabled={isSubmitting} className="bg-[#059669] hover:bg-[#047857] text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[52px] w-full xl:w-auto">{isSubmitting ? 'กำลังบันทึก...' : '+ เพิ่มลงตาราง'}</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[75vh] min-h-[500px]">
        <div ref={horizontalScrollRef} className="bg-white border-b border-gray-100 flex overflow-x-auto custom-scrollbar flex-shrink-0 relative z-50 shadow-sm p-2 gap-2 px-4 items-center scroll-smooth">
          {Object.keys(groupedProducts).map(cat => (
            <button key={cat} ref={(el) => { categoryBtnRefs.current[cat] = el; }} onClick={() => scrollToCategory(cat)} className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-full transition-all border border-transparent ${activeCategory === cat ? 'bg-[#df2323] text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div ref={tableContainerRef} onScroll={handleScroll} className="overflow-auto flex-1 custom-scrollbar scroll-smooth bg-gray-50/30">
          <table className="w-full text-center border-collapse">
            <thead className="sticky top-0 z-30 bg-[#f8f9fa] shadow-sm">
              <tr className="text-sm border-b border-gray-200">
                <th className="p-5 font-bold text-gray-700 text-left sticky left-0 top-0 z-40 bg-[#f8f9fa] border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] sm:min-w-[200px] whitespace-nowrap">รายการสินค้า</th>
                <th className="p-5 font-bold text-gray-700 bg-[#f8f9fa] whitespace-nowrap">หน่วย</th>
                <th className="p-5 font-bold text-blue-600 bg-[#f8f9fa] whitespace-nowrap">ผูกกับของสด</th>
                <th className="p-5 font-bold text-gray-700 bg-[#f8f9fa] whitespace-nowrap">ห้ามเกิน / ขั้นต่ำ</th>
                <th className="p-5 font-bold text-blue-600 bg-[#f8f9fa] whitespace-nowrap">เว้นระยะสั่ง</th>
                <th className="p-5 font-bold text-gray-700 text-right bg-[#f8f9fa] whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {products.length === 0 ? (<tr><td colSpan={6} className="p-12 text-gray-400">ยังไม่มีรายการสินค้าในสาขานี้</td></tr>) : (
                Object.entries(groupedProducts).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr ref={(el) => { categoryRefs.current[category] = el; }} className="bg-gray-100 border-y border-gray-200"><td className="p-3 pl-6 text-left font-bold text-gray-800 text-sm sticky left-0 z-20 bg-gray-100 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">📂 {category}</td><td colSpan={5} className="bg-gray-100"></td></tr>
                    {items.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors group">
                        {editingProductId === product.id ? (
                          <>
                            <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors whitespace-nowrap">
                              <input type="text" className="w-full border-2 border-blue-400 rounded-lg p-2.5 font-bold focus:outline-none mb-3 text-[15px]" value={editName} onChange={(e) => setEditName(e.target.value)} />
                              <div className="flex gap-2 items-center">
                                <div onClick={() => { setModalTarget('edit'); setIsCategoryModalOpen(true); }} className="flex-1 border-2 border-blue-200 rounded-lg p-2 text-xs cursor-pointer bg-white flex justify-between items-center text-gray-700"><span className="font-semibold text-indigo-700">{editCategoryName || 'เลือกหมวดหมู่...'}</span><span className="text-blue-300">▼</span></div>
                                <label className="flex items-center justify-center gap-1.5 cursor-pointer bg-red-50 px-2 py-2 rounded-lg border border-red-100"><input type="checkbox" checked={editHideUsed} onChange={(e) => setEditHideUsed(e.target.checked)} className="w-3.5 h-3.5 text-[#df2323] rounded focus:ring-[#df2323]" /><span className="text-[10px] font-bold text-red-600">ซ่อนยอด</span></label>
                              </div>
                            </td>
                            <td className="p-3"><div onClick={() => { setModalTarget('edit'); setIsUnitModalOpen(true); }} className="w-20 mx-auto border-2 border-blue-400 rounded-lg p-2.5 text-center cursor-pointer bg-white text-gray-700 text-sm font-semibold">{editUnit || 'หน่วย...'}</div></td>
                            <td className="p-3"><select value={editRawMaterialId} onChange={(e) => setEditRawMaterialId(e.target.value)} className="w-full border-2 border-blue-300 bg-blue-50 rounded-lg p-2.5 text-sm focus:outline-none text-gray-700 font-semibold"><option value="">-- ไม่ผูก --</option>{rawMaterialOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                            <td className="p-3 flex gap-2 justify-center items-center h-full"><div className="flex flex-col items-center gap-1"><span className="text-[10px] text-gray-500 font-semibold">Max</span><input type="number" step="any" className="w-16 border-2 border-blue-400 rounded-lg p-2 text-center text-[#3b82f6] font-bold focus:outline-none" placeholder="Max" value={editMaxLimit} onChange={(e) => setEditMaxLimit(e.target.value)} /></div><div className="flex flex-col items-center gap-1"><span className="text-[10px] text-gray-500 font-semibold">Min</span><input type="number" step="any" className="w-16 border-2 border-[#df2323] rounded-lg p-2 text-center text-[#df2323] font-bold focus:outline-none" placeholder="Min" value={editMinLimit} onChange={(e) => setEditMinLimit(e.target.value)} /></div></td>
                            
                            <td className="p-3"><div className="flex flex-col items-center gap-1"><span className="text-[10px] text-gray-500 font-semibold">เว้น (วัน)</span><input type="number" className="w-16 border-2 border-blue-400 rounded-lg p-2 text-center text-blue-600 font-bold focus:outline-none" value={editOrderInterval} onChange={(e) => setEditOrderInterval(e.target.value)} /></div></td>
                            <td className="p-3 text-right"><div className="flex flex-col gap-1.5 items-end justify-center h-full"><button onClick={() => handleSaveProduct(product.id)} className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-4 py-2 rounded-lg font-bold w-full transition-colors shadow-sm">บันทึก</button><button onClick={() => setEditingProductId(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] px-4 py-2 rounded-lg font-bold w-full transition-colors">ยกเลิก</button></div></td>
                          </>
                        ) : (
                          <>
                            <td className="p-4 text-left sticky left-0 z-10 bg-white group-hover:bg-gray-50/80 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] transition-colors whitespace-nowrap"><div className="font-bold text-gray-800 text-[15px]">{product.name}</div><div className="flex flex-wrap items-center gap-1.5 mt-2"><span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">{generateItemCode(product.id)}</span>{product.hide_used && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 shadow-sm">🚫 ซ่อนยอด</span>}</div></td>
                            <td className="p-4 font-semibold text-gray-600">{product.unit}</td>
                            <td className="p-4 font-semibold text-blue-600">{product.raw_material_id ? products.find(p => p.id === product.raw_material_id)?.name || '-' : '-'}</td>
                            <td className="p-4 font-bold"><span className="text-[#3b82f6] mr-2">Max: {product.max_limit !== null ? product.max_limit : '-'}</span><span className="text-[#df2323]">Min: {product.min_limit !== null ? product.min_limit : '-'}</span></td>
                            
                            <td className="p-4 font-bold text-blue-600 bg-blue-50/30">{product.order_interval_days > 0 ? `${product.order_interval_days} วัน` : '-'}</td>
                            <td className="p-4 text-right"><div className="flex flex-col gap-1.5 items-end"><button onClick={() => { setEditingProductId(product.id); setEditName(product.name); setEditCategoryName(product.categories?.name || ''); setEditUnit(product.unit || ''); setEditMaxLimit(product.max_limit !== null ? String(product.max_limit) : ''); setEditMinLimit(product.min_limit !== null ? String(product.min_limit) : ''); setEditRawMaterialId(product.raw_material_id !== null ? String(product.raw_material_id) : ''); setEditHideUsed(product.hide_used || false); setEditOrderInterval(String(product.order_interval_days || '0')); }} className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 text-xs px-4 py-1.5 rounded-full font-semibold">✏️ แก้ไข</button><button onClick={() => setDeleteModal({ isOpen: true, id: product.id, name: product.name })} className="bg-[#be123c] text-white hover:bg-[#9f1239] text-xs px-4 py-1.5 rounded-full font-semibold">ลบรายการ</button></div></td>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center"><h3 className="text-2xl font-bold text-gray-900 mb-2">ลบรายการสินค้า?</h3><p className="text-gray-500 mb-8">คุณแน่ใจหรือไม่ที่จะลบ<br /><span className="font-bold text-[#df2323] text-lg">"{deleteModal.name}"</span></p><div className="flex gap-3 w-full"><button onClick={() => setDeleteModal({ isOpen: false, id: null, name: '' })} className="flex-1 bg-gray-100 font-bold py-3.5 rounded-xl">ยกเลิก</button><button onClick={executeDelete} className="flex-1 bg-[#df2323] text-white font-bold py-3.5 rounded-xl">ลบเลย!</button></div></div></div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200">
            <div className="bg-[#4f46e5] p-4 px-6 flex justify-between items-center text-white"><h2 className="text-lg font-bold flex items-center gap-2">📚 เลือกหมวดหมู่</h2><button onClick={() => setIsCategoryModalOpen(false)} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button></div>
            <div className="p-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"><p className="text-sm font-bold text-gray-700 mb-4">หมวดหมู่ที่มีอยู่ในระบบ:</p><div className="flex flex-wrap gap-2.5">{categoriesList.length === 0 ? <span className="text-sm text-gray-400">ยังไม่มีหมวดหมู่ในระบบ</span> : categoriesList.map(cat => (<button key={cat} onClick={() => handleSelectCategory(cat)} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:border-[#4f46e5] hover:text-[#4f46e5] hover:bg-indigo-50 font-bold bg-white shadow-sm transition-all text-sm">{cat}</button>))}</div></div>
              {modalTarget === 'add' && (
                <div className="mt-6"><p className="text-sm font-bold text-gray-700 mb-3">สร้างหมวดหมู่ใหม่</p><div className="flex flex-col sm:flex-row gap-3"><input type="text" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} placeholder="พิมพ์หมวดหมู่ใหม่..." className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4f46e5] font-medium" /><div className="flex gap-2"><button onClick={() => setNewCategoryInput('')} className="bg-[#df2323] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors">⛔ ลบ</button><button onClick={() => { if(newCategoryInput.trim()) { handleSelectCategory(newCategoryInput.trim()); setNewCategoryInput(''); } }} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors">➕ เพิ่ม</button></div></div></div>
              )}
            </div>
          </div>
        </div>
      )}

      {isUnitModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200">
            <div className="bg-[#059669] p-4 px-6 flex justify-between items-center text-white"><h2 className="text-lg font-bold flex items-center gap-2">⚖️ เลือกหน่วยนับ</h2><button onClick={() => setIsUnitModalOpen(false)} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button></div>
            <div className="p-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"><p className="text-sm font-bold text-gray-700 mb-4">หน่วยนับที่มีอยู่ในระบบ:</p><div className="flex flex-wrap gap-2.5">{uniqueUnits.length === 0 ? <span className="text-sm text-gray-400">ยังไม่มีหน่วยนับในระบบ</span> : uniqueUnits.map(u => (<button key={u} onClick={() => handleSelectUnit(u)} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:border-[#059669] hover:text-[#059669] hover:bg-emerald-50 font-bold bg-white shadow-sm transition-all text-sm">{u}</button>))}</div></div>
              {modalTarget === 'add' && (
                <div className="mt-6"><p className="text-sm font-bold text-gray-700 mb-3">สร้างหน่วยนับใหม่</p><div className="flex flex-col sm:flex-row gap-3"><input type="text" value={newUnitInput} onChange={(e) => setNewUnitInput(e.target.value)} placeholder="พิมพ์หน่วยนับใหม่..." className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#059669] font-medium" /><div className="flex gap-2"><button onClick={() => setNewUnitInput('')} className="bg-[#df2323] hover:bg-[#b91c1c] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors">⛔ ลบ</button><button onClick={() => { if(newUnitInput.trim()) { handleSelectUnit(newUnitInput.trim()); setNewUnitInput(''); } }} className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-5 py-3 rounded-xl flex items-center gap-2 transition-colors">➕ เพิ่ม</button></div></div></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}