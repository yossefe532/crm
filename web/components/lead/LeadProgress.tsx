"use client"

import { Button } from "../ui/Button"
import { useLocale } from "../../lib/i18n/LocaleContext"

type Props = {
  stages: string[]
  activeIndex?: number
  onStageChange?: (index: number) => void
  readOnly?: boolean
}

const STAGE_ICONS: Record<string, any> = {
  "مكالمة هاتفية": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  "اجتماع": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  "رؤية الموقع": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  "إغلاق الصفقة": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export const LeadProgress = ({ stages, activeIndex = 0, onStageChange, readOnly }: Props) => {
  const { dir } = useLocale()

  return (
    <div className="w-full" dir={dir}>
      {/* Mobile View (Vertical) */}
      <div className="flex flex-col gap-0 md:hidden relative pb-4">
         {/* Vertical Progress Line Background */}
         <div className="absolute top-4 bottom-4 right-[19px] w-1 bg-base-200 -z-10 rounded-full" />
         
         {/* Vertical Progress Line Active */}
         <div 
          className="absolute top-4 right-[19px] w-1 bg-brand-500 -z-10 rounded-full transition-all duration-500 ease-out"
          style={{ height: `${(activeIndex / (stages.length - 1)) * 100}%` }}
        />

        {stages.map((stage, index) => {
          const isComplete = index < activeIndex
          const isActive = index === activeIndex
          
          let circleClass = "bg-white border-2 border-base-300 text-base-400"
          let textClass = "text-base-500 font-medium"
          
          if (isComplete) {
            circleClass = "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200"
            textClass = "text-emerald-700 font-bold"
          } else if (isActive) {
            circleClass = "bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-200 scale-110 ring-4 ring-brand-100"
            textClass = "text-brand-700 font-bold"
          }

          const Icon = STAGE_ICONS[stage] || (
            <span className="text-sm font-bold">{index + 1}</span>
          )

          return (
            <div key={stage} className="flex items-center gap-4 py-2">
              <Button
                type="button"
                variant="ghost"
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10 shrink-0 p-0
                  ${circleClass}
                  ${readOnly ? "cursor-default opacity-100" : "cursor-pointer active:scale-95"}
                `}
                onClick={() => !readOnly && onStageChange?.(index)}
                disabled={readOnly}
                aria-label={stage}
                title={stage}
              >
                {isComplete ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  Icon
                )}
              </Button>
              
              <span className={`text-sm transition-colors duration-300 ${textClass}`}>
                {stage}
              </span>
            </div>
          )
        })}
      </div>

      {/* Desktop View (Horizontal) */}
      <div className="hidden md:flex w-full items-center justify-between relative pb-4">
        {/* Progress Line Background */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-base-200 -z-10 transform -translate-y-1/2 rounded-full" />
        
        {/* Progress Line Active */}
        <div 
          className="absolute top-1/2 right-0 h-1 bg-brand-500 -z-10 transform -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(activeIndex / (stages.length - 1)) * 100}%` }}
        />

        {stages.map((stage, index) => {
          const isComplete = index < activeIndex
          const isActive = index === activeIndex
          
          let circleClass = "bg-white border-2 border-base-300 text-base-400"
          let textClass = "text-base-500 font-medium"
          
          if (isComplete) {
            circleClass = "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200"
            textClass = "text-emerald-700 font-bold"
          } else if (isActive) {
            circleClass = "bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-200 scale-110 ring-4 ring-brand-100"
            textClass = "text-brand-700 font-bold"
          }

          const Icon = STAGE_ICONS[stage] || (
            <span className="text-sm font-bold">{index + 1}</span>
          )

          return (
            <div key={stage} className="flex flex-col items-center gap-3 relative group">
              <Button
                type="button"
                variant="ghost"
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10 p-0
                  ${circleClass}
                  ${readOnly ? "cursor-default opacity-100" : "cursor-pointer hover:scale-110 active:scale-95"}
                `}
                onClick={() => !readOnly && onStageChange?.(index)}
                disabled={readOnly}
                aria-label={stage}
                title={stage}
              >
                {isComplete ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  Icon
                )}
              </Button>
              
              <span className={`text-xs sm:text-sm whitespace-nowrap transition-colors duration-300 ${textClass}`}>
                {stage}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
