import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDXXt1ZI9WjZhJ0zoKsfInsjWfECK4dWoI",
    authDomain: "richdporto.firebaseapp.com",
    projectId: "richdporto",
    storageBucket: "richdporto.appspot.com",
    messagingSenderId: "720478988067",
    appId: "1:720478988067:web:a21abb0396f99872a38e96",
    measurementId: "G-S793S8TH7V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

window.firebase = { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc };

// --- DATA VARIABLES ---
let portfolioLog = [];
let savedSimulations = [];
let performanceChart = null; 
let equityChart = null;      
let currentMarketPrices = {};
let currentUser = null;
let autoSaveTimer = null;
let defaultFeeBeli = 0.15; 
let defaultFeeJual = 0.25; 
// NEW: MASS DELETE STATE
let selectedLogIds = new Set();

const itemsPerPage = 10;
let currentPage = 1;
let filteredLogsData = [];
let sortState = { column: 'date', direction: 'desc' };

const periods = ['1 Bln', '3 Bln', '6 Bln', 'YTD', '1 Thn', '2 Thn', '3 Thn', '4 Thn', '5 Thn', 'All Time'];

// --- DOM ELEMENTS ---
const tabButtons = { 
    simulator: document.getElementById('tab-btn-simulator'), 
    'open-order': document.getElementById('tab-btn-open-order'), 
    log: document.getElementById('tab-btn-log'), 
    saved: document.getElementById('tab-btn-saved'), 
    performance: document.getElementById('tab-btn-performance'),
    settings: document.getElementById('tab-btn-settings'),
    developer: document.getElementById('tab-btn-developer')
};
const tabContents = { 
    simulator: document.getElementById('tab-content-simulator'), 
    'open-order': document.getElementById('tab-content-open-order'), 
    log: document.getElementById('tab-content-log'), 
    saved: document.getElementById('tab-content-saved'), 
    performance: document.getElementById('tab-content-performance'),
    settings: document.getElementById('tab-content-settings'),
    developer: document.getElementById('tab-content-developer')
};

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfoDiv = document.getElementById('user-info');
const userNameSpan = document.getElementById('user-name');
const syncStatusSpan = document.getElementById('sync-status');
const loginWallOverlay = document.getElementById('login-wall-overlay');
const overlayLoginBtn = document.getElementById('overlay-login-btn');

const modals = {
    simParams: document.getElementById('sim-params-modal'),
    addLog: document.getElementById('add-log-modal'),
    sell: document.getElementById('sell-modal'),
    notification: document.getElementById('notification-modal'),
    confirm: document.getElementById('generic-confirm-modal'),
    dummy: document.getElementById('dummy-generator-modal')
};

// --- HELPERS ---
function formatCurrency(value, withSign = false) {
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(value));
    if (!withSign) return formatted;
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
}

function openModal(modal) { if(modal) modal.classList.add('active'); }
function closeModal(modal) { if(modal) modal.classList.remove('active'); }

function showNotification(msg, title = 'INFO') {
    const titleEl = document.getElementById('notification-title');
    const msgEl = document.getElementById('notification-message');
    if(titleEl) titleEl.textContent = title;
    if(msgEl) msgEl.textContent = msg;
    openModal(modals.notification);
}

// Helper khusus untuk menghitung Cash saat ini secara akurat
function getPortfolioCashBalance() {
    const initialEquityEl = document.getElementById('initial-equity');
    const initialEquity = initialEquityEl ? (parseFloat(initialEquityEl.value) || 0) : 0;
    
    let totalBuy = 0, totalSell = 0;

    portfolioLog.forEach(log => {
        const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        totalBuy += buyVal;
        
        if(log.sellPrice) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            totalSell += sellVal; 
        }
    });

    return initialEquity - totalBuy + totalSell;
}

// --- GENERIC CONFIRMATION LOGIC ---
let onConfirmAction = null;

function showConfirm(action, message = "Apakah Anda yakin ingin melanjutkan?", title = "KONFIRMASI") {
    onConfirmAction = action;
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    if(titleEl) titleEl.textContent = title;
    if(msgEl) msgEl.textContent = message;
    openModal(modals.confirm);
}

const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
if(confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => closeModal(modals.confirm));

const confirmOkBtn = document.getElementById('confirm-ok-btn');
if(confirmOkBtn) confirmOkBtn.addEventListener('click', () => {
    if(onConfirmAction) onConfirmAction();
    closeModal(modals.confirm);
});

function switchTab(name) {
    Object.values(tabButtons).forEach(b => { if(b) b.classList.remove('active'); });
    Object.values(tabContents).forEach(c => { if(c) c.classList.remove('active'); });
    
    if(tabButtons[name]) tabButtons[name].classList.add('active');
    if(tabContents[name]) tabContents[name].classList.add('active');
    
    if(name === 'developer') updateDeveloperStats();
    if(name === 'performance') renderPerformanceTable();
}

function initChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (performanceChart) performanceChart.destroy();
    
    const initialData = new Array(periods.length).fill(0);

    // UBAH KE LINE CHART DENGAN STEP 1 (Percent)
    performanceChart = new Chart(ctx, {
        type: 'line', 
        data: {
            labels: periods,
            datasets: [
                { 
                    label: 'Portfolio', 
                    data: initialData, 
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.3 
                },
                { 
                    label: 'IHSG', 
                    data: initialData, 
                    borderColor: '#fb923c', 
                    backgroundColor: 'rgba(251, 146, 60, 0.1)', 
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#fb923c',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true,
                    tension: 0.3 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { labels: { font: { family: 'Space Grotesk', weight: 'bold' }, color: '#18181b' } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: { 
                    grid: { color: '#e5e7eb', borderDash: [4, 4] }, 
                    ticks: { 
                        color: '#374151', 
                        font: { family: 'Inter' },
                        stepSize: 1 
                    } 
                },
                x: { grid: { display: false }, ticks: { color: '#374151', font: { family: 'Inter', weight: 'bold' } } }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });

    initEquityChart();
}

function initEquityChart() {
    const canvas = document.getElementById('equityChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (equityChart) equityChart.destroy();

    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Realized Equity',
                data: [],
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#2563eb',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    grid: { color: '#e5e7eb', borderDash: [4, 4] }, 
                    ticks: { 
                        color: '#374151', 
                        font: { family: 'Inter' },
                        // UPDATE: STEP SIZE 1 JUTA (Agar grid line per 1 jt, tidak loncat 10)
                        stepSize: 1000000, 
                        callback: function(value) { return 'Rp ' + (value/1000000).toFixed(0) + 'jt'; }
                    } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#374151', font: { family: 'Inter', size: 10 } } 
                }
            }
        }
    });
}

