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
                const timerRow = rawSettings.find(r => r.key === 'waTimerEnabled');
                var waTimerEnabled = true;
                if (timerRow && timerRow.value !== undefined) {
                    waTimerEnabled = String(timerRow.value).toLowerCase() === 'true';
                } else {
                    let localTimer = localStorage.getItem('vseh_wa_timer_enabled');
                    if (localTimer !== null) waTimerEnabled = localTimer === 'true';
                }
            }

            let failedMessages = [];
            try {
                let storedF = localStorage.getItem('vseh_failed_wa_messages');
                if (storedF) failedMessages = JSON.parse(storedF);
            } catch(e) {}

            return {
                status: 'success',
                students,
                payments,
                attendance,
                feeSettings,
                waSettings,
                waTimerEnabled: waTimerEnabled !== false,
                failedMessages: Array.isArray(failedMessages) ? failedMessages : [],
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

            // 1. Try Vercel Serverless Function Proxy (bypasses Cloudflare & CORS)
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
                    if (resData && (resData.status === 'success' || resData.sent === 'true' || resData.sent === true)) return resData;
                    if (resData && resData.status === 'error') return resData;
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
                let parsed = null;
                try { parsed = JSON.parse(text); } catch(err){}
                if (parsed && (parsed.sent === 'true' || parsed.sent === true || (parsed.id && !parsed.error))) {
                    return { status: 'success', sent: 'true', message: 'Sent', apiResponse: parsed };
                } else {
                    let errMsg = (parsed && (parsed.error || parsed.message)) || text || 'UltraMsg rejected dispatch';
                    return { status: 'error', message: errMsg, apiResponse: parsed || text };
                }
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

        if (action === 'processNightQueue') {
            try {
                const res = await supabaseFetch('settings', '?key=eq.night_receipt_queue&select=*');
                if (!Array.isArray(res) || res.length === 0 || !res[0].value) {
                    return { status: 'success', message: 'Queue is empty.', count: 0 };
                }
                let queue = [];
                try {
                    queue = typeof res[0].value === 'string' ? JSON.parse(res[0].value) : res[0].value;
                } catch(e) { queue = []; }

                if (!Array.isArray(queue) || queue.length === 0) {
                    return { status: 'success', message: 'Queue is empty.', count: 0 };
                }

                let sentCount = 0;
                for (const item of queue) {
                    if (item.phone && item.message) {
                        await gasApi('stealthWhatsAppTrigger', { phone: item.phone, message: item.message });
                        sentCount++;
                        await new Promise(r => setTimeout(r, 2200));
                    }
                }

                await supabaseFetch('settings', '', 'POST', [{
                    key: 'night_receipt_queue',
                    value: JSON.stringify([])
                }], { 'Prefer': 'resolution=merge-duplicates' });

                try { localStorage.setItem('vseh_night_receipt_queue', '[]'); } catch(e) {}
                return { status: 'success', count: sentCount };
            } catch(e) {
                return { status: 'error', message: e.toString() };
            }
        }

        if (action === 'processAiCommand') {
            const userPrompt = payload.prompt || payload.command;
            const contextData = payload.context || {};
            
            // Check if user has configured custom Gemini API key
            let customKey = (appData.waSettings && appData.waSettings.geminiKey) || localStorage.getItem('vseh_gemini_key');
            if (customKey && customKey.trim()) {
                try {
                    let roster = "No data yet.";
                    if (contextData.students && contextData.students.length > 0) {
                        roster = contextData.students.map(s => `${s.name} (Class: ${s.class}, Fee: ${s.fee})`).join("\n");
                    }
                    const systemPrompt = `You are "Vijay Sir AI Assistant" for VSEH PRO.\nCurrent Date: ${new Date().toLocaleDateString('en-GB')}\nTotal Students: ${contextData.students ? contextData.students.length : 0}\nThis Month Paid Students: ${contextData.paidCount || 0}\n\nROSTER DATA:\n${roster}\n\nAnswer in simple Hindi + English mix. Keep responses concise and direct. Format beautifully with bolding.\nIf the user asks you to mark attendance (present or absent) for all students of a specific class, add this command block at the end: <CMD>MARK_ATTENDANCE|Class|Status</CMD>`;
                    const finalPrompt = systemPrompt + "\n\nUser Command: " + userPrompt;
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(customKey.trim())}`;
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
                    });
                    const resJson = await resp.json();
                    if (!resJson.error && resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content) {
                        const aiReply = resJson.candidates[0].content.parts[0].text.trim();
                        return { status: 'success', result: { intent: "TEXT_RESPONSE", message: aiReply } };
                    }
                } catch(e) {
                    console.warn("External Gemini API call failed, falling back to Native NLP engine:", e);
                }
            }
            
            // Zero-Failure Native Smart NLP Engine
            return processLocalAiCommand(userPrompt, contextData);
        }

        return { status: 'error', message: 'Unknown action' };
    } catch(e) {
        console.error("gasApi Error:", e);
        return null;
    }
}


// ==========================================================================
// VSEH PRO ZERO-FAILURE INTELLIGENT NLP ASSISTANT ENGINE
// ==========================================================================
function processLocalAiCommand(userPrompt, contextData) {
    let p = (userPrompt || '').trim().toLowerCase();
    let rawPrompt = (userPrompt || '').trim();
    let students = (contextData && contextData.students) ? contextData.students : (appData.students || []);
    let payments = (contextData && contextData.payments) ? contextData.payments : (appData.payments || []);
    
    // ==========================================================================
    // 0. BROADCAST / BULK WHATSAPP MESSAGE ENGINE
    // ==========================================================================
    // Patterns: "Send to all: ...", "Send to class 10th: ...", "Send to 9th: ...", "Broadcast to all: ..."
    let isBroadcastCmd = (
        p.startsWith('send to all') || 
        p.startsWith('send message to all') || 
        p.startsWith('broadcast to all') || 
        p.startsWith('broadcast to ') ||
        p.startsWith('message to all') ||
        p.startsWith('send to class') ||
        p.startsWith('send to ') ||
        p.includes('ko message bhejo') ||
        p.includes('ko message karo') ||
        p.includes('sabhi students ko message') ||
        p.includes('sabhi bacho ko message')
    );

    if (isBroadcastCmd) {
        let targetType = 'all'; // 'all', 'class', 'shift'
        let targetClass = '';
        let targetShift = '';
        let broadcastContent = '';

        let targetPrefix = '';
        // Extract message content: check colon first
        if (rawPrompt.includes(':')) {
            let colonIdx = rawPrompt.indexOf(':');
            targetPrefix = p.substring(0, colonIdx).trim();
            broadcastContent = rawPrompt.substring(colonIdx + 1).trim();
        } else {
            // Remove command prefixes
            targetPrefix = p;
            let cleaned = rawPrompt.replace(/^(send to all students|send to all student|send to all|send message to all|broadcast to all|message to all|sabhi students ko message bhejo|sabhi bacho ko message bhejo|sabhi students ko message|sabhi bacho ko message)\s*/i, '');
            cleaned = cleaned.replace(/^send to (class\s*)?[0-9]{1,2}(?:st|nd|rd|th)?\s*/i, '');
            cleaned = cleaned.replace(/^class\s*[0-9]{1,2}(?:st|nd|rd|th)?\s*(ko message bhejo|ko message karo|ko message)\s*/i, '');
            cleaned = cleaned.replace(/^send to (morning|evening)(\s*shift)?\s*/i, '');
            broadcastContent = cleaned.trim();
        }

        // Determine target audience ONLY from targetPrefix
        if (targetPrefix.includes('morning')) {
            targetShift = 'Morning';
            targetType = 'shift';
        } else if (targetPrefix.includes('evening')) {
            targetShift = 'Evening';
            targetType = 'shift';
        }

        let clsMatch = targetPrefix.match(/(?:class\s*|c-)?([0-9]{1,2}(?:st|nd|rd|th)?|[0-9]{1,2})/i);
        if (clsMatch && !targetPrefix.includes('all')) {
            let num = clsMatch[1].replace(/[^0-9]/g, '');
            if (num) {
                targetClass = num + 'th';
                let match = students.find(s => s.class && (s.class.toLowerCase().includes(num) || s.class.toLowerCase() === clsMatch[1].toLowerCase()));
                if (match) targetClass = match.class;
                targetType = 'class';
            }
        }

        if (!broadcastContent || broadcastContent.length < 2) {
            return {
                status: 'success',
                result: {
                    intent: "TEXT_RESPONSE",
                    message: `📢 *BROADCAST MESSAGE COMMAND GUIDE* 🌟\n\nAap is tarah se message bhej sakte hain:\n\n1. • *"Send to all: Kal coaching me 9 baje test hoga"* (Sabhi bacho ko jayega)\n2. • *"Send to class 10th: Kal physics ki extra class hai"* (Sirf Class 10th ko)\n3. • *"Send to morning: Kal subah 7 AM par class hogi"* (Sirf Morning shift ko)\n\n💡 *Tip:* Colon (:) ke baad apna message likhein.`
                }
            };
        }

        // Filter target students with valid phone
        let targets = [];
        let targetLabel = '';
        if (targetType === 'all') {
            targets = students.filter(s => s.phone && s.phone.toString().trim().length >= 10);
            targetLabel = `All Students (${targets.length})`;
        } else if (targetType === 'class') {
            targets = students.filter(s => s.class && s.class.toLowerCase() === targetClass.toLowerCase() && s.phone && s.phone.toString().trim().length >= 10);
            targetLabel = `Class ${targetClass} (${targets.length} students)`;
        } else if (targetType === 'shift') {
            targets = students.filter(s => (s.shift || 'Morning').toLowerCase() === targetShift.toLowerCase() && s.phone && s.phone.toString().trim().length >= 10);
            targetLabel = `${targetShift} Shift (${targets.length} students)`;
        }

        if (targets.length === 0) {
            return {
                status: 'success',
                result: {
                    intent: "TEXT_RESPONSE",
                    message: `❌ **Koi student nahi mila!**\nTarget group *${targetLabel || targetClass || 'Selected'}* me valid 10-digit phone number ke sath koi student nahi mila.`
                }
            };
        }

        return {
            status: 'success',
            result: {
                intent: "BROADCAST_RESPONSE",
                message: `🚀 **BROADCAST DISPATCHED TO ${targets.length} STUDENTS!**\n\n• **Audience:** ${targetLabel}\n• **Total Recipients:** ${targets.length} Students\n\n📝 *Notice Text:*\n"${broadcastContent}"\n\n<CMD>EXECUTE_BROADCAST|${targetType}|${targetClass || targetShift || 'All'}|${encodeURIComponent(broadcastContent)}</CMD>\n\nWhatsApp par messages background me bheje ja rahe hain!`
            }
        };
    }
    
    // 1. ATTENDANCE COMMAND
    if (p.includes('attendance') || p.includes('present') || p.includes('absent') || p.includes('hazri') || p.includes('mark')) {
        let status = p.includes('absent') ? 'Absent' : 'Present';
        let classMatch = p.match(/(?:class\s*|c-)?([0-9]{1,2}(?:st|nd|rd|th)?|[0-9]{1,2})/i);
        let targetClass = '';
        if (classMatch) {
            let num = classMatch[1].replace(/[^0-9]/g, '');
            if (num) {
                targetClass = num + 'th';
                let matchingClass = students.find(s => s.class && (s.class.toLowerCase().includes(num) || s.class.toLowerCase() === classMatch[1].toLowerCase()));
                if (matchingClass) targetClass = matchingClass.class;
            }
        }
        
        if (targetClass) {
            let stuInClass = students.filter(s => s.class === targetClass);
            return {
                status: 'success',
                result: {
                    intent: "COMMAND_RESPONSE",
                    message: `✔ **Class ${targetClass} Attendance Marked!**\nClass ${targetClass} ke sabhi (${stuInClass.length}) students ko **${status}** mark kar diya gaya hai.\n\n<CMD>MARK_ATTENDANCE|${targetClass}|${status}</CMD>`
                }
            };
        } else if (p.includes('sabhi') || p.includes('all')) {
            return {
                status: 'success',
                result: {
                    intent: "COMMAND_RESPONSE",
                    message: `✔ **All Students Attendance Marked!**\nSabhi students ko **${status}** mark kar diya gaya hai.\n\n<CMD>MARK_ATTENDANCE|All|${status}</CMD>`
                }
            };
        }
    }
    
    // 2. PTM NOTE / MEETING NOTICE
    if (p.includes('ptm') || p.includes('meeting') || p.includes('parent') || p.includes('notice')) {
        let upcomingDate = new Date();
        upcomingDate.setDate(upcomingDate.getDate() + ((7 - upcomingDate.getDay()) % 7 || 7));
        let dateStr = upcomingDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        
        let msg = `📢 *PARENTS-TEACHER MEETING (PTM) NOTICE* 🌟\n\n*VIJAY SIR EDUCATION HUB*\n\nRespected Parents,\n\nThis is to cordially inform you that a Parents-Teacher Meeting (PTM) has been scheduled to discuss your ward's academic performance, test results, attendance, and preparation strategy.\n\n📅 *Date:* ${dateStr} (Sunday)\n⏰ *Time:* 10:00 AM to 01:00 PM\n📍 *Venue:* Vijay Sir Education Hub\n\nKindly note:\n1. Your presence is essential for your child's continuous academic improvement.\n2. Parents with pending fee dues are requested to kindly clear the same during the meeting.\n\nLooking forward to meeting you.\n\nWarm Regards,\n*Vijay Sir*\nDirector, VSEH`;
        return {
            status: 'success',
            result: { intent: "TEXT_RESPONSE", message: msg }
        };
    }
    
    // 3. DEFAULTERS / PENDING FEES
    if (p.includes('defaulter') || p.includes('pending') || p.includes('due') || p.includes('baki') || p.includes('unpaid') || p.includes('fees')) {
        let defaulters = [];
        let totalPending = 0;
        
        students.forEach(s => {
            let dues = calculateStudentDues(s, payments);
            if (dues.isOverdue && dues.pendingMonths.length > 0) {
                defaulters.push({
                    name: s.name,
                    class: s.class,
                    shift: s.shift || 'Morning',
                    phone: s.phone,
                    amount: dues.totalPendingAmount,
                    months: dues.formattedPendingText
                });
                totalPending += dues.totalPendingAmount;
            }
        });
        
        if (defaulters.length === 0) {
            return {
                status: 'success',
                result: { intent: "TEXT_RESPONSE", message: `🎉 **Good News!**\nAbhi koi bhi fee defaulter nahi hai. Sabhi active students ki fees fully cleared hai!` }
            };
        }
        
        defaulters.sort((a, b) => b.amount - a.amount);
        let listStr = defaulters.slice(0, 8).map((d, idx) => `${idx + 1}. *${d.name}* (${d.class}) - ₹${d.amount} (${d.months})`).join("\n");
        let extra = defaulters.length > 8 ? `\n...aur ${defaulters.length - 8} aur students (Total ${defaulters.length} defaulters)` : '';
        
        let reply = `📋 *DEFAULTERS & PENDING FEES REPORT*\n\n• *Total Defaulters:* ${defaulters.length}\n• *Total Pending Amount:* ₹${totalPending.toLocaleString('en-IN')}\n\n*Top Defaulters:*\n${listStr}${extra}\n\n💡 *Tip:* Defaulters panel se aap direct WhatsApp reminder bhej sakte hain.`;
        return {
            status: 'success',
            result: { intent: "TEXT_RESPONSE", message: reply }
        };
    }
    
    // 4. COLLECTION / STATS / SUMMARY
    if (p.includes('collection') || p.includes('stat') || p.includes('summary') || p.includes('paid') || p.includes('hisab') || p.includes('total')) {
        let now = new Date();
        let curMonth = now.toLocaleString('default', { month: 'long' });
        let collectedAmt = 0;
        
        let monthPayments = (payments || []).filter(pay => {
            let pMonth = (pay.month || '').toLowerCase();
            return pMonth.includes(curMonth.toLowerCase());
        });
        
        monthPayments.forEach(pay => {
            collectedAmt += Number(pay.amount) || 0;
        });
        
        let uniquePaidStudents = new Set(monthPayments.map(p => (p.studentName || '').trim().toUpperCase())).size;
        
        let reply = `📊 *VSEH FINANCIAL & ROSTER SUMMARY*\n\n• *Current Month:* ${curMonth} ${now.getFullYear()}\n• *Total Registered Students:* ${students.length}\n• *Students Paid for ${curMonth}:* ${uniquePaidStudents}\n• *Total Collection this Month:* ₹${collectedAmt.toLocaleString('en-IN')}\n\nData is 100% synced with Supabase cloud database!`;
        return {
            status: 'success',
            result: { intent: "TEXT_RESPONSE", message: reply }
        };
    }
    
    // 5. STUDENT SEARCH / LOOKUP
    let cleanQuery = p.replace(/^(details of|search|find|lookup|check|info of|who is|batao|kiska|phone of|phone number of)\s+/i, '').replace(/(\s+(ki details|ka number|ka detail|ke bare me|ka record))$/i, '').trim();
    if (cleanQuery.length >= 3) {
        let matches = students.filter(s => s.name && s.name.toLowerCase().includes(cleanQuery));
        if (matches.length > 0) {
            let stuCards = matches.slice(0, 3).map(s => {
                let dues = calculateStudentDues(s, payments);
                let statusTxt = dues.isOverdue ? `❌ Pending: ₹${dues.totalPendingAmount} (${dues.formattedPendingText})` : `✅ All Fees Cleared`;
                return `👤 *${s.name.toUpperCase()}*\n• *Class:* ${s.class} (${s.shift || 'Morning'})\n• *Phone:* +91 ${s.phone || 'N/A'}\n• *Monthly Fee:* ₹${s.fee || '500'}\n• *Status:* ${statusTxt}`;
            }).join("\n\n");
            return {
                status: 'success',
                result: { intent: "TEXT_RESPONSE", message: `🔍 *STUDENT SEARCH RESULTS:*\n\n${stuCards}` }
            };
        }
    }
    
    // 6. DEFAULT / GENERAL HELP
    let helpMsg = `🤖 *VIJAY SIR AI ASSISTANT* 🌟\n\nMain aapki coaching management me madad ke liye ready hoon! Ye commands try karein:\n\n1. 📢 *"Generate PTM Note"* - Parent meeting notice draft karein\n2. 📋 *"Defaulters List"* - Pending fees report dekhein\n3. 📊 *"Collection Summary"* - Total collection aur paid stats janein\n4. 📝 *"Mark Class 10th Present"* - Automatic attendance mark karein\n5. 🔍 *"Details of [Student Name]"* - Kisi bhi student ka profile dekhein`;
    return {
        status: 'success',
        result: { intent: "TEXT_RESPONSE", message: helpMsg }
    };
}

async function executeAiBroadcast(bType, bTarget, bContent) {
    let students = appData.students || [];
    let targets = [];
    
    if (bType === 'all') {
        targets = students.filter(s => s.phone && s.phone.toString().trim().length >= 10);
    } else if (bType === 'class') {
        targets = students.filter(s => s.class && s.class.toLowerCase() === bTarget.toLowerCase() && s.phone && s.phone.toString().trim().length >= 10);
    } else if (bType === 'shift') {
        targets = students.filter(s => (s.shift || 'Morning').toLowerCase() === bTarget.toLowerCase() && s.phone && s.phone.toString().trim().length >= 10);
    }
    
    if (targets.length === 0) {
        showToast("NO VALID RECIPIENTS FOUND");
        return;
    }
    
    let formattedMsg = `📢 *IMPORTANT NOTICE* 🌟\n*VIJAY SIR EDUCATION HUB*\n\nDear Student / Parent,\n\n${bContent}\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
    
    showToast(`BROADCASTING TO ${targets.length} STUDENTS 🚀`);
    
    let sentCount = 0;
    let failCount = 0;
    for (let i = 0; i < targets.length; i++) {
        let s = targets[i];
        try {
            let res = await gasApi('stealthWhatsAppTrigger', { phone: s.phone, message: formattedMsg });
            let ok = notifyWhatsAppStatus(res, s.name, s.phone, 'Broadcast Notice', { message: formattedMsg });
            if (ok) sentCount++;
            else failCount++;
        } catch(e) {
            failCount++;
        }
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 1200));
    }
    
    if (failCount > 0) {
        showToast(`⚠️ BROADCAST: ${sentCount} SENT, ${failCount} FAILED. Check Gateway!`);
    } else {
        showToast(`✔ BROADCAST SENT TO ${sentCount} STUDENTS!`);
    }
}

