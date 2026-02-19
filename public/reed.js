
const sensSel = document.getElementById("sensorSel")
const countSel = document.getElementById("evtsInput")
const KEY_REED_RECORDS = 'reedRecords'
const KEY_SELECTED_REED = 'selectedReed'

function go() {
    const sens = sensSel.value.trim();
    const val = countSel.value.trim();
    const num = parseInt(val, 10);
    localStorage.setItem(KEY_REED_RECORDS, num.toString());
    const evts = (isNaN(num) || num <= 0) ? 10 : num;
    window.location.href = 'reed-display?evts=' + evts.toString() + "&sensor="+sens;
}

sensSel.addEventListener('change', (e)=>{
    const selectedID = e.target.value;
    localStorage.setItem(KEY_SELECTED_REED, selectedID);
    go();
})

document.addEventListener("DOMContentLoaded", () => {
    //const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.querySelectorAll(".utc-time").forEach(cell => {
        const utc = cell.textContent.trim();
        const d = new Date(utc);

        if (!isNaN(d.getTime())) {
            cell.textContent = d.toLocaleString() //+ " " + tz;  // browser local time
        }
    });
});

async function loadSensorList() {
    const sensRes = await fetch('/sensors/api/reed-sensors');
    const sensList = await sensRes.json();
    if(!Array.isArray(sensList) || sensList.length === 0){
        selector.innerHTML = '<option>No sensors found</option>';
        return;
    }
    //build dropdown
    sensSel.innerHTML = sensList.map(el => {
        return `<option value="${el.id}">${el.displayName}</option>`;
    }).join('');
    const savedSensorId = localStorage.getItem(KEY_SELECTED_REED);
    const exists = sensList.some(s => s.id === savedSensorId);
    let activeId = savedSensorId
    if (!savedSensorId || !exists){
        activeId = sensList[0].id;
    }
    sensSel.value = activeId;
}

function init() {
    const recordsStr = localStorage.getItem(KEY_REED_RECORDS);
    const records = recordsStr ? parseInt(recordsStr, 10) : 10;
    countSel.value = records;
    loadSensorList()
}

window.onload = init;