function updateEquityChartData() {
    if (!equityChart) return;

    const initialEquityEl = document.getElementById('initial-equity');
    const initialEquity = initialEquityEl ? (parseFloat(initialEquityEl.value) || 0) : 0;
    
    const closedLogs = portfolioLog.filter(log => log.sellPrice && log.sellDate);
    closedLogs.sort((a, b) => new Date(a.sellDate) - new Date(b.sellDate));

    const labels = [];
    const dataPoints = [];
    
    let currentTotalEquity = initialEquity;
    
    labels.push('Start');
    dataPoints.push(initialEquity);

    const dateGroups = {};
    
    closedLogs.forEach(log => {
        if (!dateGroups[log.sellDate]) { dateGroups[log.sellDate] = 0; }
        const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
        const profit = sellVal - buyVal;
        dateGroups[log.sellDate] += profit;
    });

    const sortedDates = Object.keys(dateGroups).sort();
    sortedDates.forEach(date => {
        currentTotalEquity += dateGroups[date];
        labels.push(date);
        dataPoints.push(currentTotalEquity);
    });

    equityChart.data.labels = labels;
    equityChart.data.datasets[0].data = dataPoints;
    equityChart.update();
}

function renderPerformanceTable() {
    const tbody = document.getElementById('performance-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const initialEquityEl = document.getElementById('initial-equity');
    const initialEquity = initialEquityEl ? (parseFloat(initialEquityEl.value) || 0) : 0;
    let cashFlow = 0; 

    portfolioLog.forEach(log => {
        const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        cashFlow -= buyVal; 
        if(log.sellPrice) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            cashFlow += sellVal; 
        }
    });

    const currentCash = initialEquity + cashFlow;
    
    const getAllTimeReturn = () => {
        let totalMarketVal = 0;
        portfolioLog.forEach(log => {
            if (!log.sellPrice) {
                const currPrice = parseFloat(currentMarketPrices[log.code]) || log.price;
                totalMarketVal += currPrice * log.lot * 100;
            }
        });
        const totalVal = currentCash + totalMarketVal;
        return initialEquity > 0 ? ((totalVal - initialEquity) / initialEquity) * 100 : 0;
    };

    const allTimeReturn = getAllTimeReturn();

    const calculateReturnFromDate = (startDate) => {
        const startDateStr = new Date(startDate.getTime() - (startDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let totalPL = 0;
        portfolioLog.forEach(log => {
            if (log.sellPrice && log.sellDate) {
                if (log.sellDate >= startDateStr) {
                    const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli || 0) / 100);
                    const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual || 0) / 100);
                    totalPL += (sellVal - buyVal);
                }
            } else {
                if (log.date >= startDateStr) {
                    const currentPrice = parseFloat(currentMarketPrices[log.code]) || log.price;
                    const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli || 0) / 100);
                    const marketVal = currentPrice * log.lot * 100;
                    totalPL += (marketVal - buyVal);
                }
            }
        });
        return initialEquity > 0 ? (totalPL / initialEquity) * 100 : 0;
    };

    const calculatePeriodReturn = (periodName) => {
        const now = new Date();
        let startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (periodName === '1 Bln') startDate.setMonth(startDate.getMonth() - 1);
        else if (periodName === '3 Bln') startDate.setMonth(startDate.getMonth() - 3);
        else if (periodName === '6 Bln') startDate.setMonth(startDate.getMonth() - 6);
        else if (periodName === '1 Thn') startDate.setFullYear(startDate.getFullYear() - 1);
        else if (periodName === '2 Thn') startDate.setFullYear(startDate.getFullYear() - 2);
        else if (periodName === '3 Thn') startDate.setFullYear(startDate.getFullYear() - 3);
        else if (periodName === '4 Thn') startDate.setFullYear(startDate.getFullYear() - 4);
        else if (periodName === '5 Thn') startDate.setFullYear(startDate.getFullYear() - 5);
        else if (periodName === 'YTD') startDate = new Date(now.getFullYear(), 0, 1);
        else return 0;

        return calculateReturnFromDate(startDate);
    };

    periods.forEach((period, index) => {
        const isAllTime = period === 'All Time';
        let portReturn = isAllTime ? allTimeReturn : calculatePeriodReturn(period);
        const displayReturn = portReturn.toFixed(2) + '%';
        const colorClass = portReturn >= 0 ? 'text-green-600' : 'text-red-600';
        let note = !isAllTime ? '<span class="text-[10px] text-gray-400 font-normal block md:inline md:ml-1">(Realized + New Open)</span>' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-bold align-middle">${period}</td>
            <td class="${colorClass} font-bold align-middle">${displayReturn} ${note}</td>
            <td class="align-middle">
                <input type="number" step="0.01" class="ihsg-input w-24 p-1 border rounded text-right bg-gray-50" data-index="${index}" placeholder="0.00"> %
            </td>
            <td class="font-bold align-middle" id="alpha-${index}">-</td>
        `;
        tbody.appendChild(tr);
    });

    const customRow = document.createElement('tr');
    customRow.className = "bg-yellow-50 border-t-2 border-dashed border-yellow-200";
    customRow.innerHTML = `
        <td class="font-bold align-middle">
            <div class="flex flex-col">
                <span class="text-[10px] text-gray-500 uppercase tracking-wide">Custom Since:</span>
                <input type="date" id="custom-period-date" class="text-xs font-mono border border-gray-300 rounded p-1 w-full mt-1 bg-white">
            </div>
        </td>
        <td class="font-bold align-middle text-lg" id="custom-return-display">-</td>
        <td class="align-middle">
            <input type="number" step="0.01" id="custom-ihsg-input" class="w-24 p-1 border rounded text-right bg-white" placeholder="0.00"> %
        </td>
        <td class="font-bold align-middle" id="custom-alpha-display">-</td>
    `;
    tbody.appendChild(customRow);

    if(performanceChart) {
        performanceChart.data.labels = periods;
        const allTimeIdx = periods.length - 1; 
        const newData = [];
        for(let i=0; i<periods.length; i++) {
            if (i === allTimeIdx) newData.push(allTimeReturn);
            else newData.push(calculatePeriodReturn(periods[i]));
        }
        performanceChart.data.datasets[0].data = newData;
        // Safe resize for IHSG data
        const currentIhsg = performanceChart.data.datasets[1].data;
        const newIhsg = new Array(periods.length).fill(0);
        for(let i=0; i<Math.min(currentIhsg.length, newIhsg.length); i++) {
            newIhsg[i] = currentIhsg[i];
        }
        performanceChart.data.datasets[1].data = newIhsg;
        performanceChart.update();
    }

    updateEquityChartData();

    document.querySelectorAll('.ihsg-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const ihsgVal = parseFloat(e.target.value) || 0;
            const periodName = periods[idx];
            let currentPortReturn = (periodName === 'All Time') ? allTimeReturn : calculatePeriodReturn(periodName);
            const alpha = currentPortReturn - ihsgVal;
            const alphaCell = document.getElementById(`alpha-${idx}`);
            if(alphaCell) {
                alphaCell.textContent = alpha.toFixed(2) + '%';
                alphaCell.className = `font-bold align-middle ${alpha >= 0 ? 'text-green-600' : 'text-red-600'}`;
            }
            if(performanceChart) {
                performanceChart.data.datasets[1].data[idx] = ihsgVal;
                performanceChart.update();
            }
        });
    });

    const customDateInput = document.getElementById('custom-period-date');
    const customReturnDisplay = document.getElementById('custom-return-display');
    const customIhsgInput = document.getElementById('custom-ihsg-input');
    const customAlphaDisplay = document.getElementById('custom-alpha-display');

    const updateCustomRow = () => {
        if (!customDateInput || !customDateInput.value) {
            if(customReturnDisplay) customReturnDisplay.textContent = '-';
            if(customAlphaDisplay) customAlphaDisplay.textContent = '-';
            return;
        }

        const startDate = new Date(customDateInput.value);
        const portReturn = calculateReturnFromDate(startDate);
        const ihsgVal = customIhsgInput ? (parseFloat(customIhsgInput.value) || 0) : 0;
        const alpha = portReturn - ihsgVal;

        if(customReturnDisplay) {
            customReturnDisplay.textContent = portReturn.toFixed(2) + '%';
            customReturnDisplay.className = `font-bold align-middle text-lg ${portReturn >= 0 ? 'text-green-600' : 'text-red-600'}`;
        }
        
        if(customAlphaDisplay) {
            customAlphaDisplay.textContent = alpha.toFixed(2) + '%';
            customAlphaDisplay.className = `font-bold align-middle ${alpha >= 0 ? 'text-green-600' : 'text-red-600'}`;
        }
    };

    if(customDateInput) customDateInput.addEventListener('change', updateCustomRow);
    if(customIhsgInput) customIhsgInput.addEventListener('input', updateCustomRow);
}

function calculateDashboard() {
    const initialPrice = parseFloat(document.getElementById('initial-price').value) || 0;
    const initialLot = parseFloat(document.getElementById('initial-lot').value) || 0;
    const dividend = parseFloat(document.getElementById('dividend').value) || 0;
    const avgDownPercent = parseFloat(document.getElementById('avg-down-percent').value) || 0;
    const avgLevels = parseInt(document.getElementById('avg-levels').value) || 0;
    const tp1Percent = parseFloat(document.getElementById('tp1-percent').value) || 0;
    const tp2Percent = parseFloat(document.getElementById('tp2-percent').value) || 0;
    const avgStrategy = document.getElementById('avg-strategy').value;
    const avgMultiplier = parseFloat(document.getElementById('avg-multiplier').value) || 1;

    const activeParamsDisplay = document.getElementById('active-sim-params-display');
    if(activeParamsDisplay) {
        const strategyText = avgStrategy === 'lot' ? 'Lot Multiplier' : 'Fixed Amount';
        activeParamsDisplay.innerHTML = `
            <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">CODE</div><div class="font-bold text-lg text-blue-600">${document.getElementById('stock-code').value}</div></div>
            <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">ENTRY</div><div class="font-bold">${formatCurrency(initialPrice)}</div></div>
            <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">LOT AWAL</div><div class="font-bold">${initialLot}</div></div>
            <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">GAP</div><div class="font-bold">-${avgDownPercent}%</div></div>
            <div class="bg-white p-2 border border-gray-300 rounded"><div class="text-gray-500 text-xs">STRATEGY</div><div class="font-bold">${strategyText} x${avgMultiplier}</div></div>
        `;
    }

    const tableBody = document.getElementById('scenario-table-body');
    if(tableBody) tableBody.innerHTML = ''; 

    let cumulativeCost = 0, cumulativeShares = 0, currentPrice = initialPrice;
    const initialBuyAmount = initialPrice * initialLot * 100;

    for (let i = 0; i <= avgLevels; i++) {
        let entryPrice, lotsToBuy;
        if (i === 0) {
            entryPrice = initialPrice; lotsToBuy = initialLot;
        } else {
            entryPrice = currentPrice * (1 - avgDownPercent / 100);
            if (avgStrategy === 'lot') {
                lotsToBuy = initialLot * Math.pow(avgMultiplier, i);
            } else {
                const targetAmount = initialBuyAmount * avgMultiplier;
                lotsToBuy = Math.round((targetAmount / entryPrice) / 100);
            }
        }
        if (lotsToBuy <= 0) lotsToBuy = 1;
        const sharesToBuy = lotsToBuy * 100;
        const totalBuy = entryPrice * sharesToBuy;
        cumulativeCost += totalBuy; cumulativeShares += sharesToBuy;
        const avgPrice = cumulativeCost / cumulativeShares;
        const dividendYield = dividend > 0 ? (dividend / entryPrice) * 100 : 0;
        const tp1Price = avgPrice * (1 + tp1Percent / 100);
        const tp2Price = avgPrice * (1 + tp2Percent / 100);
        const profitTp1 = (tp1Price - avgPrice) * cumulativeShares;
        const profitTp2 = (tp2Price - avgPrice) * cumulativeShares;

        if(tableBody) {
            const row = `<tr><td class="font-bold text-gray-400">LVL ${i}</td><td class="font-mono">${formatCurrency(entryPrice)}</td><td class="font-mono">${lotsToBuy}</td><td class="font-mono text-gray-600">${formatCurrency(totalBuy)}</td><td class="${dividendYield > 5 ? 'text-green-600 font-bold' : 'text-gray-400'}">${dividendYield.toFixed(1)}%</td><td class="font-bold text-blue-600 bg-blue-50">${formatCurrency(avgPrice)}</td><td><div class="text-xs text-gray-500">${formatCurrency(tp1Price)}</div><div class="font-bold text-green-600">+${formatCurrency(profitTp1)}</div></td><td><div class="text-xs text-gray-500">${formatCurrency(tp2Price)}</div><div class="font-bold text-green-600">+${formatCurrency(profitTp2)}</div></td></tr>`;
            tableBody.innerHTML += row;
        }
        currentPrice = entryPrice;
    }
    const totalLots = cumulativeShares / 100;
    const finalAvg = cumulativeCost / cumulativeShares;
    
    const sumInv = document.getElementById('summary-total-investment');
    const sumLot = document.getElementById('summary-total-lot');
    const sumAvg = document.getElementById('summary-avg-price');
    if(sumInv) sumInv.textContent = formatCurrency(cumulativeCost);
    if(sumLot) sumLot.textContent = totalLots;
    if(sumAvg) sumAvg.textContent = formatCurrency(finalAvg);
    
    const reason = document.getElementById('sim-reason').value;
    const reasonCard = document.getElementById('simulation-reason-card');
    if(reasonCard) {
        if(reason) {
            document.getElementById('simulation-reason-display').textContent = reason;
            reasonCard.classList.remove('hidden');
        } else {
            reasonCard.classList.add('hidden');
        }
    }
}

function handleSort(column) {
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'desc';
    }
    
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('active-sort');
        const icon = th.querySelector('.sort-icon');
        if(icon) icon.textContent = '▼';
    });
    
    const activeTh = document.querySelector(`.sortable[data-col="${column}"]`);
    if(activeTh) {
        activeTh.classList.add('active-sort');
        activeTh.querySelector('.sort-icon').textContent = sortState.direction === 'asc' ? '▲' : '▼';
    }
    
    // Clear selection on sort to prevent confusion
    selectedLogIds.clear();
    updateMassDeleteUI();
    
    renderLogTable(filteredLogsData);
}

// --- MASS DELETE LOGIC ---
function toggleLogSelection(id) {
    if (selectedLogIds.has(id)) {
        selectedLogIds.delete(id);
    } else {
        selectedLogIds.add(id);
    }
    updateMassDeleteUI();
}

function toggleSelectAll(isChecked, logsInCurrentPage) {
    logsInCurrentPage.forEach(log => {
        if (isChecked) {
            selectedLogIds.add(log.id);
        } else {
            selectedLogIds.delete(log.id);
        }
    });
    
    // Force rerender checkboxes state without full table reload
    document.querySelectorAll('.log-checkbox').forEach(cb => {
        cb.checked = selectedLogIds.has(parseFloat(cb.dataset.id)) || selectedLogIds.has(parseInt(cb.dataset.id)) || selectedLogIds.has(cb.dataset.id);
    });
    updateMassDeleteUI();
}

function updateMassDeleteUI() {
    const btn = document.getElementById('btn-mass-delete');
    const countSpan = document.getElementById('mass-delete-count');
    const selectAllCheckbox = document.getElementById('select-all-logs');

    if (btn && countSpan) {
        countSpan.textContent = selectedLogIds.size;
        if (selectedLogIds.size > 0) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
            if(selectAllCheckbox) selectAllCheckbox.checked = false;
        }
    }
}

function executeMassDelete() {
    if (selectedLogIds.size === 0) return;
    
    showConfirm(() => {
        const initialSize = portfolioLog.length;
        // Filter out items that are in the selectedLogIds Set
        portfolioLog = portfolioLog.filter(log => !selectedLogIds.has(log.id));
        
        const deletedCount = initialSize - portfolioLog.length;
        
        selectedLogIds.clear();
        updateMassDeleteUI();
        refreshData();
        triggerAutoSave();
        showNotification(`Berhasil menghapus ${deletedCount} transaksi.`, "MASS DELETE");
    }, `Anda akan menghapus ${selectedLogIds.size} transaksi terpilih. Tindakan ini tidak dapat dibatalkan.`, "HAPUS BANYAK?");
}

function renderLogTable(logs = portfolioLog) {
    const tbody = document.getElementById('log-table-body');
    const cardView = document.getElementById('log-card-view');
    const selectAllCheckbox = document.getElementById('select-all-logs');

    if(!tbody || !cardView) return;
    tbody.innerHTML = ''; cardView.innerHTML = '';

    let sortedLogs = [...logs];
    sortedLogs.sort((a, b) => {
        let valA, valB;
        switch(sortState.column) {
            case 'date': valA = new Date(a.date); valB = new Date(b.date); break;
            case 'code': valA = a.code; valB = b.code; break;
            case 'price': valA = a.price; valB = b.price; break;
            case 'lot': valA = a.lot; valB = b.lot; break;
            case 'status': valA = a.sellPrice ? 1 : 0; valB = b.sellPrice ? 1 : 0; break;
            case 'pl':
                const getPL = (log) => {
                    if(!log.sellPrice) return -999999999;
                    const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
                    const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
                    return sellVal - buyVal;
                };
                valA = getPL(a); valB = getPL(b);
                break;
            default: valA = a.date; valB = b.date;
        }
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const start = (currentPage - 1) * itemsPerPage;
    const pagedLogs = sortedLogs.slice(start, start + itemsPerPage);
    const pageInfo = document.getElementById('page-info');
    if(pageInfo) pageInfo.textContent = `Showing ${start+1}-${Math.min(start+itemsPerPage, sortedLogs.length)} of ${sortedLogs.length}`;
    
    const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);
    const pageCont = document.getElementById('page-number-container');
    if(pageCont) {
        pageCont.innerHTML = '';
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '← Prev';
        prevBtn.className = 'pagination-btn';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => { if(currentPage > 1) { currentPage--; renderLogTable(filteredLogsData); } };
        pageCont.appendChild(prevBtn);

        for(let i=1; i<=totalPages; i++){
            if (totalPages > 7 && (i !== 1 && i !== totalPages && Math.abs(currentPage - i) > 2)) {
                if (i === 2 || i === totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.textContent = '...';
                    ellipsis.className = 'pagination-info mx-1';
                    pageCont.appendChild(ellipsis);
                }
                continue; 
            }
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            btn.onclick = () => { currentPage = i; renderLogTable(filteredLogsData); };
            pageCont.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = 'Next →';
        nextBtn.className = 'pagination-btn';
        nextBtn.disabled = currentPage === totalPages || totalPages === 0;
        nextBtn.onclick = () => { if(currentPage < totalPages) { currentPage++; renderLogTable(filteredLogsData); } };
        pageCont.appendChild(nextBtn);
    }

    // Handle Select All Checkbox Logic per Page
    if(selectAllCheckbox) {
        // Uncheck header if not all items on page are selected
        const allOnPageSelected = pagedLogs.length > 0 && pagedLogs.every(log => selectedLogIds.has(log.id));
        selectAllCheckbox.checked = allOnPageSelected;
        
        // Remove old listener to avoid duplicates (clone node trick)
        const newSelectAll = selectAllCheckbox.cloneNode(true);
        selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);
        
        newSelectAll.addEventListener('change', (e) => {
            toggleSelectAll(e.target.checked, pagedLogs);
        });
    }

    pagedLogs.forEach((log) => {
        const realIndex = portfolioLog.findIndex(l => l.id === log.id);
        const isOpen = !log.sellPrice;
        const buyCost = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        let pl = 0;
        if(!isOpen) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            pl = sellVal - buyCost;
        }

        const isSelected = selectedLogIds.has(log.id);

        // TABLE ROW
        const tr = document.createElement('tr');
        tr.className = isSelected ? 'bg-yellow-50' : '';
        tr.innerHTML = `
            <td class="text-center align-middle">
                <input type="checkbox" class="log-checkbox custom-checkbox" data-id="${log.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="font-mono text-xs">${log.date}</td>
            <td class="font-bold text-blue-700">${log.code}</td>
            <td class="text-right font-mono">${formatCurrency(log.price)}</td>
            <td class="text-right font-mono">${log.lot}</td>
            <td class="text-center"><span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'OPEN' : 'CLOSED'}</span></td>
            <td class="text-right font-bold ${isOpen ? 'text-gray-400' : (pl >= 0 ? 'text-green-600' : 'text-red-500')}">${isOpen ? '-' : formatCurrency(pl, true)}</td>
            <td class="text-center"><div class="flex justify-center gap-1">${isOpen ? `<button class="btn-sell btn btn-accent px-2 py-0 text-xs border-black" data-index="${realIndex}">JUAL</button>` : ''}<button class="btn-edit btn btn-secondary px-2 py-0 text-xs border-black" data-index="${realIndex}">EDIT</button><button class="btn-delete text-red-500 hover:text-red-700 px-2" data-index="${realIndex}">✕</button></div></td>
        `;
        tbody.appendChild(tr);

        // CARD ROW (Mobile) - Added Select Logic
        const card = document.createElement('div');
        card.className = `card p-4 relative ${isSelected ? 'bg-yellow-50 border-yellow-400' : ''}`;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-start gap-3">
                    <input type="checkbox" class="log-checkbox custom-checkbox mt-1" data-id="${log.id}" ${isSelected ? 'checked' : ''}>
                    <div><span class="text-xs font-mono text-gray-500">${log.date}</span><h4 class="text-xl font-black text-blue-700">${log.code}</h4></div>
                </div>
                <span class="badge ${isOpen ? 'badge-open' : 'badge-closed'}">${isOpen ? 'OPEN' : 'CLOSED'}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm mb-3 pl-8"><div><span class="text-xs text-gray-400">Buy</span> <span class="font-mono font-bold">${formatCurrency(log.price)}</span></div><div><span class="text-xs text-gray-400">Lot</span> <span class="font-mono font-bold">${log.lot}</span></div>${!isOpen ? `<div class="col-span-2 pt-1 border-t border-gray-100 flex justify-between"><span class="text-gray-500">P/L</span> <span class="font-bold ${pl>=0?'text-green-500':'text-red-500'}">${formatCurrency(pl, true)}</span></div>` : ''}</div>
            <div class="flex gap-2 mt-2 border-t border-gray-100 pt-2 pl-8">${isOpen ? `<button class="btn-sell flex-1 btn btn-accent text-xs py-1" data-index="${realIndex}">JUAL</button>` : ''}<button class="btn-edit flex-1 btn btn-secondary text-xs py-1" data-index="${realIndex}">EDIT</button><button class="btn-delete btn btn-danger text-xs py-1" data-index="${realIndex}">DEL</button></div>
        `;
        cardView.appendChild(card);
    });
    
    // Add Event Listeners for new elements
    document.querySelectorAll('.log-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            // Handle number/string type mismatch if generated IDs are numbers
            const parsedId = !isNaN(id) && id.length > 5 ? parseFloat(id) : id; 
            toggleLogSelection(parsedId);
            renderLogTable(filteredLogsData); // Re-render to show background color highlight
        });
    });

    document.querySelectorAll('.btn-sell').forEach(b => b.onclick = () => openSellModal(b.dataset.index));
    document.querySelectorAll('.btn-edit').forEach(b => b.onclick = () => editLog(b.dataset.index));
    document.querySelectorAll('.btn-delete').forEach(b => b.onclick = () => deleteLog(b.dataset.index));
    calculatePortfolioSummary();
}

