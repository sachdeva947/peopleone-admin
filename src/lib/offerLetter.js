import jsPDF from 'jspdf'

export function generateOfferLetter(employee, salary, company) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const margin = 15
  const contentW = pageW - margin * 2

  // ── HEADER ──────────────────────────────────────────────────
  doc.setFillColor(26, 58, 92)
  doc.rect(0, 0, pageW, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(company?.name || 'PeopleOne', pageW / 2, 13, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(company?.registered_address || '', pageW / 2, 20, { align: 'center' })
  doc.text(
    `PAN: ${company?.pan || '—'}   GSTIN: ${company?.gstin || '—'}   PF: ${company?.pf_establishment_id || '—'}`,
    pageW / 2, 26, { align: 'center' }
  )

  // Gold line
  doc.setFillColor(200, 150, 12)
  doc.rect(0, 32, pageW, 3, 'F')

  // ── TITLE ────────────────────────────────────────────────────
  doc.setTextColor(26, 58, 92)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('OFFER LETTER', pageW / 2, 44, { align: 'center' })

  // ── DATE & REF ───────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(`Date: ${today}`, margin, 53)
  doc.text(`Ref: ${company?.name?.substring(0, 3).toUpperCase() || 'PEO'}/${employee.employee_code || 'OL'}/${new Date().getFullYear()}`, pageW - margin, 53, { align: 'right' })

  // ── CANDIDATE DETAILS ────────────────────────────────────────
  let y = 62
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')

  doc.text(`To,`, margin, y); y += 5
  doc.setFont('helvetica', 'bold')
  doc.text(`${employee.first_name} ${employee.last_name || ''}`, margin, y); y += 5
  doc.setFont('helvetica', 'normal')
  if (employee.current_address) {
    const addrLines = doc.splitTextToSize(employee.current_address, 80)
    addrLines.forEach(line => { doc.text(line, margin, y); y += 4.5 })
  }
  if (employee.mobile) { doc.text(`Mobile: ${employee.mobile}`, margin, y); y += 5 }

  // ── SALUTATION ────────────────────────────────────────────────
  y += 4
  doc.setFontSize(9.5)
  doc.text(`Dear ${employee.first_name},`, margin, y); y += 7

  // ── BODY ─────────────────────────────────────────────────────
  doc.setFontSize(9.5)
  const para1 = `We are pleased to offer you the position of ${employee.designation || '[Designation]'} with ${company?.name || 'PeopleOne'}, deployed at ${employee.site_name || '[Client Site]'}. This offer is subject to the terms and conditions mentioned herein.`
  const para1Lines = doc.splitTextToSize(para1, contentW)
  para1Lines.forEach(line => { doc.text(line, margin, y); y += 5 })
  y += 3

  // ── EMPLOYMENT DETAILS TABLE ──────────────────────────────────
  doc.setFillColor(26, 58, 92)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('EMPLOYMENT DETAILS', margin + 3, y + 5)
  y += 7

  const empDetails = [
    ['Employee Code', employee.employee_code || '—'],
    ['Designation', employee.designation || '—'],
    ['Date of Joining', employee.date_of_joining
      ? new Date(employee.date_of_joining).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'],
    ['Work Location', employee.site_name || '—'],
    ['UAN Number', employee.uan_number || 'To be allotted'],
    ['ESIC', employee.esic_ip_number || 'Not applicable'],
  ]

  empDetails.forEach((row, i) => {
    const fillColor = i % 2 === 0 ? [240, 245, 255] : [255, 255, 255]
    doc.setFillColor(...fillColor)
    doc.rect(margin, y, contentW, 6.5, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(margin, y, contentW, 6.5, 'S')
    doc.setTextColor(80, 80, 80)
    doc.setFont('helvetica', 'bold')
    doc.text(row[0], margin + 2, y + 4.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(row[1], margin + 55, y + 4.5)
    y += 6.5
  })

  y += 5

  // ── SALARY STRUCTURE TABLE ────────────────────────────────────
  doc.setFillColor(26, 58, 92)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('COMPENSATION STRUCTURE (Monthly)', margin + 3, y + 5)
  y += 7

  // Table header
  const col1 = margin
  const col2 = margin + 100
  const col3 = margin + 140
  const rowH = 6.5

  doc.setFillColor(46, 95, 138)
  doc.rect(col1, y, contentW, rowH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Component', col1 + 2, y + 4.5)
  doc.text('Amount (Rs.)', col2, y + 4.5)
  doc.text('Remarks', col3, y + 4.5)
  y += rowH

  const salaryRows = [
    ['Basic Salary', salary?.basic || 0, ''],
    ['House Rent Allowance (HRA)', salary?.hra || 0, ''],
    ['Special Allowance', salary?.special_allowance || 0, ''],
    ['Statutory Bonus', salary?.statutory_bonus || 0, ''],
  ]

  salaryRows.forEach((row, i) => {
    const fillColor = i % 2 === 0 ? [240, 245, 255] : [255, 255, 255]
    doc.setFillColor(...fillColor)
    doc.rect(col1, y, contentW, rowH, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(col1, y, contentW, rowH, 'S')
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.text(row[0], col1 + 2, y + 4.5)
    doc.text(`Rs.${Number(row[1]).toLocaleString()}`, col2, y + 4.5)
    if (row[2]) doc.text(row[2], col3, y + 4.5)
    y += rowH
  })

  // Gross
  doc.setFillColor(230, 240, 255)
  doc.rect(col1, y, contentW, rowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(26, 58, 92)
  doc.text('GROSS SALARY', col1 + 2, y + 4.5)
  doc.text(`Rs.${Number(salary?.gross_monthly || 0).toLocaleString()}`, col2, y + 4.5)
  y += rowH + 2

  // Deductions header
  doc.setFillColor(180, 40, 40)
  doc.rect(col1, y, contentW, rowH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('DEDUCTIONS', col1 + 2, y + 4.5)
  y += rowH

  const deductionRows = [
    ['Provident Fund (Employee)', salary?.pf_employee || Math.min(Math.round((salary?.basic || 0) * 0.12), 1800), 'As per EPF Act'],
    ['ESIC (Employee)', salary?.esic_employee || 0, salary?.gross_monthly <= 21000 ? '0.75% of Gross' : 'Not applicable'],
  ]

  deductionRows.forEach((row, i) => {
    const fillColor = i % 2 === 0 ? [255, 245, 245] : [255, 255, 255]
    doc.setFillColor(...fillColor)
    doc.rect(col1, y, contentW, rowH, 'F')
    doc.setDrawColor(200, 200, 200)
    doc.rect(col1, y, contentW, rowH, 'S')
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.text(row[0], col1 + 2, y + 4.5)
    doc.text(`Rs.${Number(row[1]).toLocaleString()}`, col2, y + 4.5)
    if (row[2]) doc.text(row[2], col3, y + 4.5)
    y += rowH
  })

  // In Hand
  doc.setFillColor(220, 255, 220)
  doc.rect(col1, y, contentW, rowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 100, 0)
  const pfEmp = Math.min(Math.round((salary?.basic || 0) * 0.12), 1800)
  const esicEmp = (salary?.gross_monthly || 0) <= 21000
    ? Math.round((salary?.gross_monthly || 0) * 0.0075) : 0
  const inHand = salary?.in_hand ||
    ((salary?.gross_monthly || 0) - pfEmp - esicEmp)
  doc.text('NET IN-HAND (Monthly)', col1 + 2, y + 4.5)
  doc.text(`Rs.${Number(inHand).toLocaleString()}`, col2, y + 4.5)
  y += rowH + 2

  // CTC
  doc.setFillColor(26, 58, 92)
  doc.rect(col1, y, contentW, rowH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL CTC (Monthly)', col1 + 2, y + 4.5)
  doc.text(`Rs.${Number(salary?.ctc_annual ? salary.ctc_annual / 12 : 0).toLocaleString()}`, col2, y + 4.5)
  y += rowH + 6

  // ── TERMS & CONDITIONS ────────────────────────────────────────
  // Check if need new page
  if (y > pageH - 80) {
    doc.addPage()
    y = 20
  }

  doc.setFillColor(26, 58, 92)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TERMS & CONDITIONS', margin + 3, y + 5)
  y += 10

  const terms = [
    '1. This offer is subject to verification of your educational qualifications, previous employment records, and background verification.',
    '2. The notice period is 30 days from either side after the date of joining.',
    '3. Your employment is subject to the rules, regulations, and policies of the Company as amended from time to time.',
    '4. This offer letter is valid for 7 days from the date of issue. Please confirm your acceptance by signing and returning a copy.',
    '5. You are required to submit all original documents at the time of joining including educational certificates, previous employment letters, and identity proof.',
    '6. The Company reserves the right to terminate employment if any information provided is found to be false or misleading.',
    '7. Salary will be credited to your registered bank account on or before the 7th of every subsequent month.',
    '8. This offer does not constitute a contract of employment and is subject to satisfactory completion of joining formalities.',
  ]

  doc.setTextColor(50, 50, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  terms.forEach(term => {
    const lines = doc.splitTextToSize(term, contentW)
    lines.forEach(line => { doc.text(line, margin, y); y += 4.5 })
    y += 1
  })

  y += 8

  // ── ACCEPTANCE ────────────────────────────────────────────────
  if (y > pageH - 60) { doc.addPage(); y = 20 }

  doc.setFontSize(9.5)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.text('We look forward to welcoming you to our team. Please sign below to confirm your acceptance.', margin, y)
  y += 12

  // Signature boxes
  const boxW = 75
  doc.setDrawColor(100, 100, 100)
  doc.setLineWidth(0.3)

  // Candidate signature
  doc.rect(margin, y, boxW, 20)
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Candidate Signature & Date', margin + 2, y + 24)
  doc.text(employee.first_name + ' ' + (employee.last_name || ''), margin + 2, y + 28)

  // Company signature
  doc.rect(pageW - margin - boxW, y, boxW, 20)
  doc.text('Authorized Signatory', pageW - margin - boxW + 2, y + 24)
  doc.text(company?.name || 'PeopleOne', pageW - margin - boxW + 2, y + 28)

  y += 35

  // ── FOOTER ────────────────────────────────────────────────────
  doc.setDrawColor(200, 150, 12)
  doc.setLineWidth(0.5)
  doc.line(margin, pageH - 15, pageW - margin, pageH - 15)
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text(
    `${company?.name || 'PeopleOne'} | ${company?.registered_address || ''} | ${company?.pan || ''}`,
    pageW / 2, pageH - 10, { align: 'center' }
  )
  doc.text('This is a computer-generated offer letter.', pageW / 2, pageH - 6, { align: 'center' })

  // Save
  const filename = `Offer_Letter_${employee.first_name}_${employee.employee_code || 'OL'}.pdf`
  doc.save(filename)
}