import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css                                  *//* empty css                      *//* empty css                    *//* empty css                  */import"./auth-DPU65CiM.js";document.addEventListener("DOMContentLoaded",()=>{const d=document.getElementById("studentSearchInput"),i=document.getElementById("searchResults"),u=document.getElementById("profile-search-section"),c=document.getElementById("profile-details-section");let g,l=null;const m=new URLSearchParams(window.location.search).get("tr");m&&p(m),d.addEventListener("input",e=>{const t=e.target.value.trim();if(clearTimeout(g),t.length<2){i.style.display="none";return}g=setTimeout(()=>f(t),300)});async function f(e){try{const r=await(await fetch(`/api/staff/student-search?q=${encodeURIComponent(e)}`)).json();h(r.success?r.data:[])}catch(t){console.error("Search fetch error:",t)}}function h(e){!Array.isArray(e)||e.length===0?i.innerHTML='<div class="search-result-item">No students found.</div>':i.innerHTML=e.map(t=>`
                <div class="search-result-item" data-tr="${t.TR}">
                    <span class="name">${t.Name}</span>
                    <span class="tr">(${t.TR})</span>
                </div>
            `).join(""),i.style.display="block"}i.addEventListener("click",e=>{const t=e.target.closest(".search-result-item");if(t&&t.dataset.tr){const r=t.dataset.tr;window.history.pushState({tr:r},`Profile for ${r}`,`?tr=${r}`),p(r)}}),document.addEventListener("click",e=>{d.contains(e.target)||(i.style.display="none")});async function p(e){u.style.display="none",c.style.display="block",c.innerHTML=`
            <div class="card text-center">
                <h2><div class="spinner-border text-primary" role="status"></div> Loading profile for TR: ${e}...</h2>
            </div>`;try{const r=await(await fetch(`/api/staff/student-profile/${e}`)).json();if(!r.success||!r.data)throw new Error(r.message||"Profile not found.");c.innerHTML=document.getElementById("profile-details-template").innerHTML;const a=r.data;y(a.basicInfo||{}),v(a.progress||{}),b(a.achievements||[]),L(a.workoutCalendar||[]),w(a.workoutLogs||[]),D(a.fitnessTests||[]),A(a.fitnessTests||[]),E(a.attendanceHistory||[]),S(a.leaveHistory||[]),T()}catch(t){console.error(t),c.innerHTML=`
                <div class="card text-center">
                    <h2 class="text-danger">Error Loading Profile</h2>
                    <p>${t.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary mt-3">Try Again</button>
                </div>`}}function y(e){document.getElementById("profileName").textContent=e.Name||"Unknown";const t=document.getElementById("profileStatus"),r=e.Status||"Inactive";t.textContent=r,t.className=`status-badge ${r==="Active"?"status-active":"status-inactive"}`,document.getElementById("profileTR").textContent=e.TR||"N/A",document.getElementById("profileJoined").textContent=e.JoinedAt?new Date(e.JoinedAt).toLocaleDateString():"N/A",document.getElementById("profileGoal").textContent=e.Goal||"N/A",document.getElementById("profileSlot").textContent=e.SlotName||"N/A",document.getElementById("profileDarajah").textContent=e.Darajah||"N/A";const a=e.FitnessLevel||1,n=e.CurrentXP||0,s=a*100;document.getElementById("profileFitnessLevel").textContent=a,document.getElementById("profileCurrentXp").textContent=n,document.getElementById("profileNextLevelXp").textContent=s,document.getElementById("profileXpBarFill").style.width=`${n/s*100}%`}function v(e){const t=document.getElementById("profile-progress-trackers");if(!t)return;e=e||{};const r=e.consistency||{current:0,target:1},a=e.perfectMonth||{current:0,target:30},n=e.socialButterfly||{current:0,target:8},s=e.milestoneLift||{current_improvement:0,target_improvement:1,previous_score:"N/A",current_score:"N/A"},o=e.ironDedication||{current:0,target:1,tierName:"bronze",completed:!1},B=Math.min(r.current/r.target*100,100),C=Math.min(a.current/a.target*100,100),x=Math.min(n.current/n.target*100,100),I=Math.min(s.current_improvement/s.target_improvement*100,100),M=o.completed?100:Math.min(o.current/o.target*100,100);t.innerHTML=`
            <div class="progress-card">
                <img src="/images/badges/consistency-king.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Consistency King</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${B}%;"></div></div>
                    <p>${r.current} / ${r.target} Day Streak</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="/images/badges/perfect-month.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Perfect 30 Days</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${C}%;"></div></div>
                    <p>${a.current} / ${a.target} Days</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="/images/badges/social-butterfly.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Social Butterfly</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${x}%;"></div></div>
                    <p>Weekly Score: ${n.current}/${n.target}</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="/images/badges/milestone-lift.png" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Milestone Lift</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${I}%;"></div></div>
                    <p>${s.current_score==="N/A"?"Take 2+ tests":`Prev: ${s.previous_score}, Curr: ${s.current_score}`}</p>
                </div>
            </div>
            <div class="progress-card">
                <img src="${o.completed?"/images/badges/dedication-gold.png":`/images/badges/dedication-${String(o.tierName).toLowerCase()}.png`}" class="progress-badge-img">
                <div class="progress-info">
                    <h4>Iron Dedication</h4>
                    <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${M}%;"></div></div>
                    <p>${o.completed?"All tiers done!":`${o.current.toFixed(2)}hrs / ${o.target} hrs`}</p>
                </div>
            </div>`}function b(e){const t=document.getElementById("profile-achievements-grid");if(t){if(!Array.isArray(e)||e.length===0){t.innerHTML='<p class="text-muted text-center">No badges earned yet.</p>';return}t.innerHTML=e.map(r=>`
            <div class="badge-card-small" title="${r.Description||""}">
                <img src="${r.BadgeImageURL||"/images/badges/placeholder.png"}" alt="${r.AchievementName}">
                <span>${r.AchievementName}</span>
            </div>`).join("")}}function L(e){const t=document.getElementById("profile-consistency-heatmap");if(t){if(t.innerHTML="",!Array.isArray(e)||e.length===0){t.innerHTML='<p class="text-muted text-center">No workout data for the last 6 months.</p>';return}try{const r=new CalHeatmap,a=e.map(n=>({date:n,value:1}));r.paint({itemSelector:t,domain:{type:"month"},subDomain:{type:"day",radius:2},data:{source:a,x:"date",y:"value"},scale:{color:{range:["#0097a7","#80deea","#00bcd4","#0097a7"],domain:[1,2,3,4]}},date:{start:new Date(new Date().setMonth(new Date().getMonth()-5))}})}catch(r){console.error("Heatmap render error:",r),t.innerHTML='<p class="text-muted text-center">Unable to render heatmap.</p>'}}}function D(e){if(l){try{l.destroy()}catch{}l=null}const t=document.getElementById("profile-fitness-chart");if(!t)return;if(t.style.height="400px",t.style.maxHeight="400px",t.style.width="100%",!Array.isArray(e)||e.length<2){const a=t.parentElement;a&&(a.innerHTML='<p class="text-muted text-center">Not enough test data to draw chart.</p>');return}const r=e.map(a=>new Date(a.CreatedAt).toLocaleDateString());l=new Chart(t.getContext("2d"),{type:"line",data:{labels:r,datasets:[{label:"Weight (kg)",data:e.map(a=>a.Weight),borderColor:"#007bff",fill:!1},{label:"Body Fat (%)",data:e.map(a=>a.BodyFat),borderColor:"#dc3545",fill:!1}]},options:{responsive:!0,maintainAspectRatio:!1,scales:{y:{beginAtZero:!0}},plugins:{legend:{position:"bottom"}}}})}function w(e){$("#profile-workout-log-table").DataTable({data:e||[],columns:[{title:"Date",data:"LogDate",render:t=>new Date(t).toLocaleDateString()},{title:"Body Parts",data:"BodyParts"}],order:[[0,"desc"]],destroy:!0,searching:!1,pageLength:5,lengthChange:!1})}function A(e){$("#profile-fitness-history-table").DataTable({data:e||[],columns:[{title:"Date",data:"CreatedAt",render:t=>new Date(t).toLocaleDateString()},{title:"Weight",data:"Weight"},{title:"Body Fat %",data:"BodyFat"},{title:"Total Score",data:"Total"},{title:"Grade",data:"Grade"}],order:[[0,"desc"]],destroy:!0,searching:!1,pageLength:5,lengthChange:!1})}function E(e){$("#profile-attendance-history-table").DataTable({data:e||[],columns:[{title:"Date",data:"CreatedAt",render:t=>new Date(t).toLocaleDateString()},{title:"Status",data:null,render:t=>t.IsPresent?"Present":t.OnLeave?"On Leave":"Absent"},{title:"Duration (min)",data:"DurationInMinutes",render:t=>t||"N/A"}],order:[[0,"desc"]],destroy:!0,pageLength:10})}function S(e){$("#profile-leave-history-table").DataTable({data:e||[],columns:[{title:"Start Date",data:"LeaveStartDate",render:t=>new Date(t).toLocaleDateString()},{title:"End Date",data:"LeaveEndDate",render:t=>new Date(t).toLocaleDateString()},{title:"Status",data:"Status"},{title:"Reason",data:"Reason"},{title:"Reviewed By",data:"ReviewedBy",render:t=>t||"N/A"}],order:[[0,"desc"]],destroy:!0,pageLength:5,lengthChange:!1})}function T(){const e=c.querySelector(".profile-tabs");if(!e)return;const t=Array.from(c.querySelectorAll(".tab-pane"));e.addEventListener("click",r=>{if(r.target.matches(".tab-link")){const a=r.target.dataset.tab;e.querySelectorAll(".tab-link").forEach(n=>n.classList.remove("active")),r.target.classList.add("active"),t.forEach(n=>{n.style.display=n.id===a?"block":"none",n.classList.toggle("active",n.id===a)})}})}});
