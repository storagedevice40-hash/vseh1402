// ==========================================================================
// VSEH PRO - SUPABASE DIRECT CLOUD DATABASE ENGINE (ZERO LOCALSTORAGE CACHE)
// ==========================================================================
const SUPABASE_URL = 'https://elytgxvdnlasaricgybo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVseXRneHZkbmxhc2FyaWNneWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjM4OTcsImV4cCI6MjEwNDc5OTg5N30.ua5uno1m3972457XkHChtqvhe75WDok3h-q_-7J1vYA';

var appData = { students: [], payments: [], attendance: [], feeSettings: {}, waSettings: { instanceId: 'instance175857', token: '7yqm7bhojwpovbu4' }, recentDismissedIds: [], paidCount: 0, autopilotEnabled: true };

function getTargetFeeMonth() {
    let now = new Date();
    if (now.getDate() <= 10) {
        now.setMonth(now.getMonth() - 1);
    }
    return now.toLocaleString('default', { month: 'long' });
}


// ==========================================================================
// DYNAMIC 30-DAY BILLING CYCLE & MULTI-MONTH FEE CALCULATION ENGINE
// ==========================================================================
const ALL_MONTHS_LIST = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function calculateStudentDues(student, payments) {
    if (!student) {
        return { pendingMonths: [], pendingCount: 0, totalPendingAmount: 0, isOverdue: false, formattedPendingText: '', nextDueDate: '' };
    }

    let rawJoin = student.joinDate || student.date;
    let joinDate = rawJoin ? new Date(rawJoin) : new Date();
    if (isNaN(joinDate.getTime())) joinDate = new Date();

    let now = new Date();
    let studentFee = Number(student.fee) || 500;
    let sName = (student.name || '').trim().toUpperCase();
    let sClass = (student.class || '').trim();

    // Find all payments made by this student
    let studentPayments = (payments || []).filter(p => {
        let matchName = (p.studentName || '').trim().toUpperCase() === sName;
        let matchClass = !sClass || !p.className || (p.className || '').trim() === sClass;
        let matchId = student.id && p.studentId && (p.studentId === student.id);
        return matchId || (matchName && matchClass);
    });

    // Build set of paid months (lowercase for reliable matching)
    let paidMonthsSet = new Set();
    studentPayments.forEach(p => {
        let pMonth = (p.month || '').trim();
        let splitMonths = pMonth.split(/[,&+]|and/i);
        splitMonths.forEach(m => {
            let clean = m.trim().toLowerCase();
            if (clean) paidMonthsSet.add(clean);
        });
    });

    if (student.pastPayments) {
        try {
            let past = typeof student.pastPayments === 'string' ? JSON.parse(student.pastPayments) : student.pastPayments;
            if (Array.isArray(past)) {
                past.forEach(p => {
                    if (p.month) paidMonthsSet.add(p.month.trim().toLowerCase());
                });
            }
        } catch(e) {}
    }

    // Step cycle by cycle (month by month) from joinDate
    let pendingMonths = [];
    let allDueMonths = [];
    let joinDay = joinDate.getDate();

    let curYear = joinDate.getFullYear();
    let curMonth = joinDate.getMonth();

    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();
    let todayDay = now.getDate();

    while (curYear < targetYear || (curYear === targetYear && curMonth <= targetMonth)) {
        let mName = ALL_MONTHS_LIST[curMonth];
        let cycleDueDate = new Date(curYear, curMonth, joinDay);
        
        // Cycle is due if current date has reached or passed cycleDueDate
        let isCycleDue = (now >= cycleDueDate);

        if (isCycleDue) {
            allDueMonths.push(mName);
            if (!paidMonthsSet.has(mName.toLowerCase())) {
                pendingMonths.push(mName);
            }
        }

        curMonth++;
        if (curMonth > 11) {
            curMonth = 0;
            curYear++;
        }
    }

    // Compute next due date string
    let nextDueYear = targetYear;
    let nextDueMonth = targetMonth;
    if (todayDay >= joinDay) {
        nextDueMonth++;
        if (nextDueMonth > 11) {
            nextDueMonth = 0;
            nextDueYear++;
        }
    }
    let nextDueDateStr = `${joinDay} ${ALL_MONTHS_LIST[nextDueMonth]} ${nextDueYear}`;

    // Format human-readable pending months string
    let formattedPendingText = "";
    if (pendingMonths.length === 1) {
        formattedPendingText = pendingMonths[0].toUpperCase();
    } else if (pendingMonths.length === 2) {
        formattedPendingText = `${pendingMonths[0].toUpperCase()} AND ${pendingMonths[1].toUpperCase()}`;
    } else if (pendingMonths.length > 2) {
        let allButLast = pendingMonths.slice(0, -1).map(m => m.toUpperCase()).join(", ");
        formattedPendingText = `${allButLast} AND ${pendingMonths[pendingMonths.length - 1].toUpperCase()}`;
    }

    let totalPendingAmount = pendingMonths.length * studentFee;

    return {
        pendingMonths,
        pendingCount: pendingMonths.length,
        totalPendingAmount,
        isOverdue: pendingMonths.length > 0,
        allDueMonths,
        nextDueDate: nextDueDateStr,
        joinDay: joinDay,
        formattedPendingText
    };
}

var currentMonthName = new Date().toLocaleString('default', { month: 'long' });
var targetFeeMonth = getTargetFeeMonth();
var currentMode = ''; 
var currentStudentExpectedFee = 0; 
var setLocked = true;
var clsLocked = true; 
var waLocked = true; 
var delLocked = true;
var modalLocked = false; 
var isRevenueHidden = true;
var recentLocked = true;

// DIRECT SUPABASE POSTGREST CLIENT HELPER
async function supabaseFetch(table, query = '', method = 'GET', body = null, extraHeaders = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        ...extraHeaders
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    try {
        const res = await fetch(url, options);
        if (res.status === 204) return { success: true };
        const text = await res.text();
        if (!text || text.trim() === '') return { success: true };
        try { return JSON.parse(text); } catch(err) { return { success: true }; }
    } catch(e) {
        console.error(`Supabase error on ${table}:`, e);
        return null;
    }
}

// SILENT BACKGROUND GOOGLE SHEET BACKUP MIRROR (NON-BLOCKING / ZERO-GLITCH)
const GOOGLE_SHEET_BACKUP_URL = 'https://script.google.com/macros/s/AKfycbzEhf8sVHoFZekwbcdGwZZiwBpOkulBeY5hyCA777QGM6eS9OSaS8HtAWPx_h3kmO-T/exec';

function mirrorToGoogleSheet(action, data) {
    if (!GOOGLE_SHEET_BACKUP_URL || !action) return;
    try {
        setTimeout(() => {
            fetch(GOOGLE_SHEET_BACKUP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: action, data: data })
            }).catch(e => {});
        }, 150);
    } catch(err) {}
}

