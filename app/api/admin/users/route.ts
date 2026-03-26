import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function POST(request: Request) {
  try {
    const { email, password, role, branch_id } = await request.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: email, role, branch_id } 
    });

    if (error) throw error;
    return NextResponse.json({ success: true, user: data.user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    
    // 🔴 แก้ไข: ต้องลบในตาราง profiles ก่อน เพื่อไม่ให้ติดเรื่อง Foreign Key
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    // 🔴 หลังจากนั้นค่อยลบ User ออกจากระบบ Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}