function calculatePortfolioSummary() {
    const initialEquityEl = document.getElementById('initial-equity');
    const initialEquity = initialEquityEl ? (parseFloat(initialEquityEl.value) || 0) : 0;
    
    let totalBuy = 0, totalSell = 0, realizedPL = 0;
    let stockHoldings = {};

    portfolioLog.forEach(log => {
        const buyVal = log.price * log.lot * 100 * (1 + (log.feeBeli||0)/100);
        totalBuy += buyVal;
        
        if(log.sellPrice) {
            const sellVal = log.sellPrice * log.lot * 100 * (1 - (log.feeJual||0)/100);
            totalSell += sellVal; 
            realizedPL += (sellVal - buyVal);
        } else {
            if(!stockHoldings[log.code]) stockHoldings[log.code] = { lot: 0, cost: 0 };
            stockHoldings[log.code].lot += log.lot; 
            stockHoldings[log.code].cost += buyVal;
        }
    });

    const currentCash = initialEquity - totalBuy + totalSell;
    const currentEquityDisplay = document.getElementById('current-equity-display');
    if(currentEquityDisplay) currentEquityDisplay.textContent = formatCurrency(currentCash);

    const summaryContainer = document.getElementById('portfolio-summary-by-stock');
    if(summaryContainer) {
        summaryContainer.innerHTML = '';
        let totalFloating = 0;
        let totalMarketValue = 0; 

        Object.keys(stockHoldings).forEach(code => {
            const data = stockHoldings[code];
            const avgPrice = data.cost / (data.lot * 100);
            
            const currPrice = parseFloat(currentMarketPrices[code]) || 0;
            const effectivePrice = currPrice > 0 ? currPrice : avgPrice;

            let floating = 0;
            if(currPrice > 0) { 
                floating = (currPrice * data.lot * 100) - data.cost; 
                totalFloating += floating; 
            }

            totalMarketValue += (effectivePrice * data.lot * 100);

            const div = document.createElement('div');
            div.className = 'card bg-white p-3 border-2 border-gray-200';
            div.innerHTML = `<div class="flex justify-between items-center mb-2"><span class="font-black text-lg">${code}</span><span class="text-xs bg-gray-100 px-2 rounded">Lot: ${data.lot}</span></div><div class="text-xs text-gray-500 mb-1">Avg: ${formatCurrency(avgPrice)}</div><div class="flex items-center gap-2 mb-2"><span class="text-xs">Market:</span><input type="number" value="${currPrice || ''}" class="price-input w-24 text-right p-1 h-6 text-sm border-gray-300" placeholder="Harga" data-code="${code}"></div><div class="text-right font-bold ${floating>=0?'text-green-500':'text-red-500'}">${currPrice > 0 ? formatCurrency(floating, true) : 'Set Price'}</div>`;
            summaryContainer.appendChild(div);
        });

        const totalAsset = currentCash + totalMarketValue;
        const totalAssetDisplay = document.getElementById('total-portfolio-value-display');
        if(totalAssetDisplay) {
            totalAssetDisplay.textContent = formatCurrency(totalAsset);
            if (totalAsset >= initialEquity) {
                totalAssetDisplay.className = "text-xl font-black text-blue-700 tracking-tight";
            } else {
                totalAssetDisplay.className = "text-xl font-black text-red-600 tracking-tight";
            }
        }

        const realizedEl = document.getElementById('realized-pl-summary');
        if(realizedEl) realizedEl.innerHTML = `<div class="flex justify-between text-sm mt-2 font-bold ${realizedPL>=0?'text-green-600':'text-red-500'}"><span>Realized P/L</span> <span>${formatCurrency(realizedPL, true)}</span></div>`;
        
        const floatingEl = document.getElementById('floating-pl-summary');
        if(floatingEl) floatingEl.innerHTML = `<div class="flex justify-between text-sm font-bold ${totalFloating>=0?'text-green-600':'text-red-500'}"><span>Floating P/L</span> <span>${formatCurrency(totalFloating, true)}</span></div>`;
    
        document.querySelectorAll('.price-input').forEach(input => { input.onchange = (e) => updatePrice(e.target.dataset.code, e.target.value); });
    }
    
    renderPerformanceTable();
}

