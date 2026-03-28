'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase' // 🔴 อย่าลืม Import Supabase เข้ามา
import { useBranch } from '../context/BranchContext'

interface SendReportModalProps {
  isOpen: boolean
  onClose: () => void
  selectedDate: string
  onDateChange: (date: string) => void
  fullReportData: any[]
}

export default function SendReportModal({ isOpen, onClose, selectedDate, onDateChange, fullReportData }: SendReportModalProps) {
  const { currentBranch } = useBranch()
  
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [warningMsg, setWarningMsg] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const d = new Date(selectedDate)
    const formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    setMessage(`เรียน ผู้จัดการ\n\nแนบไฟล์รายงานสรุปเช็คสต๊อกสินค้า ประจำวันที่ ${formattedDate}\nรบกวนพิจารณาและตรวจสอบใบสั่งซื้อ ตามรายละเอียดที่ส่งมาด้วยครับ\n\nขอบคุณครับ/ค่ะ`)
  }, [selectedDate])

  const handlePreSend = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setWarningMsg('กรุณากรอก "อีเมลผู้รับ" ก่อนทำการส่งรายงานครับ')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setWarningMsg('รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง (เช่น manager@example.com)')
      return
    }
    setShowConfirm(true)
  }

  const executeSend = async () => {
    setShowConfirm(false) 
    setIsSubmitting(true)

    try {
      // 🔴 1. ให้หน้าเว็บเป็นคนดึงข้อมูลสต๊อก (เพราะ Login แล้ว มีสิทธิ์แน่นอน)
      const { data: stockData, error: stockError } = await supabase
        .from('daily_stock_checks')
        .select('*, products(name, unit, hide_used, min_limit, max_limit, raw_material_id, categories(name))')
        .eq('check_date', selectedDate)
        .eq('branch_id', currentBranch?.id)
        .order('id', { ascending: true });

      if (stockError) throw stockError;

      // 🔴 2. เช็คก่อนว่ามีข้อมูลสต๊อกไหม ถ้าไม่มีให้หยุดส่งทันที!
      if (!stockData || stockData.length === 0) {
        const d = new Date(selectedDate);
        setWarningMsg(`ยังไม่มีการบันทึกข้อมูลสต๊อกของวันที่ ${d.toLocaleDateString('th-TH')} ครับ กรุณาตรวจสอบวันที่อีกครั้ง`);
        setIsSubmitting(false);
        return;
      }

      const d = new Date(selectedDate)
      const formattedDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportDate: formattedDate,
          rawDate: selectedDate,
          recipientEmail: email.trim(),
          message: message,
          branchId: currentBranch?.id,
          fullReportData: stockData // 🔴 3. โยนข้อมูลแพ็คไปให้หลังบ้านวาดตาราง
        })
      })

      const result = await res.json()

      if (result.success) {
        setShowSuccess(true) 
        setEmail('') 
      } else {
        setErrorMsg(result.error || 'เกิดข้อผิดพลาดในการส่งอีเมล')
      }
    } catch (error: any) {
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseMain = () => {
    setWarningMsg('')
    setErrorMsg('')
    setShowConfirm(false)
    setShowSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  const displayDate = new Date(selectedDate)
  const dayStr = displayDate.getDate()
  const fullThDate = displayDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-3xl flex flex-col md:flex-row overflow-hidden shadow-2xl transform transition-all max-h-[85vh]">
          
          <div className="hidden md:flex w-1/3 bg-gray-50 p-6 flex-col items-center justify-center border-r border-gray-100 relative">
            <div className="w-28 h-36 bg-white shadow-md rounded-xl border border-gray-200 flex flex-col items-center justify-center mb-6 relative overflow-hidden">
              <div className="absolute top-0 w-full h-8 bg-red-100 flex items-center px-3 border-b border-red-200">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
              </div>
              <span className="text-red-600 font-black text-3xl mt-4">PDF</span>
            </div>
            <h3 className="font-bold text-gray-800 text-base text-center mb-1">Daily_Report_{dayStr}.pdf</h3>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              ประจำวันที่: {fullThDate}<br/>
              ส่งเป็นข้อมูลตารางในอีเมล
            </p>
          </div>

          <div className="w-full md:w-2/3 p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">รูปแบบรายงาน</h2>
              <button onClick={handleCloseMain} className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors text-sm">✕</button>
            </div>

            <div className="flex flex-col gap-5 flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">เลือกวันที่ต้องการส่ง</label>
                <div className="relative">
                  <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-gray-700 font-semibold cursor-pointer" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2"><span>✉️</span> ส่งถึง (Email)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ใส่อีเมลผู้รับ เช่น manager@nuansuki.com" className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors" />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-bold text-gray-700 mb-1.5">ข้อความ (Message)</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors resize-none flex-1 min-h-[120px] text-sm text-gray-600 leading-relaxed" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
              <button onClick={handleCloseMain} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors">ยกเลิก</button>
              <button onClick={handlePreSend} disabled={isSubmitting} className="flex-1 bg-[#df2323] hover:bg-[#be123c] text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? (<>กำลังเตรียมข้อมูล...</>) : (<><span>🚀</span> ยืนยันการส่ง</>)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {warningMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center border-t-8 border-orange-400">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><span className="text-4xl">⚠️</span></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">แจ้งเตือน</h3><p className="text-gray-600 mb-8 text-sm">{warningMsg}</p>
            <button onClick={() => setWarningMsg('')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 rounded-xl transition-colors">ตกลง</button>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><span className="text-4xl">📧</span></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ยืนยันการส่งรายงาน</h3>
            <p className="text-gray-600 mb-6 text-sm">คุณต้องการส่งรายงานของวันที่<br/><span className="font-bold text-[#df2323]">{fullThDate}</span><br/>ไปที่อีเมล <span className="font-bold text-blue-600">{email}</span><br/>ใช่หรือไม่?</p>
            <div className="flex gap-3"><button onClick={() => setShowConfirm(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors">ตรวจสอบอีกครั้ง</button><button onClick={executeSend} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">ส่งเลย!</button></div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ส่งรายงานสำเร็จ!</h3><p className="text-gray-500 mb-8 text-sm">อีเมลถูกส่งไปยัง <span className="font-semibold text-gray-700">{email}</span> เรียบร้อยแล้ว</p>
            <button onClick={handleCloseMain} className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3.5 rounded-xl shadow-md transition-colors">ตกลง</button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center border-t-8 border-red-500">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><svg className="w-10 h-10 text-[#df2323]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">ส่งไม่สำเร็จ</h3><p className="text-gray-600 mb-8 text-sm">{errorMsg}</p>
            <button onClick={() => setErrorMsg('')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 rounded-xl transition-colors">ลองใหม่อีกครั้ง</button>
          </div>
        </div>
      )}
    </>
  )
}