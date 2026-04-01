import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { reportDate, branchName, fullReportData, senderName } = await req.json();
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ success: false, error: 'ยังไม่ได้ตั้งค่า Telegram Token' }, { status: 500 });
    }

    // 1. จัดกลุ่มข้อมูลตามหมวดหมู่
    const groupedData: Record<string, any[]> = {};
    fullReportData.forEach((item: any) => {
      if (!groupedData[item.category]) groupedData[item.category] = [];
      groupedData[item.category].push(item);
    });

    // 2. เตรียมกล่องใส่ข้อความหลายๆ กล่อง (เพื่อกันความยาวเกิน 4000 ตัวอักษร)
    const messagesToSend: string[] = [];
    let currentText = `🚨 <b>รายงานสรุปสั่งของ (${branchName})</b>\n📅 ประจำวันที่: ${reportDate}\n\n`;

    // 3. รายละเอียดการใช้ของ แยกตามหมวด
    for (const [category, items] of Object.entries(groupedData)) {
      let categoryBlock = `<b>📂 ${category}</b>\n`;
      
      items.forEach(item => {
        const orderAmtStr = String(item.orderAmount).replace('+', '');
        const statusStr = item.needsOrder ? `ต้องสั่งเพิ่ม ${orderAmtStr} ${item.unit} 🔴` : `พอขาย ✅`;
        
        const yest = item.yesterday !== '-' ? item.yesterday : 0;
        const inc = item.incoming !== '-' ? item.incoming : 0;
        const used = item.used !== '-' ? item.used : '?';

        categoryBlock += `🔸 <b>${item.name}</b>\n`;
        categoryBlock += `   ├ (เหลือ: ${yest} | เข้า: ${inc} | ใช้: ${used})\n`;
        categoryBlock += `   └ 👉 <i>${statusStr}</i>\n`;
      });
      categoryBlock += `\n`;

      // 🔴 ถ้ายาวเกิน 3500 ตัวอักษร ให้ตัดขึ้นข้อความบับเบิ้ลใหม่
      if (currentText.length + categoryBlock.length > 3500) {
        messagesToSend.push(currentText); // เก็บกล่องเก่า
        currentText = categoryBlock; // เริ่มกล่องใหม่
      } else {
        currentText += categoryBlock; // ถ้ายาวไม่ถึงก็ต่อท้ายไปเรื่อยๆ
      }
    }

    // 4. สรุปรายการสั่งของตอนท้าย
    let summaryBlock = `━━━━━━━━━━━━━━\n🛒 <b>สรุปรายการสั่งซื้อ</b>\n`;
    let hasOrder = false;
    
    for (const [category, items] of Object.entries(groupedData)) {
      const orderItems = items.filter(i => i.needsOrder);
      if (orderItems.length > 0) {
        hasOrder = true;
        summaryBlock += `<b>${category}</b>\n`;
        orderItems.forEach(item => {
          const orderAmtStr = String(item.orderAmount).replace('+', '');
          summaryBlock += `- ${item.name} : ${orderAmtStr} ${item.unit}\n`;
        });
        summaryBlock += `\n`;
      }
    }

    if (!hasOrder) {
      summaryBlock += `✅ <b>ไม่ต้องสั่งของเพิ่มครับ สต๊อกเพียงพอ</b>\n\n`;
    }

    summaryBlock += `👨‍💻 ผู้ส่ง: ${senderName}`;

    // 🔴 เช็คกล่องสุดท้ายว่ารวมสรุปแล้วล้นไหม
    if (currentText.length + summaryBlock.length > 3500) {
      messagesToSend.push(currentText);
      messagesToSend.push(summaryBlock);
    } else {
      currentText += summaryBlock;
      messagesToSend.push(currentText);
    }

    // 🚀 5. ทยอยส่งข้อความทีละกล่องไปหา Telegram
    for (const msg of messagesToSend) {
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description);
      }
      
      // หน่วงเวลา 0.2 วินาที ป้องกัน Telegram บล็อกเพราะส่งถี่เกินไป
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}