function updatePrice(code, price) { currentMarketPrices[code] = price; calculatePortfolioSummary(); triggerAutoSave(); }
function deleteLog(index) { showConfirm(() => { portfolioLog.splice(index, 1); refreshData(); }, "Hapus data transaksi ini?", "Hapus Transaksi"); }
function openSellModal(index) { document.getElementById('sell-log-index').value = index; document.getElementById('sell-date').value = new Date().toISOString().split('T')[0]; document.getElementById('sell-fee-jual').value = defaultFeeJual; openModal(modals.sell); }
function editLog(index) {
    const log = portfolioLog[index];
    document.getElementById('log-edit-index').value = index;
    document.getElementById('log-stock-code').value = log.code;
    document.getElementById('log-buy-date').value = log.date;
    document.getElementById('log-buy-price').value = log.price;
    document.getElementById('log-buy-lot').value = log.lot;
    document.getElementById('log-fee-beli').value = log.feeBeli || defaultFeeBeli;
    document.getElementById('log-reason').value = log.reason || '';
    const sellContainer = document.getElementById('sell-fields-container');
    if(log.sellPrice) {
        sellContainer.classList.remove('hidden');
        document.getElementById('log-sell-price').value = log.sellPrice;
        document.getElementById('log-sell-date').value = log.sellDate;
        document.getElementById('log-fee-jual').value = log.feeJual;
    } else { sellContainer.classList.add('hidden'); }
    openModal(modals.addLog);
}

