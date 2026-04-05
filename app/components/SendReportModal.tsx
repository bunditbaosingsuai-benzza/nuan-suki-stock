'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
  const [recentEmails, setRecentEmails] = useState<string[]>([]) 
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEmailList, setShowEmailList] = useState(false)

  // 🔴 เพิ่ม State ควบคุม Popup แจ้งเตือนแบบสวยงาม
  const [statusModal, setStatusModal] = useState<{isOpen: boolean, type: 'success' | 'error', message: string}>({isOpen: false, type: 'success', message: ''})

  useEffect(() => {
    if (isOpen && currentBranch) {
      const d = new Date(selectedDate)
      const thaiDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
      setMessage(`เรียน ผู้จัดการ\n\nแนบไฟล์รายงานสรุปเช็คสต๊อกสินค้า ประจำวันที่ ${thaiDate}\nรบกวนพิจารณาและตรวจสอบใบสั่งซื้อ ตามรายละเอียดที่ส่งมาด้วยครับ\n\nขอบคุณครับ`)

      const fetchRecentEmails = async () => {
        const { data } = await supabase
          .from('email_reports')
          .select('recipient_email')
          .eq('branch_id', currentBranch.id)
          .order('created_at', { ascending: false })
          .limit(20)

        if (data) {
          const uniqueEmails = Array.from(new Set(data.map(item => item.recipient_email)))
          setRecentEmails(uniqueEmails)
          
          if (uniqueEmails.length > 0) {
            setEmail(uniqueEmails[0])
          } else {
            setEmail('') 
          }
        }
      }

      fetchRecentEmails()
    }
  }, [isOpen, selectedDate, currentBranch])

  const handleSendEmail = async () => {
    if (!email) return setStatusModal({ isOpen: true, type: 'error', message: 'กรุณาระบุอีเมลผู้รับ' })
    if (!currentBranch) return setStatusModal({ isOpen: true, type: 'error', message: 'ไม่พบข้อมูลสาขา' })
    setIsSubmitting(true)
    
    try {
      const d = new Date(selectedDate)
      const thaiDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportDate: thaiDate,
          rawDate: selectedDate,
          recipientEmail: email,
          message: message,
          branchId: currentBranch.id,
          fullReportData: fullReportData
        })
      })
      
      const result = await res.json()
      if (result.success) {
        // 🔴 เปลี่ยนเป็นเรียกใช้ Popup สวยๆ แทน alert()
        setStatusModal({ isOpen: true, type: 'success', message: 'ส่งรายงาน PDF ผ่านอีเมลสำเร็จเรียบร้อยครับ!' })
      } else {
        setStatusModal({ isOpen: true, type: 'error', message: 'ส่งอีเมลไม่สำเร็จ: ' + result.error })
      }
    } catch (error) {
      setStatusModal({ isOpen: true, type: 'error', message: 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบส่งอีเมล' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row border border-gray-200">
          {/* ซ้าย: รูปภาพ PDF */}
          <div className="bg-gray-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-200 md:w-2/5">
            <div className="w-24 h-32 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative mb-4">
              <div className="w-8 h-2 bg-[#df2323] rounded-full absolute top-4 left-4 opacity-50"></div>
              <div className="text-3xl font-black text-[#df2323] tracking-tighter">PDF</div>
            </div>
            <h3 className="font-bold text-gray-800 text-center">Daily_Report_{selectedDate.split('-')[2]}.pdf</h3>
            <p className="text-[10px] text-gray-500 text-center mt-2">ส่งเป็นข้อมูลตารางในอีเมล</p>
          </div>

          {/* ขวา: ฟอร์มส่ง */}
          <div className="p-6 md:p-8 flex-1 flex flex-col bg-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">รูปแบบรายงาน (ส่งอีเมล)</h2>
              <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">เลือกวันที่ต้องการส่ง</label>
              <div className="relative">
                <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl p-3 text-gray-700 font-bold focus:outline-none focus:border-[#df2323] transition-colors" />
              </div>
            </div>

            <div className="mb-4 relative">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><span>✉️</span> ส่งอีเมลถึงใคร?</label>
              
              <div className="relative">
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  onFocus={() => setShowEmailList(true)}
                  onBlur={() => setShowEmailList(false)}
                  placeholder="พิมพ์อีเมลที่ต้องการส่ง..." 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 pr-10 font-medium text-gray-800 focus:outline-none focus:border-[#df2323] transition-colors"
                />
                <button 
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); 
                    setShowEmailList(!showEmailList);
                  }}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  ▼
                </button>

                {showEmailList && recentEmails.length > 0 && (
                  <div 
                    className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    onMouseDown={(e) => e.preventDefault()} 
                  >
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      อีเมลที่เคยส่งล่าสุด
                    </div>
                    <ul className="max-h-40 overflow-y-auto custom-scrollbar">
                      {recentEmails.map(recentEmail => (
                        <li 
                          key={recentEmail} 
                          onClick={() => {
                            setEmail(recentEmail);
                            setShowEmailList(false);
                          }}
                          className="px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-[#df2323] cursor-pointer border-b border-gray-50 last:border-0 transition-colors flex items-center gap-2"
                        >
                          <span className="text-gray-300">⏱️</span> {recentEmail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6 flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">ข้อความ (Message)</label>
              <textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#df2323] transition-colors text-sm text-gray-600 h-32 resize-none custom-scrollbar"
              ></textarea>
            </div>

            <div className="flex gap-3 mt-auto">
              <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors">ยกเลิก</button>
              <button onClick={handleSendEmail} disabled={isSubmitting || !email} className="flex-1 bg-[#df2323] hover:bg-[#be123c] text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? 'กำลังส่ง...' : <><span>🚀</span> ส่งอีเมล</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🔴 ส่วน Popup แจ้งเตือนแบบสวยงาม (จะทับอยู่บน Modal อีกที) */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all text-center border-t-8 ${statusModal.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${statusModal.type === 'success' ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
              {statusModal.type === 'success' ? (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{statusModal.type === 'success' ? 'สำเร็จ!' : 'เกิดข้อผิดพลาด'}</h3>
            <p className="text-gray-600 mb-8 text-sm">{statusModal.message}</p>
            <button 
              onClick={() => {
                setStatusModal({ ...statusModal, isOpen: false })
                // ถ้าสำเร็จ พอกด "ตกลง" จะทำการปิดหน้าต่างอีเมลหลักไปด้วยเลย
                if (statusModal.type === 'success') onClose()
              }} 
              className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md transition-colors ${statusModal.type === 'success' ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#df2323] hover:bg-[#be123c]'}`}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </>
  )
}