// FULL DIRECT API DISPATCHER (ZERO LOCALSTORAGE - 100% REALTIME LIVE DATA)
async function gasApi(action, payload = null) {
    try {
        if (action === 'getAppData') {
            const [rawStudents, rawPayments, rawAttendance, rawClassFees, rawSettings] = await Promise.all([
                supabaseFetch('students', '?select=*&order=created_at.desc'),
                supabaseFetch('payments', '?select=*&order=created_at.desc'),
                supabaseFetch('attendance', '?select=*&order=created_at.desc'),
                supabaseFetch('class_fees', '?select=*'),
                supabaseFetch('settings', '?select=*')
            ]);

            // Students mapping
            const students = Array.isArray(rawStudents) ? rawStudents.map(r => ({
                id: String(r.id || ''),
                name: String(r.name || '').toUpperCase(),
                gender: String(r.gender || 'Male'),
                class: String(r.class || ''),
                phone: String(r.phone || ''),
                fee: String(r.fee || '0'),
                date: String(r.join_date || ''),
                joinDate: String(r.join_date || ''),
                shift: String(r.shift || 'Morning')
            })) : [];

            // Payments & Paid Count
            const currentMonth = new Date().toLocaleString('default', { month: 'long' });
            const currentYear = new Date().getFullYear();
            let paidCount = 0;

            const payments = Array.isArray(rawPayments) ? rawPayments.map(r => {
                const pMonth = String(r.month || '');
                const pDateStr = String(r.date || '');
                const pAmount = r.amount || 0;

                const pMonthsList = pMonth.split(/[,&+]| and /i).map(m => m.trim().toLowerCase());
                if (pMonthsList.includes(currentMonth.toLowerCase())) {
                    const d = new Date(pDateStr);
                    if (!isNaN(d.getTime()) && d.getFullYear() === currentYear) {
                        paidCount++;
                    }
                }

                return {
                    id: String(r.id || ''),
                    studentId: String(r.student_id || ''),
                    studentName: String(r.student_name || ''),
                    className: String(r.class_name || ''),
                    phone: String(r.phone || ''),
                    amount: pAmount,
                    month: pMonth,
                    date: pDateStr,
                    mode: String(r.mode || 'CASH')
                };
            }) : [];

            // Attendance Grouping
            let attendance = [];
            if (Array.isArray(rawAttendance)) {
                let groupedAtt = {};
                rawAttendance.forEach(record => {
                    let cleanDate = record.date;
                    let key = cleanDate + '|' + (record.class || '');
                    if (!groupedAtt[key]) {
                        groupedAtt[key] = { date: cleanDate, class: record.class, records: {} };
                    }
                    groupedAtt[key].records[record.student_name] = record.status;
                });
                attendance = Object.values(groupedAtt);
            }

            // Class Fees
            const feeSettings = {};
            if (Array.isArray(rawClassFees)) {
                rawClassFees.forEach(r => {
                    if (r.class_name) feeSettings[String(r.class_name)] = String(r.fee_amount || '0');
                });
            }

            // WhatsApp Settings & Recent Dismissed IDs (Dynamic from DB)
            let waSettings = { instanceId: 'instance175857', token: '7yqm7bhojwpovbu4' };
            let recentDismissedIds = [];
            if (Array.isArray(rawSettings)) {
                const waRow = rawSettings.find(r => r.key === 'waSettings');
                if (waRow && waRow.value) {
                    try {
                        const parsed = typeof waRow.value === 'string' ? JSON.parse(waRow.value) : waRow.value;
                        if (parsed.instanceId) waSettings.instanceId = parsed.instanceId;
                        if (parsed.token) waSettings.token = parsed.token;
                    } catch(e) {}
                }
                const disRow = rawSettings.find(r => r.key === 'recentDismissedIds');
                if (disRow && disRow.value) {
                    try {
                        recentDismissedIds = typeof disRow.value === 'string' ? JSON.parse(disRow.value) : disRow.value;
                    } catch(e) {}
                }
                const remRow = rawSettings.find(r => r.key === 'autoRemindersLog');
                var autoRemindersLog = {};
                if (remRow && remRow.value) {
                    try {
                        autoRemindersLog = typeof remRow.value === 'string' ? JSON.parse(remRow.value) : remRow.value;
                    } catch(e) {}
                }
            }

            return {
                status: 'success',
                students,
                payments,
                attendance,
                feeSettings,
                waSettings,
                recentDismissedIds: Array.isArray(recentDismissedIds) ? recentDismissedIds : [],
                autoRemindersLog: autoRemindersLog && typeof autoRemindersLog === 'object' ? autoRemindersLog : {},
                paidCount
            };
        }

        if (action === 'saveStudent') {
            const data = payload;
            const studentPayload = {
                id: data.id,
                name: (data.name || '').toUpperCase(),
                gender: data.gender || 'Male',
                class: data.class || '',
                phone: data.phone || '',
                fee: String(data.fee || '0'),
                join_date: data.joinDate || data.date || '',
                shift: data.shift || 'Morning'
            };

            await supabaseFetch('students', '', 'POST', [studentPayload], {
                'Prefer': 'resolution=merge-duplicates'
            });

            if (data.pastPayments) {
                try {
                    const past = typeof data.pastPayments === 'string' ? JSON.parse(data.pastPayments) : data.pastPayments;
                    if (Array.isArray(past) && past.length > 0) {
                        const payRecords = past.map(item => ({
                            id: "TXN" + Date.now() + Math.floor(Math.random() * 1000),
                            student_id: data.id,
                            student_name: data.name,
                            class_name: data.class,
                            phone: data.phone || '',
                            amount: Number(item.amount || data.fee || 0),
                            month: item.month || '',
                            date: item.date || data.joinDate || '',
                            mode: item.mode || "PRE-PAID"
                        }));
                        await supabaseFetch('payments', '', 'POST', payRecords);
                    }
                } catch(e) {}
            }

            mirrorToGoogleSheet('saveStudent', data);
            return await gasApi('getAppData');
        }

        if (action === 'deleteStudent') {
            const studentId = payload.id;
            const res = await supabaseFetch('students', `?id=eq.${studentId}&select=*`);
            if (Array.isArray(res) && res.length > 0) {
                const s = res[0];
                await supabaseFetch('archived_students', '', 'POST', [{
                    id: s.id,
                    name: s.name,
                    gender: s.gender,
                    class: s.class,
                    phone: s.phone,
                    fee: s.fee,
                    join_date: s.join_date,
                    shift: s.shift,
                    deleted_at: new Date().toISOString()
                }]);
                await supabaseFetch('students', `?id=eq.${studentId}`, 'DELETE');
            }
            mirrorToGoogleSheet('deleteStudent', payload);
            return await gasApi('getAppData');
        }

        if (action === 'clearRecentPayments') {
            const ids = (payload && payload.ids) ? payload.ids : [];
            let currentDismissed = appData.recentDismissedIds || [];
            let merged = Array.from(new Set([...currentDismissed, ...ids]));
            await supabaseFetch('settings', '', 'POST', [{
                key: 'recentDismissedIds',
                value: JSON.stringify(merged)
            }], {
                'Prefer': 'resolution=merge-duplicates'
            });
            appData.recentDismissedIds = merged;
            return await gasApi('getAppData');
        }

        if (action === 'savePayment') {
            const data = payload;
            const row = {
                id: data.id || ('TXN' + Date.now()),
                student_id: data.studentId || '',
                student_name: data.studentName || '',
                class_name: data.className || data.class || '',
                phone: data.phone || '',
                amount: Number(data.amount) || 0,
                month: data.month || '',
                date: data.date || '',
                mode: data.mode || 'CASH'
            };
            await supabaseFetch('payments', '', 'POST', [row], {
                'Prefer': 'resolution=merge-duplicates'
            });
            mirrorToGoogleSheet('savePayment', data);
            return await gasApi('getAppData');
        }

        if (action === 'saveAttendanceBatch') {
            const records = payload;
            if (Array.isArray(records) && records.length > 0) {
                const batch = records.map(rec => ({
                    id: rec.id || ('ATT' + Date.now() + Math.floor(Math.random() * 1000)),
                    student_id: rec.studentId || '',
                    student_name: rec.studentName || '',
                    class: rec.class || '',
                    date: rec.date || '',
                    month: rec.month || '',
                    status: rec.status || 'Present'
                }));
                await supabaseFetch('attendance', '', 'POST', batch);
            }
            mirrorToGoogleSheet('saveAttendanceBatch', records);
            return await gasApi('getAppData');
        }

        if (action === 'saveAllSettings') {
            const data = payload;
            if (data.feeSettings && typeof data.feeSettings === 'object') {
                const feeRows = [];
                for (const className in data.feeSettings) {
                    if (data.feeSettings.hasOwnProperty(className) && className !== 'waSettings') {
                        feeRows.push({
                            class_name: className,
                            fee_amount: String(data.feeSettings[className])
                        });
                    }
                }
                if (feeRows.length > 0) {
                    await supabaseFetch('class_fees', '', 'POST', feeRows, {
                        'Prefer': 'resolution=merge-duplicates'
                    });
                }
            }
            if (data.waSettings) {
                const valStr = JSON.stringify(data.waSettings);
                await supabaseFetch('settings', '', 'POST', [{
                    key: 'waSettings',
                    value: valStr
                }], {
                    'Prefer': 'resolution=merge-duplicates'
                });
            }
            mirrorToGoogleSheet('saveAllSettings', data);
            return await gasApi('getAppData');
        }

        if (action === 'stealthWhatsAppTrigger') {
            const phone = payload.phone;
            const message = payload.message;
            let cleanPhone = String(phone || '').replace(/\D/g, '');
            if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
            if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

            let inst = (appData.waSettings && appData.waSettings.instanceId) ? appData.waSettings.instanceId : 'instance175857';
            let tok = (appData.waSettings && appData.waSettings.token) ? appData.waSettings.token : '7yqm7bhojwpovbu4';

            // 1. Try Vercel Serverless Function Proxy (bypasses Cloudflare)
            try {
                const res = await fetch('/api?action=stealthWhatsAppTrigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'stealthWhatsAppTrigger',
                        data: { phone: cleanPhone, message: message, instanceId: inst, token: tok }
                    })
                });
                if (res.ok) {
                    const resData = await res.json();
                    if (resData && resData.status === 'success') return resData;
                }
            } catch(e) {
                console.warn("Vercel proxy failed, trying fallback:", e);
            }

            // 2. Direct UltraMsg Cloud POST
            try {
                const apiUrl = `https://api.ultramsg.com/${inst}/messages/chat`;
                const resp = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ token: tok, to: cleanPhone, body: message })
                });
                const text = await resp.text();
                return { status: 'success', message: 'Sent', apiResponse: text };
            } catch(e) {
                console.error("Direct UltraMsg error:", e);
            }

            // 3. Fallback to Apps Script web app proxy
            try {
                const gasUrl = 'https://script.google.com/macros/s/AKfycbzEhf8sVHoFZekwbcdGwZZiwBpOkulBeY5hyCA777QGM6eS9OSaS8HtAWPx_h3kmO-T/exec?action=stealthWhatsAppTrigger';
                const resp = await fetch(gasUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'stealthWhatsAppTrigger', data: { phone: cleanPhone, message: message, instanceId: inst, token: tok } })
                });
                return await resp.json();
            } catch(e) {
                return { status: 'error', message: e.toString() };
            }
        }

        if (action === 'processAiCommand') {
            const userPrompt = payload.prompt || payload.command;
            const contextData = payload.context || {};
            let roster = "No data yet.";
            if (contextData.students && contextData.students.length > 0) {
                roster = contextData.students.map(s => `${s.name} (Class: ${s.class}, Fee: ${s.fee})`).join("\n");
            }
            const systemPrompt = `You are "Vijay Sir AI Assistant" for VSEH PRO.\nCurrent Date: ${new Date().toLocaleDateString('en-GB')}\nTotal Students: ${contextData.students ? contextData.students.length : 0}\nThis Month Paid Students: ${contextData.paidCount || 0}\n\nROSTER DATA:\n${roster}\n\nAnswer in simple Hindi + English mix. Keep responses concise and direct. Format beautifully with bolding.\nIf the user asks you to mark attendance (present or absent) for all students of a specific class, add this command block at the end: <CMD>MARK_ATTENDANCE|Class|Status</CMD>`;
            const finalPrompt = systemPrompt + "\n\nUser Command: " + userPrompt;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyDgvMXsvNyliJCtqLTUK0Y_hLjC8i0LUVI`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
            });
            const resJson = await resp.json();
            if (resJson.error) return { status: 'error', message: resJson.error.message };
            const aiReply = resJson.candidates[0].content.parts[0].text.trim();
            return { status: 'success', result: { intent: "TEXT_RESPONSE", message: aiReply } };
        }

        return { status: 'error', message: 'Unknown action' };
    } catch(e) {
        console.error("gasApi Error:", e);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setInterval(updateClock, 1000); updateClock();
    document.getElementById('feeMonth').value = currentMonthName;
    document.getElementById('attDate').valueAsDate = new Date();
    document.getElementById('feeDate').valueAsDate = new Date();
    document.getElementById('stuDate').valueAsDate = new Date();

    // PERMANENTLY PURGE OLD LOCALSTORAGE CACHE
    try { localStorage.removeItem('vsehData'); } catch(e) {}

    gasApi('getAppData').then(function(res) {
        if(res && res.status === 'success') {
            appData = Object.assign(appData, res);
            document.getElementById('globalLoader').style.display = 'none';
            syncUIPanels();
        } else {
            document.getElementById('globalLoader').style.display = 'none';
            syncUIPanels();
        }
    }).catch(function(err) {
        document.getElementById('globalLoader').style.display = 'none';
        syncUIPanels();
    });
});


// ==========================================================================
// STRICT NEXT-DAY MORNING AUTOPILOT OVERDUE DISPATCH ENGINE
// ==========================================================================
// User Rules:
// 1. Automatic reminder ONLY sent on the EXACT NEXT DAY after the due date (e.g. Due on 5th -> sent on 6th).
// 2. ONLY sent in the MORNING window (8:00 AM to 12:00 PM).
// 3. Sent EXACTLY ONCE per billing cycle per student. NEVER repeated on reload!
// 4. On day + 2, day + 3, or any later date: NO AUTOMATIC REMINDERS!
// 5. Subsequent reminders can ONLY be sent when user manually clicks "Remind" button.
// ==========================================================================
async function runAutopilotDueCheck() {
    if (!appData.autopilotEnabled) return;

    let now = new Date();
    let currentHour = now.getHours();

    // STRICT RULE 1: Morning Window ONLY (8:00 AM to 12:00 PM)
    if (currentHour < 8 || currentHour >= 12) {
        return;
    }

    // Load persistent log of sent reminders (localStorage + Supabase settings)
    let localLog = {};
    try {
        let stored = localStorage.getItem('vseh_auto_reminders_log');
        if (stored) localLog = JSON.parse(stored);
    } catch(e) {}
    
    let dbLog = appData.autoRemindersLog || {};
    let combinedLog = Object.assign({}, dbLog, localLog);

    let alertedCount = 0;
    let logUpdated = false;

    for (let i = 0; i < (appData.students || []).length; i++) {
        let s = appData.students[i];
        if (!s || !s.phone) continue;

        let dues = calculateStudentDues(s, appData.payments);
        if (!dues.isOverdue || dues.pendingMonths.length === 0) continue;

        // Parse student's join / due day
        let rawJoin = s.joinDate || s.date;
        if (!rawJoin) continue;
        let joinDate = new Date(rawJoin);
        if (isNaN(joinDate.getTime())) {
            let p = rawJoin.split('/');
            if (p.length === 3) joinDate = new Date(p[2], p[1] - 1, p[0]);
        }
        if (isNaN(joinDate.getTime())) continue;

        let joinDay = joinDate.getDate();

        // Check each pending month
        for (let m = 0; m < dues.pendingMonths.length; m++) {
            let pMonthName = dues.pendingMonths[m];
            let pMonthIdx = ALL_MONTHS_LIST.findIndex(name => name.toLowerCase() === pMonthName.toLowerCase());
            if (pMonthIdx < 0) continue;

            let cycleYear = now.getFullYear();
            if (now.getMonth() < pMonthIdx) {
                cycleYear--;
            }

            // STRICT RULE 2: Must be the EXACT NEXT DAY after the due date (e.g. Due 5th -> Next Day 6th)
            // "fees kaa date kee taak naa ayee toooh next day dalnaa haii usakee baad nahii dalnaa haii"
            let nextDayDate = new Date(cycleYear, pMonthIdx, joinDay + 1);

            let isExactNextDay = (
                now.getFullYear() === nextDayDate.getFullYear() &&
                now.getMonth() === nextDayDate.getMonth() &&
                now.getDate() === nextDayDate.getDate()
            );

            if (!isExactNextDay) {
                // Not the next day -> Do NOT send automatically!
                continue;
            }

            // STRICT RULE 3: Send EXACTLY ONCE for this cycle. Check persistent log.
            let logKey = (s.id || s.name).trim().toUpperCase() + '_' + pMonthName.toUpperCase() + '_' + cycleYear;

            if (combinedLog[logKey]) {
                // Already sent! Skip!
                continue;
            }

            // Mark as sent immediately to prevent any duplicate/reload firing
            combinedLog[logKey] = now.toISOString();
            logUpdated = true;

            await sendSoftReminder(i, true);
            alertedCount++;

            // Only 1 reminder per student per cycle
            break;
        }
    }

    if (logUpdated) {
        try {
            localStorage.setItem('vseh_auto_reminders_log', JSON.stringify(combinedLog));
        } catch(e) {}

        appData.autoRemindersLog = combinedLog;

        try {
            await supabaseFetch('settings', '', 'POST', [{
                key: 'autoRemindersLog',
                value: JSON.stringify(combinedLog)
            }], {
                'Prefer': 'resolution=merge-duplicates'
            });
        } catch(e) {}
    }

    if (alertedCount > 0) {
        showToast(`AUTOMATIC: ${alertedCount} NEXT-DAY REMINDER SENT 🌟`);
    }
}

function syncUIPanels() {
    initSettingsUI();
    runAutopilotDueCheck(); 
    updateDashboard();
    if(document.getElementById('dirShift')) filterClasses('dirShift', 'dirClass'); 
    if(document.getElementById('attShift')) filterClasses('attShift', 'attClass');
    updateClassStatusIndicator();
    renderStudents(); 
    renderDefaulters();
    renderPaidStudents();
    runAiBriefingModels();
}

        function updateClock() {
            var now = new Date();
            var d = ("0" + now.getDate()).slice(-2), m = ("0" + (now.getMonth() + 1)).slice(-2), y = now.getFullYear();
            document.getElementById('headerDate').innerText = d + "/" + m + "/" + y;
            document.getElementById('headerTime').innerText = now.toLocaleTimeString('en-GB', { hour12: true });
        }

        function showToast(msg) {
            var t = document.getElementById('toast');
            document.getElementById('toastMsg').innerText = msg;
            t.style.top = '12px'; 
            t.style.opacity = '1';
            t.style.transform = 'translate(-50%, 0) scale(1)';
            setTimeout(function() { 
                t.style.top = '-100px'; 
                t.style.opacity = '0'; 
                t.style.transform = 'translate(-50%, -20px) scale(0.85)';
            }, 3000);
        }

        function generateId(prefix) {
            return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
        }

        async function sendSuccessMsg(name, phone, amt, mnth, mode) {
            var msg = `Fee Payment Receipt 🧾✨\n\nDear Parent,\n\nWe have received the monthly fee payment of *₹${amt}* for *${name.toUpperCase()}* for the month of *${mnth.toUpperCase()}* (Mode: *${mode}*).\n\nThank you for your timely payment and trust in us! We are committed to providing the best learning guidance and care for your child's bright academic future. 🌟\n\nWith Best Regards,\n*VIJAY SIR EDUCATION HUB*`;
            showToast("DISPATCHING RECEIPT TO WHATSAPP...");
            let res = await gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
            if (res && (res.status === 'success' || res.sent === 'true' || res.sent === true)) {
                showToast("✔ RECEIPT SENT TO WHATSAPP!");
            } else {
                showToast("RECEIPT DISPATCH LOGGED");
            }
        }

                        async function sendSoftReminder(index, isAuto = false) {
            let s = appData.students[index];
            if (!s || !s.phone) {
                if (!isAuto) showToast("STUDENT HAS NO PHONE NUMBER");
                return;
            }

            let dues = calculateStudentDues(s, appData.payments);
            if (!dues.isOverdue) {
                if (!isAuto) showToast("ALL FEES ARE CLEARED FOR " + s.name.toUpperCase());
                return;
            }

            let feeAmt = dues.totalPendingAmount;
            let monthsText = dues.formattedPendingText;

            var msg = `Greetings! 🌟

Hope *${s.name.toUpperCase()}* is doing well.

This is a gentle reminder regarding the pending fee of *₹${feeAmt}* for *${monthsText}*. Kindly process it when convenient.

Warm Regards,
*VIJAY SIR EDUCATION HUB*`;

            if (!isAuto) showToast("SENDING REMINDER TO " + s.name.toUpperCase() + "...");
            let res = await gasApi('stealthWhatsAppTrigger', { phone: s.phone, message: msg });

            if (!s.reminderHistory) s.reminderHistory = [];
            let now = new Date();
            let timeStr = now.toLocaleDateString('en-GB') + " " + now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
            s.reminderHistory.push(timeStr);

            // Record in persistent log so auto-reminder will never duplicate for this cycle
            if (dues.pendingMonths && dues.pendingMonths.length > 0) {
                let cycleYear = now.getFullYear();
                let logKey = (s.id || s.name).trim().toUpperCase() + '_' + dues.pendingMonths[0].toUpperCase() + '_' + cycleYear;
                try {
                    let stored = localStorage.getItem('vseh_auto_reminders_log');
                    let log = stored ? JSON.parse(stored) : {};
                    log[logKey] = now.toISOString();
                    localStorage.setItem('vseh_auto_reminders_log', JSON.stringify(log));
                    if (!appData.autoRemindersLog) appData.autoRemindersLog = {};
                    appData.autoRemindersLog[logKey] = now.toISOString();
                } catch(e) {}
            }

            if (!isAuto) {
                renderDefaulters();
                if (res && (res.status === 'success' || res.sent === 'true' || res.sent === true)) {
                    showToast("✔ REMINDER SENT TO " + s.name.toUpperCase());
                } else {
                    showToast("✖ FAILED: " + (res && res.message ? res.message : "COULD NOT SEND"));
                }
            }
        }

        async function testWaSend() {
            let phone = document.getElementById('waTestPhone').value.trim();
            let resP = document.getElementById('waTestResult');
            let btn = document.getElementById('btn-test-wa');
            if (!phone || phone.length < 10) {
                showToast("ENTER 10-DIGIT MOBILE NUMBER");
                return;
            }
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Sending...';
                btn.disabled = true;
            }
            if (resP) {
                resP.classList.remove('hidden', 'text-green-600', 'text-red-500');
                resP.classList.add('text-indigo-600');
                resP.innerText = 'Dispatching message to WhatsApp...';
            }

            let testMsg = 'VIJAY SIR EDUCATION HUB - WhatsApp Integration Test Successful! 🎉';
            let result = await gasApi('stealthWhatsAppTrigger', { phone: phone, message: testMsg });

            if (btn) {
                btn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Test Send';
                btn.disabled = false;
            }

            if (result && (result.status === 'success' || result.sent === 'true' || result.sent === true || result.message === 'ok')) {
                if (resP) {
                    resP.classList.remove('text-indigo-600', 'text-red-500');
                    resP.classList.add('text-green-600');
                    resP.innerText = '✔ WhatsApp Message Sent Successfully! Check WhatsApp.';
                }
                showToast("TEST WHATSAPP SENT SUCCESSFULLY!");
            } else {
                if (resP) {
                    resP.classList.remove('text-indigo-600', 'text-green-600');
                    resP.classList.add('text-red-500');
                    resP.innerText = '✖ Failed: ' + (result ? (result.message || JSON.stringify(result)) : 'Unknown error');
                }
                showToast("FAILED TO SEND WHATSAPP");
            }
        }

        function runAiBriefingModels() {
            let activeStudents = (appData.students || []).length;
            let unpaidCount = activeStudents - appData.paidCount;
            if (unpaidCount < 0) unpaidCount = 0;
            
            let hour = new Date().getHours();
            let greeting = "Good Morning";
            if (hour < 5 || hour >= 21) greeting = "Good Night";
            else if (hour >= 17) greeting = "Good Evening";
            else if (hour >= 12) greeting = "Good Afternoon";
            
            let briefText = "";
            if (activeStudents === 0) {
                briefText = `${greeting}! System is stable and ready. Add your first student to begin AI analytics.`;
            } else if (unpaidCount > 0) {
                briefText = `${greeting}! System stable. Currently, ${unpaidCount} student(s) have pending fees. Revenue flow is active.`;
            } else {
                briefText = `${greeting}! Excellent news: 100% of fees are cleared for all ${activeStudents} active students. Revenue is fully optimized!`;
            }
            
            let briefEl = document.getElementById('aiBriefingText');
            if(briefEl) briefEl.innerText = briefText;
        }

        function toggleTheme() {
            document.body.classList.toggle('dark-mode');
            var isDark = document.body.classList.contains('dark-mode');
            var btn = document.getElementById('theme-icon');
            btn.className = isDark ? 'fas fa-sun text-yellow-400 text-lg' : 'fas fa-moon text-sm';
        }

        function toggleRevenue() {
            isRevenueHidden = !isRevenueHidden;
            var eye = document.getElementById('revenue-eye');
            eye.className = isRevenueHidden ? 'fas fa-eye-slash text-white opacity-80 text-lg' : 'fas fa-eye text-white opacity-80 text-lg';
            var amtEl = document.getElementById('dash-amt');
            if(isRevenueHidden) amtEl.innerText = '₹ •••••';
            else amtEl.innerText = '₹' + Number(amtEl.dataset.val).toLocaleString('en-IN');
        }

        function navigate(id) {
            var secs = document.querySelectorAll('.view-section');
            for(var i=0; i<secs.length; i++) secs[i].classList.remove('active');
            document.getElementById(id).classList.add('active');
            
            var navs = document.querySelectorAll('.mob-nav');
            for(var j=0; j<navs.length; j++) {
                navs[j].classList.remove('text-indigo-600', 'text-red-500', 'text-purple-600'); navs[j].classList.add('text-gray-400');
                var bg = navs[j].querySelector('.nav-icon-bg'); if(bg) bg.classList.remove('bg-indigo-50', 'bg-red-50', 'bg-purple-50');
            }
            var btn = document.getElementById('nav-'+id);
            if(btn) {
                var col = 'text-indigo-600';
                var bgCol = 'bg-indigo-50';
                if(id === 'defaulters') { col = 'text-red-500'; bgCol = 'bg-red-50'; }
                if(id === 'aihub') { col = 'text-purple-600'; bgCol = 'bg-purple-50'; }
                
                btn.classList.remove('text-gray-400'); btn.classList.add(col);
                var bg = btn.querySelector('.nav-icon-bg'); if(bg) bg.classList.add(bgCol);
            }
            
            if(id === 'dashboard') { updateDashboard();
        if(document.getElementById('dirShift')) filterClasses('dirShift', 'dirClass'); renderDefaulters(); renderPaidStudents(); }
            if(id === 'defaulters') { renderDefaulters(); }
            if(id === 'paid-students') { renderPaidStudents(); }
            
            let header = document.getElementById('mainHeader');
            let headerTitle = document.getElementById('headerTitle');
            let headerSub = document.getElementById('headerSub');
            let headerBadge = document.getElementById('headerBadge');
            let headerLogo = document.getElementById('headerLogo');
            
            if (id === 'attendance') {
                header.classList.remove('p-3.5', 'mb-2');
                header.classList.add('p-2', 'mb-1', 'justify-center');
                headerTitle.classList.remove('text-lg', 'text-left');
                headerTitle.classList.add('text-sm', 'text-center');
                if(headerSub) headerSub.classList.add('hidden');
                if(headerBadge) headerBadge.classList.add('hidden');
                if(headerLogo) headerLogo.classList.add('hidden');
            } else {
                header.classList.add('p-3.5', 'mb-2');
                header.classList.remove('p-2', 'mb-1', 'justify-center');
                headerTitle.classList.add('text-lg', 'text-left');
                headerTitle.classList.remove('text-sm', 'text-center');
                if(headerSub) headerSub.classList.remove('hidden');
                if(headerBadge) headerBadge.classList.remove('hidden');
                if(headerLogo) headerLogo.classList.remove('hidden');
            }
            
            if(id === 'attendance') { 
                document.getElementById('attDate').valueAsDate = new Date(); 
                if (document.getElementById('attShift')) filterClasses('attShift', 'attClass');
                updateClassStatusIndicator(); 
                loadAttendanceStudents(); 
            }
            if(id === 'fee') { 
                document.getElementById('feeForm').reset(); 
                document.getElementById('feeDate').valueAsDate = new Date(); 
                document.getElementById('feeMonth').value = targetFeeMonth;
                initFeeClasses(); document.getElementById('feeStudentId').value = ''; 
                document.getElementById('feeStudentList').classList.add('hidden'); 
                setMode(''); 
                document.getElementById('feeRemainingBox').classList.add('hidden');
                currentStudentExpectedFee = 0;
            }
            if(id === 'aihub') { var chat = document.getElementById('ai-chat-history'); chat.scrollTop = chat.scrollHeight; }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function updateDashboard() {
            document.getElementById('dash-all').innerText = (appData.students || []).length;
            
            let uniquePaid = new Set();
            var amt = 0;
            
            for(var i=0; i<(appData.payments || []).length; i++) {
                let p = (appData.payments || [])[i];
                if(p.month === targetFeeMonth && new Date(p.date).getFullYear() === new Date().getFullYear()) {
                    amt += Number(p.amount || 0);
                    uniquePaid.add(p.studentName + '_' + p.className);
                }
            }
            
            document.getElementById('dash-paid').innerText = uniquePaid.size;
            
            var amtEl = document.getElementById('dash-amt');
            amtEl.dataset.val = amt;
            amtEl.innerText = isRevenueHidden ? '₹ •••••' : '₹' + amt.toLocaleString('en-IN');
            
            var list = document.getElementById('recent-list'); list.innerHTML = '';
            
            let dismissed = new Set(appData.recentDismissedIds || []);
            var visiblePayments = (appData.payments || []).filter(p => !dismissed.has(p.id));
            
            if(visiblePayments.length === 0) { 
                list.innerHTML = '<div class="glass-panel p-6 rounded-24 text-center"><p class="text-10 font-black text-gray-400 uppercase tracking-widest">NO TRANSACTIONS YET</p></div>'; 
                return; 
            }
            
            var recent = visiblePayments.slice().reverse().slice(0, 5);
            for(var k=0; k<recent.length; k++) {
                var p = recent[k];
                var pDateShow = p.date;
                let d = new Date(p.date);
                if (!isNaN(d)) pDateShow = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
                
                list.innerHTML += `<div class="glass-panel p-4 rounded-24 mb-3 flex justify-between items-center"><div><p class="font-black text-gray-800 text-xs force-uppercase truncate w-32">${p.studentName}</p><p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${p.className} • ${p.month.toUpperCase()}</p></div><div class="text-right"><p class="font-black text-indigo-600 text-sm">₹${p.amount}</p><p class="text-8 font-bold text-gray-400 force-uppercase mt-0.5 tracking-widest">${p.mode||'CASH'} • ${pDateShow}</p></div></div>`;
            }
        }


                        function toggleRecentLock() {
            recentLocked = !recentLocked;
            let icon = document.getElementById('recent-lock-icon');
            let btn = document.getElementById('btn-clear-recent');
            let lockBtn = document.getElementById('recent-lock-btn');
            if (recentLocked) {
                if (icon) {
                    icon.className = 'fas fa-lock';
                    icon.style.fontSize = '8px';
                }
                if (lockBtn) {
                    lockBtn.className = 'bg-red-50 text-red-500 rounded flex items-center justify-center border border-red-100 active:scale-90 transition shadow-none';
                }
                if (btn) {
                    btn.disabled = true;
                    btn.className = 'bg-red-50 text-red-500 border border-red-100 rounded font-black uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition flex items-center shadow-none';
                }
            } else {
                if (icon) {
                    icon.className = 'fas fa-unlock';
                    icon.style.fontSize = '8px';
                }
                if (lockBtn) {
                    lockBtn.className = 'bg-green-50 text-green-600 rounded flex items-center justify-center border border-green-200 active:scale-90 transition shadow-none';
                }
                if (btn) {
                    btn.disabled = false;
                    btn.className = 'bg-red-600 text-white border border-red-600 rounded font-black uppercase tracking-wider active:scale-95 transition flex items-center shadow-none';
                }
            }
        }

        async function clearRecentPayments() {
            if (recentLocked) {
                showToast("UNLOCK LOCK FIRST");
                return;
            }
            
            let dismissed = new Set(appData.recentDismissedIds || []);
            let visiblePayments = (appData.payments || []).filter(p => !dismissed.has(p.id));
            if (visiblePayments.length === 0) {
                showToast("NO RECENT TRANSACTIONS TO CLEAR");
                return;
            }
            
            let btn = document.getElementById('btn-clear-recent');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 7px !important;"></i>';
                btn.disabled = true;
            }
            
            let idsToDismiss = visiblePayments.map(p => p.id);
            let res = await gasApi('clearRecentPayments', { ids: idsToDismiss });
            if (res && res.status === 'success') {
                appData = Object.assign(appData, res);
            }
            
            showToast("RECENT FEED CLEARED (PAID LIST PRESERVED)");
            if (!recentLocked) toggleRecentLock();
            
            updateDashboard();
            renderPaidStudents();
            renderDefaulters();
        }

        function selectAttClassBadge(cls) {
            let attClass = document.getElementById('attClass');
            if (attClass) {
                attClass.value = cls;
                loadAttendanceStudents();
            }
        }

        function loadAttendanceStudents() {
            var shiftElem = document.getElementById('attShift');
            var shift = (shiftElem && shiftElem.value) ? shiftElem.value : 'Evening';
            var cls = document.getElementById('attClass') ? document.getElementById('attClass').value : 'All';
            var dateStr = document.getElementById('attDate') ? document.getElementById('attDate').value : '';
            var list = document.getElementById('attendance-list');
            if(!list) return;
            list.innerHTML = '';
            
            if(!dateStr) { 
                list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">SELECT DATE</p>'; 
                return; 
            }
            
            // Filter students by shift
            var shiftStudents = (appData.students || []).filter(s => (s.shift || 'Morning') === shift);
            if(cls && cls !== 'All') {
                shiftStudents = shiftStudents.filter(s => s.class === cls);
            }
            
            if(shiftStudents.length === 0) { 
                list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">NO STUDENTS IN THIS SHIFT & CLASS</p>'; 
                return; 
            }
            
            // If 'All' is selected, group by class!
            if (!cls || cls === 'All') {
                let classMap = {};
                shiftStudents.forEach(s => {
                    let c = s.class || 'Other';
                    if (!classMap[c]) classMap[c] = [];
                    classMap[c].push(s);
                });
                
                let sortedClasses = Object.keys(classMap).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
                
                sortedClasses.forEach(cName => {
                    let stuList = classMap[cName];
                    list.insertAdjacentHTML('beforeend', `
                        <div class="flex items-center justify-between mt-3 mb-2 px-1">
                            <span class="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                                <i class="fas fa-chalkboard-teacher mr-1 text-indigo-500"></i> CLASS ${cName}
                            </span>
                            <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest">${stuList.length} ${stuList.length === 1 ? 'Student' : 'Students'}</span>
                        </div>
                    `);
                    
                    let existingRecord = (appData.attendance || []).find(a => a.date === dateStr && a.class === cName);
                    
                    stuList.forEach(s => {
                        let pSel = '';
                        let aSel = '';
                        if (existingRecord && existingRecord.records && existingRecord.records[s.name]) {
                            if (existingRecord.records[s.name] === 'Present') pSel = 'data-selected="Present"';
                            else if (existingRecord.records[s.name] === 'Absent') aSel = 'data-selected="Absent"';
                        }
                        
                        list.insertAdjacentHTML('beforeend', `
                        <div class="glass-panel p-2.5 rounded-2xl flex justify-between items-center mb-2" data-student-name="${s.name}" data-student-class="${s.class}">
                            <div>
                                <p class="font-black text-gray-800 text-xs force-uppercase">${s.name}</p>
                                <p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${s.class} • ${s.phone || 'No Phone'}</p>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="setAtt(this, 'Present')" ${pSel} class="att-btn px-3 py-1.5 rounded-xl text-xs font-black border border-gray-200 text-gray-500 bg-gray-50 uppercase shadow-sm">P</button>
                                <button onclick="setAtt(this, 'Absent')" ${aSel} class="att-btn px-3 py-1.5 rounded-xl text-xs font-black border border-gray-200 text-gray-500 bg-gray-50 uppercase shadow-sm">A</button>
                            </div>
                        </div>`);
                    });
                });
            } else {
                // Single class view
                let existingRecord = (appData.attendance || []).find(a => a.date === dateStr && a.class === cls);
                shiftStudents.forEach(s => {
                    let pSel = '';
                    let aSel = '';
                    if (existingRecord && existingRecord.records && existingRecord.records[s.name]) {
                        if (existingRecord.records[s.name] === 'Present') pSel = 'data-selected="Present"';
                        else if (existingRecord.records[s.name] === 'Absent') aSel = 'data-selected="Absent"';
                    }
                    
                    list.insertAdjacentHTML('beforeend', `
                    <div class="glass-panel p-2.5 rounded-2xl flex justify-between items-center mb-2" data-student-name="${s.name}" data-student-class="${s.class}">
                        <div>
                            <p class="font-black text-gray-800 text-xs force-uppercase">${s.name}</p>
                            <p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${s.class} • ${s.phone || 'No Phone'}</p>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="setAtt(this, 'Present')" ${pSel} class="att-btn px-3 py-1.5 rounded-xl text-xs font-black border border-gray-200 text-gray-500 bg-gray-50 uppercase shadow-sm">P</button>
                            <button onclick="setAtt(this, 'Absent')" ${aSel} class="att-btn px-3 py-1.5 rounded-xl text-xs font-black border border-gray-200 text-gray-500 bg-gray-50 uppercase shadow-sm">A</button>
                        </div>
                    </div>`);
                });
            }
        }

        function setAtt(btn, status) {
            let container = btn.parentElement;
            let btns = container.querySelectorAll('.att-btn');
            btns.forEach(b => b.removeAttribute('data-selected'));
            btn.setAttribute('data-selected', status);
        }

        function markAllPresent() {
            let btns = document.querySelectorAll('.att-btn:nth-child(1)');
            btns.forEach(btn => {
                btn.setAttribute('data-selected', 'Present');
                btn.nextElementSibling.removeAttribute('data-selected');
            });
        }

        function updateClassStatusIndicator() {
            let date = document.getElementById('attDate') ? document.getElementById('attDate').value : '';
            let shiftElem = document.getElementById('attShift');
            let shift = (shiftElem && shiftElem.value) ? shiftElem.value : 'Evening';
            let indicator = document.getElementById('attStatusIndicator');
            if(!indicator) return;
            indicator.innerHTML = '';
            
            if(!date) {
                let now = new Date();
                date = now.toISOString().split('T')[0];
                let dateInput = document.getElementById('attDate');
                if (dateInput) dateInput.value = date;
            }
            
            // Only get classes for the selected shift (from feeSettings and students)
            let classSet = new Set();
            if (appData.feeSettings) {
                let keys = Object.keys(appData.feeSettings);
                keys.forEach(k => {
                    if (k.startsWith(shift + ' - ')) {
                        classSet.add(k.replace(shift + ' - ', ''));
                    }
                });
            }
            (appData.students || []).forEach(s => {
                if ((s.shift || 'Morning') === shift && s.class) {
                    classSet.add(s.class);
                }
            });

            // Ensure standard tuition classes are always present for the shift
            if (classSet.size === 0) {
                ['9th', '10th', '11th', '12th'].forEach(c => classSet.add(c));
            }
            
            let classes = Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
            
            let html = '';
            classes.forEach(cls => {
                let shiftStudents = (appData.students || []).filter(s => s.class === cls && (s.shift || 'Morning') === shift);
                let totalStudents = shiftStudents.length;
                
                let markedCount = 0;
                let existingRecord = (appData.attendance || []).find(a => a.date === date && a.class === cls);
                if (existingRecord && existingRecord.records) {
                    shiftStudents.forEach(s => {
                        if (existingRecord.records[s.name]) markedCount++;
                    });
                }
                
                let isComplete = (totalStudents > 0 && markedCount >= totalStudents);
                let isPartial = (totalStudents > 0 && markedCount > 0 && markedCount < totalStudents);
                
                let badgeStyle = '';
                let badgeIcon = '';
                if (totalStudents === 0) {
                    badgeStyle = 'bg-gray-100 text-gray-400 border border-gray-200';
                    badgeIcon = '<i class="fas fa-minus-circle mr-1 text-[8px]"></i>';
                } else if (isComplete) {
                    badgeStyle = 'bg-green-100 text-green-700 border border-green-200 shadow-sm';
                    badgeIcon = '<i class="fas fa-check-circle mr-1 text-green-600"></i>';
                } else if (isPartial) {
                    badgeStyle = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
                    badgeIcon = '<i class="fas fa-clock mr-1 text-yellow-600"></i>';
                } else {
                    badgeStyle = 'bg-red-50 text-red-600 border border-red-200';
                    badgeIcon = '<i class="fas fa-hourglass-start mr-1 text-red-400"></i>';
                }
                
                html += `<button type="button" onclick="selectAttClassBadge('${cls}')" class="${badgeStyle} px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center active:scale-95 transition cursor-pointer">
                    ${badgeIcon} ${cls} (${markedCount}/${totalStudents})
                </button>`;
            });
            indicator.innerHTML = html;
        }

        



        function openShiftSettings(shift) {
            document.getElementById('settingsMainMenu').classList.add('hidden');
            document.getElementById('settingsSubMenu').classList.remove('hidden');
            document.getElementById('subMenuTitle').innerText = shift + ' Shift';
            document.getElementById('currentShiftTarget').value = shift;
            
            let box = document.getElementById('dynamicClassesBox');
            box.innerHTML = '';
            for (let cls in appData.feeSettings) {
                if (cls.startsWith(shift + " - ")) {
                    let cleanName = cls.replace(shift + " - ", "");
                    box.insertAdjacentHTML('beforeend', `
                    <div class="flex items-center space-x-2 mb-2 cls-row">
                        <input type="text" class="mobile-input cls-name w-1/2 text-xs" value="${cleanName}" ${clsLocked ? 'disabled' : ''}>
                        <input type="number" class="mobile-input cls-fee w-1/2 text-xs" value="${appData.feeSettings[cls]}" ${clsLocked ? 'disabled' : ''}>
                        <button type="button" onclick="this.parentElement.remove()" class="del-cls-btn w-10 shrink-0 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 h-10 active:scale-95 transition" ${clsLocked ? 'disabled style="opacity:0.3"' : ''}><i class="fas fa-trash"></i></button>
                    </div>`);
                }
            }
        }

        function closeShiftSettings() {
            document.getElementById('settingsSubMenu').classList.add('hidden');
            document.getElementById('settingsMainMenu').classList.remove('hidden');
        }

        function initSettingsUI() {
            if (appData && appData.waSettings) {
                let instElem = document.getElementById('waInstanceId');
                let tokElem = document.getElementById('waToken');
                if (instElem) instElem.value = appData.waSettings.instanceId || 'instance175857';
                if (tokElem) tokElem.value = appData.waSettings.token || '7yqm7bhojwpovbu4';
            }
            initFeeClasses();
        }

        function addNewClassInput() {
            let box = document.getElementById('dynamicClassesBox');
            box.insertAdjacentHTML('beforeend', `
            <div class="flex items-center space-x-2 mb-2 cls-row">
                <input type="text" class="mobile-input cls-name w-1/2 text-xs" placeholder="Class Name">
                <input type="number" class="mobile-input cls-fee w-1/2 text-xs" placeholder="Fee">
                <button type="button" onclick="this.parentElement.remove()" class="del-cls-btn w-10 shrink-0 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 h-10 active:scale-95 transition"><i class="fas fa-trash"></i></button>
            </div>`);
        }

        function checkSaveBtnState() {
            let clsBtn = document.getElementById('btn-save-cls');
            if (clsBtn) clsBtn.disabled = clsLocked;
            let waBtn = document.getElementById('btn-save-wa');
            if (waBtn) waBtn.disabled = waLocked;
        }

        function toggleSetLock() {
            setLocked = !setLocked;
            let thumb = document.getElementById('set-lock-thumb');
            if (thumb) thumb.style.transform = setLocked ? 'translateX(0)' : 'translateX(100%)';
            let btn = document.getElementById('set-lock-btn');
            if (btn) {
                btn.classList.toggle('bg-gray-300', setLocked);
                btn.classList.toggle('bg-green-500', !setLocked);
            }
            let label = document.getElementById('set-lock-label');
            if (label) label.innerText = setLocked ? 'LOCKED' : 'UNLOCKED';
            
            if (setLocked) {
                if (!clsLocked) toggleClsLock();
                if (!waLocked) toggleWaLock();
            }
        }
        
        function toggleClsLock() {
            if (setLocked && clsLocked) { showToast("UNLOCK MASTER LOCK FIRST"); return; }
            clsLocked = !clsLocked;
            let icon = document.getElementById('cls-lock-icon');
            if (icon) {
                icon.className = clsLocked ? 'fas fa-lock text-xs' : 'fas fa-unlock text-xs';
                icon.parentElement.className = clsLocked ? 'w-7 h-7 bg-red-50 rounded-full flex items-center justify-center text-red-500 active:scale-90 transition shadow-inner' : 'w-7 h-7 bg-green-50 rounded-full flex items-center justify-center text-green-500 active:scale-90 transition shadow-inner';
            }
            
            let btnAdd = document.getElementById('btn-add-cls');
            if (btnAdd) btnAdd.disabled = clsLocked;
            
            document.querySelectorAll('.cls-row input').forEach(input => input.disabled = clsLocked);
            document.querySelectorAll('.del-cls-btn').forEach(btn => {
                btn.disabled = clsLocked;
                btn.style.opacity = clsLocked ? '0.3' : '1';
            });
            checkSaveBtnState();
        }

        function toggleWaLock() {
            if (setLocked && waLocked) { showToast("UNLOCK MASTER LOCK FIRST"); return; }
            waLocked = !waLocked;
            let icon = document.getElementById('wa-lock-icon');
            if (icon) {
                icon.className = waLocked ? 'fas fa-lock text-xs' : 'fas fa-unlock text-xs';
                icon.parentElement.className = waLocked ? 'w-7 h-7 bg-red-50 rounded-full flex items-center justify-center text-red-500 active:scale-90 transition shadow-inner' : 'w-7 h-7 bg-green-50 rounded-full flex items-center justify-center text-green-500 active:scale-90 transition shadow-inner';
            }
            document.querySelectorAll('.wa-setting').forEach(input => input.disabled = waLocked);
            checkSaveBtnState();
        }
        
        async function saveShiftSettings(e) {
            if (e && e.preventDefault) e.preventDefault();
            let shift = document.getElementById('currentShiftTarget').value;
            let rows = document.querySelectorAll('.cls-row');
            
            // Remove old entries for this shift
            for (let k in appData.feeSettings) {
                if (k.startsWith(shift + " - ")) {
                    delete appData.feeSettings[k];
                }
            }
            
            rows.forEach(r => {
                let n = r.querySelector('.cls-name').value;
                let f = r.querySelector('.cls-fee').value;
                if (n && f) {
                    appData.feeSettings[`${shift} - ${n}`] = f;
                }
            });
            
            await gasApi('saveAllSettings', { feeSettings: appData.feeSettings, waSettings: appData.waSettings });
            showToast(shift.toUpperCase() + " SETTINGS SAVED");
            if (!clsLocked) toggleClsLock();
            initFeeClasses();
        }

        async function saveWaSettings() {
            let inst = document.getElementById('waInstanceId').value.trim();
            let tok = document.getElementById('waToken').value.trim();
            if (!inst || !tok) {
                showToast("ENTER BOTH INSTANCE ID & TOKEN");
                return;
            }

            let btn = document.getElementById('btn-save-wa');
            let origHtml = btn ? btn.innerHTML : 'Save WhatsApp Settings';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> SAVING TO SUPABASE...';
                btn.disabled = true;
            }

            appData.waSettings = {
                instanceId: inst,
                token: tok
            };

            let res = await gasApi('saveAllSettings', { feeSettings: appData.feeSettings, waSettings: appData.waSettings });
            if (res && res.status === 'success') {
                appData = Object.assign(appData, res);
            }

            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }

            showToast("WHATSAPP CONFIG SAVED TO CLOUD");
            if (!waLocked) toggleWaLock();
            initSettingsUI();
        }



        


        function setMode(mode) {
    currentMode = mode;
    let feeMode = document.getElementById('feeMode');
    if(feeMode) feeMode.value = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('border-green-500', 'bg-green-50', 'text-green-600');
        b.classList.add('border-gray-200', 'text-gray-500');
    });
    if(mode === 'ONLINE / UPI') {
        let btn = document.getElementById('mode-UPI');
        if(btn) { btn.classList.add('border-green-500', 'bg-green-50', 'text-green-600'); btn.classList.remove('border-gray-200', 'text-gray-500'); }
    }
    if(mode === 'CASH') {
        let btn = document.getElementById('mode-CASH');
        if(btn) { btn.classList.add('border-green-500', 'bg-green-50', 'text-green-600'); btn.classList.remove('border-gray-200', 'text-gray-500'); }
    }
}

