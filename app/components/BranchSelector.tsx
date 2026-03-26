'use client'

import React, { useState } from 'react'
import { useBranch } from '../context/BranchContext'
import { useUser } from '../context/UserContext'

export default function BranchSelector() {
  const { branches, currentBranch, setCurrentBranch, isLoading } = useBranch()
  const { isManager } = useUser()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading || !currentBranch) return <div className="h-8 md:h-10 w-24 md:w-32 bg-gray-100 animate-pulse rounded-lg"></div>;

  return (
    <>
      {!isManager ? (
        <div className="bg-gray-50 border border-gray-100 text-gray-500 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold flex items-center gap-1 md:gap-2 transition-all text-xs md:text-sm max-w-[100px] sm:max-w-none">
          <span className="text-sm md:text-base flex-shrink-0">🏪</span>
          <span className="truncate">{currentBranch.name}</span>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-white border border-gray-200 hover:border-[#df2323] text-gray-700 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg font-bold flex items-center gap-1 md:gap-2 shadow-sm transition-all text-xs md:text-sm max-w-[110px] sm:max-w-none"
        >
          <span className="text-[#df2323] text-sm md:text-base flex-shrink-0">🏪</span>
          {/* ตัดคำถ้าชื่อสาขายาวเกินไปในมือถือ */}
          <span className="truncate">{currentBranch.name}</span>
          <span className="text-gray-400 text-[10px] md:text-xs ml-0.5 md:ml-1 flex-shrink-0">▼</span>
        </button>
      )}

      {/* Popup เลือกสาขา (โค้ดเดิม) */}
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            
            <div className="bg-[#be123c] p-4 px-6 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>🏪</span> เลือกสาขาที่ต้องการดู
              </h2>
              <button 
                onClick={() => setIsOpen(false)} 
                className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {branches.map((branch) => {
                const isActive = currentBranch.id === branch.id;
                return (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setCurrentBranch(branch);
                      setIsOpen(false);
                    }}
                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all font-bold text-lg
                      ${isActive 
                        ? 'border-red-200 bg-red-50 text-[#be123c]' 
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    {branch.name}
                    {isActive && (
                      <div className="w-6 h-6 bg-[#be123c] text-white rounded-full flex items-center justify-center text-sm shadow-sm">
                        ✓
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}