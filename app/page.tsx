import { redirect } from 'next/navigation'

export default function RootPage() {
  // ถ้าใครหลงเข้ามาที่หน้าเว็บเปล่าๆ (localhost:3000/) ให้เตะไปหน้า Login เสมอ
  redirect('/login')
}