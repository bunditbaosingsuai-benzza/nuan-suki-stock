import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { reportDate, branchName, itemsToOrder } = await req.json();
    
    // ดึงค่า Token และ Chat ID จากไฟล์ .env.local
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ success: false, error: 'ยังไม่ได้ตั้งค่า Telegram Token หรือ Chat ID ในระบบ' }, { status: 500 });
    }

    // 📝 จัดหน้าตาข้อความที่จะส่งเข้ากลุ่ม (ใช้ HTML ตกแต่งตัวหนาได้)
    let text = `📦 <b>สรุปสั่งของประจำวัน: ${branchName}</b>\n`;
    text += `📅 วันที่: ${reportDate}\n\n`;

    if (itemsToOrder.length === 0) {
      text += `✅ <b>ไม่มีรายการที่ต้องสั่งเพิ่มครับ</b>\nสต๊อกเพียงพอต่อการใช้งาน`;
    } else {
      text += `<b>⚠️ รายการที่ต้องสั่งเพิ่ม:</b>\n`;
      itemsToOrder.forEach((item: any) => {
        text += `• ${item.name}: <b>+${item.amount}</b> ${item.unit}\n`;
      });
    }

    text += `\n<i>(ส่งอัตโนมัติจากระบบ Nuan Suki Stock)</i>`;

    // 🚀 ยิง API ไปหา Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML' // สั่งให้ Telegram อ่านโค้ดตัวหนา
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'ไม่สามารถส่งข้อความเข้า Telegram ได้');
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}