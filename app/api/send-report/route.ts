import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // 🔴 ขยับมารับค่าตรงนี้ (ข้างในฟังก์ชัน POST)
    const { reportDate, recipientEmail, message, fullReportData, branchId } = body;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    let tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-family: Tahoma, sans-serif; font-size: 13px; margin-top: 20px;">
        <thead>
          <tr style="background-color: #df2323; color: white;">
            <th style="padding: 10px; border: 1px solid #fca5a5; text-align: left;">รายการสินค้า</th>
            <th style="padding: 10px; border: 1px solid #fca5a5; text-align: center;">เหลือเมื่อวาน</th>
            <th style="padding: 10px; border: 1px solid #fca5a5; text-align: center;">รับเข้า</th>
            <th style="padding: 10px; border: 1px solid #fca5a5; text-align: center;">นับได้ตอนเย็น</th>
            <th style="padding: 10px; border: 1px solid #fca5a5; text-align: center;">ถูกใช้ไป</th>
            <th style="padding: 10px; border: 1px solid #fca5a5; text-align: center;">ต้องสั่งเพิ่ม</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (!fullReportData || fullReportData.length === 0) {
      tableHtml += `<tr><td colSpan="6" style="padding: 20px; text-align: center; color: #888;">ไม่มีข้อมูลสต๊อกในวันนี้</td></tr>`;
    } else {
      const groupedData = fullReportData.reduce((acc: any, item: any) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {});

      Object.entries(groupedData).forEach(([category, items]: [string, any]) => {
        tableHtml += `
          <tr style="background-color: #f3f4f6;">
            <td colspan="6" style="padding: 8px 10px; border: 1px solid #e5e7eb; font-weight: bold; color: #374151;">
              📂 หมวดหมู่: ${category}
            </td>
          </tr>
        `;
        items.forEach((item: any) => {
          const needsOrderStyle = item.needsOrder ? 'color: #df2323; font-weight: bold; background-color: #fef2f2;' : 'color: #9ca3af;';
          tableHtml += `
            <tr style="background-color: #ffffff;">
              <td style="padding: 8px 10px; border: 1px solid #e5e7eb;"><b>${item.name}</b> <span style="font-size: 11px; color: #6b7280;">(${item.unit})</span></td>
              <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; color: #854d0e; background-color: #fefce8;">${item.yesterday}</td>
              <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; color: #854d0e; background-color: #fefce8;">${item.incoming}</td>
              <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; color: #1d4ed8; font-weight: bold; background-color: #eff6ff;">${item.evening}</td>
              <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; color: #374151;">${item.used}</td>
              <td style="padding: 8px 10px; border: 1px solid #e5e7eb; text-align: center; ${needsOrderStyle}">${item.orderAmount}</td>
            </tr>
          `;
        });
      });
    }
    tableHtml += `</tbody></table>`;

    const mailOptions = {
      from: `"ระบบสต๊อก นวลสุกี้" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `รายงานสรุปเช็คสต๊อกสินค้า ประจำวันที่ ${reportDate}`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #df2323; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">รายงานสต๊อก นวลสุกี้</h2>
            <p style="margin: 5px 0 0 0;">ประจำวันที่: ${reportDate}</p>
          </div>
          <div style="padding: 20px;">
            <p><b>เรียน ผู้จัดการ</b></p>
            <p>${message ? message.replace(/\n/g, '<br/>') : 'แนบไฟล์รายงานสรุปเช็คสต๊อกสินค้า'}</p>
            ${tableHtml}
            <p style="margin-top: 30px; font-size: 12px; color: #888; text-align: center;">ส่งจากระบบจัดการสต๊อกอัตโนมัติ นวลสุกี้</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    
    // 🔴 บันทึกลงถูกสาขาแน่นอน
    await supabase.from('email_reports').insert([{
      report_date: new Date().toISOString().split('T')[0],
      recipient_email: recipientEmail,
      message: message || '',
      branch_id: branchId || 1 // ถ้าไม่มีสาขาส่งมา ให้ลงสาขาหลัก (1) ไว้ก่อน
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}