// ==========================================
        // YAHAN APNA NAYA WEB APP URL DAALO
        // ==========================================
        const API_URL = 'https://script.google.com/macros/s/AKfycbydSEiXiVsLEzAg75t_hZMOcR4-VoUCokYRPO-ceXmQmH2mT0t_XepxdApN6z3kUXHdOA/exec';

        var appData = { students: [], payments: [], attendance: [], feeSettings: {}, waSettings: { instanceId: '', token: '' }, paidCount: 0, autopilotEnabled: true };
        
        function getTargetFeeMonth() {
            let now = new Date();
            if (now.getDate() <= 10) {
                now.setMonth(now.getMonth() - 1);
            }
            return now.toLocaleString('default', { month: 'long' });
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

        // FIXED API CALL ENGINE (No CORS blocks anymore)
        async function gasApi(action, payload = null) {
            try {
                let options = { method: "GET" };
                if (payload) {
                    options = {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({ action: action, data: payload })
                    };
                }
                let url = API_URL + "?action=" + action;
                const response = await fetch(url, options);
                return await response.json();
            } catch(e) { console.error("API Error:", e); return null; }
        }

        document.addEventListener('DOMContentLoaded', function() {
            setInterval(updateClock, 1000); updateClock();
            document.getElementById('feeMonth').value = currentMonthName;
            document.getElementById('attDate').valueAsDate = new Date();
            document.getElementById('feeDate').valueAsDate = new Date();
            document.getElementById('stuDate').valueAsDate = new Date();

            const cachedData = localStorage.getItem('vsehData');
            if(cachedData) {
                appData = JSON.parse(cachedData);
                document.getElementById('globalLoader').style.display = 'none';
                syncUIPanels();
            }

            gasApi('getAppData').then(function(res) {
                clearTimeout(window.loadTimer);
                if(res && res.status === 'success') { 
                    // Fix Attendance Grouping
                    if (res.attendance && Array.isArray(res.attendance)) {
                        let groupedAtt = {};
                        res.attendance.forEach(record => {
                            let cleanDate = record.date;
                            try {
                                let d = new Date(record.date);
                                if (!isNaN(d)) {
                                    let y = d.getFullYear();
                                    let m = ("0" + (d.getMonth() + 1)).slice(-2);
                                    let day = ("0" + d.getDate()).slice(-2);
                                    cleanDate = `${y}-${m}-${day}`;
                                }
                            } catch(e) {}
                            
                            let key = cleanDate + '|' + record.className;
                            if (!groupedAtt[key]) {
                                groupedAtt[key] = { date: cleanDate, class: record.className, records: {} };
                            }
                            groupedAtt[key].records[record.studentName] = record.status;
                        });
                        res.attendance = Object.values(groupedAtt);
                    }

                    appData = Object.assign(appData, res);
                    localStorage.setItem('vsehData', JSON.stringify(appData));
                    if(!cachedData) document.getElementById('globalLoader').style.display = 'none';
                    syncUIPanels();
                } else if(!cachedData) {
                    // Fallback empty UI init if server fails
                    document.getElementById('globalLoader').style.display = 'none';
                    syncUIPanels();
                }
            });
            
            // Dummy initialization if no data loads
            window.loadTimer = setTimeout(() => {
                document.getElementById('globalLoader').style.display = 'none';
                syncUIPanels();
            }, 3000);
        });

        function syncUIPanels() {
            initSettingsUI(); 
            updateDashboard(); 
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

        function sendSuccessMsg(name, phone, amt, mnth, mode) {
            var msg = `Payment Successful! 🎉\n\nWe received your payment of *₹${amt}* via *${mode}* for *${mnth.toUpperCase()}* for *${name.toUpperCase()}*.\n\nThank you! ✨\n\n- VIJAY SIR EDUCATION HUB`;
            // DIRECT BACKGROUND CALL (No Window.open)
            gasApi('stealthWhatsAppTrigger', { phone: phone, message: msg });
            showToast("SILENT RECEIPT DISPATCHED");
        }

        function sendSoftReminder(index, isAuto = false) {
            let hour = new Date().getHours();
            if (hour < 9 || hour >= 20) {
                if (!isAuto) alert("AUTOMATED ALERTS PAUSED: Messages can only be sent between 9:00 AM and 8:00 PM.");
                return;
            }
            
            let s = appData.students[index];
            let fee = s.fee || 500;
            var msg = `Greetings! 🌟\n\nHope *${s.name.toUpperCase()}* is doing well.\n\nThis is a gentle reminder regarding the monthly fee of *₹${fee}* for *${targetFeeMonth.toUpperCase()}*. Kindly process it when convenient.\n\nWarm Regards,\nVIJAY SIR EDUCATION HUB`;
            
            gasApi('stealthWhatsAppTrigger', { phone: s.phone, message: msg });
            
            if (!s.reminderHistory) s.reminderHistory = [];
            let now = new Date();
            let timeStr = now.toLocaleDateString('en-GB') + " " + now.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'});
            s.reminderHistory.push(timeStr);
            
            localStorage.setItem('vsehData', JSON.stringify(appData));
            if (!isAuto) {
                renderDefaulters();
                showToast("SILENT REMINDER DISPATCHED");
            }
        }

        function runAiBriefingModels() {
            let activeStudents = appData.students.length;
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
            
            if(id === 'dashboard') { updateDashboard(); renderDefaulters(); renderPaidStudents(); }
            if(id === 'paid-students') { renderPaidStudents(); }
            if(id === 'attendance') { document.getElementById('attDate').valueAsDate = new Date(); updateClassStatusIndicator(); loadAttendanceStudents(); }
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
            document.getElementById('dash-all').innerText = appData.students.length;
            
            let uniquePaid = new Set();
            var amt = 0;
            
            for(var i=0; i<appData.payments.length; i++) {
                let p = appData.payments[i];
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
            if(appData.payments.length === 0) { list.innerHTML = '<div class="glass-panel p-6 rounded-24 text-center"><p class="text-10 font-black text-gray-400 uppercase tracking-widest">NO TRANSACTIONS YET</p></div>'; return; }
            
            var recent = appData.payments.slice().reverse().slice(0, 5);
            for(var k=0; k<recent.length; k++) {
                var p = recent[k];
                var pDateShow = p.date;
                let d = new Date(p.date);
                if (!isNaN(d)) pDateShow = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
                
                list.innerHTML += `<div class="glass-panel p-4 rounded-24 mb-3 flex justify-between items-center"><div><p class="font-black text-gray-800 text-xs force-uppercase truncate w-32">${p.studentName}</p><p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${p.className} • ${p.month.toUpperCase()}</p></div><div class="text-right"><p class="font-black text-indigo-600 text-sm">₹${p.amount}</p><p class="text-8 font-bold text-gray-400 force-uppercase mt-0.5 tracking-widest">${p.mode||'CASH'} • ${pDateShow}</p></div></div>`;
            }
        }

        function loadAttendanceStudents() {
            var cls = document.getElementById('attClass').value;
            var dateStr = document.getElementById('attDate').value;
            var list = document.getElementById('attendance-list');
            list.innerHTML = '';
            
            if(!cls) { list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">SELECT A CLASS TO BEGIN</p>'; return; }
            if(!dateStr) { list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">SELECT DATE</p>'; return; }
            
            var filtered = appData.students.filter(s => s.class === cls);
            if(filtered.length === 0) { list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">NO STUDENTS IN THIS CLASS</p>'; return; }
            
            let existingRecord = null;
            if (appData.attendance) {
                existingRecord = appData.attendance.find(a => a.date === dateStr && a.class === cls);
            }
            
            filtered.forEach(s => {
                let pSel = '';
                let aSel = '';
                if (existingRecord && existingRecord.records && existingRecord.records[s.name]) {
                    if (existingRecord.records[s.name] === 'Present') pSel = 'data-selected="Present"';
                    else if (existingRecord.records[s.name] === 'Absent') aSel = 'data-selected="Absent"';
                }
                
                list.innerHTML += `
                <div class="glass-panel p-3 rounded-2xl flex justify-between items-center mb-2" data-student-name="${s.name}">
                    <div>
                        <p class="font-black text-gray-800 text-xs force-uppercase">${s.name}</p>
                        <p class="text-8 font-bold text-gray-400 mt-0.5 tracking-widest">${s.phone}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="setAtt(this, 'Present')" ${pSel} class="att-btn px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-400 bg-gray-50 uppercase">P</button>
                        <button onclick="setAtt(this, 'Absent')" ${aSel} class="att-btn px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-400 bg-gray-50 uppercase">A</button>
                    </div>
                </div>`;
            });
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
            let date = document.getElementById('attDate').value;
            let indicator = document.getElementById('attStatusIndicator');
            if(!indicator) return;
            indicator.innerHTML = '';
            
            if(!date) return;
            
            let classes = Object.keys(appData.feeSettings);
            if(classes.length === 0) classes = [...new Set(appData.students.map(s => s.class))].filter(Boolean);
            
            classes.sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
            
            let html = '';
            classes.forEach(cls => {
                let isDone = appData.attendance && appData.attendance.find(a => a.date === date && a.class === cls);
                if (isDone) {
                    html += `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[9px] font-black uppercase"><i class="fas fa-check mr-1"></i> ${cls}</span>`;
                } else {
                    html += `<span class="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[9px] font-black uppercase"><i class="fas fa-clock mr-1"></i> ${cls}</span>`;
                }
            });
            indicator.innerHTML = html;
        }

        async function submitAttendance() {
            let date = document.getElementById('attDate').value;
            let cls = document.getElementById('attClass').value;
            if(!date || !cls) { showToast("SELECT CLASS & DATE"); return; }
            
            if(!appData.attendance) appData.attendance = [];
            
            let records = {};
            let recordsArray = [];
            let absentMessages = [];
            let container = document.getElementById('attendance-list');
            let rows = container.children;
            for(let i=0; i<rows.length; i++) {
                let name = rows[i].getAttribute('data-student-name');
                if(!name) continue;
                let selectedBtn = rows[i].querySelector('.att-btn[data-selected]');
                records[name] = selectedBtn ? selectedBtn.getAttribute('data-selected') : 'Unmarked';
                
                let targetStudent = appData.students.find(s => s.name === name && s.class === cls);
                if (!targetStudent) targetStudent = appData.students.find(s => s.name === name);
                
                if (records[name] !== 'Unmarked') {
                    recordsArray.push({
                        id: generateId('ATT'),
                        studentId: targetStudent ? (targetStudent.id || '') : '',
                        studentName: name,
                        class: cls,
                        date: date,
                        month: currentMonthName,
                        status: records[name]
                    });
                }
                
                if (records[name] === 'Absent') {
                    let wasAlreadyAbsent = false;
                    let existingRecord = appData.attendance.find(a => a.date === date && a.class === cls);
                    if (existingRecord && existingRecord.records && existingRecord.records[name] === 'Absent') {
                        wasAlreadyAbsent = true;
                    }
                    
                    if (!wasAlreadyAbsent && targetStudent && targetStudent.phone) {
                        var formattedDate = date.split('-').reverse().join('/');
                        var msg = `Attendance Alert ⚠️\n\nDear Parent, your child *${name.toUpperCase()}* is marked *ABSENT* today (${formattedDate}).\n\nPlease ensure they attend regularly.\n\nWarm Regards,\nVIJAY SIR EDUCATION HUB`;
                        absentMessages.push({ phone: targetStudent.phone, message: msg });
                    }
                }
            }
            
            appData.attendance = appData.attendance.filter(a => !(a.date === date && a.class === cls));
            appData.attendance.push({ date: date, class: cls, records: records, timestamp: new Date().getTime() });
            
            if(recordsArray.length > 0) {
                gasApi('saveAttendanceBatch', recordsArray);
            }
            
            localStorage.setItem('vsehData', JSON.stringify(appData));
            showToast(`ATTENDANCE SAVED FOR ${cls}`);
            updateClassStatusIndicator();
            
            for(let msgData of absentMessages) {
                if (appData.waSettings && appData.waSettings.instanceId && appData.waSettings.token) {
                    let waUrl = `https://api.ultramsg.com/${appData.waSettings.instanceId}/messages/chat`;
                    let waBody = new URLSearchParams({
                        token: appData.waSettings.token,
                        to: "+91" + msgData.phone,
                        body: msgData.message
                    });
                    try {
                        await fetch(waUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: waBody.toString(),
                            mode: 'no-cors'
                        });
                    } catch(e) {}
                } else {
                    await gasApi('stealthWhatsAppTrigger', msgData);
                }
                await new Promise(r => setTimeout(r, 800));
            }
        }

        function triggerVoiceAttendance() {
            showToast("AI AUDIO LISTENING...");
        }

        async function sendAiCommand(cmd) {
            if (!cmd) return;
            let history = document.getElementById('ai-chat-history');
            history.innerHTML += `
            <div class="flex justify-end mb-4">
                <div class="bg-purple-600 text-white p-3 rounded-24 rounded-tr-none shadow-md max-w-[80%]">
                    <p class="text-xs font-bold">${cmd}</p>
                </div>
            </div>`;
            document.getElementById('ai-input').value = '';
            
            let typingId = 'typing-' + Date.now();
            history.innerHTML += `
            <div id="${typingId}" class="flex justify-start mb-4">
                <div class="glass-panel p-3 rounded-24 rounded-tl-none border-l-4 border-purple-500 shadow-sm max-w-[90%]">
                    <p class="text-xs font-bold text-gray-400 italic animate-pulse">Processing...</p>
                </div>
            </div>`;
            history.scrollTop = history.scrollHeight;

            try {
                let res = await gasApi('processAiCommand', { 
                    prompt: cmd, 
                    context: { students: appData.students, paidCount: appData.paidCount } 
                });
                
                let el = document.getElementById(typingId);
                if (el) el.remove();
                
                let reply = "System Error: Unable to reach AI Core.";
                let rawReply = "";
                if (res && res.status === 'success' && res.result && res.result.message) {
                    rawReply = res.result.message;
                    reply = rawReply.replace(/\n/g, '<br>');
                } else if (res && res.message) {
                    reply = "Error: " + res.message;
                }
                
                // Parse AI Actions
                let cmdMatch = rawReply.match(/<CMD>(.*?)<\/CMD>/);
                if (cmdMatch) {
                    let actions = cmdMatch[1].split('|');
                    if (actions[0] === 'MARK_ATTENDANCE') {
                        let targetClass = actions[1].trim();
                        let targetStatus = actions[2].trim();
                        
                        document.getElementById('attClass').value = targetClass;
                        loadAttendanceStudents();
                        
                        setTimeout(() => {
                            let container = document.getElementById('attendance-list');
                            let rows = container.children;
                            let markedCount = 0;
                            for(let i=0; i<rows.length; i++) {
                                let btns = rows[i].querySelectorAll('.att-btn');
                                btns.forEach(b => b.removeAttribute('data-selected'));
                                let btnToClick = Array.from(btns).find(b => b.innerText.trim() === (targetStatus.toLowerCase() === 'present' ? 'P' : 'A'));
                                if (btnToClick) {
                                    btnToClick.setAttribute('data-selected', targetStatus);
                                    markedCount++;
                                }
                            }
                            if (markedCount > 0) submitAttendance();
                        }, 500);
                        
                        reply = reply.replace(cmdMatch[0], '').trim();
                        if (reply === "") reply = `Successfully marked ${targetStatus} for class ${targetClass}.`;
                    }
                }

                history.innerHTML += `
                <div class="flex justify-start mb-4">
                    <div class="glass-panel p-4 rounded-24 rounded-tl-none border-l-4 border-purple-500 shadow-sm max-w-[90%]">
                        <p class="text-xs font-bold text-gray-700 dark:text-gray-200 leading-relaxed">${reply}</p>
                    </div>
                </div>`;
            } catch(e) {
                let el = document.getElementById(typingId);
                if (el) el.remove();
                history.innerHTML += `
                <div class="flex justify-start mb-4">
                    <div class="glass-panel p-4 rounded-24 rounded-tl-none border-l-4 border-red-500 shadow-sm max-w-[90%]">
                        <p class="text-xs font-bold text-red-500">Connection failed.</p>
                    </div>
                </div>`;
            }
            history.scrollTop = history.scrollHeight;
        }

        function simulateAudioInput() {
            showToast("VOICE INPUT TRIGGERED");
        }

        function toggleAccordion(id) {
            let el = document.getElementById(id);
            let icon = document.getElementById(id + '-icon');
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                icon.style.transform = 'rotate(90deg)';
            } else {
                el.classList.add('hidden');
                icon.style.transform = 'rotate(0deg)';
            }
        }

        function renderStudents() {
            let list = document.getElementById('students-list');
            let search = document.getElementById('searchInput').value.toLowerCase();
            list.innerHTML = '';
            
            let mapped = appData.students.map((s, idx) => ({...s, originalIndex: idx}));
            let filtered = mapped.filter(s => s.name.toLowerCase().includes(search) || s.phone.includes(search));
            
            if(filtered.length === 0) { list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">NO STUDENTS FOUND</p>'; return; }
            
            let grouped = {};
            filtered.forEach(s => {
                let cls = s.class || 'Unassigned';
                if(!grouped[cls]) grouped[cls] = [];
                grouped[cls].push(s);
            });
            
            let classes = Object.keys(grouped).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
            
            classes.forEach((cls, i) => {
                let clsId = 'cls-acc-' + i;
                let studentsHTML = '';
                
                grouped[cls].forEach(s => {
                    studentsHTML += `
                    <div class="bg-white p-4 rounded-24 flex justify-between items-center cursor-pointer mb-2 shadow-sm border border-gray-50 active:scale-95 transition" onclick="editStudent(${s.originalIndex})">
                        <div>
                            <p class="font-black text-gray-800 text-sm force-uppercase">${s.name}</p>
                            <p class="text-[10px] font-bold text-gray-400 mt-1 tracking-widest">Fee: ₹${s.fee || 500} • ${s.phone}</p>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                            <i class="fas fa-chevron-right text-[10px]"></i>
                        </div>
                    </div>`;
                });
                
                list.innerHTML += `
                <div class="glass-panel rounded-32 mb-4 overflow-hidden shadow-sm">
                    <div class="p-4 flex justify-between items-center cursor-pointer bg-white bg-opacity-40 hover:bg-opacity-80 transition active:scale-[0.98]" onclick="toggleAccordion('${clsId}')">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200">
                                <i class="fas fa-layer-group"></i>
                            </div>
                            <div>
                                <h3 class="font-black text-gray-800 text-sm uppercase tracking-wider">CLASS ${cls}</h3>
                                <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest">${grouped[cls].length} STUDENTS</p>
                            </div>
                        </div>
                        <div class="w-8 h-8 flex items-center justify-center text-gray-400 transition-transform duration-300" id="${clsId}-icon" style="transform: rotate(${search !== '' ? '90deg' : '0deg'});">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                    <div id="${clsId}" class="p-3 bg-gray-50 bg-opacity-50 transition-all ${search !== '' ? '' : 'hidden'}">
                        ${studentsHTML}
                    </div>
                </div>`;
            });
        }

        function renderDefaulters() {
            let list = document.getElementById('defaulters-list');
            list.innerHTML = '';
            
            let defaulters = [];
            let now = new Date();
            
            appData.students.forEach((s, index) => {
                let hasPaid = appData.payments.some(p => p.studentName === s.name && p.className === s.class && p.month === targetFeeMonth && new Date(p.date).getFullYear() === now.getFullYear());
                
                if (!hasPaid) {
                    let joinDate = new Date(s.date);
                    if (!isNaN(joinDate)) {
                        let diffDays = Math.ceil(Math.abs(now - joinDate) / (1000 * 60 * 60 * 24)); 
                        if (diffDays >= 30) {
                            defaulters.push({ student: s, index: index });
                        }
                    }
                }
            });
            
            if(defaulters.length === 0) { list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">NO DEFAULTERS</p>'; return; }
            
            let count = 0;
            defaulters.forEach(def => {
                let s = def.student;
                let index = def.index;
                
                let hour = now.getHours();
                if (appData.autopilotEnabled && hour >= 9 && hour < 20) {
                    let lastSentTime = 0;
                    if (s.reminderHistory && s.reminderHistory.length > 0) {
                        let lastStr = s.reminderHistory[s.reminderHistory.length - 1];
                        let parts = lastStr.split(' ');
                        if (parts.length === 2) {
                            let dateParts = parts[0].split('/');
                            if (dateParts.length === 3) {
                                lastSentTime = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]).getTime();
                            }
                        }
                    }
                    
                    let daysSinceLastReminded = (now.getTime() - lastSentTime) / (1000 * 60 * 60 * 24);
                    if (daysSinceLastReminded > 7) {
                        setTimeout(() => { sendSoftReminder(index, true); }, 1500 * count);
                    }
                }

                if (count >= 3) return;
                count++;
                
                let reminderHTML = '';
                if(s.reminderHistory && s.reminderHistory.length > 0) {
                    let lastSent = s.reminderHistory[s.reminderHistory.length - 1];
                    reminderHTML = `
                    <div class="text-right flex flex-col items-end">
                        <span class="text-[8px] font-bold text-gray-400 mb-1 leading-tight">LAST SENT:<br>${lastSent} (${s.reminderHistory.length}x)</span>
                        <button onclick="sendSoftReminder(${index})" class="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm border border-gray-200 active:scale-95 transition">RESEND</button>
                    </div>`;
                } else {
                    reminderHTML = `<button onclick="sendSoftReminder(${index})" class="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-sm active:scale-95 transition">REMIND</button>`;
                }
                
                list.innerHTML += `
                <div class="bg-white border-l-4 border-red-500 p-3 rounded-24 shadow-sm flex justify-between items-center mb-3">
                    <div>
                        <p class="font-black text-gray-800 text-sm force-uppercase">${s.name}</p>
                        <p class="text-9 font-bold text-gray-400 mt-1 tracking-widest">${s.class} • Pending ${targetFeeMonth}</p>
                    </div>
                    ${reminderHTML}
                </div>`;
            });
        }

        function renderPaidStudents() {
            let list = document.getElementById('paid-students-list');
            list.innerHTML = '';
            
            let paidStudents = [];
            let now = new Date();
            
            appData.students.forEach((s, index) => {
                let hasPaid = appData.payments.some(p => p.studentName === s.name && p.className === s.class && p.month === targetFeeMonth && new Date(p.date).getFullYear() === now.getFullYear());
                
                if (hasPaid) {
                    paidStudents.push({ student: s, index: index });
                }
            });
            
            if(paidStudents.length === 0) { list.innerHTML = '<p class="text-center text-gray-400 text-xs font-bold mt-10 uppercase tracking-widest">NO FEES COLLECTED THIS MONTH YET</p>'; return; }
            
            paidStudents.forEach(paid => {
                let s = paid.student;
                list.innerHTML += `
                <div class="bg-white border-l-4 border-green-500 p-3 rounded-24 shadow-sm flex justify-between items-center mb-3">
                    <div>
                        <p class="font-black text-gray-800 text-sm force-uppercase">${s.name}</p>
                        <p class="text-9 font-bold text-gray-400 mt-1 tracking-widest">${s.class} • Paid ${targetFeeMonth}</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500"><i class="fas fa-check"></i></div>
                </div>`;
            });
        }

        function generateStudentsPDF() { 
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                doc.setFontSize(16);
                doc.text("VIJAY SIR EDUCATION HUB - STUDENTS", 14, 22);
                
                let sorted = [...appData.students].sort((a, b) => (parseInt(a.class) || 0) - (parseInt(b.class) || 0));
                
                let bodyData = sorted.map(s => [
                    s.name.toUpperCase(), 
                    s.class, 
                    s.phone, 
                    s.gender, 
                    s.fee
                ]);

                doc.autoTable({
                    startY: 30,
                    head: [['Name', 'Class', 'Phone', 'Gender', 'Fee (Rs)']],
                    body: bodyData,
                    theme: 'grid',
                    headStyles: { fillColor: [99, 102, 241] }
                });
                
                doc.save('VSEH_Students.pdf');
                showToast("PDF DOWNLOADED");
            } catch(e) {
                console.error(e);
                alert("PDF Generation Failed.");
            }
        }
        function openModal() {
            document.getElementById('addModal').classList.remove('hidden');
            setTimeout(() => { document.getElementById('modalContent').classList.remove('translate-y-full'); }, 10);
            document.getElementById('addForm').reset();
            document.getElementById('stuDate').valueAsDate = new Date();
            document.getElementById('modalTitle').innerText = 'Registration';
            document.getElementById('deleteBox').classList.add('hidden');
            document.getElementById('stuRowIndex').value = '';
        }

        function closeModal() {
            document.getElementById('modalContent').classList.add('translate-y-full');
            setTimeout(() => { document.getElementById('addModal').classList.add('hidden'); }, 300);
        }

        function editStudent(index) {
            let s = appData.students[index];
            openModal();
            document.getElementById('modalTitle').innerText = 'Edit Profile';
            document.getElementById('stuName').value = s.name;
            document.getElementById('stuGender').value = s.gender;
            document.getElementById('stuClass').value = s.class;
            document.getElementById('stuPhone').value = s.phone;
            document.getElementById('stuFee').value = s.fee;
            document.getElementById('stuDate').value = s.date;
            
            document.getElementById('stuRowIndex').value = index;
            document.getElementById('stuId').value = s.id || '';
            document.getElementById('deleteBox').classList.remove('hidden');
            
            delLocked = true;
            document.getElementById('del-lock-icon').className = 'fas fa-lock';
            document.getElementById('btn-actual-del').disabled = true;
            document.getElementById('btn-actual-del').classList.add('opacity-40');
        }

        function toggleModalLock() {}

        function saveStudentToServer(e) {
            e.preventDefault();
            let name = document.getElementById('stuName').value;
            let phone = document.getElementById('stuPhone').value;
            let cls = document.getElementById('stuClass').value;
            let gender = document.getElementById('stuGender').value;
            let fee = document.getElementById('stuFee').value;
            let date = document.getElementById('stuDate').value;
            let idx = document.getElementById('stuRowIndex').value;
            let currentId = document.getElementById('stuId').value;
            if (!currentId) currentId = generateId('STU');
            
            let studentData = { id: currentId, name, phone, class: cls, gender, fee, date };
            
            if (idx === '') {
                appData.students.push(studentData);
                studentData.isEdit = false;
                showToast("STUDENT ADDED");
            } else {
                appData.students[parseInt(idx)] = studentData;
                studentData.isEdit = true;
                showToast("STUDENT UPDATED");
            }
            
            gasApi('saveStudent', studentData);
            
            closeModal();
            renderStudents();
            updateDashboard();
            localStorage.setItem('vsehData', JSON.stringify(appData));
        }

        function processFee(e) {
            e.preventDefault();
            let amount = document.getElementById('feeAmount').value;
            let mode = document.getElementById('feeMode').value;
            if(!mode) { alert('Please select a payment mode.'); return; }
            let name = document.getElementById('feeStudentSearch').value;
            let mnth = document.getElementById('feeMonth').value;
            let cls = document.getElementById('feeClass').value || 'Class';
            let targetStudent = appData.students.find(s => s.name === name && s.class === cls);
            if (!targetStudent) targetStudent = appData.students.find(s => s.name === name);
            let phone = targetStudent ? targetStudent.phone : '';

            let paymentData = {
                id: generateId('TXN'),
                studentId: targetStudent ? (targetStudent.id || '') : '',
                studentName: name, 
                amount, 
                mode, 
                month: mnth, 
                date: document.getElementById('feeDate').value, 
                className: cls,
                phone: phone
            };

            appData.payments.push(paymentData);
            appData.paidCount++;
            
            gasApi('savePayment', paymentData);
            
            sendSuccessMsg(name, phone, amount, mnth, mode);
            document.getElementById('feeForm').reset();
            document.getElementById('feeDate').valueAsDate = new Date();
            document.getElementById('feeMonth').value = currentMonthName;
            document.getElementById('feeRemainingBox').classList.add('hidden');
            currentStudentExpectedFee = 0;
            setMode('');
            updateDashboard();
            localStorage.setItem('vsehData', JSON.stringify(appData));
        }

        function populateFeeStudents() {
            filterFeeStudents();
        }
        
        function filterFeeStudents() {
            let search = document.getElementById('feeStudentSearch').value.toLowerCase();
            let clsFilter = document.getElementById('feeClass').value;
            let listEl = document.getElementById('feeStudentList');
            
            if (search.length < 1 && !clsFilter) {
                listEl.classList.add('hidden');
                return;
            }
            
            let filtered = appData.students.filter(s => {
                let matchClass = clsFilter ? s.class === clsFilter : true;
                let matchName = s.name.toLowerCase().includes(search) || s.phone.includes(search);
                return matchClass && matchName;
            });
            
            listEl.innerHTML = '';
            if (filtered.length > 0) {
                filtered.forEach(s => {
                    listEl.innerHTML += `
                    <div class="p-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer text-xs font-black force-uppercase" onclick="selectFeeStudent('${s.name}', '${s.class}')">
                        ${s.name} - ${s.class} (${s.phone})
                    </div>`;
                });
                listEl.classList.remove('hidden');
            } else {
                listEl.innerHTML = '<div class="p-2 text-xs font-bold text-gray-400">No student found</div>';
                listEl.classList.remove('hidden');
            }
        }
        function selectFeeStudent(name, cls) {
            document.getElementById('feeStudentSearch').value = name;
            document.getElementById('feeClass').value = cls;
            document.getElementById('feeStudentList').classList.add('hidden');
            
            let targetStudent = appData.students.find(s => s.name === name && s.class === cls);
            if (!targetStudent) targetStudent = appData.students.find(s => s.name === name);
            if (targetStudent) {
                currentStudentExpectedFee = parseInt(targetStudent.fee) || 0;
                document.getElementById('feeAmount').value = currentStudentExpectedFee;
                calculateRemaining();
            }
        }

        function calculateRemaining() {
            let entered = parseInt(document.getElementById('feeAmount').value) || 0;
            let remainingBox = document.getElementById('feeRemainingBox');
            let remainingText = document.getElementById('feeRemainingText');
            
            if (currentStudentExpectedFee > 0 && entered < currentStudentExpectedFee) {
                let diff = currentStudentExpectedFee - entered;
                remainingBox.classList.remove('hidden');
                remainingText.innerText = 'REMAINING: ₹' + diff;
            } else {
                remainingBox.classList.add('hidden');
            }
        }

        function setMode(mode) {
            document.getElementById('feeMode').value = mode;
            document.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('border-green-500', 'bg-green-50', 'text-green-600');
                b.classList.add('border-gray-200', 'bg-gray-50', 'text-gray-500');
            });
            if(mode) {
                let btn = document.getElementById(mode === 'CASH' ? 'mode-CASH' : 'mode-UPI');
                if(btn) {
                    btn.classList.remove('border-gray-200', 'bg-gray-50', 'text-gray-500');
                    btn.classList.add('border-green-500', 'bg-green-50', 'text-green-600');
                }
            }
        }

        function initSettingsUI() {
            let box = document.getElementById('dynamicClassesBox');
            box.innerHTML = '';
            for (let cls in appData.feeSettings) {
                box.insertAdjacentHTML('beforeend', `
                <div class="flex items-center space-x-2 mb-2 cls-row">
                    <input type="text" class="mobile-input cls-name flex-1" value="${cls}" ${clsLocked ? 'disabled' : ''}>
                    <input type="number" class="mobile-input cls-fee flex-1" value="${appData.feeSettings[cls]}" ${clsLocked ? 'disabled' : ''}>
                    <button type="button" onclick="this.parentElement.remove()" class="del-cls-btn w-12 shrink-0 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 h-12 active:scale-95 transition" ${clsLocked ? 'disabled style="opacity:0.3"' : ''}><i class="fas fa-trash"></i></button>
                </div>`);
            }
            if (appData.waSettings) {
                document.getElementById('waInstanceId').value = appData.waSettings.instanceId || '';
                document.getElementById('waToken').value = appData.waSettings.token || '';
            }
            initFeeClasses();
        }

        function initFeeClasses() {
            let classes = Object.keys(appData.feeSettings);
            if(classes.length === 0) classes = ['10th', '9th', '8th'];
            
            let selects = ['attClass', 'stuClass', 'feeClass'];
            selects.forEach(id => {
                let el = document.getElementById(id);
                if(!el) return;
                let oldVal = el.value;
                el.innerHTML = '<option value="">-- SELECT --</option>';
                classes.forEach(c => {
                    el.innerHTML += `<option value="${c}">${c}</option>`;
                });
                el.value = oldVal;
            });
        }

        function toggleSetLock() {
            setLocked = !setLocked;
            document.getElementById('set-lock-thumb').style.transform = setLocked ? 'translateX(0)' : 'translateX(100%)';
            document.getElementById('set-lock-btn').classList.toggle('bg-gray-300', setLocked);
            document.getElementById('set-lock-btn').classList.toggle('bg-green-500', !setLocked);
            document.getElementById('set-lock-label').innerText = setLocked ? 'LOCKED' : 'UNLOCKED';
            
            if (setLocked) {
                if (!clsLocked) toggleClsLock();
                if (!waLocked) toggleWaLock();
            }
        }

        function checkSaveBtnState() {
            document.getElementById('btn-save-set').disabled = (clsLocked && waLocked);
        }
        
        function toggleClsLock() {
            if (setLocked && clsLocked) { showToast("UNLOCK MASTER LOCK FIRST"); return; }
            clsLocked = !clsLocked;
            let icon = document.getElementById('cls-lock-icon');
            icon.className = clsLocked ? 'fas fa-lock text-xs' : 'fas fa-unlock text-xs';
            icon.parentElement.className = clsLocked ? 'w-7 h-7 bg-red-50 rounded-full flex items-center justify-center text-red-500 active:scale-90 transition shadow-inner' : 'w-7 h-7 bg-green-50 rounded-full flex items-center justify-center text-green-500 active:scale-90 transition shadow-inner';
            
            document.getElementById('btn-add-cls').disabled = clsLocked;
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
            icon.className = waLocked ? 'fas fa-lock text-xs' : 'fas fa-unlock text-xs';
            icon.parentElement.className = waLocked ? 'w-7 h-7 bg-red-50 rounded-full flex items-center justify-center text-red-500 active:scale-90 transition shadow-inner' : 'w-7 h-7 bg-green-50 rounded-full flex items-center justify-center text-green-500 active:scale-90 transition shadow-inner';
            
            document.querySelectorAll('.wa-setting').forEach(input => input.disabled = waLocked);
            checkSaveBtnState();
        }
        
        function saveSettings(e) {
            e.preventDefault();
            let rows = document.querySelectorAll('.cls-row');
            appData.feeSettings = {};
            rows.forEach(r => {
                let n = r.querySelector('.cls-name').value;
                let f = r.querySelector('.cls-fee').value;
                if (n && f) appData.feeSettings[n] = f;
            });
            appData.waSettings = {
                instanceId: document.getElementById('waInstanceId').value,
                token: document.getElementById('waToken').value
            };
            
            gasApi('saveAllSettings', { 
                feeSettings: appData.feeSettings, 
                waSettings: appData.waSettings 
            });
            
            showToast("SETTINGS SAVED");
            if (!setLocked) toggleSetLock();
            initFeeClasses();
            localStorage.setItem('vsehData', JSON.stringify(appData));
        }
        
        function addNewClassInput() {
            let box = document.getElementById('dynamicClassesBox');
            box.insertAdjacentHTML('beforeend', `
            <div class="flex items-center space-x-2 mb-2 cls-row">
                <input type="text" class="mobile-input cls-name flex-1" placeholder="Class Name">
                <input type="number" class="mobile-input cls-fee flex-1" placeholder="Default Fee">
                <button type="button" onclick="this.parentElement.remove()" class="del-cls-btn w-12 shrink-0 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 h-12 active:scale-95 transition"><i class="fas fa-trash"></i></button>
            </div>`);
        }

        function autoGuessGender() {
            // Placeholder logic for future AI guess
        }
        
        function autoFillSetupFee() {
            let cls = document.getElementById('stuClass').value;
            if (appData.feeSettings[cls]) {
                document.getElementById('stuFee').value = appData.feeSettings[cls];
            }
        }
        
        function validatePhone(el) {
            // HTML pattern handles this already
        }
        
        function toggleDelLock() {
            delLocked = !delLocked;
            document.getElementById('del-lock-icon').className = delLocked ? 'fas fa-lock' : 'fas fa-lock-open text-red-500';
            document.getElementById('btn-actual-del').disabled = delLocked;
            document.getElementById('btn-actual-del').classList.toggle('opacity-40', delLocked);
        }
        
        function confirmDeleteFromModal() {
            let idx = document.getElementById('stuRowIndex').value;
            if (idx !== '') {
                let targetId = appData.students[parseInt(idx)].id;
                if (targetId) {
                    gasApi('deleteStudent', { id: targetId });
                }
                
                appData.students.splice(parseInt(idx), 1);
                showToast("STUDENT DELETED");
                closeModal();
                renderStudents();
                updateDashboard();
                localStorage.setItem('vsehData', JSON.stringify(appData));
            }
        }
        
        function triggerPtmNoteGeneration() {
            showToast("GENERATING AI REPORT...");
        }
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
            });
        }