"use client"

import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">CRM Doctor</h1>
        <p className="mb-8 text-gray-500">نظام إدارة علاقات العملاء المتكامل</p>
        
        <Link 
          href="/login" 
          className="block w-full rounded-lg bg-blue-600 px-5 py-3 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-colors"
        >
          تسجيل الدخول
        </Link>
      </div>
    </div>
  )
}
