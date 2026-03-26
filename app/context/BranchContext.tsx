'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useUser } from './UserContext' // 🔴 1. ดึง UserContext มาใช้งาน

interface Branch { id: number; name: string; }

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile, session, isLoading: userLoading } = useUser() // 🔴 2. เช็คว่าใครล็อกอิน
  const [branches, setBranches] = useState<Branch[]>([])
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBranches = async () => {
      // 🔴 ถ้ายังไม่ล็อกอิน หรือกำลังเช็คสิทธิ์ ให้หยุดรอ ไม่ต้องไปดึงข้อมูล
      if (!session) {
        setBranches([])
        setCurrentBranch(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const { data, error } = await supabase.from('branches').select('*').order('id', { ascending: true })
      
      if (data && data.length > 0) {
        // 🔴 3. กรองสาขาตามสิทธิ์ (RBAC)
        if (profile?.role === 'manager') {
          // ผู้จัดการ: โหลดทุกสาขา และตั้งค่าเริ่มต้นเป็นสาขาที่สังกัด หรือสาขาแรก
          setBranches(data)
          const myBranch = data.find(b => b.id === profile.branch_id) || data[0]
          setCurrentBranch(myBranch)
        } else if (profile?.role === 'employee') {
          // พนักงาน: โหลดมาแค่ "สาขาของตัวเองสาขาเดียว"
          const myBranch = data.find(b => b.id === profile.branch_id)
          if (myBranch) {
            setBranches([myBranch])
            setCurrentBranch(myBranch)
          }
        }
      }
      setIsLoading(false)
    }

    if (!userLoading) {
      fetchBranches()
    }
  }, [session, profile, userLoading]) // 🔴 สั่งให้ทำงานใหม่ทุกครั้งที่มีคน Login/Logout

  return (
    <BranchContext.Provider value={{ branches, currentBranch, setCurrentBranch, isLoading }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider')
  }
  return context
}