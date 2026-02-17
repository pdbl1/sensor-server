
const sensSel = document.getElementById("sensorSel")
const countSel = document.getElementById("evtsInput")


function go() {
    const sens = sensSel.value.trim();
    const val = countSel.value.trim();
    const num = parseInt(val, 10);
    const evts = (isNaN(num) || num <= 0) ? 10 : num;
    window.location.href = 'reed-events?evts=' + evts.toString() + "&sensor="+sens;
}

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
    const sensRes = await fetch('reed-sensors');
    const sensList = await sensRes.json();
    sensSel.innerHTML = sensList.map(el => {
        return `<option value="${el.id}">${el.txt}</option>`;
    }).join('');
}

function init() {
    loadSensorList()
}

window.onload = init;