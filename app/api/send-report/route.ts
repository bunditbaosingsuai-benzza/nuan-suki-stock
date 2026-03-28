import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { reportDate, rawDate, recipientEmail, message, branchId, fullReportData } = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let branchName = '';
    if (branchId) {
      const { data: branchData } = await supabase.from('branches').select('name').eq('id', branchId).single();
      if (branchData) branchName = branchData.name;
    }

    const rawData = fullReportData || [];

    const processedData = rawData.map((item: any) => {
        const yest = Number(item.yesterday_balance) || 0;
        const inc = Number(item.incoming) || 0;
        
        const total = Number((yest + inc).toFixed(1)); 
        const hasEveningCount = item.evening_counted !== null && item.evening_counted !== undefined;
        const evening = hasEveningCount ? Number(Number(item.evening_counted).toFixed(1)) : total;
        
        let used: number | '-' = '-';
        if (hasEveningCount && !item.products?.hide_used) {
            used = Number((total - evening).toFixed(1)); 
        }

        let totalCombinedStock = evening;

        const linkedItems = rawData.filter((r: any) => r.products?.raw_material_id === item.product_id);
        if (linkedItems.length > 0) {
            linkedItems.forEach((linked: any) => {
                const linkedTotal = (Number(linked.yesterday_balance) || 0) + (Number(linked.incoming) || 0);
                const linkedEvening = linked.evening_counted !== null ? Number(linked.evening_counted) : linkedTotal;
                totalCombinedStock += linkedEvening;
            });
        }
        
        totalCombinedStock = Number(totalCombinedStock.toFixed(1));

        // 🔴 ปัดเศษขึ้นเป็นจำนวนเต็มทุกกรณี (Math.ceil)
        let toOrder = 0;
        if (hasEveningCount && item.products?.min_limit !== null && item.products?.max_limit !== null) {
            if (totalCombinedStock <= Number(item.products.min_limit)) {
                // ไม่ต้องเช็คหน่วยแล้ว สั่งปัดเศษขึ้นทุกอย่างเลย
                toOrder = Math.ceil(Number(item.products.max_limit) - totalCombinedStock);
            }
        }

        return {
            ...item,
            calc_inc: inc,
            calc_total: total,
            calc_evening: hasEveningCount ? evening : '-',
            calc_used: used,
            calc_toOrder: toOrder,
            calc_hasEveningCount: hasEveningCount
        };
    });

    const groupedData: Record<string, any[]> = {};
    processedData.forEach((item: any) => {
        const catName = item.products?.categories?.name || 'ไม่มีหมวดหมู่';
        if (!groupedData[catName]) groupedData[catName] = [];
        groupedData[catName].push(item);
    });

    let tableRowsHtml = '';
    Object.entries(groupedData).forEach(([category, items]) => {
      tableRowsHtml += `
        <tr style="background-color: #e2e8f0; color: #334155;">
          <td colspan="6" style="padding: 10px 15px; text-align: left; font-weight: bold; font-size: 14px; border-bottom: 1px solid #cbd5e1;">
            📁 หมวดหมู่: ${category}
          </td>
        </tr>
      `;
      items.forEach((item: any) => {
        const toOrderHtml = item.calc_toOrder > 0 
          ? `<span style="color: #df2323; font-weight: bold;">+${item.calc_toOrder}</span>` 
          : '-';

        const unit = item.products?.unit || '';

        tableRowsHtml += `
          <tr style="border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">
            <td style="padding: 12px 15px; text-align: left;"><b>${item.products?.name || 'ไม่ระบุ'}</b> <span style="font-size: 11px; color: #6b7280;">(${unit})</span></td>
            <td style="padding: 12px; color: #854d0e; font-weight: 500;">${item.yesterday_balance}</td>
            <td style="padding: 12px; color: #854d0e; font-weight: 500;">${item.calc_inc}</td>
            <td style="padding: 12px; font-weight: bold; color: #1d4ed8;">${item.calc_evening}</td>
            <td style="padding: 12px; color: #374151;">${item.calc_used}</td>
            <td style="padding: 12px; background-color: #fef2f2;">${toOrderHtml}</td>
          </tr>
        `;
      });
    });

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background-color: #475569; color: #ffffff; text-align: center; padding: 25px 20px;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: 0.5px;">รายงานสต๊อก นวลสุกี้ ${branchName}</h1>
            <p style="margin: 8px 0 0 0; font-size: 15px; color: #cbd5e1;">ประจำวันที่: ${reportDate}</p>
          </div>
          <div style="padding: 25px 25px 10px 25px; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message || 'ไม่มีข้อความแนบ'}</div>
          <div style="padding: 15px 25px 30px 25px;">
            <div style="overflow-x: auto;">
              <table style="width: 100%; min-width: 600px; border-collapse: collapse; text-align: center;">
                <thead>
                  <tr style="background-color: #f3f4f6; color: #1f2937; border-top: 2px solid #94a3b8; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 14px 15px; text-align: left; font-weight: bold;">รายการสินค้า</th>
                    <th style="padding: 14px 10px; font-weight: bold;">เหลือเมื่อวาน</th>
                    <th style="padding: 14px 10px; font-weight: bold;">รับเข้า</th>
                    <th style="padding: 14px 10px; font-weight: bold;">นับได้ตอนเย็น</th>
                    <th style="padding: 14px 10px; font-weight: bold;">ถูกใช้ไป</th>
                    <th style="padding: 14px 10px; font-weight: bold;">ต้องสั่งเพิ่ม</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml || '<tr><td colspan="6" style="padding: 20px; color: #9ca3af;">ไม่มีข้อมูลรายการสินค้า</td></tr>'}
                </tbody>
              </table>
            </div>
            <div style="margin-top: 30px; text-align: center;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">ส่งจากระบบจัดการสต๊อกอัตโนมัติ นวลสุกี้</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const mailOptions = {
      from: `"นวลสุกี้ (${branchName})" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `📊 รายงานสรุปสต๊อกสินค้า - ${branchName} (ประจำวันที่ ${reportDate})`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    
    await supabase.from('email_reports').insert([{
      report_date: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
      recipient_email: recipientEmail,
      message: message || '',
      branch_id: branchId || 1
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}