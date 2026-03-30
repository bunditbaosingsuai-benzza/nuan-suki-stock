'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Session } from '@supabase/supabase-js'

// 🔴 1. เพิ่ม 'super_admin' เข้าไปใน Profile เพื่อให้ระบบหน้าเว็บรู้จักสิทธิ์นี้
interface Profile {
  id: string;
  full_name: string | null;
  role: 'super_admin' | 'manager' | 'employee';
  branch_id: number | null;
}

interface UserContextType {
  session: Session | null;
  profile: Profile | null;
  isSuperAdmin: boolean; // 🔴 เพิ่มสิทธิ์ Super Admin
  isManager: boolean;
  isEmployee: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = async (user_id: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single()
    
    if (data) {
      setProfile(data as Profile)
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    // 1. ดึง Session ปัจจุบัน
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setIsLoading(false)
    })

    // 2. ดักฟังการเปลี่ยนแปลงสถานะ (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 🔴 2. จัดการสิทธิ์การเข้าถึงให้ถูกต้อง
  const isSuperAdmin = profile?.role === 'super_admin';
  // 💡 หัวใจสำคัญคือตรงนี้: สั่งให้ระบบมองว่า Super Admin ก็คือ Manager ระดับสูงสุด 
  // (มีสิทธิ์ทุกอย่างที่ manager มี) ระบบหน้าแดชบอร์ดและอื่นๆ จะได้ยอมเปิดให้เข้าครับ
  const isManager = profile?.role === 'manager' || profile?.role === 'super_admin';
  const isEmployee = profile?.role === 'employee';

  return (
    <UserContext.Provider value={{ session, profile, isSuperAdmin, isManager, isEmployee, isLoading, refreshProfile: () => profile ? fetchProfile(profile.id) : Promise.resolve() }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}