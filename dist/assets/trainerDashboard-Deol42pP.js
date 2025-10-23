import"./modulepreload-polyfill-B5Qt9EMX.js";const c={mainContent:document.getElementById("main-content"),navLinks:document.querySelectorAll(".bottom-nav .nav-link"),profileModal:document.getElementById("studentMiniProfileModal"),profileName:document.getElementById("profile-name"),profileTR:document.getElementById("profile-tr"),profileGoal:document.getElementById("profile-goal"),profileSlot:document.getElementById("profile-slot"),profileRecent:document.getElementById("profile-recent"),profileAttendanceBtn:document.getElementById("profile-attendance-btn"),profileHistoryBtn:document.getElementById("profile-history-btn"),profileTestBtn:document.getElementById("profile-test-btn")};let T=null,p=[],m=[],f=null,k=null,w=null;function l(e,t){const a=e.querySelector(".btn-text")||e;if(t)e.disabled=!0,e.querySelector(".spinner")||e.insertAdjacentHTML("afterbegin",'<div class="spinner"></div>'),a.style.display="none";else{e.disabled=!1;const n=e.querySelector(".spinner");n&&n.remove(),a.style.display="inline"}}async function q(){try{const t=await(await fetch("/api/session-user",{credentials:"include"})).json();return!t.success||!t.user?(window.location.href="../Forbidden.html",null):(T=t.user,t.user)}catch(e){return console.error("Session validation failed:",e),window.location.href="../Forbidden.html",null}}async function R(e){try{const[t,a]=await Promise.all([fetch(`/api/verify-tr/${e}`),fetch(`/api/training-plans/${e}`)]),n=await t.json(),s=await a.json();if(!n.valid)throw new Error(n.message||"Invalid TR or membership expired");if(f=n.data,c.profileName.textContent=f.Name,c.profileTR.textContent=f.TR,c.profileGoal.textContent=f.Goal||"Not set",c.profileSlot.textContent=f.SlotName||"Not assigned",c.profileRecent.innerHTML="",s.success&&s.data.length>0)s.data.slice(0,2).forEach(i=>{const d=moment().diff(moment(i.LogDate),"days"),u=document.createElement("li");u.textContent=`${i.BodyParts} (${d} day${d===1?"":"s"} ago)`,c.profileRecent.appendChild(u)});else{const r=document.createElement("li");r.textContent="No recent workouts",c.profileRecent.appendChild(r)}new bootstrap.Modal(c.profileModal).show()}catch(t){Swal.fire("Error",t.message,"error")}}function E(){c.mainContent.innerHTML=`
        <div class="card fade-in">
            <h3 id="welcomeText">Welcome, ${T?.Username}! <br> <span>${T?.Branch} - ${T?.Gender==="Male"?"Talabat":"Talebaat"}</span></h3>
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
    `,Promise.all([fetch("/api/daily-attendance").then(e=>e.json()),fetch("/api/active-sessions",{credentials:"include"}).then(e=>e.json())]).then(([e,t])=>{if(e.error)throw new Error(e.error);if(!t.success)throw new Error(t.error);m=e,p=t.data,C(m),A(m);const a=m.filter(n=>n.IsPresentToday==="Present").length;$(a,m.length,p.length)}).catch(e=>{console.error("Failed to load home data:",e),document.getElementById("dailyAttendanceTable").querySelector("tbody").innerHTML='<tr><td colspan="3" style="text-align:center; color: var(--error-text);">Could not load attendance.</td></tr>',document.getElementById("quick-stats").innerHTML='<p style="text-align:center; color: var(--error-text);">Could not load stats.</p>'}),j()}function $(e,t,a){document.getElementById("quick-stats").innerHTML=`
        <div class="row">
            <div class="col-6">
                <div class="card" id="active-stats-card" style="cursor: pointer;" title="Go to Check-out">
                    <p>Active: <br> <strong style="font-size: 1.2em;">${a}</strong> Live session${a!==1?"s":""}</p>
                </div>
            </div>
            <div class="col-6">
                <div class="card">
                    <p>Present Today: <br> ${e} out of  ${t} <strong style="font-size: 1.2em;">(${(e/t*100).toFixed(2)}%)</strong></p>
                </div>
            </div>
        </div>
    `}function H(){c.mainContent.innerHTML=`
            <div class="card fade-in">
                <h3>Active Sessions</h3>
                <table id="activeSessionsTable">
                    <thead><tr><th>TR</th><th>Name</th><th>Check-in</th><th>Action</th></tr></thead>
                    <tbody id="active-sessions-body"></tbody>
                </table>
            </div>
        `,D()}function L(e=null){c.mainContent.innerHTML=`
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
        `,O(e),W()}function M(){const e=document.body.classList.contains("dark-mode");c.mainContent.innerHTML=`
            <div class="card fade-in">
                <h3>Menu</h3>
                <div class="list-group">
                    <button type="button" class="list-group-item list-group-item-action">View Profile</button>
                    <button type="button" id="darkModeToggle" class="list-group-item list-group-item-action">
                        <i class="fas ${e?"fa-sun":"fa-moon"}"></i> 
                        Switch to ${e?"Light":"Dark"} Mode
                    </button>
                    <button type="button" id="logoutBtn" class="list-group-item list-group-item-action text-danger">
                        <i class="fas fa-sign-out-alt"></i> 
                        Logout
                    </button>
                </div>
            </div>
        `,G()}async function I(){const e=document.getElementById("quick-stats");e.innerHTML='<p style="text-align:center;">Loading stats...</p>';try{const[t,a]=await Promise.all([fetch("/api/daily-attendance"),fetch("/api/active-sessions",{credentials:"include"})]),n=await t.json(),s=await a.json();if(!t.ok)throw new Error(n.message||"Failed to load attendance");if(!s.success)throw new Error(s.error||"Failed to load sessions");m=n,p=s.data;const o=p.length,r=m.length,i=m.filter(d=>d.IsPresentToday==="Present").length;e.innerHTML=`
            <div class="row">
                <div class="col-6">
                    <div class="card" id="active-stats-card" style="cursor: pointer;" title="Go to Check-out">
                        <p>Active: ${o} Live session</p>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card">
                        <p>Attendance: ${i} / ${r}</p>
                    </div>
                </div>
            </div>
        `}catch(t){console.error("Failed to load quick stats:",t),e.innerHTML='<p style="text-align:center; color: var(--error-text);">Could not load stats.</p>'}}async function F(){const e=document.querySelector("#dailyAttendanceTable tbody");e.innerHTML='<tr><td colspan="3" style="text-align:center;">Loading attendance...</td></tr>';try{const t=await fetch("/api/daily-attendance"),a=await t.json();if(!t.ok)throw new Error(a.message||"Failed to load attendance");m=a,C(a)}catch(t){console.error("Failed to load daily attendance:",t),e.innerHTML='<tr><td colspan="3" style="text-align:center; color: var(--error-text);">Could not load attendance.</td></tr>'}}function C(e){const t=document.querySelector("#dailyAttendanceTable tbody");if(t.innerHTML="",!e.length){t.innerHTML='<tr><td colspan="3">No attendance records.</td></tr>';return}e.forEach(a=>{let n="";const s=a.IsPresentToday;switch(s){case"Present":n="background-color: var(--success-bg); color: var(--success-text);";break;case"On Leave":n="background-color: #fff3cd; color: #856404;";break;default:n="background-color: var(--error-bg); color: var(--error-text);";break}const o=`<tr><td>${a.TR}</td><td>${a.Name}</td><td style="${n}">${s}</td></tr>`;t.insertAdjacentHTML("beforeend",o)})}async function D(){const e=document.getElementById("active-sessions-body");if(e){e.innerHTML='<tr><td colspan="4" style="text-align:center;">Loading sessions...</td></tr>';try{const a=await(await fetch("/api/active-sessions",{credentials:"include"})).json();if(!a.success)throw new Error(a.error);p=a.data,P(a.data)}catch(t){console.error("Failed to load active sessions:",t),e.innerHTML='<tr><td colspan="4" style="text-align:center; color: var(--error-text);">Could not load active sessions.</td></tr>'}}}function P(e){const t=document.getElementById("active-sessions-body");if(t){if(t.innerHTML="",!e.length){t.innerHTML='<tr><td colspan="4">No active sessions.</td></tr>';return}e.forEach(a=>{const n=moment.utc(a.CreatedAt).tz("Asia/Kolkata").format("h:mm A"),s=document.createElement("tr");s.innerHTML=`<td>${a.TR}</td><td>${a.Name}</td><td>${n}</td>`;const o=document.createElement("td"),r=document.createElement("button");r.classList.add("btn"),r.innerHTML='<span class="btn-text">Check Out</span>',r.onclick=()=>N(a.TR,a.Name,a.CreatedAt,s,r),o.appendChild(r),s.appendChild(o),t.appendChild(s)})}}async function N(e,t,a,n,s){l(s,!0);try{const o=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({TR:e})}),r=await o.json();if(!o.ok)throw new Error(r.message);const i=moment.utc(a).tz("Asia/Kolkata"),d=moment().tz("Asia/Kolkata"),u=Math.round(d.diff(i,"minutes"));await Swal.fire({title:"Checked Out!",text:`${t} completed a ${u}-minute workout session. Great job!`,icon:"success",timer:2e3,showConfirmButton:!1}),n.classList.add("fade-in"),n.style.backgroundColor="var(--success-bg)",setTimeout(()=>n.remove(),1e3),p=p.filter(h=>h.TR!==e),P(p),document.getElementById("quick-stats")&&I()}catch(o){Swal.fire("Error",o.message,"error")}finally{l(s,!1)}}async function O(e=null){try{const a=await(await fetch("/api/students-list")).json();if(!Array.isArray(a))throw new Error("Invalid student list format");k=new Choices("#student-selector",{removeItemButton:!0,maxItemCount:5,placeholderValue:"Search by name or TR...",choices:a.map(n=>({value:String(n.value),label:n.label}))}),e&&k.setChoiceByValue(String(e))}catch(t){console.error("Failed to initialize student selector:",t),Swal.fire("Error","Failed to load student list.","error")}}async function A(e){try{if(!Array.isArray(e))throw new Error("Invalid student list format");w=new Choices("#tr-input",{removeItemButton:!0,maxItemCount:1,placeholderValue:"Search by name or TR...",choices:e.map(t=>({value:String(t.TR),label:`${t.Name} [${t.TR}]`}))})}catch(t){console.error("Failed to initialize search selector:",t),Swal.fire("Error","Failed to load student list for search.","error")}}function j(){const e=document.getElementById("tr-input"),t=document.getElementById("search-btn"),a=document.getElementById("quick-stats");a&&a.addEventListener("click",o=>{o.target.closest("#active-stats-card")&&document.querySelector('.nav-link[data-page="checkout"]').click()});const n=document.getElementById("attendance-accordion-header");n&&n.addEventListener("click",()=>{const o=document.getElementById("attendance-accordion-body"),r=n.querySelector("i");o.classList.toggle("hidden"),r.classList.toggle("fa-chevron-down"),r.classList.toggle("fa-chevron-up")});const s=Q(async()=>{const o=w?w.getValue(!0):e.value.trim();if(o){l(t,!0);try{await R(o),w&&(w.clearInput(),m=[],A([]))}finally{l(t,!1)}}},300);e.addEventListener("change",async()=>{await s()}),t.addEventListener("click",s)}function W(){document.getElementById("addStudentsBtn").addEventListener("click",async()=>{const e=document.getElementById("addStudentsBtn");l(e,!0);try{const t=k.getValue(!0);if(!t.length){Swal.fire("No Selection","Select at least one student.","info");return}const a=await Promise.all(t.map(s=>fetch(`/api/testmaster/${s}`).then(o=>o.json()))),n=document.getElementById("testing-area");n.innerHTML="",a.forEach(s=>{if(s.TR){const o=V(s);n.appendChild(o)}}),document.getElementById("submission-container").classList.remove("hidden")}catch{Swal.fire("Error","Failed to load student data.","error")}finally{l(e,!1)}}),document.getElementById("submitAllTestsBtn").addEventListener("click",async()=>{const e=document.getElementById("submitAllTestsBtn");l(e,!0);const t=document.querySelectorAll(".student-test-form"),a=[];let n=!0;for(const s of t){if(!s.checkValidity()){s.reportValidity(),n=!1;break}const o=U(s);if(o)a.push(o);else{n=!1,Swal.fire("Calculation Error",`Could not calculate report for TR ${s.dataset.tr}. Check all inputs.`,"error");break}}if(!n){t.length>0&&Swal.fire("Error","Please fill all required fields for every student.","error"),l(e,!1);return}Swal.fire({title:"Confirm Submission",text:`You are about to submit ${a.length} fitness records. This action cannot be undone.`,icon:"warning",showCancelButton:!0,confirmButtonText:"Yes, Submit All",reverseButtons:!0}).then(async s=>{if(s.isConfirmed)try{const o=await fetch("/api/trainer-test-records",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}),r=await o.json();if(!o.ok)throw new Error(r.error||"An unknown error occurred.");Swal.fire("Success!",r.message,"success").then(()=>{location.reload()})}catch(o){Swal.fire("Submission Failed",o.message,"error")}finally{l(e,!1)}else l(e,!1)})})}function V(e){const t=document.createElement("div");return t.classList.add("accordion-item"),t.innerHTML=`
            <div class="accordion-header">${e.Name} (TR: ${e.TR})</div>
            <div class="accordion-body hidden">
                <form class="student-test-form" data-tr="${e.TR}" data-dob="${e.DOB}" data-age="${e.Age}">
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
        `,t.querySelector(".accordion-header").addEventListener("click",()=>{t.querySelector(".accordion-body").classList.toggle("hidden")}),t}function U(e){try{const t={},a=parseFloat(e.querySelector('[name="Weight"]').value),n=parseFloat(e.querySelector('[name="Height"]').value),s=parseFloat(e.querySelector('[name="Waist"]').value),o=parseFloat(e.querySelector('[name="Hips"]').value),r=parseFloat(e.querySelector('[name="Neck"]').value),i=parseFloat(e.querySelector('[name="PulseRate"]').value),d=parseInt(e.querySelector('[name="PushUps"]').value)||0,u=parseInt(e.querySelector('[name="SitUps"]').value)||0,h=parseInt(e.querySelector('[name="Squats"]').value)||0,b=parseFloat(e.querySelector('[name="SitReach"]').value)||0,v=parseInt(e.dataset.age),S=n/100,y=a/(S*S);t.BMI=parseFloat(y.toFixed(1)),t.BMIStatus=y<18.5?"Underweight":y<24.9?"Normal weight":y<29.9?"Overweight":"Obese",t.BodyFat=parseFloat((495/(1.29579-.35004*Math.log10(s+o-r)+.221*Math.log10(n))-450).toFixed(1)),t.BMR=Math.round(10*a+6.25*n-5*v+5),t.CalorieIntake=Math.round(t.BMR*1.55),t.VO2Max=i?Math.round(15*(220-v)/i):"N/A";const g=Math.round(d/2+u/2+h/2+b+(t.VO2Max!=="N/A"?t.VO2Max/2:0));return t.Total=g,t.Grade=g>=80?"A+":g>=70?"A":g>=60?"B":g>=50?"C":"D",{TR:e.dataset.tr,DOB:e.dataset.dob,Age:v,Weight:a,Height:n,Waist:s,Hips:o,Neck:r,BMI:t.BMI,BMIStatus:t.BMIStatus,BodyFat:t.BodyFat,BMR:t.BMR,CalorieIntake:t.CalorieIntake,VO2Max:t.VO2Max,Total:t.Total,Grade:t.Grade,PushUps:d,SitUps:u,Squats:h,SitReach:b,PulseRate:i}}catch(t){return console.error(`Calculation failed for TR ${e.dataset.tr}`,t),null}}async function z(e,t){const n=["Cardio","Chest","Back","Shoulders","Biceps","Triceps","Legs","Core"].map(o=>`<div class="body-part-chip" data-part="${o}">${o}</div>`).join(""),s=await Swal.fire({title:`Workout for ${t}`,html:`
                <p>Select body parts to train today (max 3).</p>
                <div class="body-parts-container">${n}</div>
                <div id="max-selection-warning"></div>
            `,confirmButtonText:"Log Attendance & Workout",showCancelButton:!0,focusConfirm:!1,width:"600px",didOpen:()=>{const o=document.querySelector(".body-parts-container"),r=o.querySelectorAll(".body-part-chip"),i=document.getElementById("max-selection-warning");r.forEach(d=>{d.addEventListener("click",()=>{const u=o.querySelectorAll(".selected").length;d.classList.contains("selected")?(d.classList.remove("selected"),i.textContent=""):u<3?(d.classList.add("selected"),i.textContent=""):(i.textContent="Maximum of 3 parts can be selected.",setTimeout(()=>{i.textContent=""},2e3))})})},preConfirm:()=>{const o=document.querySelectorAll(".body-part-chip.selected");return Array.from(o).map(r=>r.dataset.part)}});if(s.isConfirmed){const o=s.value;Swal.fire({title:"Submitting...",text:"Please wait while we log the session.",allowOutsideClick:!1,didOpen:()=>Swal.showLoading()});try{const r=new Date,i=new Date(r),d=i.getDay(),u=i.getDate()-d+(d===0?-6:1);i.setDate(u);const h=new Date(i);h.setDate(i.getDate()+6);const b=await fetch("/api/get-or-create-week",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({WeekStartDate:i.toISOString().split("T")[0],WeekEndDate:h.toISOString().split("T")[0]})}),v=await b.json();if(!b.ok)throw new Error(v.message||"Failed to create week");const S=v.WeekID,y=await fetch("/api/attendance-manual",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({TR:e,WeekID:S,IsPresent:1})}),g=await y.json();if(!y.ok)throw new Error(g.error||"Attendance submission failed");if(o.length>0){const B=await fetch("/api/log-training-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({TR:e,BodyParts:o})}),x=await B.json();if(!B.ok)throw new Error(x.message||"Plan logging failed")}Swal.fire("Success!","Attendance and workout plan logged successfully.","success"),m=[],document.getElementById("daily-attendance-section")&&F(),document.getElementById("quick-stats")&&I()}catch(r){Swal.fire("Submission Error",r.message,"error")}}}function G(){document.getElementById("darkModeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark-mode"),localStorage.setItem("darkMode",document.body.classList.contains("dark-mode")),M()}),document.getElementById("logoutBtn").addEventListener("click",async()=>{l(document.getElementById("logoutBtn"),!0);try{const t=await(await fetch("/api/logout",{method:"POST",credentials:"include"})).json();if(t.success)localStorage.clear(),window.location.href="../homepage.html";else throw new Error(t.message||"Logout failed")}catch(e){Swal.fire("Error",e.message,"error")}finally{l(document.getElementById("logoutBtn"),!1)}})}function Y(){c.profileAttendanceBtn.addEventListener("click",async()=>{const e=c.profileAttendanceBtn;l(e,!0),bootstrap.Modal.getInstance(c.profileModal).hide(),await z(f.TR,f.Name),l(e,!1)}),c.profileHistoryBtn.addEventListener("click",()=>{bootstrap.Modal.getInstance(c.profileModal).hide(),c.mainContent.innerHTML=`
                <div class="card fade-in">
                    <h3>Training Plan History for ${f.Name}</h3>
                    <table id="planHistoryTable">
                        <thead><tr><th>Date</th><th>Body Parts</th></tr></thead>
                        <tbody id="plan-history-body"></tbody>
                    </table>
                </div>
            `,J(f.TR)}),c.profileTestBtn.addEventListener("click",()=>{bootstrap.Modal.getInstance(c.profileModal).hide(),L(f.TR)})}async function J(e){try{const a=await(await fetch(`/api/training-plans/${e}`)).json(),n=document.getElementById("plan-history-body");n.innerHTML="",a.success&&a.data.length>0?a.data.forEach(s=>{const o=`<tr><td>${moment(s.LogDate).format("YYYY-MM-DD")}</td><td>${s.BodyParts}</td></tr>`;n.insertAdjacentHTML("beforeend",o)}):n.innerHTML='<tr><td colspan="2">No recent plans found.</td></tr>'}catch(t){console.error("Failed to load plan history:",t),Swal.fire("Error","Failed to load training plan history.","error")}}function K(){const e=document.getElementById("setPasswordForm");e.addEventListener("submit",async t=>{t.preventDefault();const a=e.querySelector('button[type="submit"]');l(a,!0);const n=document.getElementById("newPassword").value,s=document.getElementById("confirmPassword").value;if(n!==s){Swal.fire("Error","Passwords do not match.","error"),l(a,!1);return}if(n.length<6){Swal.fire("Error","Password must be at least 6 characters.","error"),l(a,!1);return}try{const o=await fetch("/api/staff/set-initial-password",{method:"PUT",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({newPassword:n})}),r=await o.json();if(!o.ok)throw new Error(r.message||"Failed to set password");Swal.fire("Success!","Your new password has been set.","success"),bootstrap.Modal.getInstance(document.getElementById("forcePasswordChangeModal")).hide(),sessionStorage.removeItem("isDefaultPassword")}catch(o){Swal.fire("Error",o.message,"error")}finally{l(a,!1)}})}c.navLinks.forEach(e=>{e.addEventListener("click",t=>{switch(t.preventDefault(),c.navLinks.forEach(n=>n.classList.remove("active")),e.classList.add("active"),e.dataset.page){case"home":E();break;case"checkout":H();break;case"test":L();break;case"menu":M();break}})});document.addEventListener("DOMContentLoaded",async()=>{await q()&&(localStorage.getItem("darkMode")==="true"&&document.body.classList.add("dark-mode"),E(),Y(),sessionStorage.getItem("isDefaultPassword")==="true"&&(new bootstrap.Modal(document.getElementById("forcePasswordChangeModal")).show(),K()))});function Q(e,t){let a;return(...n)=>{clearTimeout(a),a=setTimeout(()=>e(...n),t)}}
