import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import puppeteer from 'puppeteer'
import { supabase } from '../../../lib/supabase'

export async function POST(req: Request) {
  try {
    const { reportDate, rawDate, recipientEmail, message, branchId, fullReportData } = await req.json()

    if (!recipientEmail || !fullReportData || fullReportData.length === 0) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    // 1. เตรียม HTML สำหรับสร้าง PDF (อิงข้อมูลที่หน้าแดชบอร์ดคำนวณมาให้แล้ว)
    const groupedData = fullReportData.reduce((acc: any, item: any) => {
      const categoryName = item.category || 'ไม่มีหมวดหมู่'
      if (!acc[categoryName]) { acc[categoryName] = [] }
      acc[categoryName].push(item)
      return acc
    }, {})

    let tableRowsHtml = ''
    for (const [category, items] of Object.entries(groupedData)) {
      tableRowsHtml += `
        <tr class="category-row">
          <td colspan="6">📁 หมวดหมู่: ${category}</td>
        </tr>
      `
      
      ;(items as any[]).forEach(item => {
        const productName = item.name || '-'
        const unit = item.unit || ''
        
        // ใช้ค่าที่หน้าเว็บคำนวณมาให้แล้วโดยตรง ไม่ต้อง .toFixed() ซ้ำ
        const yest = item.yesterday !== undefined ? item.yesterday : '-'
        const inc = item.incoming !== undefined ? item.incoming : '-'
        const eve = item.evening !== undefined ? item.evening : '-'
        const used = item.used !== undefined ? item.used : '-'
        const orderText = item.orderAmount !== undefined ? item.orderAmount : '-'

        // แต่งสีตัวอักษรยอดสั่ง
        let orderHtml = orderText
        if (String(orderText).includes('+')) {
            orderHtml = `<span style="color: #be123c; font-weight: bold;">${orderText}</span>`
        } else if (String(orderText).includes('รอของ')) {
            orderHtml = `<span style="color: #3b82f6; font-weight: bold;">⏳ รอของ</span>`
        }

        tableRowsHtml += `
          <tr>
            <td>
               <div style="font-weight: bold; color: #1f2937;">${productName} <span style="font-size: 10px; color: #6b7280; font-weight: normal;">(${unit})</span></div>
            </td>
            <td style="text-align: center; color: #b45309;">${yest}</td>
            <td style="text-align: center; color: #b45309;">${inc}</td>
            <td style="text-align: center; font-weight: bold; color: #1d4ed8;">${eve}</td>
            <td style="text-align: center; color: #374151;">${used}</td>
            <td style="text-align: center; font-weight: bold; background-color: #fff1f2;">${orderHtml}</td>
          </tr>
        `
      })
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>รายงานสต๊อก</title>
        <style>
          body { font-family: 'Sarabun', Tahoma, sans-serif; padding: 20px; color: #1f2937; }
          h1 { color: #be123c; border-bottom: 2px solid #be123c; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px;}
          .header-info { margin-bottom: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 12px; }
          th { background-color: #f3f4f6; color: #374151; font-weight: bold; text-align: center; }
          .category-row td { background-color: #1f2937; color: white; font-weight: bold; text-align: left; }
        </style>
      </head>
      <body>
        <h1>รายงานสรุปการเช็คสต๊อกสินค้า</h1>
        <div class="header-info">
          <strong>ประจำวันที่:</strong> ${reportDate} <br>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">รายการสินค้า</th>
              <th>เหลือเมื่อวาน</th>
              <th>รับเข้า</th>
              <th>นับตอนเย็น</th>
              <th>ถูกใช้ไป</th>
              <th>ต้องสั่งเพิ่ม</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `

    // 2. สร้าง PDF ด้วย Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    })
    
    await browser.close()

    // 3. ส่งอีเมลด้วย Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })

    const mailOptions = {
      from: `"Nuan Suki System" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `รายงานสรุปสต๊อกสินค้า ประจำวันที่ ${reportDate}`,
      text: message,
      attachments: [
        {
          filename: `Stock_Report_${rawDate}.pdf`,
          content: Buffer.from(pdfBuffer),
          contentType: 'application/pdf'
        }
      ]
    }

    await transporter.sendMail(mailOptions)

    // 4. บันทึกประวัติลงฐานข้อมูล
    const { error: insertError } = await supabase.from('email_reports').insert({
      branch_id: branchId,
      report_date: rawDate,
      recipient_email: recipientEmail,
      message: message,
      sender_name: 'System'
    })

    if (insertError) {
      console.error('Error saving report history:', insertError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('PDF/Email Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}