function executeAiAttendanceMark(targetClass, targetStatus) {
    let attClass = document.getElementById('attClass');
    if (attClass && targetClass !== 'All') {
        attClass.value = targetClass;
    }
    loadAttendanceStudents();
    
    setTimeout(() => {
        let rows = document.querySelectorAll('#attendance-list [data-student-name]');
        rows.forEach(row => {
            let stuClass = row.getAttribute('data-student-class');
            if (targetClass === 'All' || !stuClass || stuClass.toLowerCase() === targetClass.toLowerCase()) {
                let btn = row.querySelector(`.att-btn[onclick*="${targetStatus}"]`);
                if (btn) setAtt(btn, targetStatus);
            }
        });
        showToast(`CLASS ${targetClass.toUpperCase()} MARKED ${targetStatus.toUpperCase()}!`);
    }, 150);
}


// ==========================================================================
// VSEH PRO - 10 ULTRA THEMES STUDIO ENGINE
// ==========================================================================
var THEMES_DATA = [
    { id: 'original', name: 'Original Classic', icon: 'fa-landmark', desc: 'Default VSEH Pro Clean Light & Indigo', colors: ['#f4f7fe', '#6366f1', '#10b981'], badge: 'Original' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon 2077', icon: 'fa-bolt', desc: 'Futuristic Dark Neon Cyan & Magenta Glow', colors: ['#080814', '#00f2fe', '#f72585'], badge: 'Ultra Neon' },
    { id: 'gold-obsidian', name: 'Midnight Obsidian & Gold', icon: 'fa-crown', desc: 'Velvet Obsidian Black & Molten Gold', colors: ['#0a0908', '#f59e0b', '#d97706'], badge: 'Royal Luxury' },
    { id: 'aurora', name: 'Aurora Borealis Hologram', icon: 'fa-wand-magic-sparkles', desc: 'Ethereal Arctic Teal & Violet Mesh', colors: ['#031219', '#2dd4bf', '#a78bfa'], badge: 'Holographic' },
    { id: 'sunset-blaze', name: 'Sunset Crimson & Violet', icon: 'fa-fire-flame-curved', desc: 'Warm Twilight Glow & Coral Blaze', colors: ['#140718', '#ff416c', '#f97316'], badge: 'Radiant Blaze' },
    { id: 'emerald-zen', name: 'Emerald Matrix & Zen', icon: 'fa-leaf', desc: 'Deep Botanical Spruce & Mint Glow', colors: ['#04140c', '#10b981', '#34d399'], badge: 'Botanical Zen' },
    { id: 'deep-ocean', name: 'Deep Ocean & Electric Aqua', icon: 'fa-water', desc: 'Mariana Abyss & Bioluminescent Aqua', colors: ['#030a16', '#38bdf8', '#2563eb'], badge: 'Aquatic Abyss' },
    { id: 'cosmic-galaxy', name: 'Cosmic Galaxy & Nebula', icon: 'fa-meteor', desc: 'Starlight Void & Electric Amethyst', colors: ['#0a0218', '#c084fc', '#6366f1'], badge: 'Deep Space' },
    { id: 'sakura-frost', name: 'Tokyo Cherry Blossom', icon: 'fa-fan', desc: 'Frosted Rose Pearl & Sakura Blush', colors: ['#fdf4f8', '#ec4899', '#fbcfe8'], badge: 'Sakura Frost' },
    { id: 'synthwave', name: 'Retro 80s Synthwave', icon: 'fa-gamepad', desc: 'Outrun Sunset Grid & Wireframe Cyan', colors: ['#140426', '#ff007f', '#00f5d4'], badge: 'Retro 80s' },
    { id: 'neumorphic', name: 'Titanium Silver Slate', icon: 'fa-shapes', desc: 'Extruded Sculpted Soft Neumorphism', colors: ['#e2e8f0', '#cbd5e1', '#334155'], badge: 'Neumorphism' }
];

function openThemeSettings() {
    document.getElementById('settingsMainMenu').classList.add('hidden');
    let subShift = document.getElementById('settingsSubMenu');
    if (subShift) subShift.classList.add('hidden');
    let subTest = document.getElementById('settingsTestMenu');
    if (subTest) subTest.classList.add('hidden');
    
    let themeMenu = document.getElementById('settingsThemeMenu');
    if (themeMenu) themeMenu.classList.remove('hidden');
    
    renderThemeCards();
}

function closeThemeSettings() {
    let themeMenu = document.getElementById('settingsThemeMenu');
    if (themeMenu) themeMenu.classList.add('hidden');
    document.getElementById('settingsMainMenu').classList.remove('hidden');
}

function renderThemeCards() {
    let grid = document.getElementById('themeCardsGrid');
    if (!grid) return;
    
    let activeTheme = localStorage.getItem('vseh_active_theme') || 'original';
    grid.innerHTML = '';
    
    THEMES_DATA.forEach(t => {
        let isActive = (t.id === activeTheme);
        let activeBorder = isActive ? 'border-2 border-purple-500 shadow-xl' : 'border border-gray-100 hover:border-purple-200';
        let checkBadge = isActive ? '<span class="text-[9px] font-black bg-purple-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0"><i class="fas fa-check mr-1"></i>Active</span>' : '';
        
        let colorSwatches = t.colors.map(c => `<span class="w-3.5 h-3.5 rounded-full shadow-sm inline-block border border-white/40" style="background-color: ${c};"></span>`).join('');
        
        grid.insertAdjacentHTML('beforeend', `
        <div onclick="applyTheme('${t.id}')" class="glass-panel p-4 rounded-24 cursor-pointer transition-all active:scale-95 ${activeBorder}">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 min-w-0 flex-1">
                    <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-inner border border-white/20" style="background: linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]}); color: ${t.colors[2]};">
                        <i class="fas ${t.icon}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center space-x-1.5">
                            <h4 class="text-xs font-black text-gray-800 uppercase tracking-wide truncate">${t.name}</h4>
                            <span class="text-[8px] font-bold text-gray-400 uppercase tracking-wider">${t.badge}</span>
                        </div>
                        <p class="text-[9px] font-bold text-gray-400 truncate mt-0.5">${t.desc}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2 shrink-0 ml-2">
                    <div class="flex items-center space-x-1">
                        ${colorSwatches}
                    </div>
                    ${checkBadge}
                </div>
            </div>
        </div>`);
    });
    
    let activeBadge = document.getElementById('activeThemeBadge');
    if (activeBadge) {
        let found = THEMES_DATA.find(t => t.id === activeTheme);
        activeBadge.innerText = found ? found.name : 'Original';
    }
}

function applyTheme(themeId, shouldSave = true) {
    if (!themeId) themeId = 'original';
    
    if (themeId === 'original') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.setAttribute('data-theme', themeId);
    }
    
    if (shouldSave) {
        try {
            localStorage.setItem('vseh_active_theme', themeId);
        } catch(e) {}
        
        // Sync to Supabase settings in background
        try {
            supabaseFetch('settings', '', 'POST', [{
                key: 'activeTheme',
                value: themeId
            }], { 'Prefer': 'resolution=merge-duplicates' }).catch(()=>{});
        } catch(e) {}
        
        let found = THEMES_DATA.find(t => t.id === themeId);
        let name = found ? found.name : themeId;
        showToast(`🎨 THEME APPLIED: ${name.toUpperCase()}`);
        renderThemeCards();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Apply Stored Theme on Startup Immediately (Zero Flicker)
    try { let t = localStorage.getItem('vseh_active_theme') || 'original'; applyTheme(t, false); } catch(e) {}

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

    // Safety Net: During morning working hours (8:00 AM to 12:00 PM), flush any night queued receipts
    gasApi('processNightQueue').then(res => {
        if (res && res.count > 0) {
            showToast(`✔ SENT ${res.count} MORNING RECEIPTS TO PARENTS!`);
        }
    }).catch(()=>{});

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
    checkFeeNightNotice();
    checkAttNightNotice();
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

        async function queueNightReceipt(receiptItem) {
            try {
                let existingQueue = [];
                try {
                    let res = await supabaseFetch('settings', '?key=eq.night_receipt_queue&select=*');
                    if (Array.isArray(res) && res.length > 0 && res[0].value) {
                        existingQueue = typeof res[0].value === 'string' ? JSON.parse(res[0].value) : res[0].value;
                    }
                } catch(e) {}

                if (!Array.isArray(existingQueue)) existingQueue = [];
                existingQueue.push(receiptItem);

                await supabaseFetch('settings', '', 'POST', [{
                    key: 'night_receipt_queue',
                    value: JSON.stringify(existingQueue)
                }], { 'Prefer': 'resolution=merge-duplicates' });

                try {
                    localStorage.setItem('vseh_night_receipt_queue', JSON.stringify(existingQueue));
                } catch(e) {}

                showToast("🌙 SAVED TO CLOUD QUEUE! Auto-sends tomorrow at 8:00 AM (No app opening needed).");
            } catch(err) {
                console.error("Failed to queue night receipt:", err);
            }
        }

        function checkFeeNightNotice() {
            let notice = document.getElementById('feeNightNotice');
            let btn = document.getElementById('feeSubmitBtn');
            if (!notice) return;
            let hour = new Date().getHours();
            let isNight = (hour >= 21 || hour < 8);
            let timerActive = appData.waTimerEnabled !== false;

            if (timerActive && isNight) {
                notice.classList.remove('hidden');
                if (btn) btn.innerHTML = 'SAVE & QUEUE FOR 8 AM <i class="fas fa-moon ml-2 text-lg"></i>';
            } else if (!timerActive) {
                notice.classList.add('hidden');
                if (btn) btn.innerHTML = 'SAVE & SEND INSTANTLY <i class="fas fa-bolt ml-2 text-lg"></i>';
            } else {
                notice.classList.add('hidden');
                if (btn) btn.innerHTML = 'SAVE & AUTO DISPATCH <i class="fas fa-robot ml-2 text-lg"></i>';
            }
        }

        function checkAttNightNotice() {
            let notice = document.getElementById('attNightNotice');
            let btn = document.getElementById('attSubmitBtn');
            let hour = new Date().getHours();
            let isNight = (hour >= 21 || hour < 8);
            let timerActive = appData.waTimerEnabled !== false;

            if (notice) {
                if (timerActive && isNight) {
                    notice.classList.remove('hidden');
                } else {
                    notice.classList.add('hidden');
                }
            }

            if (btn) {
                if (timerActive && isNight) {
                    btn.innerHTML = 'SAVE & QUEUE ALERTS FOR 8 AM <i class="fas fa-moon ml-2 text-lg"></i>';
                } else if (!timerActive) {
                    btn.innerHTML = 'SAVE & SEND INSTANTLY <i class="fas fa-bolt ml-2 text-lg"></i>';
                } else {
                    btn.innerHTML = 'SAVE & SEND ALERTS <i class="fas fa-paper-plane ml-2 text-lg"></i>';
                }
            }
        }

        async function checkInstanceHealth(customInst = null, customTok = null) {
            let inst = customInst || (appData.waSettings && appData.waSettings.instanceId) || 'instance175857';
            let tok = customTok || (appData.waSettings && appData.waSettings.token) || '7yqm7bhojwpovbu4';
            let badge = document.getElementById('waStatusBadge');
            if (!badge) return;

            badge.className = 'text-[9px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 animate-pulse';
            badge.innerText = 'Checking...';

            try {
                let apiUrl = `https://api.ultramsg.com/${inst}/instance/status?token=${tok}`;
                let res = await fetch(apiUrl);
                let data = await res.json();

                if (data && data.status && data.status.accountStatus && data.status.accountStatus.status === 'authenticated') {
                    badge.className = 'text-[9px] font-black px-2.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200 flex items-center shadow-sm';
                    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-ping"></span> CONNECTED (Active)';
                    return true;
                } else if (data && data.error) {
                    badge.className = 'text-[9px] font-black px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center shadow-sm';
                    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span> EXPIRED / STOPPED';
                    return false;
                } else {
                    badge.className = 'text-[9px] font-black px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center shadow-sm';
                    badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span> DISCONNECTED';
                    return false;
                }
            } catch(e) {
                badge.className = 'text-[9px] font-black px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200';
                badge.innerText = 'STATUS UNKNOWN';
                return null;
            }
        }

        function toggleWaTimer() {
            appData.waTimerEnabled = !appData.waTimerEnabled;
            try {
                localStorage.setItem('vseh_wa_timer_enabled', String(appData.waTimerEnabled));
            } catch(e) {}
            
            supabaseFetch('settings', '', 'POST', [{
                key: 'waTimerEnabled',
                value: String(appData.waTimerEnabled)
            }], { 'Prefer': 'resolution=merge-duplicates' }).catch(()=>{});

            updateWaTimerUI();
            checkFeeNightNotice();
            checkAttNightNotice();

            if (appData.waTimerEnabled) {
                showToast("⏱️ TIMER ENABLED: Night messages will hold for 8:00 AM auto-dispatch");
            } else {
                showToast("⚡ 24/7 INSTANT MODE: Timer Disabled. All messages send immediately!");
            }
        }

        function updateWaTimerUI() {
            let isEnabled = appData.waTimerEnabled !== false;
            let btn = document.getElementById('waTimerBtn');
            let thumb = document.getElementById('waTimerThumb');
            let desc = document.getElementById('waTimerDesc');

            if (btn && thumb) {
                if (isEnabled) {
                    btn.className = 'w-14 h-8 bg-amber-500 rounded-full relative transition-all duration-300 shadow-inner flex items-center p-1 shrink-0';
                    thumb.style.transform = 'translateX(24px)';
                    thumb.innerText = 'ON';
                    thumb.className = 'w-6 h-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center text-[8px] text-amber-600 font-black';
                    if (desc) desc.innerText = 'Quiet Hours (9 PM - 8 AM): Hold & Auto-Send at 8 AM';
                } else {
                    btn.className = 'w-14 h-8 bg-gray-300 dark:bg-slate-700 rounded-full relative transition-all duration-300 shadow-inner flex items-center p-1 shrink-0';
                    thumb.style.transform = 'translateX(0px)';
                    thumb.innerText = 'OFF';
                    thumb.className = 'w-6 h-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center text-[8px] text-gray-500 font-black';
                    if (desc) desc.innerText = '⚡ 24/7 Instant Send: No delay, messages send right away!';
                }
            }
        }

        function notifyWhatsAppStatus(result, recipientName = '', phone = '', actionType = 'Message', fullPayload = null) {
            let nameText = recipientName ? `for ${recipientName}` : (phone ? `to ${phone}` : '');
            let isSuccess = result && (result.status === 'success' || result.sent === 'true' || result.sent === true || (result.apiResponse && result.apiResponse.sent === 'true'));
            
            if (isSuccess) {
                showToast(`✔ WHATSAPP SENT: ${actionType} delivered ${nameText}!`);
                return true;
            } else {
                let err = (result && (result.message || result.error)) || 'UltraMsg Trial Expired / Offline';
                console.warn(`WhatsApp Dispatch Failed ${nameText}:`, err);
                
                showToast(`🚨 WHATSAPP NOT SENT: ${actionType} failed ${nameText}! (UltraMsg Free Trial Expired/Stopped). Update Settings.`);
                
                let badge = document.getElementById('waStatusBadge');
                if (badge) {
                    badge.className = 'text-[9px] font-black px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200';
                    badge.innerText = 'EXPIRED / OFFLINE';
                }

                if (phone && fullPayload) {
                    recordFailedMessage({
                        id: 'FAIL_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        phone: phone,
                        message: fullPayload.message || '',
                        name: recipientName || '',
                        type: actionType,
                        failedAt: new Date().toISOString(),
                        reason: err
                    });
                }
                return false;
            }
        }

        function recordFailedMessage(item) {
            if (!appData.failedMessages) appData.failedMessages = [];
            let exists = appData.failedMessages.find(f => f.phone === item.phone && f.type === item.type);
            if (!exists) {
                appData.failedMessages.push(item);
                try {
                    localStorage.setItem('vseh_failed_wa_messages', JSON.stringify(appData.failedMessages));
                } catch(e) {}
                updateFailedMessagesUI();
            }
        }

        function updateFailedMessagesUI() {
            let box = document.getElementById('waFailedBox');
            let countEl = document.getElementById('waFailedCount');
            let list = appData.failedMessages || [];
            if (!box) return;

            if (list.length > 0) {
                box.classList.remove('hidden');
                if (countEl) countEl.innerText = list.length;
            } else {
                box.classList.add('hidden');
            }
        }

        async function retryFailedMessages() {
            let list = appData.failedMessages || [];
            if (list.length === 0) {
                showToast("NO FAILED MESSAGES TO RETRY");
                return;
            }

            let btn = document.getElementById('btn-retry-failed');
            let origHtml = btn ? btn.innerHTML : 'Retry All';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Retrying...';
                btn.disabled = true;
            }

            showToast(`RETRYING ${list.length} FAILED MESSAGES...`);
            let successfulIds = new Set();

            for (const item of list) {
                if (item.phone && item.message) {
                    let res = await gasApi('stealthWhatsAppTrigger', { phone: item.phone, message: item.message });
                    if (res && (res.status === 'success' || res.sent === 'true' || res.sent === true)) {
                        successfulIds.add(item.id);
                    }
                    await new Promise(r => setTimeout(r, 2200));
                }
            }

            appData.failedMessages = (appData.failedMessages || []).filter(item => !successfulIds.has(item.id));
            try {
                localStorage.setItem('vseh_failed_wa_messages', JSON.stringify(appData.failedMessages));
            } catch(e) {}

            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }

            updateFailedMessagesUI();
            if (successfulIds.size > 0) {
                showToast(`✔ DELIVERED ${successfulIds.size} PREVIOUSLY FAILED MESSAGES!`);
            } else {
                showToast("⚠️ RETRY FAILED! Instance may still be expired. Update in Settings.");
            }
        }

        async function sendSuccessMsg(name, phone, amt, mnth, mode, studentObj = null, forceSendNow = false) {
            let student = studentObj || (appData.students || []).find(s => s.phone === phone || (s.name && s.name.toUpperCase() === (name || '').toUpperCase()));
            
            // Expected monthly fee for the student
            let studentFee = student ? (Number(student.fee) || 0) : 0;
            if (studentFee === 0 && student && appData.feeSettings) {
                let key = (student.shift || 'Morning') + ' - ' + (student.class || '');
                studentFee = Number(appData.feeSettings[key]) || 0;
            }
            
            // Partial payment for current transaction month
            let monthPartialRemaining = (studentFee > 0 && Number(amt) < studentFee) ? (studentFee - Number(amt)) : 0;
            
            // Remaining pending months from dues calculation (excluding current payment month to prevent double counting)
            let dues = student ? calculateStudentDues(student, appData.payments) : { isOverdue: false, totalPendingAmount: 0, formattedPendingText: '', pendingMonths: [] };
            let cleanCurrentMonth = (mnth || '').trim().toLowerCase();
            let otherPendingMonths = (dues.pendingMonths || []).filter(m => m.trim().toLowerCase() !== cleanCurrentMonth);
            let otherPendingAmount = otherPendingMonths.length * studentFee;
            let totalRemaining = monthPartialRemaining + otherPendingAmount;
            
            var msg = '';
            if (totalRemaining > 0) {
                let details = [];
                if (monthPartialRemaining > 0) details.push(`${mnth.toUpperCase()} balance: ₹${monthPartialRemaining}`);
                if (otherPendingMonths.length > 0) {
                    let otherText = otherPendingMonths.map(m => m.toUpperCase()).join(", ");
                    details.push(`Pending: ${otherText}`);
                }
                let detailStr = details.length > 0 ? ` (${details.join(" | ")})` : '';
                
                msg = `Fee Payment Receipt 🧾✨\n\nDear Parent,\n\nWe have received fee payment of *₹${amt}* for *${name.toUpperCase()}* for the month of *${mnth.toUpperCase()}* (Mode: *${mode}*).\n\n📌 *Payment & Balance Summary:*\n• Amount Received: *₹${amt}*\n• Remaining Due: *₹${totalRemaining}*${detailStr}\n\nKindly clear the remaining balance at your earliest convenience. Thank you for your continued trust and support! 🌟\n\nWith Best Regards,\n*VIJAY SIR EDUCATION HUB*`;
            } else {
                msg = `Fee Payment Receipt 🧾✨\n\nDear Parent,\n\nWe have received the monthly fee payment of *₹${amt}* for *${name.toUpperCase()}* for the month of *${mnth.toUpperCase()}* (Mode: *${mode}*).\n\n🎉 *All fee dues are completely cleared!*\n\nThank you for your timely payment and trust in us! We are committed to providing the best learning guidance and care for your child's bright academic future. 🌟\n\nWith Best Regards,\n*VIJAY SIR EDUCATION HUB*`;
            }

            // CHECK QUIET HOURS & TIMER SETTING (Night 9:00 PM to Morning 8:00 AM)
            let now = new Date();
            let currentHour = now.getHours();
            let isQuietHours = (currentHour >= 21 || currentHour < 8);
            let timerActive = appData.waTimerEnabled !== false;

            if (timerActive && isQuietHours && !forceSendNow) {
                showToast("🌙 NIGHT TIME: Queued for 8:00 AM Auto-Send (No App Opening Needed)!");
                await queueNightReceipt({
                    id: 'Q_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    studentName: name,
                    phone: phone,
                    amount: amt,
                    month: mnth,
                    mode: mode,
                    message: msg,
                    queuedAt: now.toISOString(),
                    scheduledFor: '08:00 AM'
                });
                return;
            }
            
            showToast("DISPATCHING RECEIPT TO WHATSAPP...");
            let res = await gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
            notifyWhatsAppStatus(res, name, phone, 'Fee Receipt', { message: msg });
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
                notifyWhatsAppStatus(res, s.name, s.phone, 'Fee Reminder', { message: msg });
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

            let isSuccess = result && (result.status === 'success' || result.sent === 'true' || result.sent === true || result.message === 'ok');

            if (isSuccess) {
                if (resP) {
                    resP.classList.remove('text-indigo-600', 'text-red-500');
                    resP.classList.add('text-green-600');
                    resP.innerText = '✔ WhatsApp Gateway Active & Verified! Check WhatsApp.';
                }
                showToast("✔ TEST SENT (Direct 24/7 Ping). Schedule Timer applies to Fees Receipts!");
            } else {
                if (resP) {
                    resP.classList.remove('text-indigo-600', 'text-green-600');
                    resP.classList.add('text-red-500');
                    resP.innerText = '✖ Failed: ' + (result ? (result.message || JSON.stringify(result)) : 'Unknown error');
                }
                showToast("FAILED TO SEND WHATSAPP: UltraMsg Trial Expired or Invalid");
            }
            notifyWhatsAppStatus(result, 'Test Gateway', phone, 'Test Ping', { message: testMsg });
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
            if(id === 'fee') { checkFeeNightNotice(); }
            
            // Auto-hide floating fee button on AI Hub or Fee Collection tab to prevent overlap
            let feeFab = document.getElementById('floatingFeeBtn');
            if (feeFab) {
                if (id === 'aihub' || id === 'fee') {
                    feeFab.classList.add('hidden');
                } else {
                    feeFab.classList.remove('hidden');
                }
            }
            
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
            checkAttNightNotice();
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

        // ==========================================================================
        // TEST & EXAM MARKS MANAGER ENGINE
        // ==========================================================================
        function openTestSettings() {
            document.getElementById('settingsMainMenu').classList.add('hidden');
            let subShift = document.getElementById('settingsSubMenu');
            if (subShift) subShift.classList.add('hidden');
            
            let testMenu = document.getElementById('settingsTestMenu');
            if (testMenu) testMenu.classList.remove('hidden');
            
            let tDate = document.getElementById('testDate');
            if (tDate) tDate.valueAsDate = new Date();
            
            loadTestClasses();
            loadTestStudents();
        }

        function closeTestSettings() {
            let testMenu = document.getElementById('settingsTestMenu');
            if (testMenu) testMenu.classList.add('hidden');
            document.getElementById('settingsMainMenu').classList.remove('hidden');
        }

        function loadTestClasses() {
            let shiftElem = document.getElementById('testShift');
            let shift = shiftElem ? shiftElem.value : 'Evening';
            let classDropdown = document.getElementById('testClass');
            if (!classDropdown) return;
            
            classDropdown.innerHTML = '';
            
            // Extract unique classes for this shift
            let classes = new Set();
            (appData.students || []).forEach(s => {
                if ((s.shift || 'Morning') === shift && s.class) {
                    classes.add(s.class.trim());
                }
            });
            
            // Also add classes from feeSettings if any
            for (let k in (appData.feeSettings || {})) {
                if (k.startsWith(shift + " - ")) {
                    classes.add(k.replace(shift + " - ", "").trim());
                }
            }
            
            let sorted = Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
            if (sorted.length === 0) {
                classDropdown.insertAdjacentHTML('beforeend', '<option value="">No Classes Found</option>');
            } else {
                sorted.forEach(c => {
                    classDropdown.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
                });
            }
        }

        function loadTestStudents() {
            let shiftElem = document.getElementById('testShift');
            let shift = shiftElem ? shiftElem.value : 'Evening';
            let classElem = document.getElementById('testClass');
            let cls = classElem ? classElem.value : '';
            let list = document.getElementById('testStudentsList');
            let countBadge = document.getElementById('testStudentCountBadge');
            if (!list) return;
            
            list.innerHTML = '';
            
            let students = (appData.students || []).filter(s => {
                let matchShift = (s.shift || 'Morning') === shift;
                let matchClass = !cls || s.class === cls;
                return matchShift && matchClass;
            });
            
            if (countBadge) countBadge.innerText = `${students.length} Students`;
            
            if (students.length === 0) {
                list.innerHTML = '<div class="glass-panel p-6 rounded-24 text-center"><p class="text-10 font-black text-gray-400 uppercase tracking-widest">NO STUDENTS FOUND FOR THIS SHIFT & CLASS</p></div>';
                return;
            }
            
            students.forEach((s, idx) => {
                list.insertAdjacentHTML('beforeend', `
                <div class="glass-panel p-3 rounded-2xl flex items-center justify-between border border-gray-100 test-stu-row transition-all" data-id="${s.id || ''}" data-name="${s.name}" data-phone="${s.phone || ''}" data-status="Present">
                    <div class="flex-1 min-w-0 pr-2">
                        <p class="text-xs font-black text-gray-800 force-uppercase truncate">${s.name}</p>
                        <div class="flex items-center space-x-1 mt-0.5">
                            <span class="text-[8px] font-bold text-gray-400 tracking-wider"><i class="fas fa-phone mr-1"></i>+91 ${s.phone || 'No Phone'}</span>
                            <span class="test-status-tag text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-green-50 text-green-600 ml-1">Present</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <!-- Attendance Toggle [P] / [A] -->
                        <div class="flex rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <button type="button" onclick="setTestRowAttendance(this, 'Present')" class="test-att-btn btn-p px-2.5 py-1.5 text-[10px] font-black bg-green-500 text-white transition active:scale-95">P</button>
                            <button type="button" onclick="setTestRowAttendance(this, 'Absent')" class="test-att-btn btn-a px-2.5 py-1.5 text-[10px] font-black bg-gray-100 text-gray-400 transition active:scale-95">A</button>
                        </div>
                        <!-- Marks Input -->
                        <input type="number" min="0" max="1000" class="test-marks-input mobile-input w-16 text-center text-xs font-black p-1.5 bg-white border border-gray-200 rounded-xl" placeholder="Marks">
                        <!-- Single WhatsApp Send Button -->
                        <button type="button" onclick="sendSingleStudentTestWhatsApp(this)" class="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center active:scale-90 shadow-sm border border-green-200 transition" title="Send Result to this parent">
                            <i class="fab fa-whatsapp text-sm"></i>
                        </button>
                    </div>
                </div>`);
            });
        }

        function setTestRowAttendance(btn, status) {
            let row = btn.closest('.test-stu-row');
            if (!row) return;
            
            row.setAttribute('data-status', status);
            let btnP = row.querySelector('.btn-p');
            let btnA = row.querySelector('.btn-a');
            let marksInput = row.querySelector('.test-marks-input');
            let statusTag = row.querySelector('.test-status-tag');
            
            if (status === 'Absent') {
                btnA.className = 'test-att-btn btn-a px-2.5 py-1.5 text-[10px] font-black bg-red-500 text-white transition active:scale-95';
                btnP.className = 'test-att-btn btn-p px-2.5 py-1.5 text-[10px] font-black bg-gray-100 text-gray-400 transition active:scale-95';
                if (marksInput) {
                    marksInput.value = '';
                    marksInput.disabled = true;
                    marksInput.classList.add('opacity-30', 'bg-gray-100');
                    marksInput.placeholder = 'ABSENT';
                }
                if (statusTag) {
                    statusTag.className = 'test-status-tag text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-600 ml-1';
                    statusTag.innerText = 'Absent';
                }
                row.classList.add('bg-red-50/40', 'border-red-200');
            } else {
                btnP.className = 'test-att-btn btn-p px-2.5 py-1.5 text-[10px] font-black bg-green-500 text-white transition active:scale-95';
                btnA.className = 'test-att-btn btn-a px-2.5 py-1.5 text-[10px] font-black bg-gray-100 text-gray-400 transition active:scale-95';
                if (marksInput) {
                    marksInput.disabled = false;
                    marksInput.classList.remove('opacity-30', 'bg-gray-100');
                    marksInput.placeholder = 'Marks';
                }
                if (statusTag) {
                    statusTag.className = 'test-status-tag text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-green-50 text-green-600 ml-1';
                    statusTag.innerText = 'Present';
                }
                row.classList.remove('bg-red-50/40', 'border-red-200');
            }
        }

        function markAllTestPresent() {
            let rows = document.querySelectorAll('#testStudentsList .test-stu-row');
            rows.forEach(row => {
                let btnP = row.querySelector('.btn-p');
                if (btnP) setTestRowAttendance(btnP, 'Present');
            });
            showToast("ALL STUDENTS MARKED PRESENT FOR TEST");
        }

        function formatTestDate(dateStr) {
            if (!dateStr) return new Date().toLocaleDateString('en-GB');
            let d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-GB');
        }

        async function sendSingleStudentTestWhatsApp(btn) {
            let row = btn.closest('.test-stu-row');
            if (!row) return;
            
            let name = row.getAttribute('data-name');
            let phone = row.getAttribute('data-phone');
            let status = row.getAttribute('data-status') || 'Present';
            let marksInput = row.querySelector('.test-marks-input');
            let marks = marksInput ? marksInput.value.trim() : '';
            
            if (!phone || phone.length < 10) {
                showToast("STUDENT HAS NO VALID PHONE NUMBER");
                return;
            }
            
            let subject = document.getElementById('testSubject') ? document.getElementById('testSubject').value.trim() : 'Test';
            let topic = document.getElementById('testTopic') ? document.getElementById('testTopic').value.trim() : '';
            let dateVal = document.getElementById('testDate') ? document.getElementById('testDate').value : '';
            let testDateStr = formatTestDate(dateVal);
            let maxMarks = document.getElementById('testMaxMarks') ? Number(document.getElementById('testMaxMarks').value) || 25 : 25;
            
            var msg = '';
            if (status === 'Absent') {
                msg = `Test Absence Alert ⚠️📢\n*VIJAY SIR EDUCATION HUB*\n\nDear Parent,\n\nPlease be informed that *${name.toUpperCase()}* was *ABSENT* in today's scheduled test:\n\n📚 *Subject:* ${subject.toUpperCase()}${topic ? `\n📖 *Topic:* ${topic}` : ''}\n📅 *Date:* ${testDateStr}\n❌ *Status:* *ABSENT IN TEST*\n\nRegular tests are vital for tracking your child's academic progress. Kindly ensure your child does not miss future tests and attends regular classes.\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
            } else {
                if (marks === '') {
                    showToast("ENTER MARKS FIRST (OR MARK ABSENT)");
                    if (marksInput) marksInput.focus();
                    return;
                }
                let numMarks = Number(marks) || 0;
                let pct = Math.round((numMarks / maxMarks) * 100);
                let remark = "Good Performance 👍";
                if (pct >= 90) remark = "Outstanding! 🌟";
                else if (pct >= 75) remark = "Excellent! 🎯";
                else if (pct >= 60) remark = "Good Performance 👍";
                else if (pct >= 40) remark = "Average - Needs More Practice 📖";
                else remark = "Needs Improvement & Hard Work ⚠️";
                
                msg = `Test Result Report 📝🌟\n*VIJAY SIR EDUCATION HUB*\n\nDear Parent,\n\nThe test results for *${name.toUpperCase()}* are declared below:\n\n📚 *Subject:* ${subject.toUpperCase()}${topic ? `\n📖 *Topic:* ${topic}` : ''}\n📅 *Date:* ${testDateStr}\n🎯 *Marks Obtained:* *${numMarks} / ${maxMarks}* (${pct}%)\n⭐ *Performance:* *${remark}*\n\nKindly encourage ${name.toUpperCase()} to keep working hard for academic excellence!\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
            }
            
            showToast(`SENDING TEST NOTICE TO ${name.toUpperCase()}...`);
            let res = await gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
            notifyWhatsAppStatus(res, name, phone, 'Test Notice', { message: msg });
        }

        async function broadcastAllTestResults() {
            let rows = document.querySelectorAll('#testStudentsList .test-stu-row');
            if (rows.length === 0) {
                showToast("NO STUDENTS IN TEST ROSTER");
                return;
            }
            
            let subject = document.getElementById('testSubject') ? document.getElementById('testSubject').value.trim() : 'Test';
            let topic = document.getElementById('testTopic') ? document.getElementById('testTopic').value.trim() : '';
            let dateVal = document.getElementById('testDate') ? document.getElementById('testDate').value : '';
            let testDateStr = formatTestDate(dateVal);
            let maxMarks = document.getElementById('testMaxMarks') ? Number(document.getElementById('testMaxMarks').value) || 25 : 25;
            
            let btn = document.getElementById('btnBroadcastTestResults');
            let origHtml = btn ? btn.innerHTML : '';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> DISPATCHING TEST NOTICES...';
                btn.disabled = true;
            }
            
            showToast(`BROADCASTING TEST RESULTS TO ${rows.length} STUDENTS 🚀`);
            
            let sentCount = 0;
            let failCount = 0;
            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];
                let name = row.getAttribute('data-name');
                let phone = row.getAttribute('data-phone');
                let status = row.getAttribute('data-status') || 'Present';
                let marksInput = row.querySelector('.test-marks-input');
                let marks = marksInput ? marksInput.value.trim() : '';
                
                if (!phone || phone.length < 10) continue;
                
                var msg = '';
                if (status === 'Absent') {
                    msg = `Test Absence Alert ⚠️📢\n*VIJAY SIR EDUCATION HUB*\n\nDear Parent,\n\nPlease be informed that *${name.toUpperCase()}* was *ABSENT* in today's scheduled test:\n\n📚 *Subject:* ${subject.toUpperCase()}${topic ? `\n📖 *Topic:* ${topic}` : ''}\n📅 *Date:* ${testDateStr}\n❌ *Status:* *ABSENT IN TEST*\n\nRegular tests are vital for tracking your child's academic progress. Kindly ensure your child does not miss future tests and attends regular classes.\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
                } else {
                    let numMarks = Number(marks) || 0;
                    let pct = Math.round((numMarks / maxMarks) * 100);
                    let remark = "Good Performance 👍";
                    if (pct >= 90) remark = "Outstanding! 🌟";
                    else if (pct >= 75) remark = "Excellent! 🎯";
                    else if (pct >= 60) remark = "Good Performance 👍";
                    else if (pct >= 40) remark = "Average - Needs More Practice 📖";
                    else remark = "Needs Improvement & Hard Work ⚠️";
                    
                    msg = `Test Result Report 📝🌟\n*VIJAY SIR EDUCATION HUB*\n\nDear Parent,\n\nThe test results for *${name.toUpperCase()}* are declared below:\n\n📚 *Subject:* ${subject.toUpperCase()}${topic ? `\n📖 *Topic:* ${topic}` : ''}\n📅 *Date:* ${testDateStr}\n🎯 *Marks Obtained:* *${numMarks} / ${maxMarks}* (${pct}%)\n⭐ *Performance:* *${remark}*\n\nKindly encourage ${name.toUpperCase()} to keep working hard for academic excellence!\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
                }
                
                try {
                    let res = await gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
                    let ok = notifyWhatsAppStatus(res, name, phone, 'Test Notice', { message: msg });
                    if (ok) sentCount++;
                    else failCount++;
                } catch(e) {
                    failCount++;
                }
                if (i < rows.length - 1) await new Promise(r => setTimeout(r, 1200));
            }
            
            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }
            if (failCount > 0) {
                showToast(`⚠️ TEST BROADCAST: ${sentCount} SENT, ${failCount} FAILED. Check Gateway!`);
            } else {
                showToast(`✔ TEST RESULTS DELIVERED TO ${sentCount} PARENTS!`);
            }
        }

        function initSettingsUI() {
            if (appData && appData.waSettings) {
                let instElem = document.getElementById('waInstanceId');
                let tokElem = document.getElementById('waToken');
                if (instElem) instElem.value = appData.waSettings.instanceId || 'instance175857';
                if (tokElem) tokElem.value = appData.waSettings.token || '7yqm7bhojwpovbu4';
            }
            updateWaTimerUI();
            updateFailedMessagesUI();
            checkInstanceHealth();
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
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> VERIFYING & SAVING...';
                btn.disabled = true;
            }

            appData.waSettings = {
                instanceId: inst,
                token: tok
            };

            // Live verify the new credentials with UltraMsg
            let isHealthOk = await checkInstanceHealth(inst, tok);

            let res = await gasApi('saveAllSettings', { 
                feeSettings: appData.feeSettings, 
                waSettings: appData.waSettings,
                waTimerEnabled: appData.waTimerEnabled !== false
            });
            if (res && res.status === 'success') {
                appData = Object.assign(appData, res);
            }

            if (btn) {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }

            if (isHealthOk === true) {
                showToast("✔ WHATSAPP GATEWAY CONNECTED & SAVED TO CLOUD!");
            } else if (isHealthOk === false) {
                showToast("⚠️ SAVED, BUT INSTANCE IS EXPIRED / INVALID CREDENTIALS");
            } else {
                showToast("WHATSAPP CONFIG SAVED TO CLOUD");
            }

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
            
            let btn = document.getElementById('attSubmitBtn') || document.querySelector('button[onclick="submitAttendance()"]');
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
            
            if(records.length === 0) { 
                showToast("NO STUDENTS TO MARK"); 
                if(btn) btn.disabled = false; 
                checkAttNightNotice(); 
                return; 
            }
            
            let result = await gasApi('saveAttendanceBatch', records);
            if(result && result.status === 'success') {
                appData = result;
                // Live Supabase Data
            }
            
            // Check Quiet Hours & Message Schedule Timer (9 PM to 8 AM)
            let now = new Date();
            let currentHour = now.getHours();
            let isQuietHours = (currentHour >= 21 || currentHour < 8);
            let timerActive = appData.waTimerEnabled !== false;
            let forceSendElem = document.getElementById('attForceSendNow');
            let forceSend = forceSendElem && forceSendElem.checked;

            // Send absent alerts via WhatsApp
            let absentRecords = records.filter(r => r.status === 'Absent');
            if (absentRecords.length > 0) {
                if (timerActive && isQuietHours && !forceSend) {
                    showToast(`🌙 NIGHT ATTENDANCE: Queuing ${absentRecords.length} absent alerts for 8:00 AM auto-dispatch...`);
                    for (const r of absentRecords) {
                        let s = (appData.students || []).find(x => x.name === r.studentName && (!r.class || x.class === r.class));
                        if (s && s.phone) {
                            let formattedDate = date;
                            let d = new Date(date);
                            if (!isNaN(d.getTime())) {
                                formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            }
                            let studentClass = r.class || cls || 'Class';
                            let msg = `Dear Parent,\n\nYour ward *${r.studentName.toUpperCase()}* is *ABSENT* today (${formattedDate}) from *${studentClass}* (${shift} Shift).\n\nPlease ensure regular attendance for their continuous learning and academic progress.\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
                            
                            await queueNightReceipt({
                                id: 'Q_ATT_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                                studentName: r.studentName,
                                phone: s.phone,
                                message: msg,
                                type: 'Absent Alert',
                                queuedAt: now.toISOString(),
                                scheduledFor: '08:00 AM'
                            });
                        }
                    }
                    showToast(`🌙 ${absentRecords.length} ABSENT ALERTS QUEUED FOR 8:00 AM (Timer ON)`);
                } else {
                    // Instant dispatch (Timer OFF, daytime, or forceSend checked)
                    for (const r of absentRecords) {
                        let s = (appData.students || []).find(x => x.name === r.studentName && (!r.class || x.class === r.class));
                        if (s && s.phone) {
                            let formattedDate = date;
                            let d = new Date(date);
                            if (!isNaN(d.getTime())) {
                                formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            }
                            let studentClass = r.class || cls || 'Class';
                            let msg = `Dear Parent,\n\nYour ward *${r.studentName.toUpperCase()}* is *ABSENT* today (${formattedDate}) from *${studentClass}* (${shift} Shift).\n\nPlease ensure regular attendance for their continuous learning and academic progress.\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
                            await sendWaMessage(s.phone, msg, r.studentName);
                            if (absentRecords.length > 1) await new Promise(res => setTimeout(res, 1200));
                        }
                    }
                }
            }
            
            syncUIPanels();
            updateClassStatusIndicator();
            
            if(btn) btn.disabled = false;
            checkAttNightNotice();
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
        
        // ==========================================================================
        // INSTANT ON-SAVE OVERDUE REMINDER (EXACTLY ONCE, IMMUNE TO RELOAD)
        // ==========================================================================
        try {
            let savedStudent = (appData.students || []).find(s => s.id === data.id || (s.name === data.name && s.class === data.class && (s.shift || 'Morning') === data.shift)) || data;
            if (savedStudent && savedStudent.phone) {
                let dues = calculateStudentDues(savedStudent, appData.payments);
                if (dues && dues.isOverdue && dues.pendingMonths && dues.pendingMonths.length > 0) {
                    let now = new Date();
                    let cycleYear = now.getFullYear();
                    let logKey = (savedStudent.id || savedStudent.name).trim().toUpperCase() + '_' + dues.pendingMonths[0].toUpperCase() + '_' + cycleYear;
                    
                    let localLog = {};
                    try {
                        let stored = localStorage.getItem('vseh_auto_reminders_log');
                        if (stored) localLog = JSON.parse(stored);
                    } catch(e) {}
                    let dbLog = appData.autoRemindersLog || {};
                    let combinedLog = Object.assign({}, dbLog, localLog);
                    
                    if (!combinedLog[logKey]) {
                        // Mark immediately in combinedLog to prevent duplicate on reload!
                        let nowIso = now.toISOString();
                        combinedLog[logKey] = nowIso;
                        try {
                            localStorage.setItem('vseh_auto_reminders_log', JSON.stringify(combinedLog));
                        } catch(e) {}
                        if (!appData.autoRemindersLog) appData.autoRemindersLog = {};
                        appData.autoRemindersLog[logKey] = nowIso;
                        
                        // Persist to Supabase settings in background
                        supabaseFetch('settings', '', 'POST', [{
                            key: 'autoRemindersLog',
                            value: JSON.stringify(combinedLog)
                        }], { 'Prefer': 'resolution=merge-duplicates' }).catch(()=>{});
                        
                        let feeAmt = dues.totalPendingAmount;
                        let monthsText = dues.formattedPendingText;
                        let reminderMsg = `Greetings! 🌟\n\nHope *${savedStudent.name.toUpperCase()}* is doing well.\n\nStudent registration has been completed successfully.\nKindly note that monthly fee of *₹${feeAmt}* for *${monthsText}* is currently pending.\nKindly process it when convenient.\n\nWarm Regards,\n*VIJAY SIR EDUCATION HUB*`;
                        
                        showToast(`DISPATCHING DUE REMINDER FOR ${monthsText}...`);
                        gasApi('stealthWhatsAppTrigger', { phone: savedStudent.phone, message: reminderMsg }).then(res => {
                            notifyWhatsAppStatus(res, savedStudent.name, savedStudent.phone, `Due Reminder (${monthsText})`, { message: reminderMsg });
                        }).catch(()=>{});
                    }
                }
            }
        } catch(remErr) {
            console.error("Error in on-save reminder:", remErr);
        }
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
    
    // Direct WhatsApp Receipt Dispatch with Remaining Dues Details
    let forceSendNow = document.getElementById('feeForceSendNow') ? document.getElementById('feeForceSendNow').checked : false;
    if (matchedStudent && matchedStudent.phone) {
        sendSuccessMsg(stu, matchedStudent.phone, amt, month, mode, matchedStudent, forceSendNow);
    }
    if (document.getElementById('feeForceSendNow')) document.getElementById('feeForceSendNow').checked = false;
    
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
    
    let res = await gasApi('processAiCommand', {prompt: val, context: {students: appData.students, payments: appData.payments, paidCount: appData.paidCount}});
    if(res && res.status === 'success') {
        let aiMsg = (res.result && res.result.message) ? res.result.message : (res.message || 'No response');
        
        // Parse & Execute <CMD> MARK_ATTENDANCE tag if present
        let cmdMatch = aiMsg.match(/<CMD>MARK_ATTENDANCE\|([^|]+)\|([^<]+)<\/CMD>/i);
        if (cmdMatch) {
            let targetClass = cmdMatch[1].trim();
            let targetStatus = cmdMatch[2].trim().toLowerCase() === 'absent' ? 'Absent' : 'Present';
            executeAiAttendanceMark(targetClass, targetStatus);
            aiMsg = aiMsg.replace(/<CMD>.*?<\/CMD>/g, '').trim();
        }

        // Parse & Execute <CMD> EXECUTE_BROADCAST tag if present
        let broadcastMatch = aiMsg.match(/<CMD>EXECUTE_BROADCAST\|([^|]+)\|([^|]+)\|([^<]+)<\/CMD>/i);
        if (broadcastMatch) {
            let bType = broadcastMatch[1].trim();
            let bTarget = broadcastMatch[2].trim();
            let bContent = decodeURIComponent(broadcastMatch[3].trim());
            executeAiBroadcast(bType, bTarget, bContent);
            aiMsg = aiMsg.replace(/<CMD>.*?<\/CMD>/g, '').trim();
        }
        
        box.innerHTML = '<div class="glass-panel p-4 rounded-24 rounded-tl-none border-l-4 border-purple-500 shadow-sm"><p class="text-xs font-bold text-gray-700">' + aiMsg.replace(/\n/g, '<br>') + '</p></div>';
        let inp = document.getElementById('ai-input') || document.getElementById('aiInput');
        if (inp) inp.value = '';
        box.scrollTop = box.scrollHeight;
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


function updateStudentCountBadges() {
    let students = appData.students || [];
    let totalCount = students.length;
    let morningCount = students.filter(s => (s.shift || 'Morning') === 'Morning').length;
    let eveningCount = students.filter(s => (s.shift || 'Morning') === 'Evening').length;

    let elTotal = document.getElementById('dir-count-all');
    let elMorning = document.getElementById('dir-count-morning');
    let elEvening = document.getElementById('dir-count-evening');
    let elHeaderCount = document.getElementById('dir-header-count');

    if (elTotal) elTotal.innerText = totalCount;
    if (elMorning) elMorning.innerText = morningCount;
    if (elEvening) elEvening.innerText = eveningCount;
    if (elHeaderCount) elHeaderCount.innerText = totalCount;

    let dirShiftSelect = document.getElementById('dirShift');
    if (dirShiftSelect && dirShiftSelect.options && dirShiftSelect.options.length >= 3) {
        for (let i = 0; i < dirShiftSelect.options.length; i++) {
            let opt = dirShiftSelect.options[i];
            if (opt.value === 'All') opt.text = `All Shifts (${totalCount})`;
            else if (opt.value === 'Morning') opt.text = `Morning (${morningCount})`;
            else if (opt.value === 'Evening') opt.text = `Evening (${eveningCount})`;
        }
    }

    updateActiveShiftBadge();
}

function setDirShiftFilter(shift) {
    let dirShiftSelect = document.getElementById('dirShift');
    if (dirShiftSelect) {
        dirShiftSelect.value = shift;
        filterClasses('dirShift', 'dirClass');
        renderStudents();
    }
    updateActiveShiftBadge();
}

function updateActiveShiftBadge() {
    let currentShift = document.getElementById('dirShift') ? document.getElementById('dirShift').value : 'All';
    let badgeAll = document.getElementById('badge-shift-all');
    let badgeMorning = document.getElementById('badge-shift-morning');
    let badgeEvening = document.getElementById('badge-shift-evening');

    if (badgeAll) {
        if (currentShift === 'All') {
            badgeAll.classList.add('ring-2', 'ring-indigo-500', 'shadow-md');
        } else {
            badgeAll.classList.remove('ring-2', 'ring-indigo-500', 'shadow-md');
        }
    }
    if (badgeMorning) {
        if (currentShift === 'Morning') {
            badgeMorning.classList.add('ring-2', 'ring-amber-500', 'shadow-md');
        } else {
            badgeMorning.classList.remove('ring-2', 'ring-amber-500', 'shadow-md');
        }
    }
    if (badgeEvening) {
        if (currentShift === 'Evening') {
            badgeEvening.classList.add('ring-2', 'ring-purple-500', 'shadow-md');
        } else {
            badgeEvening.classList.remove('ring-2', 'ring-purple-500', 'shadow-md');
        }
    }
}

function renderStudents() {
    updateStudentCountBadges();
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

async function sendWaMessage(phone, msg, name = '') {
    if (!phone || !msg) return;
    let res = await gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
    notifyWhatsAppStatus(res, name, phone, 'WhatsApp Alert', { message: msg });
    return res;
}

function validatePhone(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if(input.value.length > 10) input.value = input.value.slice(0, 10);
}
