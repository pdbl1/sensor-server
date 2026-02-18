

// temp_disp.js
let myChart = null; 
const selector = document.getElementById('sensor-select');
const container = document.getElementById('hd');
let sensorNames = {}; // Start empty, will be filled from server
const defaultUnit = "F";
let unitSym = "°F";
const refreshDashboard = refreshDashboardScatter;

document.getElementById('resetBtn').addEventListener('click', () => {
    if (myChart) {
        myChart.resetZoom();
    }
});

function changeUnits() {
    const el = document.getElementById('units');
    let unit = localStorage.getItem("unit") || defaultUnit;
    if (unit === "C") {
        unit = "F";
        el.innerHTML = 'Fahrenheit';
        unitSym = "°F";
    } else {
        unit = "C";
        el.innerHTML = 'Celsius';
        unitSym = "°C"
    }
    localStorage.setItem("unit", unit);
    let senId = localStorage.getItem("selectedSensor");
    refreshDashboard(senId);
}

async function loadSensorList() {
    try {
        const sensorRes = await fetch('/api/sensors1');
        const sensors = await sensorRes.json();      
        if (!Array.isArray(sensors) || sensors.length === 0) {
            selector.innerHTML = '<option>No sensors found</option>';
            return;
        }
        // Build dropdown
        selector.innerHTML = sensors.map(s => {
            const friendlyName = `${s.esp32}: ${s.name}`;
            return `<option value="${s.id}">${friendlyName}</option>`;
        }).join('');
        // Load saved selection
        const savedSensorId = localStorage.getItem('selectedSensor');
        // Check if saved ID still exists in the new list
        const exists = sensors.some(s => s.id === savedSensorId);
        let activeId;
        if (savedSensorId && exists) {
            activeId = savedSensorId;
        } else {
            // Fallback to first sensor
            activeId = sensors[0].id;
            localStorage.setItem('selectedSensor', activeId);
        }
        // Explicitly set the dropdown value
        selector.value = activeId;
        // Refresh dashboard
        refreshDashboard(activeId);
    } catch (err) {
        console.error("Error loading initialization data:", err);
    }

}
selector.addEventListener('change', (e) =>{
    const selectedId = e.target.value;
    localStorage.setItem('selectedSensor', selectedId);
    refreshDashboard(selectedId);
}); 

function init() {
    loadSensorList();
    let unit = localStorage.getItem('unit');
    if (unit) {
        console.log(`Unit exists value: ${unit}`);
    } else {
        localStorage.setItem("unit", defaultUnit);
    }
}
window.onload = init;

async function refreshDashboardScatter(sensorId) {
    try {
        console.log(`/api/history1?id=${sensorId}`);
        const response = await fetch(`/api/history1?id=${sensorId}`);
        const data = await response.json();

        // Get the name from our global sensorNames object
        const displayName = sensorNames[sensorId] || sensorId;

        if (!data || data.length === 0) {
            container.innerHTML = `<h3>${displayName}</h3><p>No data recorded.</p>`;
            return;
        }
        let latest = data[data.length - 1];
        //convert to array of points
        let unit = localStorage.getItem("unit") || defaultUnit;
        let min = Infinity;
        let max = -Infinity;
        const dataPoints = data.map(el => {
            let val = el.v;
            if (unit === "F") {
                val = (val * 9/5) + 32;
            }
            if (val < min) min = val;
            if (val > max) max = val;
            
            // X = Time (Timestamp), Y = Value
            return { x: new Date(el.t), y: val.toFixed(2) };
        });
        const lastTemp = dataPoints[dataPoints.length-1].y;

        container.innerHTML = `
            <p><strong>Last Update:</strong> ${new Date(latest.t).toLocaleString()}
            <strong>Temperature:</strong> <span style=color: #3e95cd;">${lastTemp}${unitSym}</span>
            <span style="color: #666; font-size: 0.9em;">
                Min: ${min.toFixed(2)}${unitSym} | Max: ${max.toFixed(2)}${unitSym}
            </span></p>
        `;
        
        updateChartScatter(dataPoints, displayName);
    } catch (error) {
        console.error("Failed to refresh dashboard:", error);
    }
}

function updateChartScatter(dataPoints, sensorId) {
    const ctx = document.getElementById('myChart').getContext('2d');
    if (myChart) { 
        myChart.destroy(); 
    }
    myChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: sensorId,
                data: dataPoints,
                backgroundColor: 'rgba(62, 149, 205, 0.5)',
                borderColor: '#3e95cd',
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            scales: {
                x: {
                    type: 'time',
                    time: { 
                        unit: 'minute',
                        displayFormats: {
                            minute: 'MM/dd HH:mm',
                            hour: 'MM/dd HH:mm',
                            day: 'MM/dd'
                        }
                    },
                    title: { display: true, text: 'Time' }
                },
                y: {
                    title: { display: true, text: 'Temperature' }
                }
            },
            dragData: false,
            plugins: {
                zoom: {
                    zoom: {
                        wheel: { enabled: true },   // zoom with mouse wheel
                        pinch: { enabled: true },   // pinch zoom on touch
                        mode: 'x'                   // zoom only on X axis
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',                   // drag left/right to scroll
                        drag: false,
                        modifierKey: null
                    }
                }
            }
        }
    });
}