var modalLocked = false;

function applyModalLockState(isLocked) {
    modalLocked = isLocked;
    let icon = document.getElementById('modalLockIcon');
    let lockBtn = document.getElementById('modalLockBtn');
    let saveBtn = document.getElementById('modalSaveBtn');
    let fields = ['stuName', 'stuGender', 'stuShift', 'stuClass', 'stuPhone', 'stuFee', 'stuDate'];
    fields.forEach(fId => {
        let el = document.getElementById(fId);
        if (el) {
            el.disabled = isLocked;
            if (isLocked) {
                el.classList.add('opacity-60', 'cursor-not-allowed', 'bg-gray-100');
            } else {
                el.classList.remove('opacity-60', 'cursor-not-allowed', 'bg-gray-100');
            }
        }
    });
    if (saveBtn) {
        saveBtn.disabled = isLocked;
        if (isLocked) {
            saveBtn.classList.add('opacity-40', 'cursor-not-allowed');
        } else {
            saveBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        }
    }
    if (lockBtn && icon) {
        if (isLocked) {
            icon.className = 'fas fa-lock text-xs text-red-500';
            lockBtn.className = 'w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 shadow-sm transition border border-red-200';
            lockBtn.title = "Editing is LOCKED (Tap to unlock)";
        } else {
            icon.className = 'fas fa-unlock text-xs text-green-600';
            lockBtn.className = 'w-8 h-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center active:scale-90 shadow-sm transition border border-green-200';
            lockBtn.title = "Editing is UNLOCKED (Tap to lock)";
        }
    }
}

