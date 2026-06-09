// ============================================================
// PEOPLEONE PAYROLL ENGINE
// PF / ESIC / PT / LWF / TDS calculation
// ============================================================

// PT Slabs — state-wise
const PT_SLABS = {
  KA: [{ min: 0, max: 15000, amount: 0 }, { min: 15001, max: null, amount: 200 }],
  MP: [{ min: 0, max: 18750, amount: 125 }, { min: 18751, max: null, amount: 208 }],
  TG: [{ min: 0, max: 15000, amount: 0 }, { min: 15001, max: null, amount: 200 }],
  TN: [{ min: 0, max: 21000, amount: 0 }, { min: 21001, max: null, amount: 208 }],
  AP: [{ min: 0, max: 15000, amount: 0 }, { min: 15001, max: null, amount: 200 }],
  MH: [{ min: 0, max: 7500, amount: 0 }, { min: 7501, max: 10000, amount: 175 }, { min: 10001, max: null, amount: 200 }],
  GJ: [{ min: 0, max: 12000, amount: 0 }, { min: 12001, max: null, amount: 200 }],
  OR: [{ min: 0, max: 20000, amount: 0 }, { min: 20001, max: null, amount: 100 }],
  WB: [{ min: 0, max: 10000, amount: 0 }, { min: 10001, max: 25000, amount: 110 }, { min: 25001, max: null, amount: 200 }],
  JH: [{ min: 0, max: 25000, amount: 0 }, { min: 25001, max: null, amount: 100 }],
  DL: [], HR: [], UP: [], // No PT
}

// PT Frequency
const PT_FREQUENCY = {
  KA: 'monthly', MP: 'monthly', TG: 'monthly', AP: 'monthly',
  MH: 'monthly', GJ: 'monthly', WB: 'monthly', JH: 'monthly',
  TN: 'halfyearly', OR: 'annual',
  DL: null, HR: null, UP: null,
}

// LWF Config
const LWF_CONFIG = {
  DL: { employee: 6,   employer: 12,  months: [6, 12] },
  HR: { employee: 10,  employer: 20,  months: [6, 12] },
  KA: { employee: 20,  employer: 40,  months: [6, 12] },
  UP: { employee: 10,  employer: 20,  months: [12] },
  MP: { employee: 10,  employer: 20,  months: [6, 12] },
  TN: { employee: 10,  employer: 20,  months: [12] },
  MH: { employee: 6,   employer: 12,  months: [6, 12] },
  GJ: { employee: 6,   employer: 12,  months: [12] },
  OR: { employee: 10,  employer: 20,  months: [6, 12] },
  WB: { employee: 3,   employer: 15,  months: [6, 12] },
  JH: { employee: 10,  employer: 20,  months: [12] },
  TG: null, AP: null, // No LWF
}

// ── CALCULATE PT ──────────────────────────────────────────────
export function calculatePT(grossMonthly, stateCode, payrollMonth) {
  const slabs = PT_SLABS[stateCode]
  const freq = PT_FREQUENCY[stateCode]
  if (!slabs || slabs.length === 0 || !freq) return 0

  const month = new Date(payrollMonth).getMonth() + 1 // 1-12

  // Half-yearly (TN) — collect in Oct and Apr
  if (freq === 'halfyearly') {
    if (month !== 4 && month !== 10) return 0
    // 6 months worth
    const monthlyPT = getSlabAmount(grossMonthly, slabs)
    return monthlyPT * 6
  }

  // Annual (OR) — collect in March
  if (freq === 'annual') {
    if (month !== 3) return 0
    const monthlyPT = getSlabAmount(grossMonthly, slabs)
    return monthlyPT * 12
  }

  // Monthly
  return getSlabAmount(grossMonthly, slabs)
}

function getSlabAmount(gross, slabs) {
  for (const slab of slabs) {
    if (gross >= slab.min && (slab.max === null || gross <= slab.max)) {
      return slab.amount
    }
  }
  return 0
}

// ── CALCULATE LWF ─────────────────────────────────────────────
export function calculateLWF(stateCode, payrollMonth) {
  const config = LWF_CONFIG[stateCode]
  if (!config) return { employee: 0, employer: 0 }

  const month = new Date(payrollMonth).getMonth() + 1
  if (!config.months.includes(month)) return { employee: 0, employer: 0 }

  return { employee: config.employee, employer: config.employer }
}

// ── CALCULATE PF ──────────────────────────────────────────────
export function calculatePF(basic) {
  const pfWage = Math.min(basic, 15000) // PF wage ceiling
  const employee = Math.round(pfWage * 0.12)   // 12%
  const eps      = Math.round(pfWage * 0.0833) // 8.33% EPS
  const epf      = Math.round(pfWage * 0.0367) // 3.67% EPF
  const edli     = Math.round(pfWage * 0.005)  // 0.5% EDLI
  const admin    = Math.round(pfWage * 0.005)  // 0.5% Admin
  return { employee, employer: eps + epf, eps, epf, edli, admin }
}

// ── CALCULATE ESIC ────────────────────────────────────────────
export function calculateESIC(grossMonthly) {
  if (grossMonthly > 21000) return { employee: 0, employer: 0 }
  return {
    employee: Math.round(grossMonthly * 0.0075),  // 0.75%
    employer: Math.round(grossMonthly * 0.0325),  // 3.25%
  }
}

// ── MAIN PAYROLL CALCULATOR ───────────────────────────────────
export function calculateEmployeePayroll(employee, salary, stateCode, payrollMonth, attendanceData = {}) {
  const workingDays = attendanceData.workingDays || 26
  const paidDays = attendanceData.paidDays || 26
  const lopDays = workingDays - paidDays

  // Pro-rate salary if LOP
  const lopFactor = paidDays / workingDays
  const gross = Math.round(salary.gross_monthly * lopFactor)
  const basic = Math.round(salary.basic * lopFactor)
  const hra = Math.round(salary.hra * lopFactor)
  const conveyance = Math.round((salary.conveyance || 0) * lopFactor)
  const medical = Math.round((salary.medical || 0) * lopFactor)
  const special = gross - basic - hra - conveyance - medical

  // Statutory deductions
  const pf = calculatePF(basic)
  const esic = calculateESIC(gross)
  const pt = calculatePT(gross, stateCode, payrollMonth)
  const lwf = calculateLWF(stateCode, payrollMonth)

  const totalDeductions = pf.employee + esic.employee + pt + lwf.employee
  const netPay = gross - totalDeductions

  return {
    // Attendance
    working_days: workingDays,
    paid_days: paidDays,
    lop_days: lopDays,

    // Earnings
    basic,
    hra,
    conveyance,
    medical,
    special_allowance: Math.max(0, special),
    gross_earnings: gross,

    // Employee deductions
    pf_employee: pf.employee,
    esic_employee: esic.employee,
    pt_employee: pt,
    lwf_employee: lwf.employee,
    tds: 0, // TDS calculated separately

    // Employer contributions
    pf_employer: pf.employer,
    pf_employer_eps: pf.eps,
    pf_employer_epf: pf.epf,
    esic_employer: esic.employer,
    lwf_employer: lwf.employer,

    // Net
    total_deductions: totalDeductions,
    net_pay: Math.max(0, netPay),
  }
}