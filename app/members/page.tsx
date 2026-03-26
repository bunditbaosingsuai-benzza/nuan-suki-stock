'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useUser } from '../context/UserContext'
import { useBranch } from '../context/BranchContext'

interface Profile { id: string; full_name: string; role: 'manager' | 'employee'; branch_id: number; branches?: { name: string }; }

export default function MembersPage() {
  // 🔴 1. ดึง session มาเช็คเพิ่ม
  const { isManager, isLoading: userLoading, session } = useUser() 
  const { branches } = useBranch()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'manager' | 'employee'>('employee')
  const [branchId, setBranchId] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; email: string }>({ isOpen: false, id: null, email: '' })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [successModal, setSuccessModal] = useState(false)
  const [deleteSuccessModal, setDeleteSuccessModal] = useState(false)

  const fetchProfiles = async () => {
    setIsLoading(true)
    const { data } = await supabase.from('profiles').select('*, branches(name)').order('role', { ascending: false })
    if (data) setProfiles(data as Profile[])
    setIsLoading(false)
  }

  useEffect(() => { if (!userLoading && isManager) fetchProfiles() }, [isManager, userLoading])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !branchId) return alert('กรุณากรอกข้อมูลให้ครบถ้วน')
    if (password.length < 6) return alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, branch_id: parseInt(branchId) })
      })
      const result = await res.json()

      if (result.success) {
        setSuccessModal(true) 
        setEmail(''); setPassword(''); setRole('employee'); setBranchId('');
        fetchProfiles()
      } else {
        alert('❌ เกิดข้อผิดพลาด: ' + result.error)
      }
    } catch (error) {
      alert('❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  const executeDelete = async () => {
    if (!deleteModal.id || deleteConfirmText !== 'delete') return;
    setIsDeleting(true)
    try {
      const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteModal.id }) })
      const result = await res.json()
      
      if (result.success) { 
        setDeleteModal({ isOpen: false, id: null, email: '' }); 
        setDeleteConfirmText(''); 
        setDeleteSuccessModal(true); 
        fetchProfiles() 
      } 
      else { alert('❌ เกิดข้อผิดพลาด: ' + result.error) }
    } catch (error) { alert('❌ เชื่อมต่อเซิร์ฟเวอร์ไม่ได้') } 
    finally { setIsDeleting(false) }
  }

  // 🔴 2. ตัวดักเช็คสิทธิ์ที่ปรับปรุงแล้ว
  if (userLoading) return <div className="p-8 text-center text-gray-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (!session) return null; // 🔴 ปิดการกระพริบตอนกดออกจากระบบ (เตะกลับเงียบๆ)
  if (!isManager) return <div className="p-8 text-center text-red-500 font-bold text-xl mt-10">❌ คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;

  const filteredProfiles = profiles.filter(p => p.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b-2 border-gray-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">จัดการสมาชิกในระบบ</h1>
        <div className="bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm w-fit flex items-center gap-2"><span>👤</span> ผู้ใช้งานทั้งหมด {profiles.length} คน</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><span className="text-[#4f46e5]">👤+</span> เพิ่มสมาชิกใหม่</h2>
        <form onSubmit={handleAddUser} className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-end gap-4 lg:gap-6">
          <div className="flex-1 min-w-[200px]"><label className="block text-sm font-bold text-gray-700 mb-2">อีเมล (Email)</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4f46e5] text-sm" placeholder="อีเมลสำหรับล็อกอิน" /></div>
          <div className="flex-1 min-w-[200px]"><label className="block text-sm font-bold text-gray-700 mb-2">รหัสผ่าน</label><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4f46e5] text-sm" placeholder="อย่างน้อย 6 ตัวอักษร" /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-bold text-gray-700 mb-2">เลือกสาขาที่ใช้งาน</label><select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4f46e5] text-sm bg-white cursor-pointer"><option value="" disabled>เลือกสาขา...</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm font-bold text-gray-700 mb-2">สิทธิ์การใช้งาน</label><select value={role} onChange={(e) => setRole(e.target.value as 'manager'|'employee')} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#4f46e5] text-sm bg-white cursor-pointer font-semibold text-gray-700"><option value="employee">พนักงานทั่วไป</option><option value="manager">หัวหน้า (Admin)</option></select></div>
          <button type="submit" disabled={isSubmitting} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-8 py-3 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 h-[50px] w-full xl:w-auto flex items-center justify-center gap-2">{isSubmitting ? 'กำลังเพิ่ม...' : <><span className="text-xl leading-none">+</span> เพิ่มผู้ใช้งาน</>}</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[60vh] min-h-[400px]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><div className="relative w-full max-w-md"><span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400">🔍</span><input type="text" placeholder="ค้นหาผู้ใช้งาน (Email)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:border-[#df2323] text-sm transition-colors" /></div></div>
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-center border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm"><tr className="text-sm border-b border-gray-200"><th className="p-4 font-bold text-gray-700 w-20">ลำดับ</th><th className="p-4 font-bold text-gray-700 text-left min-w-[200px]">ผู้รับ (Email)</th><th className="p-4 font-bold text-gray-700">สาขาที่ใช้งาน</th><th className="p-4 font-bold text-gray-700">สิทธิ์การใช้งาน</th><th className="p-4 font-bold text-gray-700 w-40">จัดการ</th></tr></thead>
            <tbody className="bg-white">
              {isLoading ? (<tr><td colSpan={5} className="p-12 text-gray-400">กำลังโหลด...</td></tr>) : filteredProfiles.length === 0 ? (<tr><td colSpan={5} className="p-12 text-gray-400">ไม่พบผู้ใช้งาน</td></tr>) : (
                filteredProfiles.map((p, index) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{index + 1}</td>
                    <td className="p-4 text-left"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center uppercase shadow-sm border border-white">{p.full_name.charAt(0)}</div><span className="font-semibold text-gray-800">{p.full_name}</span></div></td>
                    <td className="p-4"><span className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-bold border border-gray-200">{p.branches?.name || 'ไม่ระบุสาขา'}</span></td>
                    <td className="p-4">{p.role === 'manager' ? (<span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-xs font-bold border border-purple-200 flex items-center justify-center gap-1.5 w-fit mx-auto"><span>🛡️</span> หัวหน้า (Admin)</span>) : (<span className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full text-xs font-bold border border-gray-200 flex items-center justify-center gap-1.5 w-fit mx-auto"><span>👤</span> พนักงานทั่วไป</span>)}</td>
                    <td className="p-4"><div className="flex items-center justify-center gap-2"><button onClick={() => setDeleteModal({ isOpen: true, id: p.id, email: p.full_name })} className="bg-[#e11d48] hover:bg-[#be123c] text-white text-[11px] px-4 py-2 rounded-lg font-bold shadow-sm transition-colors">ลบบัญชี</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"><div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all"><div className="bg-[#be123c] p-4 px-6 flex justify-between items-center text-white"><h2 className="text-lg font-bold flex items-center gap-2"><span>👤✕</span> ยืนยันการลบผู้ใช้งาน</h2><button onClick={() => { setDeleteModal({ isOpen: false, id: null, email: '' }); setDeleteConfirmText(''); }} className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button></div><div className="p-8 text-center bg-gray-50"><p className="text-lg font-bold text-gray-800 mb-6">คุณกำลังจะลบผู้ใช้งาน<br/><span className="text-[#df2323] text-xl mt-2 block">"{deleteModal.email}"</span><br/>ออกจากระบบ</p><div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm"><p className="text-sm font-bold text-gray-600 mb-3">หากต้องการลบ กรุณาพิมพ์คำว่า <span className="text-[#df2323] font-black">delete</span></p><input type="text" placeholder="พิมพ์คำว่า delete" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-center font-bold focus:outline-none focus:border-[#df2323] transition-colors" autoFocus /></div></div><div className="p-4 bg-white border-t border-gray-100 flex gap-3"><button onClick={() => { setDeleteModal({ isOpen: false, id: null, email: '' }); setDeleteConfirmText(''); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors">ยกเลิก</button><button onClick={executeDelete} disabled={deleteConfirmText !== 'delete' || isDeleting} className="flex-1 bg-[#df2323] hover:bg-[#be123c] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}</button></div></div></div>
      )}

      {successModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">สำเร็จ!</h3>
            <p className="text-gray-500 mb-6">เพิ่มผู้ใช้งานเข้าระบบเรียบร้อยแล้ว</p>
            <button onClick={() => setSuccessModal(false)} className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">ตกลง</button>
          </div>
        </div>
      )}

      {deleteSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-10 h-10 text-[#df2323]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ลบสำเร็จ!</h3>
            <p className="text-gray-500 mb-6">บัญชีผู้ใช้งานถูกลบออกจากระบบแล้ว</p>
            <button onClick={() => setDeleteSuccessModal(false)} className="w-full bg-[#df2323] hover:bg-[#be123c] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">ตกลง</button>
          </div>
        </div>
      )}

    </div>
  )
}