function openModal(id) {
    if(!id || typeof id !== 'string') id = 'addModal';
    if(id === 'addModal') {
        let t = document.getElementById('modalTitle');
        let rIndex = document.getElementById('stuRowIndex');
        if(!rIndex || rIndex.value === '-1' || rIndex.value === '') {
            if(t) t.innerText = 'Registration';
            let lockBtn = document.getElementById('modalLockBtn');
            if(lockBtn) lockBtn.classList.add('hidden');
            applyModalLockState(false);
        }
    }
    document.getElementById(id).classList.remove('hidden');
    setTimeout(() => {
        let content = document.getElementById('modalContent');
        if (content) {
            content.classList.remove('translate-y-full');
            content.classList.add('translate-y-0');
        }
    }, 10);
}

function closeModal(id) {
    if(!id || typeof id !== 'string') id = 'addModal';
    let content = document.getElementById('modalContent');
    if (content) {
        content.classList.remove('translate-y-0');
        content.classList.add('translate-y-full');
    }
    setTimeout(() => {
        document.getElementById(id).classList.add('hidden');
        if (id === 'addModal') {
            let f = document.getElementById('addForm');
            if(f) f.reset();
            let t = document.getElementById('modalTitle');
            if(t) t.innerText = 'Registration';
            let lockBtn = document.getElementById('modalLockBtn');
            if(lockBtn) lockBtn.classList.add('hidden');
            applyModalLockState(false);
            let eIndex = document.getElementById('stuRowIndex');
            if(eIndex) eIndex.value = '-1';
            let sId = document.getElementById('stuId');
            if(sId) sId.value = '';
            let pCont = document.getElementById('pastMonthsContainer');
            if(pCont) pCont.classList.add('hidden');
            let delBox = document.getElementById('deleteBox');
            if(delBox) delBox.classList.add('hidden');
            let cbCont = document.getElementById('pastMonthsCheckboxes');
            if(cbCont) cbCont.innerHTML = '';
        }
    }, 300);
}

