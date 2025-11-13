import"./modulepreload-polyfill-B5Qt9EMX.js";/* empty css                      *//* empty css                        *//* empty css                                  *//* empty css                  */document.addEventListener("DOMContentLoaded",()=>{n("Male"),n("Female")});async function n(o){const l=o==="Male"?"#maleLogTable":"#femaleLogTable",r=$(l).DataTable({language:{processing:`
                <div class="loader-cell">
                    <div class="loader"></div>
                    <div>Loading ${o} Logs...</div>
                </div>
            `},processing:!0});try{const a=await fetch(`/api/admin/evaluation-logs?gender=${o}`,{credentials:"include"});if(!a.ok){const e=await a.json();throw new Error(e.message||"Failed to load data.")}const{data:s}=await a.json();r.destroy();const m=$(l).DataTable({data:s,columns:[{data:"EvaluatorName"},{data:"CategoryName"},{data:"TR"},{data:"StudentName"},{data:"BatchName"},{data:"Remark"}],responsive:!0,pageLength:25,lengthMenu:[10,25,50,100],dom:"lBfrtip",buttons:["copy","csv","excel","pdf","print"],initComplete:function(){this.api().columns([0,1,4]).every(function(){var e=this,i=o==="Male"?"#male-filters":"#female-filters",c=$(e.header()).text(),d=$('<div class="col-md-4 col-sm-6 col-12 form-select-wrapper"></div>').appendTo($(i)),p=$('<select class="form-select"><option value="">Filter by '+c+"</option></select>").appendTo(d).on("change",function(){var t=$.fn.dataTable.util.escapeRegex($(this).val());e.search(t?"^"+t+"$":"",!0,!1).draw()});e.data().unique().sort().each(function(t,u){p.append('<option value="'+t+'">'+t+"</option>")})})}})}catch(a){console.error(a),r.clear().draw(),r.processing(!1),$(l).find("tbody").html(`
            <tr>
                <td colspan="6" class="text-danger text-center">
                    <strong>Error:</strong> ${a.message}
                </td>
            </tr>
        `)}}
