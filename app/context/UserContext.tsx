'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Session } from '@supabase/supabase-js'

interface Profile {
  id: string;
  full_name: string | null;
  role: 'manager' | 'employee';
  branch_id: number | null;
}

interface UserContextType {
  session: Session | null;
  profile: Profile | null;
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

  const isManager = profile?.role === 'manager';
  const isEmployee = profile?.role === 'employee';

  return (
    <UserContext.Provider value={{ session, profile, isManager, isEmployee, isLoading, refreshProfile: () => profile ? fetchProfile(profile.id) : Promise.resolve() }}>
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