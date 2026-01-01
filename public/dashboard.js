

// dashboard.js
let myChart = null; 
const selector = document.getElementById('sensor-select');
const container = document.getElementById('hd');
let sensorNames = {}; // Start empty, will be filled from server
const defaultUnit = "F";
let unitSym = "°F";
const refreshDashboard = refreshDashboardScatter;

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
        // Fetch both sensors and names at the same time
        const [sensorRes, namesRes] = await Promise.all([
            fetch('/api/sensors'),
            fetch('/api/names')
        ]);

        const sensors = await sensorRes.json();
        sensorNames = await namesRes.json(); // Store the names globally
        
        if (sensors.length === 0) {
            selector.innerHTML = '<option>No sensors found</option>';
            return;
        }

        // Build the dropdown using the fetched names
        selector.innerHTML = sensors.map(id => {
            const friendlyName = sensorNames[id] ? `${sensorNames[id]} (${id})` : id;
            return `<option value="${id}">${friendlyName}</option>`;
        }).join('');

        // Handle persistence
        const savedSensorId = localStorage.getItem('selectedSensor');
        if (savedSensorId && sensors.includes(savedSensorId)) {
            selector.value = savedSensorId;
            refreshDashboard(savedSensorId);
        } else {
            refreshDashboard(sensors[0]);
        }
    } catch (err) {
        console.error("Error loading initialization data:", err);
    }
}

async function refreshDashboardLine(sensorId) {
    try {
        const response = await fetch(`/api/history?id=${sensorId}`);
        const data = await response.json();

        // Get the name from our global sensorNames object
        const displayName = sensorNames[sensorId] || sensorId;

        if (!data || data.length === 0) {
            container.innerHTML = `<h3>${displayName}</h3><p>No data recorded.</p>`;
            return;
        }
        let latest = data[data.length - 1];
        
        // Find Min/Max
        const values = data.map(entry => entry.v);
        changeUnits();
        let unit = localStorage.getItem("unit") || defaultUnit;
        if (unit === 'F') {
            latest.v = latest.v *9/5 +32;
        }
        const displayValues = values.map(entry => {
            if (unit === "F"){
                return (entry *9/5) + 32;
            } else return entry;
        });
        const min = Math.min(...displayValues).toFixed(2);
        const max = Math.max(...displayValues).toFixed(2);

        container.innerHTML = `
            <p><strong>Last Update:</strong> ${new Date(latest.t).toLocaleString()}
            <strong>Temperature:</strong> <span style=color: #3e95cd;">${latest.v.toFixed(2)}${unitSym}</span>
            <span style="color: #666; font-size: 0.9em;">
                Min: ${min}${unitSym} | Max: ${max}${unitSym}
            </span></p>
        `;
        const labels = data.map(entry => new Date(entry.t).toLocaleTimeString());
        updateChartLine(labels, displayValues, displayName);
    } catch (error) {
        console.error("Failed to refresh dashboard:", error);
    }
}

function updateChartLine(labels, values, sensorId) {
    //const labels = data.map(entry => new Date(entry.t).toLocaleTimeString());
    //const values = data.map(entry => entry.v);
    const ctx = document.getElementById('myChart').getContext('2d');

    if (myChart) { myChart.destroy(); }
    //Chart.register(zoomPlugin);
    //Chart.register(window['chartjs-plugin-zoom']);
    //Chart.register(ChartZoom);

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Temperature (${sensorId})`,
                data: values,
                borderColor: '#3e95cd',
                backgroundColor: 'rgba(62, 149, 205, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // plugins: {
            //     zoom: {
            //         zoom: {
            //         wheel: {
            //             enabled: true, // Enable zooming with mouse wheel
            //         },
            //         // pinch: {
            //         //     enabled: true // Enable pinching on touch screens
            //         // },
            //         mode: 'xy', // Allow zooming in both horizontal and vertical directions
            //         },
            //         pan: {
            //         enabled: true, // Allow moving the chart around after zooming
            //         mode: 'xy',
            //         }
            //     }
            // }
        }
    });
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
        console.log('Key exists and has a value!');
    } else {
        localStorage.setItem("unit", defaultUnit);
    }
}
window.onload = init;

// setInterval(() => {
//     if (selector.value) refreshDashboard(selector.value);
// }, 60000);


//Settings function to update human readable names for addresses

// Toggle the editor visibility
function toggleAdmin() {
    const panel = document.getElementById('admin-panel');
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    
    if (isHidden) {
        generateNameInputs();
    }
}

// Create an input field for every sensor found
async function generateNameInputs() {
    const container = document.getElementById('name-inputs');
    // Fetch the latest list of sensors
    const response = await fetch('/api/sensors');
    const sensors = await response.json();

    container.innerHTML = sensors.map(id => `
        <div style="margin-bottom: 10px;">
            <label style="font-size: 0.8em; color: #666;">ID: ${id}</label><br>
            <input type="text" 
                   class="sensor-name-input" 
                   data-id="${id}" 
                   value="${sensorNames[id] || ''}" 
                   placeholder="Enter friendly name...">
        </div>
    `).join('');
}

// Send the updated names to the server
async function saveNames() {
    const inputs = document.querySelectorAll('.sensor-name-input');
    const status = document.getElementById('save-status');
    const updatedNames = {};

    inputs.forEach(input => {
        if (input.value.trim() !== "") {
            updatedNames[input.dataset.id] = input.value.trim();
        }
    });

    try {
        status.textContent = " Saving...";
        const response = await fetch('/api/names', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedNames)
        });

        if (response.ok) {
            status.textContent = "✅ Saved! Refreshing...";
            // Update local object and refresh the page to show new names
            sensorNames = updatedNames;
            setTimeout(() => location.reload(), 1000);
        } else {
            throw new Error("Save failed");
        }
    } catch (err) {
        status.textContent = "❌ Error saving.";
        console.error(err);
    }
}


async function refreshDashboardScatter(sensorId) {
    try {
        const response = await fetch(`/api/history?id=${sensorId}`);
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
    //const labels = data.map(entry => new Date(entry.t).toLocaleTimeString());
    //const values = data.map(entry => entry.v);
    const ctx = document.getElementById('myChart').getContext('2d');

    if (myChart) { myChart.destroy(); }

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
            scales: {
                x: {
                    type: 'time', // Requires date-fns or moment adapter
                    time: { unit: 'minute',
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
            }
        }
    });
}