// --- DEVELOPER TOOLS LOGIC ---
function updateDeveloperStats() {
    document.getElementById('dev-user-id').textContent = currentUser ? currentUser.uid : 'Not Logged In';
    const dataSize = new Blob([JSON.stringify({portfolioLog, savedSimulations})]).size;
    document.getElementById('dev-memory-size').textContent = (dataSize / 1024).toFixed(2) + ' KB';
}

// --- NEW: ADVANCED DUMMY GENERATOR LOGIC ---
function openDummyModal() {
    // Set default date values
    const end = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    
    const dateStartInput = document.getElementById('dummy-date-start');
    const dateEndInput = document.getElementById('dummy-date-end');
    
    if(dateStartInput) dateStartInput.value = start.toISOString().split('T')[0];
    if(dateEndInput) dateEndInput.value = end;
    
    openModal(modals.dummy);
}

function generateAdvancedDummyData(params) {
    const codes = ['BBCA', 'BMRI', 'TLKM', 'ASII', 'BBRI', 'GOTO', 'UNVR', 'ICBP', 'ADRO', 'BBNI'];
    const newLogs = [];
    
    const { count, statusMode, priceMin, priceMax, lotMin, lotMax, startDate, endDate } = params;
    
    const startTs = new Date(startDate).getTime();
    const endTs = new Date(endDate).getTime();

    for(let i=0; i < count; i++) {
        const code = codes[Math.floor(Math.random() * codes.length)];
        
        // Random Price
        const buyPrice = Math.floor(Math.random() * (priceMax - priceMin + 1)) + priceMin;
        
        // Random Lot
        const buyLot = Math.floor(Math.random() * (lotMax - lotMin + 1)) + lotMin;
        
        // Random Buy Date
        const buyDateTs = Math.floor(Math.random() * (endTs - startTs + 1)) + startTs;
        const buyDateStr = new Date(buyDateTs).toISOString().split('T')[0];
        
        let sellPrice = null;
        let sellDateStr = null;
        let feeJual = null;

        // Determine Status
        let isClosed = false;
        if (statusMode === 'closed') isClosed = true;
        else if (statusMode === 'open') isClosed = false;
        else isClosed = Math.random() > 0.5; // Mixed

        if (isClosed) {
            // Generate realistic Sell Date (must be >= Buy Date)
            // Random hold time between 1 day and (End Date - Buy Date)
            const remainingTime = endTs - buyDateTs;
            // Hold at least 1 day (86400000 ms), max remaining time
            const holdTime = Math.floor(Math.random() * remainingTime); 
            const sellDateTs = buyDateTs + holdTime;
            sellDateStr = new Date(sellDateTs).toISOString().split('T')[0];

            // Generate realistic Sell Price (Profit/Loss between -15% to +25%)
            const percentage = (Math.random() * 40) - 15; // Range -15 to +25
            sellPrice = Math.floor(buyPrice * (1 + percentage / 100));
            if(sellPrice <= 0) sellPrice = 50; // Min price guard

            feeJual = defaultFeeJual;
        }

        newLogs.push({
            id: Date.now() + i + Math.random(), // Ensure unique ID
            code: code,
            date: buyDateStr,
            price: buyPrice,
            lot: buyLot,
            feeBeli: defaultFeeBeli,
            reason: "Generated Dummy Data",
            sellPrice: sellPrice,
            sellDate: sellDateStr,
            feeJual: feeJual
        });
    }

    portfolioLog = [...portfolioLog, ...newLogs];
    refreshData();
    triggerAutoSave();
    showNotification(`Berhasil generate ${count} data dummy!`, "SUCCESS");
    closeModal(modals.dummy);
}