function editStudent(index) {
    if (!appData.students || !appData.students[index]) return;
    let s = appData.students[index];
    
    let t = document.getElementById('modalTitle');
    if(t) t.innerText = 'Edit Student';
    
    document.getElementById('stuRowIndex').value = index;
    document.getElementById('stuId').value = s.id || '';
    document.getElementById('stuName').value = s.name;
    document.getElementById('stuPhone').value = s.phone;
    if(document.getElementById('stuGender')) document.getElementById('stuGender').value = s.gender || 'Male';
    
    if(document.getElementById('stuShift')) {
        document.getElementById('stuShift').value = s.shift || 'Morning';
        filterClasses('stuShift', 'stuClass');
    }
    document.getElementById('stuClass').value = s.class;
    document.getElementById('stuFee').value = s.fee;
    
    if (s.date) {
        let parts = s.date.split('/');
        if (parts.length === 3) {
            document.getElementById('stuDate').value = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else {
            document.getElementById('stuDate').value = s.date;
        }
    }
    
    let delBox = document.getElementById('deleteBox');
    if (delBox) delBox.classList.remove('hidden');
    
    let pCont = document.getElementById('pastMonthsContainer');
    if(pCont) pCont.classList.add('hidden');
    
    let lockBtn = document.getElementById('modalLockBtn');
    if (lockBtn) lockBtn.classList.remove('hidden');
    applyModalLockState(true);
    
    openModal('addModal');
}

function toggleModalLock() {
    let nextState = !modalLocked;
    applyModalLockState(nextState);
    showToast(nextState ? "EDITING LOCKED 🔒" : "EDITING UNLOCKED 🔓");
}

        function toggleDelLock() {
            delLocked = !delLocked;
            let icon = document.getElementById('del-lock-icon');
            let btn = document.getElementById('btn-actual-del');
            let lockBtn = document.getElementById('del-lock-btn');
            if(delLocked) {
                icon.className = 'fas fa-lock';
                btn.disabled = true;
                btn.classList.add('opacity-40');
                lockBtn.classList.remove('bg-red-500', 'text-white');
                lockBtn.classList.add('bg-white', 'text-gray-400');
            } else {
                icon.className = 'fas fa-unlock';
                btn.disabled = false;
                btn.classList.remove('opacity-40');
                lockBtn.classList.remove('bg-white', 'text-gray-400');
                lockBtn.classList.add('bg-red-500', 'text-white');
            }
        }

        async function confirmDeleteFromModal() {
            if (delLocked) return;
            let rowIndex = document.getElementById('stuRowIndex').value;
            let stuId = document.getElementById('stuId').value;
            
            document.getElementById('btn-actual-del').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            document.getElementById('btn-actual-del').disabled = true;
            
            appData = await gasApi('deleteStudent', { id: stuId, rowIndex: rowIndex });
            syncUIPanels();
            closeModal('addModal');
            showToast("STUDENT DELETED");
        }

        function triggerVoiceAttendance() {
            showToast("Voice Attendance Activated! Please speak...");
            // Simulated delay for demo
            setTimeout(() => {
                simulateAudioInput();
            }, 1000);
        }

        function simulateAudioInput() {
            showToast("Processing Voice... Identifying names...");
        }

        async function submitAttendance() {
            let cls = document.getElementById('attClass').value;
            let date = document.getElementById('attDate').value;
            let shiftElem = document.getElementById('attShift');
            let shift = (shiftElem && shiftElem.value) ? shiftElem.value : 'Evening';
            
            if(!date) { showToast("SELECT DATE"); return; }
            
            let btn = document.querySelector('button[onclick="submitAttendance()"]');
            if(btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> SAVING...'; btn.disabled = true; }
            
            // Read attendance from data-selected attributes on buttons
            let records = [];
            let cards = document.querySelectorAll('#attendance-list [data-student-name]');
            cards.forEach(card => {
                let name = card.getAttribute('data-student-name');
                let cardCls = card.getAttribute('data-student-class') || cls;
                let selectedBtn = card.querySelector('.att-btn[data-selected]');
                let status = selectedBtn ? selectedBtn.getAttribute('data-selected') : 'Present';
                let student = (appData.students || []).find(s => s.name === name && (!cardCls || cardCls === 'All' || s.class === cardCls));
                records.push({
                    id: generateId('ATT'),
                    studentId: student ? student.id : '',
                    studentName: name,
                    class: student ? student.class : cardCls,
                    date: date,
                    month: new Date(date).toLocaleString('default', { month: 'long' }),
                    status: status
                });
            });
            
            if(records.length === 0) { showToast("NO STUDENTS TO MARK"); if(btn) { btn.innerHTML = 'SAVE & SEND ALERTS <i class="fas fa-paper-plane ml-2 text-lg"></i>'; btn.disabled = false; } return; }
            
            let result = await gasApi('saveAttendanceBatch', records);
            if(result && result.status === 'success') {
                appData = result;
                // Live Supabase Data
            }
            
            // Send absent alerts via WhatsApp
            records.forEach(r => {
                if (r.status === 'Absent') {
                    let s = (appData.students || []).find(x => x.name === r.studentName && (!r.class || x.class === r.class));
                    if (s && s.phone) {
                        let formattedDate = date;
                        let d = new Date(date);
                        if (!isNaN(d.getTime())) {
                            formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        }
                        let studentClass = r.class || cls || 'Class';
                        let msg = `Dear Parent,\n\nYour ward *${r.studentName.toUpperCase()}* is *ABSENT* today (${formattedDate}) from *${studentClass}* (${shift} Shift).\n\nPlease ensure regular attendance for their continuous learning and academic progress.\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
                        sendWaMessage(s.phone, msg);
                    }
                }
            });
            
            syncUIPanels();
            updateClassStatusIndicator();
            
            if(btn) { btn.innerHTML = 'SAVE & SEND ALERTS <i class="fas fa-paper-plane ml-2 text-lg"></i>'; btn.disabled = false; }
            showToast("ATTENDANCE SAVED");
        }

        function generateStudentsPDF() {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                showToast('PDF LIBRARY LOADING...');
                return;
            }
            
            let shift = document.getElementById('dirShift') ? document.getElementById('dirShift').value : 'All';
            let cls = document.getElementById('dirClass') ? document.getElementById('dirClass').value : 'All';
            
            let doc = new window.jspdf.jsPDF();
            doc.setFontSize(18);
            doc.text("VIJAY SIR EDUCATION HUB", 105, 15, null, null, "center");
            doc.setFontSize(14);
            
            let title = "STUDENTS LIST";
            if(shift !== "All") title = shift.toUpperCase() + " SHIFT - " + title;
            if(cls !== "All") title += " (" + cls + ")";
            doc.text(title, 105, 23, null, null, "center");
            
            let now = new Date();
            let dateStr = now.toLocaleDateString('en-IN');
            doc.setFontSize(10);
            doc.text("Date: " + dateStr, 14, 30);
            
            let headers = [["Sl No", "Student Name", "Class", "Shift", "Phone", "Fee Status"]];
            let data = [];
            
            let targetStudents = (appData.students || []).filter(s => {
                let matchShift = shift === "All" || (s.shift || "Morning") === shift;
                let matchClass = cls === "All" || s.class === cls;
                return matchShift && matchClass;
            });
            
            let i = 1;
            let currentMonth = new Date().toLocaleString('default', { month: 'long' });
            
            targetStudents.forEach(s => {
                let payment = (appData.payments || []).find(p => p.studentName === s.name && p.className === s.class && p.month === currentMonth && new Date(p.date).getFullYear() === now.getFullYear());
                let statusStr = "Pending";
                if (payment) {
                    let d = new Date(payment.date);
                    statusStr = `Paid (${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()})`;
                }
                data.push([i++, s.name, s.class, s.shift || "Morning", s.phone, statusStr]);
            });
            
            doc.autoTable({
                startY: 35,
                head: headers,
                body: data,
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] }
            });
            
            doc.save(`VSEH_Students_${dateStr.replace(/\//g, '-')}.pdf`);
            showToast("PDF GENERATED");
        }

        function filterClasses(shiftId, classId) {
            let shiftElem = document.getElementById(shiftId);
            let shift = shiftElem ? shiftElem.value : 'All';
            let clsDropdown = document.getElementById(classId);
            if (!clsDropdown) return;
            
            let isDir = classId === 'dirClass';
            let isAtt = classId === 'attClass';
            
            clsDropdown.innerHTML = (isDir || isAtt) ? '<option value="All">All Classes</option>' : '<option value="">Select Class</option>';
            
            let added = new Set();
            if (appData.feeSettings) {
                let keys = Object.keys(appData.feeSettings);
                keys.forEach(k => {
                    if (shift === 'All' || !shift || k.startsWith(shift + " - ")) {
                        let c = k.split(" - ")[1];
                        if (c && !added.has(c)) {
                            added.add(c);
                        }
                    }
                });
            }
            
            (appData.students || []).forEach(s => {
                if (shift === 'All' || !shift || (s.shift || 'Morning') === shift) {
                    if (s.class && !added.has(s.class)) {
                        added.add(s.class);
                    }
                }
            });

            let sortedClasses = Array.from(added).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
            sortedClasses.forEach(c => {
                clsDropdown.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
            });
        }

        

// ==========================================
// RESTORED MISSING FUNCTIONS
// ==========================================

async function saveStudentToServer(e) {
    e.preventDefault();
    let isEdit = !!document.getElementById('stuId').value;
    if (isEdit && modalLocked) {
        showToast("EDITING IS LOCKED 🔒 (Tap lock to unlock)");
        return;
    }
    document.getElementById('modalSaveBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
    document.getElementById('modalSaveBtn').disabled = true;
    
    let id = document.getElementById('stuId').value || generateId('STU');
    let rowIndex = document.getElementById('stuRowIndex').value;
    let shift = document.getElementById('stuShift') ? document.getElementById('stuShift').value : 'Morning';
    
    let data = {
        id: id,
        name: document.getElementById('stuName').value.toUpperCase(),
        gender: document.getElementById('stuGender').value,
        shift: shift,
        class: document.getElementById('stuClass').value,
        phone: document.getElementById('stuPhone').value,
        fee: document.getElementById('stuFee').value,
        joinDate: document.getElementById('stuDate').value,
        isEdit: isEdit,
        rowIndex: rowIndex
    };
    
    // Check for Duplicate
    if (!isEdit) {
        let exists = (appData.students || []).find(s => s.name === data.name && s.class === data.class && (s.shift || 'Morning') === data.shift);
        if (exists) {
            alert("STUDENT ALREADY EXISTS IN THIS SHIFT & CLASS!");
            document.getElementById('modalSaveBtn').innerHTML = 'Save Profile';
            document.getElementById('modalSaveBtn').disabled = false;
            return;
        }
    }
    
    // Handle past paid months directly in payload
    if (!isEdit) {
        let noCb = document.getElementById('past_paid_no');
        if (!noCb || !noCb.checked) {
            let checkboxes = document.querySelectorAll('input[name="past_paid_month"]:checked');
            if (checkboxes.length > 0) {
                let pastPayments = [];
                checkboxes.forEach(cb => {
                    let m = cb.value;
                    pastPayments.push({
                        studentName: data.name,
                        className: data.class,
                        shift: data.shift,
                        month: m,
                        amount: data.fee,
                        date: data.joinDate, 
                        mode: "PRE-PAID"
                    });
                });
                data.pastPayments = JSON.stringify(pastPayments);
            }
        }
    }
    
        let result = await gasApi('saveStudent', data);
    if(result && result.status === 'success') {
        appData = result;
    } else {
        showToast('SAVE FAILED - Check Internet');
    }
    syncUIPanels();
    closeModal('addModal');
    document.getElementById('modalSaveBtn').innerHTML = 'Save Profile';
    document.getElementById('modalSaveBtn').disabled = false;
    showToast(isEdit ? "PROFILE UPDATED" : "STUDENT ADDED SUCCESSFULLY");
}

function checkPastDate() {
    let dateVal = document.getElementById('stuDate').value;
    let container = document.getElementById('pastMonthsContainer');
    let cbContainer = document.getElementById('pastMonthsCheckboxes');
    
    if (!dateVal) { container.classList.add('hidden'); return; }
    
    let joinDate = new Date(dateVal);
    let now = new Date();
    let diffDays = Math.ceil((now - joinDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 30) {
        container.classList.remove('hidden');
        let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        let startMonth = joinDate.getMonth();
        let startYear = joinDate.getFullYear();
        
        let currentMonth = now.getMonth();
        let currentYear = now.getFullYear();
        
        let html = `
            <label class="flex items-center space-x-1 cursor-pointer mr-3">
                <input type="checkbox" id="past_paid_no" value="NO" class="rounded text-red-600 focus:ring-red-500" onchange="togglePastPaidNo()">
                <span class="text-[9px] font-black text-red-600 uppercase">NO</span>
            </label>
        `;
        let m = startMonth;
        let y = startYear;
        
        while (y < currentYear || (y === currentYear && m <= currentMonth)) {
            let mName = months[m];
            html += `
            <label class="flex items-center space-x-1 cursor-pointer">
                <input type="checkbox" name="past_paid_month" value="${mName}" class="past_paid_month_chk rounded text-purple-600 focus:ring-purple-500" onchange="togglePastPaidMonth()">
                <span class="text-[9px] font-black text-gray-700 uppercase">${mName}</span>
            </label>`;
            m++;
            if (m > 11) { m = 0; y++; }
        }
        cbContainer.innerHTML = html;
    } else {
        container.classList.add('hidden');
    }
}

function togglePastPaidNo() {
    let noCb = document.getElementById('past_paid_no');
    if (noCb && noCb.checked) {
        document.querySelectorAll('.past_paid_month_chk').forEach(cb => cb.checked = false);
    }
}

function togglePastPaidMonth() {
    let noCb = document.getElementById('past_paid_no');
    if (noCb) noCb.checked = false;
}

function populateFeeStudents() {
    let cls = document.getElementById('feeClass').value;
    let datalist = document.getElementById('feeStudentList');
    if(!datalist) return;
    datalist.innerHTML = '';
    
    let students = (appData.students || []).filter(s => !cls || s.class === cls);
    students.forEach(s => {
        datalist.insertAdjacentHTML('beforeend', 
            '<div onclick="selectFeeStudent(\'' + s.name.replace(/'/g, "\\'") + '\', \'' + (s.id || '') + '\', \'' + (s.class || '') + '\')" class="px-3 py-2 rounded-lg hover:bg-indigo-50 cursor-pointer text-xs font-bold text-gray-700 uppercase active:scale-95 transition">' + s.name + ' <span class="text-gray-400">(' + s.class + ')</span></div>');
    });
    if(students.length > 0) datalist.classList.remove('hidden');
}


var selectedFeeMonths = [];
var currentStudentDues = null;

function renderFeePendingMonthsUI(student, dues) {
    let box = document.getElementById('feePendingMonthsBox');
    let list = document.getElementById('feePendingMonthsList');
    let badge = document.getElementById('feePendingTotalBadge');
    if (!box || !list) return;

    currentStudentDues = dues;
    box.classList.remove('hidden');
    list.innerHTML = '';

    if (!dues.isOverdue || dues.pendingMonths.length === 0) {
        badge.innerText = 'Dues: ₹0 (Cleared)';
        badge.className = 'text-[9px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-md border border-green-200';
        list.innerHTML = `<p class="text-[9px] font-bold text-gray-500 uppercase tracking-wider"><i class="fas fa-check-circle text-green-500 mr-1"></i> All fees cleared. Next Due Date: <span class="text-indigo-600 font-black">${dues.nextDueDate}</span></p>`;
        
        // Default to current month
        let feeM = document.getElementById('feeMonth');
        if (feeM) feeM.value = currentMonthName;
        let feeA = document.getElementById('feeAmount');
        if (feeA) feeA.value = student.fee || 500;
        return;
    }

    badge.innerText = `Total Due: ₹${dues.totalPendingAmount} (${dues.pendingCount} Mo)`;
    badge.className = 'text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200';

    // Select all pending months by default
    selectedFeeMonths = [...dues.pendingMonths];

    dues.pendingMonths.forEach(m => {
        let isChecked = selectedFeeMonths.includes(m);
        list.insertAdjacentHTML('beforeend', `
            <label class="flex items-center space-x-1.5 bg-white border border-indigo-200 px-2.5 py-1 rounded-xl cursor-pointer shadow-sm active:scale-95 transition">
                <input type="checkbox" value="${m}" ${isChecked ? 'checked' : ''} onchange="toggleFeeMonthSelect('${m}')" class="rounded text-indigo-600 focus:ring-indigo-500">
                <span class="text-[9px] font-black text-gray-800 uppercase">${m} (₹${student.fee || 500})</span>
            </label>
        `);
    });

    updateFeeFormFromSelectedMonths(student);
}

function toggleFeeMonthSelect(month) {
    let studentName = document.getElementById('feeStudentSearch').value;
    let student = (appData.students || []).find(s => s.name === studentName);
    if (!student) return;

    if (selectedFeeMonths.includes(month)) {
        selectedFeeMonths = selectedFeeMonths.filter(m => m !== month);
    } else {
        selectedFeeMonths.push(month);
    }

    updateFeeFormFromSelectedMonths(student);
}

function updateFeeFormFromSelectedMonths(student) {
    let studentFee = Number(student.fee) || 500;
    let totalAmt = selectedFeeMonths.length * studentFee;

    let feeA = document.getElementById('feeAmount');
    if (feeA) feeA.value = totalAmt > 0 ? totalAmt : studentFee;

    let feeM = document.getElementById('feeMonth');
    if (feeM) {
        let monthsStr = selectedFeeMonths.length > 0 ? selectedFeeMonths.join(', ') : currentMonthName;
        // Check if option exists, if not add it dynamically
        let existingOpt = Array.from(feeM.options).find(opt => opt.value === monthsStr);
        if (!existingOpt) {
            let newOpt = document.createElement('option');
            newOpt.value = monthsStr;
            newOpt.innerText = monthsStr.toUpperCase();
            feeM.insertBefore(newOpt, feeM.firstChild);
        }
        feeM.value = monthsStr;
    }
}

function selectFeeStudent(name, id, cls) {
    document.getElementById('feeStudentSearch').value = name;
    document.getElementById('feeStudentId').value = id;
    if(cls && !document.getElementById('feeClass').value) {
        document.getElementById('feeClass').value = cls;
    }
    document.getElementById('feeStudentList').classList.add('hidden');
    
    let student = (appData.students || []).find(s => s.name === name);
    if(student) {
        currentStudentExpectedFee = parseInt(student.fee) || 0;
        let dues = calculateStudentDues(student, appData.payments);
        renderFeePendingMonthsUI(student, dues);
    }
}


function filterFeeStudents() {
    let search = document.getElementById('feeStudentSearch').value.toUpperCase();
    let cls = document.getElementById('feeClass').value;
    let datalist = document.getElementById('feeStudentList');
    if(!datalist) return;
    datalist.innerHTML = '';
    
    if(!search || search.length < 1) { datalist.classList.add('hidden'); return; }
    
    let students = (appData.students || []).filter(s => {
        let matchClass = !cls || s.class === cls;
        let matchName = s.name.toUpperCase().includes(search);
        return matchClass && matchName;
    });
    
    students.forEach(s => {
        datalist.insertAdjacentHTML('beforeend',
            '<div onclick="selectFeeStudent(\'' + s.name.replace(/'/g, "\\'") + '\', \'' + (s.id || '') + '\', \'' + (s.class || '') + '\')" class="px-3 py-2 rounded-lg hover:bg-indigo-50 cursor-pointer text-xs font-bold text-gray-700 uppercase active:scale-95 transition">' + s.name + ' <span class="text-gray-400">(' + s.class + ')</span></div>');
    });
    
    if(students.length > 0) datalist.classList.remove('hidden');
    else datalist.classList.add('hidden');
}

async function processFee(e) {
    if(e) e.preventDefault();
    let shiftElem = document.getElementById('feeShift'); let shift = shiftElem ? shiftElem.value : 'Morning';
    let cls = document.getElementById('feeClass').value;
    let stu = document.getElementById('feeStudentSearch').value;
    let month = document.getElementById('feeMonth').value;
    let amt = document.getElementById('feeAmount').value;
    let date = document.getElementById('feeDate').value;
    let mode = document.getElementById('feeMode').value;
    
    if(!stu || !month || !amt || !date || !mode) {
        showToast("ALL FIELDS REQUIRED (INCLUDING MODE)");
        return;
    }
    
    let btn = document.querySelector('form#feeForm button[type="submit"]');
    let orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> PROCESSING...';
    btn.disabled = true;
    
    // Find the student to get their ID and phone
    let matchedStudent = (appData.students || []).find(s => s.name === stu && (!cls || s.class === cls));
    let payload = {
        id: generateId('TXN'),
        studentId: matchedStudent ? matchedStudent.id : '',
        studentName: stu,
        className: matchedStudent ? matchedStudent.class : cls,
        phone: matchedStudent ? matchedStudent.phone : '',
        amount: amt,
        month: month,
        date: date,
        mode: mode
    };
    
    appData = await gasApi('savePayment', payload);
    
    // Direct WhatsApp Receipt Dispatch
    if (matchedStudent && matchedStudent.phone) {
        sendSuccessMsg(stu, matchedStudent.phone, amt, month, mode);
    }
    
    document.getElementById('feeStudentSearch').value = '';
    document.getElementById('feeAmount').value = '';
    
    syncUIPanels();
    
    btn.innerHTML = orig;
    btn.disabled = false;
    showToast("PAYMENT SUCCESS");
}

function autoFillSetupFee() {
    let shift = document.getElementById('stuShift') ? document.getElementById('stuShift').value : 'Morning';
    let clsElem = document.getElementById('stuClass');
    if(!clsElem) return;
    let cls = clsElem.value;
    if(appData.feeSettings) {
        let key = shift + " - " + cls;
        if(appData.feeSettings[key]) {
            document.getElementById('stuFee').value = appData.feeSettings[key];
        }
    }
}

function autoGuessGender() {
    let nameElem = document.getElementById('stuName');
    if(!nameElem) return;
    let name = nameElem.value.trim().toLowerCase();
    if(name.length < 3) return;
    let genderSel = document.getElementById('stuGender');
    if(!genderSel) return;
    if(name.startsWith('mr ') || name.startsWith('mr. ')) { genderSel.value = 'Male'; return; }
    if(name.startsWith('ms ') || name.startsWith('miss ') || name.startsWith('mrs ')) { genderSel.value = 'Female'; return; }
    let lastChar = name.charAt(name.length-1);
    if(lastChar === 'i' || lastChar === 'a') genderSel.value = 'Female';
    else genderSel.value = 'Male';
}

function calculateRemaining() {
    let amtStr = document.getElementById('feeAmount').value;
    let remBox = document.getElementById('feeRemainingBox');
    if(!remBox) return;
    if(!amtStr) { remBox.classList.add('hidden'); return; }
    
    let amt = parseInt(amtStr) || 0;
    let shiftElem = document.getElementById('feeShift'); let shift = shiftElem ? shiftElem.value : 'Morning';
    let cls = document.getElementById('feeClass').value;
    let actualFee = appData.feeSettings ? parseInt(appData.feeSettings[shift + " - " + cls]) || 0 : 0;
    
    if(actualFee > 0 && amt < actualFee) {
        remBox.classList.remove('hidden');
        remBox.innerHTML = `<span class="text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-2 py-1 rounded">DUE: ₹${actualFee - amt}</span>`;
    } else {
        remBox.classList.add('hidden');
    }
}

async function sendAiCommand(e) {
    let val = '';
    if(typeof e === 'string') {
        val = e;
    } else {
        if(e && e.preventDefault) e.preventDefault();
        let inp = document.getElementById('ai-input') || document.getElementById('aiInput');
        val = inp ? inp.value : '';
    }
    
    if(!val) return;
    
    let box = document.getElementById('ai-chat-history') || document.getElementById('aiResponseBox');
    if(!box) return;
    box.classList.remove('hidden');
    box.innerHTML = '<i class="fas fa-spinner fa-spin text-purple-600"></i> Processing command...';
    
    let res = await gasApi('processAiCommand', {prompt: val, context: {students: appData.students, paidCount: appData.paidCount}});
    if(res && res.status === 'success') {
        let aiMsg = (res.result && res.result.message) ? res.result.message : (res.message || 'No response');
        box.innerHTML = '<div class="glass-panel p-4 rounded-24 rounded-tl-none border-l-4 border-purple-500 shadow-sm"><p class="text-xs font-bold text-gray-700">' + aiMsg.replace(/\n/g, '<br>') + '</p></div>';
        let inp = document.getElementById('ai-input');
        if (inp) inp.value = '';
        syncUIPanels();
    } else {
        box.innerHTML = '<span class="text-red-500">Failed to process command.</span>';
    }
}

async function triggerPtmNoteGeneration() {
    showToast("Generating PTM Note using AI...");
    let res = await gasApi('processAiCommand', {prompt: "Generate PTM Note for all defaults", context: {students: appData.students, paidCount: appData.paidCount}});
    if(res && res.status === 'success') {
        let aiMsg = (res.result && res.result.message) ? res.result.message : (res.message || 'No response');
        let box = document.getElementById('ai-chat-history') || document.getElementById('aiResponseBox');
        if(box) {
            box.classList.remove('hidden');
            box.innerHTML = '<div class="glass-panel p-4 rounded-24 rounded-tl-none border-l-4 border-purple-500 shadow-sm"><p class="text-xs font-bold text-gray-700">' + aiMsg.replace(/\n/g, '<br>') + '</p></div>';
        } else {
            alert(res.message);
        }
    } else {
        showToast("AI Generation Failed.");
    }
}


function renderStudents() {
    let list = document.getElementById('students-list');
    if(!list) return;
    list.innerHTML = '';
    
    let shift = document.getElementById('dirShift') ? document.getElementById('dirShift').value : 'All';
    let cls = document.getElementById('dirClass') ? document.getElementById('dirClass').value : 'All';
    let search = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toUpperCase() : '';
    
    let students = (appData.students || []).filter(s => {
        let matchShift = shift === 'All' || (s.shift || 'Morning') === shift;
        let matchClass = cls === 'All' || s.class === cls;
        let matchSearch = !search || 
            (s.name && s.name.toString().toUpperCase().includes(search)) || 
            (s.phone && s.phone.toString().includes(search));
        return matchShift && matchClass && matchSearch;
    });
    
    if(students.length === 0) {
        list.innerHTML = '<div class="glass-panel p-6 rounded-24 text-center"><p class="text-10 font-black text-gray-400 uppercase tracking-widest">NO STUDENTS FOUND</p></div>';
        return;
    }
    
    // When 'All Classes' is selected, group students class-by-class!
    if (cls === 'All') {
        let classMap = {};
        students.forEach(s => {
            let cName = s.class || 'Other';
            if (!classMap[cName]) classMap[cName] = [];
            classMap[cName].push(s);
        });
        
        let sortedClasses = Object.keys(classMap).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
        
        sortedClasses.forEach(cName => {
            let classStudents = classMap[cName];
            list.insertAdjacentHTML('beforeend', `
                <div class="flex items-center justify-between mt-4 mb-2 px-1">
                    <span class="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl uppercase tracking-wider flex items-center shadow-sm">
                        <i class="fas fa-graduation-cap mr-1.5 text-indigo-500"></i> CLASS ${cName}
                    </span>
                    <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        ${classStudents.length} ${classStudents.length === 1 ? 'Student' : 'Students'}
                    </span>
                </div>
            `);
            
            classStudents.forEach(s => {
                let realIndex = (appData.students || []).indexOf(s);
                let dues = calculateStudentDues(s, appData.payments);
                let badge = !dues.isOverdue 
                    ? '<span class="text-[8px] font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-md uppercase">PAID</span>' 
                    : `<span class="text-[8px] font-black bg-red-100 text-red-500 px-2 py-0.5 rounded-md uppercase">DUE ₹${dues.totalPendingAmount}</span>`;
                
                list.insertAdjacentHTML('beforeend', `
                    <div onclick="editStudent(${realIndex})" class="glass-panel p-4 rounded-24 flex justify-between items-center cursor-pointer active:scale-[0.98] transition mb-2 shadow-sm">
                        <div>
                            <p class="font-black text-gray-800 text-xs force-uppercase truncate" style="max-width:160px">${s.name}</p>
                            <p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${s.class} • ${(s.shift||'Morning').toUpperCase()} • ${s.phone || 'No Phone'}</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${badge}
                            <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
                        </div>
                    </div>
                `);
            });
        });
    } else {
        // When a single specific class is chosen
        students.forEach((s) => {
            let realIndex = (appData.students || []).indexOf(s);
            let dues = calculateStudentDues(s, appData.payments);
            let badge = !dues.isOverdue 
                ? '<span class="text-[8px] font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-md uppercase">PAID</span>' 
                : `<span class="text-[8px] font-black bg-red-100 text-red-500 px-2 py-0.5 rounded-md uppercase">DUE ₹${dues.totalPendingAmount}</span>`;
            
            list.insertAdjacentHTML('beforeend', `
                <div onclick="editStudent(${realIndex})" class="glass-panel p-4 rounded-24 flex justify-between items-center cursor-pointer active:scale-[0.98] transition mb-2 shadow-sm">
                    <div>
                        <p class="font-black text-gray-800 text-xs force-uppercase truncate" style="max-width:160px">${s.name}</p>
                        <p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${s.class} • ${(s.shift||'Morning').toUpperCase()} • ${s.phone || 'No Phone'}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${badge}
                        <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
                    </div>
                </div>
            `);
        });
    }
}

function openFeeForStudent(name, id, cls) {
    navigate('fee');
    setTimeout(() => {
        selectFeeStudent(name, id, cls);
    }, 150);
}

function renderDefaulters() {
    let list = document.getElementById('defaulters-list');
    if(!list) return;
    list.innerHTML = '';
    
    let allDefaulters = [];
    (appData.students || []).forEach(s => {
        let dues = calculateStudentDues(s, appData.payments);
        if (dues.isOverdue) {
            allDefaulters.push({ student: s, dues: dues });
        }
    });
    
    let pendEl = document.getElementById('dash-pend');
    if (pendEl) {
        pendEl.innerHTML = allDefaulters.length + ' <span class="text-xs text-gray-400 font-bold ml-1">Students</span>';
    }

    let shiftFilter = 'All';
    let shiftEl = document.getElementById('defaultersShift');
    if (shiftEl) {
        shiftFilter = shiftEl.value || 'All';
    }

    let defaulters = allDefaulters.filter(item => {
        if (shiftFilter === 'All') return true;
        let sShift = (item.student.shift || 'Morning').toLowerCase();
        return sShift === shiftFilter.toLowerCase();
    });
    
    let subTitle = document.getElementById('defaulters-subtitle');
    if (subTitle) {
        subTitle.innerText = shiftFilter === 'All' 
            ? `>>30 DAYS UNPAID (${defaulters.length})` 
            : `>>30 DAYS UNPAID • ${shiftFilter.toUpperCase()} (${defaulters.length})`;
    }
    
    if(defaulters.length === 0) {
        let msg = shiftFilter === 'All' 
            ? 'ALL FEES CLEARED! 🎉' 
            : `NO PENDING DUES FOR ${shiftFilter.toUpperCase()} SHIFT! 🎉`;
        list.innerHTML = `<div class="glass-panel p-6 rounded-24 text-center"><p class="text-10 font-black text-gray-400 uppercase tracking-widest">${msg}</p></div>`;
        return;
    }
    
    defaulters.forEach(({ student: s, dues }) => {
        let realIndex = (appData.students || []).indexOf(s);
        let monthsBadge = dues.pendingCount === 1 
            ? `<span class="bg-red-50 text-red-600 border border-red-100 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">${dues.pendingMonths[0]}</span>`
            : `<span class="bg-red-50 text-red-600 border border-red-100 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">${dues.pendingCount} Months: ${dues.pendingMonths.join(', ')}</span>`;

        list.innerHTML += `<div class="glass-panel p-4 rounded-24 flex justify-between items-center mb-3">
            <div>
                <div class="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
                    <p class="font-black text-gray-800 text-xs force-uppercase truncate" style="max-width:130px">${s.name}</p>
                    ${monthsBadge}
                </div>
                <p class="text-8 font-bold text-gray-400 tracking-widest">${s.class} • ${(s.shift||'Morning').toUpperCase()} • <span class="text-red-500 font-black">₹${dues.totalPendingAmount} Due</span></p>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="sendSoftReminder(${realIndex})" class="bg-yellow-50 text-yellow-600 px-3 py-2 rounded-xl text-[9px] font-black uppercase border border-yellow-200 active:scale-95 transition shadow-sm">
                    <i class="fas fa-bell mr-1"></i> Remind
                </button>
                <button onclick="openFeeForStudent('${s.name.replace(/'/g, "\\'")}', '${s.id || ''}', '${s.class || ''}')" class="bg-green-50 text-green-600 px-3 py-2 rounded-xl text-[9px] font-black uppercase border border-green-200 active:scale-95 transition shadow-sm">
                    <i class="fas fa-rupee-sign mr-1"></i> Pay
                </button>
            </div>
        </div>`;
    });
}

function renderPaidStudents() {
    let list = document.getElementById('paid-students-list');
    if(!list) return;
    list.innerHTML = '';
    
    let paidStudents = (appData.students || []).filter(s => {
        return (appData.payments || []).some(p => {
            let matchName = (p.studentName || '').trim().toUpperCase() === (s.name || '').trim().toUpperCase();
            let matchClass = !s.class || !p.className || (p.className || '').trim() === (s.class || '').trim();
            let pMonths = (p.month || '').split(/[,&+]| and /i).map(m => m.trim().toLowerCase());
            let matchMonth = pMonths.includes(targetFeeMonth.toLowerCase());
            let matchYear = new Date(p.date).getFullYear() === new Date().getFullYear();
            return matchName && matchClass && matchMonth && matchYear;
        });
    });
    
    appData.paidCount = paidStudents.length;
    
    if(paidStudents.length === 0) {
        list.innerHTML = '<div class="glass-panel p-6 rounded-24 text-center"><p class="text-10 font-black text-gray-400 uppercase tracking-widest">NO PAYMENTS THIS MONTH</p></div>';
        return;
    }
    
    paidStudents.forEach(s => {
        let payment = (appData.payments || []).find(p => {
            let matchName = (p.studentName || '').trim().toUpperCase() === (s.name || '').trim().toUpperCase();
            let matchClass = !s.class || !p.className || (p.className || '').trim() === (s.class || '').trim();
            let pMonths = (p.month || '').split(/[,&+]| and /i).map(m => m.trim().toLowerCase());
            return matchName && matchClass && pMonths.includes(targetFeeMonth.toLowerCase());
        });
        list.innerHTML += `<div class="glass-panel p-4 rounded-24 flex justify-between items-center mb-3">
            <div>
                <p class="font-black text-gray-800 text-xs force-uppercase truncate" style="max-width:160px">${s.name}</p>
                <p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${s.class} • ${(s.shift||'Morning').toUpperCase()} • <span class="text-green-600 font-bold">${payment ? payment.month : targetFeeMonth}</span></p>
            </div>
            <div class="text-right">
                <p class="font-black text-green-600 text-sm">₹${payment ? payment.amount : '0'}</p>
                <p class="text-8 font-bold text-gray-400 mt-0.5">${payment ? (payment.mode||'CASH') : ''}</p>
            </div>
        </div>`;
    });
}

function initFeeClasses() {
    let feeClass = document.getElementById('feeClass');
    if(!feeClass) return;
    feeClass.innerHTML = '<option value="">-- ALL CLASSES --</option>';
    
    let added = new Set();
    if (appData.feeSettings) {
        Object.keys(appData.feeSettings).forEach(k => {
            let parts = k.split(' - ');
            if(parts.length === 2) {
                let cls = parts[1];
                if(!added.has(cls)) {
                    added.add(cls);
                    feeClass.insertAdjacentHTML('beforeend', '<option value="' + cls + '">' + cls + '</option>');
                }
            }
        });
    }
    
    // Also add classes from students that might not be in feeSettings
    (appData.students || []).forEach(s => {
        if(s.class && !added.has(s.class)) {
            added.add(s.class);
            feeClass.insertAdjacentHTML('beforeend', '<option value="' + s.class + '">' + s.class + '</option>');
        }
    });
}

function sendWaMessage(phone, msg) {
    if(!appData.waSettings || !appData.waSettings.instanceId || !appData.waSettings.token) return;
    gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
}

function validatePhone(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if(input.value.length > 10) input.value = input.value.slice(0, 10);
}
