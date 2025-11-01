import"./modulepreload-polyfill-B5Qt9EMX.js";const i={mainContent:document.getElementById("main-content"),navLinks:document.querySelectorAll(".bottom-nav .nav-link"),profileModal:document.getElementById("studentMiniProfileModal"),profileName:document.getElementById("profile-name"),profileTR:document.getElementById("profile-tr"),profileGoal:document.getElementById("profile-goal"),profileSlot:document.getElementById("profile-slot"),profileRecent:document.getElementById("profile-recent"),profileAttendanceBtn:document.getElementById("profile-attendance-btn"),profileHistoryBtn:document.getElementById("profile-history-btn"),profileTestBtn:document.getElementById("profile-test-btn")};let B=null,g=[],p=[],f=null,I=null,T=null;function c(t,e){const a=t.querySelector(".btn-text")||t;if(e)t.disabled=!0,t.querySelector(".spinner")||t.insertAdjacentHTML("afterbegin",'<div class="spinner"></div>'),a.style.display="none";else{t.disabled=!1;const n=t.querySelector(".spinner");n&&n.remove(),a.style.display="inline"}}async function F(){try{const e=await(await fetch("/api/session-user",{credentials:"include"})).json();return!e.success||!e.user?(window.location.href="../Forbidden.html",null):(B=e.user,e.user)}catch(t){return console.error("Session validation failed:",t),window.location.href="../Forbidden.html",null}}async function P(t){try{const[e,a]=await Promise.all([fetch(`/api/verify-tr/${t}`),fetch(`/api/training-plans/${t}`)]),n=await e.json(),s=await a.json();if(!n.valid)throw new Error(n.message||"Invalid TR or membership expired");if(f=n.data,i.profileName.textContent=f.Name,i.profileTR.textContent=f.TR,i.profileGoal.textContent=f.Goal||"Not set",i.profileSlot.textContent=f.SlotName||"Not assigned",i.profileRecent.innerHTML="",s.success&&s.data.length>0)s.data.slice(0,2).forEach(l=>{const d=moment().diff(moment(l.LogDate),"days"),u=document.createElement("li");u.textContent=`${l.BodyParts} (${d} day${d===1?"":"s"} ago)`,i.profileRecent.appendChild(u)});else{const r=document.createElement("li");r.textContent="No recent workouts",i.profileRecent.appendChild(r)}new bootstrap.Modal(i.profileModal).show()}catch(e){Swal.fire("Error",e.message,"error")}}function L(){i.mainContent.innerHTML=`
        <div class="card fade-in">
            <h3 id="welcomeText">Welcome, ${B?.Username}! <br> <span>${B?.Branch} - ${B?.Gender==="Male"?"Talabat":"Talebaat"}</span></h3>
            <p style="text-align:center; font-size: 0.9rem; color: #6b7280;"><strong>Today's Date:</strong> <span>${new Date().toISOString().split("T")[0]}</span></p>
        </div>
        <div class="card" id="quick-stats">
            <p style="text-align:center;">Loading stats...</p> 
        </div>
        <div class="card" id="student-search-card">
            <h4>Student Search</h4>
            <div class="search-group">
                <select id="tr-input" class="form-control"></select>
                <button id="search-btn" class="btn"><span class="btn-text">Search</span></button>
            </div>
        </div> 
        <div class="card" id="daily-attendance-section">
            <div class="accordion-header" id="attendance-accordion-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <h4>Today's Attendance</h4>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="accordion-body hidden" id="attendance-accordion-body">
                <table id="dailyAttendanceTable">
                    <thead><tr><th>TR</th><th>Name</th><th>Status</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `,Promise.all([fetch("/api/daily-attendance").then(t=>t.json()),fetch("/api/active-sessions",{credentials:"include"}).then(t=>t.json())]).then(([t,e])=>{if(t.error)throw new Error(t.error);if(!e.success)throw new Error(e.error);p=t,g=e.data,$(p),U(p);const a=p.filter(n=>n.IsPresentToday==="Present").length;H(a,p.length,g.length)}).catch(t=>{console.error("Failed to load home data:",t),document.getElementById("dailyAttendanceTable").querySelector("tbody").innerHTML='<tr><td colspan="3" style="text-align:center; color: var(--error-text);">Could not load attendance.</td></tr>',document.getElementById("quick-stats").innerHTML='<p style="text-align:center; color: var(--error-text);">Could not load stats.</p>'}),V()}function H(t,e,a){document.getElementById("quick-stats").innerHTML=`
        <div class="row">
            <div class="col-6">
                <div class="card" id="active-stats-card" style="cursor: pointer;" title="Go to Check-out">
                    <p>Active: <br> <strong style="font-size: 1.2em;">${a}</strong> Live session${a!==1?"s":""}</p>
                </div>
            </div>
            <div class="col-6">
                <div class="card">
                    <p>Present Today: <br> ${t} out of  ${e} <strong style="font-size: 1.2em;">(${(t/e*100).toFixed(2)}%)</strong></p>
                </div>
            </div>
        </div>
    `}function D(){i.mainContent.innerHTML=`
            <div class="card fade-in">
                <h3>Active Sessions</h3>
                <table id="activeSessionsTable">
                    <thead><tr><th>TR</th><th>Name</th><th>Check-in</th><th>Action</th></tr></thead>
                    <tbody id="active-sessions-body"></tbody>
                </table>
            </div>
        `,O()}function x(t=null){i.mainContent.innerHTML=`
            <div class="card fade-in">
                <h3>Fitness Test</h3>
                <div class="form-group">
                    <label for="student-selector">Select Students (Max 5)</label>
                    <select id="student-selector" multiple></select>
                </div>
                <button id="addStudentsBtn" class="btn"><span class="btn-text">Add Students</span></button>
                <div id="testing-area"></div>
                <div id="submission-container" class="hidden">
                    <button id="submitAllTestsBtn" class="btn"><span class="btn-text">Submit All</span></button>
                </div>
            </div>
        `,W(t),G()}function A(){const t=document.body.classList.contains("dark-mode");i.mainContent.innerHTML=`
            <div class="card fade-in">
                <h3>Menu</h3>
                <div class="list-group">
                    <button type="button" class="list-group-item list-group-item-action">View Profile</button>
                    <button type="button" id="darkModeToggle" class="list-group-item list-group-item-action">
                        <i class="fas ${t?"fa-sun":"fa-moon"}"></i> 
                        Switch to ${t?"Light":"Dark"} Mode
                    </button>
                    <button type="button" id="logoutBtn" class="list-group-item list-group-item-action text-danger">
                        <i class="fas fa-sign-out-alt"></i> 
                        Logout
                    </button>
                </div>
            </div>
        `,X()}async function R(){const t=document.getElementById("quick-stats");t.innerHTML='<p style="text-align:center;">Loading stats...</p>';try{const[e,a]=await Promise.all([fetch("/api/daily-attendance"),fetch("/api/active-sessions",{credentials:"include"})]),n=await e.json(),s=await a.json();if(!e.ok)throw new Error(n.message||"Failed to load attendance");if(!s.success)throw new Error(s.error||"Failed to load sessions");p=n,g=s.data;const o=g.length,r=p.length,l=p.filter(d=>d.IsPresentToday==="Present").length;t.innerHTML=`
            <div class="row">
                <div class="col-6">
                    <div class="card" id="active-stats-card" style="cursor: pointer;" title="Go to Check-out">
                        <p>Active: ${o} Live session</p>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card">
                        <p>Attendance: ${l} / ${r}</p>
                    </div>
                </div>
            </div>
        `}catch(e){console.error("Failed to load quick stats:",e),t.innerHTML='<p style="text-align:center; color: var(--error-text);">Could not load stats.</p>'}}async function N(){const t=document.querySelector("#dailyAttendanceTable tbody");t.innerHTML='<tr><td colspan="3" style="text-align:center;">Loading attendance...</td></tr>';try{const e=await fetch("/api/daily-attendance"),a=await e.json();if(!e.ok)throw new Error(a.message||"Failed to load attendance");p=a,$(a)}catch(e){console.error("Failed to load daily attendance:",e),t.innerHTML='<tr><td colspan="3" style="text-align:center; color: var(--error-text);">Could not load attendance.</td></tr>'}}function $(t){const e=document.querySelector("#dailyAttendanceTable tbody");if(e.innerHTML="",!t.length){e.innerHTML='<tr><td colspan="3">No attendance records.</td></tr>';return}t.forEach(a=>{let n="";const s=a.IsPresentToday;switch(s){case"Present":n="background-color: var(--success-bg); color: var(--success-text);";break;case"On Leave":n="background-color: #fff3cd; color: #856404;";break;default:n="background-color: var(--error-bg); color: var(--error-text);";break}const o=`<tr><td>${a.TR}</td><td>${a.Name}</td><td style="${n}">${s}</td></tr>`;e.insertAdjacentHTML("beforeend",o)})}async function O(){const t=document.getElementById("active-sessions-body");if(t){t.innerHTML='<tr><td colspan="4" style="text-align:center;">Loading sessions...</td></tr>';try{const a=await(await fetch("/api/active-sessions",{credentials:"include"})).json();if(!a.success)throw new Error(a.error);g=a.data,q(a.data)}catch(e){console.error("Failed to load active sessions:",e),t.innerHTML='<tr><td colspan="4" style="text-align:center; color: var(--error-text);">Could not load active sessions.</td></tr>'}}}function q(t){const e=document.getElementById("active-sessions-body");if(e){if(e.innerHTML="",!t.length){e.innerHTML='<tr><td colspan="4">No active sessions.</td></tr>';return}t.forEach(a=>{const n=moment.utc(a.CreatedAt).tz("Asia/Kolkata").format("h:mm A"),s=document.createElement("tr");s.innerHTML=`<td>${a.TR}</td><td>${a.Name}</td><td>${n}</td>`;const o=document.createElement("td"),r=document.createElement("button");r.classList.add("btn"),r.innerHTML='<span class="btn-text">Check Out</span>',r.onclick=()=>j(a.TR,a.Name,a.CreatedAt,s,r),o.appendChild(r),s.appendChild(o),e.appendChild(s)})}}async function j(t,e,a,n,s){c(s,!0);try{const o=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({TR:t})}),r=await o.json();if(!o.ok)throw new Error(r.message);const l=moment.utc(a).tz("Asia/Kolkata"),d=moment().tz("Asia/Kolkata"),u=Math.round(d.diff(l,"minutes")),y=r.awardedXP||u*10,b=r.levelUpInfo?.levelledUp?`🏅 Earned ${y} XP and leveled up to Level ${r.levelUpInfo.newLevel}!`:`💪 Earned ${y} XP this session.`;await Swal.fire({title:"Checked Out!",html:`
                <strong>${e}</strong> completed a 
                <b>${u}-minute</b> workout.<br>
                ${b}
            `,icon:"success",timer:2500,showConfirmButton:!1}),n.classList.add("fade-in"),n.style.backgroundColor="var(--success-bg)",setTimeout(()=>n.remove(),1e3),g=g.filter(m=>m.TR!==t),q(g),document.getElementById("quick-stats")&&R()}catch(o){Swal.fire("Error",o.message,"error")}finally{c(s,!1)}}async function W(t=null){try{const a=await(await fetch("/api/students-list")).json();if(!Array.isArray(a))throw new Error("Invalid student list format");I=new Choices("#student-selector",{removeItemButton:!0,maxItemCount:5,placeholderValue:"Search by name or TR...",choices:a.map(n=>({value:String(n.value),label:n.label}))}),t&&I.setChoiceByValue(String(t))}catch(e){console.error("Failed to initialize student selector:",e),Swal.fire("Error","Failed to load student list.","error")}}async function U(t){try{if(!Array.isArray(t))throw new Error("Invalid student list format");T=new Choices("#tr-input",{removeItemButton:!0,maxItemCount:1,placeholderValue:"Search by name or TR...",choices:t.map(e=>({value:String(e.TR),label:`${e.Name} [${e.TR}]`}))})}catch(e){console.error("Failed to initialize search selector:",e),Swal.fire("Error","Failed to load student list for search.","error")}}function V(){const t=document.getElementById("tr-input"),e=document.getElementById("search-btn"),a=document.getElementById("quick-stats");a&&a.addEventListener("click",o=>{o.target.closest("#active-stats-card")&&document.querySelector('.nav-link[data-page="checkout"]').click()});const n=document.getElementById("attendance-accordion-header");n&&n.addEventListener("click",()=>{const o=document.getElementById("attendance-accordion-body"),r=n.querySelector("i");o.classList.toggle("hidden"),r.classList.toggle("fa-chevron-down"),r.classList.toggle("fa-chevron-up")});const s=_(async()=>{const o=T?T.getValue(!0):t.value.trim();if(o){c(e,!0);try{await P(o),T&&(T.clearInput(),p=[])}finally{c(e,!1)}}},300);t.addEventListener("change",async()=>{await s()}),e.addEventListener("click",s)}function G(){document.getElementById("addStudentsBtn").addEventListener("click",async()=>{const t=document.getElementById("addStudentsBtn");c(t,!0);try{const e=I.getValue(!0);if(!e.length){Swal.fire("No Selection","Select at least one student.","info");return}const a=await Promise.all(e.map(s=>fetch(`/api/testmaster/${s}`,{credentials:"include"}).then(o=>{if(!o.ok)throw new Error(`Failed to fetch data for TR ${s}`);return o.json()}))),n=document.getElementById("testing-area");n.innerHTML="",a.forEach(s=>{if(s.TR){const o=z(s);n.appendChild(o)}}),document.getElementById("submission-container").classList.remove("hidden")}catch{Swal.fire("Error","Failed to load student data.","error")}finally{c(t,!1)}}),document.getElementById("submitAllTestsBtn").addEventListener("click",async()=>{const t=document.getElementById("submitAllTestsBtn");c(t,!0);const e=document.querySelectorAll(".student-test-form"),a=[];let n=!0;for(const s of e){if(!s.checkValidity()){s.reportValidity(),n=!1;break}const o=Y(s);if(o)a.push(o);else{n=!1,Swal.fire("Calculation Error",`Could not calculate report for TR ${s.dataset.tr}. Check all inputs.`,"error");break}}if(!n){e.length>0&&Swal.fire("Error","Please fill all required fields for every student.","error"),c(t,!1);return}Swal.fire({title:"Confirm Submission",text:`You are about to submit ${a.length} fitness records. This action cannot be undone.`,icon:"warning",showCancelButton:!0,confirmButtonText:"Yes, Submit All",reverseButtons:!0}).then(async s=>{if(s.isConfirmed)try{const o=await fetch("/api/trainer-test-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}),r=await o.json();if(!o.ok)throw new Error(r.error||"An unknown error occurred.");Swal.fire("Success!",r.message,"success").then(()=>{location.reload()})}catch(o){Swal.fire("Submission Failed",o.message,"error")}finally{c(t,!1)}else c(t,!1)})})}function z(t){const e=document.createElement("div");return e.classList.add("accordion-item"),e.innerHTML=`
            <div class="accordion-header">${t.Name} (TR: ${t.TR})</div>
            <div class="accordion-body hidden">
                <form class="student-test-form" data-tr="${t.TR}" data-dob="${t.DOB||""}" data-gender="${t.Gender||""}">
                    <div class="row mb-3">
                        <div class="col"><label>Weight (kg)</label><input type="number" step="any" class="form-control" name="Weight" required></div>
                        <div class="col"><label>Height (cm)</label><input type="number" step="any" class="form-control" name="Height" required></div>
                        <div class="col"><label>Waist (cm)</label><input type="number" step="any" class="form-control" name="Waist" required></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col"><label>Hips (cm)</label><input type="number" step="any" class="form-control" name="Hips" required></div>
                        <div class="col"><label>Neck (cm)</label><input type="number" step="any" class="form-control" name="Neck" required></div>
                        <div class="col"><label>Push-ups (30 sec)</label><input type="number" class="form-control" name="PushUps" required></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col"><label>Sit-ups (30 sec)</label><input type="number" class="form-control" name="SitUps" required></div>
                        <div class="col"><label>Squats (30 sec)</label><input type="number" class="form-control" name="Squats" required></div>
                        <div class="col"><label>Sit and Reach</label><input type="number" step="any" class="form-control" name="SitReach" required></div>
                    </div>
                    <div class="row mb-3">
                        <div class="col"><label>Step-Up Pulse Rate</label><input type="number" class="form-control" name="PulseRate" required></div>
                    </div>
                </form>
            </div>
        `,e.querySelector(".accordion-header").addEventListener("click",()=>{e.querySelector(".accordion-body").classList.toggle("hidden")}),e}function Y(t){try{const e={},a=parseFloat(t.querySelector('[name="Weight"]').value),n=parseFloat(t.querySelector('[name="Height"]').value),s=parseFloat(t.querySelector('[name="Waist"]').value),o=parseFloat(t.querySelector('[name="Hips"]').value),r=parseFloat(t.querySelector('[name="Neck"]').value),l=parseFloat(t.querySelector('[name="PulseRate"]').value),d=parseInt(t.querySelector('[name="PushUps"]').value)||0,u=parseInt(t.querySelector('[name="SitUps"]').value)||0,y=parseInt(t.querySelector('[name="Squats"]').value)||0,b=parseFloat(t.querySelector('[name="SitReach"]').value)||0,m=t.dataset.gender?.toLowerCase();m||console.error(`Gender missing for TR ${t.dataset.tr}. Defaulting calculations.`);const v=t.dataset.dob;let h=18;if(v&&/^\d{4}-\d{2}-\d{2}$/.test(v)){const M=new Date(v),E=new Date;h=E.getFullYear()-M.getFullYear();const C=E.getMonth()-M.getMonth();(C<0||C===0&&E.getDate()<M.getDate())&&h--}else v&&console.warn(`Invalid DOB format for TR ${t.dataset.tr}: ${v}. Using default age 18.`);const k=n/100,w=a/(k*k);e.BMI=parseFloat(w.toFixed(1)),e.BMIStatus=w<18.5?"Underweight":w<24.9?"Normal weight":w<29.9?"Overweight":"Obese",s&&r&&n?m==="male"?e.BodyFat=parseFloat((495/(1.0324-.19077*Math.log10(s-r)+.15456*Math.log10(n))-450).toFixed(1)):m==="female"&&o?e.BodyFat=parseFloat((495/(1.29579-.35004*Math.log10(s+o-r)+.221*Math.log10(n))-450).toFixed(1)):(m==="female"&&!o&&console.warn(`Hips measurement missing for female student TR ${t.dataset.tr}. Cannot calculate Body Fat.`),e.BodyFat="N/A"):e.BodyFat="N/A",a&&n&&h?(m==="male"?e.BMR=Math.round(10*a+6.25*n-5*h+5):m==="female"?e.BMR=Math.round(10*a+6.25*n-5*h-161):e.BMR=Math.round(10*a+6.25*n-5*h-78),e.CalorieIntake=Math.round(e.BMR*1.55)):(e.BMR="N/A",e.CalorieIntake="N/A"),e.VO2Max=l?Math.round(15*(220-h)/l):"N/A";const S=Math.round(d/2+u/2+y/2+b+(e.VO2Max!=="N/A"?e.VO2Max/2:0));return e.Total=S,e.Grade=S>=80?"A+":S>=70?"A":S>=60?"B":S>=50?"C":"D",{TR:t.dataset.tr,Weight:a,Height:n,Waist:s,Hips:o,Neck:r,BMI:e.BMI,BMIStatus:e.BMIStatus,BodyFat:e.BodyFat,BMR:e.BMR,CalorieIntake:e.CalorieIntake,VO2Max:e.VO2Max,Total:e.Total,Grade:e.Grade,PushUps:d,SitUps:u,Squats:y,SitReach:b,PulseRate:l}}catch(e){return console.error(`Calculation failed for TR ${t.dataset.tr}`,e),Swal.fire("Calculation Error",`Could not calculate results for TR ${t.dataset.tr}. Please check all inputs, especially DOB format if entered. Error: ${e.message}`,"error"),null}}async function J(t,e){const n=["Cardio","Chest","Back","Shoulders","Biceps","Triceps","Legs","Core"].map(o=>`<div class="body-part-chip" data-part="${o}">${o}</div>`).join(""),s=await Swal.fire({title:`Workout for ${e}`,html:`
                <p>Select body parts to train today (max 3).</p>
                <div class="body-parts-container">${n}</div>
                <div id="max-selection-warning"></div>
            `,confirmButtonText:"Log Attendance & Workout",showCancelButton:!0,focusConfirm:!1,width:"600px",didOpen:()=>{const o=document.querySelector(".body-parts-container"),r=o.querySelectorAll(".body-part-chip"),l=document.getElementById("max-selection-warning");r.forEach(d=>{d.addEventListener("click",()=>{const u=o.querySelectorAll(".selected").length;d.classList.contains("selected")?(d.classList.remove("selected"),l.textContent=""):u<3?(d.classList.add("selected"),l.textContent=""):(l.textContent="Maximum of 3 parts can be selected.",setTimeout(()=>{l.textContent=""},2e3))})})},preConfirm:()=>{const o=document.querySelectorAll(".body-part-chip.selected");return Array.from(o).map(r=>r.dataset.part)}});if(s.isConfirmed){const o=s.value;Swal.fire({title:"Submitting...",text:"Please wait while we log the session.",allowOutsideClick:!1,didOpen:()=>Swal.showLoading()});try{const r=new Date,l=new Date(r),d=l.getDay(),u=l.getDate()-d+(d===0?-6:1);l.setDate(u);const y=new Date(l);y.setDate(l.getDate()+6);const b=await fetch("/api/get-or-create-week",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({WeekStartDate:l.toISOString().split("T")[0],WeekEndDate:y.toISOString().split("T")[0]})}),m=await b.json();if(!b.ok)throw new Error(m.message||"Failed to create week");const v=m.WeekID,h=await fetch("/api/attendance-manual",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({TR:t,WeekID:v,IsPresent:1})}),k=await h.json();if(!h.ok)throw new Error(k.error||"Attendance submission failed");if(o.length>0){const w=await fetch("/api/log-training-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({TR:t,BodyParts:o})}),S=await w.json();if(!w.ok)throw new Error(S.message||"Plan logging failed")}Swal.fire("Success!","Attendance and workout plan logged successfully.","success"),p=[],document.getElementById("daily-attendance-section")&&N(),document.getElementById("quick-stats")&&R()}catch(r){Swal.fire("Submission Error",r.message,"error")}}}function X(){document.getElementById("darkModeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark-mode"),localStorage.setItem("darkMode",document.body.classList.contains("dark-mode")),A()}),document.getElementById("logoutBtn").addEventListener("click",async()=>{c(document.getElementById("logoutBtn"),!0);try{const e=await(await fetch("/api/logout",{method:"POST",credentials:"include"})).json();if(e.success)localStorage.clear(),window.location.href="../homepage.html";else throw new Error(e.message||"Logout failed")}catch(t){Swal.fire("Error",t.message,"error")}finally{c(document.getElementById("logoutBtn"),!1)}})}function K(){i.profileAttendanceBtn.addEventListener("click",async()=>{const t=i.profileAttendanceBtn;c(t,!0),bootstrap.Modal.getInstance(i.profileModal).hide(),await J(f.TR,f.Name),c(t,!1)}),i.profileHistoryBtn.addEventListener("click",()=>{bootstrap.Modal.getInstance(i.profileModal).hide(),i.profileHistoryBtn.blur(),i.mainContent.innerHTML=`
                <div class="card fade-in">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0;">History: ${f.Name}</h3>
                        
                        <button id="backToModalBtn" class="btn" style="width: auto; background-color: var(--text-color); color: var(--card-bg);">
                            <i class="fas fa-arrow-left"></i> Back to Profile
                        </button>
                    </div>
                    <div class="table-responsive">
                        <table id="planHistoryTable">
                            <thead><tr><th>Date</th><th>Body Parts</th></tr></thead>
                            <tbody id="plan-history-body"></tbody>
                        </table>
                    </div>
                </div>`,document.getElementById("backToModalBtn").addEventListener("click",()=>{L();const e=bootstrap.Modal.getInstance(i.profileModal);e?e.show():P(f.TR)}),Q(f.TR)}),i.profileTestBtn.addEventListener("click",()=>{bootstrap.Modal.getInstance(i.profileModal).hide(),x(f.TR)})}async function Q(t){try{const a=await(await fetch(`/api/training-plans/${t}`)).json(),n=document.getElementById("plan-history-body");n.innerHTML="",a.success&&a.data.length>0?a.data.forEach(s=>{const o=`<tr><td>${moment(s.LogDate).format("YYYY-MM-DD")}</td><td>${s.BodyParts}</td></tr>`;n.insertAdjacentHTML("beforeend",o)}):n.innerHTML='<tr><td colspan="2">No recent plans found.</td></tr>'}catch(e){console.error("Failed to load plan history:",e),Swal.fire("Error","Failed to load training plan history.","error")}}function Z(){const t=document.getElementById("setPasswordForm");t.addEventListener("submit",async e=>{e.preventDefault();const a=t.querySelector('button[type="submit"]');c(a,!0);const n=document.getElementById("newPassword").value,s=document.getElementById("confirmPassword").value;if(n!==s){Swal.fire("Error","Passwords do not match.","error"),c(a,!1);return}if(n.length<6){Swal.fire("Error","Password must be at least 6 characters.","error"),c(a,!1);return}try{const o=await fetch("/api/staff/set-initial-password",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({newPassword:n})}),r=await o.json();if(!o.ok)throw new Error(r.message||"Failed to set password");Swal.fire("Success!","Your new password has been set.","success"),bootstrap.Modal.getInstance(document.getElementById("forcePasswordChangeModal")).hide(),sessionStorage.removeItem("isDefaultPassword")}catch(o){Swal.fire("Error",o.message,"error")}finally{c(a,!1)}})}i.navLinks.forEach(t=>{t.addEventListener("click",e=>{switch(e.preventDefault(),i.navLinks.forEach(n=>n.classList.remove("active")),t.classList.add("active"),t.dataset.page){case"home":L();break;case"checkout":D();break;case"test":x();break;case"menu":A();break}})});document.addEventListener("DOMContentLoaded",async()=>{await F()&&(localStorage.getItem("darkMode")==="true"&&document.body.classList.add("dark-mode"),L(),K(),sessionStorage.getItem("isDefaultPassword")==="true"&&(new bootstrap.Modal(document.getElementById("forcePasswordChangeModal")).show(),Z()))});function _(t,e){let a;return(...n)=>{clearTimeout(a),a=setTimeout(()=>t(...n),e)}}