// Handler for dummy form submission
document.getElementById('dummy-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const params = {
        count: parseInt(document.getElementById('dummy-count').value) || 10,
        statusMode: document.getElementById('dummy-status').value,
        priceMin: parseInt(document.getElementById('dummy-price-min').value) || 100,
        priceMax: parseInt(document.getElementById('dummy-price-max').value) || 10000,
        lotMin: parseInt(document.getElementById('dummy-lot-min').value) || 1,
        lotMax: parseInt(document.getElementById('dummy-lot-max').value) || 100,
        startDate: document.getElementById('dummy-date-start').value,
        endDate: document.getElementById('dummy-date-end').value
    };

    generateAdvancedDummyData(params);
});

// Update Button Listener in Developer Tab
document.getElementById('btn-open-dummy-modal').addEventListener('click', openDummyModal);
document.getElementById('cancel-dummy-btn').addEventListener('click', () => closeModal(modals.dummy));


function hardResetData() {
    portfolioLog = [];
    savedSimulations = [];
    currentMarketPrices = {};
    refreshData();
    triggerAutoSave();
    showNotification("Semua data telah dihapus.");
}

document.getElementById('btn-hard-reset').addEventListener('click', () => {
    showConfirm(hardResetData, "PERINGATAN: Ini akan menghapus SELURUH data transaksi dan simulasi Anda secara permanen. Tindakan ini tidak dapat dibatalkan.", "HARD RESET WARNING");
});

