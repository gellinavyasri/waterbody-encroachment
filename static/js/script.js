// Water Body Encroachment Analysis - Main Script

// Configuration
const CONFIG = {
    waterBody1: {
        csvPath: '/static/data/waterbody1.csv',
        imageFolder: '/static/images/waterbody1/',
        chartId: 'chart1',
        tableId: 'tableBody1',
        galleryId: 'gallery1',
        timeRangeId: 'timeRange1'
    },
    waterBody2: {
        csvPath: '/static/data/waterbody2.csv',
        imageFolder: '/static/images/waterbody2/',
        chartId: 'chart2',
        tableId: 'tableBody2',
        galleryId: 'gallery2',
        timeRangeId: 'timeRange2'
    }
};


// Global data storage
const dataStore = {
    waterBody1: null,
    waterBody2: null
};

// Chart instances
const chartInstances = {
    chart1: null,
    chart2: null,
    comparisonChart: null
};

// Current chart filter state
const chartFilters = {
    chart1: 'all',
    chart2: 'all'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        // Load data for both water bodies
        await Promise.all([
            loadWaterBodyData('waterBody1'),
            loadWaterBodyData('waterBody2')
        ]);

        // Initialize charts
        initializeCharts();
        
        // Initialize image galleries
        initializeImageGalleries();
        
        // Setup chart toggle buttons
        setupChartToggles();
        
        // Initialize comparison chart
        initializeComparisonChart();
    } catch (error) {
        console.error('Error initializing application:', error);
        showError('Failed to initialize the application. Please check the console for details.');
    }
}

// Load CSV data for a water body
async function loadWaterBodyData(waterBodyKey) {
    const config = CONFIG[waterBodyKey];
    
    try {
        const response = await fetch(config.csvPath);
        if (!response.ok) {
            throw new Error(`Failed to load ${config.csvPath}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
        });

        if (parsed.errors.length > 0) {
            console.warn('CSV parsing warnings:', parsed.errors);
        }

        // Process and store data
        const processedData = processCSVData(parsed.data);
        dataStore[waterBodyKey] = processedData;

        // Populate table
        populateTable(waterBodyKey, processedData);
        
        // Update time range display
        updateTimeRange(waterBodyKey, processedData);
        
        return processedData;
    } catch (error) {
        console.error(`Error loading data for ${waterBodyKey}:`, error);
        // Create empty data structure if file doesn't exist
        dataStore[waterBodyKey] = {
            years: [],
            water: [],
            builtup: [],
            vegetation: []
        };
        showPlaceholderMessage(config.tableId, 'No data available. Please add a CSV file.');
        return null;
    }
}

// Process CSV data into structured format
function processCSVData(csvData) {
    const years = [];
    const water = [];
    const builtup = [];
    const vegetation = [];

    csvData.forEach(row => {
        // Handle different possible column name formats
        const year = row.Year || row.year || row.YEAR;
        const waterVal = row.Water || row.water || row['Water (%)'] || row['water (%)'] || 0;
        const builtupVal = row['Built-up'] || row['built-up'] || row['Built-up (%)'] || row['built-up (%)'] || row.Builtup || row.builtup || 0;
        const vegetationVal = row.Vegetation || row.vegetation || row['Vegetation (%)'] || row['vegetation (%)'] || 0;

        if (year) {
            years.push(year);
            water.push(parseFloat(waterVal) || 0);
            builtup.push(parseFloat(builtupVal) || 0);
            vegetation.push(parseFloat(vegetationVal) || 0);
        }
    });

    return { years, water, builtup, vegetation };
}

// Populate data table
function populateTable(waterBodyKey, data) {
    const config = CONFIG[waterBodyKey];
    const tbody = document.getElementById(config.tableId);
    
    if (!tbody || !data || data.years.length === 0) {
        return;
    }

    tbody.innerHTML = '';

    data.years.forEach((year, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${year}</td>
            <td>${data.water[index].toFixed(2)}</td>
            <td>${data.builtup[index].toFixed(2)}</td>
            <td>${data.vegetation[index].toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Update time range display
function updateTimeRange(waterBodyKey, data) {
    const config = CONFIG[waterBodyKey];
    const timeRangeEl = document.getElementById(config.timeRangeId);
    
    if (!timeRangeEl || !data || data.years.length === 0) {
        return;
    }

    const minYear = Math.min(...data.years);
    const maxYear = Math.max(...data.years);
    timeRangeEl.textContent = `${minYear} - ${maxYear}`;
}

// Initialize Chart.js charts
function initializeCharts() {
    Object.keys(CONFIG).forEach(waterBodyKey => {
        const config = CONFIG[waterBodyKey];
        const canvas = document.getElementById(config.chartId);
        
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = dataStore[waterBodyKey];

        if (!data || data.years.length === 0) {
            showPlaceholderMessage(config.chartId, 'No data available for chart.');
            return;
        }

        chartInstances[config.chartId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.years,
                datasets: [
                    {
                        label: 'Water (%)',
                        data: data.water,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Built-up (%)',
                        data: data.builtup,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Vegetation (%)',
                        data: data.vegetation,
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    });
}

// Setup chart toggle buttons
function setupChartToggles() {
    const toggleButtons = document.querySelectorAll('.btn-toggle');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const chartId = `chart${button.dataset.chart}`;
            const filterType = button.dataset.type;
            
            // Update active state
            document.querySelectorAll(`[data-chart="${button.dataset.chart}"]`).forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');
            
            // Update filter state
            chartFilters[chartId] = filterType;
            
            // Update chart
            updateChartFilter(chartId, filterType);
        });
    });
}

// Update chart based on filter
function updateChartFilter(chartId, filterType) {
    const chart = chartInstances[chartId];
    if (!chart) return;

    const waterBodyKey = chartId === 'chart1' ? 'waterBody1' : 'waterBody2';
    const data = dataStore[waterBodyKey];
    
    if (!data || data.years.length === 0) return;

    chart.data.datasets.forEach((dataset, index) => {
        if (filterType === 'all') {
            dataset.hidden = false;
        } else if (filterType === 'water' && index === 0) {
            dataset.hidden = false;
        } else if (filterType === 'builtup' && index === 1) {
            dataset.hidden = false;
        } else if (filterType === 'vegetation' && index === 2) {
            dataset.hidden = false;
        } else {
            dataset.hidden = true;
        }
    });

    chart.update();
}

// Initialize image galleries
async function initializeImageGalleries() {
    Object.keys(CONFIG).forEach(waterBodyKey => {
        loadImages(waterBodyKey);
    });
}

// Load and display images
async function loadImages(waterBodyKey) {
    const config = CONFIG[waterBodyKey];
    const gallery = document.getElementById(config.galleryId);
    
    if (!gallery) return;

    // Try to load a manifest file or common image names
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const years = dataStore[waterBodyKey]?.years || [];
    
    // If we have years, try to load images based on year names
    if (years.length > 0) {
        const imagePromises = years.map(year => {
            return findImage(config.imageFolder, year, imageExtensions);
        });

        const images = await Promise.all(imagePromises);
        displayImages(gallery, images.filter(img => img !== null));
    } else {
        // Try to load any images in the folder
        try {
            const response = await fetch(config.imageFolder);
            // This won't work for local files, but we can try
            showPlaceholderMessage(gallery.id, `Place images in ${config.imageFolder} folder`);
        } catch (error) {
            // Expected for local file system
            if (gallery.querySelector('.image-placeholder')) {
                // Keep the placeholder
                return;
            }
        }
    }
}

// Find image with different extensions
async function findImage(folder, name, extensions) {
    for (const ext of extensions) {
        const imagePath = `${folder}${name}.${ext}`;
        try {
            const response = await fetch(imagePath, { method: 'HEAD' });
            if (response.ok) {
                return {
                    path: imagePath,
                    year: name,
                    alt: `Land cover ${name}`
                };
            }
        } catch (error) {
            // Continue to next extension
        }
    }
    return null;
}

// Display images in gallery
function displayImages(gallery, images) {
    if (images.length === 0) {
        return; // Keep placeholder if no images
    }

    // Remove placeholder
    const placeholder = gallery.querySelector('.image-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    images.forEach(image => {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-item';
        
        const img = document.createElement('img');
        img.src = image.path;
        img.alt = image.alt;
        img.loading = 'lazy';
        img.addEventListener('click', () => openImageModal(image.path));
        
        const label = document.createElement('p');
        label.textContent = image.year;
        label.style.textAlign = 'center';
        label.style.marginTop = '0.5rem';
        label.style.fontSize = '0.9rem';
        label.style.color = 'var(--text-light)';
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(label);
        gallery.appendChild(imgContainer);
    });
}

// Open image in modal
function openImageModal(imagePath) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <span class="modal-close">&times;</span>
            <img class="modal-content" id="modalImage">
        `;
        document.body.appendChild(modal);
        
        // Close modal on click
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                modal.style.display = 'none';
            }
        });
    }
    
    const modalImg = document.getElementById('modalImage');
    modalImg.src = imagePath;
    modal.style.display = 'block';
}

