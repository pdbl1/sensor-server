

// dashboard.js
let myChart = null; 
const selector = document.getElementById('sensor-select');
const container = document.getElementById('hd');
let sensorNames = {}; // Start empty, will be filled from server


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

async function refreshDashboard(sensorId) {
    try {
        const response = await fetch(`/api/history?id=${sensorId}`);
        const data = await response.json();

        // Get the name from our global sensorNames object
        const displayName = sensorNames[sensorId] || sensorId;

        if (!data || data.length === 0) {
            container.innerHTML = `<h3>${displayName}</h3><p>No data recorded.</p>`;
            return;
        }

        const latest = data[data.length - 1];
        
        // Find Min/Max
        const values = data.map(entry => entry.v);
        const min = Math.min(...values);
        const max = Math.max(...values);

        container.innerHTML = `
            <p><strong>Last Update:</strong> ${new Date(latest.t).toLocaleString()}
            <strong>Temperature:</strong> <span style=color: #3e95cd;">${latest.v}°C</span>
            <span style="color: #666; font-size: 0.9em;">
                Min: ${min}°C | Max: ${max}°C
            </span></p>
        `;

        updateChart(data, displayName);
    } catch (error) {
        console.error("Failed to refresh dashboard:", error);
    }
}

function updateChart(data, sensorId) {
    const labels = data.map(entry => new Date(entry.t).toLocaleTimeString());
    const values = data.map(entry => entry.v);
    const ctx = document.getElementById('myChart').getContext('2d');

    if (myChart) { myChart.destroy(); }

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
            maintainAspectRatio: false
        }
    });
}

selector.addEventListener('change', (e) =>{
    const selectedId = e.target.value;
    localStorage.setItem('selectedSensor', selectedId);
    refreshDashboard(selectedId);
}); 
window.onload = loadSensorList;

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