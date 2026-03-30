'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useUser } from './UserContext' 

interface Branch { id: number; name: string; }

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile, session, isLoading: userLoading } = useUser() 
  const [branches, setBranches] = useState<Branch[]>([])
  
  // ใช้ setCurrentBranchState แทนตัวเดิม เพื่อให้เราแทรกคำสั่งจำค่าได้
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 🔴 สร้างฟังก์ชันเปลี่ยนสาขา พร้อมสั่งให้เบราว์เซอร์ "จดจำ" ลง Local Storage
  const setCurrentBranch = (branch: Branch) => {
    setCurrentBranchState(branch);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedBranchId', String(branch.id));
    }
  }

  useEffect(() => {
    const fetchBranches = async () => {
      if (!session) {
        setBranches([])
        setCurrentBranchState(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const { data, error } = await supabase.from('branches').select('*').order('id', { ascending: true })
      
      if (data && data.length > 0) {
        if (profile?.role === 'manager' || profile?.role === 'super_admin') {
          setBranches(data)
          
          // 🔴 1. แอบไปดูความจำในเบราว์เซอร์ก่อน ว่าเคยเลือกสาขาไหนไว้ไหม?
          let savedBranchId = null;
          if (typeof window !== 'undefined') {
            savedBranchId = localStorage.getItem('selectedBranchId');
          }

          let myBranch = null;
          if (savedBranchId) {
            myBranch = data.find(b => b.id === Number(savedBranchId));
          }

          // 🔴 2. ถ้าเพิ่งเข้าเว็บครั้งแรก (ยังไม่เคยจำ) ค่อยใช้สาขาประจำตัว หรือสาขาแรกสุด
          if (!myBranch) {
            myBranch = data.find(b => b.id === profile.branch_id) || data[0];
          }

          setCurrentBranchState(myBranch)

        } else if (profile?.role === 'employee') {
          // พนักงาน: โดนบังคับสาขาอยู่แล้ว
          const myBranch = data.find(b => b.id === profile.branch_id)
          if (myBranch) {
            setBranches([myBranch])
            setCurrentBranchState(myBranch)
            if (typeof window !== 'undefined') {
               localStorage.setItem('selectedBranchId', String(myBranch.id));
            }
          }
        }
      }
      setIsLoading(false)
    }

    if (!userLoading) {
      fetchBranches()
    }
  }, [session, profile, userLoading]) 

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