document.getElementById('sim-params-form').addEventListener('submit', (e) => { e.preventDefault(); ['stock-code', 'initial-price', 'initial-lot', 'dividend', 'avg-down-percent', 'avg-levels', 'avg-strategy', 'avg-multiplier', 'tp1-percent', 'tp2-percent', 'sim-reason'].forEach(id => { document.getElementById(id).value = document.getElementById(`modal-${id}`).value; }); calculateDashboard(); closeModal(modals.simParams); triggerAutoSave(); });

// === LOGIKA PENTING YANG DIUBAH ADA DI SINI ===
document.getElementById('log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // 1. Ambil Nilai Input
    const price = parseFloat(document.getElementById('log-buy-price').value);
    const lot = parseInt(document.getElementById('log-buy-lot').value);
    const feePercent = parseFloat(document.getElementById('log-fee-beli').value);
    
    // 2. Hitung Biaya Transaksi Baru
    const costOfNewTransaction = price * lot * 100 * (1 + feePercent/100);
    
    // 3. Ambil Cash Saat Ini
    let currentAvailableCash = getPortfolioCashBalance();
    
    // 4. Cek apakah ini mode Edit atau Tambah Baru
    const idxVal = document.getElementById('log-edit-index').value;
    const isEdit = idxVal !== '';
    
    if (isEdit) {
        // Jika Edit, kita perlu 'mengembalikan' dulu biaya transaksi lama ke saldo cash
        // supaya bisa dicek apakah saldo cukup untuk revisinya.
        const oldLog = portfolioLog[idxVal];
        const oldCost = oldLog.price * oldLog.lot * 100 * (1 + (oldLog.feeBeli||0)/100);
        currentAvailableCash += oldCost;
    }

    // 5. VALIDASI SALDO
    if (costOfNewTransaction > currentAvailableCash) {
        showNotification(
            `Dana tidak mencukupi!\n\nCash Tersedia: ${formatCurrency(currentAvailableCash)}\nButuh: ${formatCurrency(costOfNewTransaction)}\nKurang: ${formatCurrency(costOfNewTransaction - currentAvailableCash)}`, 
            "TRANSAKSI DITOLAK"
        );
        return; // Hentikan proses, jangan disimpan
    }

    // 6. Jika lolos validasi, Lanjutkan Simpan
    const newLog = { 
        id: isEdit ? portfolioLog[idxVal].id : Date.now(), 
        code: document.getElementById('log-stock-code').value.toUpperCase(), 
        date: document.getElementById('log-buy-date').value, 
        price: price, 
        lot: lot, 
        feeBeli: feePercent, 
        reason: document.getElementById('log-reason').value, 
        sellPrice: null, 
        sellDate: null, 
        feeJual: null 
    };
    
    const sellP = document.getElementById('log-sell-price').value;
    if(sellP && !document.getElementById('sell-fields-container').classList.contains('hidden')) {
        newLog.sellPrice = parseFloat(sellP);
        newLog.sellDate = document.getElementById('log-sell-date').value;
        newLog.feeJual = parseFloat(document.getElementById('log-fee-jual').value);
    }
    
    if(isEdit) portfolioLog[idxVal] = newLog; else portfolioLog.push(newLog);
    closeModal(modals.addLog); 
    refreshData();
});

document.getElementById('sell-form').addEventListener('submit', (e) => { e.preventDefault(); const idx = document.getElementById('sell-log-index').value; const log = portfolioLog[idx]; log.sellPrice = parseFloat(document.getElementById('sell-price').value); log.sellDate = document.getElementById('sell-date').value; log.feeJual = parseFloat(document.getElementById('sell-fee-jual').value); closeModal(modals.sell); refreshData(); });
document.getElementById('save-simulation-from-modal-btn').addEventListener('click', () => { const sim = { id: Date.now(), stockCode: document.getElementById('modal-stock-code').value, initialPrice: document.getElementById('modal-initial-price').value, initialLot: document.getElementById('modal-initial-lot').value, avgStrategy: document.getElementById('modal-avg-strategy').value, avgMultiplier: document.getElementById('modal-avg-multiplier').value, avgDownPercent: document.getElementById('modal-avg-down-percent').value, avgLevels: document.getElementById('modal-avg-levels').value }; savedSimulations.push(sim); renderSavedSimulations(); triggerAutoSave(); showNotification('Simulasi tersimpan!'); });

function renderSavedSimulations() {
    const tbody = document.getElementById('saved-simulations-table-body'); if(!tbody) return; tbody.innerHTML = '';
    savedSimulations.forEach((sim, idx) => { const tr = document.createElement('tr'); tr.innerHTML = `<td class="font-bold">${sim.stockCode}</td><td>${formatCurrency(sim.initialPrice)}</td><td>${sim.initialLot}</td><td>${sim.avgStrategy} x${sim.avgMultiplier}</td><td>${sim.avgDownPercent}%</td><td>${sim.avgLevels}</td><td><button class="btn-load btn btn-secondary py-0 px-2 text-xs border-black" data-index="${idx}">LOAD</button><button class="btn-del-sim text-red-500 ml-2" data-index="${idx}">✕</button></td>`; tbody.appendChild(tr); });
    document.querySelectorAll('.btn-load').forEach(b => b.onclick = () => loadSim(b.dataset.index));
    document.querySelectorAll('.btn-del-sim').forEach(b => b.onclick = () => deleteSim(b.dataset.index));
}