// Initialize comparison chart
function initializeComparisonChart() {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Wait a bit for data to load
    setTimeout(() => {
        const data1 = dataStore.waterBody1;
        const data2 = dataStore.waterBody2;

        if ((!data1 || data1.years.length === 0) && (!data2 || data2.years.length === 0)) {
            showPlaceholderMessage('comparisonChart', 'No data available for comparison.');
            return;
        }

        // Combine years from both datasets
        const allYears = [...new Set([
            ...(data1?.years || []),
            ...(data2?.years || [])
        ])].sort();

        chartInstances.comparisonChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allYears,
                datasets: [
                    {
                        label: 'Water Body 1 - Water (%)',
                        data: mapDataToYears(data1?.water || [], data1?.years || [], allYears),
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderDash: [],
                        tension: 0.4
                    },
                    {
                        label: 'Water Body 1 - Built-up (%)',
                        data: mapDataToYears(data1?.builtup || [], data1?.years || [], allYears),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderDash: [],
                        tension: 0.4
                    },
                    {
                        label: 'Water Body 2 - Water (%)',
                        data: mapDataToYears(data2?.water || [], data2?.years || [], allYears),
                        borderColor: '#2980b9',
                        backgroundColor: 'rgba(41, 128, 185, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.4
                    },
                    {
                        label: 'Water Body 2 - Built-up (%)',
                        data: mapDataToYears(data2?.builtup || [], data2?.years || [], allYears),
                        borderColor: '#c0392b',
                        backgroundColor: 'rgba(192, 57, 43, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }, 500);
}

// Map data to common year array
function mapDataToYears(data, sourceYears, targetYears) {
    return targetYears.map(year => {
        const index = sourceYears.indexOf(year);
        return index !== -1 ? data[index] : null;
    });
}

// Utility functions
function showPlaceholderMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (element && !element.querySelector('.placeholder-message')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-message';
        placeholder.style.padding = '2rem';
        placeholder.style.textAlign = 'center';
        placeholder.style.color = 'var(--text-light)';
        placeholder.textContent = message;
        element.appendChild(placeholder);
    }
}

function showError(message) {
    console.error(message);
    // You could also show a user-friendly error message in the UI
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e74c3c;
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        z-index: 10000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

