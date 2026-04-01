'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SendReportModal from '../components/SendReportModal'
import { useBranch } from '../context/BranchContext'

interface ReportRecord { id: number; created_at: string; report_date: string; recipient_email: string; message: string; sender_name: string; }

export default function ReportsPage() {
  const { currentBranch } = useBranch()

  const [reports, setReports] = useState<ReportRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'))

  const fetchReports = async () => {
    if (!currentBranch) return;
    setIsLoading(true)
    
    // ดึงข้อมูลอีเมลทั้งหมดของสาขานี้
    const { data, error } = await supabase
      .from('email_reports')
      .select('*')
      .eq('branch_id', currentBranch.id)
      .order('created_at', { ascending: false })

    if (data) {
      const filteredData = data.filter((report: any) => {
        const localDateString = new Date(report.created_at).toLocaleDateString('en-CA')
        return localDateString === selectedDate
      })
      setReports(filteredData as ReportRecord[])
    }
    setIsLoading(false)
  }

  // โหลดใหม่เมื่อเปลี่ยนสาขา, เปลี่ยนวันที่, หรือส่งเมลเสร็จ
  useEffect(() => { if (currentBranch) fetchReports() }, [isModalOpen, currentBranch, selectedDate]) 

  const formatTime = (isoString: string) => { const d = new Date(isoString); return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'; }
  const formatDate = (isoString: string) => { const d = new Date(isoString); return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); }

  if (!currentBranch) return <div className="p-8 text-center text-gray-500">กำลังโหลดสาขา...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b-2 border-[#df2323] pb-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#df2323]">ประวัติการส่งรายงาน <span className="text-gray-500 text-lg ml-2">({currentBranch.name})</span></h1>
          <div className="bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm flex items-center gap-2 transition-colors focus-within:border-[#df2323] focus-within:ring-1 focus-within:ring-[#df2323] w-fit">
            <span className="text-gray-500">📅</span>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="text-sm font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer" 
            />
          </div>
        </div>

        <div className="flex gap-2">
          {/* 🔴 เหลือแค่ปุ่มส่งรายงานเอกสาร */}
          <button onClick={() => setIsModalOpen(true)} className="bg-[#df2323] hover:bg-[#be123c] text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all flex items-center gap-2">
            🚀 ส่งรายงานเอกสาร
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2"><span>🗓️</span> รายการที่ส่งในวันที่เลือก</h3>
        
        {isLoading ? ( <p className="text-center text-gray-400 py-8">กำลังโหลดข้อมูล...</p> ) : reports.length === 0 ? ( <p className="text-center text-gray-400 py-8">ไม่มีประวัติการส่งรายงานในวันที่เลือก</p> ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr><th className="p-4 font-bold text-gray-700 text-sm w-40">วัน/เวลาที่ส่ง</th><th className="p-4 font-bold text-gray-700 text-sm w-1/4">ผู้รับ (Email)</th><th className="p-4 font-bold text-gray-700 text-sm w-32 text-center">ข้อมูลเอกสาร</th><th className="p-4 font-bold text-gray-700 text-sm">ข้อความที่ส่ง (Message)</th></tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b border-gray-100 hover:bg-red-50/20">
                    <td className="p-4 align-top"><div className="font-bold text-[#df2323] flex items-center gap-1"><span>🕒</span> {formatDate(report.created_at)}</div><div className="text-xs text-gray-500 mt-1 pl-5">เวลา {formatTime(report.created_at)}</div></td>
                    <td className="p-4 align-top"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center uppercase">{report.recipient_email.charAt(0)}</div><span className="font-semibold text-gray-800">{report.recipient_email}</span></div></td>
                    <td className="p-4 align-top text-center"><div className="bg-blue-50 text-blue-700 text-xs font-bold py-1 px-3 rounded-full inline-block mb-1">สรุปรายวัน</div><div className="text-[11px] text-gray-500 font-semibold">{formatDate(report.report_date)}</div></td>
                    <td className="p-4 align-top"><div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: report.message.replace(/\n/g, '<br/>') }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SendReportModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} selectedDate={selectedDate} onDateChange={setSelectedDate} fullReportData={[]} />
    </div>
  )
}