function loadSim(idx) { const sim = savedSimulations[idx]; document.getElementById('stock-code').value = sim.stockCode; document.getElementById('initial-price').value = sim.initialPrice; document.getElementById('initial-lot').value = sim.initialLot; document.getElementById('avg-strategy').value = sim.avgStrategy; document.getElementById('avg-multiplier').value = sim.avgMultiplier; document.getElementById('avg-down-percent').value = sim.avgDownPercent; document.getElementById('avg-levels').value = sim.avgLevels; document.getElementById('modal-stock-code').value = sim.stockCode; document.getElementById('modal-initial-price').value = sim.initialPrice; document.getElementById('modal-initial-lot').value = sim.initialLot; document.getElementById('modal-avg-strategy').value = sim.avgStrategy; document.getElementById('modal-avg-multiplier').value = sim.avgMultiplier; document.getElementById('modal-avg-down-percent').value = sim.avgDownPercent; document.getElementById('modal-avg-levels').value = sim.avgLevels; calculateDashboard(); switchTab('simulator'); }
function deleteSim(idx) { showConfirm(() => { savedSimulations.splice(idx, 1); renderSavedSimulations(); triggerAutoSave(); }, "Hapus simulasi ini?", "Hapus Simulasi"); }
document.getElementById('filter-apply-btn').addEventListener('click', () => { const code = document.getElementById('filter-stock-code').value.toUpperCase(); const status = document.getElementById('filter-status').value; filteredLogsData = portfolioLog.filter(log => { if(code && !log.code.includes(code)) return false; if(status === 'open' && log.sellPrice) return false; if(status === 'closed' && !log.sellPrice) return false; return true; }); currentPage = 1; renderLogTable(filteredLogsData); });
document.getElementById('filter-reset-btn').addEventListener('click', () => { document.getElementById('filter-stock-code').value = ''; filteredLogsData = portfolioLog; renderLogTable(filteredLogsData); });
document.getElementById('download-json-btn').addEventListener('click', () => { const data = { portfolioLog, savedSimulations, currentMarketPrices, defaultFeeBeli, defaultFeeJual }; const blob = new Blob([JSON.stringify(data)], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'portfolio_backup.json'; a.click(); });
document.getElementById('upload-json-input').addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { const data = JSON.parse(ev.target.result); portfolioLog = data.portfolioLog || []; savedSimulations = data.savedSimulations || []; currentMarketPrices = data.currentMarketPrices || {}; refreshData(); showNotification('Data Restore Berhasil!'); }; reader.readAsText(file); });

function triggerAutoSave() { if(!currentUser) return; syncStatusSpan.style.opacity = 1; clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(async () => { const data = { portfolioLog, savedSimulations, currentMarketPrices, updatedAt: new Date().toISOString() }; try { await setDoc(doc(db, "portfolios", currentUser.uid), data); syncStatusSpan.textContent = 'SAVED'; setTimeout(() => syncStatusSpan.style.opacity = 0, 2000); } catch(e) { syncStatusSpan.textContent = 'ERROR'; } }, 1000); }
async function loadCloudData() { if(!currentUser) return; const docSnap = await getDoc(doc(db, "portfolios", currentUser.uid)); if(docSnap.exists()) { const data = docSnap.data(); portfolioLog = data.portfolioLog || []; savedSimulations = data.savedSimulations || []; currentMarketPrices = data.currentMarketPrices || {}; refreshData(); } }
function refreshData() { filteredLogsData = portfolioLog; renderLogTable(); renderSavedSimulations(); calculateDashboard(); renderPerformanceTable(); updateDeveloperStats(); }

// --- MOBILE ACCORDION LOGIC ---
function initMobileAccordion() {
    const toggleSummary = document.getElementById('toggle-summary-btn');
    const contentSummary = document.getElementById('summary-content');
    const arrowSummary = document.getElementById('arrow-summary');

    const toggleFilter = document.getElementById('toggle-filter-btn');
    const contentFilter = document.getElementById('filter-content');
    const arrowFilter = document.getElementById('arrow-filter');

    const isMobile = () => window.innerWidth < 1024;

    if(toggleSummary) {
        toggleSummary.addEventListener('click', () => {
            if(isMobile()) {
                contentSummary.classList.toggle('hidden');
                arrowSummary.classList.toggle('rotate-180');
            }
        });
    }

    if(toggleFilter) {
        toggleFilter.addEventListener('click', () => {
            if(isMobile()) {
                contentFilter.classList.toggle('hidden');
                arrowFilter.classList.toggle('rotate-180');
            }
        });
    }
}

window.addEventListener('load', () => {
    initChart(); 
    calculateDashboard(); 
    
    const initialEquityInput = document.getElementById('initial-equity');
    if(initialEquityInput) {
        initialEquityInput.addEventListener('input', () => {
            calculatePortfolioSummary();
            triggerAutoSave();
        });
    }

    const nav = document.getElementById('tab-nav-wrapper'); 
    if(nav) {
        const navOffset = nav.offsetTop; 
        window.addEventListener('scroll', () => { 
            if(window.scrollY >= navOffset) nav.classList.add('sticky-state'); 
            else nav.classList.remove('sticky-state'); 
        });
    }

    initMobileAccordion();

    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.col));
    });

    // --- AUTH HANDLER ---
    const handleLogin = async () => { try { await signInWithPopup(auth, provider); } catch(e) { showNotification(e.message); } };
    if(loginBtn) loginBtn.addEventListener('click', handleLogin); 
    if(overlayLoginBtn) overlayLoginBtn.addEventListener('click', handleLogin); 

    if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
    
    onAuthStateChanged(auth, (user) => { 
        currentUser = user; 
        if(user) { 
            if(loginWallOverlay) loginWallOverlay.classList.add('hidden-wall');
            if(loginBtn) loginBtn.classList.add('hidden'); 
            if(userInfoDiv) {
                userInfoDiv.classList.remove('hidden'); 
                userInfoDiv.classList.add('flex'); 
            }
            if(userNameSpan) userNameSpan.textContent = user.displayName; 
            loadCloudData(); 
        } else { 
            if(loginWallOverlay) loginWallOverlay.classList.remove('hidden-wall');
            if(loginBtn) loginBtn.classList.add('hidden');
            if(userInfoDiv) {
                userInfoDiv.classList.add('hidden'); 
                userInfoDiv.classList.remove('flex'); 
            }
            portfolioLog = []; 
            savedSimulations = []; 
            refreshData(); 
        } 
    });

    // Mass Delete Button Event
    const massDeleteBtn = document.getElementById('btn-mass-delete');
    if(massDeleteBtn) {
        massDeleteBtn.addEventListener('click', executeMassDelete);
    }

    document.getElementById('open-add-log-modal-btn').addEventListener('click', () => { 
        document.getElementById('log-form').reset(); 
        document.getElementById('log-edit-index').value = ''; 
        document.getElementById('sell-fields-container').classList.add('hidden'); 
        document.getElementById('log-buy-date').value = new Date().toISOString().split('T')[0]; 
        document.getElementById('log-fee-beli').value = defaultFeeBeli; 
        openModal(modals.addLog); 
    });
    document.getElementById('cancel-add-log-btn').addEventListener('click', () => closeModal(modals.addLog));
    document.getElementById('open-sim-params-modal-btn').addEventListener('click', () => { ['stock-code', 'initial-price', 'initial-lot', 'dividend', 'avg-down-percent', 'avg-levels', 'tp1-percent', 'tp2-percent', 'sim-reason'].forEach(id => document.getElementById(`modal-${id}`).value = document.getElementById(id).value); openModal(modals.simParams); });
    document.getElementById('cancel-sim-params-btn').addEventListener('click', () => closeModal(modals.simParams));
    document.getElementById('cancel-sell-btn').addEventListener('click', () => closeModal(modals.sell));
    document.getElementById('notification-ok-btn').addEventListener('click', () => closeModal(modals.notification));
    
    document.querySelectorAll('.tab-button').forEach(btn => { btn.addEventListener('click', (e) => switchTab(e.target.id.replace('tab-btn-', ''))); });
});